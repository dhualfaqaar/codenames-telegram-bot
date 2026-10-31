/** Transactional, backward-compatible partitioning of the bot's persisted state.
 * The legacy key is deliberately retained as a pre-migration snapshot, not a live backup.
 */
export const PARTITIONED_HEAD = 'bot-state:v2:head';
const PREFIX = 'bot-state:v2:';
const PAGE_SIZE = 128;
const PARTITIONED_MAPS = ['users', 'chats'] as const;
type Name = typeof PARTITIONED_MAPS[number];
interface Head { version: 2; fields: string[]; pages: Record<Name, number>; }
interface Store {
  get(key: string): Promise<any>;
  transaction<T>(fn: (txn: { put(key: string, value: unknown): Promise<void> }) => Promise<T>): Promise<T>;
}
const fieldKey = (field: string) => `${PREFIX}field:${field}`;
const pageKey = (name: Name, index: number) => `${PREFIX}${name}:${index}`;
const UNDEFINED = '__bot_state_undefined_v2__';

/** Conservative change detector: unsupported or shared/cyclic values always get written.
 * Tags encode undefined distinctly; a user object with the reserved key is never compared.
 */
function fingerprint(value: unknown): string | null {
  const seen = new WeakSet<object>();
  function check(item: any): void {
    if (item === undefined || item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number') { if (!Number.isFinite(item) || Object.is(item, -0)) throw new Error(); return; }
    if (typeof item !== 'object' || seen.has(item)) throw new Error();
    seen.add(item);
    if (Object.getOwnPropertySymbols(item).length) throw new Error();
    if (Array.isArray(item)) {
      if (Object.keys(item).length !== item.length) throw new Error();
      for (let i = 0; i < item.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(item, i)) throw new Error();
        check(item[i]);
      }
      return;
    }
    if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) throw new Error();
    for (const key of Object.keys(item)) {
      if (key === UNDEFINED) throw new Error();
      const desc = Object.getOwnPropertyDescriptor(item, key);
      if (!desc || !('value' in desc)) throw new Error();
      check(desc.value);
    }
  }
  try {
    check(value);
    return JSON.stringify(value, (_key, item) => item === undefined ? { [UNDEFINED]: true } : item) ?? null;
  } catch { return null; }
}

function validateHead(value: any): asserts value is Head {
  if (!value || value.version !== 2 || !Array.isArray(value.fields) || !value.pages ||
    !value.fields.every((x: unknown) => typeof x === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(x) && !PARTITIONED_MAPS.includes(x as Name)) ||
    new Set(value.fields).size !== value.fields.length ||
    !PARTITIONED_MAPS.every(name => Number.isSafeInteger(value.pages[name]) && value.pages[name] >= 0 && value.pages[name] <= 100000)) {
    throw new Error('Invalid partitioned bot state manifest');
  }
}

function parts(snapshot: any): { head: Head; values: Map<string, unknown> } {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Invalid bot state');
  const fields = Object.keys(snapshot).filter(key => !PARTITIONED_MAPS.includes(key as Name)).sort();
  const head: Head = { version: 2, fields, pages: { users: 0, chats: 0 } };
  validateHead(head);
  const values = new Map<string, unknown>();
  for (const field of fields) values.set(fieldKey(field), snapshot[field]);
  for (const name of PARTITIONED_MAPS) {
    if (!Array.isArray(snapshot[name])) throw new Error(`Invalid ${name} entries`);
    for (let n = 0; n < snapshot[name].length; n += PAGE_SIZE) {
      values.set(pageKey(name, head.pages[name]++), snapshot[name].slice(n, n + PAGE_SIZE));
    }
  }
  return { head, values };
}

export class PartitionedBotState {
  private ready = false;
  private partitioned = false;
  private fingerprints = new Map<string, string | null>();
  private headFingerprint: string | null = null;
  constructor(private storage: Store) {}

  async load(): Promise<unknown> {
    const head = await this.storage.get(PARTITIONED_HEAD);
    if (head === undefined) {
      const legacy = await this.storage.get('state');
      this.ready = true;
      return legacy;
    }
    validateHead(head);
    const state: Record<string, unknown> = {};
    const cached = new Map<string, string | null>();
    for (const field of head.fields) {
      const key = fieldKey(field);
      const entry = await this.storage.get(key);
      // Each part is wrapped so that an explicitly undefined value is distinguishable from a missing key.
      if (!entry || entry.v !== 1 || !Object.prototype.hasOwnProperty.call(entry, 'data')) throw new Error('Missing bot state field');
      state[field] = entry.data;
      cached.set(key, fingerprint(entry.data));
    }
    for (const name of PARTITIONED_MAPS) {
      const items: unknown[] = [];
      for (let index = 0; index < head.pages[name]; index++) {
        const key = pageKey(name, index);
        const entry = await this.storage.get(key);
        if (!entry || entry.v !== 1 || !Array.isArray(entry.data) || entry.data.length < 1 || entry.data.length > PAGE_SIZE ||
            (index < head.pages[name] - 1 && entry.data.length !== PAGE_SIZE) ||
            !entry.data.every((pair: any) => Array.isArray(pair) && pair.length === 2)) throw new Error('Invalid bot state page');
        items.push(...entry.data);
        cached.set(key, fingerprint(entry.data));
      }
      if (new Set(items.map((pair: any) => pair[0])).size !== items.length) throw new Error('Duplicate bot state record');
      state[name] = items;
    }
    this.fingerprints = cached;
    this.headFingerprint = fingerprint(head);
    this.partitioned = true;
    this.ready = true;
    return state;
  }

  async save(raw: unknown): Promise<void> {
    if (!this.ready) throw new Error('Bot state not loaded');
    // Snapshot before any await, preserving structured-clone data and concurrent updates.
    const snapshot = structuredClone(raw);
    const { head, values } = parts(snapshot);
    const next = new Map<string, string | null>();
    const changed: Array<[string, unknown]> = [];
    for (const [key, data] of values) {
      const digest = fingerprint(data);
      next.set(key, digest);
      if (!this.partitioned || digest === null || this.fingerprints.get(key) !== digest) changed.push([key, data]);
    }
    const headDigest = fingerprint(head);
    const headChanged = !this.partitioned || this.headFingerprint !== headDigest;
    if (changed.length || headChanged) {
      // All new pages and the manifest become visible atomically. Obsolete pages
      // and the legacy key remain untouched, so no migration deletes user data.
      await this.storage.transaction(async txn => {
        for (const [key, data] of changed) await txn.put(key, { v: 1, data });
        if (headChanged) await txn.put(PARTITIONED_HEAD, head);
      });
    }
    this.fingerprints = next;
    this.headFingerprint = headDigest;
    this.partitioned = true;
  }
}
