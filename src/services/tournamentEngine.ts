/**
 * 🏆 محرك نظام البطولات والدوريات الإقصائية (8 / 16 / 32 لاعباً)
 *
 * نظام خروج المغلوب مثل أدوار كرة القدم تماماً:
 *   دور الـ 32 ⬅️ دور الـ 16 ⬅️ ربع النهائي ⬅️ نصف النهائي ⬅️ النهائي الكبير 🏆
 *
 * - يشترط عدد زوجي من اللاعبين عند الانطلاق (2، 4، 6، 8، … حتى 32).
 * - يتواجه كل لاعبين اثنين وجهاً لوجه (1 ضد 1) حتى يتأهل فائز واحد من كل مواجهة.
 * - يدعم ألعاب الأسئلة و«خمّن» + حجرة ورقة مقص + بطولة كرة قدم فردية بركلات الترجيح ⚽.
 * - ينتهي دائماً بتتويج لاعب واحد فقط بطلاً للبطولة بالكامل 👑.
 */

import {
  QUIZ_KINDS,
  QuizKind,
  ROUND_MS,
  RESULT_MS,
  drawQuizQuestion,
  toV2
} from './groupGamesEngine';

export type TournamentCapacity = 8 | 16 | 32;
export type TournamentDiscipline = QuizKind | 'rps' | 'football';
export type RpsThrow = 'r' | 'p' | 's';

export interface TournamentPlayer {
  id: string;
  name: string;
  hadBye?: boolean;
}

export interface TournamentFixture {
  p1: TournamentPlayer;
  p2: TournamentPlayer;
  score1: number;
  score2: number;
  winnerId?: string;
}

export interface TournamentGame {
  id: string;
  chatId: string;
  chatName: string;
  messageId?: number;
  inlineMessageId?: string;
  discipline: TournamentDiscipline;
  capacity: TournamentCapacity;
  status: 'lobby' | 'playing' | 'between' | 'finished';
  players: TournamentPlayer[];
  stageNumber: number;
  stageName: string;
  fixtures: TournamentFixture[];
  byePlayer?: TournamentPlayer | null;
  currentMatchIdx: number;
  targetScore: number;
  // بيانات الجولة الحية داخل المواجهة الجارية
  usedPrompts: string[];
  prompt: string;
  options: string[];
  correctIdx: number;
  p1Locked?: boolean;
  p2Locked?: boolean;
  p1Rps?: RpsThrow;
  p2Rps?: RpsThrow;
  p1FootballChoice?: number;
  p2FootballChoice?: number;
  footballKickNumber: number;
  footballFirstKicker: 1 | 2;
  p1ActiveMoves: number;
  p2ActiveMoves: number;
  stallCount: number;
  lastSummary: string;
  roundDeadline?: number;
  resultDeadline?: number;
  champion?: TournamentPlayer;
  runnerUp?: TournamentPlayer;
  rewarded?: boolean;
  createdAt: number;
}

export interface TrnButton {
  text: string;
  callback_data: string;
}

export interface TrnView {
  text: string;
  buttons: TrnButton[][];
}

export const TOURNAMENT_CAPACITIES: readonly TournamentCapacity[] = [8, 16, 32] as const;

const RPS_META: Record<RpsThrow, { icon: string; label: string; beats: RpsThrow }> = {
  r: { icon: '🪨', label: 'حجرة', beats: 's' },
  p: { icon: '📄', label: 'ورقة', beats: 'r' },
  s: { icon: '✂️', label: 'مقص', beats: 'p' }
};

