/**
 * 🎉 محرك الألعاب الجماعية بالقنوات
 *
 * نظام اللوبي: أي عضو يضغط «انضم» — من 3 لاعبين لحد 10.
 * اللعبة تبدأ بزر «ابدأ» بعد اكتمال العدد.
 *
 * نوعين من الأزرار تجي للبوت:
 *   gqj / gqs / gqa / gqn  → ألعاب الأسئلة (سرعة، معلومات، وألعاب خمّن)
 *   mmj / mms / mmd / mmb / mmc / mmn → ماسترمايند
 */
import { GQRow, GENERAL, COUNTRIES, MOVIES, SERIES, NUMBERS, FOODS } from './groupQuizData';

// ---------------------------------------------------------------------
// 🧩 أنواع الألعاب
// ---------------------------------------------------------------------
export type QuizKind = 'speed' | 'trivia' | 'country' | 'movie' | 'series' | 'number' | 'food';

export const QUIZ_KINDS: Record<QuizKind, { emoji: string; title: string; intro: string }> = {
  speed: {
    emoji: '⚡',
    title: 'مسابقة السرعة',
    intro: 'أول واحد يجاوب صح ياخذ النقطة — الباقي ياكلون غبار 🏃💨'
  },
  trivia: {
    emoji: '🧠',
    title: 'معركة المعلومات',
    intro: 'ينطرح سؤال واختار الجواب الصح — الأذكى يفوز 🧠'
  },
  country: {
    emoji: '🏳️',
    title: 'خمّن الدولة',
    intro: 'معلومة عن دولة وأربع خيارات — اختار الصح 🌍'
  },
  movie: {
    emoji: '🎬',
    title: 'خمّن الفيلم',
    intro: 'وصف قصير لفيلم مشهور وأربع أفلام — خمّن الصح 🍿'
  },
  series: {
    emoji: '📺',
    title: 'خمّن المسلسل',
    intro: 'وصف قصير لمسلسل مشهور وأربع مسلسلات — خمّن الصح 📺'
  },
  number: {
    emoji: '🔢',
    title: 'خمّن الرقم',
    intro: 'سؤال جوابه رقم وأربع خيارات — اختار الصح 🔢'
  },
  food: {
    emoji: '🍲',
    title: 'خمّن الأكلة',
    intro: 'وصف أكلة عربية مشهورة وأربع أكلات — اختار الصح 🍽️'
  }
};

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;
export const TOTAL_ROUNDS = 10;

// ---------------------------------------------------------------------
// 🎮 ألعاب الأسئلة
// ---------------------------------------------------------------------
export interface QuizPlayer {
  id: string;
  name: string;
  score: number;
  /** هل جاوب على الجولة الحالية (أو حاول) */
  done: boolean;
  /** هل جوابه بالجولة الحالية صحيح */
  roundHit?: boolean;
}

export interface QuizGame {
  chatId: string;
  chatName: string;
  messageId?: number;
  kind: QuizKind;
  status: 'lobby' | 'playing' | 'result' | 'game_over';
  players: QuizPlayer[];
  round: number;
  totalRounds: number;
  /** بنك جولات هاي المباراة (مخلوط جاهز) */
  deck: GQRow[];
  qIndex: number;
  /** خيارات الجولة بعد الخلط + مكان الإجابة الصحيحة */
  options: string[];
  correctIdx: number;
  /** نص ملخص آخر جولة (لعرضه بشاشة النتيجة) */
  lastLine: string;
  createdAt: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function packFor(kind: QuizKind): GQRow[] {
  switch (kind) {
    case 'country': return COUNTRIES;
    case 'movie': return MOVIES;
    case 'series': return SERIES;
    case 'number': return NUMBERS;
    case 'food': return FOODS;
    default: return GENERAL; // speed + trivia
  }
}

export function createQuiz(chatId: string, chatName: string, kind: QuizKind): QuizGame {
  const deck = shuffle(packFor(kind)).slice(0, TOTAL_ROUNDS);
  return {
    chatId,
    chatName,
    kind,
    status: 'lobby',
    players: [],
    round: 1,
    totalRounds: deck.length,
    deck,
    qIndex: 0,
    options: [],
    correctIdx: 0,
    lastLine: '',
    createdAt: Date.now()
  };
}

export function quizJoin(game: QuizGame, id: string, name: string): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: '⚠️ اللعبة بدأت — شارك بالبطولة الجاية' };
  if (game.players.some(p => p.id === id)) return { ok: false, msg: '✅ أنت مشترك' };
  if (game.players.length >= MAX_PLAYERS) return { ok: false, msg: '🚫 البطولة امتلأت (١٠ لاعبين)' };
  game.players.push({ id, name, score: 0, done: false });
  return { ok: true, msg: '✅ انضميت للبطولة!' };
}

