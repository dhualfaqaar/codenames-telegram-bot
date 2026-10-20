/**
 * 💵 اقتصاد البوت: «فلوس» غالية + «مستوى» أونلاين.
 *
 * القواعد اللي ماشي عليها النظام:
 *  1. الفلوس والمستوى **بس** من الألعاب اللي تنلعب مع ناس حقيقيين (أونلاين).
 *     لعبة البوت (خمّن الكلمة / خمّن الشاعر) ما تزيد لا فلوس ولا مستوى
 *     ولا إحصائيات ولا أي شي ثاني — صفر لكل شي.
 *  2. العملة «غالية»: المبالغ كلش صغيرة (تتنقرأ بثلاث خانات عشرية) واكو
 *     سقف يومي للربح، حتى ما تصير الفلوس رخيصة وما تفقد قيمتها.
 *  3. الفلوس تعتمد على أداء اللاعب نفسه: اثنين يفوزون بنفس المباراة
 *     وياخذون مبالغ مختلفة — الأفضل أداءً ياخذ أكثر.
 *  4. الخصوم الأقوى مستوىً يدفعون أكثر (كل ما فزت على مستوى أعلى منك، ربحك أكثر).
 *  5. الخبرة (XP) ذكية:
 *     - اللعبة المعقدة/القوية تعطي أكثر، والبسيطة تعطي 3 أو 4 بس،
 *       وأقصى خبرة لفوز واحد ما تتجاوز *15* (حد أقصى).
 *     - الإبداع والدقة ترفع الخبرة: كل ما لعبت أحسن، خبرتك أكثر
 *       (الحد الأعلى للخبرة = winXp، يوصله بس مع أداء كامل).
 *     - كل ما زاد مستواك، يزيد الخبرة المطلوب للوصول للمستوى اللي بعده.
 */

export interface GameEconomy {
  /** أعلى مبلغ ياخذه الفائز بهاي اللعبة */
  maxMoney: number;
  /** أقصى خبرة لفوز واحد (حد الأعلى — الحد الأدنى يجي حسب الأداء) */
  winXp: number;
  /** خبرة الخسارة/المشاركة (المشاركة تكفي ليزيد مستواك) */
  loseXp: number;
  /** تنلعب مع ناس حقيقيين؟ */
  online: boolean;
  /** وصف مختصر يبين باللعبة */
  note: string;
}

/** ⛔ أقصى ربح يومي للاعب الواحد — حتى يبقى الاقتصاد متوازن وصعب */
export const DAILY_MONEY_CAP = 0.25;

/** ✊ مكافأة الفوز بمباراة حجرة ورقة مقص (ضئيلة جداً) */
export const RPS_REWARD = 0.001;
/** ✊ أقصى ربح يومي من حجرة ورقة مقص لحالها */
export const RPS_DAILY_CAP = 0.01;
/** ✊ خبرة الفوز بمباراة حجرة ورقة مقص */
export const RPS_XP = 4;

/**
 * بأي ألعاب تزيد الفلوس/المستوى وكم.
 * ترتيب الخبرة: اللعبة المعقدة > المتوسطة > البسيطة (3 أو 4 بس)،
 * وأعلى خبرة لفوز واحد = 15.
 */
export const GAME_ECONOMY: Record<string, GameEconomy> = {
  // 🎮 لعبة قوية ومعقدة (فريق + جاسوس + تلميحات) — الأعلى = 15
  codenames: {
    maxMoney: 0.06,
    winXp: 15,
    loseXp: 6,
    online: true,
    note: 'الفائز ياخذ *0.012 – 0.06* 💵 حسب أداءه'
  },
  // 🧠 متوسطة — ألعاب كلمات مع البوت: نقاط بس
  rhyme: {
    maxMoney: 0,
    winXp: 0,
    loseXp: 0,
    online: false,
    note: 'لكل كلمة صح *+2* نقطة'
  },
  // 📏 متوسطة — ألعاب كلمات مع البوت: نقاط بس
  longest: {
    maxMoney: 0,
    winXp: 0,
    loseXp: 0,
    online: false,
    note: 'الفوز *+8* نقاط'
  },
  // 🔢 خفيفة — مع البوت: نقاط بس
  math: {
    maxMoney: 0,
    winXp: 0,
    loseXp: 0,
    online: false,
    note: 'الفوز *+10* نقاط'
  },
  // ✊ بسيطة وحظّية — فلوس ضئيلة جداً وبشرط
  rps: {
    maxMoney: 0.003,
    winXp: 4,
    loseXp: 2,
    online: true,
    note: 'لعبة بسيطة — الفائز ياخذ *0.001* 💵 بس، وبحد يومي صغير'
  },
  // 🤝 منو يعرف الثاني أكثر — تحدي ثنائي بالخاص والقناة
  who_knows: {
    maxMoney: 0.018,
    winXp: 10,
    loseXp: 5,
    online: true,
    note: 'الفائز ياخذ فلوس وخبرة حسب عدد البطاقات الصحيحة'
  },
  // 🕵️ الكلمة الغريبة
  odd_word: {
    maxMoney: 0.015,
    winXp: 8,
    loseXp: 3,
    online: true,
    note: '+10 نقاط بالخاص أو جوائز وخبرة بالقناة'
  },

  // ── ألعاب البوت: صفر لكل شي (بلا فلوس بلا مستوى بلا إحصائيات أونلاين) ──
  wordle: { maxMoney: 0, winXp: 0, loseXp: 0, online: false, note: '' },
  poet: { maxMoney: 0, winXp: 0, loseXp: 0, online: false, note: '' },
  guess_player: {
    maxMoney: 0.012,
    winXp: 8,
    loseXp: 3,
    online: true,
    note: 'من يخمن أول يفوز — *0.003 – 0.012* 💵'
  },
  guess_song: { maxMoney: 0, winXp: 0, loseXp: 0, online: false, note: '' },
  group_quiz: {
    maxMoney: 0.015,
    winXp: 8,
    loseXp: 3,
    online: true,
    note: 'المتصدر بالنهاية ياخذ *0.004 – 0.015* 💵'
  },
  mastermind: {
    maxMoney: 0.02,
    winXp: 10,
    loseXp: 4,
    online: true,
    note: 'كاسر الرقم السري ياخذ *0.006 – 0.02* 💵'
  }
};

