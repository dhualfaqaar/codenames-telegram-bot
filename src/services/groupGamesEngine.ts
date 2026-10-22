/**
 * 🎉 محرك الألعاب الجماعية بالقنوات
 *
 * نظام اللوبي: أي عضو يضغط «انضم» — من لاعبين إلى 10.
 * أول إجابة صحيحة تحسم نقطة الجولة في جميع مسابقات الاختيارات.
 *
 * نوعين من الأزرار تجي للبوت:
 *   gqj / gqs / gqa / gqn  → ألعاب الأسئلة (سرعة، معلومات، وألعاب خمّن)
 *   mmj / mms / mmd / mmb / mmc / mmn → ماسترمايند
 */
import {
  GQRow,
  GENERAL,
  GEOGRAPHY,
  HISTORY,
  COUNTRIES,
  MOVIES,
  SERIES,
  FOODS,
  FLAGS,
  CAPITALS,
  CONTINENTS,
  PLAYERS,
  POETS,
  SONGS_AR,
  SONGS_EN
} from './groupQuizData';
import {
  ARABIC_VOCABULARY,
  ARABIC_SYNONYMS,
  ARABIC_ANTONYMS,
  ARABIC_PLURALS,
  ARABIC_GRAMMAR
} from './arabicLanguageBank';
import { ODD_WORD_PUZZLES } from './oddWordEngine';
import {
  ISLAMIC_QUESTIONS,
  IRAQI_HERITAGE,
  FOOTBALL_DEEP,
  SCIENCE_SPACE,
  ANIMALS_NATURE,
  DIALECTS_MEANINGS,
  CAR_PHOTO_QUIZ,
  CAR_PHOTO_URLS,
  TRUE_FALSE_FAST,
  EMOJI_MATH,
  GUESS_NOVELS,
  GUESS_LANDMARKS,
  GUESS_CREATURES
} from './fastAndGuessBanks';
import {
  MOVIE_EMOJI,
  SERIES_EMOJI,
  COUNTRY_EMOJI,
  FOOD_EMOJI,
  PLAYER_EMOJI,
  SONG_EMOJI,
  NOVEL_EMOJI,
  LANDMARK_EMOJI,
  CREATURE_EMOJI,
  CAPITALS_EMOJI
} from './emojiModeBanks';

// ---------------------------------------------------------------------
// 🧩 أنواع الألعاب
// ---------------------------------------------------------------------
export type QuizKind =
  | 'general'
  | 'geo'
  | 'history'
  | 'trivia'
  | 'country'
  | 'movie'
  | 'series'
  | 'number'
  | 'food'
  | 'math'
  | 'flags'
  | 'capitals'
  | 'continents'
  | 'odd'
  | 'player'
  | 'poet'
  | 'song_ar'
  | 'song_en'
  | 'islamic'
  | 'heritage'
  | 'science'
  | 'animals'
  | 'dialects'
  | 'cars'
  | 'fbquiz'
  | 'arabic_vocab'
  | 'arabic_synonyms'
  | 'arabic_antonyms'
  | 'arabic_plurals'
  | 'arabic_grammar'
  | 'tf'
  | 'emath'
  | 'novel'
  | 'landmark'
  | 'creature'
  | 'movie_emoji'
  | 'series_emoji'
  | 'country_emoji'
  | 'food_emoji'
  | 'player_emoji'
  | 'song_emoji'
  | 'novel_emoji'
  | 'landmark_emoji'
  | 'creature_emoji'
  | 'capitals_emoji';

/** خريطة ربط اللعبة الأصلية بنسخة «نظام الإيموجي 😀» الخاصة بها */
export const EMOJI_VARIANT_OF: Partial<Record<QuizKind, QuizKind>> = {
  movie: 'movie_emoji',
  series: 'series_emoji',
  country: 'country_emoji',
  food: 'food_emoji',
  player: 'player_emoji',
  song_ar: 'song_emoji',
  song_en: 'song_emoji',
  novel: 'novel_emoji',
  landmark: 'landmark_emoji',
  creature: 'creature_emoji',
  capitals: 'capitals_emoji'
};

