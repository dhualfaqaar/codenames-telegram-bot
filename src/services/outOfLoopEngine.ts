/**
 * 🎭 محرك لعبة «منو برا السالفة؟» الجماعية بالقنوات والمجموعات
 *
 * الفكرة:
 *   - يختار البوت صنفاً واضحاً وسالفة سرية (مثلاً: الصنف «أكلات» — السالفة «دولمة»).
 *   - كل اللاعبين يعرفون السالفة السرية (بالخاص أو بضغطة زر «🔒 اكشف السالفة» داخل القناة نفسه!)
 *     ما عدا لاعب واحد عشوائي يكون «برا السالفة» ويعرف اسم الصنف فقط!
 *   - يتناقش اللاعبون ويصوّتون على المشتبه به، ثم يحصل «اللي برا السالفة» على 15 ثانية لتخمين السالفة من 8 خيارات!
 */

export type OOLStatus = 'lobby' | 'questioning' | 'voting' | 'guessing' | 'finished';

export interface OOLPlayer {
  id: string;
  name: string;
  score: number;
}

export interface OOLCategory {
  title: string;
  emoji: string;
  items: string[];
}

export const OOL_CATEGORIES: OOLCategory[] = [
  {
    title: 'الأكلات الشعبية والعربية',
    emoji: '🍽️',
    items: ['دولمة', 'مسكوف', 'باچة', 'برياني', 'كباب عراقي', 'شاورما', 'فلافل', 'تشريب', 'مقلوبة', 'قوزي']
  },
  {
    title: 'المدن والعواصم',
    emoji: '🏙️',
    items: ['بغداد', 'البصرة', 'أربيل', 'كربلاء', 'دبي', 'إسطنبول', 'القاهرة', 'مكة المكرمة', 'باريس', 'لندن']
  },
  {
    title: 'الحيوانات والطيور',
    emoji: '🐾',
    items: ['أسد', 'دولفين', 'بطريق', 'جمل', 'صقر', 'باندا', 'تمساح', 'أخطبوط', 'حصان', 'ذئب']
  },
  {
    title: 'كرة القدم',
    emoji: '⚽',
    items: ['ليونيل ميسي', 'كريستيانو رونالدو', 'ريال مدريد', 'برشلونة', 'كأس العالم', 'ضربة جزاء', 'دوري أبطال أوروبا', 'محمد صلاح']
  },
  {
    title: 'المهن والوظائف',
    emoji: '💼',
    items: ['طبيب أسنان', 'طيّار', 'حلّاق', 'شيف مطعم', 'رجل إطفاء', 'محامي', 'مصوّر', 'مهندس معماري']
  },
  {
    title: 'التطبيقات والتقنية',
    emoji: '📱',
    items: ['تليكرام', 'يوتيوب', 'إنستغرام', 'تيك توك', 'آيفون', 'بلايستيشن', 'نتفليكس', 'واتساب']
  },
  {
    title: 'السيارات والمواصلات',
    emoji: '🚗',
    items: ['مرسيدس', 'تويوتا لاندكروزر', 'طائرة', 'قطار سريع', 'سفينة', 'دراجة نارية', 'تسلا', 'تاكسي']
  },
  {
    title: 'الأفلام والكرتون',
    emoji: '🎬',
    items: ['توم وجيري', 'المحقق كونان', 'سبايدرمان', 'باتمان', 'الأسد الملك', 'سبونج بوب', 'هاري بوتر', 'تايتانيك']
  },
  {
    title: 'المشروبات والحلويات',
    emoji: '🥤',
    items: ['شاي عراقي', 'قهوة عربية', 'عصير رمان', 'آيس كريم', 'بقلاوة', 'كليچة', 'نوتيلا', 'كنافة']
  },
  {
    title: 'أشياء داخل البيت',
    emoji: '🏠',
    items: ['مكيّف', 'ثلاجة', 'غسالة', 'تلفزيون', 'مكنسة كهربائية', 'وسادة', 'مرآة', 'شاحن موبايل', 'مايكرويف', 'سجادة', 'ساعة حائط', 'مصباح']
  },
  {
    title: 'دول وجزر سياحية',
    emoji: '🏝️',
    items: ['المالديف', 'اليابان', 'سويسرا', 'إيطاليا', 'إسبانيا', 'جزيرة بالي', 'هاواي', 'قبرص', 'مالطا', 'مدغشقر', 'النرويج', 'المغرب']
  },
  {
    title: 'الفواكه والخضروات',
    emoji: '🍉',
    items: ['رقي (بطيخ)', 'رمان', 'فراولة', 'مانجو', 'موز', 'برتقال', 'تين', 'عنب', 'أناناس', 'تفاح أخضر', 'تمر برحي', 'كيوي']
  },
  {
    title: 'الألعاب الإلكترونية',
    emoji: '🎮',
    items: ['ببجي موبايل', 'ماينكرافت', 'فيفا', 'قراند GTA', 'فورتنايت', 'كول أوف ديوتي', 'كلاش رويال', 'كلاش أوف كلانس', 'روبلوكس', 'ماريو كارت']
  },
  {
    title: 'المواد الدراسية والتخصصات',
    emoji: '📚',
    items: ['الرياضيات', 'الفيزياء', 'الكيمياء', 'التاريخ', 'الجغرافيا', 'الأحياء', 'اللغة العربية', 'اللغة الإنجليزية', 'الطب العام', 'هندسة البرمجيات']
  },
  {
    title: 'أماكن عامة نروح لها',
    emoji: '🎢',
    items: ['المطار', 'المول التجاري', 'مدينة الألعاب', 'الشاطئ', 'المكتبة', 'الحلّاق', 'ملعب كرة القدم', 'الحديقة العامة', 'السينما', 'المتحف']
  },
  {
    title: 'الفضاء والطبيعة',
    emoji: '🌌',
    items: ['كوكب المريخ', 'كوكب زحل', 'القمر', 'الشمس', 'البركان', 'الشلال', 'قوس قزح', 'الثقب الأسود', 'الشفق القطبي', 'الصحراء']
  },
  {
    title: 'الملابس والإكسسوارات',
    emoji: '⌚',
    items: ['ساعة يد', 'نظارة شمسية', 'عطر فاخر', 'حذاء رياضي', 'دشداشة', 'عباية', 'جاكيت شتوي', 'خاتم فضة', 'حقيبة ظهر', 'قبعة']
  },
  {
    title: 'الرياضات الأولمبية',
    emoji: '🏅',
    items: ['السباحة', 'الملاكمة', 'التنس الأرضي', 'كرة السلة', 'ركوب الخيل', 'الجمباز', 'رفع الأثقال', 'سباق السيارات', 'الرماية بالسهام', 'الكاراتيه']
  }
];

