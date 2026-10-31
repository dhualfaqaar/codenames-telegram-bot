// فحص سلوكي: نشغّل البوت بتوكن وهمي ونعترض طلبات تيليجرام، حتى نثبت إن
// 1) لعبة الأسئلة/ماسترمايند/حجرة ورقة مقص ما يبدأها إلا ناشرها،
// 2) «ابدأ» ما تضيف الضاغط تلقائياً (هذا كان يخلي اللعبة تبدأ من لاعب واحد غريب)،
// 3) اللوحة الفاضية تتجمّد بعد جولتين بلا أي جواب بدل ما تخلص بصمت،
// 4) «لعبة جديدة» تحذف الرسالة المنتهية وترسل اللعبة الجديدة برسالة جديدة.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TelegramBotManager } from '../server/telegramBot';
import * as GG from '../src/services/groupGamesEngine';

let passed = 0;
const check = (name: string, condition: unknown) => {
  if (!condition) throw new Error(`فشل: ${name}`);
  passed += 1;
};

type Call = { method: string; body: any };
let calls: Call[] = [];
let nextMessageId = 5000;

const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(typeof input === 'string' ? input : input.url);
  const method = url.split('/').pop()!.split('?')[0];
  let body: any = null;
  try {
    body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body || null;
  } catch {
    body = null;
  }
  calls.push({ method, body });
  if (method === 'getMe') return jsonResponse({ ok: true, result: { id: 1, username: 'testbot', first_name: 'Bot' } });
  if (method === 'getChatAdministrators') return jsonResponse({ ok: true, result: [] });
  return jsonResponse({ ok: true, result: { message_id: nextMessageId++, chat: { id: body?.chat_id ?? 1 } } });
}) as typeof fetch;

const bot = new TelegramBotManager('TEST:TOKEN');
const anyBot = bot as any;
const HOST = '111';
const GUEST = '222';
const CHAT = '-1001234';

const press = (from: string) => ({
  id: `cb-${from}`,
  from: { id: Number(from), first_name: from === HOST ? 'الناشر' : 'لاعب' },
  message: { chat: { id: Number(CHAT), type: 'channel', title: 'قناة' }, message_id: 900 }
});
const texts = () => calls.filter(call => call.method === 'answerCallbackQuery').map(call => String(call.body?.text || ''));
const countOf = (method: string) => calls.filter(call => call.method === method).length;

function freshGame() {
  const game = GG.createQuiz(CHAT, 'قناة', 'flags', false, HOST);
  game.messageId = 900;
  GG.quizJoin(game, HOST, 'الناشر');
  GG.quizJoin(game, '333', 'لاعب ثاني');
  anyBot.gqGames.set(CHAT, game);
  return game;
}

/* ---------------------------------------- 1) الناشر يحفظ باللعبة */
{
  const game = freshGame();
  check('ناشر اللعبة ينحفظ وقت النشر', game.hostId === HOST);
  check('الناشر يُعرف كصاحب اللعبة', GG.isGameHost(game, HOST) === true);
  check('اللاعب العادي مو صاحب اللعبة', GG.isGameHost(game, GUEST) === false);
  check('لوحة قديمة بلا ناشر ما تتعطل', GG.isGameHost({}, GUEST) === true);
}

/* ---------------------------------------- 2) غير الناشر ما يقدر يبدأ */
{
  const game = freshGame();
  calls = [];
  await anyBot.handleGroupQuizCb(press(GUEST), `gqs:flags:normal:${CHAT}`);
  check('غير الناشر ما يبدأ اللعبة', game.status === 'lobby');
  check('غير الناشر يشوف رسالة رفض واضحة', texts().some(text => text.includes('بس اللي نشر اللعبة')));
  check('«ابدأ» ما تضيف الضاغط تلقائياً', game.players.every(player => player.id !== GUEST));
}

/* ---------------------------------------- 3) الناشر يبدأ، والنقص بعده */
{
  const game = freshGame();
  calls = [];
  await anyBot.handleGroupQuizCb(press(HOST), `gqs:flags:normal:${CHAT}`);
  check('الناشر يبدأ اللعبة', game.status === 'playing');
  check('اللاعبين ما تغيّروا (بلا انضمام تلقائي)', game.players.length === 2);
  check('اللعبة بدأت بجولة حقيقية', Array.isArray(game.options) && game.options.length > 0);
}

/* ---------------------------------------- 4) التجميد بعد جولتين فاضيتين */
{
  const game = freshGame();
  GG.quizStart(game);
  const first = GG.quizAdvance(game);
  check('الجولة الفاضية الأولى ما تجمّد', game.status === 'playing' && !first.paused);
  const second = GG.quizAdvance(game);
  check('جولتين فاضيتين يجمّدون اللوحة', game.status === 'paused' && second.paused === true);
  check('التجميد يوقف المؤقتات', game.roundDeadline === undefined && game.resultDeadline === undefined);
  check('شاشة التجميد تشرح الوضع', GG.renderQuiz(game).includes('وقّفنا اللعبة'));
  check('لوحة التجميد فيها زر متابعة', JSON.stringify(GG.quizKeyboard(game)).includes('gqr:'));
  const resumed = GG.quizResume(game);
  check('الناشر يقدر يكمل اللعبة', resumed.ok === true && game.status === 'playing');
  check('المتابعة تصفّر عدّاد الجولات الفاضية', game.emptyRounds === 0);
}

