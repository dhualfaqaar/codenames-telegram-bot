/**
 * 🕵️ محرك لعبة «المافيا» الجماعية بالقنوات والمجموعات
 *
 * الأدوار:
 *   - 🔪 مافيا (١ إلى ٣ حسب عدد اللاعبين)
 *   - 🩺 طبيب (يحمي لاعباً واحداً كل ليلة)
 *   - 🔍 محقق (يفحص لاعباً واحداً كل ليلة — من ٦ لاعبين فأكثر)
 *   - 👤 مواطن
 *
 * المزايا:
 *   - كشف الدور السري يشتغل بطريقتين معاً: رسالة بالخاص + نافذة منبثقة خاصة بالقناة (show_alert) ما يشوفها غير اللاعب نفسه.
 *   - مهلة تلقائية لكل مرحلة متوافقة مع منبّه Cloudflare Durable Object حتى ما تعلق اللعبة أبداً.
 */

export type MafiaRole = 'mafia' | 'doctor' | 'detective' | 'citizen';
export type MafiaStatus = 'lobby' | 'night' | 'day' | 'finished';

export interface MafiaPlayer {
  id: string;
  name: string;
  role: MafiaRole;
  alive: boolean;
}

export interface MafiaGame {
  chatId: string;
  chatName: string;
  messageId?: number;
  createdBy?: string;
  status: MafiaStatus;
  round: number;
  players: MafiaPlayer[];
  /** اختيارات المافيا بالليل: mafiaId -> targetId */
  nightKills: Record<string, string>;
  /** اختيار الطبيب بالليل: targetId */
  doctorSave?: string;
  /** هل قام المحقق بالفحص هذه الليلة؟ */
  detectiveChecked?: boolean;
  /** سجل فحوصات المحقق الخاصة */
  detectiveNotes: string[];
  /** أصوات النهار العلنية: voterId -> targetId | 'skip' */
  dayVotes: Record<string, string>;
  /** تقرير آخر حدث (نتيجة الليل أو التصويت) */
  lastReport?: string;
  winner?: 'citizens' | 'mafia';
  phaseDeadline?: number;
  rewarded?: boolean;
}

export const MIN_MAFIA_PLAYERS = 4;
export const MAX_MAFIA_PLAYERS = 12;
export const MAFIA_NIGHT_MS = 20_000;
export const MAFIA_DAY_MS = 25_000;

const SEP = '━━━━━━━━━━━━━━━━━━━';

function mfMd(s: string): string {
  return String(s || '').replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function roleLabel(role: MafiaRole): string {
  switch (role) {
    case 'mafia':
      return '🔪 مافيا';
    case 'doctor':
      return '🩺 طبيب';
    case 'detective':
      return '🔍 محقق';
    default:
      return '👤 مواطن';
  }
}

export function createMafiaLobby(chatId: string, chatName: string, createdBy?: string): MafiaGame {
  return {
    chatId,
    chatName,
    createdBy,
    status: 'lobby',
    round: 0,
    players: [],
    nightKills: {},
    detectiveNotes: [],
    dayVotes: {}
  };
}

export function mafiaJoin(game: MafiaGame, id: string, name: string): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') {
    return { ok: false, msg: '⚠️ اللعبة بدأت بالفعل — انتظر الجولة القادمة.' };
  }
  if (game.players.some(p => p.id === id)) {
    return { ok: false, msg: '✅ إنت مسجّل بالفعل باللعبة!' };
  }
  if (game.players.length >= MAX_MAFIA_PLAYERS) {
    return { ok: false, msg: '⚠️ اكتمل الحد الأقصى للاعبين.' };
  }
  game.players.push({ id, name: name || 'لاعب', role: 'citizen', alive: true });
  return { ok: true, msg: '✅ انضممت للعبة المافيا!' };
}