export interface OOLGame {
  chatId: string;
  chatName: string;
  messageId?: number;
  inlineMessageId?: string;
  createdBy?: string;
  status: OOLStatus;
  players: OOLPlayer[];
  categoryTitle: string;
  categoryEmoji: string;
  secretWord: string;
  outsiderId: string;
  questionPairs: Array<[string, string]>;
  /** Randomized player ids used to run one clear question turn per player. */
  questionOrder?: string[];
  questionIndex?: number;
  votes: Record<string, string>;
  guessOptions: string[];
  caughtOutsider?: boolean;
  outsiderGuessedRight?: boolean;
  outsiderPick?: string;
  phaseDeadline?: number;
  rewarded?: boolean;
}

export const MIN_OOL_PLAYERS = 3;
export const MAX_OOL_PLAYERS = 10;
export const OOL_QUESTION_MS = 20_000;
export const OOL_VOTE_MS = 45_000;
export const OOL_GUESS_MS = 15_000;

const SEP = '━━━━━━━━━━━━━━━━━━━';

function oolMd(s: string): string {
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

export function createOOLLobby(chatId: string, chatName: string, createdBy?: string): OOLGame {
  return {
    chatId,
    chatName,
    createdBy,
    status: 'lobby',
    players: [],
    categoryTitle: '',
    categoryEmoji: '🎭',
    secretWord: '',
    outsiderId: '',
    questionPairs: [],
    questionOrder: [],
    questionIndex: 0,
    votes: {},
    guessOptions: []
  };
}

export function oolJoin(game: OOLGame, id: string, name: string): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') {
    return { ok: false, msg: '⚠️ الجولة بدأت بالفعل — انتظر الجولة القادمة.' };
  }
  if (game.players.some(p => p.id === id)) {
    return { ok: false, msg: '✅ إنت مسجّل بالفعل بالجولة!' };
  }
  if (game.players.length >= MAX_OOL_PLAYERS) {
    return { ok: false, msg: '⚠️ اكتمل الحد الأقصى للاعبين.' };
  }
  game.players.push({ id, name: name || 'لاعب', score: 0 });
  return { ok: true, msg: '✅ انضممت للعبة منو برا السالفة!' };
}

