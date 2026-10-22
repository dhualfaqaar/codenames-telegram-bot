export type StoryMode = 'duo' | 'group';
export type StoryStatus = 'lobby' | 'writing' | 'guessing' | 'voting' | 'finished';

export interface StoryPlayer {
  id: string;
  name: string;
  dmReady?: boolean;
  dmChatId?: string;
  /** In duo: index 0 is true, index 1 is fabricated. In group: one secret story. */
  statements: string[];
  guess?: number;
  vote?: string;
}

export interface StoryGame {
  id: string;
  chatId: string;
  chatTitle: string;
  messageId?: number;
  inlineMessageId?: string;
  mode: StoryMode;
  status: StoryStatus;
  players: StoryPlayer[];
  liarId?: string;
  startRequested?: boolean;
  createdAt: number;
  finishedAt?: number;
}

export const STORY_MIN_GROUP = 3;
export const STORY_MAX_PLAYERS = 10;
const MAX_STATEMENT_CHARS = 280;

export function createStoryGame(chatId: string, chatTitle: string, mode: StoryMode): StoryGame {
  return {
    id: Math.random().toString(36).slice(2, 10),
    chatId,
    chatTitle,
    mode,
    status: 'lobby',
    players: [],
    createdAt: Date.now()
  };
}

export function storyJoin(game: StoryGame, id: string, name: string): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: 'اللعبة بدأت؛ انتظر الجولة القادمة.' };
  if (game.players.some(p => p.id === id)) return { ok: false, msg: 'أنت منضم بالفعل.' };
  if (game.players.length >= STORY_MAX_PLAYERS) return { ok: false, msg: 'اكتمل الحد الأقصى (10 لاعبين).' };
  if (game.mode === 'duo' && game.players.length >= 2) return { ok: false, msg: 'هذه اللعبة لشخصين فقط.' };
  game.players.push({ id, name: name || 'لاعب', statements: [] });
  return { ok: true, msg: 'انضممت! افتح الخاص مع البوت حتى توصلك خطوات اللعبة.' };
}

export function storyCanStart(game: StoryGame): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: 'اللعبة بدأت بالفعل.' };
  const min = game.mode === 'duo' ? 2 : STORY_MIN_GROUP;
  if (game.players.length < min) return { ok: false, msg: `نحتاج ${min} لاعبين على الأقل؛ الموجودون ${game.players.length}.` };
  if (game.mode === 'duo' && game.players.length !== 2) return { ok: false, msg: 'لعبة الكذبة والحقيقة تحتاج لاعبين اثنين.' };
  return { ok: true, msg: 'جاهزون للبدء.' };
}

export function storyStart(game: StoryGame): { ok: boolean; msg: string } {
  const check = storyCanStart(game);
  if (!check.ok) return check;
  game.status = 'writing';
  game.startRequested = true;
  if (game.mode === 'group') {
    game.liarId = game.players[Math.floor(Math.random() * game.players.length)].id;
  }
  return { ok: true, msg: 'بدأت اللعبة؛ اكتبوا مواقفكم في الخاص مع البوت.' };
}

export function storyNextPrompt(game: StoryGame, playerId: string): { kind: 'truth' | 'lie' | 'story'; text: string } | undefined {
  if (game.status !== 'writing') return undefined;
  const player = game.players.find(p => p.id === playerId);
  if (!player) return undefined;
  if (game.mode === 'duo') {
    if (player.statements.length === 0) return { kind: 'truth', text: 'اكتب موقفاً حقيقياً صار وياك، برسالة منفصلة. لا ترسله بالكروب.' };
    if (player.statements.length === 1) return { kind: 'lie', text: 'هسه اكتب موقفاً مفبركاً ومقنعاً برسالة ثانية. الطرف الثاني راح يحاول يكتشفه.' };
    return undefined;
  }
  if (player.statements.length === 0) {
    const isLiar = player.id === game.liarId;
    return {
      kind: 'story',
      text: isLiar
        ? 'دورك السري: اكتب موقفاً كاذباً ومقنعاً برسالة خاصة. لا تكشف دورك لأحد.'
        : 'اكتب موقفاً حقيقياً صار وياك برسالة خاصة. لا ترسله بالكروب؛ المشاركون راح يحاولون كشف صاحب الموقف الكاذب.'
    };
  }
  return undefined;
}