export function mafiaStart(game: MafiaGame): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') {
    return { ok: false, msg: 'اللعبة جارية بالفعل.' };
  }
  if (game.players.length < MIN_MAFIA_PLAYERS) {
    return {
      ok: false,
      msg: `⚠️ نحتاج على الأقل ${MIN_MAFIA_PLAYERS} لاعبين للبدء (الموجودون حالياً ${game.players.length}).`
    };
  }

  const n = game.players.length;
  const mafiaCount = n >= 9 ? 3 : n >= 6 ? 2 : 1;
  const hasDetective = n >= 6;

  const roles: MafiaRole[] = [];
  for (let i = 0; i < mafiaCount; i++) roles.push('mafia');
  roles.push('doctor');
  if (hasDetective) roles.push('detective');
  while (roles.length < n) roles.push('citizen');

  const mixed = shuffle(roles);
  game.players.forEach((p, idx) => {
    p.role = mixed[idx];
    p.alive = true;
  });

  enterNight(game);
  return { ok: true, msg: '🕵️ بدأت لعبة المافيا! تفقدوا أدواركم السرية.' };
}

export function enterNight(game: MafiaGame) {
  game.status = 'night';
  game.round += 1;
  game.nightKills = {};
  game.doctorSave = undefined;
  game.detectiveChecked = false;
  game.dayVotes = {};
  game.phaseDeadline = Date.now() + MAFIA_NIGHT_MS;
}

export function aliveMafia(game: MafiaGame): MafiaPlayer[] {
  return game.players.filter(p => p.alive && p.role === 'mafia');
}

export function aliveCitizensSide(game: MafiaGame): MafiaPlayer[] {
  return game.players.filter(p => p.alive && p.role !== 'mafia');
}

export function checkMafiaWinner(game: MafiaGame): boolean {
  const m = aliveMafia(game).length;
  const c = aliveCitizensSide(game).length;
  if (m === 0) {
    game.status = 'finished';
    game.winner = 'citizens';
    game.phaseDeadline = undefined;
    return true;
  }
  if (m >= c) {
    game.status = 'finished';
    game.winner = 'mafia';
    game.phaseDeadline = undefined;
    return true;
  }
  return false;
}

/** هل أنهت جميع الأدوار الليلية الحية حركتها؟ */
export function isNightComplete(game: MafiaGame): boolean {
  const mafias = aliveMafia(game);
  if (mafias.some(m => !game.nightKills[m.id])) return false;
  const doc = game.players.find(p => p.alive && p.role === 'doctor');
  if (doc && !game.doctorSave) return false;
  const det = game.players.find(p => p.alive && p.role === 'detective');
  if (det && !game.detectiveChecked) return false;
  return true;
}

/** تنفيذ نتيجة الليل والانتقال إلى الصباح والتصويت */
export function resolveNight(game: MafiaGame): MafiaStatus {
  if (game.status !== 'night') return game.status;

  // اختيار هدف المافيا بالأغلبية (أو عشوائياً من الأحياء غير المافيا عند عدم التصويت)
  const tally = new Map<string, number>();
  for (const targetId of Object.values(game.nightKills)) {
    tally.set(targetId, (tally.get(targetId) || 0) + 1);
  }

  let victimId = '';
  let best = 0;
  for (const [tid, count] of tally.entries()) {
    if (count > best) {
      best = count;
      victimId = tid;
    }
  }

  if (!victimId) {
    const candidates = aliveCitizensSide(game);
    if (candidates.length > 0) {
      victimId = candidates[Math.floor(Math.random() * candidates.length)].id;
    }
  }

  const victim = game.players.find(p => p.id === victimId && p.alive);
  if (!victim) {
    game.lastReport = `🌅 طلع الصباح بسلام — ما سقط أي ضحية الليلة الماضية\\.`;
  } else if (game.doctorSave && game.doctorSave === victim.id) {
    game.lastReport =
      `🌅 *تقرير الصباح:*\n` +
      `🩺 حاولت المافيا اغتيال أحد الأبرياء، لكن *الطبيب تدخّل باللحظة الأخيرة وأنقذه\\!*`;
  } else {
    victim.alive = false;
    game.lastReport =
      `🌅 *تقرير الصباح:*\n` +
      `💀 اغتالت المافيا الليلة الماضية:\n` +
      `> \\| *${mfMd(victim.name)}* \\| \\(${mfMd(roleLabel(victim.role))}\\)`;
  }

  if (checkMafiaWinner(game)) return game.status;

  game.status = 'day';
  game.dayVotes = {};
  game.phaseDeadline = Date.now() + MAFIA_DAY_MS;
  return game.status;
}

