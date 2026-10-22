export type AmongUsRole = 'crewmate' | 'impostor';
export type AmongUsStatus = 'lobby' | 'tasks' | 'meeting' | 'finished';
export type AmongUsWinner = 'crew' | 'impostors';

export interface AmongUsPlayer {
  id: string;
  name: string;
  role: AmongUsRole;
  alive: boolean;
  tasks: number[];
  completedTasks: number[];
  emergencyUsed: boolean;
  ejected?: boolean;
  privateMessageId?: number;
}

export interface AmongUsGame {
  chatId: string;
  chatName: string;
  messageId?: number;
  status: AmongUsStatus;
  players: AmongUsPlayer[];
  round: number;
  votes: Record<string, string>;
  bodies: string[];
  nextKillAt: number;
  meetingDeadline?: number;
  winner?: AmongUsWinner;
  finishReason?: string;
  rewarded?: boolean;
  lastReport?: string;
}

interface TaskQuestion {
  prompt: string;
  options: string[];
  correct: number;
}

const TASKS: TaskQuestion[] = [
  { prompt: 'أي رقم يكمل النمط: 2، 4، 6، ؟', options: ['7', '8', '9', '10'], correct: 1 },
  { prompt: 'اختر الكلمة المختلفة عن البقية', options: ['تفاح', 'موز', 'جزر', 'عنب'], correct: 2 },
  { prompt: 'كم ضلعاً للمثلث؟', options: ['2', '3', '4', '5'], correct: 1 },
  { prompt: 'ما ناتج 7 + 5؟', options: ['10', '11', '12', '13'], correct: 2 },
  { prompt: 'أيّها كوكب؟', options: ['القمر', 'المريخ', 'الشمس', 'مجرة درب التبانة'], correct: 1 },
  { prompt: 'رتّب الحروف لتكوين فصل من فصول السنة: ءاوتش', options: ['شتاء', 'خريف', 'ربيع', 'صيف'], correct: 0 },
  { prompt: 'ما عاصمة العراق؟', options: ['البصرة', 'أربيل', 'بغداد', 'الموصل'], correct: 2 },
  { prompt: 'أيّ عدد زوجي؟', options: ['9', '13', '16', '21'], correct: 2 },
  { prompt: 'ما ناتج 3 × 4؟', options: ['7', '10', '12', '14'], correct: 2 },
  { prompt: 'أيّ حيوان يطير؟', options: ['بطريق', 'خفاش', 'سلحفاة', 'دلفين'], correct: 1 },
  { prompt: 'أيّ لون ينتج من مزج الأزرق والأصفر؟', options: ['أخضر', 'برتقالي', 'بنفسجي', 'وردي'], correct: 0 },
  { prompt: 'كم دقيقة في الساعة؟', options: ['30', '45', '60', '90'], correct: 2 }
];

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10;
export const MEETING_MS = 60_000;
export const KILL_COOLDOWN_MS = 35_000;
export const TASKS_PER_CREWMATE = 3;

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function md(value: string): string {
  return String(value || '').replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

export function createLobby(chatId: string, chatName: string): AmongUsGame {
  return {
    chatId,
    chatName,
    status: 'lobby',
    players: [],
    round: 0,
    votes: {},
    bodies: [],
    nextKillAt: 0
  };
}

export function join(game: AmongUsGame, id: string, name: string): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: 'اللعبة بدأت؛ انتظروا لوبي جديد.' };
  if (game.players.some(player => player.id === id)) return { ok: false, msg: 'إنت منضم من قبل.' };
  if (game.players.length >= MAX_PLAYERS) return { ok: false, msg: `اللوبي ممتلئ (${MAX_PLAYERS} لاعبين).` };
  game.players.push({
    id,
    name: name || 'لاعب',
    role: 'crewmate',
    alive: true,
    tasks: [],
    completedTasks: [],
    emergencyUsed: false
  });
  return { ok: true, msg: 'انضميت للطاقم 🚀' };
}

