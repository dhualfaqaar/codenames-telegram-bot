import assert from 'node:assert/strict';
import vm from 'node:vm';
import { Chess } from 'chess.js';
import { interactiveGamesMiniAppHtml } from '../src/services/interactiveGamesMiniApp';
const html = interactiveGamesMiniAppHtml('chess');
const script = Array.from(html.matchAll(/<script>\s*([\s\S]*?)<\/script>/g)).map(match => match[1]).find(value => value.includes('var chessReview='));
assert.ok(script);
new vm.Script(script); // validate the emitted browser JavaScript, not just the TS template
const snippet = script.slice(script.indexOf('var chessReview='), script.indexOf('function renderChess('));
let failed = false;
const commands: string[] = [];
class FakeWorker {
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  postMessage(command: string) {
    commands.push(command);
    queueMicrotask(() => {
      if (this.terminated) return;
      if (command === 'uci') this.onmessage?.({ data: 'uciok' });
      else if (command === 'isready') this.onmessage?.({ data: 'readyok' });
      else if (command.startsWith('go ')) {
        if (failed) { this.onerror?.(); return; }
        this.onmessage?.({ data: `info depth 10 score cp ${command.includes('searchmoves') ? -250 : 100} nodes 100` });
        this.onmessage?.({ data: 'bestmove e2e4' });
      }
    });
  }
  terminate() { this.terminated = true; }
}
const chess = new Chess();
const fen = chess.fen(); chess.move('e4');
const sandbox: any = { Worker: FakeWorker, setTimeout, clearTimeout, Math, Error, Promise, console,
  roomData: { room: { id: 'A', status: 'finished', players: [] }, state: { moves: [{ fen, uci: 'e2e4', side: 'w' }] } },
  renderGame() {}, digit: String, safe: String, goHome() {}, openChessHome() {}, openChessPlayMenu() {}, createRoom() {} };
vm.createContext(sandbox); vm.runInContext(snippet, sandbox);
await sandbox.analyzeChessGame();
assert.equal(sandbox.chessReview.status, 'ready');
assert.equal(sandbox.chessReview.stats.w.blunder, 1);
assert.equal(sandbox.chessReview.stats.w.count, 1);
assert.ok(sandbox.chessReview.stats.w.accuracy < 100);
assert.ok(commands.some(c => c === 'go depth 10 searchmoves e2e4'));
assert.ok(sandbox.chessReviewMarkup(sandbox.roomData.room, sandbox.roomData.state).includes('الدقة التقديرية'));
failed = true; await sandbox.analyzeChessGame();
assert.equal(sandbox.chessReview.status, 'unavailable');
assert.equal(sandbox.chessReview.stats, null);
assert.ok(sandbox.chessReviewMarkup(sandbox.roomData.room, sandbox.roomData.state).includes('تعذّر'));
assert.ok(sandbox.chessReviewMarkup(sandbox.roomData.room, {}).includes('سجل النقلات'));
assert.ok(sandbox.chessReviewMarkup(sandbox.roomData.room, {moves: []}).includes('ماكو نقلات'));
assert.ok(sandbox.chessReviewMarkup(sandbox.roomData.room, {moves: Array(201).fill({})}).includes('200 نقلة'));
const actions: string[] = [];
sandbox.goHome = () => actions.push('home');
sandbox.createRoom = (_game: string, options: any) => { actions.push(`bot:${options.trainerId}:${options.clockMinutes}`); };
sandbox.openChessHome = () => actions.push('chess-home');
sandbox.openChessPlayMenu = () => actions.push('choose');
sandbox.roomData.state = { mode: 'bot', botTrainerId: 'salem', botElo: 200, clockMinutes: 5 };
sandbox.replayChess();
assert.deepEqual(actions.splice(0), ['home', 'bot:salem:5']);
sandbox.roomData.state = { mode: 'friend' };
sandbox.replayChess();
assert.deepEqual(actions.splice(0), ['home', 'chess-home', 'choose'], 'human replay must not imply opponent consent');
console.log('Chess review: emitted JS, UCI scoring, forced move, replay, failure and missing history passed.');
