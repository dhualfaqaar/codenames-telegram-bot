import type { BookStorageAdapter } from './bookCatalog';
import { ChannelBookIndex } from './channelBookIndex';

const META = 'books:channel-import:state';
const PREFIX = 'books:channel-import:batch:';
const MAX_PACKAGE_BYTES = 18 * 1024 * 1024;
const MAX_BATCHES = 1000;
const MAX_COMPRESSED_BASE64 = 120000;
const MAX_INFLATED = 3 * 1024 * 1024;

export interface ChannelImportState {
  id: string;
  status: 'processing' | 'done' | 'error';
  batches: number;
  next: number;
  indexed: number;
  expected: number;
  chatId: string;
}

/** Persistent queue; batches and progress are separate from game state. */
export class ChannelImportQueue {
  constructor(private storage: BookStorageAdapter, private index: ChannelBookIndex, private schedule?: () => Promise<void>) {}

  async state(): Promise<ChannelImportState | undefined> {
    return this.storage.get<ChannelImportState>(META);
  }

  async stage(data: unknown, chatId: string): Promise<ChannelImportState> {
    const payload = data as any;
    const current = await this.state();
    if (current?.status === 'processing') throw new Error('busy');
    if (payload?.format !== 'lovekotob-bulk-v1' || payload.source !== 'lovekotob' ||
        !Number.isSafeInteger(payload.count) || payload.count < 1 || !Array.isArray(payload.batches) ||
        payload.batches.length < 1 || payload.batches.length > MAX_BATCHES ||
        payload.count > payload.batches.length * 1000 || !/^\d+$/.test(chatId)) throw new Error('invalid package');
    let size = 0;
    for (const item of payload.batches) {
      if (typeof item !== 'string' || item.length < 16 || item.length > MAX_COMPRESSED_BASE64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(item)) throw new Error('invalid batch');
      size += item.length;
      if (size > MAX_PACKAGE_BYTES) throw new Error('package too large');
    }
    const id = crypto.randomUUID();
    const written: string[] = [];
    try {
      for (let n = 0; n < payload.batches.length; n++) {
        const key = `${PREFIX}${id}:${n}`;
        await this.storage.put(key, payload.batches[n]);
        written.push(key);
      }
      const state: ChannelImportState = { id, status: 'processing', batches: payload.batches.length, next: 0, indexed: 0, expected: payload.count, chatId };
      // Arm the alarm before committing the job, so a restart cannot strand it.
      if (this.schedule) await this.schedule();
      await this.storage.put(META, state);
      return state;
    } catch (error) {
      for (const key of written) { try { await this.storage.delete(key); } catch { /* optional cleanup */ } }
      throw error;
    }
  }

  /** At most one batch per alarm so games and updates remain responsive. */
  async processOne(): Promise<ChannelImportState | undefined> {
    const state = await this.state();
    if (!state || state.status !== 'processing') return state;
    const key = `${PREFIX}${state.id}:${state.next}`;
    try {
      const encoded = await this.storage.get<string>(key);
      if (!encoded || encoded.length > MAX_COMPRESSED_BASE64) throw new Error('missing batch');
      const binary = atob(encoded);
      const compressed = Uint8Array.from(binary, char => char.charCodeAt(0));
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > MAX_INFLATED) { await reader.cancel(); throw new Error('inflated batch too large'); }
        chunks.push(part.value);
      }
      const json = await new Blob(chunks as BlobPart[]).text();
      const count = await this.index.importBatch(JSON.parse(json));
      state.indexed += count;
      state.next++;
      if (state.next === state.batches) state.status = 'done';
      // If interrupted, importBatch is idempotent and the same batch can be retried.
      await this.storage.put(META, state);
      try { await this.storage.delete(key); } catch { /* the batch was already committed */ }
      return state;
    } catch {
      state.status = 'error';
      await this.storage.put(META, state);
      return state;
    }
  }
}