/** يجهّز الجولة الحالية: يخلط الخيارات ويصفّر إجابات اللاعبين */
function loadRound(game: QuizGame) {
  const row = game.deck[game.qIndex];
  const correct = row[1];
  const opts = shuffle(row.slice(1) as string[]);
  game.options = opts;
  game.correctIdx = opts.indexOf(correct);
  for (const p of game.players) {
    p.done = false;
    p.roundHit = undefined;
  }
}

export function quizStart(game: QuizGame): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: '⚠️ اللعبة بدأت أصلاً' };
  if (game.players.length < MIN_PLAYERS) {
    return { ok: false, msg: `⚠️ تحتاجون ${MIN_PLAYERS} لاعبين على الأقل — هسه ${game.players.length}` };
  }
  game.status = 'playing';
  game.qIndex = 0;
  game.round = 1;
  loadRound(game);
  return { ok: true, msg: '🎮 بدأت البطولة!' };
}

export interface QuizAnswerResult {
  ok: boolean;
  msg: string;
  /** الجولة انغلقت (ننتقل بعدها للجولة التالية بعد مهلة صغيرة) */
  roundClosed: boolean;
}

export function quizAnswer(game: QuizGame, id: string, name: string, idx: number): QuizAnswerResult {
  if (game.status !== 'playing') return { ok: false, msg: '⏳ ماكو جولة مفتوحة هسه', roundClosed: false };
  const p = game.players.find(x => x.id === id);
  if (!p) return { ok: false, msg: '🚫 مو مشترك بهالبطولة', roundClosed: false };
  if (p.done) return { ok: false, msg: '❌ جاوبت هالجولة خلاص', roundClosed: false };

  const isRight = idx === game.correctIdx;
  const row = game.deck[game.qIndex];
  const correctText = row[1];

  // ⚡ وضع السرعة: أول صح يغلق الجولة فوراً
  if (game.kind === 'speed') {
    if (!isRight) {
      p.done = true;
      return { ok: true, msg: '❌ غلط! خارج هالجولة', roundClosed: false };
    }
    p.score += 1;
    p.done = true;
    p.roundHit = true;
    game.status = 'result';
    game.lastLine = `⚡ *${p.name}* سبق الكل وجاوب صح!\n✅ الجواب: *${correctText}*`;
    return { ok: true, msg: '⚡ صح وسباق! +١ نقطة', roundClosed: true };
  }

  // 🧩 باقي الأنواع: الكل يجاوب وكل صح يحسب
  p.done = true;
  p.roundHit = isRight;
  if (isRight) p.score += 1;

  const allDone = game.players.every(x => x.done);
  if (!allDone) {
    return { ok: true, msg: isRight ? '✅ صح! +١ نقطة' : '❌ غلط', roundClosed: false };
  }

  game.status = 'result';
  const winners = game.players.filter(x => x.roundHit).map(x => x.name);
  game.lastLine = winners.length
    ? `✅ الصح كان: *${correctText}*\n👏 جاوبوها صح: ${winners.join('، ')}`
    : `💔 محد جاوبها صح!\n✅ الصح كان: *${correctText}*`;
  return { ok: true, msg: isRight ? '✅ صح! +١ نقطة' : '❌ غلط', roundClosed: true };
}

/** يختم الجولة على طول (بس لاعب جاوب أصلاً يكدر يضغطها) — حتى البطولة ما تعلق بلاعب نايم */
export function quizSkip(game: QuizGame, id: string): { ok: boolean; msg: string } {
  if (game.status !== 'playing') return { ok: false, msg: '⏳ ماكو جولة مفتوحة' };
  const p = game.players.find(x => x.id === id);
  if (!p) return { ok: false, msg: '🚫 مو مشترك بهالبطولة' };
  if (!p.done) return { ok: false, msg: '⚠️ جاوب أول وبعدين ختم الجولة' };

  const row = game.deck[game.qIndex];
  const correctText = row[1];
  game.status = 'result';
  const winners = game.players.filter(x => x.roundHit).map(x => x.name);
  game.lastLine = winners.length
    ? `⏭️ انختمت الجولة!\n✅ الصح كان: *${correctText}*\n👏 جاوبوها: ${winners.join('، ')}`
    : `⏭️ انختمت الجولة بلا إجابة صحيحة 💔\n✅ الصح كان: *${correctText}*`;
  return { ok: true, msg: '⏭️ انختمت الجولة' };
}