export function oolStart(game: OOLGame): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') {
    return { ok: false, msg: 'الجولة جارية بالفعل.' };
  }
  if (game.players.length < MIN_OOL_PLAYERS) {
    return {
      ok: false,
      msg: `⚠️ نحتاج على الأقل ${MIN_OOL_PLAYERS} لاعبين للبدء (الموجودون حالياً ${game.players.length}).`
    };
  }

  const cat = OOL_CATEGORIES[Math.floor(Math.random() * OOL_CATEGORIES.length)];
  const secret = cat.items[Math.floor(Math.random() * cat.items.length)];
  const outsider = game.players[Math.floor(Math.random() * game.players.length)];

  const order = shuffle(game.players);
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < order.length; i++) {
    const asker = order[i];
    const target = order[(i + 1) % order.length];
    pairs.push([asker.name, target.name]);
  }

  const others = shuffle(cat.items.filter(x => x !== secret)).slice(0, 7);
  game.categoryTitle = cat.title;
  game.categoryEmoji = cat.emoji;
  game.secretWord = secret;
  game.outsiderId = outsider.id;
  game.questionPairs = pairs;
  game.questionOrder = order.map(p => p.id);
  game.questionIndex = 0;
  game.votes = {};
  game.guessOptions = shuffle([secret, ...others]);
  game.status = 'questioning';
  game.phaseDeadline = Date.now() + OOL_QUESTION_MS;

  return { ok: true, msg: '🎭 بدأت الجولة! افتح الخاص لمعرفة وضعك، وابدأوا الأسئلة حسب الدور الظاهر.' };
}

export function oolCurrentQuestion(game: OOLGame): { index: number; total: number; asker: OOLPlayer; target: OOLPlayer } | null {
  const order = game.questionOrder || [];
  const index = game.questionIndex || 0;
  if (index >= order.length || order.length < 2) return null;
  const asker = game.players.find(p => p.id === order[index]);
  const target = game.players.find(p => p.id === order[(index + 1) % order.length]);
  if (!asker || !target) return null;
  return { index, total: order.length, asker, target };
}

/** Advance after the named asker has asked and received an answer; timer may advance automatically. */
export function oolAdvanceQuestion(
  game: OOLGame,
  actorId?: string,
  now = Date.now()
): { ok: boolean; msg: string; allDone: boolean } {
  if (game.status !== 'questioning') {
    return { ok: false, msg: 'انتهت مرحلة الأسئلة.', allDone: false };
  }
  const current = oolCurrentQuestion(game);
  if (!current) {
    game.status = 'voting';
    game.phaseDeadline = now + OOL_VOTE_MS;
    return { ok: true, msg: '🗳️ انتهت الأسئلة، بدأ التصويت!', allDone: true };
  }
  if (actorId && actorId !== current.asker.id) {
    return { ok: false, msg: `⏳ الدور على ${current.asker.name} حتى يسأل ${current.target.name}.`, allDone: false };
  }

  game.questionIndex = current.index + 1;
  if (game.questionIndex >= current.total) {
    game.status = 'voting';
    game.votes = {};
    game.phaseDeadline = now + OOL_VOTE_MS;
    return { ok: true, msg: '✅ خلصت الأسئلة — هسه صوّتوا على اللي تشكّون بيه!', allDone: true };
  }

  game.phaseDeadline = now + OOL_QUESTION_MS;
  const next = oolCurrentQuestion(game);
  return {
    ok: true,
    msg: next ? `✅ تم السؤال — هسه ${next.asker.name} يسأل ${next.target.name}.` : '✅ انتقل الدور للسؤال التالي.',
    allDone: false
  };
}

