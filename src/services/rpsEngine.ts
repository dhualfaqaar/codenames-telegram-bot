/**
 * ✊✋✌️ لعبة «حجرة ورقة مقص»
 * لعبة بالقناة/الكروب: لاعبين ينضمون، وكل جولة كل لاعب يختار (حجرة/ورقة/مقص)
 * من أزرار اللوحة نفسها بالقناة، والبوت يكشف النتيجة ويحسب الجولات.
 */

export type RPSMove = 'rock' | 'paper' | 'scissors';

export interface RPSPlayer {
  id: string;
  name: string;
  score: number;
  /** اختيار الجولة الحالية (سري) */
  move?: RPSMove;
}

export interface RPSGame {
  id: string;
  chatId: string;
  chatTitle: string;
  /** عدد الجولات الكلي */
  totalRounds: number;
  /** الجولة الحالية */
  round: number;
  players: RPSPlayer[];
  status: 'lobby' | 'playing' | 'game_over';
  /** كل جولة انتهت — نص النتيجة */
  history: string[];
  /** فائز المباراة */
  winnerId?: string;
  messageId?: number;
  channel?: boolean;
  createdAt: number;
  updatedAt: number;
}

export const MOVE_LABEL: Record<RPSMove, string> = {
  rock: '✊ حجرة',
  paper: '✋ ورقة',
  scissors: '✌️ مقص'
};

export const MOVE_BEATS: Record<RPSMove, RPSMove> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper'
};

