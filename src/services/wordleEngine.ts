/**
 * 🟩 «خمّن الكلمة» — لعبة كلمة اليوم (5 حروف / 6 محاولات).
 *
 * تنلعب بالخاص: كل لاعب عنده كلمته الخاصة، ويكتبها بالضغط على أزرار
 * الحروف (بلا كيبورد، بلا أوامر). التلوين يوضّح الحرف الصح والمكان الصح.
 */

export interface WordleState {
  /** الكلمة المطلوبة (5 حروف، مطبّعة) */
  target: string;
  /** التخمينات اللي أرسلها اللاعب */
  guesses: string[];
  /** الحروف المكتوبة حالياً قبل الإرسال */
  current: string;
  /** خلصت اللعبة؟ */
  done: boolean;
  /** ربح؟ */
  won: boolean;
}

export const WORDLE_LENGTH = 5;
export const WORDLE_TRIES = 6;

/** الحروف المتاحة على اللوحة (28 حرف) */
export const WORDLE_LETTERS = [
  'ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ',
  'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص',
  'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق',
  'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'
];

export const MARK: Record<string, string> = { g: '🟩', y: '🟨', x: '⬜' };

/** تطبيع النص العربي: بلا تشكيل ولا همزات ولا تاء مربوطة */
export function normalizeArabic(input: string): string {
  return (input || '')
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/[گڪ]/g, 'ك')
    .replace(/چ/g, 'ج')
    .replace(/[پ]/g, 'ب')
    .replace(/[ڤ]/g, 'ف')
    .replace(/ء/g, '')
    .replace(/[^\u0621-\u064A]/g, '');
}

