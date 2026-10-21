/**
 * 🤝 لعبة «منو يعرف الثاني أكثر؟»
 *
 * 1) اللوبي بالقناة/المجموعة: ينضم لاعبان بزر «انضم».
 * 2) المرحلة الأولى بالخاص (كتابة نصية حرة):
 *    يسأل البوت كل مشارك أسئلة شخصية (أكلتك المفضلة، لونك المفضل…)، ويكتب اللاعب جوابه بنفسه.
 *    يقوم البوت بتصحيح الأخطاء الإملائية العربية تلقائياً وحفظ الجواب السري المصحّح.
 * 3) المرحلة الثانية بالخاص (رسالة واحدة تتحدّث بمكانها):
 *    يعرض البوت للطرف الثاني 4 خيارات من نفس صنف السؤال (الجواب الحقيقي الذي كتبه المقابل + 3 إجابات خاطئة من نفس التصنيف)،
 *    وتتعدل نفس الرسالة تلقائياً مع كل سؤال بدون إرسال رسائل متكررة.
 * 4) النهاية:
 *    - بالخاص: يُرسل «كشف البطاقات 🃏» الكامل والمفصّل لكلا المشاركين.
 *    - بالقناة: تتحدّث لوحة القناة بنتيجة بسيطة ومرتبة للطرفين (فلان — X/6 حزر من أشياء فلان).
 */

export interface WKQuestion {
  id: string;
  emoji: string;
  shortLabel: string;
  askSelf: string;
  askGuess: string;
  /** بنك واسع من نفس صنف السؤال لتوليد 3 خيارات خاطئة متجانسة + التصحيح الإملائي */
  categoryPool: string[];
}