export function oolSecretPopup(game: OOLGame, playerId: string): string {
  const me = game.players.find(p => p.id === playerId);
  if (!me) return '⚠️ إنت مو مشارك بهذه الجولة.';
  if (playerId === game.outsiderId) {
    return (
      `🕵️ إنت «برا السالفة»!\n` +
      `📂 الصنف: ${game.categoryTitle}\n` +
      `🎤 تابع الأسئلة باللوحة وجاوب بشكل طبيعي، وحاول تعرف الكلمة من إجاباتهم!`
    );
  }
  return (
    `✅ إنت داخل السالفة!\n` +
    `📂 الصنف: ${game.categoryTitle}\n` +
    `🔑 السالفة السرية: «${game.secretWord}»\n` +
    `🤫 من يطلع اسمك باللوحة، اسأل اللاعب المحدد سؤالاً عن الصنف بدون ما تذكر الكلمة.`
  );
}

export function oolVote(
  game: OOLGame,
  voterId: string,
  targetIdx: number
): { ok: boolean; msg: string; allVoted: boolean } {
  if (game.status !== 'voting') {
    return { ok: false, msg: 'انتهت مرحلة التصويت.', allVoted: false };
  }
  const voter = game.players.find(p => p.id === voterId);
  if (!voter) {
    return { ok: false, msg: '⚠️ التصويت للمشاركين بالجولة فقط.', allVoted: false };
  }
  const target = game.players[targetIdx];
  if (!target) {
    return { ok: false, msg: 'اختيار غير صالح.', allVoted: false };
  }
  if (target.id === voterId) {
    return { ok: false, msg: '😅 ما يصير تصوّت على نفسك! اختار مشتبه به ثاني.', allVoted: false };
  }

  game.votes[voterId] = target.id;
  const allVoted = game.players.every(p => Boolean(game.votes[p.id]));
  return { ok: true, msg: `🗳️ صوّتت على ${target.name}`, allVoted };
}

/** حسم التصويت والانتقال لمرحلة تخمين السالفة (15 ثانية للي برا السالفة) */
export function oolFinishVoting(game: OOLGame) {
  if (game.status !== 'voting') return;

  const tally = new Map<string, number>();
  for (const [voterId, suspectId] of Object.entries(game.votes)) {
    tally.set(suspectId, (tally.get(suspectId) || 0) + 1);
    if (suspectId === game.outsiderId) {
      const voter = game.players.find(p => p.id === voterId);
      if (voter) voter.score += 1;
    }
  }

  let topId = '';
  let topCount = 0;
  let tied = false;
  for (const [pid, count] of tally.entries()) {
    if (count > topCount) {
      topCount = count;
      topId = pid;
      tied = false;
    } else if (count === topCount && count > 0) {
      tied = true;
    }
  }

  const caught = !tied && topId === game.outsiderId;
  game.caughtOutsider = caught;
  if (!caught) {
    const out = game.players.find(p => p.id === game.outsiderId);
    if (out) out.score += 2;
  }

  game.status = 'guessing';
  game.phaseDeadline = Date.now() + OOL_GUESS_MS;
}

/** تخمين اللي برا السالفة للكلمة السرية */
export function oolOutsiderGuess(
  game: OOLGame,
  userId: string,
  optIdx: number
): { ok: boolean; msg: string } {
  if (game.status !== 'guessing') {
    return { ok: false, msg: 'انتهى وقت التخمين.' };
  }
  if (userId !== game.outsiderId) {
    return { ok: false, msg: '🤫 هذا الدور مخصّص للاعب اللي «برا السالفة» فقط!' };
  }
  const picked = game.guessOptions[optIdx];
  if (!picked) {
    return { ok: false, msg: 'خيار غير صالح.' };
  }

  game.outsiderPick = picked;
  game.outsiderGuessedRight = picked === game.secretWord;
  if (game.outsiderGuessedRight) {
    const out = game.players.find(p => p.id === game.outsiderId);
    if (out) out.score += 2;
  }
  game.status = 'finished';
  game.phaseDeadline = undefined;
  return {
    ok: true,
    msg: game.outsiderGuessedRight ? '🎯 عاشت إيدك! عرفت السالفة الصح (+2 نقطة)!' : `❌ خطأ! السالفة كانت: ${game.secretWord}`
  };
}

