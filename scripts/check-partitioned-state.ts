import assert from 'node:assert/strict';
import { PartitionedBotState, PARTITIONED_HEAD } from '../src/services/partitionedBotState';
import { TelegramBotManager } from '../server/telegramBot';

class MemoryStorage {
  data = new Map<string, any>();
  written: string[] = [];
  failAfter = Infinity;
  async get(key: string) { return structuredClone(this.data.get(key)); }
  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const pending = new Map<string, any>();
    const result = await fn({ put: async (key: string, value: any) => {
      if (pending.size >= this.failAfter) throw new Error('injected failure');
      pending.set(key, structuredClone(value));
    } });
    for (const [key, value] of pending) { this.data.set(key, value); this.written.push(key); }
    return result;
  }
}
const db = new MemoryStorage();
const manager = new TelegramBotManager('TEST:TOKEN', '42', true);
const legacy = manager.exportState();
legacy.users = Array.from({ length: 300 }, (_, i) => [String(i + 1), {
  id: String(i + 1), name: `مستخدم ${i}`, username: undefined, firstSeen: 1, lastSeen: 2, started: true, blocked: false, actions: 3
}]);
legacy.chats = Array.from({ length: 130 }, (_, i) => [String(i), { id: String(i), type: 'group', title: `مجموعة ${i}`, lastSeen: 1 }]);
legacy.games = [['-1', { id: '-1', status: 'playing', players: [{ id: '1', name: 'لاعب' }] }]];
legacy.whispers = [['2', { nested: [1, undefined, 'نص'], flag: false }]];
db.data.set('state', structuredClone(legacy));
const state = new PartitionedBotState(db);
assert.deepEqual(await state.load(), legacy);
// Migration failure must not leave a partial manifest or alter the original.
db.failAfter = 3;
await assert.rejects(() => state.save(legacy), /injected failure/);
assert.equal(db.data.has(PARTITIONED_HEAD), false);
assert.deepEqual(db.data.get('state'), legacy);
assert.equal(db.written.length, 0);
db.failAfter = Infinity;
await state.save(legacy);
assert.deepEqual(db.data.get('state'), legacy); // retained, not used as a live backup
assert.ok(db.data.has(PARTITIONED_HEAD));
const recovered = new PartitionedBotState(db);
const restored: any = await recovered.load();
assert.deepEqual(restored, legacy);
const resumed = new TelegramBotManager('TEST:TOKEN', '42', true);
resumed.importState(restored);
assert.deepEqual(resumed.exportState(), legacy);
// No write for identical data; one page for a single user's change.
db.written.length = 0;
await recovered.save(restored);
assert.deepEqual(db.written, []);
restored.users[145][1].actions++;
await recovered.save(restored);
assert.deepEqual(db.written, ['bot-state:v2:users:1']);
assert.equal((await new PartitionedBotState(db).load() as any).users[145][1].actions, 4);
// Failure after a successful migration must keep the previous complete version.
const before = await new PartitionedBotState(db).load();
restored.users[0][1].actions++;
restored.games[0][1].status = 'finished';
db.failAfter = 1;
await assert.rejects(() => recovered.save(restored), /injected failure/);
assert.deepEqual(await new PartitionedBotState(db).load(), before);
db.failAfter = Infinity;
await recovered.save(restored);
assert.deepEqual(await new PartitionedBotState(db).load(), restored);
// A missing or corrupt page must never silently fall back to the stale legacy state.
const missing = db.data.get('bot-state:v2:users:1');
db.data.delete('bot-state:v2:users:1');
await assert.rejects(() => new PartitionedBotState(db).load(), /Invalid bot state page/);
db.data.set('bot-state:v2:users:1', missing);
// Shrinking then regrowing pages must not reuse stale data.
restored.users = restored.users.slice(0, 100);
await recovered.save(restored);
restored.users.push(...legacy.users.slice(100));
await recovered.save(restored);
assert.deepEqual((await new PartitionedBotState(db).load() as any).users, restored.users);
// Map and Set are not compared using JSON; they must be saved even if changed in-place.
restored.customWords = new Set(['one']);
await recovered.save(restored);
restored.customWords.add('two');
await recovered.save(restored);
assert.deepEqual((await new PartitionedBotState(db).load() as any).customWords, new Set(['one', 'two']));
console.log('Partition migration, restart, change isolation, rollback and corruption tests passed.');
