import { Chess } from 'chess.js';
import { CHESS_TRAINERS } from '../src/data/chessTrainers';
import { chooseChessBotMove } from '../src/services/chessBot';
import { STOCKFISH_ASSET_VERSION, stockfishSkillForElo, stockfishThinkTimeForElo } from '../src/services/chessStockfish';
import { CHESS_LESSONS, CHESS_PUZZLES } from '../src/data/chessLearning';
import { interactiveGamesMiniAppHtml } from '../src/services/interactiveGamesMiniApp';
const workerModule = await (new Function('url', 'return import(url)'))(new URL('../worker/index.ts', import.meta.url).href);
const cloudflareWorker = workerModule.default;
import { InteractiveGameRooms, MemoryRoomStorage } from '../src/services/interactiveGameRooms';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(STOCKFISH_ASSET_VERSION === '19.0.1', 'expected the current Stockfish engine assets');
assert(stockfishSkillForElo(200) === 0 && stockfishSkillForElo(2_800) === 20, 'Stockfish strength endpoints are incorrect');
assert(stockfishSkillForElo(1_600) > stockfishSkillForElo(800), 'Stockfish skill should increase with ELO');
assert(stockfishThinkTimeForElo(2_800) > stockfishThinkTimeForElo(200), 'Stockfish think time should increase with ELO');
assert(stockfishThinkTimeForElo(2_800) <= 3_000, 'Stockfish mobile thinking budget should stay bounded');
const miniAppHtml = interactiveGamesMiniAppHtml('chess');
assert(miniAppHtml.includes('id="chessPuzzleList"') && miniAppHtml.includes('id="chessDailyBoard"'), 'chess puzzle library and daily board should be rendered');
assert(miniAppHtml.includes('stockfish-19-lite-single.js'), 'Stockfish 19 worker should be loaded by the browser app');
assert(miniAppHtml.includes('chessLessons=JSON.parse') && miniAppHtml.includes('chessPuzzles=JSON.parse'), 'lesson and puzzle data should be injected into the app');
assert(!miniAppHtml.includes('__CHESS_LESSONS_URI__') && !miniAppHtml.includes('__CHESS_PUZZLES_URI__'), 'chess data injection markers must be resolved');
assert(CHESS_LESSONS.length >= 9 && CHESS_PUZZLES.length >= 10, 'interactive lesson and puzzle catalogues should not regress');
for (const item of [...CHESS_LESSONS.map(lesson => ({ id: lesson.id, ...lesson.exercise })), ...CHESS_PUZZLES]) {
  const exerciseGame = new Chess(item.fen);
  assert(exerciseGame.move({ from: item.from, to: item.to, promotion: item.promotion || 'q' }), `${item.id} has an illegal learning/puzzle move`);
}
for (const [, script] of miniAppHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new Function(script);
let stockfishAssetRequested = '';
const stockfishAssetResponse = await cloudflareWorker.fetch(new Request('https://game.test/stockfish/stockfish-19-lite-single.js'), {
  ASSETS: { fetch: async (request: Request) => { stockfishAssetRequested = new URL(request.url).pathname; return new Response('engine', { headers: { 'Content-Type': 'text/javascript' } }); } },
} as any, {} as any);
assert(stockfishAssetRequested === '/stockfish/stockfish-19-lite-single.js' && stockfishAssetResponse.status === 200, 'Worker should route Stockfish assets through ASSETS');
assert(stockfishAssetResponse.headers.get('Cache-Control')?.includes('immutable') && stockfishAssetResponse.headers.get('X-Content-Type-Options') === 'nosniff', 'Stockfish asset response headers are incorrect');

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
  assert(moved.state.turn === 'b' && moved.state.lastMove === 'e4', 'human move should hand the turn to the bot');
  const botReply = await post(`/api/interactive/rooms/${created.room.id}`, {
    action: 'bot-move', token: created.token, from: 'e7', to: 'e5',
  });
  assert(botReply.state.turn === 'w' && botReply.state.lastMove === 'e5', 'server did not accept the legal engine reply');
  const ended = await post(`/api/interactive/rooms/${created.room.id}`, { action: 'resign', token: created.token });
  assert(ended.room.players[0].elo === 200 + scenario.expectedLoss, 'game result did not update player ELO');
}

const fallbackRoom = await post('/api/interactive/rooms', { game: 'chess', mode: 'bot', name: 'اختبار الاحتياط', trainerId: 'salem', botElo: 200, clockMinutes: 5 });
const fallbackHumanMove = await post(`/api/interactive/rooms/${fallbackRoom.room.id}`, { action: 'move', token: fallbackRoom.token, from: 'e2', to: 'e4' });
const fallbackGame = new Chess(fallbackHumanMove.state.fen);
const fallbackBotMove = await post(`/api/interactive/rooms/${fallbackRoom.room.id}`, { action: 'bot-fallback', token: fallbackRoom.token });
assert(fallbackBotMove.state.turn === 'w' && fallbackGame.moves({ verbose: true }).some(move => move.from === fallbackBotMove.state.lastMoveSquares?.[0] && move.to === fallbackBotMove.state.lastMoveSquares?.[1]), 'fallback bot should still produce a legal response');

console.log(`Chess checks passed: ${CHESS_TRAINERS.length} trainers, Stockfish ASSETS route, ${CHESS_LESSONS.length} legal lesson drills, ${CHESS_PUZZLES.length} puzzles, tactical move, legal replies, and ELO updates.`);