export const WK_QUESTIONS: WKQuestion[] = [
  {
    id: 'food',
    emoji: '🍽️',
    shortLabel: 'الأكلة المفضلة',
    askSelf: 'اكتب أكلتك المفضلة وأرسلها لي:',
    askGuess: 'شنو أكلته/أكلتها المفضلة برأيك؟',
    categoryPool: [
      'دولمة', 'برياني', 'شاورما', 'بيتزا', 'مسگوف', 'برجر', 'كباب', 'قوزي',
      'كبة', 'تكة', 'باچة', 'مندي', 'كبسة', 'مقلوبة', 'منسف', 'معكرونة',
      'لازانيا', 'إندومي', 'فلافل', 'كشري', 'ورق عنب', 'بروستد', 'سوشي',
      'ستيك', 'فاهيتا', 'سمك مشوي', 'تشريب لحم', 'تمن وقيمة', 'تمن باقلاء'
    ]
  },
  {
    id: 'color',
    emoji: '🎨',
    shortLabel: 'اللون المفضل',
    askSelf: 'اكتب لونك المفضل وأرسله لي:',
    askGuess: 'شنو لونه/لونها المفضل برأيك؟',
    categoryPool: [
      'أسود', 'أبيض', 'أزرق', 'أحمر', 'أخضر', 'أصفر', 'بنفسجي', 'وردي',
      'برتقالي', 'رمادي', 'بني', 'بيج', 'كحلي', 'سمائي', 'ماروني', 'ذهبي',
      'فضي', 'زيتوني', 'تركوازي'
    ]
  },
  {
    id: 'drink',
    emoji: '🥤',
    shortLabel: 'المشروب المفضل',
    askSelf: 'اكتب مشروبك المفضل وأرسله لي:',
    askGuess: 'شنو مشروبه/مشروبها المفضل برأيك؟',
    categoryPool: [
      'شاي', 'قهوة', 'نسكافيه', 'كابتشينو', 'لاتيه', 'إسبريسو', 'ماتشا',
      'عصير برتقال', 'عصير ليمون', 'عصير رمان', 'عصير مانجو', 'عصير فراولة',
      'موهيتو', 'بيبسي', 'كولا', 'حليب', 'لبن عيران', 'شاي مثلج', 'ميلك شيك'
    ]
  },
  {
    id: 'time',
    emoji: '🌙',
    shortLabel: 'الوقت المفضل',
    askSelf: 'اكتب وقتك المفضل باليوم وأرسله لي:',
    askGuess: 'شنو وقته/وقتها المفضل باليوم؟',
    categoryPool: [
      'آخر الليل', 'منتصف الليل', 'الفجر', 'الصباح الباكر', 'الضحى',
      'الظهر', 'العصر', 'وقت الغروب', 'المغرب', 'المساء', 'أول الليل'
    ]
  },
  {
    id: 'travel',
    emoji: '✈️',
    shortLabel: 'وجهة السفر',
    askSelf: 'اكتب الدولة أو المدينة اللي تتمنى تسافرلها:',
    askGuess: 'شنو الدولة أو المدينة اللي يتمنى/تتمنى يسافرلها؟',
    categoryPool: [
      'تركيا', 'اليابان', 'إيطاليا', 'سويسرا', 'السعودية', 'إسبانيا',
      'ألمانيا', 'فرنسا', 'بريطانيا', 'أمريكا', 'كندا', 'كوريا الجنوبية',
      'روسيا', 'الإمارات', 'مصر', 'لبنان', 'المغرب', 'المالديف',
      'ماليزيا', 'تايلاند', 'اليونان', 'النرويج', 'النمسا', 'هولندا'
    ]
  },
  {
    id: 'movies',
    emoji: '🎬',
    shortLabel: 'تصنيف الأفلام',
    askSelf: 'اكتب نوع الأفلام أو المسلسلات المفضل عندك:',
    askGuess: 'شنو نوع الأفلام أو المسلسلات المفضل عنده/عندها؟',
    categoryPool: [
      'أكشن', 'رعب', 'كوميدي', 'غموض وتحقيق', 'خيال علمي', 'دراما',
      'رومانسي', 'تاريخي', 'أنمي', 'وثائقي', 'مغامرات', 'جريمة وإثارة', 'فانتازيا'
    ]
  },
  {
    id: 'season',
    emoji: '🌦️',
    shortLabel: 'الفصل المفضل',
    askSelf: 'اكتب فصلك المفضل بالسنة وأرسله لي:',
    askGuess: 'شنو فصله/فصلها المفضل بالسنة؟',
    categoryPool: ['الشتاء', 'الربيع', 'الصيف', 'الخريف']
  },
  {
    id: 'sweet',
    emoji: '🍰',
    shortLabel: 'الحلويات المفضلة',
    askSelf: 'اكتب نوع الحلويات المفضل عندك وأرسله لي:',
    askGuess: 'شنو نوع الحلويات المفضل عنده/عندها؟',
    categoryPool: [
      'بقلاوة', 'كنافة', 'كيك شوكولاتة', 'آيس كريم', 'داطلي', 'تشيز كيك',
      'كليچة', 'زلابية', 'بسبوسة', 'كريب', 'وافل', 'بان كيك',
      'دونات', 'تيراميسو', 'محلبية', 'أم علي', 'شوكولاتة'
    ]
  },
  {
    id: 'place',
    emoji: '🏞️',
    shortLabel: 'المكان المفضل',
    askSelf: 'اكتب مكانك المفضل للطلعة أو الاسترخاء:',
    askGuess: 'شنو مكانه/مكانها المفضل للطلعة أو الاسترخاء؟',
    categoryPool: [
      'البيت', 'الكافيه', 'البحر', 'الجبل', 'المول', 'الحديقة',
      'السينما', 'المطعم', 'الكورنيش', 'المزرعة', 'المكتبة', 'النادي الرياضي', 'السطح'
    ]
  },
  {
    id: 'mood',
    emoji: '😌',
    shortLabel: 'وقت الضوجة',
    askSelf: 'اكتب أول شغلة تسويها وقت الضوجة أو الملل:',
    askGuess: 'شنو أول شغلة يسويها/تسويها وقت الضوجة؟',
    categoryPool: [
      'النوم', 'الأكل', 'التصفح بالموبايل', 'سماع الموسيقى', 'الطلعة',
      'اللعب', 'مشاهدة فيلم', 'شرب الشاي أو القهوة', 'مراسلة الأصدقاء',
      'المشي', 'قراءة كتاب', 'الرسم', 'الطبخ', 'ممارسة الرياضة'
    ]
  }
];

export const WK_TOTAL_CARDS = 6;
const SEP = '━━━━━━━━━━━━━━━━━━━';

