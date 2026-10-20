import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as GG from '../src/services/groupGamesEngine';
import { TelegramBotManager } from '../server/telegramBot';

const chat = '-10012345678';
function started(kind: GG.QuizKind = 'trivia') {
  const game = GG.createQuiz(chat, 'test', kind);
  GG.quizJoin(game, '1', 'A');
  GG.quizJoin(game, '2', 'B');
  assert.equal(GG.quizStart(game).ok, true);
  return game;
}

test('10-second window forfeits unanswered players, ignores late answers and advances', () => {
  const game = started();
  assert.ok((game.deadline ?? 0) - Date.now() <= GG.QUIZ_ROUND_MS);
  assert.equal(GG.quizKeyboard(game).length, 2); // only the four answers, no skip
  GG.quizAnswer(game, '1', 'A', game.correctIdx);
  const deadline = game.deadline!;
  assert.equal(GG.quizTimeout(game, deadline - 1), false);
  assert.equal(game.status, 'playing');
  game.deadline = Date.now() - 1;
  assert.equal(GG.quizAnswer(game, '2', 'B', game.correctIdx).ok, false);
  game.deadline = deadline;
  assert.equal(GG.quizTimeout(game, deadline), true);
  assert.equal(GG.quizKeyboard(game).length, 0); // no manual next button
  assert.match(GG.renderQuiz(game), /⏰/);
  assert.equal(game.players[1].score, 0);
  assert.equal(GG.quizAnswer(game, '2', 'B', game.correctIdx).ok, false);
  assert.equal(GG.quizTimeout(game), false);
  assert.equal(GG.quizAdvance(game).over, false);
  assert.equal(game.round, 2);
  assert.equal(game.status, 'playing');
  assert.equal(game.players[1].done, false);
});

test('all answers end early and give each correct answer a point', () => {
  const game = started('country');
  const firstDeadline = game.deadline!;
  GG.quizAnswer(game, '1', 'A', game.correctIdx);
  const last = GG.quizAnswer(game, '2', 'B', game.correctIdx);
  assert.equal(last.roundClosed, true);
  assert.equal(game.status, 'result');
  assert.ok(game.deadline! < firstDeadline);
  assert.deepEqual(game.players.map(p => p.score), [1, 1]);
  GG.quizAdvance(game);
  assert.equal(game.round, 2);
});

test('speed rounds close if everyone guessed wrong rather than hanging', () => {
  const game = started('speed');
  const wrong = (game.correctIdx + 1) % 4;
  assert.equal(GG.quizAnswer(game, '1', 'A', wrong).roundClosed, false);
  assert.equal(GG.quizAnswer(game, '2', 'B', wrong).roundClosed, true);
  assert.equal(game.status, 'result');
  assert.deepEqual(game.players.map(p => p.score), [0, 0]);
});

test('bot deadline processing advances even with no more Telegram callbacks; old buttons cannot skip or answer another round', async () => {
  const game = started();
  const bot = new TelegramBotManager(undefined, undefined, false) as any;
  bot.importState({ gqGames: [[chat, game]] });
  const screens: string[] = [];
  const replies: string[] = [];
  bot.paintQuiz = async (g: GG.QuizGame) => { screens.push(g.status); };
  bot.answerCallbackQuery = async (_id: string, msg: string) => { replies.push(msg); };
  const press = (data: string) => bot.handleGroupQuizCb({
    id: 'q', from: { id: 1, first_name: 'A' }, inline_message_id: 'inline', data
  }, data);
  await press(`gqskip:trivia:${chat}`);
  assert.equal(game.status, 'playing');
  game.deadline = Date.now() - 1;
  await bot.processQuizDeadlines();
  assert.equal(game.status, 'result');
  assert.deepEqual(screens, ['result']);
  assert.equal(bot.nextQuizDeadline(), game.deadline);
  game.deadline = Date.now() - 1;
  await bot.processQuizDeadlines();
  assert.equal(game.round, 2);
  assert.equal(game.status, 'playing');
  assert.deepEqual(screens, ['result', 'playing']);
  await press(`gqa:${game.correctIdx}:1:trivia:${chat}`);
  assert.equal(game.players[0].score, 0);
  assert.match(replies.at(-1)!, /قديم/);
});

test('Durable Object persists the deadline alarm and moves rounds without an update', async () => {
  const { BotState } = await import('../worker/index');
  const game = started();
  let alarmAt: number | undefined;
  let saved: any = { gqGames: [[chat, game]] };
  const storage = {
    get: async () => saved,
    put: async (_key: string, value: any) => { saved = value; },
    setAlarm: async (when: number) => { alarmAt = when; },
    deleteAlarm: async () => { alarmAt = undefined; }
  };
  const object = new BotState({ storage }, { TELEGRAM_BOT_TOKEN: '' } as any);
  await object.fetch(new Request('https://bot.internal/update', {
    method: 'POST', body: JSON.stringify({ update_id: 1 })
  }));
  assert.equal(alarmAt, game.deadline);
  game.deadline = Date.now() - 1;
  await object.alarm();
  assert.equal(saved.gqGames[0][1].status, 'result');
  assert.equal(alarmAt, game.deadline);
  game.deadline = Date.now() - 1;
  await object.alarm();
  assert.equal(saved.gqGames[0][1].round, 2);
  assert.equal(alarmAt, game.deadline);
});