/* ---------------------------------------- 5) جولة فيها جواب ما تجمّد */
{
  const game = freshGame();
  GG.quizStart(game);
  GG.quizAdvance(game); // جولة فاضية
  GG.quizAnswer(game, HOST, 'الناشر', game.correctIdx);
  GG.quizAdvance(game); // فيها جواب → تصفير
  check('الجولة اللي بيها جواب تصفّر العدّاد', (game.emptyRounds || 0) === 0 && game.status === 'playing');
}

/* ---------------------------------------- 6) الناشر يفتح لعبة جديدة: حذف + رسالة جديدة */
{
  const game = freshGame();
  GG.quizStart(game);
  game.status = 'game_over';
  calls = [];
  const before = nextMessageId;
  await anyBot.handleGroupQuizCb(press(HOST), `gqn:flags:normal:${CHAT}`);
  const sent = calls.filter(call => call.method === 'sendMessage');
  const deleted = calls.filter(call => call.method === 'deleteMessage');
  check('اللعبة الجديدة تنزل برسالة جديدة', sent.length === 1);
  check('رسالة اللعبة المنتهية تنحذف', deleted.length === 1 && Number(deleted[0].body?.message_id) === 900);
  const fresh = anyBot.gqGames.get(CHAT) as GG.QuizGame;
  check('اللوحة الجديدة بلوبي', fresh.status === 'lobby');
  check('اللوحة الجديدة إلها معرّف رسالة جديد', fresh.messageId !== 900 && Number(fresh.messageId) >= before);
  check('الناشر ينحفظ باللعبة الجديدة', fresh.hostId === HOST);
}

/* ---------------------------------------- 7) غير الناشر ما يفتح لعبة جديدة */
{
  const game = freshGame();
  game.status = 'game_over';
  calls = [];
  await anyBot.handleGroupQuizCb(press(GUEST), `gqn:flags:normal:${CHAT}`);
  check('غير الناشر ما يفتح لعبة جديدة', calls.filter(call => call.method === 'sendMessage').length === 0);
  check('غير الناشر يشوف رفض واضح', texts().some(text => text.includes('بس ناشر اللعبة')));
  check('اللعبة المنتهية تبقى مكانها', anyBot.gqGames.get(CHAT).status === 'game_over');
}

/* ---------------------------------------- 8) ماسترمايند: نفس القاعدة */
{
  const game = GG.mmCreate(CHAT, 'قناة', HOST);
  GG.mmJoin(game, HOST, 'الناشر');
  GG.mmJoin(game, '333', 'لاعب ثاني');
  anyBot.mmGames.set(CHAT, game);
  check('ماسترمايند يحفظ ناشره', game.hostId === HOST);
  calls = [];
  await anyBot.handleMastermindCb(press(GUEST), `mms:${CHAT}`);
  check('غير الناشر ما يبدأ ماسترمايند', anyBot.mmGames.get(CHAT).status === 'lobby');
  await anyBot.handleMastermindCb(press(HOST), `mms:${CHAT}`);
  check('الناشر يبدأ ماسترمايند', anyBot.mmGames.get(CHAT).status === 'playing');
}

/* ---------------------------------------- 9) السورس: كل الألعاب تحذف المنتهية */
{
  const src = readFileSync(resolve(import.meta.dirname, '..', 'server', 'telegramBot.ts'), 'utf8');
  check('حذف اللوحة المنتهية مستعمل بكل الألعاب', (src.match(/retireFinishedBoard\(/g) || []).length >= 8);
  check('فحص الناشر مستعمل بكل أزرار البداية', (src.match(/canHostStartGame\(/g) || []).length >= 6);
  check('«ابدأ» بالأسئلة ما تضيف الضاغط تلقائياً', !/GG\.quizJoin\(game, playerId, playerName\);\s*\}\s*const r = GG\.quizStart/.test(src));
  check('كود نيمز يفتح جولة جديدة برسالة جديدة وحذف القديمة', /startNewGameLobby\(chatId, title[^)]*\)[\s\S]{0,220}retireFinishedBoard/.test(src));
  const rps = readFileSync(resolve(import.meta.dirname, '..', 'src', 'services', 'rpsEngine.ts'), 'utf8');
  check('حجرة ورقة مقص تحفظ ناشرها', rps.includes('createdBy: createdBy ? String(createdBy) : undefined'));
}

console.log(`Group game host checks passed: ${passed} assertions (host-only start, no auto-join, idle freeze, new message replaces the finished board).`);