/** الكلمات الخام — تُطبّع وتُفلتر بالأسفل */
const RAW_WORDS: string[] = [
  // بيت وعائلة
  'مدرسه', 'جامعه', 'مكتبه', 'حديقه', 'سجاده', 'حصيره', 'ستاره', 'طاوله',
  'خزانه', 'مرايا', 'ارضيه', 'ثلاجه', 'غساله', 'مكنسه', 'ملعقه', 'صينيه',
  'ابريق', 'منديل', 'مصباح', 'شمسيه', 'خالتي', 'اخويه', 'عايله', 'عزيمه',
  'عيديه', 'ملحفه', 'صندوق', 'مفتاح', 'فانوس', 'غرفتي', 'مروحه', 'مطبخي',
  'كنبه', 'سياج', 'بابي',
  // مدينة ومواصلات
  'سياره', 'طياره', 'سفينه', 'دراجه', 'طريقه', 'منتزه', 'عياده', 'صيدله',
  'دكتور', 'ممرضه', 'عمليه', 'تحليل', 'حراره', 'عاصمه', 'مدينه', 'بدايه',
  'تجاره', 'وظيفه', 'مشروع', 'اجازه', 'تذكره', 'جزيره', 'بحيره', 'نافذه',
  'جريده', 'صحيفه', 'مذياع', 'تلفون', 'حاسوب', 'سماعه', 'طباعه', 'فنادق',
  'مصارف', 'شواحن', 'مجلات', 'تلفاز', 'حافله', 'باصات', 'سفاره', 'صالات',
  'قاعات', 'مطاعم', 'مطعمه', 'مقاهي', 'كافيه', 'ملاهي', 'سينما', 'مسارح',
  'مسابح', 'حدايق', 'جنينه', 'مزرعه',
  // أكل وشرب
  'تشريب', 'مسكوف', 'كنافه', 'دولمه', 'باميه', 'طماطه', 'بطاطا', 'شوربه',
  'فلافل', 'بسكوت', 'حلاوه', 'عيران', 'ليمون', 'سبانخ', 'تفاحه', 'كليجه',
  'اطباق', 'رغايف', 'كبسات', 'سلطات', 'عصاير', 'خرفان', 'كزبره', 'معمول',
  'زيتون', 'حلويات', 'شربتي',
  // حيوانات
  'سنجاب', 'غزاله', 'دجاجه', 'حمامه', 'عصفور', 'طاووس', 'فراشه', 'كتكوت',
  'تمساح', 'زرافه', 'بطريق', 'دلفين', 'بعوضه', 'جراده', 'سلحفه', 'عقربه',
  'قوارب', 'صياده', 'اسماك', 'احصنه',
  // طبيعة وسما
  'اشجار', 'انهار', 'ازهار', 'كواكب', 'مجرات', 'سحابه', 'امطار', 'امواج',
  'شبكات', 'غابات', 'صاروخ', 'عاصفه', 'عطارد', 'مشتري',
  // رياضه وفن
  'رياضه', 'مباره', 'بطوله', 'جايزه', 'تمرين', 'سباحه', 'ملاكم', 'مهاجم',
  'مدافع', 'صافره', 'تشجيع', 'جمهور', 'اهداف', 'اغنيه', 'جيتار', 'بيانو',
  'مزمار', 'كلمات', 'قصيده', 'روايه', 'شاعره', 'فنانه', 'ملاعب',
  // مدن
  'بغداد', 'اربيل', 'كركوك', 'النجف', 'كربلا', 'رمادي', 'فلوجه', 'سامرا',
  'سماوه', 'ديالي', 'بيروت', 'قاهره', 'باريس', 'برلين', 'مدريد', 'موسكو',
  'طوكيو', 'فرنسا', 'كويتي',
  // حياة وشعور
  'مشاعر', 'احساس', 'سعاده', 'فرحان', 'حزينه', 'ضحكات', 'دمعات', 'افكار',
  'دينار', 'رواتب', 'مبالغ', 'بضاعه', 'شغلات', 'مديره', 'موظفه', 'سفره',
  'مسافر', 'حقيبه', 'قمصان', 'جاكيت', 'احزمه', 'جوارب', 'كوفيه', 'عبايه',
  'خواتم', 'نظاره', 'محفظه', 'علاقه', 'مدفاه', 'شوايه', 'تحديث', 'تسليه',
  // أفعال ومصادر
  'يسافر', 'نسافر', 'نتكلم', 'يفتكر', 'يبتسم', 'يشاهد', 'يتعلم', 'تدريب',
  'تعليم', 'تفكير', 'تقدير', 'ترتيب', 'تنظيم', 'تسجيل', 'تحويل', 'تصميم',
  'تصوير', 'تعريف', 'تصنيف', 'لهجات',
  // كلمات خماسية عربية فصيحة ويومية سليمة 100٪ بدون أي حشو أو بتر
  'مناره', 'مرساه', 'بوصله', 'خريطه', 'ينبوع', 'بركان', 'زلازل', 'غمامه',
  'ياقوت', 'مرجان', 'الماس', 'بلوره', 'قلاده', 'اساور', 'خاتمي', 'عطوري',
  'شوارع', 'منازل', 'مدارس', 'عواصم', 'قوافل', 'مواسم', 'سواحل', 'مواني',
  'خنادق', 'قناطر', 'ميدان', 'ابراج', 'قلاعنا', 'جوامع', 'معابد', 'متاحف',
  'فنادق', 'مطارات', 'بواخر', 'زوارق', 'شراعي', 'مجداف', 'عربات', 'قطاره',
  'غزلان', 'ثعالب', 'سناجب', 'ارانب', 'سلاحف', 'حيتان', 'اسماك', 'نسوره',
  'حمامه', 'يمامه', 'بلابل', 'كناري', 'نعامه', 'ببغاء', 'فراشه', 'يرقات',
  'محامي', 'استاذ', 'مترجم', 'ممرضه', 'جراحه', 'عياده', 'معامل', 'مختبر',
  'مطرقه', 'منشار', 'مفكات', 'عدسات', 'منظار', 'سماعه', 'لوحات', 'تماثيل',
  'بستان', 'اعناب', 'رمانه', 'تفاحه', 'مشمشه', 'خوخها', 'نعناع', 'قرنفل',
  'ليمون', 'زيتون', 'فستقي', 'سمسمي', 'زعفران', 'كركمه', 'كموني', 'دارسي',
  'امطار', 'اعصار', 'رياحي', 'ضبابي', 'صقيعي', 'واحات', 'صحاري', 'هضابه',
  'وديان', 'شطآن', 'خليجي', 'مضيقي', 'قارات', 'كواكب', 'نيازك', 'مداره',
  'بطوله', 'ميدان', 'سباقي', 'فارسنا', 'شجاعه', 'كرامه', 'اصاله', 'امانه',
  'صداقه', 'محبه', 'تسامح', 'تعاون', 'عزيمه', 'اراده', 'مهاره', 'براعه'
];

/** الكلمات الجاهزة للعب: مطبّعة، 5 حروف، وكل حرف منها موجود على اللوحة */
export const WORDLE_WORDS: string[] = RAW_WORDS.map(normalizeArabic)
  .filter(
    word =>
      word.length === WORDLE_LENGTH && word.split('').every(ch => WORDLE_LETTERS.includes(ch))
  )
  .filter((word, index, all) => all.indexOf(word) === index);

/** ترميز الحرف: g = صح بمكانه، y = موجود بمكان ثاني، x = مو موجود */
export function scoreGuess(guess: string, target: string): string[] {
  const marks: string[] = new Array(guess.length).fill('x');
  const pool: Record<string, number> = {};

  for (let i = 0; i < target.length; i++) {
    if (guess[i] === target[i]) marks[i] = 'g';
    else pool[target[i]] = (pool[target[i]] || 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === 'g') continue;
    const ch = guess[i];
    if (pool[ch] > 0) {
      marks[i] = 'y';
      pool[ch] -= 1;
    }
  }
  return marks;
}