export function start(game: AmongUsGame, now = Date.now()): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: 'اللعبة بدأت بالفعل.' };
  if (game.players.length < MIN_PLAYERS) return { ok: false, msg: `تحتاج اللعبة ${MIN_PLAYERS} لاعبين على الأقل.` };

  const impostorCount = game.players.length >= 7 ? 2 : 1;
  const shuffledPlayers = shuffle(game.players);
  const taskIndexes = shuffle(TASKS.map((_, index) => index));
  shuffledPlayers.forEach((player, index) => {
    player.role = index < impostorCount ? 'impostor' : 'crewmate';
    player.alive = true;
    player.tasks = player.role === 'crewmate'
      ? shuffle(taskIndexes).slice(0, TASKS_PER_CREWMATE)
      : [];
    player.completedTasks = [];
    player.emergencyUsed = false;
    player.ejected = false;
    player.privateMessageId = undefined;
  });
  game.status = 'tasks';
  game.round = 1;
  game.votes = {};
  game.bodies = [];
  game.nextKillAt = now + KILL_COOLDOWN_MS;
  game.meetingDeadline = undefined;
  game.winner = undefined;
  game.finishReason = undefined;
  game.lastReport = 'بدأت المهمة. افتح زر «دوري ومهامي» حتى تشوف معلوماتك السرية.';
  return { ok: true, msg: 'بدأت المهمة — كل لاعب يفتح معلوماته بنفسه.' };
}

export function getPlayer(game: AmongUsGame, id: string): AmongUsPlayer | undefined {
  return game.players.find(player => player.id === id);
}

function crewTaskTotal(game: AmongUsGame): number {
  return game.players.filter(player => player.role === 'crewmate').reduce((sum, player) => sum + player.tasks.length, 0);
}

export function completedTaskTotal(game: AmongUsGame): number {
  return game.players.filter(player => player.role === 'crewmate').reduce((sum, player) => sum + player.completedTasks.length, 0);
}

export function progressText(game: AmongUsGame): string {
  return `${completedTaskTotal(game)}/${crewTaskTotal(game)}`;
}

function checkWin(game: AmongUsGame, reason: string): boolean {
  const aliveImpostors = game.players.filter(player => player.alive && player.role === 'impostor').length;
  const aliveCrew = game.players.filter(player => player.alive && player.role === 'crewmate').length;
  if (aliveImpostors === 0) {
    game.status = 'finished';
    game.winner = 'crew';
    game.finishReason = reason || 'انكشف كل المحتالين.';
    game.meetingDeadline = undefined;
    return true;
  }
  if (aliveImpostors >= aliveCrew) {
    game.status = 'finished';
    game.winner = 'impostors';
    game.finishReason = reason || 'صار عدد المحتالين مساوياً للطاقم.';
    game.meetingDeadline = undefined;
    return true;
  }
  const total = crewTaskTotal(game);
  if (total > 0 && completedTaskTotal(game) >= total) {
    game.status = 'finished';
    game.winner = 'crew';
    game.finishReason = 'أكمل الطاقم كل المهام.';
    game.meetingDeadline = undefined;
    return true;
  }
  return false;
}

export function answerTask(
  game: AmongUsGame,
  playerId: string,
  taskIndex: number,
  answerIndex: number
): { ok: boolean; msg: string; finished: boolean } {
  if (game.status !== 'tasks') return { ok: false, msg: 'المهام متوقفة أثناء الاجتماع.', finished: false };
  const player = getPlayer(game, playerId);
  if (!player || !player.alive || player.role !== 'crewmate') return { ok: false, msg: 'هذه المهمة مو متاحة إلك.', finished: false };
  if (!player.tasks.includes(taskIndex)) return { ok: false, msg: 'المهمة مو ضمن قائمتك.', finished: false };
  if (player.completedTasks.includes(taskIndex)) return { ok: false, msg: 'خلصت هاي المهمة من قبل.', finished: false };
  const task = TASKS[taskIndex];
  if (!task || answerIndex < 0 || answerIndex >= task.options.length) return { ok: false, msg: 'اختيار غير صالح.', finished: false };
  if (answerIndex !== task.correct) return { ok: false, msg: 'مو صحيح؛ جرّب خيار ثاني.', finished: false };
  player.completedTasks.push(taskIndex);
  const finished = checkWin(game, 'أكمل الطاقم كل المهام.');
  return { ok: true, msg: finished ? 'صح! اكتملت كل المهام وفاز الطاقم.' : 'صح! المهمة اكتملت ✅', finished };
}

