import assert from 'node:assert/strict';
import { InteractiveGameRooms, type RoomStorage } from '../src/services/interactiveGameRooms';

// Clone reads and writes like Durable Object storage; live object references would
// otherwise hide missed saves and make the write count misleading.
class CountingStorage implements RoomStorage {
  data = new Map<string, unknown>(); writes = 0;
  async get<T>(key: string): Promise<T | undefined> { const value = this.data.get(key); return value === undefined ? undefined : structuredClone(value) as T; }
  async put(key: string, value: unknown): Promise<void> { this.data.set(key, structuredClone(value)); this.writes++; }
}
const storage = new CountingStorage();
const rooms = new InteractiveGameRooms(storage);
const originalNow = Date.now;
let now = 1_800_000_000_000;
Date.now = () => now;
async function post(path: string, body: unknown) {
  const res = await rooms.handle(new Request('https://test.local' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  const result = await res.json() as any; assert.ok(res.ok, JSON.stringify(result)); return result;
}
async function poll(id: string, token: string) {
  const res = await rooms.handle(new Request('https://test.local/api/interactive/rooms/' + id, { headers: { Authorization: 'Bearer ' + token } }));
  assert.equal(res.status, 200); return await res.json() as any;
}
try {
  const a = await post('/api/interactive/rooms', { game: 'chess', name: 'أول', mode: 'friend', clockMinutes: 5 });
  const b = await post('/api/interactive/rooms/' + a.room.id, { action: 'join', name: 'ثاني' });
  const before = storage.writes;
  // Both players poll every 800ms for a simulated minute.
  for (let elapsed = 0; elapsed < 60_000; elapsed += 800) {
    now += 800;
    assert.equal((await poll(a.room.id, a.token)).room.status, 'playing');
    assert.equal((await poll(a.room.id, b.token)).room.status, 'playing');
  }
  const writes = storage.writes - before;
  assert.ok(writes <= 24, `expected <=24 room writes/minute with two players, got ${writes}`);
  assert.ok(writes > 0, 'presence must still be saved durably');
  // A DO restart must read the saved heartbeats and must not forfeit an active peer.
  const restarted = new InteractiveGameRooms(storage);
  const response = await restarted.handle(new Request('https://test.local/api/interactive/rooms/' + a.room.id, { headers: { Authorization: 'Bearer ' + a.token } }));
  assert.equal((await response.json() as any).room.status, 'playing');
  now += 36_000;
  assert.equal((await poll(a.room.id, a.token)).room.status, 'finished', 'a disconnected opponent must eventually forfeit');

  // Clock expiry must be processed even when a heartbeat is written in the same poll.
  const c = await post('/api/interactive/rooms', { game: 'chess', name: 'أول', mode: 'friend', clockMinutes: 1 });
  const d = await post('/api/interactive/rooms/' + c.room.id, { action: 'join', name: 'ثاني' });
  now += 3_000; await poll(c.room.id, c.token); await poll(c.room.id, d.token);
  for (let i = 0; i < 13; i++) { now += 5_000; await poll(c.room.id, d.token); await poll(c.room.id, c.token); }
  const finished = await poll(c.room.id, c.token);
  assert.equal(finished.room.status, 'finished', 'clock expiry must win even alongside heartbeats');
  assert.match(finished.state.result, /انتهى وقت/);
  console.log(`Chess quota test: ${writes} room writes per simulated minute for two active players; restart, disconnect and clock expiry passed.`);
} finally { Date.now = originalNow; }
