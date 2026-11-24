import assert from 'node:assert/strict';
import { TelegramBotManager } from '../server/telegramBot';
import { MEASUREMENT_GAMES } from '../src/services/measurementGames';

const bot: any = new TelegramBotManager('TEST:TOKEN');
bot.getBotUsername = async () => 'testbot';
let result: any;
let edits: any[] = [];
let answers: any[] = [];
let failEdit = false;
bot.answerInlineQuery = async (_id: string, cards: any[]) => { result = cards; return { ok: true }; };
bot.answerCallbackQuery = async (_id: string, text: string, alert: boolean) => { answers.push({ text, alert }); return { ok: true }; };
bot.editInlineMessageText = async (id: string, text: string, keyboard: any[][]) => {
  edits.push({ id, text, keyboard });
  return { ok: !failEdit };
};
bot.editMessageText = async (id: string, message: number, text: string, keyboard: any[][]) => {
  edits.push({ id, message, text, keyboard });
  return { ok: !failEdit };
};
const cb = (id: number, data: string, inline = 'inline-A') => ({
  id: `query-${id}`, from: { id, first_name: `Player${id}` }, inline_message_id: inline, data
});
const press = async (id: number, data: string, inline = 'inline-A') => {
  await bot.handleMeasurementCallback(cb(id, data, inline), data);
};

const categories = await bot.buildGamesMenu('duo');
assert(categories.keyboard.flat().some((item: any) => item.callback_data === 'hub:measure'));
const menu = await bot.buildGamesMenu('measure');
assert.equal(Object.keys(MEASUREMENT_GAMES).length, 18);
for (const [kind, label] of Object.entries(MEASUREMENT_GAMES)) {
  assert(menu.keyboard.flat().some((item: any) => item.callback_data === `hub:measure:${kind}` && item.text === label));
  const page = await bot.buildGamesMenu(`measure:${kind}`);
  assert.equal(page.keyboard[0][0].switch_inline_query_chosen_chat.query, `measure ${kind}`);
  await bot.handleInlineQuery({ id: 'iq', query: `measure ${kind}`, from: { id: 111, first_name: 'Host' } });
  assert.equal(result[0].title, label);
  assert.equal(result[0].reply_markup.inline_keyboard[0][0].callback_data, `measure:accept:${kind}:111`);
  assert.equal(result[0].reply_markup.inline_keyboard[0][1].callback_data, `measure:reject:${kind}:111`);
}
await press(111, 'measure:accept:love:111');
assert.equal(bot.measurementGames.size, 0, 'the host cannot accept their own invitation');
await press(222, 'measure:accept:love:111');
assert.equal(bot.measurementGames.get('inline:inline-A').guestId, '222');
assert.equal(edits.at(-1).keyboard.length, 4);
assert.equal(edits.at(-1).keyboard.flat().length, 16);
await press(333, 'measure:accept:love:111');
assert.equal(bot.measurementGames.get('inline:inline-A').guestId, '222');
await press(333, 'measure:pick:0');
assert.equal(bot.measurementGames.get('inline:inline-A').cells[0], null);
await press(111, 'measure:pick:0');
const value = bot.measurementGames.get('inline:inline-A').cells[0];
assert(Number.isInteger(value) && value >= 0 && value <= 100);
assert.equal(edits.at(-1).keyboard[0][0].text, `${value}%`);
await press(222, 'measure:pick:0');
assert.equal(bot.measurementGames.get('inline:inline-A').cells[0], value, 'repeat tap does not change result');
await press(222, 'measure:pick:15');
assert.notEqual(bot.measurementGames.get('inline:inline-A').cells[15], null);
await press(222, 'measure:reject:love:111', 'inline-B');
assert.equal(bot.measurementGames.get('inline:inline-B').status, 'rejected');
await press(333, 'measure:accept:love:111', 'inline-B');
assert.equal(bot.measurementGames.get('inline:inline-B').status, 'rejected');
failEdit = true;
await press(222, 'measure:accept:luck:111', 'inline-C');
assert(!bot.measurementGames.has('inline:inline-C'), 'failed edits allow retry');
failEdit = false;
await press(222, 'measure:accept:luck:111', 'inline-C');
assert.equal(bot.measurementGames.get('inline:inline-C').status, 'playing');
const restored: any = new TelegramBotManager('TEST:TOKEN');
restored.importState(bot.exportState());
assert.equal(restored.measurementGames.get('inline:inline-A').cells[0], value);
assert.equal(restored.measurementGames.get('inline:inline-B').status, 'rejected');
assert(answers.some(x => x.text.includes('لازم لاعب ثاني')));
const messageCb = { id: 'chat', from: { id: 222, first_name: 'Guest' }, message: { chat: { id: -100123, type: 'channel' }, message_id: 55 } };
await bot.handleMeasurementCallback(messageCb, 'measure:accept:trust:111');
assert.equal(bot.measurementGames.get('chat:-100123:55').status, 'playing');
assert.equal(edits.at(-1).message, 55);
console.log('Measurement games: menus, inline invitations, two-player access, grid, rejection and persistence passed (Telegram mocked).');