export function kill(
  game: AmongUsGame,
  actorId: string,
  targetId: string,
  now = Date.now()
): { ok: boolean; msg: string; finished: boolean } {
  if (game.status !== 'tasks') return { ok: false, msg: 'ما تگدر تستخدم الحركة أثناء الاجتماع.', finished: false };
  const actor = getPlayer(game, actorId);
  const target = getPlayer(game, targetId);
  if (!actor || !actor.alive || actor.role !== 'impostor') return { ok: false, msg: 'الحركة مو متاحة إلك.', finished: false };
  if (!target || !target.alive || target.role !== 'crewmate') return { ok: false, msg: 'هذا الهدف مو متاح.', finished: false };
  if (now < game.nextKillAt) return { ok: false, msg: 'بعد ما خلص وقت الانتظار قبل الحركة الجاية.', finished: false };
  target.alive = false;
  game.bodies.push(target.id);
  game.nextKillAt = now + KILL_COOLDOWN_MS;
  game.lastReport = 'تم العثور على لاعب خارج المهمة. يگدر أي لاعب حي يبلّغ عن الاجتماع.';
  const finished = checkWin(game, 'وصل المحتالون إلى العدد الحاسم.');
  return { ok: true, msg: finished ? 'انتهت المهمة.' : 'تمت الحركة. انتظر البلاغ أو أكمل التمويه.', finished };
}

export function callMeeting(game: AmongUsGame, playerId: string, now = Date.now()): { ok: boolean; msg: string } {
  if (game.status !== 'tasks') return { ok: false, msg: 'ماكو اجتماع جديد حالياً.' };
  const player = getPlayer(game, playerId);
  if (!player || !player.alive) return { ok: false, msg: 'اللاعب الميت ما يگدر يستدعي اجتماع.' };
  if (!game.bodies.length && player.emergencyUsed) return { ok: false, msg: 'استخدمت اجتماع الطوارئ مالك.' };
  if (!game.bodies.length) player.emergencyUsed = true;
  game.status = 'meeting';
  game.round += 1;
  game.votes = {};
  game.meetingDeadline = now + MEETING_MS;
  game.lastReport = game.bodies.length ? 'بدأ الاجتماع بعد الإبلاغ عن لاعب.' : 'بدأ اجتماع طوارئ.';
  return { ok: true, msg: 'بدأ الاجتماع. صوّتوا من لوحة المجموعة.' };
}

export function vote(game: AmongUsGame, voterId: string, targetId: string): { ok: boolean; msg: string; resolved: boolean } {
  if (game.status !== 'meeting') return { ok: false, msg: 'ماكو تصويت مفتوح.', resolved: false };
  const voter = getPlayer(game, voterId);
  if (!voter || !voter.alive) return { ok: false, msg: 'الموتى ما يصوّتون.', resolved: false };
  if (game.votes[voterId]) return { ok: false, msg: 'صوّت من قبل بهذا الاجتماع.', resolved: false };
  if (targetId !== 'skip') {
    const target = getPlayer(game, targetId);
    if (!target || !target.alive) return { ok: false, msg: 'هذا اللاعب مو متاح للتصويت.', resolved: false };
  }
  game.votes[voterId] = targetId;
  const living = game.players.filter(player => player.alive).length;
  const resolved = Object.keys(game.votes).length >= living;
  if (resolved) resolveMeeting(game);
  return { ok: true, msg: resolved ? 'اكتمل التصويت.' : 'تم تسجيل صوتك بسرية.', resolved };
}