/** تسجيل تصويت نهاري */
export function mafiaVoteDay(
  game: MafiaGame,
  voterId: string,
  targetId: string
): { ok: boolean; msg: string; allVoted: boolean } {
  if (game.status !== 'day') {
    return { ok: false, msg: 'التصويت متاح في النهار فقط.', allVoted: false };
  }
  const voter = game.players.find(p => p.id === voterId);
  if (!voter) {
    return { ok: false, msg: 'إنت مو ضمن المشاركين بهذه الجولة.', allVoted: false };
  }
  if (!voter.alive) {
    return { ok: false, msg: '💀 خرجت من اللعبة — المتابعة بصمت فقط!', allVoted: false };
  }
  if (targetId !== 'skip') {
    const target = game.players.find(p => p.id === targetId && p.alive);
    if (!target) {
      return { ok: false, msg: 'اللاعب غير متاح للتصويت.', allVoted: false };
    }
  }

  game.dayVotes[voterId] = targetId;
  const alive = game.players.filter(p => p.alive);
  const allVoted = alive.every(p => Boolean(game.dayVotes[p.id]));
  return {
    ok: true,
    msg: targetId === 'skip' ? '⏭️ اخترت تخطي التصويت' : '🗳️ تم تسجيل صوتك!',
    allVoted
  };
}

/** حسم تصويت النهار والانتقال إما لنهاية اللعبة أو لليلة جديدة */
export function resolveDay(game: MafiaGame): MafiaStatus {
  if (game.status !== 'day') return game.status;

  const tally = new Map<string, number>();
  let skipCount = 0;
  for (const choice of Object.values(game.dayVotes)) {
    if (choice === 'skip') {
      skipCount += 1;
    } else {
      tally.set(choice, (tally.get(choice) || 0) + 1);
    }
  }

  let topId = '';
  let topVotes = 0;
  let tied = false;
  for (const [pid, count] of tally.entries()) {
    if (count > topVotes) {
      topVotes = count;
      topId = pid;
      tied = false;
    } else if (count === topVotes && count > 0) {
      tied = true;
    }
  }

  if (!topId || tied || topVotes <= skipCount) {
    game.lastReport = `⚖️ *نتيجة التصويت:* تعادلت الكفة أو غلب التخطي — ما انطرد أحد هذا اليوم\\.`;
  } else {
    const kicked = game.players.find(p => p.id === topId && p.alive);
    if (kicked) {
      kicked.alive = false;
      game.lastReport =
        `⚖️ *نتيجة تصويت المدينة:*\n` +
        `قرّر الأهالي طرد:\n` +
        `> \\| *${mfMd(kicked.name)}* \\| — ودوره الحقيقي: *${mfMd(roleLabel(kicked.role))}*`;
    }
  }

  if (checkMafiaWinner(game)) return game.status;
  enterNight(game);
  return game.status;
}

/** نص الدور السري الخاص باللاعب (للنافذة المنبثقة وللخاص) */
export function secretRolePopupText(game: MafiaGame, playerId: string): string {
  const me = game.players.find(p => p.id === playerId);
  if (!me) return '⚠️ إنت مو مسجّل بهذه الجولة.';

  if (me.role === 'mafia') {
    const partners = game.players
      .filter(p => p.role === 'mafia' && p.id !== me.id)
      .map(p => p.name);
    return (
      `🔪 دورك السري: مافيا!\n` +
      (partners.length ? `🤝 زملاؤك بالمافيا: ${partners.join('، ')}\n` : '') +
      `مهمتك تصفية المواطنين بالليل وخداعهم بالتصويت نهاراً.`
    );
  }
  if (me.role === 'doctor') {
    return `🩺 دورك السري: الطبيب!\nكل ليلة تختار لاعباً بالخاص لحمايته من هجوم المافيا.`;
  }
  if (me.role === 'detective') {
    const extra = game.detectiveNotes.length ? `\n📋 فحوصاتك: ${game.detectiveNotes.join(' | ')}` : '';
    return `🔍 دورك السري: المحقق!\nكل ليلة تفحص لاعباً بالخاص لتعرف هل هو مافيا أم بريء.${extra}`;
  }
  return `👤 دورك السري: مواطن بريء!\nراقب النقاش نهاراً وصوّت لكشف أفراد المافيا وطردهم.`;
}