export function oolTimeoutGuess(game: OOLGame) {
  if (game.status !== 'guessing') return;
  game.outsiderGuessedRight = false;
  game.status = 'finished';
  game.phaseDeadline = undefined;
}

/** عرض لوحة «منو برا السالفة؟» بالقناة بصيغة MarkdownV2 جاهزة */
export function renderOOLBoard(game: OOLGame): string {
  const lines: string[] = [];

  if (game.status === 'lobby') {
    lines.push(`🎭 *منو برا السالفة؟*`);
    lines.push(SEP);
    lines.push(`👥 *المنضمون:* *${game.players.length}* من *${MAX_OOL_PLAYERS}*`);
    if (game.players.length > 0) {
      lines.push('');
      lines.push(
        game.players
          .map((p, i) => `> ${i + 1} \\- \\| *${oolMd(p.name)}* \\|`)
          .join('\n')
      );
    }
    return lines.join('\n');
  }

  if (game.status === 'questioning') {
    const current = oolCurrentQuestion(game);
    lines.push(`🎭 *مرحلة الأسئلة — منو برا السالفة؟*`);
    lines.push(`${game.categoryEmoji} *الصنف:* *${oolMd(game.categoryTitle)}*`);
    lines.push(SEP);
    if (current) {
      lines.push(`❓ *السؤال ${current.index + 1} من ${current.total}*`);
      lines.push(`> \\| *${oolMd(current.asker.name)}* \\| يسأل \\| *${oolMd(current.target.name)}* \\|`);
      lines.push('');
      lines.push(`1\\. *${oolMd(current.asker.name)}:* اسأل سؤالاً واحداً عن الصنف، بدون ذكر الكلمة السرية\\.`);
      lines.push(`2\\. *${oolMd(current.target.name)}:* جاوب بشكل طبيعي بدون ما تفضح السالفة\\.`);
      lines.push(SEP);
      lines.push(`⏳ عندكم 20 ثانية\\. بعد الجواب، ${oolMd(current.asker.name)} يضغط «✅ خلص السؤال» حتى ينتقل الدور\\.`);
    } else {
      lines.push(`✅ اكتملت الأسئلة — بدأ التصويت\\!`);
    }
    return lines.join('\n');
  }

  if (game.status === 'voting') {
    lines.push(`🎭 *مرحلة التصويت — منو برا السالفة؟*`);
    lines.push(`${game.categoryEmoji} *الصنف:* *${oolMd(game.categoryTitle)}*`);
    lines.push(SEP);
    lines.push(`🗳️ *اختاروا الشخص اللي تشكّون بيه:*`);
    lines.push(`كل لاعب يصوّت على شخص واحد\\. ما يصير تصوّت على نفسك\\.`);
    lines.push(SEP);
    lines.push(`🗳️ *حالة التصويت:*`);
    lines.push(
      game.players
        .map((p, i) => {
          const done = Boolean(game.votes[p.id]);
          return `> ${i + 1} \\- \\| *${oolMd(p.name)}* \\| ${done ? '✅' : '⏳'}`;
        })
        .join('\n')
    );
    lines.push(`👇 _اضغط «🔒 اكشف السالفة» لمعرفة الكلمة، ثم صوّت على المشتبه به\\!_`);
    return lines.join('\n');
  }

  const outsider = game.players.find(p => p.id === game.outsiderId);

  if (game.status === 'guessing') {
    lines.push(`🎭 *كشف الهوية — منو برا السالفة؟*`);
    lines.push(SEP);
    lines.push(`🕵️ *اللي برا السالفة طلع:*`);
    lines.push(`> \\| *${oolMd(outsider?.name || 'لاعب')}* \\|`);
    lines.push(
      game.caughtOutsider
        ? `✅ *كشفتوه بالتصويت\\!* \\(\\+1 نقطة لكل من صوّت عليه\\)`
        : `😈 *خدعكم وما قدرتوا تكشفوه\\!* \\(\\+2 نقطة له\\)`
    );
    lines.push(SEP);
    lines.push(`🎯 *فرصة أخيرة للي برا السالفة \\(15 ثانية\\):*`);
    lines.push(`شنو تتوقع كانت السالفة السرية ضمن *${oolMd(game.categoryTitle)}*؟`);
    return lines.join('\n');
  }

  // 🏁 النهاية والترتيب
  const sorted = game.players.slice().sort((a, b) => b.score - a.score);
  lines.push(`🏁 *انتهت جولة منو برا السالفة\\!*`);
  lines.push(SEP);
  lines.push(`🔑 *السالفة السرية كانت:* *${oolMd(game.secretWord)}* \\(${oolMd(game.categoryTitle)}\\)`);
  lines.push(`🕵️ *اللي برا السالفة:*`);
  lines.push(`> \\| *${oolMd(outsider?.name || 'لاعب')}* \\|`);
  lines.push(
    game.outsiderGuessedRight
      ? `🎯 *عرف السالفة السرية بالفرصة الأخيرة\\!* \\(\\+2 نقطة\\)`
      : `❌ *ما عرف السالفة السرية بالفرصة الأخيرة*`
  );
  lines.push(SEP);
  lines.push(`🏆 *النقاط النهائية:*`);
  lines.push(
    sorted
      .map((p, i) => `> ${i + 1} \\- \\| *${oolMd(p.name)}* \\| \\(p ${p.score}\\)`)
      .join('\n')
  );
  return lines.join('\n');
}