/** بعد عرض نتيجة الجولة: نتأكد ماكو نهاية مبكرة ونجهّز الجولة الجاية أو نختم */
export function quizAdvance(game: QuizGame): { over: boolean; smart: boolean } {
  // 🧠 نهاية ذكية (وضع السرعة): إذا المتصدر مستحيل ينلحق
  if (game.kind === 'speed' && game.players.length) {
    const ordered = game.players.slice().sort((a, b) => b.score - a.score);
    const remaining = game.totalRounds - game.round; // جولات بعد الحالية
    const top = ordered[0].score;
    const second = ordered[1]?.score ?? 0;
    if (second + remaining < top) {
      game.status = 'game_over';
      return { over: true, smart: true };
    }
  }

  if (game.round >= game.totalRounds) {
    game.status = 'game_over';
    return { over: true, smart: false };
  }

  game.round += 1;
  game.qIndex += 1;
  game.status = 'playing';
  loadRound(game);
  return { over: false, smart: false };
}

// ---------------------------------------------------------------------
// 🎨 نصوص ولوحات ألعاب الأسئلة
// ---------------------------------------------------------------------
export function renderQuiz(game: QuizGame): string {
  const meta = QUIZ_KINDS[game.kind];
  const lines = [`${meta.emoji} *${meta.title}*`, `━━━━━━━━━━━━━━━━━━━`];

  if (game.status === 'lobby') {
    lines.push(`👥 *اللاعبين (${game.players.length}/${MAX_PLAYERS}):*`);
    if (!game.players.length) lines.push(`_ماكو أحد بعد — اضغط «انضم»_`);
    for (const p of game.players) lines.push(`• ${p.name}`);
    lines.push(`━━━━━━━━━━━━━━━━━━━`);
    lines.push(meta.intro);
    lines.push(`⚠️ تبدأ من *${MIN_PLAYERS}* لاعبين لحد *${MAX_PLAYERS}*`);
    return lines.join('\n');
  }

  if (game.status === 'game_over') {
    const sorted = game.players.slice().sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    lines.push(`*خلصت البطولة!* 🏁`);
    lines.push(`━━━━━━━━━━━━━━━━━━━`);
    lines.push(`الفائز: *${winner.name}* 🏆`);
    for (let i = 1; i < sorted.length; i++) {
      lines.push(`${i + 1}. ${sorted[i].name}: *${sorted[i].score}*`);
    }
    return lines.join('\n');
  }

  // playing / result
  lines.push(`*الجولة ${game.round}* من *${game.totalRounds}*`);
  lines.push(`━━━━━━━━━━━━━━━━━━━`);

  if (game.status === 'result') {
    lines.push(game.lastLine);
    lines.push(`━━━━━━━━━━━━━━━━━━━`);
  }

  if (game.status === 'playing') {
    lines.push(`❓ *${game.deck[game.qIndex][0]}*`);
    lines.push(`━━━━━━━━━━━━━━━━━━━`);
  }

  Lines_scores(lines, game);

  if (game.status === 'playing') {
    const waiting = game.players.filter(p => !p.done).length;
    if (game.kind === 'speed') {
      lines.push(`⚡ _اضغط الصح قبل الكل — أول صح يسجّل!_`);
    } else {
      lines.push(`⏳ _ننتظر ${waiting} ${waiting === 1 ? 'لاعب' : 'لاعبين'} يجاوبون…_`);
    }
  }
  return lines.join('\n');
}

function Lines_scores(lines: string[], game: QuizGame) {
  const sorted = game.players.slice().sort((a, b) => b.score - a.score);
  const parts = sorted.map(p => {
    let mark = '';
    if (game.status === 'result' || game.status === 'playing') {
      if (p.roundHit === true) mark = ' ✅';
      else if (p.done && p.roundHit === false) mark = ' ❌';
    }
    return `${p.name}: *${p.score}*${mark}`;
  });
  lines.push(parts.join(' • '));
  lines.push(`━━━━━━━━━━━━━━━━━━━`);
}