function arNum(n: number): string {
  return String(n);
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getDisciplineMeta(discipline: TournamentDiscipline): { emoji: string; title: string } {
  if (discipline === 'rps') {
    return { emoji: '✊', title: 'حجرة ورقة مقص' };
  }
  if (discipline === 'football') {
    return { emoji: '⚽', title: 'بطولة كرة القدم الفردية' };
  }
  const meta = QUIZ_KINDS[discipline] || QUIZ_KINDS.general;
  return { emoji: meta.emoji, title: meta.title };
}

export function isValidDiscipline(raw: string): raw is TournamentDiscipline {
  return raw === 'rps' || raw === 'football' || Object.prototype.hasOwnProperty.call(QUIZ_KINDS, raw);
}

export function parseCapacity(raw: string | number): TournamentCapacity {
  const n = Number(raw);
  if (n === 16) return 16;
  if (n === 32) return 32;
  return 8;
}

function computeStageName(participantCount: number): string {
  if (participantCount <= 2) return 'النهائي الكبير 🏆';
  if (participantCount <= 4) return 'نصف النهائي 🔥';
  if (participantCount <= 8) return 'ربع النهائي ⚡';
  if (participantCount <= 16) return 'دور الـ 16 🎯';
  return 'دور الـ 32 🏟️';
}

export function createTournamentLobby(
  id: string,
  chatId: string,
  chatName: string,
  discipline: TournamentDiscipline,
  capacity: TournamentCapacity
): TournamentGame {
  return {
    id,
    chatId,
    chatName,
    discipline,
    capacity,
    status: 'lobby',
    players: [],
    stageNumber: 0,
    stageName: '',
    fixtures: [],
    byePlayer: null,
    currentMatchIdx: 0,
    targetScore: 2,
    usedPrompts: [],
    prompt: '',
    options: [],
    correctIdx: 0,
    footballKickNumber: 1,
    footballFirstKicker: Math.random() < 0.5 ? 1 : 2,
    p1ActiveMoves: 0,
    p2ActiveMoves: 0,
    stallCount: 0,
    lastSummary: '',
    createdAt: Date.now()
  };
}

export function joinTournament(
  game: TournamentGame,
  userId: string,
  userName: string
): { ok: boolean; reason?: string } {
  if (game.status !== 'lobby') {
    return { ok: false, reason: 'البطولة بدأت بالفعل — انتظر البطولة الجاية!' };
  }
  if (game.players.some(p => p.id === userId)) {
    return { ok: false, reason: 'أنت مسجّل بالبطولة بالفعل ✅' };
  }
  if (game.players.length >= game.capacity) {
    return { ok: false, reason: `اكتمل العدد الأقصى للبطولة (${arNum(game.capacity)} لاعباً)!` };
  }
  game.players.push({ id: userId, name: (userName || 'لاعب').trim().slice(0, 32) });
  return { ok: true };
}

export function leaveTournament(
  game: TournamentGame,
  userId: string
): { ok: boolean; reason?: string } {
  if (game.status !== 'lobby') {
    return { ok: false, reason: 'ما تكدر تنسحب بعد بدء المواجهات!' };
  }
  const idx = game.players.findIndex(p => p.id === userId);
  if (idx === -1) {
    return { ok: false, reason: 'أنت غير مسجّل بهذه البطولة أصلاً.' };
  }
  game.players.splice(idx, 1);
  return { ok: true };
}

/** يجهّز سؤالاً جديداً أو رمية جديدة للمواجهة الجارية */
function prepareTurn(game: TournamentGame): void {
  game.p1Locked = false;
  game.p2Locked = false;
  game.p1Rps = undefined;
  game.p2Rps = undefined;
  game.p1FootballChoice = undefined;
  game.p2FootballChoice = undefined;
  game.resultDeadline = undefined;
  game.roundDeadline = Date.now() + ROUND_MS;

  if (game.discipline === 'rps') {
    game.prompt = 'اختَر حركتك السرية الآن قبل انتهاء الـ 15 ثانية!';
    game.options = [];
    game.correctIdx = 0;
    return;
  }
  if (game.discipline === 'football') {
    const fx = game.fixtures[game.currentMatchIdx];
    const kickerIsP1 = game.footballKickNumber % 2 === 1 ? game.footballFirstKicker === 1 : game.footballFirstKicker === 2;
    const kicker = kickerIsP1 ? fx?.p1 : fx?.p2;
    const keeper = kickerIsP1 ? fx?.p2 : fx?.p1;
    game.prompt = `⚽ ${kicker?.name || 'المسدّد'} يسدّد، و${keeper?.name || 'الحارس'} يحرس — كل واحد يختار الزاوية بسرية.`;
    game.options = ['⬅️ يسار', '⬆️ وسط', '➡️ يمين'];
    game.correctIdx = 0;
    return;
  }

  const usedSet = new Set(game.usedPrompts);
  const drawn = drawQuizQuestion(game.discipline, usedSet);
  game.usedPrompts = Array.from(usedSet);
  game.prompt = drawn.prompt;
  game.options = drawn.options;
  game.correctIdx = drawn.correctIdx;
}

/** يبني جدول مواجهات الدور الجديد (كل لاعبين اثنين ضد بعض) */
function setupStage(game: TournamentGame, entrants: TournamentPlayer[]): void {
  game.stageNumber += 1;
  game.stageName = computeStageName(entrants.length);
  game.targetScore = entrants.length <= 2 ? 3 : 2;
  game.currentMatchIdx = 0;
  game.footballKickNumber = 1;
  game.footballFirstKicker = Math.random() < 0.5 ? 1 : 2;
  game.byePlayer = null;

  const pool = entrants.slice();
  if (pool.length % 2 === 1) {
    // في حال نتج عدد فردي بالأدوار المتقدمة (مثلاً 3 متأهلين من 6 لاعبين) يتأهل لاعب بالقرعة الذهبية ليكتمل النهائي الفردي
    let byeIdx = pool.findIndex(p => !p.hadBye);
    if (byeIdx === -1) byeIdx = pool.length - 1;
    const [lucky] = pool.splice(byeIdx, 1);
    lucky.hadBye = true;
    game.byePlayer = lucky;
  }

  const fixtures: TournamentFixture[] = [];
  for (let i = 0; i + 1 < pool.length; i += 2) {
    fixtures.push({
      p1: pool[i],
      p2: pool[i + 1],
      score1: 0,
      score2: 0
    });
  }
  game.fixtures = fixtures;
  game.p1ActiveMoves = 0;
  game.p2ActiveMoves = 0;
  game.stallCount = 0;
  game.status = 'playing';
  prepareTurn(game);
}

export function startTournament(game: TournamentGame): { ok: boolean; reason?: string } {
  if (game.status !== 'lobby') {
    return { ok: false, reason: 'البطولة جارية بالفعل!' };
  }
  const n = game.players.length;
  const minPlayers = game.discipline === 'football' ? 4 : 2;
  if (n < minPlayers) {
    return {
      ok: false,
      reason: game.discipline === 'football'
        ? 'بطولة كرة القدم تحتاج 4 لاعبين على الأقل؛ كل لاعب ينافس لنفسه.'
        : 'لازم ينضم لاعبان على الأقل حتى تنطلق البطولة!'
    };
  }
  if (n % 2 !== 0) {
    return {
      ok: false,
      reason: `⚠️ العدد الحالي فردي (${arNum(n)})! نظام البطولات يشترط عدد زوجي (2، 4، 6، 8، …) حتى يتواجه كل اثنين سوه.`
    };
  }

  const seeded = shuffle(game.players.map(p => ({ ...p, hadBye: false })));
  game.lastSummary = `🎲 سُحبت القرعة العشوائية بنجاح بين ${arNum(n)} متنافسين!`;
  setupStage(game, seeded);
  return { ok: true };
}

/** يحسم نقطة لطرف ويفحص هل حُسمت المواجهة أو الدور أو البطولة بالكامل */
function awardPointAndAdvance(
  game: TournamentGame,
  side: 1 | 2,
  note: string
): void {
  const fx = game.fixtures[game.currentMatchIdx];
  if (!fx) return;

  if (side === 1) fx.score1 += 1;
  else fx.score2 += 1;
  game.stallCount = 0;

  if (fx.score1 >= game.targetScore || fx.score2 >= game.targetScore) {
    const winner = fx.score1 > fx.score2 ? fx.p1 : fx.p2;
    const loser = fx.score1 > fx.score2 ? fx.p2 : fx.p1;
    fx.winnerId = winner.id;

    // هل هذه آخر مواجهة في البطولة كلها (النهائي الكبير بدون متأهل منتظر بالقرعة)؟
    const isLastMatchOfStage = game.currentMatchIdx >= game.fixtures.length - 1;
    if (isLastMatchOfStage && game.fixtures.length === 1 && !game.byePlayer) {
      game.champion = winner;
      game.runnerUp = loser;
      game.status = 'finished';
      game.roundDeadline = undefined;
      game.resultDeadline = undefined;
      game.lastSummary = note;
      return;
    }

    game.status = 'between';
    game.roundDeadline = undefined;
    game.resultDeadline = Date.now() + RESULT_MS;
    game.lastSummary = `${note}\n🏅 حسم المواجهة وتأهل للدور القادم!`;
    return;
  }

  game.status = 'between';
  game.roundDeadline = undefined;
  game.resultDeadline = Date.now() + RESULT_MS;
  game.lastSummary = note;
}

/** ينتقل تلقائياً للجولة التالية أو المواجهة التالية أو الدور الإقصائي التالي */
export function advanceTournamentAfterPause(game: TournamentGame): void {
  if (game.status !== 'between') return;
  const fx = game.fixtures[game.currentMatchIdx];
  if (!fx) return;

  // إذا ما زالت المواجهة الحالية مستمرة
  if (!fx.winnerId) {
    game.status = 'playing';
    prepareTurn(game);
    return;
  }

  // إذا بقيت مواجهات أخرى في نفس الدور الإقصائي
  if (game.currentMatchIdx + 1 < game.fixtures.length) {
    game.currentMatchIdx += 1;
    game.footballKickNumber = 1;
    game.footballFirstKicker = Math.random() < 0.5 ? 1 : 2;
    game.p1ActiveMoves = 0;
    game.p2ActiveMoves = 0;
    game.stallCount = 0;
    game.status = 'playing';
    game.lastSummary = '';
    prepareTurn(game);
    return;
  }

  // اكتملت جميع مواجهات هذا الدور — جمع المتأهلين للدور الإقصائي القادم
  const nextEntrants: TournamentPlayer[] = [];
  for (const f of game.fixtures) {
    const w = f.winnerId === f.p2.id ? f.p2 : f.p1;
    nextEntrants.push(w);
  }
  if (game.byePlayer) {
    nextEntrants.push(game.byePlayer);
  }

  if (nextEntrants.length <= 1) {
    game.champion = nextEntrants[0];
    game.status = 'finished';
    game.roundDeadline = undefined;
    game.resultDeadline = undefined;
    return;
  }

  game.lastSummary = `🔥 اكتمل ${game.stageName} وانطلق الدور التالي!`;
  setupStage(game, nextEntrants);
}

/** يستقبل ضغطة جواب في مواجهة الأسئلة/التخمين */
export function handleTournamentQuizAnswer(
  game: TournamentGame,
  userId: string,
  optIdx: number
): { ok: boolean; alert?: string; changed: boolean } {
  if (game.status !== 'playing' || game.discipline === 'rps' || game.discipline === 'football') {
    return { ok: false, alert: 'انتظر لحظة حتى تجهز الجولة!', changed: false };
  }
  const fx = game.fixtures[game.currentMatchIdx];
  if (!fx) return { ok: false, changed: false };

  const isP1 = userId === fx.p1.id;
  const isP2 = userId === fx.p2.id;
  if (!isP1 && !isP2) {
    return {
      ok: false,
      alert: '⚔️ هذه المواجهة مخصّصة للمتنافسَين الحاليَّين فقط — انتظر دورك بالبطولة!',
      changed: false
    };
  }

  if ((isP1 && game.p1Locked) || (isP2 && game.p2Locked)) {
    return { ok: false, alert: 'جاوبت على هذا السؤال بالفعل!', changed: false };
  }

  if (isP1) {
    game.p1Locked = true;
    game.p1ActiveMoves += 1;
  } else {
    game.p2Locked = true;
    game.p2ActiveMoves += 1;
  }

  const chosen = game.options[optIdx] ?? '';
  const correctAns = game.options[game.correctIdx] ?? '';

  if (optIdx === game.correctIdx) {
    awardPointAndAdvance(
      game,
      isP1 ? 1 : 2,
      `✅ إجابة صحيحة سريعة: *${correctAns}*`
    );
    return { ok: true, changed: true };
  }

  // إجابة خاطئة: إن أخطأ الاثنان ننتقل فوراً لسؤال جديد، وإلا نعطي الخصم فرصة إكمال المهلة
  if (game.p1Locked && game.p2Locked) {
    game.stallCount += 1;
    if (game.stallCount >= 3) {
      const luckySide: 1 | 2 = Math.random() < 0.5 ? 1 : 2;
      awardPointAndAdvance(
        game,
        luckySide,
        `⚽ حُسمت النقطة بركلات الترجيح الفاصلة! الإجابة كانت: *${correctAns}*`
      );
      return { ok: true, changed: true };
    }
    game.status = 'between';
    game.roundDeadline = undefined;
    game.resultDeadline = Date.now() + RESULT_MS;
    game.lastSummary = `❌ أخطأ الطرفان! الإجابة الصحيحة: *${correctAns}* — سؤال فاصل جديد 🔥`;
    return { ok: true, changed: true };
  }

  return {
    ok: true,
    alert: `❌ إجابة خاطئة (${chosen})! الكرة الآن بملعب خصمك!`,
    changed: true
  };
}

/** يحسم ركلة ترجيح (الزاويتان سرّيتان حتى يختار الطرفان أو تنتهي المهلة). */
function resolveFootballKick(game: TournamentGame, now = Date.now(), timedOut = false): void {
  const fx = game.fixtures[game.currentMatchIdx];
  if (!fx) return;
  const kickNumber = game.footballKickNumber || 1;
  const kickerIsP1 = kickNumber % 2 === 1 ? game.footballFirstKicker === 1 : game.footballFirstKicker === 2;
  const kickerLocked = kickerIsP1 ? game.p1Locked : game.p2Locked;
  const keeperLocked = kickerIsP1 ? game.p2Locked : game.p1Locked;
  const shot = kickerIsP1 ? game.p1FootballChoice : game.p2FootballChoice;
  const dive = kickerIsP1 ? game.p2FootballChoice : game.p1FootballChoice;
  const goal = Boolean(kickerLocked && typeof shot === 'number' && (!keeperLocked || shot !== dive));
  const scorer = kickerIsP1 ? fx.p1 : fx.p2;

  if (goal) {
    if (kickerIsP1) fx.score1 += 1;
    else fx.score2 += 1;
  }

  const summary = timedOut
    ? !kickerLocked
      ? `⏰ انتهى الوقت قبل تسديدة ${scorer.name} — ضاعت الركلة.`
      : !keeperLocked
        ? `⚽ هدف لـ ${scorer.name} — الحارس ما اختار زاويته قبل انتهاء الوقت.`
        : goal ? `⚽ هدف لـ ${scorer.name}!` : `🧤 تصدٍّ ناجح — لا هدف.`
    : goal
      ? `⚽ هدف لـ ${scorer.name}!`
      : `🧤 تصدٍّ ناجح — لا هدف لـ ${scorer.name}.`;

  const completedKick = kickNumber;
  game.footballKickNumber = completedKick + 1;
  game.p1Locked = false;
  game.p2Locked = false;
  game.p1FootballChoice = undefined;
  game.p2FootballChoice = undefined;

  // خمس ركلات لكل لاعب، ثم ركلات موت مفاجئ على أزواج كاملة حتى ينكسر التعادل.
  const pairComplete = completedKick >= 10 && completedKick % 2 === 0;
  if (pairComplete && fx.score1 !== fx.score2) {
    const winner = fx.score1 > fx.score2 ? fx.p1 : fx.p2;
    const loser = fx.score1 > fx.score2 ? fx.p2 : fx.p1;
    fx.winnerId = winner.id;
    const isFinal = game.fixtures.length === 1 && !game.byePlayer;
    game.roundDeadline = undefined;
    if (isFinal) {
      game.champion = winner;
      game.runnerUp = loser;
      game.status = 'finished';
      game.resultDeadline = undefined;
      game.lastSummary = `${summary} النتيجة ${fx.score1}–${fx.score2}؛ ${winner.name} حسم المواجهة وتأهل بطلاً!`;
      return;
    }
    game.status = 'between';
    game.resultDeadline = now + RESULT_MS;
    game.lastSummary = `${summary} النتيجة ${fx.score1}–${fx.score2}؛ ${winner.name} تأهل للدور القادم!`;
    return;
  }

  game.status = 'between';
  game.roundDeadline = undefined;
  game.resultDeadline = now + RESULT_MS;
  const nextHint = completedKick >= 10 && fx.score1 === fx.score2
    ? ' تعادل — تبدأ ركلات الموت المفاجئ.'
    : '';
  game.lastSummary = `${summary} النتيجة ${fx.score1}–${fx.score2}.${nextHint}`;
}

/** يستقبل اختياراً سرياً للمسدّد أو الحارس في بطولة كرة القدم الفردية. */
export function handleTournamentFootballChoice(
  game: TournamentGame,
  userId: string,
  direction: number
): { ok: boolean; alert?: string; changed: boolean } {
  if (game.status !== 'playing' || game.discipline !== 'football') {
    return { ok: false, alert: 'انتظر حتى تبدأ ركلات المواجهة!', changed: false };
  }
  if (!Number.isInteger(direction) || direction < 0 || direction > 2) {
    return { ok: false, alert: 'اختار زاوية صحيحة.', changed: false };
  }
  const fx = game.fixtures[game.currentMatchIdx];
  if (!fx) return { ok: false, changed: false };
  const isP1 = userId === fx.p1.id;
  const isP2 = userId === fx.p2.id;
  if (!isP1 && !isP2) {
    return { ok: false, alert: 'هذه الركلة للمتنافسَين الحاليَّين فقط — انتظر دورك!', changed: false };
  }
  if ((isP1 && game.p1Locked) || (isP2 && game.p2Locked)) {
    return { ok: false, alert: 'ثبّتت زاويتك بالفعل — ننتظر منافسك.', changed: false };
  }
  if (isP1) {
    game.p1Locked = true;
    game.p1FootballChoice = direction;
  } else {
    game.p2Locked = true;
    game.p2FootballChoice = direction;
  }
  if (game.p1Locked && game.p2Locked) {
    resolveFootballKick(game);
    return { ok: true, changed: true };
  }
  return { ok: true, alert: '🔒 ثبتّت زاويتك بالسر — ننتظر منافسك.', changed: true };
}

/** يستقبل حركة «حجرة / ورقة / مقص» السرية في البطولة الإقصائية */
export function handleTournamentRpsMove(
  game: TournamentGame,
  userId: string,
  move: RpsThrow
): { ok: boolean; alert?: string; changed: boolean } {
  if (game.status !== 'playing' || game.discipline !== 'rps') {
    return { ok: false, alert: 'انتظر لحظة حتى تبدأ الرمية!', changed: false };
  }
  const fx = game.fixtures[game.currentMatchIdx];
  if (!fx) return { ok: false, changed: false };

  const isP1 = userId === fx.p1.id;
  const isP2 = userId === fx.p2.id;
  if (!isP1 && !isP2) {
    return {
      ok: false,
      alert: '⚔️ هذه المواجهة مخصّصة للمتنافسَين الحاليَّين فقط — انتظر دورك بالبطولة!',
      changed: false
    };
  }

  if ((isP1 && game.p1Locked) || (isP2 && game.p2Locked)) {
    return { ok: false, alert: 'ثبّتت حركتك بالفعل! ننتظر خصمك 🔒', changed: false };
  }

  if (isP1) {
    game.p1Locked = true;
    game.p1Rps = move;
    game.p1ActiveMoves += 1;
  } else {
    game.p2Locked = true;
    game.p2Rps = move;
    game.p2ActiveMoves += 1;
  }

  if (!game.p1Rps || !game.p2Rps) {
    return {
      ok: true,
      alert: `🔒 ثبّتت «${RPS_META[move].icon} ${RPS_META[move].label}» بالسر!`,
      changed: true
    };
  }

  const m1 = RPS_META[game.p1Rps];
  const m2 = RPS_META[game.p2Rps];
  if (game.p1Rps === game.p2Rps) {
    game.stallCount += 1;
    if (game.stallCount >= 3) {
      const side: 1 | 2 = Math.random() < 0.5 ? 1 : 2;
      awardPointAndAdvance(
        game,
        side,
        `${m1.icon} ضد ${m2.icon} — بعد 3 تعادلات متتالية حُسمت النقطة بالقرعة الفاصلة ⚡`
      );
      return { ok: true, changed: true };
    }
    game.status = 'between';
    game.roundDeadline = undefined;
    game.resultDeadline = Date.now() + RESULT_MS;
    game.lastSummary = `🤝 تعادل حماسي (${m1.icon} ${m1.label} ضد ${m2.icon} ${m2.label})! رمية إعادة فورية 🔥`;
    return { ok: true, changed: true };
  }

  const side: 1 | 2 = m1.beats === game.p2Rps ? 1 : 2;
  awardPointAndAdvance(
    game,
    side,
    `🔥 ${m1.icon} ${m1.label} ضد ${m2.icon} ${m2.label}!`
  );
  return { ok: true, changed: true };
}

/** يعالج انتهاء مهلة الـ 15 ثانية تلقائياً دون أي تعليق للبطولة */
export function handleTournamentTimeout(game: TournamentGame): boolean {
  const now = Date.now();
  if (game.status === 'between' && game.resultDeadline && now >= game.resultDeadline) {
    advanceTournamentAfterPause(game);
    return true;
  }

  if (game.status === 'playing' && game.roundDeadline && now >= game.roundDeadline) {
    const fx = game.fixtures[game.currentMatchIdx];
    if (!fx) return false;

    if (game.discipline === 'football') {
      resolveFootballKick(game, now, true);
      return true;
    }

    // في حجرة ورقة مقص: إذا ثبت لاعب واحد فقط حركته وتأخر الآخر 15 ثانية يفوز الملتزم بالنقطة فوراً
    if (game.discipline === 'rps') {
      if (game.p1Locked && !game.p2Locked) {
        awardPointAndAdvance(game, 1, '⏱️ انتهت الـ 15 ثانية — نقطة للطرف الأول لالتزامه بالوقت!');
        return true;
      }
      if (game.p2Locked && !game.p1Locked) {
        awardPointAndAdvance(game, 2, '⏱️ انتهت الـ 15 ثانية — نقطة للطرف الثاني لالتزامه بالوقت!');
        return true;
      }
      game.stallCount += 1;
      if (game.stallCount >= 2) {
        const side: 1 | 2 =
          game.p1ActiveMoves !== game.p2ActiveMoves
            ? game.p1ActiveMoves > game.p2ActiveMoves
              ? 1
              : 2
            : Math.random() < 0.5
              ? 1
              : 2;
        awardPointAndAdvance(game, side, '⚽ انتهت المهلة مرتين — حُسمت النقطة تلقائياً لاستمرار البطولة!');
        return true;
      }
      game.status = 'between';
      game.roundDeadline = undefined;
      game.resultDeadline = now + RESULT_MS;
      game.lastSummary = '⏱️ انتهت الـ 15 ثانية بلا حركة — رمية جديدة الآن!';
      return true;
    }

    // في ألعاب الأسئلة والتخمين
    const correctAns = game.options[game.correctIdx] ?? '';
    game.stallCount += 1;
    if (game.stallCount >= 2) {
      const side: 1 | 2 =
        game.p1ActiveMoves !== game.p2ActiveMoves
          ? game.p1ActiveMoves > game.p2ActiveMoves
            ? 1
            : 2
          : Math.random() < 0.5
            ? 1
            : 2;
      awardPointAndAdvance(
        game,
        side,
        `⏱️ حُسمت النقطة الفاصلة تلقائياً! الإجابة كانت: *${correctAns}*`
      );
      return true;
    }

    game.status = 'between';
    game.roundDeadline = undefined;
    game.resultDeadline = now + RESULT_MS;
    game.lastSummary = `⏱️ انتهت الـ 15 ثانية! الإجابة الصحيحة: *${correctAns}*`;
    return true;
  }

  return false;
}

/** يرسم لوحة البطولة كاملة بصيغة MarkdownV2 سليمة 100٪ مع وضع كل اسم لاعب داخل اقتباس */
export function renderTournamentView(game: TournamentGame): TrnView {
  const meta = getDisciplineMeta(game.discipline);
  const id = game.id;

  // 1) شاشة اللوبي قبل بدء القرعة
  if (game.status === 'lobby') {
    const count = game.players.length;
    const minPlayers = game.discipline === 'football' ? 4 : 2;
    const isEvenReady = count >= minPlayers && count % 2 === 0;
    const statusHint =
      count < minPlayers
        ? `⏳ بانتظار ${arNum(minPlayers)} لاعبين على الأقل (الحد الأقصى ${arNum(game.capacity)})`
        : isEvenReady
          ? `✅ العدد زوجي وجاهز للقرعة (${arNum(count)} متنافسين — ${arNum(count / 2)} مواجهة إقصائية)`
          : `⚠️ العدد الحالي فردي (${arNum(count)}) — ينقص لاعب واحد فقط ليصبح العدد زوجياً!`;

    const rosterBlock =
      count === 0
        ? '> _لم ينضم أحد بعد — كن أول المتنافسين على اللقب!_'
        : game.players
            .map((p, idx) => `> ${idx + 1} - | *${p.name}* |`)
            .join('\n');

    const raw =
      `🏆 *نظام البطولات الإقصائية — ${meta.emoji} ${meta.title}*\n` +
      `🏟️ فئة البطولة: *دوري الـ ${arNum(game.capacity)} لاعباً* (خروج المغلوب)\n` +
      `👥 المسجلون حالياً: *${arNum(count)} / ${arNum(game.capacity)}*\n` +
      `${statusHint}\n\n` +
      `📋 *قائمة المتنافسين:*\n` +
      `${rosterBlock}\n\n` +
      (game.discipline === 'football'
        ? `⚽ _كل لاعب ينافس لنفسه؛ المواجهات ركلات ترجيح 1 ضد 1، والفائز يتأهل حتى النهائي._`
        : `⚡ _كل اثنين يتواجهون وجهاً لوجه بالأدوار الإقصائية حتى يتوَّج بطل واحد فقط باللقب!_`);

    const buttons: TrnButton[][] = [
      [
        { text: `🙋 انضمام للبطولة (${count}/${game.capacity})`, callback_data: `trn:j:${id}` },
        { text: '🚪 انسحاب', callback_data: `trn:l:${id}` }
      ],
      [{ text: '🚀 ابدأ البطولة واسحب القرعة', callback_data: `trn:s:${id}` }]
    ];

    return { text: toV2(raw), buttons };
  }

  // 2) شاشة تتويج البطل الوحيد في نهاية البطولة
  if (game.status === 'finished' && game.champion) {
    const champ = game.champion;
    const runnerLine = game.runnerUp
      ? `\n🥈 *وصيف البطولة:*\n> | *${game.runnerUp.name}* |\n`
      : '';

    const raw =
      `🏆✨ *ختام البطولة الإقصائية — ${meta.emoji} ${meta.title}* ✨🏆\n` +
      `🏟️ نظام خروج المغلوب (${arNum(game.players.length)} متنافسين)\n\n` +
      (game.lastSummary ? `${game.lastSummary}\n\n` : '') +
      `👑 *الفائز بالبطولة واللقب الذهبي:*\n` +
      `> 🏆 | *${champ.name}* | — بطل البطولة بلا منازع!\n` +
      `${runnerLine}\n` +
      `🎉 ألف مبروك التتويج المستحق واكتساح جميع الأدوار الإقصائية!`;

    const buttons: TrnButton[][] = [
      [{ text: '🔄 بطولة إقصائية جديدة', callback_data: `trn:n:${id}` }]
    ];
    return { text: toV2(raw), buttons };
  }

  // 3) شاشة المواجهة الحية أو الانتقال السريع بين الجولات
  const fx = game.fixtures[game.currentMatchIdx];
  const bracketLines = game.fixtures
    .map((f, idx) => {
      const icon = f.winnerId ? '✅' : idx === game.currentMatchIdx ? '⚔️' : '⏳';
      return `> ${icon} مباراة ${arNum(idx + 1)}: | *${f.p1.name}* | (${arNum(f.score1)}) 🆚 (${arNum(f.score2)}) | *${f.p2.name}* |`;
    })
    .join('\n');

  const byeSection = game.byePlayer
    ? `\n🎫 *متأهل بالقرعة للدور القادم:*\n> | *${game.byePlayer.name}* |\n`
    : '';

  const p1Status =
    game.status === 'playing'
      ? game.p1Locked
        ? game.discipline === 'rps' || game.discipline === 'football'
          ? ' 🔒 ثبّت اختياره'
          : ' ❌ أخطأ'
        : ' ⏳ يفكّر'
      : '';
  const p2Status =
    game.status === 'playing'
      ? game.p2Locked
        ? game.discipline === 'rps' || game.discipline === 'football'
          ? ' 🔒 ثبّت اختياره'
          : ' ❌ أخطأ'
        : ' ⏳ يفكّر'
      : '';

  const duelSides = game.discipline === 'football'
    ? `⚽ *اللاعب الأول:*\n> | *${fx.p1.name}* | — الأهداف: *${arNum(fx.score1)}*${p1Status}\n` +
      `⚽ *اللاعب الثاني:*\n> | *${fx.p2.name}* | — الأهداف: *${arNum(fx.score2)}*${p2Status}`
    : `🔴 *الطرف الأول:*\n` +
      `> | *${fx.p1.name}* | — النقاط: *${arNum(fx.score1)} / ${arNum(game.targetScore)}*${p1Status}\n` +
      `🔵 *الطرف الثاني:*\n` +
      `> | *${fx.p2.name}* | — النقاط: *${arNum(fx.score2)} / ${arNum(game.targetScore)}*${p2Status}`;

  if (game.status === 'between') {
    const raw =
      `🏆 *${meta.emoji} ${meta.title} — ${game.stageName}*\n` +
      `📊 *جدول الدور الحالي:*\n${bracketLines}${byeSection}\n\n` +
      `${duelSides}\n\n` +
      `📣 ${game.lastSummary}`;
    return { text: toV2(raw), buttons: [] };
  }

  const raw =
    `🏆 *${meta.emoji} ${meta.title} — ${game.stageName}*\n` +
    `📊 *جدول الدور الحالي:*\n${bracketLines}${byeSection}\n\n` +
    `⚔️ *المواجهة الجارية الآن (المباراة ${arNum(game.currentMatchIdx + 1)} من ${arNum(game.fixtures.length)}):*\n` +
    `${duelSides}\n\n` +
    `${game.discipline === 'football' ? `🥅 *الركلة ${arNum(game.footballKickNumber)}:* ` : '❓ *'}${game.prompt}${game.discipline === 'football' ? '' : '*'}\n` +
    `⏱️ _المهلة: 15 ثانية فقط!_`;

  const buttons: TrnButton[][] = [];
  if (game.discipline === 'football') {
    buttons.push([
      { text: '⬅️ يسار', callback_data: `trn:f:${id}:0` },
      { text: '⬆️ وسط', callback_data: `trn:f:${id}:1` },
      { text: '➡️ يمين', callback_data: `trn:f:${id}:2` }
    ]);
  } else if (game.discipline === 'rps') {
    buttons.push([
      { text: '🪨 حجرة', callback_data: `trn:r:${id}:r` },
      { text: '📄 ورقة', callback_data: `trn:r:${id}:p` },
      { text: '✂️ مقص', callback_data: `trn:r:${id}:s` }
    ]);
  } else if (game.options.length === 2) {
    buttons.push([
      { text: game.options[0], callback_data: `trn:a:${id}:0` },
      { text: game.options[1], callback_data: `trn:a:${id}:1` }
    ]);
  } else {
    for (let i = 0; i < game.options.length; i += 2) {
      const row: TrnButton[] = [{ text: game.options[i], callback_data: `trn:a:${id}:${i}` }];
      if (i + 1 < game.options.length) {
        row.push({ text: game.options[i + 1], callback_data: `trn:a:${id}:${i + 1}` });
      }
      buttons.push(row);
    }
  }

  return { text: toV2(raw), buttons };
}