export interface WKPlayer {
  id: string;
  name: string;
  /** إجابات اللاعب عن نفسه بعد التصحيح الإملائي */
  answers: string[];
  /** مجموعات الخيارات الـ 4 المجهّزة لمرحلة التخمين (جواب المقابل الحقيقي + 3 خيارات خاطئة من نفس الصنف) */
  choiceSets?: string[][];
  /** تخمينات اللاعب لإجابات الطرف الثاني */
  guesses: string[];
  /** نتائج مطابقة تخميناته لإجابات الطرف الثاني */
  hits: boolean[];
  /** مجموع ما عرفه صح عن الطرف الثاني */
  score: number;
  /** فتح الخاص مع البوت؟ */
  dmReady?: boolean;
  /** معرّف رسالة التخمين بالخاص لتحديثها بمكانها بدل إرسال رسائل متكررة */
  guessMsgId?: number;
}

export interface WKGame {
  id: string;
  chatId: string;
  chatTitle: string;
  messageId?: number;
  inlineMessageId?: string;
  status: 'lobby' | 'answering' | 'guessing' | 'game_over';
  questions: WKQuestion[];
  players: WKPlayer[];
  winnerId?: string; // undefined عند التعادل
  rewarded?: boolean;
  createdAt: number;
  updatedAt: number;
}