/** لوحة الأزرار أثناء اللعب — ٤ خيارات (٢×٢) */
export function quizKeyboard(game: QuizGame): any[][] {
  const chatId = game.chatId;

  if (game.status === 'lobby') {
    return [
      [{ text: '➕ انضم للبطولة', callback_data: `gqj:${chatId}` }],
      [{ text: '🎮 ابدأ اللعبة', callback_data: `gqs:${chatId}` }]
    ];
  }

  if (game.status === 'playing') {
    const kb: any[][] = [];
    const opts = game.options;
    for (let i = 0; i < opts.length; i += 2) {
      const row: any[] = [{ text: cut(opts[i], 30), callback_data: `gqa:${i}:${chatId}` }];
      if (opts[i + 1] !== undefined) row.push({ text: cut(opts[i + 1], 30), callback_data: `gqa:${i + 1}:${chatId}` });
      kb.push(row);
    }
    // ⏭️ تخطي (يظهر بس لو نص اللاعبين جاوبوا) — حتى اللعبة ما تتعلق إذا واحد نام
    if (game.kind !== 'speed') kb.push([{ text: '⏭️ ختم الجولة والانتقال', callback_data: `gqskip:${chatId}` }]);
    return kb;
  }

  if (game.status === 'result') {
    return [[{ text: '⏳ الجولة الجاية…', callback_data: `gqv:${chatId}` }]];
  }

  return [[{ text: '🔄 بطولة جديدة', callback_data: `gqn:${chatId}` }]];
}

function cut(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ---------------------------------------------------------------------
// 🔐 ماسترمايند — كسر الرقم السري (٤ أرقام غير مكررة)
// ---------------------------------------------------------------------
export interface MMPlayer {
  id: string;
  name: string;
  tries: number;
}

export interface MMGame {
  chatId: string;
  chatName: string;
  messageId?: number;
  status: 'lobby' | 'playing' | 'game_over';
  players: MMPlayer[];
  turnIdx: number;
  secret: string;
  entry: string;
  history: { name: string; guess: string; black: number; white: number }[];
  winnerId?: string;
  createdAt: number;
}

export const MM_MAX_TRIES_EACH = 6;

export function mmCreate(chatId: string, chatName: string): MMGame {
  const digits = shuffle(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']).slice(0, 4);
  return {
    chatId,
    chatName,
    status: 'lobby',
    players: [],
    turnIdx: 0,
    secret: digits.join(''),
    entry: '',
    history: [],
    createdAt: Date.now()
  };
}

export function mmJoin(game: MMGame, id: string, name: string): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: '⚠️ اللعبة بدأت — شارك بالجاية' };
  if (game.players.some(p => p.id === id)) return { ok: false, msg: '✅ أنت مشترك' };
  if (game.players.length >= MAX_PLAYERS) return { ok: false, msg: '🚫 امتلأت (١٠ لاعبين)' };
  game.players.push({ id, name, tries: 0 });
  return { ok: true, msg: '✅ انضميت!' };
}

export function mmStart(game: MMGame): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: '⚠️ اللعبة بدأت أصلاً' };
  if (game.players.length < MIN_PLAYERS) {
    return { ok: false, msg: `⚠️ تحتاجون ${MIN_PLAYERS} لاعبين على الأقل — هسه ${game.players.length}` };
  }
  game.status = 'playing';
  game.turnIdx = 0;
  return { ok: true, msg: '🔐 الرقم السري جاهز — يلا بدينا!' };
}

export function mmCurrent(game: MMGame): MMPlayer | undefined {
  return game.players[game.turnIdx % game.players.length];
}

function mmScoreGuess(secret: string, guess: string): { black: number; white: number } {
  let black = 0;
  let white = 0;
  const sLeft: string[] = [];
  const gLeft: string[] = [];
  for (let i = 0; i < 4; i++) {
    if (secret[i] === guess[i]) black++;
    else {
      sLeft.push(secret[i]);
      gLeft.push(guess[i]);
    }
  }
  for (const g of gLeft) {
    const at = sLeft.indexOf(g);
    if (at >= 0) {
      white++;
      sLeft.splice(at, 1);
    }
  }
  return { black, white };
}

