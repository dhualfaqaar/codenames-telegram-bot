import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { InteractiveGameRooms, MemoryRoomStorage } from '../src/services/interactiveGameRooms';
import { CHESS_RESPONSIVE_SCRIPT } from '../src/services/chessResponsiveLayout';
const { default: worker } = await (new Function('url', 'return import(url)'))(new URL('../worker/index.ts', import.meta.url).href);

const context = createContext({});
runInContext(CHESS_RESPONSIVE_SCRIPT.slice(0, CHESS_RESPONSIVE_SCRIPT.indexOf('function syncChessLayout')), context);
// A viewport grid, not a list of device names: covers tiny windows, split-screen,
// portrait/landscape tablets, laptops and TV/4K, with Telegram safe-area reserves.
let count = 0;
for (const width of [280,320,360,390,640,740,768,820,844,1024,1280,1366,1568,1920,2560,3840]) {
  for (const height of [240,360,390,640,768,844,1024,1080,1440,2160]) {
    for (const top of [0,48,100]) {
      const fit = context.calculateChessLayout(width, height, top, 20);
      assert.ok(fit.board > 0);
      assert.ok(fit.mainHeight <= fit.height + 1, `vertical fit ${width}x${height}`);
      assert.ok(fit.board + (fit.wide ? fit.chat + fit.gap : 0) + 2 * fit.padding <= width + 1, `horizontal fit ${width}x${height}`);
      count++;
    }
  }
}
assert.equal(context.calculateChessLayout(390,844,48,20).wide, false);
assert.equal(context.calculateChessLayout(1024,768,48,20).wide, true);
assert.equal(context.calculateChessLayout(1568,882,48,20).wide, true);
for (const [path, name] of [['uno','أونو'], ['gartic','لعبة الرسم'], ['poker','بوكر تكساس']]) {
  for (const suffix of ['', '/']) {
    const response = await worker.fetch(new Request(`https://games.test/${path}${suffix}`), {} as any, {} as any);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('Cache-Control')?.includes('no-store'));
    const html = await response.text();
    assert.ok(html.includes(`<title>Code Games | ${name}</title>`));
    assert.ok(html.includes('else if(standaloneGame)openGamePage(standaloneGame)'));
    assert.ok(html.includes('id="drawJoinButton"'));
  }
}
// Exercise the real drawing room flow, not just the mock-backed UI.
const rooms = new InteractiveGameRooms(new MemoryRoomStorage());
const post = async (path: string, body: object) => rooms.handle(new Request(`https://games.test/api/interactive/rooms${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
const createdResponse = await post('', { game: 'gartic', name: 'رسام', capacity: 4, roundSeconds: 45 });
assert.equal(createdResponse.status, 201);
const created = await createdResponse.json() as any;
assert.match(created.room.id, /^[A-Z0-9]{12}$/);
const joinedResponse = await post('/' + created.room.id, { action: 'join', name: 'صديق' });
assert.equal(joinedResponse.status, 200);
const joined = await joinedResponse.json() as any;
assert.equal(joined.room.players.length, 2);
const startedResponse = await post('/' + created.room.id, { action: 'start', token: created.token });
assert.equal(startedResponse.status, 200);
const started = await startedResponse.json() as any;
assert.equal(started.room.status, 'playing');
assert.ok(started.state.word, 'only the drawer receives the word');
const guestViewResponse = await rooms.handle(new Request(`https://games.test/api/interactive/rooms/${created.room.id}`, { headers: { Authorization: 'Bearer ' + joined.token } }));
const guestView = await guestViewResponse.json() as any;
assert.equal(guestView.state.word, '');
const strokeResponse = await post('/' + created.room.id, { action: 'stroke', token: created.token, color: '#ef4444', size: 5, points: [[0.1, 0.1], [0.5, 0.5]] });
assert.equal(strokeResponse.status, 200);
const guessResponse = await post('/' + created.room.id, { action: 'guess', token: joined.token, text: started.state.word });
assert.equal(guessResponse.status, 200);
const afterGuess = await guessResponse.json() as any;
assert.equal(afterGuess.state.guesses[0].seat, joined.room.playerSeat);
assert.equal(afterGuess.state.guesses[0].correct, true);
assert.notEqual(afterGuess.state.guesses[0].text, started.state.word, 'correct guesses are masked');
assert.equal(afterGuess.state.word, '');
console.log('Drawing room create, join, draw and guess checks passed.');
console.log(`Responsive sizing checks passed: ${count} viewport/inset combinations and independent game routes.`);
