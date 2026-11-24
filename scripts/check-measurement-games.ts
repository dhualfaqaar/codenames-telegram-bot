import assert from 'node:assert/strict';
import { TelegramBotManager } from '../server/telegramBot';
import { MEASUREMENT_GAMES, MEASUREMENT_META, MEASUREMENT_GRID_SIZE, renderMeasurementBoard, renderMeasurementResult } from '../src/services/measurementGames';
import { randomMeasurementComment } from '../src/services/measurementComments';

const bot: any = new TelegramBotManager('TEST:TOKEN');
bot.getBotUsername = async () => 'testbot';
let result: any;
let edits: any[] = [];
let answers: any[] = [];
let failEdit = false;
bot.answerInlineQuery = async (_id: string, cards: any[]) => { result = cards; return { ok: true }; };
bot.answerCallbackQuery = async (_id: string, text: string, alert: boolean) => { answers.push({ text, alert }); return { ok: true }; };
bot.editInlineMessageText = async (id: string, text: string, keyboard: any[][], parseMode: string) => {
  edits.push({ id, text, keyboard, parseMode });
  return { ok: !failEdit };
};
bot.editMessageText = async (id: string, message: number, text: string, keyboard: any[][], parseMode: string) => {
  edits.push({ id, message, text, keyboard, parseMode });
  return { ok: !failEdit };
};
const cb = (id: number, data: string, inline = 'inline-A') => ({
  id: `query-${id}`, from: { id, first_name: id === 222 ? 'ضيف' : `Player${id}`, last_name: id === 222 ? 'ثاني' : undefined }, inline_message_id: inline, data
});
const press = async (id: number, data: string, inline = 'inline-A') => {
  await bot.handleMeasurementCallback(cb(id, data, inline), data);
};