export function mmPress(game: MMGame, id: string, digit: string): { ok: boolean; msg: string } {
  if (game.status !== 'playing') return { ok: false, msg: '⏳ ماكو جولة شغالة' };
  const cur = mmCurrent(game);
  if (!cur || cur.id !== id) return { ok: false, msg: '⏳ مو دورك هسه' };
  if (game.entry.length >= 4) return { ok: false, msg: '☑️ كمّلت ٤ أرقام — اضغط تأكيد أو مسح' };
  game.entry += digit;
  return { ok: true, msg: '' };
}

export function mmBack(game: MMGame, id: string): { ok: boolean; msg: string } {
  if (game.status !== 'playing') return { ok: false, msg: '⏳ ماكو جولة شغالة' };
  const cur = mmCurrent(game);
  if (!cur || cur.id !== id) return { ok: false, msg: '⏳ مو دورك هسه' };
  if (!game.entry.length) return { ok: false, msg: '' };
  game.entry = game.entry.slice(0, -1);
  return { ok: true, msg: '' };
}

export interface MMConfirm {
  ok: boolean;
  msg: string;
  won: boolean;
  stuck: boolean;
}

export function mmConfirm(game: MMGame, id: string): MMConfirm {
  if (game.status !== 'playing') return { ok: false, msg: '⏳ ماكو جولة شغالة', won: false, stuck: false };
  const cur = mmCurrent(game);
  if (!cur || cur.id !== id) return { ok: false, msg: '⏳ مو دورك هسه', won: false, stuck: false };
  if (new Set(game.entry).size !== game.entry.length || game.entry.length !== 4) {
    return { ok: false, msg: '⚠️ لازم ٤ أرقام مختلفة (بلا تكرار)', won: false, stuck: false };
  }

  const { black, white } = mmScoreGuess(game.secret, game.entry);
  cur.tries += 1;
  game.history.unshift({ name: cur.name, guess: game.entry, black, white });
  game.entry = '';

  if (black === 4) {
    game.status = 'game_over';
    game.winnerId = cur.id;
    return { ok: true, msg: '🎉 كسرت الرقم!', won: true, stuck: false };
  }

  // كل اللاعبين استهلكوا محاولاتهم؟ خسارة جماعية
  const stuck = game.players.every(p => p.tries >= MM_MAX_TRIES_EACH);
  if (stuck) {
    game.status = 'game_over';
    return { ok: true, msg: '💔 خلصت محاولات الجميع', won: false, stuck: true };
  }

  // دور اللاعب الجاي (نتخطى اللي خلص محاولاته)
  let next = game.turnIdx;
  for (let i = 0; i < game.players.length; i++) {
    next = (next + 1) % game.players.length;
    if (game.players[next].tries < MM_MAX_TRIES_EACH) break;
  }
  game.turnIdx = next;

  return { ok: true, msg: `⚫${black} ⚪${white}`, won: false, stuck: false };
}

/** يدوّر الدور على اللاعب الجاي (يتخطى من استهلك محاولاته) */
export function mmSkipTurn(game: MMGame, id: string): { ok: boolean; msg: string } {
  if (game.status !== 'playing') return { ok: false, msg: '⏳ ماكو لعبة شغالة' };
  const cur = mmCurrent(game);
  if (cur && cur.id === id) return { ok: false, msg: '⚠️ الدور عليك أنت — العب بدل التخطي' };
  if (!game.players.some(p => p.id === id)) return { ok: false, msg: '🚫 مو مشترك باللعبة' };

  let next = game.turnIdx;
  for (let i = 0; i < game.players.length; i++) {
    next = (next + 1) % game.players.length;
    if (game.players[next].tries < MM_MAX_TRIES_EACH) break;
  }
  game.turnIdx = next;
  game.entry = '';
  return { ok: true, msg: `⏭️ انعدل الدور — هسه على: ${mmCurrent(game)?.name}` };
}