/** يهروّب رموز MarkdownV2 الخاصة حتى النص ينطبع حرفياً (لوحات RPS تُرسل MarkdownV2 للاقتباسات الملوّنة) */
function md(s: string): string {
  return s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/** سطر لاعب داخل اقتباس ملوّن: 1 - | اسم | (p نقاطه) */
function scoreLine(rank: number, name: string, score: number, mark = ''): string {
  return `> ${rank} \\- \\| *${md(name)}* \\| \\(p ${score}\\)${mark}`;
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** ينشئ مباراة جديدة بحالة انتظار */
export function createGame(
  chatId: string,
  chatTitle: string,
  totalRounds: number,
  createdBy?: string
): RPSGame {
  return {
    id: `rps_${chatId}_${Date.now()}`,
    chatId,
    chatTitle,
    totalRounds: [5, 10, 15].includes(totalRounds) ? totalRounds : 5,
    round: 1,
    players: [],
    status: 'lobby',
    history: [],
    channel: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

/** ينضم لاعب (أقصى 2 لاعبين) */
export function join(game: RPSGame, id: string, name: string): RPSGame {
  if (game.status !== 'lobby') return game;
  if (game.players.some(p => p.id === id)) return game;
  if (game.players.length >= 2) return game;
  const players = [...game.players, { id, name, score: 0 }];
  return { ...game, players, updatedAt: Date.now() };
}

/** يبدي المباراة (لازم لاعبين اثنين) */
export function start(game: RPSGame): RPSGame {
  if (game.players.length < 2) return game;
  return {
    ...game,
    status: 'playing',
    round: 1,
    players: game.players.map(p => ({ ...p, score: 0, move: undefined })),
    updatedAt: Date.now()
  };
}

/** لاعب يختار حركته بالجولة الحالية */
export function setMove(game: RPSGame, id: string, move: RPSMove): RPSGame {
  if (game.status !== 'playing') return game;
  const players = game.players.map(p => (p.id === id ? { ...p, move } : p));
  return { ...game, players, updatedAt: Date.now() };
}

/** هل كل اللاعبين اختاروا؟ */
export function allMoved(game: RPSGame): boolean {
  return game.players.length === 2 && game.players.every(p => Boolean(p.move));
}

/** يحسب الجولة الحالية ويحدث النقاط (يُستدعى بعد ما يختار الكل) */
export function resolveRound(game: RPSGame): RPSGame {
  if (!allMoved(game)) return game;

  const [a, b] = game.players;
  const ma = a.move!;
  const mb = b.move!;

  let players = game.players.map(p => ({ ...p }));
  let line: string;

  if (ma === mb) {
    line = `🤝 تعادل — الكل اختار ${MOVE_LABEL[ma]} (الجولة تعاد)`;
  } else if (MOVE_BEATS[ma] === mb) {
    players = players.map(p => (p.id === a.id ? { ...p, score: p.score + 1 } : p));
    line = `✅ *${a.name}* فاز بالجولة (${MOVE_LABEL[ma]} ضد ${MOVE_LABEL[mb]})`;
  } else {
    players = players.map(p => (p.id === b.id ? { ...p, score: p.score + 1 } : p));
    line = `✅ *${b.name}* فاز بالجولة (${MOVE_LABEL[mb]} ضد ${MOVE_LABEL[ma]})`;
  }

  const draw = ma === mb;
  // الجولة ما تتقدم إذا تعادل
  const round = draw ? game.round : game.round + 1;

  // 🧠 نهاية ذكية: إذا الخاسر ما يكدر يلحق بالمتصدّر حتى لو كسب
  // كل الجولات الباقية → المباراة تخلص بالمكان بدون استكمال الراوندات
  const remaining = game.totalRounds - round + 1; // الجولات المتبقية بعد هذي
  const topScore = Math.max(...players.map(p => p.score));
  const bottomScore = Math.min(...players.map(p => p.score));
  const catchUpImpossible = bottomScore + remaining < topScore;
  const over = catchUpImpossible || remaining <= 0;

  const playersReset = players.map(p => ({ ...p, move: undefined }));
  const winner = over
    ? playersReset.slice().sort((x, y) => y.score - x.score)[0]?.id
    : undefined;

  return {
    ...game,
    players: playersReset,
    round,
    history: [...game.history, line],
    status: over ? 'game_over' : 'playing',
    winnerId: over ? winner : undefined,
    updatedAt: Date.now()
  };
}

/** نص رسالة المباراة بلوحة (للقناة) */
export function renderGame(game: RPSGame): string {
  const SEP = '━━━━━━━━━━━━━━━━━━━';
  const lines = [`✊ *حجرة ورقة مقص*`];

  if (game.status === 'lobby') {
    lines.push('');
    lines.push(`👥 *اللاعبين \\(${game.players.length}/2\\):*`);
    if (!game.players.length) {
      lines.push(`_ماكو أحد بعد_`);
    } else {
      lines.push(game.players.map((p, i) => scoreLine(i + 1, p.name, p.score)).join('\n'));
    }
    lines.push(`🎯 الجولات: *${game.totalRounds}*`);
    return lines.join('\n');
  }

  if (game.status === 'game_over') {
    const sorted = game.players.slice().sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    lines.push(`🏁 *خلصت المباراة\\!*`);
    if (winner) {
      lines.push('');
      lines.push(`🏆 *الفائز:*`);
      lines.push(`> \\| *${md(winner.name)}* \\|`);
    }
    lines.push(SEP);
    lines.push(`📊 *النتيجة النهائية:*`);
    lines.push(sorted.map((p, i) => scoreLine(i + 1, p.name, p.score)).join('\n'));
    return lines.join('\n');
  }

  lines.push(`🎯 الجولة *${game.round}* من *${game.totalRounds}*`);
  lines.push(SEP);
  lines.push(`🏆 *النقاط:*`);
  lines.push(game.players.map((p, i) => scoreLine(i + 1, p.name, p.score, p.move ? ' ✅' : ' ⏳')).join('\n'));
  return lines.join('\n');
}

/** أزرار لوحة القناة */
export function boardKeyboard(game: RPSGame): any[][] {
  const rows: any[][] = [];

  if (game.status === 'lobby') {
    if (game.players.length < 2) {
      rows.push([{ text: 'انضم', callback_data: `rpsb:join:${game.chatId}` }]);
    } else {
      rows.push([{ text: '🚀 ابدأ', callback_data: `rpsb:start:${game.chatId}` }]);
    }
    return rows;
  }

  if (game.status === 'game_over') {
    rows.push([{ text: '🔄 مباراة جديدة', callback_data: `rpsb:again:${game.chatId}` }]);
    return rows;
  }

  // 🎯 اللعب شغّال → ثلاث مربعات على اللوحة نفسها: حجرة / ورقة / مقص
  rows.push([
    { text: '✊ حجرة', callback_data: `rpsm:rock:${game.chatId}` },
    { text: '✋ ورقة', callback_data: `rpsm:paper:${game.chatId}` },
    { text: '✌️ مقص', callback_data: `rpsm:scissors:${game.chatId}` }
  ]);
  return rows;
}

/** أزرار اختيار الحركة (تظهر بالخاص) */
export function moveKeyboard(chatId: string): any[][] {
  return [
    [
      { text: '✊ حجرة', callback_data: `rpsm:rock:${chatId}` },
      { text: '✋ ورقة', callback_data: `rpsm:paper:${chatId}` }
    ],
    [{ text: '✌️ مقص', callback_data: `rpsm:scissors:${chatId}` }]
  ];
}

export { shuffle };