export function storySubmitStatement(game: StoryGame, playerId: string, raw: string): { ok: boolean; msg: string; phaseChanged: boolean } {
  if (game.status !== 'writing') return { ok: false, msg: 'ماكو موقف مطلوب منك هسه.', phaseChanged: false };
  const player = game.players.find(p => p.id === playerId);
  if (!player) return { ok: false, msg: 'أنت مو مشارك بهاللعبة.', phaseChanged: false };
  const text = String(raw || '').trim();
  if (text.length < 8) return { ok: false, msg: 'اكتب موقفاً أطول شوي حتى يصير ممتعاً (8 أحرف على الأقل).', phaseChanged: false };
  if (text.length > MAX_STATEMENT_CHARS) return { ok: false, msg: `اختصر الموقف إلى ${MAX_STATEMENT_CHARS} حرف كحد أقصى.`, phaseChanged: false };

  const needed = game.mode === 'duo' ? 2 : 1;
  if (player.statements.length >= needed) return { ok: false, msg: 'استلمت مواقفك من قبل.', phaseChanged: false };
  player.statements.push(text);
  const allReady = game.players.every(p => p.statements.length >= needed);
  if (allReady) {
    game.status = game.mode === 'duo' ? 'guessing' : 'voting';
    return { ok: true, msg: game.mode === 'duo' ? 'وصلت كل المواقف؛ ابدأوا التخمين بالخاص.' : 'اكتملت المواقف؛ صوّتوا في لوحة المجموعة لكشف الكاذب.', phaseChanged: true };
  }
  return { ok: true, msg: 'حفظت الموقف بسرية ✅', phaseChanged: false };
}

export function storyGuessDuo(game: StoryGame, playerId: string, otherStatementIndex: number): { ok: boolean; msg: string; finished: boolean } {
  if (game.mode !== 'duo' || game.status !== 'guessing') return { ok: false, msg: 'مرحلة التخمين غير مفتوحة.', finished: false };
  const player = game.players.find(p => p.id === playerId);
  if (!player || player.guess !== undefined) return { ok: false, msg: 'هذا التخمين مسجّل مسبقاً.', finished: false };
  if (otherStatementIndex !== 0 && otherStatementIndex !== 1) return { ok: false, msg: 'اختيار غير صالح.', finished: false };
  player.guess = otherStatementIndex;
  const finished = game.players.every(p => p.guess !== undefined);
  if (finished) {
    game.status = 'finished';
    game.finishedAt = Date.now();
  }
  return { ok: true, msg: finished ? 'اكتمل التخمين! ظهرت النتيجة في اللوحة.' : 'تم تسجيل تخمينك بسرية ✅', finished };
}

export function storyVoteLiar(game: StoryGame, voterId: string, targetPlayerId: string): { ok: boolean; msg: string; finished: boolean } {
  if (game.mode !== 'group' || game.status !== 'voting') return { ok: false, msg: 'مرحلة التصويت غير مفتوحة.', finished: false };
  const voter = game.players.find(p => p.id === voterId);
  const target = game.players.find(p => p.id === targetPlayerId);
  if (!voter || !target) return { ok: false, msg: 'المشارك غير موجود.', finished: false };
  if (voter.vote) return { ok: false, msg: 'صوتك مسجّل بالفعل.', finished: false };
  voter.vote = targetPlayerId;
  const finished = game.players.every(p => Boolean(p.vote));
  if (finished) {
    game.status = 'finished';
    game.finishedAt = Date.now();
  }
  return { ok: true, msg: finished ? 'اكتمل التصويت! انكشف الدور في اللوحة.' : 'تم تسجيل صوتك بسرية ✅', finished };
}