export function wkMd(s: string): string {
  return String(s || '').replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** قاموس التصحيح الإملائي واللهجي للكلمات الشائعة */
const SPELLING_CANONICAL: Record<string, string> = {
  // أكلات
  دولمه: 'دولمة',
  دولما: 'دولمة',
  بيتزه: 'بيتزا',
  بيزا: 'بيتزا',
  شاورمه: 'شاورما',
  شورما: 'شاورما',
  مسكوف: 'مسگوف',
  مسقوف: 'مسگوف',
  بركر: 'برجر',
  برقر: 'برجر',
  برغر: 'برجر',
  همبركر: 'برجر',
  همبرجر: 'برجر',
  كبه: 'كبة',
  تكه: 'تكة',
  باجه: 'باچة',
  باچه: 'باچة',
  باكة: 'باچة',
  كبسه: 'كبسة',
  مقلوبه: 'مقلوبة',
  معكرونه: 'معكرونة',
  مكرونه: 'معكرونة',
  مكرونة: 'معكرونة',
  باسته: 'باستا',
  لازانيه: 'لازانيا',
  اندومي: 'إندومي',
  اندومى: 'إندومي',
  كنتاكي: 'بروستد',
  فهيتا: 'فاهيتا',
  // ألوان
  اسود: 'أسود',
  ابيض: 'أبيض',
  ازرق: 'أزرق',
  ازرك: 'أزرق',
  احمر: 'أحمر',
  اخضر: 'أخضر',
  اصفر: 'أصفر',
  برتقالي: 'برتقالي',
  بنفسجي: 'بنفسجي',
  رصاصي: 'رمادي',
  جوزي: 'بني',
  بيجي: 'بيج',
  نيلي: 'كحلي',
  عنابي: 'ماروني',
  // مشروبات
  جاي: 'شاي',
  چاي: 'شاي',
  قهوه: 'قهوة',
  كهوه: 'قهوة',
  كهوة: 'قهوة',
  نسكافي: 'نسكافيه',
  كبتشينو: 'كابتشينو',
  اسبريسو: 'إسبريسو',
  عيران: 'لبن عيران',
  شنينه: 'لبن عيران',
  مانكا: 'عصير مانجو',
  مانغو: 'عصير مانجو',
  كوكاكولا: 'كولا',
  // أوقات وفصول
  شتا: 'الشتاء',
  شتاء: 'الشتاء',
  صيف: 'الصيف',
  ربيع: 'الربيع',
  خريف: 'الخريف',
  فجر: 'الفجر',
  صبح: 'الصباح الباكر',
  صباح: 'الصباح الباكر',
  ظهر: 'الظهر',
  عصر: 'العصر',
  مغرب: 'المغرب',
  مساء: 'المساء',
  'اخر الليل': 'آخر الليل',
  'اخر اليل': 'آخر الليل',
  'نص الليل': 'منتصف الليل',
  // دول ومدن
  تركيه: 'تركيا',
  يابان: 'اليابان',
  ايطاليا: 'إيطاليا',
  ايطاليه: 'إيطاليا',
  اسبانيا: 'إسبانيا',
  اسبانيه: 'إسبانيا',
  المانيا: 'ألمانيا',
  المانيه: 'ألمانيا',
  سوسرا: 'سويسرا',
  امريكا: 'أمريكا',
  اميركا: 'أمريكا',
  'كوريا الجنوبيه': 'كوريا الجنوبية',
  كوريا: 'كوريا الجنوبية',
  سعوديه: 'السعودية',
  السعوديه: 'السعودية',
  امارات: 'الإمارات',
  الامارات: 'الإمارات',
  مالديف: 'المالديف',
  تايلند: 'تايلاند',
  // أفلام وحلويات وأماكن
  اكشن: 'أكشن',
  انمي: 'أنمي',
  كوميديا: 'كوميدي',
  بقلاوه: 'بقلاوة',
  كنافه: 'كنافة',
  كليجه: 'كليچة',
  كليجة: 'كليچة',
  زلابيه: 'زلابية',
  بسبوسه: 'بسبوسة',
  شوكولاته: 'شوكولاتة',
  كاكاو: 'شوكولاتة',
  موطا: 'آيس كريم',
  بوظه: 'آيس كريم',
  'ايس كريم': 'آيس كريم',
  ايسكريم: 'آيس كريم',
  'جيز كيك': 'تشيز كيك',
  'تشيزكيك': 'تشيز كيك',
  كافي: 'الكافيه',
  كافيه: 'الكافيه',
  مقهى: 'الكافيه',
  حديقه: 'الحديقة',
  الحديقه: 'الحديقة',
  بحر: 'البحر',
  بيت: 'البيت',
  مول: 'المول',
  نوم: 'النوم',
  اكل: 'الأكل'
};

const SYNONYM_MAP: Record<string, string> = {
  چاي: 'شاي',
  جاي: 'شاي',
  كهوه: 'قهوه',
  كوفي: 'قهوه',
  مسكوف: 'مسكوف',
  مسگوف: 'مسكوف',
  مسقوف: 'مسكوف',
  بركر: 'برجر',
  برقر: 'برجر',
  برغر: 'برجر',
  همبركر: 'برجر',
  شتا: 'شتاء',
  اميركا: 'امريكا',
  موطا: 'ايسكريم',
  بوظه: 'ايسكريم',
  فون: 'موبايل',
  تلفون: 'موبايل',
  جوال: 'موبايل',
  هاتف: 'موبايل',
  كافي: 'كافيه',
  مقهي: 'كافيه',
  منزل: 'بيت',
  دار: 'بيت'
};

const FILLER_WORDS = new Set([
  'احب', 'افضل', 'اكيد', 'طبعا', 'كلش', 'جدا', 'هواي', 'هوايه', 'اكثر', 'شي', 'شيء',
  'هو', 'هي', 'ان', 'في', 'من', 'على', 'الي', 'اللي', 'اني', 'انا', 'والله', 'صراحه'
]);

function bareNormalize(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/گ/g, 'ك')
    .replace(/پ/g, 'ب')
    .replace(/چ/g, 'ش')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * 🧠 المصحّح الإملائي الذكي:
 * ينظف الكلمة التي كتبها اللاعب، يزيل الحشو الزائد، ويصحّح الأخطاء الإملائية العربية
 * بمطابقتها أولاً مع قاموس التصحيح وبنك صنف السؤال نفسه (مسافة تحرير ذكية)،
 * مع الحفاظ الكامل على أي جواب خاص خارج القاموس بعد تهذيبه إملائياً.
 */
export function autoCorrectAnswer(question: WKQuestion | undefined, raw: string): string {
  const cleanedSurface = String(raw || '')
    .replace(/[\u0640]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 45);

  if (!cleanedSurface) return '';

  // إزالة مقدمات الكلام الدارجة مثل "والله أحب الدولمه" -> "الدولمه"
  const rawWords = cleanedSurface.split(' ');
  while (rawWords.length > 1 && FILLER_WORDS.has(bareNormalize(rawWords[0]))) {
    rawWords.shift();
  }
  const candidateSurface = rawWords.join(' ').trim();
  const normFull = bareNormalize(candidateSurface);
  const normNoAl = normFull.startsWith('ال') && normFull.length > 3 ? normFull.slice(2) : normFull;

  // 1) فحص قاموس التصحيح المباشر
  if (SPELLING_CANONICAL[normFull]) return SPELLING_CANONICAL[normFull];
  if (SPELLING_CANONICAL[normNoAl]) return SPELLING_CANONICAL[normNoAl];

  // 2) مطابقة إملائية ذكية مع بنك نفس صنف السؤال أولاً ثم بقية الأصناف
  const candidates = [
    ...(question ? question.categoryPool : []),
    ...WK_QUESTIONS.flatMap(q => q.categoryPool)
  ];

  // تطابق تام بعد التطبيع (همزات / تاء مربوطة / ال التعريف)
  for (const item of candidates) {
    const inorm = bareNormalize(item);
    const inormNoAl = inorm.startsWith('ال') && inorm.length > 3 ? inorm.slice(2) : inorm;
    if (normFull === inorm || normNoAl === inormNoAl) {
      return item;
    }
  }

  // تطابق خطأ إملائي بحرف واحد (أو حرفين للكلمات الطويلة) ضمن نفس صنف السؤال
  if (question) {
    let bestItem = '';
    let bestDist = Infinity;
    for (const item of question.categoryPool) {
      const inorm = bareNormalize(item);
      const inormNoAl = inorm.startsWith('ال') && inorm.length > 3 ? inorm.slice(2) : inorm;
      const d = Math.min(editDistance(normFull, inorm), editDistance(normNoAl, inormNoAl));
      const maxAllowed = Math.min(normNoAl.length, inormNoAl.length) >= 7 ? 2 : Math.min(normNoAl.length, inormNoAl.length) >= 4 ? 1 : 0;
      if (d <= maxAllowed && d < bestDist) {
        bestDist = d;
        bestItem = item;
      }
    }
    if (bestItem) return bestItem;
  }

  return candidateSurface;
}

/** تطبيع عربي ذكي لمقارنة الإجابات ومنع تكرار نفس الكلمة بين الخيارات الخاطئة */
export function normalizeAnswer(raw: string): string[] {
  const cleaned = bareNormalize(raw);
  if (!cleaned) return [];

  const tokens = cleaned
    .split(/\s+/)
    .map(w => (w.startsWith('ال') && w.length > 3 ? w.slice(2) : w))
    .map(w => SYNONYM_MAP[w] || w)
    .filter(Boolean);

  const meaningful = tokens.filter(w => !FILLER_WORDS.has(w));
  return meaningful.length ? meaningful : tokens;
}

/** هل الكلمتان تمثلان نفس الإجابة؟ */
export function answersMatch(realAnswer: string, guess: string): boolean {
  const aTokens = normalizeAnswer(realAnswer);
  const gTokens = normalizeAnswer(guess);
  if (!aTokens.length || !gTokens.length) return false;

  const aFull = aTokens.join('');
  const gFull = gTokens.join('');
  if (aFull === gFull) return true;
  if (aFull.length >= 4 && gFull.length >= 4 && editDistance(aFull, gFull) <= 1) return true;

  for (const at of aTokens) {
    for (const gt of gTokens) {
      if (at === gt && at.length >= 2) return true;
      if (at.length >= 4 && gt.length >= 4 && editDistance(at, gt) <= 1) return true;
    }
  }
  return false;
}

/** يبني 4 خيارات ذكية لكل سؤال: الجواب الحقيقي الذي كتبه المقابل + 3 إجابات خاطئة من نفس صنف السؤال */
export function buildGuessChoiceSet(question: WKQuestion, realAnswer: string): string[] {
  const wrongPool = shuffle(
    question.categoryPool.filter(item => !answersMatch(realAnswer, item))
  );
  const threeWrong = wrongPool.slice(0, 3);
  return shuffle([realAnswer, ...threeWrong]);
}

export function createWKGame(chatId: string, chatTitle: string): WKGame {
  return {
    id: `wk_${chatId}_${Date.now()}`,
    chatId,
    chatTitle,
    status: 'lobby',
    questions: shuffle(WK_QUESTIONS).slice(0, WK_TOTAL_CARDS),
    players: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function wkJoin(game: WKGame, id: string, name: string): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: 'اللعبة بدأت بالفعل' };
  if (game.players.some(p => p.id === id)) return { ok: false, msg: 'أنت منضم مسبقاً ✅' };
  if (game.players.length >= 2) return { ok: false, msg: 'اكتمل العدد (لاعبان)' };
  game.players.push({
    id,
    name: name || 'لاعب',
    answers: [],
    choiceSets: [],
    guesses: [],
    hits: [],
    score: 0
  });
  game.updatedAt = Date.now();
  return { ok: true, msg: 'تم انضمامك ✅' };
}

export function wkPartner(game: WKGame, userId: string): WKPlayer | undefined {
  return game.players.find(p => p.id !== userId);
}

/** يضمن تجهيز مجموعات الخيارات الأربعة لكل سؤال بمرحلة التخمين */
export function ensureChoiceSets(game: WKGame, player: WKPlayer): string[][] {
  const other = wkPartner(game, player.id);
  if (!other) return [];
  if (!player.choiceSets || player.choiceSets.length < game.questions.length) {
    player.choiceSets = game.questions.map((q, i) =>
      buildGuessChoiceSet(q, other.answers[i] || q.categoryPool[0])
    );
  }
  return player.choiceSets;
}

/** يسجّل إجابة اللاعب عن نفسه في المرحلة الأولى مع تصحيح إملائي تلقائي */
export function wkSubmitSelfAnswer(
  game: WKGame,
  userId: string,
  text: string
): {
  ok: boolean;
  corrected: string;
  playerDone: boolean;
  phaseComplete: boolean;
  nextIndex: number;
} {
  if (game.status !== 'answering') {
    return { ok: false, corrected: '', playerDone: false, phaseComplete: false, nextIndex: 0 };
  }
  const p = game.players.find(x => x.id === userId);
  if (!p || p.answers.length >= game.questions.length) {
    return { ok: false, corrected: '', playerDone: true, phaseComplete: false, nextIndex: game.questions.length };
  }

  const q = game.questions[p.answers.length];
  const corrected = autoCorrectAnswer(q, text);
  if (!corrected) {
    return { ok: false, corrected: '', playerDone: false, phaseComplete: false, nextIndex: p.answers.length };
  }

  p.answers.push(corrected);
  game.updatedAt = Date.now();

  const playerDone = p.answers.length >= game.questions.length;
  const bothDone = game.players.length === 2 && game.players.every(x => x.answers.length >= game.questions.length);
  if (bothDone) {
    game.status = 'guessing';
    for (const pl of game.players) {
      pl.choiceSets = undefined;
      ensureChoiceSets(game, pl);
    }
  }
  return {
    ok: true,
    corrected,
    playerDone,
    phaseComplete: bothDone,
    nextIndex: p.answers.length
  };
}

/** يسجّل تخمين اللاعب لإجابة الطرف الثاني في المرحلة الثانية */
export function wkSubmitGuess(
  game: WKGame,
  userId: string,
  guessText: string
): { ok: boolean; playerDone: boolean; gameOver: boolean; nextIndex: number } {
  if (game.status !== 'guessing') {
    return { ok: false, playerDone: false, gameOver: false, nextIndex: 0 };
  }
  const p = game.players.find(x => x.id === userId);
  const other = wkPartner(game, userId);
  if (!p || !other || p.guesses.length >= game.questions.length) {
    return { ok: false, playerDone: true, gameOver: false, nextIndex: game.questions.length };
  }

  const idx = p.guesses.length;
  const clean = guessText.trim().slice(0, 60);
  const hit = answersMatch(other.answers[idx] || '', clean);
  p.guesses.push(clean);
  p.hits.push(hit);
  if (hit) p.score += 1;
  game.updatedAt = Date.now();

  const playerDone = p.guesses.length >= game.questions.length;
  const bothDone = game.players.length === 2 && game.players.every(x => x.guesses.length >= game.questions.length);

  if (bothDone) {
    game.status = 'game_over';
    const [p1, p2] = game.players;
    if (p1.score > p2.score) game.winnerId = p1.id;
    else if (p2.score > p1.score) game.winnerId = p2.id;
    else game.winnerId = undefined;
  }

  return {
    ok: true,
    playerDone,
    gameOver: bothDone,
    nextIndex: p.guesses.length
  };
}

/** نص السؤال بالخاص (المرحلة 1 كتابة نصية، المرحلة 2 أربعة أزرار تتحدث بنفس الرسالة) بصيغة MarkdownV2 */
export function renderWKPrompt(game: WKGame, userId: string): { text: string; keyboard: any[][] } | null {
  const p = game.players.find(x => x.id === userId);
  const other = wkPartner(game, userId);
  if (!p || !other) return null;

  if (game.status === 'answering') {
    const idx = p.answers.length;
    if (idx >= game.questions.length) return null;
    const q = game.questions[idx];
    const text =
      `🤝 *منو يعرف الثاني أكثر؟*\n` +
      `📝 *السؤال ${idx + 1} من ${game.questions.length}*\n` +
      `${SEP}\n` +
      `${q.emoji} *${wkMd(q.askSelf)}*\n` +
      `_اكتب جوابك برسالة نصية وأرسله الآن_ ✍️`;
    return { text, keyboard: [] };
  }

  if (game.status === 'guessing') {
    const idx = p.guesses.length;
    if (idx >= game.questions.length) return null;
    const q = game.questions[idx];
    const sets = ensureChoiceSets(game, p);
    const choices = sets[idx] || buildGuessChoiceSet(q, other.answers[idx] || q.categoryPool[0]);

    const kb: any[][] = [];
    for (let i = 0; i < choices.length; i += 2) {
      const row: any[] = [{ text: choices[i], callback_data: `wkp:g:${game.chatId}:${idx}:${i}` }];
      if (choices[i + 1] !== undefined) {
        row.push({ text: choices[i + 1], callback_data: `wkp:g:${game.chatId}:${idx}:${i + 1}` });
      }
      kb.push(row);
    }

    const text =
      `🃏 *خمّن اختيار الطرف الثاني \\(${idx + 1} من ${game.questions.length}\\)*\n` +
      `> \\| *${wkMd(other.name)}* \\|\n` +
      `${SEP}\n` +
      `${q.emoji} *${wkMd(q.askGuess)}*`;
    return { text, keyboard: kb };
  }

  return null;
}

/** رسالة كشف البطاقات المفصّلة التي تُرسل بالخاص للمشاركين فقط بصيغة MarkdownV2 */
export function renderWKPrivateReveal(game: WKGame): string {
  const total = game.questions.length;
  const [p1, p2] = game.players;
  const winner = game.winnerId ? game.players.find(p => p.id === game.winnerId) : undefined;

  const lines: string[] = [`🃏 *كشف البطاقات — منو يعرف الثاني أكثر؟*`, ''];
  if (winner) {
    lines.push(`🏆 *الفائز:*`);
    lines.push(`> \\| *${wkMd(winner.name)}* \\|`);
  } else {
    lines.push(`🤝 *النتيجة: تعادل بين الطرفين\\!*`);
  }

  if (p1 && p2) {
    lines.push(SEP);
    lines.push(
      `> \\| *${wkMd(p1.name)}* \\| — *${p1.score}/${total}* حزر من أشياء *${wkMd(p2.name)}*\n` +
      `> \\| *${wkMd(p2.name)}* \\| — *${p2.score}/${total}* حزر من أشياء *${wkMd(p1.name)}*`
    );

    for (const [subject, guesser] of [
      [p1, p2],
      [p2, p1]
    ] as [WKPlayer, WKPlayer][]) {
      lines.push(SEP);
      lines.push(`🗂️ *بطاقات ${wkMd(subject.name)} \\(تخمين ${wkMd(guesser.name)}\\):*`);
      for (let i = 0; i < total; i++) {
        const q = game.questions[i];
        const realA = wkMd(subject.answers[i] || '—');
        const guessA = wkMd(guesser.guesses[i] || '—');
        const mark = guesser.hits[i] ? '✅' : '❌';
        lines.push(`${q.emoji} ${wkMd(q.shortLabel)}: *${realA}* ⟵ خمّن: *${guessA}* ${mark}`);
      }
    }
  }

  return lines.join('\n');
}

/** لوحة القناة بصيغة MarkdownV2 — بسيطة ومرتبة بدون تعقيد */
export function renderWKBoard(game: WKGame, notice?: string): string {
  const lines: string[] = [`🤝 *منو يعرف الثاني أكثر؟*`];

  if (game.status === 'lobby') {
    lines.push('');
    lines.push(`👥 *المشاركون \\(${game.players.length}/2\\):*`);
    if (!game.players.length) {
      lines.push(`_بانتظار انضمام اللاعبين_`);
    } else {
      lines.push(
        game.players
          .map((p, i) => `> ${i + 1} \\- \\| *${wkMd(p.name)}* \\|`)
          .join('\n')
      );
    }
    if (notice) {
      lines.push('');
      lines.push(`⚠️ ${wkMd(notice)}`);
    }
    return lines.join('\n');
  }

  if (game.status === 'answering') {
    lines.push(`📝 *المرحلة 1: كتابة الإجابات بالخاص \\(${game.questions.length} أسئلة\\)*`);
    lines.push(SEP);
    lines.push(
      game.players
        .map(p => {
          const done = p.answers.length >= game.questions.length;
          const st = done
            ? `كمّل الإجابات ✅`
            : `كتب ${p.answers.length} من ${game.questions.length} ✍️`;
          return `> \\| *${wkMd(p.name)}* \\| — ${st}`;
        })
        .join('\n')
    );
    return lines.join('\n');
  }

  if (game.status === 'guessing') {
    lines.push(`🃏 *المرحلة 2: تخمين اختيارات الطرف الثاني بالخاص*`);
    lines.push(SEP);
    lines.push(
      game.players
        .map(p => {
          const done = p.guesses.length >= game.questions.length;
          const st = done
            ? `أنهى التخمين ✅`
            : `خمّن ${p.guesses.length} من ${game.questions.length} 🤔`;
          return `> \\| *${wkMd(p.name)}* \\| — ${st}`;
        })
        .join('\n')
    );
    return lines.join('\n');
  }

  // 🏁 النتيجة النهائية بالقناة: كل لاعب باقتباس مستقل لوحده وبترتيب واضح ومفهوم فوراً
  const total = game.questions.length;
  const sorted = game.players.slice().sort((a, b) => b.score - a.score);
  const winner = game.winnerId ? game.players.find(p => p.id === game.winnerId) : undefined;

  lines.push(`🏁 *انتهى التحدي\\!*`);
  lines.push(SEP);

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const other = wkPartner(game, p.id);
    const wrong = Math.max(0, total - p.score);
    lines.push(
      `> 👤 \\| *${wkMd(p.name)}* \\|\n` +
      `> ✅ عرف عن \\| *${wkMd(other?.name || 'الطرف الثاني')}* \\|: *${p.score} من ${total}*\n` +
      `> ❌ أخطأ بـ: *${wrong}*`
    );
    if (i < sorted.length - 1) {
      lines.push('');
    }
  }

  lines.push(SEP);
  if (winner) {
    lines.push(`🏆 *الفائز:*`);
    lines.push(`> 🥇 \\| *${wkMd(winner.name)}* \\|`);
  } else {
    lines.push(`🤝 *النتيجة:* تعادل متكافئ بين الطرفين\\!`);
  }
  lines.push(`_📩 تفاصيل البطاقات كاملة وصلت بالخاص للمشاركين_`);

  return lines.join('\n');
}

export function wkBoardKeyboard(game: WKGame, botUsername?: string): any[][] {
  const rows: any[][] = [];
  if (game.status === 'lobby') {
    if (game.players.length < 2) {
      rows.push([{ text: 'انضم', callback_data: `wkj:${game.chatId}` }]);
    } else {
      rows.push([{ text: '🚀 ابدأ التحدي', callback_data: `wks:${game.chatId}` }]);
    }
    if (botUsername) {
      rows.push([
        {
          text: '💬 افتح الخاص مع البوت',
          url: `https://t.me/${botUsername}?start=wk_${game.chatId}`
        }
      ]);
    }
    return rows;
  }

  if (game.status === 'answering' || game.status === 'guessing') {
    if (botUsername) {
      rows.push([
        {
          text: '💬 الذهاب للخاص للإجابة',
          url: `https://t.me/${botUsername}?start=wk_${game.chatId}`
        }
      ]);
    }
    return rows;
  }

  return [[{ text: '🔄 لعبة جديدة', callback_data: `wkn:${game.chatId}` }]];
}