/** قائمة أزرار الحركة الليلية بالخاص لصاحب دور خاص */
export function buildNightDmPrompt(
  game: MafiaGame,
  player: MafiaPlayer
): { text: string; keyboard: any[][] } | null {
  if (!player.alive || game.status !== 'night') return null;

  if (player.role === 'mafia') {
    const targets = game.players.filter(p => p.alive && p.role !== 'mafia');
    const partners = game.players.filter(p => p.role === 'mafia' && p.id !== player.id);
    const kb = targets.map(t => [
      { text: `🔪 اغتيال: ${t.name}`, callback_data: `mfn:k:${game.chatId}:${game.players.indexOf(t)}` }
    ]);
    return {
      text:
        `🌙 *الليلة ${game.round} — دورك يا مافيا 🔪*\n` +
        `${SEP}\n` +
        (partners.length ? `🤝 شركاؤك بالمافيا: *${partners.map(p => p.name).join('، ')}*\n` : '') +
        `اختر الضحية التي تريد تصفيتها هذه الليلة:`,
      keyboard: kb
    };
  }

  if (player.role === 'doctor') {
    const targets = game.players.filter(p => p.alive);
    const kb = targets.map(t => [
      { text: `🩺 حماية: ${t.name}`, callback_data: `mfn:s:${game.chatId}:${game.players.indexOf(t)}` }
    ]);
    return {
      text:
        `🌙 *الليلة ${game.round} — دورك يا طبيب 🩺*\n` +
        `${SEP}\n` +
        `اختر لاعباً لحمايته من المافيا هذه الليلة:`,
      keyboard: kb
    };
  }

  if (player.role === 'detective') {
    const targets = game.players.filter(p => p.alive && p.id !== player.id);
    const kb = targets.map(t => [
      { text: `🔍 فحص: ${t.name}`, callback_data: `mfn:c:${game.chatId}:${game.players.indexOf(t)}` }
    ]);
    return {
      text:
        `🌙 *الليلة ${game.round} — دورك يا محقق 🔍*\n` +
        `${SEP}\n` +
        `اختر لاعباً للتحقق من هويته الحقيقية:`,
      keyboard: kb
    };
  }

  return null;
}