/** سطر «الفلوس» اللي يبين بصفحة اللعبة */
export function moneyNote(gameId: string): string {
  const eco = GAME_ECONOMY[gameId];
  if (!eco) return '';
  // 🎯 ألعاب النقاط مع البوت (نقاط بس — بلا فلوس وبلا مستوى)
  const pointGames: Record<string, string> = {
    wordle: 'حلّ الكلمة *+?* نقطة',
    poet: 'اعرف الشاعر *+?* نقطة',
    rhyme: 'لكل كلمة صح *+2* نقطة',
    longest: 'الفوز *+8* نقاط',
    math: 'الفوز *+10* نقاط',
    guess_song: 'عرف الأغنية بأقل محاولات = نقاط أكثر'
  };
  if (pointGames[gameId]) {
    return (
      `⭐ النقاط: ${pointGames[gameId]}\n` +
      `💰 الفلوس والمستوى: 🚫 ما يزيدون من لعبة البوت\n` +
      `_الفلوس والمستوى من الألعاب اللي مع *ناس حقيقيين* بس_`
    );
  }
  if (!eco.online) {
    return '💰 الفلوس والمستوى: من الألعاب اللي مع *ناس حقيقيين* بس 🚫 (لعبة البوت ما تزيدهم)';
  }
  return (
    `💰 الفلوس: ${eco.note}\n` +
    `🎖️ المستوى: يزيد بكل مباراة أونلاين (فوز أو خسارة)\n` +
    `✨ الخبرة: لغاية *${eco.winXp}* XP للفوز — حسب أدائك وإبداعك`
  );
}

// ─────────────────────────── المستوى ───────────────────────────

/**
 * مجموع الخبرة المطلوب للوصول للمستوى (المستوى 1 = صفر).
 * القاعدة الصعبة: كل مستوى يحتاج خبرة أكثر بكثير من اللي قبله،
 * حتى توصل للمستويات العالية بصعوبة وبجهد طويل:
 * المستوى 2 = 80 • 3 = 240 • 4 = 480 • 5 = 800 • وهكذا (تدرّج حاد).
 */
export function xpForLevel(level: number): number {
  const l = Math.max(0, level);
  return 40 * l * (l - 1);
}

/** المستوى حسب مجموع الخبرة */
export function levelFromXp(xp: number): number {
  const value = Math.max(0, xp || 0);
  let level = 1;
  while (level < 99 && value >= xpForLevel(level + 1)) level++;
  return level;
}

/** تفاصيل التقدّم داخل المستوى */
export function levelProgress(xp: number): {
  level: number;
  into: number;
  span: number;
  left: number;
} {
  const value = Math.max(0, xp || 0);
  const level = levelFromXp(value);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, into: value - base, span: Math.max(1, next - base), left: next - value };
}

/** لقب المستوى — حتى يبين المستوى ألطف */
export function levelTitle(level: number): string {
  if (level >= 15) return 'أسطورة';
  if (level >= 10) return 'خبير';
  if (level >= 6) return 'محترف';
  if (level >= 3) return 'لاعب';
  return 'مبتدئ';
}

/**
 * 🗣️ تعليق بسيط على حالة اللاعب (فلوس + مستوى).
 * قصير وبلا مبالغة — كل حالة إلها جملة وحدة بس.
 * ملاحظة: الجملة تنعرض بخط مائل، فما بيها رموز ماركداون.
 */
