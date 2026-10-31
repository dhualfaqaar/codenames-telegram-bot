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
worker.stateStore = { save: async (state: any) => db.put('state', state) };
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
restarted.stateStore = { save: async (state: any) => db.put('state', state) };
scheduled = null;
await restarted.alarm();
assert.equal(seeds, 1);
console.log('Storage quota safeguards passed.');

// Ordinary channel posts are discarded before commands or bookkeeping.
// The worker can avoid writing the giant bot state for these, but must still
// persist ordinary updates and retry any failed prior write.
const { TelegramBotManager } = await import('../server/telegramBot');
const actualBot = new TelegramBotManager('TEST:TOKEN', '42', true);
const ignored = { update_id: 100, channel_post: { message_id: 1, date: 1, chat: { id: -1, type: 'channel' }, text: 'منشور عادي' } } as any;
const beforeIgnored = JSON.stringify(actualBot.exportState());
assert.equal(await actualBot.handleUpdate(ignored), false);
assert.equal(JSON.stringify(actualBot.exportState()), beforeIgnored);

let persisted = { value: 0 };
let writeAttempts = 0;
let failNext = false;
let changedValue = 0;
let footballActive = false;
let footballCalls = 0;
const storage2: any = {
  get: async () => undefined,
  put: async (key: string, snapshot: any) => {
    if (key !== 'state') return;
    writeAttempts++;
    if (failNext) { failNext = false; throw new Error('simulated write failure'); }
    persisted = structuredClone(snapshot);
  },
  getAlarm: async () => null,
  setAlarm: async () => {},
  deleteAlarm: async () => {}
};
const bot2 = {
  handleUpdate: async (update: any) => {
    if (update.ignored) return false;
    changedValue = update.value;
  },
  exportState: () => ({ value: changedValue }),
  getNextQuizDeadline: () => null,
  bookCatalogNeedsMore: () => false,
  hasActiveFootballAlerts: () => footballActive,
  processFootballAlerts: async () => { footballCalls++; changedValue++; }
};
const worker2: any = new BotState({ storage: storage2 }, {} as any);
worker2.bot = bot2;
worker2.stateStore = { save: async (state: any) => storage2.put('state', state) };
const update = (payload: any) => worker2.fetch(new Request('https://bot.internal/update', { method: 'POST', body: JSON.stringify(payload) }));
const cron = () => worker2.fetch(new Request('https://bot.internal/football-alerts', { method: 'POST' }));
for (let i = 0; i < 500; i++) await update({ update_id: i + 1, ignored: true });
for (let i = 0; i < 500; i++) assert.equal((await cron()).status, 200);
assert.equal(writeAttempts, 0);
assert.equal(footballCalls, 0);
await update({ update_id: 1001, value: 1 });
assert.deepEqual(persisted, { value: 1 });
assert.equal(writeAttempts, 1);
// An ignored update must not conceal an earlier failed save.
failNext = true;
const oldError = console.error;
console.error = () => {};
try { await update({ update_id: 1002, value: 2 }); } finally { console.error = oldError; }
assert.deepEqual(persisted, { value: 1 });
await update({ update_id: 1003, ignored: true });
assert.deepEqual(persisted, { value: 2 });
assert.equal(writeAttempts, 3);
footballActive = true;
await cron();
assert.equal(footballCalls, 1);
assert.deepEqual(persisted, { value: 3 });
console.log('Idle traffic and failed-write retry checks passed.');

// In-flight writes must be serialized: a slower old write cannot overwrite a
// newer state. Changes made while a write is blocked are saved by the next one.
let releaseFirst!: () => void;
let enteredFirst!: () => void;
const entered = new Promise<void>(resolve => { enteredFirst = resolve; });
const waitFirst = new Promise<void>(resolve => { releaseFirst = resolve; });
const snapshots: number[] = [];
let concurrentValue = 1;
const concurrentStorage: any = { put: async (_: string, snapshot: any) => {
  const value = snapshot.value;
  if (!snapshots.length) { enteredFirst(); await waitFirst; }
  snapshots.push(value);
} };
const concurrentWorker: any = new BotState({ storage: concurrentStorage }, {} as any);
concurrentWorker.stateStore = { save: async (state: any) => concurrentStorage.put('state', state) };
const concurrentBot: any = { exportState: () => ({ value: concurrentValue }) };
const firstWrite = concurrentWorker.saveBotState(concurrentBot);
await entered;
concurrentValue = 2;
const secondWrite = concurrentWorker.saveBotState(concurrentBot);
releaseFirst();
await Promise.all([firstWrite, secondWrite]);
assert.deepEqual(snapshots, [1, 2]);

// Whisper triggers and bot-origin posts must not be treated as ignorable.
const routedBot: any = new TelegramBotManager('TEST:TOKEN', '42', true);
let routed = 0;
routedBot.ensureCommandsSynced = async () => {};
routedBot.handleMessage = async () => { routed++; };
await routedBot.handleUpdate({ ...ignored, update_id: 101, channel_post: { ...ignored.channel_post, text: 'همسة' } });
await routedBot.handleUpdate({ ...ignored, update_id: 102, channel_post: { ...ignored.channel_post, via_bot: { id: 1, is_bot: true, first_name: 'bot' } } });
assert.equal(routed, 2);
console.log('Concurrent writes and channel trigger checks passed.');