const categories = await bot.buildGamesMenu('duo');
assert(categories.keyboard.flat().some((item: any) => item.callback_data === 'hub:measure'));
const menu = await bot.buildGamesMenu('measure');
assert.equal(menu.text, '*ألعاب القياس*');
assert.equal(Object.keys(MEASUREMENT_GAMES).length, 18);
assert.equal(MEASUREMENT_GRID_SIZE, 36);
// Exercise every kind, band, boundary, and random choice without relying on chance.
for (const kind of Object.keys(MEASUREMENT_GAMES) as Array<keyof typeof MEASUREMENT_GAMES>) {
  for (const [low, high] of [[0, 19], [20, 39], [40, 59], [60, 79], [80, 100]]) {
    const choices = Array.from({ length: 6 }, (_, i) => randomMeasurementComment(kind, low, () => (i + 0.5) / 6));
    assert.equal(new Set(choices).size, 6, `${kind} band ${low} needs varied comments`);
    assert.deepEqual(choices, Array.from({ length: 6 }, (_, i) => randomMeasurementComment(kind, high, () => (i + 0.5) / 6)));
    assert(choices.every(text => text.length > 0 && text.length <= 100 && !/[<>\n]/.test(text)));
    assert(choices.every(text => !/النسبة (قليلة|عالية)|هالمرة النسبة|تريد|فيها/u.test(text)));
    assert(choices.filter(text => /\p{Extended_Pictographic}/u.test(text)).length <= 1, 'emoji should be used sparingly');
  }
}
assert.throws(() => randomMeasurementComment('luck', -1), RangeError);
assert.throws(() => randomMeasurementComment('luck', 101), RangeError);
for (const [kind, label] of Object.entries(MEASUREMENT_GAMES)) {
  assert(menu.keyboard.flat().some((item: any) => item.callback_data === `hub:measure:${kind}` && item.text === label));
  const page = await bot.buildGamesMenu(`measure:${kind}`);
  assert.equal(page.text, `*${label}*`);
  assert.equal(page.keyboard[0][0].switch_inline_query_chosen_chat.query, `measure ${kind}`);
  await bot.handleInlineQuery({ id: 'iq', query: `measure ${kind}`, from: { id: 111, first_name: 'ناشر', last_name: 'الأول' } });
  assert.equal(result[0].title, label);
  assert.equal(result[0].description, undefined);
  assert.equal(result[0].input_message_content.message_text, `*${label}*`);
  assert.equal(result[0].reply_markup.inline_keyboard[0][0].callback_data, `measure:accept:${kind}:111`);
  assert.equal(result[0].reply_markup.inline_keyboard[0][1].callback_data, `measure:reject:${kind}:111`);
  const message = `case-${kind}`;
  await press(222, `measure:accept:${kind}:111`, message);
  const game = bot.measurementGames.get(`inline:${message}`);
  assert.equal(game.hostName, 'ناشر الأول');
  assert.equal(game.guestName, 'ضيف ثاني');
  assert.equal(edits.at(-1).text, renderMeasurementBoard(game));
  assert.equal(edits.at(-1).parseMode, 'HTML');
  assert(edits.at(-1).text.includes(`يتم قياس ${MEASUREMENT_META[kind as keyof typeof MEASUREMENT_META].label}`));
  assert(edits.at(-1).text.includes('من: <b>ناشر الأول</b>'));
  assert(edits.at(-1).text.includes('إلى: <b>ضيف ثاني</b>'));
  assert(edits.at(-1).text.includes('اختار أي مربع'));
  assert(!edits.at(-1).text.includes('%'), 'the board must not reveal the result');
  assert.equal(game.result, undefined, 'nothing is measured before the guest picks');
  assert.equal(edits.at(-1).keyboard.length, 6);
  assert.equal(edits.at(-1).keyboard.flat().length, 36);
  assert(edits.at(-1).keyboard.flat().every((b: any) => b.text === MEASUREMENT_META[kind as keyof typeof MEASUREMENT_META].emoji));
  await press(222, 'measure:pick:35', message);
  assert.equal(game.status, 'finished');
  const mode = MEASUREMENT_META[kind as keyof typeof MEASUREMENT_META].mode;
  assert.equal(game.result.length, mode === 'shared' ? 1 : 2);
  assert(game.result.every((x: number) => Number.isInteger(x) && x >= 0 && x <= 100));
  assert.equal(game.comments.length, game.result.length);
  for (const [index, value] of game.result.entries()) {
    const allowed = Array.from({ length: 6 }, (_, i) => randomMeasurementComment(kind as keyof typeof MEASUREMENT_GAMES, value, () => (i + 0.5) / 6));
    assert(allowed.includes(game.comments[index]), `${kind} comment must match its own percentage`);
  }
  assert.equal(edits.at(-1).parseMode, 'HTML');
  assert.deepEqual(edits.at(-1).keyboard, []);
  const text = edits.at(-1).text as string;
  assert(text.includes('<b>ناشر الأول</b>'));
  assert(text.includes('<b>ضيف ثاني</b>'));
  assert.equal((text.match(/%/g) || []).length, mode === 'shared' ? 1 : 2);
  for (const [index, value] of game.result.entries()) assert(text.includes(`<b>${value}%</b>\n${game.comments[index]}`));
  if (mode === 'shared') assert(text.includes('</b> و <b>'));
  else assert(text.includes('\n\n'), 'personal results must be separated by a blank line');
}
// Any one of the 36 cells is selectable by the player who accepted.
for (let i = 0; i < MEASUREMENT_GRID_SIZE; i++) {
  const id = `cell-${i}`;
  await press(222, 'measure:accept:luck:111', id);
  await press(222, `measure:pick:${i}`, id);
  assert.equal(bot.measurementGames.get(`inline:${id}`).status, 'finished');
}
// Individual results select their comment using each player's own result.
await press(222, 'measure:accept:loyalty:111', 'independent');
const originalRandom = Math.random;
const draws = [0, 0.999999, 0, 0.999999];
try {
  Math.random = () => draws.shift() ?? 0;
  await press(222, 'measure:pick:12', 'independent');
} finally {
  Math.random = originalRandom;
}
const separate = bot.measurementGames.get('inline:independent');
assert.deepEqual(separate.result, [0, 100]);
assert.equal(separate.comments[0], randomMeasurementComment('loyalty', 0, () => 0));
assert.equal(separate.comments[1], randomMeasurementComment('loyalty', 100, () => 0.999999));
assert(edits.at(-1).text.includes(`<b>0%</b>\n${separate.comments[0]}`));
assert(edits.at(-1).text.includes(`<b>100%</b>\n${separate.comments[1]}`));
assert.equal(MEASUREMENT_META.kiss.mode, 'shared');
assert.equal(MEASUREMENT_META.love.mode, 'shared');
assert.equal(MEASUREMENT_META.understanding.mode, 'shared');
for (const key of ['loyalty', 'intelligence', 'average', 'arabic', 'english', 'biology', 'chemistry', 'physics', 'islamic', 'maths'] as const) {
  assert.equal(MEASUREMENT_META[key].mode, 'individual');
}
await press(111, 'measure:accept:love:111');
assert(!bot.measurementGames.has('inline:inline-A'), 'the host cannot accept their own invitation');
await press(222, 'measure:accept:love:111');
const active = bot.measurementGames.get('inline:inline-A');
assert.equal(active.guestId, '222');
await press(333, 'measure:accept:love:111');
assert.equal(active.guestId, '222');
const before = edits.length;
await press(333, 'measure:pick:0');
await press(222, 'measure:pick:36');
assert.equal(edits.length, before, 'outsiders and invalid indices cannot reveal a result');
failEdit = true;
await press(222, 'measure:pick:0');
assert.equal(active.status, 'playing');
assert.equal(active.result, undefined, 'failed edit restores ability to retry');
assert.equal(active.comments, undefined, 'failed edit discards comments too');
failEdit = false;
await press(222, 'measure:pick:0');
assert.equal(active.status, 'finished');
const value = active.result[0];
const count = edits.length;
await press(222, 'measure:pick:1');
assert.equal(edits.length, count, 'a stale second tap must not replace a result');
assert.equal(active.result[0], value);
await press(222, 'measure:reject:love:111', 'inline-B');
assert.equal(bot.measurementGames.get('inline:inline-B').status, 'rejected');
await press(333, 'measure:accept:love:111', 'inline-B');
assert.equal(bot.measurementGames.get('inline:inline-B').status, 'rejected');
failEdit = true;
await press(222, 'measure:accept:luck:111', 'inline-C');
assert(!bot.measurementGames.has('inline:inline-C'), 'failed invite edit allows retry');
failEdit = false;
await press(222, 'measure:accept:luck:111', 'inline-C');
assert.equal(bot.measurementGames.get('inline:inline-C').status, 'playing');
const restored: any = new TelegramBotManager('TEST:TOKEN');
restored.importState(bot.exportState());
assert.equal(restored.measurementGames.get('inline:inline-A').result[0], value);
assert.deepEqual(restored.measurementGames.get('inline:inline-A').comments, active.comments);
assert.equal(renderMeasurementResult(restored.measurementGames.get('inline:inline-A')), renderMeasurementResult(active));
assert.equal(restored.measurementGames.get('inline:inline-A').status, 'finished');
assert.equal(restored.measurementGames.get('inline:inline-B').status, 'rejected');
assert(answers.some(x => x.text.includes('لازم لاعب ثاني')));
const messageCb = { id: 'chat', from: { id: 222, first_name: 'ضيف', last_name: 'ثاني' }, message: { chat: { id: -100123, type: 'channel' }, message_id: 55 } };
await bot.handleMeasurementCallback(messageCb, 'measure:accept:trust:111');
assert.equal(bot.measurementGames.get('chat:-100123:55').status, 'playing');
assert.equal(edits.at(-1).message, 55);
await bot.handleMeasurementCallback(messageCb, 'measure:pick:2');
assert.equal(edits.at(-1).message, 55);
assert.equal(edits.at(-1).parseMode, 'HTML');
// A game already accepted before this release has 16 cells and no stored names.
bot.measurementGames.set('inline:old', { kind: 'maths', hostId: '111', guestId: '222', status: 'playing', cells: Array(16).fill(null), updatedAt: Date.now() });
await press(222, 'measure:pick:15', 'old');
assert.equal(bot.measurementGames.get('inline:old').status, 'finished');
assert(edits.at(-1).text.includes('ناشر الأول') && edits.at(-1).text.includes('ضيف ثاني'));
const dangerousGame = { kind: 'loyalty' as const, hostId: '1', guestId: '2', hostName: '<b>&Ali</b>', guestName: 'Name\nGuest', status: 'finished' as const, cells: [], result: [24, 62], updatedAt: 1 };
const dangerousBoard = renderMeasurementBoard(dangerousGame);
assert(dangerousBoard.includes('&lt;b&gt;&amp;Ali&lt;/b&gt;'));
assert(dangerousBoard.includes('Name Guest'));
assert(!dangerousBoard.includes('<b>&Ali</b>'));
const dangerous = renderMeasurementResult(dangerousGame);
assert(dangerous.includes('&lt;b&gt;&amp;Ali&lt;/b&gt;'));
assert(dangerous.includes('Name Guest'));
assert(dangerous.includes('24%') && dangerous.includes('62%'));
const escapedComment = renderMeasurementResult({ kind: 'luck', hostId: '1', guestId: '2', status: 'finished', cells: [], result: [1, 99], comments: ['<bad>&', 'safe'], updatedAt: 1 });
assert(escapedComment.includes('&lt;bad&gt;&amp;'));
assert(escapedComment.includes('<b>99%</b>\nsafe'));
assert(!dangerous.includes('undefined'), 'older saved games without comments remain renderable');
// Two near-simultaneous presses cannot overwrite the selected result.
await press(222, 'measure:accept:friendship:111', 'race');
let releaseEdit!: () => void;
let editStarted!: () => void;
const editStartedPromise = new Promise<void>(resolve => { editStarted = resolve; });
const releasePromise = new Promise<void>(resolve => { releaseEdit = resolve; });
const oldEdit = bot.editInlineMessageText;
bot.editInlineMessageText = async (...args: any[]) => {
  if (args[0] === 'race') { editStarted(); await releasePromise; }
  return oldEdit(...args);
};
const first = press(111, 'measure:pick:0', 'race');
await editStartedPromise;
const raceGame = bot.measurementGames.get('inline:race');
const chosen = raceGame.result[0];
await press(222, 'measure:pick:1', 'race');
assert.equal(raceGame.result[0], chosen);
releaseEdit();
await first;
bot.editInlineMessageText = oldEdit;
console.log('Measurement games: all categories, 36 themed cells, shared and individual results, names, rejection, old games and persistence passed (Telegram mocked).');