export function walletVibe(opts: {
  level: number;
  money: number;
  onlineGames: number;
  wins: number;
}): string {
  const level = opts.level || 1;
  const money = opts.money || 0;
  const games = opts.onlineGames || 0;
  const wins = opts.wins || 0;

  // بعد ما لعب ولا مباراة أونلاين
  if (!games) return 'بعدك ما نزلت مباراة مع ناس — أول مباراة تسجّل اسمك ✍️';

  const pro = level >= 10;
  const richWallet = money >= 5;

  // أعلى المستويات: تعليق مضحك خفيف
  if (level >= 15) {
    return richWallet ? 'شنو اترو؟ 😳 أسطورة وعنده ثروة' : 'شنو اترو؟ 😳 هذا مو مستوى، هذا أسطورة';
  }
  if (pro) {
    return richWallet ? 'شنو اترو؟ 😳 خبير وعنده فلوس' : 'شنو اترو؟ 😳 مستوى عالي ومحد يلحقك';
  }
  // رصيد كبير
  if (money >= 15) return 'هذا مو رصيد، هذا ثروة 🤑';
  if (richWallet) return 'يا غني 🤑';
  if (level >= 6) return 'محترف — الأرقام تحچي عنك 🎯';
  if (level >= 3) return 'مستواك يصعد 📈 كمّل';
  if (money > 0) return 'عندك فلوس — وهذي عملة غالية 😌';
  if (wins === 0) return 'بلا فوز بعد — أول واحد أحلى واحد 💪';
  return 'تمشي الحال 🙂';
}

// ─────────────────────────── الفلوس ───────────────────────────

/** الفلوس بثلاث خانات عشرية بس (العملة غالية) */
export function roundMoney(value: number): number {
  return Math.round((value || 0) * 1000) / 1000;
}

/** صيغة عرض الفلوس: 0.011 / 0.42 / 1 */
export function formatMoney(value: number): string {
  const r = roundMoney(value);
  const out = r.toFixed(3).replace(/\.?0+$/, '');
  return out === '' ? '0' : out;
}

/**
 * فلوس الفوز: تجمع بين أداء اللاعب، فرق المستوى مع الخصوم، والسقف اليومي.
 * ترجع 0 إذا اللعبة مو أونلاين، أو إذا وصل السقف اليومي.
 */
export function moneyForWin(opts: {
  gameId: string;
  /** أداء اللاعب 0..1 (أفضل لاعب بالفريق = 1) */
  performance: number;
  /** مستوى اللاعب */
  level: number;
  /** متوسط مستوى الخصوم */
  opponentLevel: number;
  /** كم ربح اليوم قبل هاي المباراة */
  earnedToday: number;
}): number {
  const eco = GAME_ECONOMY[opts.gameId];
  if (!eco || !eco.online || eco.maxMoney <= 0) return 0;

  const performance = Math.min(1, Math.max(0.35, opts.performance || 0));
  // فزت على ناس أعلى منك مستوى؟ ربحك أكثر (وبالعكس أقل شوية)
  const gap = Math.min(0.35, Math.max(-0.3, ((opts.opponentLevel || 1) - (opts.level || 1)) * 0.05));

  // maxMoney هو سقف اللعبة المطلق — نوصله بس بأعلى أداء وأقوى خصم
  const base = eco.maxMoney / 1.35;
  const money = Math.min(roundMoney(base * performance * (1 + gap)), eco.maxMoney);
  const room = roundMoney(Math.max(0, DAILY_MONEY_CAP - (opts.earnedToday || 0)));
  return Math.max(0, Math.min(money, room));
}

/**
 * خبرة المباراة — ذكية حسب الأداء:
 *  - أداء كامل (إبداع ودقة وتخمينات صحيحة) = أقصى خبرة للعبة (winXp/loseXp).
 *  - أداء أقل = خبرة أقل، لكن الحد الأدنى محفوظ.
 *  - وما تتجاوز أبداً الحد الأعلى المكتوب للعبة (أقصى شي 15).
 *  - مع البوت: صفر (لا خبرة ولا أي شي).
 */
export function xpForResult(gameId: string, won: boolean, performance = 1): number {
  const eco = GAME_ECONOMY[gameId];
  if (!eco || !eco.online) return 0;

  const base = won ? eco.winXp : eco.loseXp;
  if (!base) return 0;

  const perf = Math.min(1, Math.max(0, performance || 0));
  const factor = won ? 0.65 + 0.35 * perf : 0.7 + 0.3 * perf;
  return Math.max(1, Math.round(base * factor));
}

/** مفتاح اليوم (بتوقيت بغداد UTC+3) — للسقف اليومي */
export function dayKey(now: number = Date.now()): string {
  return new Date(now + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/** كم ربح اللاعب اليوم (يرجّع صفر إذا مضى اليوم) */
export function earnedToday(rec: { earnDay?: string; earnedToday?: number }, now: number = Date.now()): number {
  if (!rec || rec.earnDay !== dayKey(now)) return 0;
  return rec.earnedToday || 0;
}

/** تحديث ربح اليوم بعد إضافة مبلغ */
export function addEarned(
  rec: { earnDay?: string; earnedToday?: number },
  amount: number,
  now: number = Date.now()
): void {
  const day = dayKey(now);
  if (rec.earnDay !== day) {
    rec.earnDay = day;
    rec.earnedToday = 0;
  }
  rec.earnedToday = roundMoney((rec.earnedToday || 0) + amount);
}