export function storyDuoResults(game: StoryGame): { playerId: string; name: string; foundLie: boolean; guessedIndex?: number }[] {
  return game.players.map(player => {
    const other = game.players.find(p => p.id !== player.id);
    return {
      playerId: player.id,
      name: player.name,
      foundLie: Boolean(other && player.guess === 1),
      guessedIndex: player.guess
    };
  });
}

export function storyGroupResults(game: StoryGame): { liarId?: string; caught: boolean; votes: Map<string, number>; voteWinnerId?: string } {
  const votes = new Map<string, number>();
  for (const player of game.players) {
    if (player.vote) votes.set(player.vote, (votes.get(player.vote) || 0) + 1);
  }
  const ranked = Array.from(votes.entries()).sort((a, b) => b[1] - a[1]);
  const uniqueTop = ranked.length > 0 && (ranked.length === 1 || ranked[0][1] > ranked[1][1]);
  const voteWinnerId = uniqueTop ? ranked[0][0] : undefined;
  return { liarId: game.liarId, caught: Boolean(voteWinnerId && voteWinnerId === game.liarId), votes, voteWinnerId };
}

export function storyRender(game: StoryGame): string {
  const title = game.mode === 'duo' ? '🤥 كذبة وحقيقة' : '🕵️ كذبة وحقائق';
  const rows = game.players.map((p, i) => `• ${escapeMarkdownV2(p.name)} ${p.statements.length ? '✅' : '⏳'}`);
  const header = [`${title}`, `👥 المشاركون (${game.players.length}/${game.mode === 'duo' ? 2 : STORY_MAX_PLAYERS})`, ...rows];
  if (game.status === 'lobby') {
    header.push('', game.mode === 'duo' ? 'كل لاعب يرسل موقفاً حقيقياً وموقفاً مفبركاً برسالتين خاصتين، ثم يخمّن موقف خصمه الكاذب.' : 'شخص واحد دوره يكذب بموقف مقنع، والبقية يرسلون مواقف حقيقية. بعدين يصوّت الجميع لكشفه.');
  } else if (game.status === 'writing') {
    header.push('', '✍️ المرحلة الحالية: إرسال المواقف سراً إلى البوت في الخاص.');
  } else if (game.status === 'guessing') {
    header.push('', '🔎 اكتملت المواقف؛ كل لاعب يختار أيّ موقف من موقفي خصمه مفبرك، ويشوف النتيجة بعد ما يجاوب الاثنان.');
  } else if (game.status === 'voting') {
    header.push('', '🔎 اقرأ المواقف المجهولة بالأسفل وصوّت لصاحب الموقف الكاذب:');
    game.players.forEach((p, i) => header.push(`\n${i + 1}\. ${escapeMarkdownV2(p.statements[0] || '')}`));
  } else {
    header.push('', game.mode === 'duo' ? '🏁 النتيجة:' : '🏁 انتهت الجولة:');
    if (game.mode === 'duo') {
      const results = storyDuoResults(game);
      for (const res of results) header.push(`${res.foundLie ? '✅' : '❌'} ${escapeMarkdownV2(res.name)}: ${res.foundLie ? 'كشف الكذبة' : 'ما كشف الكذبة'}`);
      game.players.forEach(p => header.push(`\n${escapeMarkdownV2(p.name)}: الحقيقة — ${escapeMarkdownV2(p.statements[0] || '')}\nالكذبة — ${escapeMarkdownV2(p.statements[1] || '')}`));
    } else {
      const r = storyGroupResults(game);
      header.push(r.caught ? '✅ انكشف الكاذب وطلع بالتصويت' : '🫥 الكاذب نجا من التصويت');
      game.players.forEach(p => header.push(`\n${p.id === r.liarId ? '🤥' : '🗣️'} ${escapeMarkdownV2(p.name)} — ${r.votes.get(p.id) || 0} صوت: ${escapeMarkdownV2(p.statements[0] || '')}`));
    }
  }
  return header.join('\n');
}

function escapeMarkdownV2(value: string): string {
  return String(value || '').replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