export function resolveMeeting(game: AmongUsGame): void {
  if (game.status !== 'meeting') return;
  const counts = new Map<string, number>();
  for (const choice of Object.values(game.votes)) counts.set(choice, (counts.get(choice) || 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const leader = ranked.length && (!ranked[1] || ranked[1][1] < ranked[0][1]) ? ranked[0][0] : '';
  const ejected = leader && leader !== 'skip' ? getPlayer(game, leader) : undefined;
  if (ejected) {
    ejected.alive = false;
    ejected.ejected = true;
    game.lastReport = `${ejected.name} طلع من المركبة. دوره: ${ejected.role === 'impostor' ? 'محتال' : 'من الطاقم'}.`;
  } else {
    game.lastReport = 'ما صار اتفاق على إخراج لاعب؛ ماكو أحد طلع.';
  }
  game.bodies = [];
  game.votes = {};
  game.meetingDeadline = undefined;
  if (!checkWin(game, game.lastReport)) game.status = 'tasks';
}

export function expireMeeting(game: AmongUsGame, now = Date.now()): boolean {
  if (game.status !== 'meeting' || game.meetingDeadline === undefined || now < game.meetingDeadline) return false;
  resolveMeeting(game);
  return true;
}

export function boardKeyboard(game: AmongUsGame): any[][] {
  if (game.status === 'lobby') {
    return [
      [{ text: `🚀 انضم (${game.players.length}/${MAX_PLAYERS})`, callback_data: `au:j:${game.chatId}` }],
      [{ text: '🎮 ابدأ المهمة', callback_data: `au:s:${game.chatId}` }]
    ];
  }
  if (game.status === 'tasks') {
    const keyboard: any[][] = [[{ text: '🔐 دوري ومهامي بالخاص', callback_data: `au:p:${game.chatId}` }]];
    if (game.bodies.length) keyboard.push([{ text: '📣 إبلاغ عن لاعب', callback_data: `au:r:${game.chatId}` }]);
    else keyboard.push([{ text: '🚨 اجتماع طوارئ', callback_data: `au:m:${game.chatId}` }]);
    return keyboard;
  }
  if (game.status === 'meeting') {
    const living = game.players.filter(player => player.alive);
    const keyboard: any[][] = [];
    for (let i = 0; i < living.length; i += 2) {
      const row = [{ text: `🗳️ ${buttonName(living[i].name)}`, callback_data: `au:v:${living[i].id}:${game.chatId}` }];
      if (living[i + 1]) row.push({ text: `🗳️ ${buttonName(living[i + 1].name)}`, callback_data: `au:v:${living[i + 1].id}:${game.chatId}` });
      keyboard.push(row);
    }
    keyboard.push([{ text: '⏭️ تخطّي التصويت', callback_data: `au:v:skip:${game.chatId}` }]);
    return keyboard;
  }
  return [[{ text: '🔄 مباراة جديدة', callback_data: `au:n:${game.chatId}` }]];
}

function buttonName(name: string): string {
  return String(name || 'لاعب').slice(0, 24);
}

export function privatePanelText(game: AmongUsGame, player: AmongUsPlayer): string {
  const role = player.role === 'impostor' ? '🔪 المحتال' : '🧑‍🚀 فرد من الطاقم';
  const lines = [`🚀 *أمونغ أس*`, `🎭 *دورك:* ${role}`, `📍 *الحالة:* ${player.alive ? 'حي' : player.ejected ? 'تم إخراجك' : 'تمت تصفيتك'}`];
  if (player.role === 'crewmate') {
    const complete = player.completedTasks.length;
    lines.push(`🧰 *مهامك:* ${complete}/${player.tasks.length} مكتملة`);
    if (game.status === 'tasks' && player.alive) {
      for (let index = 0; index < player.tasks.length; index++) {
        const taskId = player.tasks[index];
        const task = TASKS[taskId];
        const mark = player.completedTasks.includes(taskId) ? '✅' : '▫️';
        lines.push(`${mark} المهمة ${index + 1}: ${md(task.prompt)}`);
      }
    }
  } else if (player.role === 'impostor' && player.alive) {
    lines.push(`🤫 اشتغل بسرية، ولا تختار هدفاً أمام بقية اللاعبين.`);
    if (game.status === 'tasks') {
      const remaining = Math.max(0, Math.ceil((game.nextKillAt - Date.now()) / 1000));
      lines.push(remaining ? `⏳ الحركة الجاية بعد ${remaining} ثانية.` : '🔪 تگدر تختار هدفاً هسه.');
    }
  }
  if (game.status === 'meeting') lines.push('🗳️ الاجتماع مفتوح؛ صوت من لوحة المجموعة.');
  if (game.status === 'finished') lines.push(`🏁 الفائز: ${game.winner === 'crew' ? 'الطاقم' : 'المحتالون'}.`);
  return lines.join('\n');
}

export function privatePanelKeyboard(game: AmongUsGame, player: AmongUsPlayer): any[][] {
  if (!player.alive || game.status !== 'tasks') return [];
  if (player.role === 'crewmate') {
    const keyboard: any[][] = [];
    player.tasks.forEach((taskId, index) => {
      if (player.completedTasks.includes(taskId)) return;
      const task = TASKS[taskId];
      keyboard.push([{ text: `🧰 المهمة ${index + 1}: ${buttonName(task.prompt)}`, callback_data: `au:q:${taskId}:${game.chatId}` }]);
    });
    return keyboard;
  }
  if (Date.now() < game.nextKillAt) {
    return [[{ text: '🔄 تحديث معلوماتي', callback_data: `au:p:${game.chatId}` }]];
  }
  return game.players
    .filter(target => target.alive && target.role === 'crewmate')
    .map(target => [{ text: `🔪 ${buttonName(target.name)}`, callback_data: `au:k:${target.id}:${game.chatId}` }]);
}

export function taskQuestion(taskId: number): TaskQuestion | undefined {
  return TASKS[taskId];
}

export function taskAnswerKeyboard(game: AmongUsGame, taskId: number): any[][] {
  const task = TASKS[taskId];
  if (!task) return [];
  return task.options.map((option, index) => [
    { text: option, callback_data: `au:t:${taskId}:${index}:${game.chatId}` }
  ]);
}

export function renderBoard(game: AmongUsGame): string {
  const lines = [`🚀 *أمونغ أس — مهمة الطاقم*`, '━━━━━━━━━━━━━━━━━━━'];
  if (game.status === 'lobby') {
    lines.push(`👥 *اللاعبون (${game.players.length}/${MAX_PLAYERS}):*`);
    lines.push(game.players.length ? game.players.map((p, i) => `${i + 1}\. ${md(p.name)}`).join('\n') : '_ماكو أحد بعد_');
    lines.push(`\nابدؤوا عند اكتمال ${MIN_PLAYERS} لاعبين على الأقل. كل لاعب يفتح معلوماته السرية بنفسه بعد البدء.`);
    return lines.join('\n');
  }

  const living = game.players.filter(player => player.alive);
  const dead = game.players.filter(player => !player.alive);
  const impostorsAlive = living.filter(player => player.role === 'impostor').length;
  const totalCrewTasks = crewTaskTotal(game);
  lines.push(`🟩 *المهام المكتملة:* ${progressText(game)}`);
  lines.push(`🟢 *الأحياء:* ${living.length}  |  👾 *المحتالون الأحياء:* ${impostorsAlive}`);
  if (dead.length) lines.push(`⚫ *خارج المهمة:* ${dead.map(player => md(player.name)).join('، ')}`);
  if (game.status === 'meeting') {
    const votes = Object.keys(game.votes).length;
    lines.push(`\n🗳️ *اجتماع ${game.round}* — الأصوات: ${votes}/${living.length}`);
    lines.push('اختاروا لاعباً للتصويت أو تخطّوا التصويت. نتيجة الأصوات مخفية حتى يكتمل التصويت.');
  } else if (game.status === 'tasks') {
    lines.push(`\n📋 *الحالة:* تنفيذ المهام والبحث عن المحتال`);
    if (game.lastReport) lines.push(`📣 ${md(game.lastReport)}`);
    if (game.bodies.length) lines.push(`⚠️ يوجد لاعب يحتاج إلى بلاغ.`);
  } else if (game.status === 'finished') {
    lines.push(`\n🏁 *انتهت المهمة — فاز ${game.winner === 'crew' ? 'الطاقم 🧑‍🚀' : 'المحتالون 🔪'}!*`);
    if (game.finishReason) lines.push(md(game.finishReason));
    lines.push(`\n🎭 الأدوار: ${game.players.map(player => `${md(player.name)} — ${player.role === 'impostor' ? 'محتال' : 'طاقم'}`).join(' | ')}`);
  }
  if (game.status !== 'finished' && totalCrewTasks > 0 && completedTaskTotal(game) === totalCrewTasks) {
    lines.push('✅ اكتملت كل المهام.');
  }
  return lines.join('\n');
}