/** عرض لوحة المافيا بالقناة بصيغة MarkdownV2 جاهزة بالكامل */
export function renderMafiaBoard(game: MafiaGame): string {
  const lines: string[] = [];

  if (game.status === 'lobby') {
    lines.push(`🕵️ *لعبة المافيا*`);
    lines.push(SEP);
    lines.push(`👥 *المنضمون:* *${game.players.length}* من *${MAX_MAFIA_PLAYERS}*`);
    if (game.players.length > 0) {
      lines.push('');
      lines.push(
        game.players
          .map((p, i) => `> ${i + 1} \\- \\| *${mfMd(p.name)}* \\|`)
          .join('\n')
      );
    }
    return lines.join('\n');
  }

  if (game.status === 'night') {
    lines.push(`🌙 *لعبة المافيا — الليلة ${game.round}*`);
    lines.push(SEP);
    if (game.lastReport) {
      lines.push(game.lastReport);
      lines.push(SEP);
    }
    lines.push(`🤫 المدينة نائمة الآن\\.\\.\\. المافيا والطبيب والمحقق يتحركون بالخاص\\!`);
    lines.push('');
    lines.push(`👥 *الأحياء الآن:*`);
    lines.push(
      game.players
        .filter(p => p.alive)
        .map((p, i) => `> ${i + 1} \\- \\| *${mfMd(p.name)}* \\|`)
        .join('\n')
    );
    lines.push(`⏳ _يطلع الصباح خلال ٢٠ ثانية_`);
    return lines.join('\n');
  }

  if (game.status === 'day') {
    const alive = game.players.filter(p => p.alive);
    lines.push(`☀️ *لعبة المافيا — النهار ${game.round} \\(وقت التصويت\\)*`);
    lines.push(SEP);
    if (game.lastReport) {
      lines.push(game.lastReport);
      lines.push(SEP);
    }
    lines.push(`🗳️ *صوّتوا لطرد المشتبه به:*`);
    lines.push(
      alive
        .map((p, i) => {
          const voted = Boolean(game.dayVotes[p.id]);
          const against = Object.values(game.dayVotes).filter(v => v === p.id).length;
          const badge = against > 0 ? ` \\(🔥 ${against}\\)` : '';
          return `> ${i + 1} \\- \\| *${mfMd(p.name)}* \\|${badge} ${voted ? '✅' : '⏳'}`;
        })
        .join('\n')
    );
    lines.push(`⏳ _مهلة التصويت ٢٥ ثانية_`);
    return lines.join('\n');
  }

  // 🏁 نهاية اللعبة
  const citizensWon = game.winner === 'citizens';
  lines.push(
    citizensWon
      ? `🎉 *انتهت اللعبة — فاز المواطنون الأبرياء\\!*`
      : `🔪 *انتهت اللعبة — سيطرت المافيا وفازت\\!*`
  );
  lines.push(SEP);
  if (game.lastReport) {
    lines.push(game.lastReport);
    lines.push(SEP);
  }
  lines.push(`🎭 *كشف الأدوار الكامل:*`);
  lines.push(
    game.players
      .map((p, i) => {
        const won = citizensWon ? p.role !== 'mafia' : p.role === 'mafia';
        return `> ${i + 1} \\- \\| *${mfMd(p.name)}* \\| — *${mfMd(roleLabel(p.role))}* ${won ? '🏆' : '❌'}`;
      })
      .join('\n')
  );
  return lines.join('\n');
}

export function mafiaBoardKeyboard(game: MafiaGame, botUsername?: string): any[][] {
  const rows: any[][] = [];

  if (game.status === 'lobby') {
    if (game.players.length < MAX_MAFIA_PLAYERS) {
      rows.push([{ text: 'انضم', callback_data: `mf:j:${game.chatId}` }]);
    }
    if (game.players.length >= MIN_MAFIA_PLAYERS) {
      rows.push([{ text: '🚀 ابدأ اللعبة', callback_data: `mf:s:${game.chatId}` }]);
    }
    if (botUsername) {
      rows.push([
        {
          text: '💬 افتح الخاص مع البوت',
          url: `https://t.me/${botUsername}?start=mf_${game.chatId}`
        }
      ]);
    }
    return rows;
  }

  if (game.status === 'night') {
    rows.push([{ text: '🎭 اكشف دوري السري', callback_data: `mf:r:${game.chatId}` }]);
    if (botUsername) {
      rows.push([
        {
          text: '🌙 تنفيذ حركة الليل بالخاص',
          url: `https://t.me/${botUsername}?start=mf_${game.chatId}`
        }
      ]);
    }
    return rows;
  }

  if (game.status === 'day') {
    rows.push([{ text: '🎭 اكشف دوري السري', callback_data: `mf:r:${game.chatId}` }]);
    const alive = game.players.filter(p => p.alive);
    for (let i = 0; i < alive.length; i += 2) {
      const pair: any[] = [];
      const idx1 = game.players.indexOf(alive[i]);
      pair.push({ text: `🗳️ ${alive[i].name}`, callback_data: `mf:v:${game.chatId}:${idx1}` });
      if (alive[i + 1]) {
        const idx2 = game.players.indexOf(alive[i + 1]);
        pair.push({ text: `🗳️ ${alive[i + 1].name}`, callback_data: `mf:v:${game.chatId}:${idx2}` });
      }
      rows.push(pair);
    }
    rows.push([{ text: '⏭️ تخطي التصويت', callback_data: `mf:v:${game.chatId}:skip` }]);
    return rows;
  }

  return [[{ text: '🔄 لعبة جديدة', callback_data: `mf:n:${game.chatId}` }]];
}
