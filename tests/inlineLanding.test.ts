import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TelegramBotManager } from '../server/telegramBot';
import * as GG from '../src/services/groupGamesEngine';
import { CodenamesEngine } from '../src/services/codenamesEngine';
import * as RPS from '../src/services/rpsEngine';

function botHarness() {
  const bot = new TelegramBotManager(undefined, undefined, false) as any;
  bot.botInfo = { id: 888, username: 'game_bot' };
  bot.withBotFooter = async (text: string) => text;
  bot.buildKeyboard = async (game: any) => CodenamesEngine.getTelegramInlineKeyboard(game);
  const cards: any[] = [];
  const edits: any[] = [];
  bot.answerInlineQuery = async (_id: string, results: any[]) => { cards.push(...results); };
  bot.editMessageText = async (_chat: string, _id: number, text: string, keyboard: any[][]) => {
    edits.push({ text, keyboard });
    return { ok: true };
  };
  return { bot, cards, edits };
}

// Telegram sends channel_post with Markdown markup stripped from the sent article.
function landingText(markdown: string) {
  return markdown.replace(/\\([()!_])/g, '$1').replace(/[*_]/g, '');
}

async function publish(bot: any, text: string) {
  await bot.handleInlineLanding({
    text: landingText(text), message_id: 12,
    chat: { id: -100123456789, type: 'channel', title: 'test' },
    via_bot: { id: 888, username: 'game_bot' }
  });
}

test('all inline cards show real lobbies with no temporary code or preparing screen', async () => {
  const { bot, cards, edits } = botHarness();
  for (const q of ['gq trivia', 'gq speed', 'gq mm', 'rps 15', 'cn']) {
    cards.length = 0;
    edits.length = 0;
    await bot.handleInlineQuery({ id: 'inline', query: q });
    assert.equal(cards.length, 1, q);
    const initial = cards[0].input_message_content.message_text as string;
    assert.doesNotMatch(initial, /تحضير|`gq:|لحظة والبوت|جاري/, q);
    assert.match(initial, /اللاعبين|المنضمون/, q);
    await publish(bot, initial);
    assert.equal(edits.length, 1, `landing ${q} should add the live board`);
    assert.ok(edits[0].keyboard.length, q);
    assert.doesNotMatch(edits[0].text, /تحضير|`gq:/, q);
    if (q === 'rps 15') assert.match(edits[0].text, /الجولات: \*15\*/);
    if (q === 'gq trivia' || q === 'gq speed') {
      assert.equal(edits[0].keyboard.length, 2); // join + start
    }
  }
});

test('old cards with a gq marker still land; unrelated via_bot messages are ignored', async () => {
  const { bot, edits } = botHarness();
  await publish(bot, '🧠 معركة المعلومات — تحضير البطولة…\n`gq:trivia`');
  assert.equal(edits.length, 1);
  await bot.handleInlineLanding({
    text: landingText(GG.renderQuiz(GG.createQuiz('inline', 'test', 'trivia'))),
    message_id: 22,
    chat: { id: -100123456789, type: 'channel' },
    via_bot: { id: 999, username: 'other_bot' }
  });
  assert.equal(edits.length, 1);
});

test('quiz rounds show exactly four answer buttons for 10 seconds without waiting or skip text', () => {
  for (const kind of Object.keys(GG.QUIZ_KINDS) as GG.QuizKind[]) {
    const game = GG.createQuiz('-100123456789', 'test', kind);
    GG.quizJoin(game, '1', 'A');
    GG.quizJoin(game, '2', 'B');
    GG.quizStart(game);
    const buttons = GG.quizKeyboard(game).flat();
    assert.equal(buttons.length, 4, kind);
    assert.ok(buttons.every((b: any) => b.callback_data.startsWith('gqa:')), kind);
    const text = GG.renderQuiz(game);
    assert.doesNotMatch(text, /ننتظر|ختم الجولة|الانتقال/);
    assert.equal(text.split('\n').filter(line => line.includes('━')).length, 1, kind);
    assert.ok((game.deadline ?? 0) - Date.now() <= 10_000);
  }
});

test('game board dividers are kept to one per view', () => {
  const quiz = GG.createQuiz('123', 'test', 'trivia');
  GG.quizJoin(quiz, '1', 'A');
  GG.quizJoin(quiz, '2', 'B');
  const mm = GG.mmCreate('123', 'test');
  const rps = RPS.createGame('123', 'test', 5);
  const cn = CodenamesEngine.createLobby('123');
  const dividers = (text: string) => text.split('\n').filter(l => l.includes('━'));
  for (const render of [
    () => GG.renderQuiz(quiz), () => GG.renderMM(mm),
    () => RPS.renderGame(rps), () => CodenamesEngine.getTelegramMessageText(cn)
  ]) assert.equal(dividers(render()).length, 1);
  GG.quizStart(quiz);
  assert.equal(dividers(GG.renderQuiz(quiz)).length, 1);
  GG.quizTimeout(quiz, quiz.deadline);
  assert.equal(dividers(GG.renderQuiz(quiz)).length, 1);
});
