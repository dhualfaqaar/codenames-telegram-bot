import { Chess } from 'chess.js';
import { CHESS_TRAINERS } from '../src/data/chessTrainers';
import { chooseChessBotMove } from '../src/services/chessBot';
import { InteractiveGameRooms, MemoryRoomStorage } from '../src/services/interactiveGameRooms';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const tacticalFen = '4r2k/8/8/8/4Q3/8/8/K7 b - - 0 1';
for (const trainer of CHESS_TRAINERS) {
  const move = chooseChessBotMove(tacticalFen, trainer.elo, trainer.style, () => 0.5);
  assert(move, `${trainer.id} did not return a move`);
  assert(new Chess(tacticalFen).moves().includes(move.san), `${trainer.id} returned an illegal move`);
  if (trainer.elo >= 800) assert(move.san === 'Rxe4', `${trainer.id} missed the hanging queen with ${move.san}`);
}

const rooms = new InteractiveGameRooms(new MemoryRoomStorage());
async function post(path: string, body: unknown): Promise<any> {
  const response = await rooms.handle(new Request(`https://test.local${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  const result = await response.json();
  assert(response.ok, `request ${path} failed: ${JSON.stringify(result)}`);
  return result;
}

for (const scenario of [
  { trainerId: 'salem', botElo: 200, expectedLoss: -20 },
  { trainerId: 'grandmaster', botElo: 2800, expectedLoss: -1 },
]) {
  const created = await post('/api/interactive/rooms', {
    game: 'chess', mode: 'bot', name: 'اختبار', elo: 200,
    trainerId: scenario.trainerId, botElo: scenario.botElo, clockMinutes: 5,
  });
  assert(created.room.players[0].elo === 200, 'player should start at 200 ELO');
  assert(created.room.players[1].elo === scenario.botElo, 'selected trainer ELO was not applied');
  const moved = await post(`/api/interactive/rooms/${created.room.id}`, {
    action: 'move', token: created.token, from: 'e2', to: 'e4',
  });
  assert(moved.state.turn === 'w' && moved.state.lastMove !== 'e4', 'bot did not make a legal reply');
  const ended = await post(`/api/interactive/rooms/${created.room.id}`, { action: 'resign', token: created.token });
  assert(ended.room.players[0].elo === 200 + scenario.expectedLoss, 'game result did not update player ELO');
}

console.log(`Chess bot checks passed: ${CHESS_TRAINERS.length} trainers, hanging-queen tactic, legal bot replies, and ELO updates.`);