/** حالة كل حرف على اللوحة (الأفضل يفوز: g ثم y ثم x) */
export function letterMarks(state: WordleState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const guess of state.guesses) {
    const marks = scoreGuess(guess, state.target);
    for (let i = 0; i < guess.length; i++) {
      const ch = guess[i];
      const cur = out[ch];
      const next = marks[i];
      if (cur === 'g') continue;
      if (cur === 'y' && next !== 'g') continue;
      out[ch] = next;
    }
  }
  return out;
}

export function pickWord(avoid?: string): string {
  let word = WORDLE_WORDS[0];
  for (let i = 0; i < 12; i++) {
    word = WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)];
    if (!avoid || word !== avoid) return word;
  }
  return word;
}

export function createGame(avoid?: string): WordleState {
  return { target: pickWord(avoid), guesses: [], current: '', done: false, won: false };
}

export function addLetter(state: WordleState, letter: string): WordleState {
  if (state.done) return state;
  if (state.current.length >= WORDLE_LENGTH) return state;
  if (!WORDLE_LETTERS.includes(letter)) return state;
  return { ...state, current: state.current + letter };
}

export function deleteLetter(state: WordleState): WordleState {
  if (state.done || !state.current) return state;
  return { ...state, current: state.current.slice(0, -1) };
}

export function submitGuess(state: WordleState): { state: WordleState; error?: string } {
  if (state.done) return { state, error: 'اللعبة خلصت — اضغط «🔄 كلمة جديدة».' };
  if (state.current.length < WORDLE_LENGTH) {
    const left = WORDLE_LENGTH - state.current.length;
    const label = left === 1 ? 'حرف واحد' : left === 2 ? 'حرفين' : `${left} أحرف`;
    return { state, error: `باقي ${label} — كمّل الكلمة.` };
  }
  const guesses = [...state.guesses, state.current];
  const won = state.current === state.target;
  return {
    state: { ...state, guesses, current: '', won, done: won || guesses.length >= WORDLE_TRIES }
  };
}

/** نقاط الفوز: كل ما كانت محاولاتك أقل، نقاطك أكثر */
export function pointsFor(used: number): number {
  return Math.max(5, (WORDLE_TRIES - used + 1) * 5);
}

/** نص الرسالة: العنوان + العدّاد + الصفوف + السطر الحالي */
export function renderMessage(state: WordleState): string {
  const used = state.guesses.length;
  const done = state.done;
  const title = state.won
    ? `🎉 *براڤو!* حليت الكلمة: *${state.target}*`
    : done
      ? `😅 *خلصت محاولاتك!* الكلمة كانت: *${state.target}*`
      : `🟩 *خمّن الكلمة* — كلمة من ${WORDLE_LENGTH} حروف`;
  const counter = done
    ? `✅ محاولاتك: *${used}/${WORDLE_TRIES}*`
    : `🔢 محاولة *${used + 1}* من *${WORDLE_TRIES}*`;

  const rows: string[] = [];
  state.guesses.forEach((guess, idx) => {
    const marks = scoreGuess(guess, state.target);
    const cells = guess
      .split('')
      .map((ch, i) => `${MARK[marks[i]]}${ch}`)
      .join(' ');
    rows.push(`${idx + 1}️⃣ ${cells}`);
  });

  if (!done) {
    const cells: string[] = [];
    for (let i = 0; i < WORDLE_LENGTH; i++) {
      cells.push(i < state.current.length ? state.current[i] : '_');
    }
    rows.push(`✍️ ${cells.join(' ')}`);
  }
  if (!rows.length) rows.push(`✍️ ${new Array(WORDLE_LENGTH).fill('_').join(' ')}`);

  const legend = done
    ? ''
    : `\n━━━━━━━━━━━━━━━━━━━\n🟩 بمكانه • 🟨 موجود بمكان ثاني • ⬜ مو بالكلمة`;

  return `${title}\n${counter}\n━━━━━━━━━━━━━━━━━━━\n${rows.join('\n')}${legend}`;
}

/** أزرار اللعبة: 4 صفوف حروف + أزرار التحكم */
export function keyboard(state: WordleState): any[][] {
  if (state.done) {
    return [
      [{ text: '🔄 كلمة جديدة', callback_data: 'wl:new' }],
      [{ text: '🔙 رجوع', callback_data: 'hub:g:wordle' }]
    ];
  }
  const marks = letterMarks(state);
  const rows: any[][] = [];
  for (let i = 0; i < WORDLE_LETTERS.length; i += 7) {
    rows.push(
      WORDLE_LETTERS.slice(i, i + 7).map(letter => {
        const m = marks[letter];
        const prefix = m ? MARK[m] : '';
        return { text: `${prefix}${letter}`, callback_data: `wl:${letter}` };
      })
    );
  }
  rows.push([
    { text: '⌫ مسح حرف', callback_data: 'wl:del' },
    { text: '✅ إرسال', callback_data: 'wl:ok' }
  ]);
  rows.push([{ text: '🔙 رجوع', callback_data: 'hub:g:wordle' }]);
  return rows;
}
