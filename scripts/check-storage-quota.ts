import assert from 'node:assert/strict';
const { BotState } = await (new Function('url', 'return import(url)'))(new URL('../worker/index.ts', import.meta.url).href);
import { BookCatalog, memoryBookStorage } from '../src/services/bookCatalog';

// Read failure must not be silently turned into an empty catalog that could
// overwrite stored chunks on the next seed.
const storage = memoryBookStorage();
const put = storage.put.bind(storage);
let writes = 0;
storage.put = async (key, value) => { writes++; await put(key, value); };
storage.list = async () => { throw new Error('quota'); };
const catalog = new BookCatalog(storage, async () => new Response('{}'));
await assert.rejects(() => catalog.seed(1), /quota/);
await assert.rejects(() => catalog.seed(1), /quota/);
assert.equal(writes, 0);

const data = new Map<string, any>();
let scheduled: number | null = null;
let alarmWrites = 0;
let stateWrites = 0;
const db: any = {
  get: async (key: string) => data.get(key),
  put: async (key: string, value: any) => { data.set(key, value); if (key === 'state') stateWrites++; },
  getAlarm: async () => scheduled,
  setAlarm: async (at: number) => { scheduled = at; alarmWrites++; },
  deleteAlarm: async () => { scheduled = null; alarmWrites++; }
};
let seeds = 0;
let value = 0;
let change = false;
const fakeBot = {
  getNextQuizDeadline: () => null,
  bookCatalogNeedsMore: () => true,
  hasActiveFootballAlerts: () => false,
  exportState: () => ({ value }),
  processQuizTimers: async () => { if (change) value++; },
  processFootballAlerts: async () => {},
  seedBookCatalog: async (queries: number) => { assert.equal(queries, 1); seeds++; },
  channelImportPending: async () => { throw new Error('must not schedule paused import'); },
  processChannelImport: async () => { throw new Error('must not process paused import'); }
};
const worker: any = new BotState({ storage: db }, {} as any);
worker.bot = fakeBot;
await worker.syncAlarm(fakeBot);
assert.equal(alarmWrites, 1);
await worker.syncAlarm(fakeBot);
assert.equal(alarmWrites, 1); // no rewriting the same/earlier alarm
scheduled = null; // runtime consumes the alarm before invoking it
await worker.alarm();
assert.equal(seeds, 1);
assert.equal(stateWrites, 0);
assert.ok(data.get('books:seed:next-at') >= Date.now() + 59 * 60 * 1000);
scheduled = null; // another game alarm during the cooldown
await worker.alarm();
assert.equal(seeds, 1);
assert.equal(stateWrites, 0);
change = true;
scheduled = null;
await worker.alarm();
assert.equal(seeds, 1);
assert.equal(stateWrites, 1); // changed game state still persists
// Cooldown is durable across DO restarts.
const restarted: any = new BotState({ storage: db }, {} as any);
restarted.bot = fakeBot;
scheduled = null;
await restarted.alarm();
assert.equal(seeds, 1);
console.log('Storage quota safeguards passed.');