export function renderMM(game: MMGame): string {
  const lines = [`🔐 *ماسترمايند — كسر الرقم السري*`, `━━━━━━━━━━━━━━━━━━━`];

  if (game.status === 'lobby') {
    lines.push(`👥 *اللاعبين (${game.players.length}/${MAX_PLAYERS}):*`);
    if (!game.players.length) lines.push(`_ماكو أحد بعد — اضغط «انضم»_`);
    for (const p of game.players) lines.push(`• ${p.name}`);
    lines.push(`━━━━━━━━━━━━━━━━━━━`);
    lines.push(`البوت خبّأ رقم سري من *٤ أرقام مختلفة* 🔒`);
    lines.push(`كل واحد بدوره يخمّن والبوت يجاوبه:`);
    lines.push(`⚫ رقم صح بمكانه الصح`);
    lines.push(`⚪ رقم موجود بس بمكان غلط`);
    lines.push(`أول واحد يطلع ⚫⚫⚫⚫ يفوز! 👑`);
    lines.push(`⚠️ تبدأ من *${MIN_PLAYERS}* لاعبين — *${MM_MAX_TRIES_EACH}* محاولات لكل لاعب`);
    return lines.join('\n');
  }

  if (game.status === 'game_over') {
    lines.push(`*خلصت اللعبة!* 🏁`);
    lines.push(`━━━━━━━━━━━━━━━━━━━`);
    if (game.winnerId) {
      const w = game.players.find(p => p.id === game.winnerId);
      lines.push(`الفائز: *${w?.name || 'مجهول'}* 👑`);
      lines.push(`كسّر الرقم بـ *${w?.tries}* محاولة!`);
    } else {
      lines.push(`💔 محد كسر الرقم — البوت غلبكم هالمرة 😎`);
    }
    lines.push(`━━━━━━━━━━━━━━━━━━━`);
    lines.push(`الرقم السري كان: *${game.secret.split('').join(' ')}*`);
    lines.push(`━━━━━━━━━━━━━━━━━━━`);
    for (const h of game.history.slice(0, 10)) {
      lines.push(`${h.name}: ${h.guess.split('').join(' ')} → ${'⚫'.repeat(h.black)}${'⚪'.repeat(h.white)}`);
    }
    return lines.join('\n');
  }

  const cur = mmCurrent(game);
  lines.push(`🎯 الدور على: *${cur?.name}* (${MM_MAX_TRIES_EACH - (cur?.tries || 0)} محاولات باقية)`);
  lines.push(`━━━━━━━━━━━━━━━━━━━`);
  lines.push(`تخمينك: *${game.entry ? game.entry.split('').join(' ') : '_ _ _ _'}*`);
  lines.push(`━━━━━━━━━━━━━━━━━━━`);
  if (game.history.length) {
    lines.push(`*آخر المحاولات:*`);
    for (const h of game.history.slice(0, 6)) {
      lines.push(`${h.name}: ${h.guess.split('').join(' ')} → ${'⚫'.repeat(h.black)}${'⚪'.repeat(h.white)}`);
    }
    lines.push(`━━━━━━━━━━━━━━━━━━━`);
  } else {
    lines.push(`_ماكو محاولات بعد — أول واحد يجرب_`);
    lines.push(`━━━━━━━━━━━━━━━━━━━`);
  }
  lines.push(`⚫ صح بمكانه • ⚪ صح بمكان غلط`);
  return lines.join('\n');
}

export function mmKeyboard(game: MMGame): any[][] {
  const chatId = game.chatId;

  if (game.status === 'lobby') {
    return [
      [{ text: '➕ انضم', callback_data: `mmj:${chatId}` }],
      [{ text: '🔐 ابدأ كسر الرقم', callback_data: `mms:${chatId}` }]
    ];
  }

  if (game.status === 'game_over') {
    return [[{ text: '🔄 لعبة جديدة', callback_data: `mmn:${chatId}` }]];
  }

  const kb: any[][] = [];
  kb.push([{ text: '⏭️ تجاوز دور النائم 😴', callback_data: `mmt:${chatId}` }]);
  for (let r = 1; r <= 9; r += 3) {
    kb.push([
      { text: `${r}`, callback_data: `mmd:${r}:${chatId}` },
      { text: `${r + 1}`, callback_data: `mmd:${r + 1}:${chatId}` },
      { text: `${r + 2}`, callback_data: `mmd:${r + 2}:${chatId}` }
    ]);
  }
  kb.push([
    { text: '⌫ مسح', callback_data: `mmb:${chatId}` },
    { text: '0', callback_data: `mmd:0:${chatId}` },
    { text: '✅ تأكيد', callback_data: `mmc:${chatId}` }
  ]);
  return kb;
}