export const QUIZ_KINDS: Record<QuizKind, { emoji: string; title: string; intro: string }> = {
  general: {
    emoji: '📚',
    title: 'أسئلة عامة',
    intro: 'منافسة أسئلة عامة متجددة من 10 جولات 📚'
  },
  geo: {
    emoji: '🗺️',
    title: 'جغرافيا',
    intro: 'تحدي الدول والجزر والمضائق والأنهار والتضاريس 🗺️'
  },
  history: {
    emoji: '🇮🇶',
    title: 'تاريخ',
    intro: 'رحلة في حضارات الرافدين والتاريخ العربي والعالمي 🏛️'
  },
  trivia: {
    emoji: '🧠',
    title: 'معركة المعلومات',
    intro: 'منافسة معلومات عامة من 10 جولات 🧠'
  },
  country: {
    emoji: '🏳️',
    title: 'الدول',
    intro: 'اعرف الدولة من المعلومة المميزة عنها 🌍'
  },
  movie: {
    emoji: '🎬',
    title: 'الأفلام',
    intro: 'اعرف الفيلم الشهير من نبذة قصته 🍿'
  },
  series: {
    emoji: '📺',
    title: 'المسلسلات',
    intro: 'اعرف المسلسل الشهير من نبذة قصته 📺'
  },
  number: {
    emoji: '🧮',
    title: 'الرياضيات',
    intro: 'حل مسائل حسابية متنوعة من الجمع والطرح والضرب والقسمة 🧮'
  },
  food: {
    emoji: '🍲',
    title: 'الأكلات',
    intro: 'اعرف الأكلة الشهيرة من وصفها 🍽️'
  },
  math: {
    emoji: '🧮',
    title: 'تحدي الحساب',
    intro: 'مسائل حسابية سريعة — النقطة للأسرع ⚡'
  },
  flags: {
    emoji: '🚩',
    title: 'الأعلام',
    intro: 'اعرف الدولة صاحبة العلم 🚩'
  },
  capitals: {
    emoji: '🏛️',
    title: 'العواصم',
    intro: 'اعرف العاصمة الصحيحة لكل دولة 🏛️'
  },
  continents: {
    emoji: '🌍',
    title: 'دولة القارة',
    intro: 'اعرف الدولة التي تقع ضمن القارة المطلوبة 🌍'
  },
  odd: {
    emoji: '🕵️',
    title: 'الكلمة الغريبة',
    intro: 'أربع كلمات من نفس المجموعة وكلمة دخيلة وحدة — اكتشف الغريبة 🎯'
  },
  player: {
    emoji: '⚽',
    title: 'احزر اللاعب',
    intro: 'اعرف نجم كرة القدم من مسيرته وألقابه ⚽'
  },
  poet: {
    emoji: '🎭',
    title: 'احزر الشاعر',
    intro: 'اعرف الشاعر صاحب البيت الشهير 🎭'
  },
  song_ar: {
    emoji: '🎤',
    title: 'احزر الأغنية العربية',
    intro: 'لمنو هاي الأغنية العربية الشهيرة؟ 🎤'
  },
  song_en: {
    emoji: '🎸',
    title: 'احزر الأغنية الإنجليزية',
    intro: 'لمنو هاي الأغنية الإنجليزية الشهيرة؟ 🎸'
  },
  islamic: {
    emoji: '🕌',
    title: 'أسئلة دينية',
    intro: 'أسئلة دينية عن القرآن والأنبياء والصحابة والسيرة النبوية 🕌'
  },
  heritage: {
    emoji: '🏺',
    title: 'التراث العراقي والعربي',
    intro: 'أمثال ومعالم وأسواق وأكلات ومهن من التراث العراقي والعربي 🏺'
  },
  science: {
    emoji: '🔬',
    title: 'علوم',
    intro: 'أسئلة متنوعة في العلوم والفضاء وجسم الإنسان والاختراعات 🔬'
  },
  animals: {
    emoji: '🐾',
    title: 'الحيوانات',
    intro: 'معلومات وحقائق ممتعة عن الحيوانات والطيور والكائنات البحرية 🐾'
  },
  dialects: {
    emoji: '🗣️',
    title: 'اللهجة العراقية',
    intro: 'تعرف على المفردة العراقية واختر معناها باللغة العربية الفصحى 🗣️'
  },
  cars: {
    emoji: '🚘',
    title: 'السيارات',
    intro: 'شاهد صورة السيارة واختر طرازها الصحيح من أربعة خيارات 🚘'
  },
  fbquiz: {
    emoji: '🏆',
    title: 'كرة قدم عالمية وعراقية',
    intro: 'أسود الرافدين وكأس العالم ودوري الأبطال وأساطير الكرة 🏆'
  },
  arabic_vocab: {
    emoji: '📖',
    title: 'مفردات عربية فصيحة',
    intro: 'اختر معنى الكلمة العربية الفصيحة من أربعة خيارات.'
  },
  arabic_synonyms: {
    emoji: '🪶',
    title: 'مرادفات عربية',
    intro: 'اختبر حصيلتك اللغوية باختيار مرادف الكلمة.'
  },
  arabic_antonyms: {
    emoji: '↔️',
    title: 'أضداد عربية',
    intro: 'اختر ضد الكلمة الفصيحة من بين الخيارات.'
  },
  arabic_plurals: {
    emoji: '🔤',
    title: 'مفرد وجمع',
    intro: 'اختر الجمع الفصيح الصحيح للمفردة.'
  },
  arabic_grammar: {
    emoji: '✍️',
    title: 'قواعد ونحو',
    intro: 'أسئلة فصيحة في النحو والصرف والإعراب.'
  },
  tf: {
    emoji: '✅',
    title: 'صح لو خطأ السريع',
    intro: 'معلومة سريعة وزرّين بس — أسرع إجابة صحيحة تحصد النقطة ⚡'
  },
  emath: {
    emoji: '🧮',
    title: 'إيموجي المعادلات الذكية',
    intro: 'حل ألغاز المعادلات المصوّرة بالإيموجي بسرعة وذكاء 🧮'
  },
  novel: {
    emoji: '📚',
    title: 'الروايات والكتب',
    intro: 'اعرف الرواية أو الكتاب الشهير من فكرته وأبطاله 📚'
  },
  landmark: {
    emoji: '🏛️',
    title: 'المعالم السياحية',
    intro: 'اعرف المعلم الأثري أو السياحي العالمي والعراقي من وصفه 🏛️'
  },
  creature: {
    emoji: '🐾',
    title: 'الكائنات الحية',
    intro: 'اعرف الكائن الحي من صفاته وحقائقه المدهشة 🐾'
  },
  movie_emoji: {
    emoji: '🎬',
    title: 'الأفلام — نظام الإيموجي 😀',
    intro: 'شوف الإيموجيات المعبّرة واعرف الفيلم المقصود بسرعة 🎬😀'
  },
  series_emoji: {
    emoji: '📺',
    title: 'المسلسلات — نظام الإيموجي 😀',
    intro: 'شوف الإيموجيات المعبّرة واعرف المسلسل المقصود بسرعة 📺😀'
  },
  country_emoji: {
    emoji: '🏳️',
    title: 'الدول — نظام الإيموجي 😀',
    intro: 'شوف الإيموجيات المعبّرة واعرف الدولة المقصودة بسرعة 🏳️😀'
  },
  food_emoji: {
    emoji: '🍲',
    title: 'الأكلات — نظام الإيموجي 😀',
    intro: 'شوف الإيموجيات المعبّرة واعرف الأكلة المقصودة بسرعة 🍲😀'
  },
  player_emoji: {
    emoji: '⚽',
    title: 'احزر اللاعب — نظام الإيموجي 😀',
    intro: 'شوف الإيموجيات المعبّرة واعرف اللاعب المقصود بسرعة ⚽😀'
  },
  song_emoji: {
    emoji: '🎵',
    title: 'احزر الأغنية — نظام الإيموجي 😀',
    intro: 'شوف الإيموجيات المعبّرة واعرف الأغنية المقصودة بسرعة 🎵😀'
  },
  novel_emoji: {
    emoji: '📚',
    title: 'الروايات والكتب — نظام الإيموجي 😀',
    intro: 'شوف الإيموجيات المعبّرة واعرف الكتاب أو الرواية المقصودة 📚😀'
  },
  landmark_emoji: {
    emoji: '🏛️',
    title: 'المعالم السياحية — نظام الإيموجي 😀',
    intro: 'شوف الإيموجيات المعبّرة واعرف المعلم السياحي المقصود 🏛️😀'
  },
  creature_emoji: {
    emoji: '🐾',
    title: 'الكائنات الحية — نظام الإيموجي 😀',
    intro: 'شوف الإيموجيات المعبّرة واعرف الكائن الحي المقصود 🐾😀'
  },
  capitals_emoji: {
    emoji: '🏛️',
    title: 'العواصم — نظام الإيموجي 😀',
    intro: 'شوف الإيموجيات المعبّرة واعرف العاصمة المقصودة بسرعة 🏛️😀'
  }
};