export function oolBoardKeyboard(game: OOLGame): any[][] {
  const rows: any[][] = [];

  if (game.status === 'lobby') {
    if (game.players.length < MAX_OOL_PLAYERS) {
      rows.push([{ text: 'انضم', callback_data: `ool:j:${game.chatId}` }]);
    }
    if (game.players.length >= MIN_OOL_PLAYERS) {
      rows.push([{ text: '🚀 ابدأ اللعبة', callback_data: `ool:s:${game.chatId}` }]);
    }
    return rows;
  }

  if (game.status === 'questioning') {
    rows.push([{ text: '🔒 اكشف السالفة', callback_data: `ool:sec:${game.chatId}` }]);
    if (oolCurrentQuestion(game)) {
      rows.push([{ text: '✅ خلص السؤال — انتقل للتالي', callback_data: `ool:q:${game.chatId}` }]);
    }
    return rows;
  }

  if (game.status === 'voting') {
    rows.push([{ text: '🔒 اكشف السالفة', callback_data: `ool:sec:${game.chatId}` }]);
    for (let i = 0; i < game.players.length; i += 2) {
      const pair: any[] = [];
      pair.push({ text: `🗳️ ${game.players[i].name}`, callback_data: `ool:v:${game.chatId}:${i}` });
      if (game.players[i + 1]) {
        pair.push({ text: `🗳️ ${game.players[i + 1].name}`, callback_data: `ool:v:${game.chatId}:${i + 1}` });
      }
      rows.push(pair);
    }
    return rows;
  }

  if (game.status === 'guessing') {
    for (let i = 0; i < game.guessOptions.length; i += 2) {
      const pair: any[] = [];
      pair.push({ text: game.guessOptions[i], callback_data: `ool:g:${game.chatId}:${i}` });
      if (game.guessOptions[i + 1]) {
        pair.push({ text: game.guessOptions[i + 1], callback_data: `ool:g:${game.chatId}:${i + 1}` });
      }
      rows.push(pair);
    }
    return rows;
  }

  return [[{ text: '🔄 لعبة جديدة', callback_data: `ool:n:${game.chatId}` }]];
}