/** كل مسابقات الاختيارات تستخدم نظام السرعة: أول إجابة صحيحة وحدها تكسب نقطة الجولة. */
export function isSpeedQuiz(_game: QuizGame | { kind: QuizKind }): boolean {
  return true;
}

/** يولّد مسائل حسابية عشوائية متنوّعة (جمع، طرح، ضرب، قسمة صحيحة، وتربيع) مع 3 إجابات غلط قريبة */
function mathRows(): GQRow[] {
  const rows: GQRow[] = [];
  const used = new Set<string>();
  while (rows.length < 30) {
    const mode = Math.floor(Math.random() * 5);
    let prompt = '';
    let ans = 0;
    if (mode === 0) {
      const a = 12 + Math.floor(Math.random() * 88);
      const b = 9 + Math.floor(Math.random() * 75);
      prompt = `كم ناتج ${a} + ${b}؟`;
      ans = a + b;
    } else if (mode === 1) {
      let a = 25 + Math.floor(Math.random() * 95);
      let b = 8 + Math.floor(Math.random() * 65);
      if (b > a) [a, b] = [b, a];
      prompt = `كم ناتج ${a} - ${b}؟`;
      ans = a - b;
    } else if (mode === 2) {
      const a = 4 + Math.floor(Math.random() * 13);
      const b = 3 + Math.floor(Math.random() * 12);
      prompt = `كم ناتج ${a} × ${b}؟`;
      ans = a * b;
    } else if (mode === 3) {
      const divisor = 2 + Math.floor(Math.random() * 11);
      const quotient = 3 + Math.floor(Math.random() * 14);
      const dividend = divisor * quotient;
      prompt = `كم ناتج ${dividend} ÷ ${divisor}؟`;
      ans = quotient;
    } else {
      const a = 2 + Math.floor(Math.random() * 9);
      const b = 2 + Math.floor(Math.random() * 8);
      const c = 3 + Math.floor(Math.random() * 20);
      prompt = `كم ناتج (${a} × ${b}) + ${c}؟`;
      ans = a * b + c;
    }

    if (used.has(prompt)) continue;
    used.add(prompt);
    const wrongs = new Set<number>();
    while (wrongs.size < 3) {
      const delta = 1 + Math.floor(Math.random() * 9);
      const w = ans + (Math.random() < 0.5 ? -delta : delta);
      if (w !== ans && w >= 0) wrongs.add(w);
    }
    const [w1, w2, w3] = Array.from(wrongs);
    rows.push([prompt, String(ans), String(w1), String(w2), String(w3)]);
  }
  return rows;
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

/** رقم بالأرقام العربية (2513…) */
function arNum(n: number): string {
  return String(n);
}
export const TOTAL_ROUNDS = 10;
/** مهلة كل سؤال بالثواني (15 ثانية) — اللي ما يجاوب خلالها يتحوّل السؤال تلقائياً للي بعده */
export const ROUND_MS = 15_000;
/** مهلة عرض نتيجة الجولة لما الكل يجاوب قبل انتهاء المهلة */
export const RESULT_MS = 2_000;

/**
 * يهروّب رموز MarkdownV2 الخاصة حتى النص ينطبع حرفياً.
 * لوحات الألعاب الجماعية تُرسل بصيغة MarkdownV2 (حتى تدعم الاقتباسات الملوّنة).
 */
export function md(s: string): string {
  return s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * سطر لاعب داخل اقتباس ملوّن — كل اسم بسطر حاله ويا الشريط الملوّن:
 * 1 - | اسم | (p نقاطه) + علامته (✅ صح / ❌ خطأ / ⏳ ما جاوب)
 */
export function scoreLine(rank: number, name: string, score: number, mark = ''): string {
  return `> ${rank} \\- \\| *${md(name)}* \\| \\(p ${score}\\)${mark}`;
}

/** يحوّل نص بعلامات عريض/مائل واقتباسات > إلى MarkdownV2 سليم 100٪ بلا أي رمز غير مهروّب */
function convertV2Inline(seg: string): string {
  let out = '';
  let i = 0;
  while (i < seg.length) {
    const ch = seg[i];
    if (ch === '\\' && i + 1 < seg.length) {
      out += seg.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === '*' || ch === '_' || ch === '`') {
      let close = -1;
      for (let j = i + 1; j < seg.length; j++) {
        if (seg[j] === '\\') { j++; continue; }
        if (seg[j] === ch) { close = j; break; }
      }
      if (close > i + 1) {
        const inner = seg.slice(i + 1, close);
        if (ch === '`') {
          out += '`' + inner.replace(/([`\\])/g, '\\$1') + '`';
        } else {
          out += ch + convertV2Inline(inner) + ch;
        }
        i = close + 1;
        continue;
      }
      out += '\\' + ch;
      i += 1;
      continue;
    }
    if ('[]()~>#+-=|{}.!'.includes(ch)) {
      out += '\\' + ch;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

export function toV2(text: string): string {
  return String(text || '')
    .split('\n')
    .map(line => (line.startsWith('>') ? '>' + convertV2Inline(line.slice(1)) : convertV2Inline(line)))
    .join('\n');
}

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
  /** معرّف رسالة الإنلاين (تيليجرام يلقّص الأزرار منها بدون محادثة — نحتاجه للتعديل) */
  inlineMessageId?: string;
  kind: QuizKind;
  status: 'lobby' | 'playing' | 'result' | 'game_over';
  players: QuizPlayer[];
  round: number;
  totalRounds: number;
  /** بنك جولات هاي المباراة (مخلوط جاهز — 4 أو 5 خيارات) */
  deck: string[][];
  qIndex: number;
  /** خيارات الجولة بعد الخلط + مكان الإجابة الصحيحة */
  options: string[];
  correctIdx: number;
  /** نص ملخص آخر جولة (لعرضه بشاشة النتيجة) */
  lastLine: string;
  /** موعد انتهاء مهلة السؤال الحالي (15 ثانية) */
  roundDeadline?: number;
  /** رسالة صورة السيارة في جولة لعبة السيارات */
  photoMessageId?: number;
  /** موعد الانتقال التلقائي بعد شاشة النتيجة القصيرة */
  resultDeadline?: number;
  rewarded?: boolean;
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

function oddWordRows(): string[][] {
  return ODD_WORD_PUZZLES.map(p => [
    'أربع كلمات من نفس المجموعة ووحدة دخيلة — شنو الكلمة الغريبة؟',
    p.odd,
    p.four[0],
    p.four[1],
    p.four[2],
    p.four[3]
  ]);
}

function oddLinkFor(oddWord: string): string {
  return ODD_WORD_PUZZLES.find(p => p.odd === oddWord)?.link || '';
}

function packFor(kind: QuizKind): string[][] {
  switch (kind) {
    case 'general': return GENERAL;
    case 'geo': return GEOGRAPHY;
    case 'history': return HISTORY;
    case 'country': return COUNTRIES;
    case 'movie': return MOVIES;
    case 'series': return SERIES;
    case 'number': return mathRows();
    case 'food': return FOODS;
    case 'flags': return FLAGS;
    case 'capitals': return CAPITALS;
    case 'continents': return CONTINENTS;
    case 'player': return PLAYERS;
    case 'poet': return POETS;
    case 'song_ar': return SONGS_AR;
    case 'song_en': return SONGS_EN;
    case 'islamic': return ISLAMIC_QUESTIONS;
    case 'heritage': return IRAQI_HERITAGE;
    case 'science': return SCIENCE_SPACE;
    case 'animals': return ANIMALS_NATURE;
    case 'dialects': return DIALECTS_MEANINGS;
    case 'cars': return CAR_PHOTO_QUIZ;
    case 'fbquiz': return FOOTBALL_DEEP;
    case 'arabic_vocab': return ARABIC_VOCABULARY;
    case 'arabic_synonyms': return ARABIC_SYNONYMS;
    case 'arabic_antonyms': return ARABIC_ANTONYMS;
    case 'arabic_plurals': return ARABIC_PLURALS;
    case 'arabic_grammar': return ARABIC_GRAMMAR;
    case 'tf': return TRUE_FALSE_FAST;
    case 'emath': return EMOJI_MATH;
    case 'novel': return GUESS_NOVELS;
    case 'landmark': return GUESS_LANDMARKS;
    case 'creature': return GUESS_CREATURES;
    case 'movie_emoji': return MOVIE_EMOJI;
    case 'series_emoji': return SERIES_EMOJI;
    case 'country_emoji': return COUNTRY_EMOJI;
    case 'food_emoji': return FOOD_EMOJI;
    case 'player_emoji': return PLAYER_EMOJI;
    case 'song_emoji': return SONG_EMOJI;
    case 'novel_emoji': return NOVEL_EMOJI;
    case 'landmark_emoji': return LANDMARK_EMOJI;
    case 'creature_emoji': return CREATURE_EMOJI;
    case 'capitals_emoji': return CAPITALS_EMOJI;
    case 'math': return mathRows();
    case 'odd': return oddWordRows();
    default: return GENERAL; // general-purpose trivia
  }
}

/** يشيل الأسماء البديلة والإنجليزية بين الأقواس حتى ما تفضح الخيار الصحيح. */
export function cleanQuizOption(value: string): string {
  return String(value || '')
    .replace(/\s*[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** صورة السيارة المرتبطة بالإجابة الصحيحة للجولة الحالية (تُعرض من قبل البوت في القناة). */
export function quizPhotoUrl(game: QuizGame): string | undefined {
  if (game.kind !== 'cars') return undefined;
  const correct = cleanQuizOption(game.deck[game.qIndex]?.[1] || '');
  return CAR_PHOTO_URLS[correct];
}

/** يسحب سؤالاً واحداً جديداً غير مكرر مع خياراته المخلوطة لاستخدامه في مباريات البطولات الإقصائية */
export function drawQuizQuestion(
  kind: QuizKind,
  usedPrompts: Set<string>
): { prompt: string; options: string[]; correctIdx: number } {
  const pool = packFor(kind);
  let candidates = pool.filter(r => !usedPrompts.has(r[0]));
  if (!candidates.length) {
    usedPrompts.clear();
    candidates = pool.slice();
  }
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  usedPrompts.add(picked[0]);
  const correct = cleanQuizOption(picked[1]);
  const opts = shuffle(picked.slice(1).filter(Boolean).map(cleanQuizOption));
  return {
    prompt: picked[0],
    options: opts,
    correctIdx: opts.indexOf(correct)
  };
}

/**
 * 🔄 ذاكرة تدوير ذكية تمنع تكرار الأسئلة عبر المباريات المتتالية في نفس المحادثة
 * حتى تمر جميع أسئلة البنك بالكامل قبل أن يُعاد أي سؤال من جديد.
 */
const recentDeckHistory = new Map<string, string[]>();

function pickFreshDeck(chatId: string, kind: QuizKind): string[][] {
  const fullPool = packFor(kind);
  if (kind === 'math' || fullPool.length <= TOTAL_ROUNDS) {
    return shuffle(fullPool).slice(0, TOTAL_ROUNDS);
  }

  const histKey = `${chatId || 'global'}::${kind}`;
  const seenList = recentDeckHistory.get(histKey) || [];
  const seenSet = new Set(seenList);

  let unseen = fullPool.filter(row => !seenSet.has(row[0]));
  if (unseen.length < TOTAL_ROUNDS) {
    // اكتملت دورة البنك بالكامل — نبدأ دورة جديدة مع تجنّب آخر جولة مباشرة
    const tail = new Set(seenList.slice(-TOTAL_ROUNDS));
    seenList.length = 0;
    unseen = fullPool.filter(row => !tail.has(row[0]));
    if (unseen.length < TOTAL_ROUNDS) unseen = fullPool.slice();
  }

  const picked = shuffle(unseen).slice(0, TOTAL_ROUNDS);
  for (const r of picked) seenList.push(r[0]);
  if (seenList.length > fullPool.length) {
    seenList.splice(0, seenList.length - fullPool.length);
  }
  recentDeckHistory.set(histKey, seenList);
  return picked;
}

export function createQuiz(chatId: string, chatName: string, kind: QuizKind): QuizGame {
  const deck = pickFreshDeck(chatId, kind);
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
  if (game.status !== 'lobby') return { ok: false, msg: '⚠️ اللعبة بدأت — شارك بالجاية' };
  if (game.players.some(p => p.id === id)) return { ok: false, msg: '✅ أنت مشترك' };
  if (game.players.length >= MAX_PLAYERS) return { ok: false, msg: '🚫 اكتمل العدد (10 لاعبين)' };
  game.players.push({ id, name, score: 0, done: false });
  return { ok: true, msg: '✅ انضميت!' };
}

/** يجهّز الجولة الحالية: يخلط الخيارات ويصفّر إجابات اللاعبين ويبدأ مؤقت 15 ثانية */
function loadRound(game: QuizGame) {
  const row = game.deck[game.qIndex];
  const correct = cleanQuizOption(row[1]);
  // ترتيب ثابت من اليسار لليمين: خطأ يساراً، صح يميناً.
  const opts = game.kind === 'tf'
    ? ['❌ خطأ', '✅ صح']
    : shuffle((row.slice(1) as string[]).filter(x => String(x || '').trim().length > 0).map(cleanQuizOption));
  game.options = opts;
  game.correctIdx = opts.indexOf(correct);
  game.roundDeadline = Date.now() + ROUND_MS;
  game.resultDeadline = undefined;
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
  return { ok: true, msg: '🎮 بدأت اللعبة!' };
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
  if (!p) return { ok: false, msg: '🚫 مو مشترك بهاللعبة', roundClosed: false };
  if (p.done) return { ok: false, msg: '❌ جاوبت هالجولة خلاص', roundClosed: false };

  const isRight = idx === game.correctIdx;
  const row = game.deck[game.qIndex];
  const correctText = row[1];

  // ⚡ وضع السرعة: أول صح يغلق الجولة فوراً
  if (isSpeedQuiz(game)) {
    if (!isRight) {
      p.done = true;
      p.roundHit = false;
      if (game.players.every(x => x.done)) {
        game.status = 'result';
        game.lastLine = `🎯 الإجابة الصحيحة: *${md(correctText)}* — ما جاوبها أحد.`;
        game.roundDeadline = undefined;
        game.resultDeadline = Date.now() + RESULT_MS;
        return { ok: true, msg: '❌ غلط! خارج هالجولة', roundClosed: true };
      }
      return { ok: true, msg: '❌ غلط! خارج هالجولة', roundClosed: false };
    }
    p.score += 1;
    p.done = true;
    p.roundHit = true;
    game.status = 'result';
    game.roundDeadline = undefined;
    game.resultDeadline = Date.now() + RESULT_MS;
    game.lastLine = `> ⚡ \\| *${md(p.name)}* \\| سبق الكل — الجواب: *${md(correctText)}*`;
    return { ok: true, msg: '⚡ صح وسباق! +1 نقطة', roundClosed: true };
  }

  // 🧩 باقي الأنواع: الكل يجاوب وكل صح يحسب
  p.done = true;
  p.roundHit = isRight;
  if (isRight) p.score += 1;

  const allDone = game.players.every(x => x.done);
  if (!allDone) {
    return { ok: true, msg: isRight ? '✅ صح! +1 نقطة' : '❌ غلط', roundClosed: false };
  }

  game.status = 'result';
  game.roundDeadline = undefined;
  game.resultDeadline = Date.now() + (game.kind === 'odd' ? 3500 : RESULT_MS);
  if (game.kind === 'odd') {
    const lnk = oddLinkFor(correctText);
    game.lastLine = lnk
      ? `🎯 الغريبة: *${md(correctText)}*\n💡 _${md(lnk)}_`
      : `🎯 الغريبة: *${md(correctText)}*`;
  } else {
    game.lastLine = '';
  }
  return { ok: true, msg: isRight ? '✅ صح! +1 نقطة' : '❌ غلط', roundClosed: true };
}

/** يختم الجولة على طول (بس لاعب جاوب أصلاً يكدر يضغطها) */
export function quizSkip(game: QuizGame, id: string): { ok: boolean; msg: string } {
  if (game.status !== 'playing') return { ok: false, msg: '⏳ ماكو جولة مفتوحة' };
  const p = game.players.find(x => x.id === id);
  if (!p) return { ok: false, msg: '🚫 مو مشترك بهاللعبة' };
  if (!p.done) return { ok: false, msg: '⚠️ جاوب أول وبعدين ختم الجولة' };

  game.status = 'result';
  game.roundDeadline = undefined;
  game.resultDeadline = Date.now() + RESULT_MS;
  game.lastLine = '';
  return { ok: true, msg: '⏭️ انختمت الجولة' };
}

/** بعد عرض نتيجة الجولة أو انتهاء 10 ثواني: نتأكد ماكو نهاية مبكرة ونجهّز الجولة الجاية أو نختم */
export function quizAdvance(game: QuizGame): { over: boolean; smart: boolean } {
  // 🧠 نهاية ذكية (وضع السرعة): إذا المتصدر مستحيل ينلحق
  if (isSpeedQuiz(game) && game.players.length) {
    const ordered = game.players.slice().sort((a, b) => b.score - a.score);
    const remaining = game.totalRounds - game.round; // جولات بعد الحالية
    const top = ordered[0].score;
    const second = ordered[1]?.score ?? 0;
    if (second + remaining < top) {
      game.status = 'game_over';
      game.roundDeadline = undefined;
      game.resultDeadline = undefined;
      return { over: true, smart: true };
    }
  }

  if (game.round >= game.totalRounds) {
    game.status = 'game_over';
    game.roundDeadline = undefined;
    game.resultDeadline = undefined;
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
  const SEP = '━━━━━━━━━━━━━━━━━━━';

  if (game.status === 'lobby') {
    const lines = [`${meta.emoji} *${meta.title}*`, ''];
    lines.push(`👥 *اللاعبين \\(${game.players.length}/${MAX_PLAYERS}\\):*`);
    if (!game.players.length) {
      lines.push(`_ماكو أحد بعد_`);
    } else {
      lines.push(game.players.map((p, i) => scoreLine(i + 1, p.name, p.score)).join('\n'));
    }
    return lines.join('\n');
  }

  if (game.status === 'game_over') {
    const sorted = game.players.slice().sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    const lines = [`${meta.emoji} *${meta.title}*`, `🏁 *خلصت اللعبة\\!*`];
    if (winner && winner.score > 0) {
      lines.push('');
      lines.push(`🏆 *الفائز:*`);
      lines.push(`> \\| *${md(winner.name)}* \\|`);
    }
    lines.push(SEP);
    lines.push(`📊 *الترتيب النهائي:*`);
    lines.push(sorted.map((p, i) => scoreLine(i + 1, p.name, p.score)).join('\n'));
    return lines.join('\n');
  }

  // playing / result
  const lines = [`${meta.emoji} *${meta.title}* • الجولة *${game.round}* من *${game.totalRounds}*`];

  if (game.status === 'result' && game.lastLine) {
    lines.push(game.lastLine);
  }

  if (game.status === 'playing') {
    lines.push('');
    lines.push(`❓ *${md(game.deck[game.qIndex][0])}*`);
    lines.push(`⚡ _أول إجابة صحيحة فقط تكسب نقطة الجولة\\!_`);
  }

  lines.push(SEP);
  lines.push(`🏆 *النقاط:*`);
  const ranked = game.players.slice().sort((a, b) => b.score - a.score);
  const playerBlocks = ranked.map((p, i) => {
    const mark = p.done ? (p.roundHit ? ' ✅' : ' ❌') : ' ⏳';
    return scoreLine(i + 1, p.name, p.score, mark);
  });
  lines.push(playerBlocks.join('\n'));

  return lines.join('\n');
}

/** لوحة الأزرار أثناء اللعب — 4 خيارات (2×2) */
export function quizKeyboard(game: QuizGame): any[][] {
  const chatId = game.chatId;

  if (game.status === 'lobby') {
    return [
      [{ text: 'انضم', callback_data: `gqj:${game.kind}:${chatId}` }],
      [{ text: '🎮 ابدأ اللعبة', callback_data: `gqs:${game.kind}:${chatId}` }]
    ];
  }

  if (game.status === 'playing') {
    const kb: any[][] = [];
    const opts = game.options;
    for (let i = 0; i < opts.length; i += 2) {
      const row: any[] = [{ text: cut(opts[i], 30), callback_data: `gqa:${i}:${game.kind}:${chatId}` }];
      if (opts[i + 1] !== undefined) row.push({ text: cut(opts[i + 1], 30), callback_data: `gqa:${i + 1}:${game.kind}:${chatId}` });
      kb.push(row);
    }
    return kb;
  }

  if (game.status === 'result') {
    return [[{ text: '⏳ الجولة الجاية…', callback_data: `gqv:${game.kind}:${chatId}` }]];
  }

  return [[{ text: '🔄 لعبة جديدة', callback_data: `gqn:${game.kind}:${chatId}` }]];
}

function cut(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ---------------------------------------------------------------------
// 🔐 ماسترمايند — كسر الرقم السري (4 أرقام غير مكررة)
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
  inlineMessageId?: string;
  status: 'lobby' | 'playing' | 'game_over';
  players: MMPlayer[];
  turnIdx: number;
  secret: string;
  entry: string;
  history: { name: string; guess: string; black: number; white: number }[];
  winnerId?: string;
  rewarded?: boolean;
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
  if (game.players.length >= MAX_PLAYERS) return { ok: false, msg: '🚫 امتلأت (10 لاعبين)' };
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
  if (game.entry.length >= 4) return { ok: false, msg: '☑️ كمّلت 4 أرقام — اضغط تأكيد أو مسح' };
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
    return { ok: false, msg: '⚠️ لازم 4 أرقام مختلفة (بلا تكرار)', won: false, stuck: false };
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
  const SEP = '━━━━━━━━━━━━━━━━━━━';
  const lines = [`🔐 *ماسترمايند — كسر الرقم السري*`];

  if (game.status === 'lobby') {
    lines.push('');
    lines.push(`👥 *اللاعبين \\(${game.players.length}/${MAX_PLAYERS}\\):*`);
    if (!game.players.length) {
      lines.push(`_ماكو أحد بعد_`);
    } else {
      lines.push(game.players.map((p, i) => `> ${i + 1} \\- \\| *${md(p.name)}* \\|`).join('\n'));
    }
    return lines.join('\n');
  }

  if (game.status === 'game_over') {
    lines.push(`🏁 *خلصت اللعبة\\!*`);
    lines.push(SEP);
    if (game.winnerId) {
      const w = game.players.find(p => p.id === game.winnerId);
      lines.push(`🏆 *الفائز:*`);
      lines.push(`> \\| *${md(w?.name || 'مجهول')}* \\|`);
      lines.push(`كسّر الرقم بـ *${w?.tries}* محاولات\\!`);
    } else {
      lines.push(`💔 محد كسر الرقم — البوت غلبكم هالمرة 😎`);
    }
    lines.push(`🔑 الرقم السري كان: *${game.secret.split('').join(' ')}*`);
    if (game.history.length) {
      lines.push(SEP);
      lines.push(`📝 *المحاولات:*`);
      lines.push(
        game.history
          .slice(0, 10)
          .map((h, i) => `> ${i + 1} \\- \\| *${md(h.name)}* \\| ${h.guess.split('').join(' ')} → ${'⚫'.repeat(h.black)}${'⚪'.repeat(h.white)}`)
          .join('\n')
      );
    }
    return lines.join('\n');
  }

  const cur = mmCurrent(game);
  lines.push(`> 🎯 الدور على: \\| *${md(cur?.name || '')}* \\| \\(باقي إله ${MM_MAX_TRIES_EACH - (cur?.tries || 0)} محاولات\\)`);
  lines.push(`✍️ تخمينك: *${game.entry ? game.entry.split('').join(' ') : '◻ ◻ ◻ ◻'}*`);
  lines.push(SEP);
  if (game.history.length) {
    lines.push(`📝 *آخر المحاولات:*`);
    lines.push(
      game.history
        .slice(0, 6)
        .map((h, i) => `> ${i + 1} \\- \\| *${md(h.name)}* \\| ${h.guess.split('').join(' ')} → ${'⚫'.repeat(h.black)}${'⚪'.repeat(h.white)}`)
        .join('\n')
    );
  } else {
    lines.push(`_ماكو محاولات بعد — أول واحد يجرب_`);
  }
  lines.push(`⚫ صح بمكانه • ⚪ صح بمكان غلط`);
  return lines.join('\n');
}

export function mmKeyboard(game: MMGame): any[][] {
  const chatId = game.chatId;

  if (game.status === 'lobby') {
    return [
      [{ text: 'انضم', callback_data: `mmj:${chatId}` }],
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
