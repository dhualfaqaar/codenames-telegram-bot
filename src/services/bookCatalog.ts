/**
 * مكتبة الكتب الكبيرة — تُبنى تلقائياً من Open Library (بلا أي مفتاح).
 *
 * الفكرة: «كل كتب العالم» ما تنحفظ (٤٠+ مليون سجل)، فنبني مكتبة محلية كبيرة
 * تدريجياً من الـAPI نفسه، ونسقط عليها البحث والاقتراح العشوائي بلا نت.
 *
 * التخزين: مقسّم لدفعات (chunks) لأن قيمة مفتاح واحد بالـDurable Object
 * محدودة بـ128 كيلوبايت. كل دفعة 200 كتاب، والـmeta يحفظ مؤشر البذر حتى نكمل
 * بعدة منبّهات بدل طلب واحد طويل.
 */

import { LITERARY_GENRES, LITERATURE_BY_LANGUAGE } from './bookRecommendationEngine';
import { isUsableDescription, tidyDescription } from './bookDescriptions';
import type { BookGenre } from './bookRecommendationEngine';

export interface CatalogBook {
  /** معرّف العمل عند Open Library مثل OL27448W */
  id: string;
  title: string;
  author: string;
  year: number | null;
  pages: number | null;
  /** رقم الغلاف عند Open Library (covers.openlibrary.org) */
  cover: number | null;
  /** رمز اللغة ISO 639-2 مثل ara / eng / rus */
  lang: string;
  subject: string;
  /** تصنيفات الكتاب من مواضيعه عند Open Library (مفاتيح BookGenre) */
  genres?: string[];
  /** جملة الافتتاح من Open Library (تصلح كنبذة قصيرة) */
  first?: string;
  /** معرّف النسخة على Internet Archive (للتحميل) */
  ia?: string;
  /** إشارة Open Library لنسخة ممسوحة متاحة للعامة، لا تثبت الملكية العامة وحدها */
  pd?: boolean;
}

export interface BookStorageAdapter {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

export interface CatalogMeta {
  total: number;
  chunkCount: number;
  /** مؤشر مصدر البذر الحالي (لغة أو لغة+تصنيف) */
  sourceIndex?: number;
  /** قديم — بقي للتوافق مع بيانات مخزّنة سابقاً */
  langIndex?: number;
  /** قديم — بقي للتوافق مع بيانات مخزّنة سابقاً */
  queryIndex?: number;
  page: number;
  done: boolean;
  updatedAt: number;
  /** عدد الطلبات الناجحة والفاشلة حتى نعرف صحة البذر */
  requests: number;
  failures: number;
  /** عدد السجلات المرفوضة لنقص البيانات */
  rejected: number;
  /** كم طلب فشل ورا بعض (يصفّر عند أول نجاح) */
  streak: number;
  /** مرحلة الترتيب: ندوّر نفس اللغات بترتيب مختلف حتى نطلع كتب جديدة */
  sortStage: number;
  /** كم مرة كملنا دورة اللغات كلها */
  wrapCount: number;
  /** مؤشر تعويض الفلسفة */
  phiIndex?: number;
  /** صفحة تعويض الفلسفة */
  phiPage?: number;
}

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  first_sentence?: string[] | string;
  ia?: string[];
  public_scan_b?: boolean;
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number;
  language?: string[];
  subject?: string[];
}

/** اللغات اللي نبذر منها، بالترتيب: العربي أولاً. */
export const CATALOG_LANGUAGES: Array<{ code: string; label: string; queries?: string[] }> = [
  {
    code: 'ara',
    label: 'العربية',
    // استعلامات عربية صريحة حتى نطلع كتب عربية أصلية مو بس ترجمات.
    queries: [
      'language:ara',
      'subject:"Arabic fiction"',
      'subject:"Arabic poetry"',
      'subject:"Arabic literature"',
      'subject:"Arabic drama"',
      'subject:"Arabic essays"'
    ]
  },
  { code: 'eng', label: 'الإنجليزية', queries: ['language:eng', 'subject:"English fiction"', 'subject:"English poetry"'] },
  { code: 'fre', label: 'الفرنسية', queries: ['language:fre', 'subject:"French fiction"'] },
  { code: 'ger', label: 'الألمانية', queries: ['language:ger', 'subject:"German fiction"'] },
  { code: 'rus', label: 'الروسية', queries: ['language:rus', 'subject:"Russian fiction"'] },
  { code: 'spa', label: 'الإسبانية', queries: ['language:spa', 'subject:"Spanish fiction"'] },
  { code: 'ita', label: 'الإيطالية', queries: ['language:ita', 'subject:"Italian fiction"'] },
  { code: 'ron', label: 'الرومانية', queries: ['language:ron', 'subject:"Romanian fiction"'] },
  { code: 'tur', label: 'التركية', queries: ['language:tur', 'subject:"Turkish fiction"'] },
  { code: 'per', label: 'الفارسية', queries: ['language:per', 'subject:"Persian fiction"'] },
  { code: 'urd', label: 'الأردية', queries: ['language:urd'] },
  { code: 'heb', label: 'العبرية', queries: ['language:heb'] },
  { code: 'hin', label: 'الهندية', queries: ['language:hin'] },
  { code: 'por', label: 'البرتغالية', queries: ['language:por'] },
  { code: 'dut', label: 'الهولندية', queries: ['language:dut'] },
  { code: 'pol', label: 'البولندية', queries: ['language:pol'] },
  { code: 'swe', label: 'السويدية', queries: ['language:swe'] },
  { code: 'nor', label: 'النرويجية', queries: ['language:nor'] },
  { code: 'dan', label: 'الدنماركية', queries: ['language:dan'] },
  { code: 'fin', label: 'الفنلندية', queries: ['language:fin'] },
  { code: 'cze', label: 'التشيكية', queries: ['language:cze'] },
  { code: 'hun', label: 'الهنجارية', queries: ['language:hun'] },
  { code: 'gre', label: 'اليونانية', queries: ['language:gre'] },
  { code: 'ukr', label: 'الأوكرانية', queries: ['language:ukr'] },
  { code: 'ind', label: 'الإندونيسية', queries: ['language:ind'] },
  { code: 'may', label: 'الماليزية', queries: ['language:may'] },
  { code: 'kor', label: 'الكورية', queries: ['language:kor'] },
  { code: 'jpn', label: 'اليابانية', queries: ['language:jpn'] },
  { code: 'chi', label: 'الصينية', queries: ['language:chi'] },
  { code: 'ben', label: 'البنغالية', queries: ['language:ben'] },
  { code: 'tam', label: 'التاميلية', queries: ['language:tam'] },
  { code: 'vie', label: 'الفيتنامية', queries: ['language:vie'] },
  { code: 'tha', label: 'التايلندية', queries: ['language:tha'] },
  { code: 'mal', label: 'المالايالامية', queries: ['language:mal'] },
  { code: 'fil', label: 'الفلبينية', queries: ['language:fil'] },
  { code: 'bul', label: 'البلغارية', queries: ['language:bul'] },
  { code: 'srp', label: 'الصربية', queries: ['language:srp'] },
  { code: 'hrv', label: 'الكرواتية', queries: ['language:hrv'] },
  { code: 'cat', label: 'الكتالونية', queries: ['language:cat'] },
  { code: 'afr', label: 'الأفريقانية', queries: ['language:afr'] },
  { code: 'swa', label: 'السواحيلية', queries: ['language:swa'] }
];

export const GENRE_SUBJECTS: Record<BookGenre, string[]> = {
  novel: [
    'fiction', 'novel', 'novels', 'roman', 'romans', 'erzählung', 'literature', 'literary',
    'novela', 'romanzo', 'romance', 'prose', 'narrative', 'storytelling',
    'رواية', 'روايات', 'أدب', 'قصص', 'حكاية'
  ],
  short_stories: [
    'short stories', 'short story', 'tales', 'nouvelles', 'novellen', 'cuentos',
    'anthology', 'collected stories', 'قصص قصيرة', 'قصة قصيرة', 'مختارات'
  ],
  poetry: [
    'poetry', 'poems', 'poem', 'verse', 'verses', 'poet', 'poets', 'poésie', 'gedichte',
    'poesía', 'poesia', 'versos', 'شعر', 'قصائد', 'ديوان', 'شاعر', 'منظومة'
  ],
  theater: [
    'drama', 'plays', 'play', 'theater', 'theatre', 'tragedy', 'comedy', 'stage',
    'théâtre', 'dramaturgy', 'مسرح', 'مسرحيات', 'دراما', 'مسرحية'
  ],
  history: [
    'history', 'historical', 'historiography', 'chronicle', 'chronicles', 'civilization',
    'war', 'wars', 'empire', 'revolution', 'histoire', 'geschichte', 'historia',
    'تاريخ', 'تاريخي', 'حضارة', 'حروب', 'ثورة', 'دولة'
  ],
  philosophy: [
    'philosophy', 'philosophical', 'philosopher', 'ethics', 'metaphysics', 'logic',
    'epistemology', 'political philosophy', 'existentialism', 'stoicism', 'philosophie',
    'فلسفة', 'فلسفي', 'منطق', 'أخلاق', 'ميتافيزيقا', 'وجودية'
  ],
  self_help: [
    'self-help', 'self help', 'self improvement', 'conduct of life', 'personal growth',
    'success', 'motivation', 'psychology', 'popular works', 'habits', 'productivity',
    'mindfulness', 'développement personnel', 'تطوير الذات', 'تنمية بشرية', 'تطوير',
    'نفسي', 'علم النفس', 'عادات', 'نجاح'
  ],
  sci_fi: [
    'science fiction', 'sci-fi', 'scifi', 'space', 'spaceship', 'dystopia',
    'utopia', 'time travel', 'robots', 'aliens', 'cyberpunk', 'science-fiction',
    'خيال علمي', 'مستقبل', 'فضاء', 'روبوت'
  ],
  mystery: [
    'mystery', 'detective', 'crime', 'criminal', 'thriller', 'suspense', 'police',
    'murder', 'spy', 'espionage', 'noir', 'roman policier', 'krimi', 'novela negra',
    'بوليسي', 'غموض', 'جريمة', 'جرائم', 'تحقيق', 'مخبر', 'قتل'
  ],
  horror: [
    'horror', 'ghost', 'ghosts', 'vampire', 'gothic', 'supernatural', 'monster',
    'zombie', 'haunted', 'épouvante', 'terrifying', 'رعب', 'أشباح', 'وحوش', 'مصاصي الدماء'
  ],
  biography: [
    'biography', 'biographies', 'autobiography', 'memoir', 'memoirs', 'diaries', 'diary',
    'letters', 'correspondence', 'life and times', 'biographie', 'lebenslauf',
    'سيرة', 'سيرة ذاتية', 'مذكرات', 'يوميات', 'رسائل', 'ترجمة حياة'
  ],
  children: [
    'juvenile', 'juvenile fiction', 'children', 'childrens', "children's", 'fairy tales',
    'fairy tale', 'picture book', 'young adult', 'kids', 'nursery', 'bedtime',
    'enfants', 'kinder', 'أطفال', 'حكايات', 'حكاية', 'طفل', 'صغار'
  ],
  psychology: [
    'psychology', 'psychological', 'psychoanalysis', 'psychiatry', 'mental health',
    'cognitive', 'behavior', 'behaviour', 'freud', 'jung', 'psychotherapy',
    'علم النفس', 'نفسي', 'تحليل نفسي', 'صحة نفسية', 'سلوك'
  ],
  arabic_lit: [
    'arabic literature', 'arabic fiction', 'arabic poetry', 'arabic drama', 'arabic essays',
    'أدب عربي', 'الأدب العربي', 'شعر عربي', 'رواية عربية', 'دواوين', 'ديوان شعر'
  ],
  english_lit: [
    'english literature', 'english fiction', 'english poetry', 'english drama',
    'shakespeare', 'victorian', 'elizabethan', 'أدب إنجليزي'
  ],
  french_lit: [
    'french literature', 'french fiction', 'french poetry', 'littérature française',
    'roman français', 'أدب فرنسي'
  ],
  russian_lit: [
    'russian literature', 'russian fiction', 'russian poetry', 'русская литература',
    'أدب روسي'
  ],
  german_lit: [
    'german literature', 'german fiction', 'german poetry', 'deutsche literatur',
    'أدب ألماني'
  ],
  politics: [
    'politics', 'political science', 'government', 'geopolitics', 'democracy',
    'dictatorship', 'elections', 'public policy', 'international relations',
    'سياسة', 'علوم سياسية', 'حكم', 'ديمقراطية', 'انتخابات', 'سياسي'
  ],
  economics: [
    'economics', 'economic', 'communism', 'socialism', 'capitalism', 'marxism',
    'economy', 'finance, public', 'trade', 'labor', 'labour', 'اقتصاد', 'شيوعية',
    'اشتراكية', 'رأسمالية', 'ماركسية', 'اقتصادي'
  ],
  science: [
    'science', 'physics', 'chemistry', 'biology', 'astronomy', 'evolution',
    'genetics', 'ecology', 'neuroscience', 'quantum', 'علوم', 'فيزياء', 'كيمياء',
    'أحياء', 'فلك', 'تطور', 'علم الأحياء'
  ],
  math: [
    'mathematics', 'math', 'algebra', 'geometry', 'calculus', 'statistics',
    'probability', 'number theory', 'رياضيات', 'جبر', 'هندسة', 'إحصاء', 'حساب'
  ],
  sports: [
    'sports', 'sport', 'football', 'soccer', 'olympics', 'athletics', 'basketball',
    'boxing', 'martial arts', 'رياضة', 'كرة القدم', 'أولمبياد', 'رياضي', 'ملاكمة'
  ],
  medicine: [
    'medicine', 'medical', 'health', 'nutrition', 'disease', 'surgery', 'anatomy',
    'nursing', 'pharmacology', 'طب', 'صحة', 'تغذية', 'مرض', 'جراحة', 'تشريح', 'تمريض'
  ],
  arts: [
    'art', 'arts', 'music', 'painting', 'cinema', 'photography', 'architecture',
    'sculpture', 'theater, music', 'فنون', 'فن', 'موسيقى', 'رسم', 'سينما', 'تصوير', 'عمارة'
  ],
  mythology: [
    'mythology', 'myth', 'myths', 'folklore', 'legends', 'legend', 'fairy tales, folklore',
    'أساطير', 'خرافات', 'فلكلور', 'أسطورة', 'حكايات شعبية'
  ],
  comics: [
    'comics', 'comic books', 'graphic novels', 'graphic novel', 'cartoons',
    'كوميكس', 'قصص مصورة', 'روايات مصورة'
  ],
  manga: [
    'manga', 'anime', 'shonen', 'shojo', 'seinen', 'مانغا', 'مانجا', 'أنمي'
  ],
  fantasy: [
    'fantasy', 'fantasy fiction', 'magic', 'dragons', 'wizards', 'elves',
    'fairy tale, fantasy', 'فانتازيا', 'سحر', 'تنانين', 'سحرة'
  ]
};

/**
 * التصنيف الافتراضي لأي كتاب ما قدرنا نصنّفه من مواضيعه. الهدف: **صفر كتاب
 * بدون صنف** — كل كتب المكتبة لازم تنحسب على صنف واحد على الأقل.
 */
export const DEFAULT_GENRE: BookGenre = 'novel';

/** يستخرج تصنيفات الكتاب من مواضيعه (ويعتمد على العنوان كخط ثاني). */
export function classifyBook(subjects: string[], title = '', lang = ''): string[] {
  const haystack = `${subjects.join(' | ')} | ${title}`.toLowerCase();
  const found: string[] = [];
  for (const genre of Object.keys(GENRE_SUBJECTS) as BookGenre[]) {
    if (GENRE_SUBJECTS[genre].some(word => haystack.includes(word))) found.push(genre);
  }
  // فصل الآداب حسب اللغة: كتاب أدبي عربي/إنجليزي/فرنسي/روسي/ألماني ياخذ وسم أدبه.
  const literature = LITERATURE_BY_LANGUAGE[lang];
  if (literature && found.some(genre => LITERARY_GENRES.includes(genre as BookGenre)) && !found.includes(literature)) {
    found.push(literature);
  }
  return found.slice(0, 5);
}

/**
 * نفس التصنيف بس يضمن نتيجة: لو ما طابقت المواضيع شي نرجع التصنيف الافتراضي
 * حتى ما يبقى أي كتاب خارج الأصناف (هذا كان سبب «مكتبة ١٠,٠٠٠ وأصناف قليلة»).
 */
export function classifyBookStrict(subjects: string[], title = '', lang = ''): string[] {
  const found = classifyBook(subjects, title, lang);
  return found.length ? found : [DEFAULT_GENRE];
}

/** المواضيع اللي نبذر بيها لكل تصنيف حتى المكتبة تغطي كل الأصناف. */
export const GENRE_SEED_SUBJECTS: Record<BookGenre, string> = {
  novel: 'Fiction',
  short_stories: 'Short stories',
  poetry: 'Poetry',
  theater: 'Drama',
  history: 'History',
  philosophy: 'Philosophy',
  self_help: 'Self-help',
  sci_fi: 'Science fiction',
  mystery: 'Detective and mystery stories',
  horror: 'Horror tales',
  biography: 'Biography',
  children: "Children's literature",
  psychology: 'Psychology',
  arabic_lit: 'Arabic literature',
  english_lit: 'English literature',
  french_lit: 'French literature',
  russian_lit: 'Russian literature',
  german_lit: 'German literature',
  politics: 'Politics',
  economics: 'Economics',
  science: 'Science',
  math: 'Mathematics',
  sports: 'Sports',
  medicine: 'Medicine',
  arts: 'Art',
  mythology: 'Mythology',
  comics: 'Comics & Graphic Novels',
  manga: 'Manga',
  fantasy: 'Fantasy fiction'
};

/** الفلسفة أكثر صنف مطلوب — نضمن له عدد أدنى بالمكتبة. */
export const PHILOSOPHY_MIN = 1_200;
/** سقف أعلى للمكتبة وقت تعويض الفلسفة (نتجاوز الهدف شوي بدل ما نضغط الأصناف). */
export const CATALOG_MAX = 26_000;

/** مواضيع الفلسفة اللي نبذر بيها لحد ما نوصل العدد الأدنى. */
export const PHILOSOPHY_SUBJECTS = [
  'Philosophy',
  'Philosophy, Ancient',
  'Ethics',
  'Logic',
  'Metaphysics',
  'Existentialism',
  'Stoicism',
  'Political philosophy',
  'Philosophy and religion',
  'Islamic philosophy',
  'Sufism',
  'Philosophy, Arab',
  'فلسفة'
];
export const CATALOG_TARGET = 20_000;
/** مصادر البذر: لغة صرفة، أو لغة + تصنيف حتى كل صنف ياخذ حصته. */
export interface SeedSource {
  q: string;
  lang: string;
  genre?: BookGenre;
}

/**
 * ترتيب المصادر: العربية أولاً، بعدها الأصناف الاثنا عشر لكل لغة من اللغات
 * الكبيرة، وبعدها بقية اللغات. كل مصدر يعطي ١٠٠ كتاب بالصفحة، فدورة وحدة
 * تمر على كل الأصناف — هذا اللي يخلّي «كتاب ثاني» ما يلف بين ٤ كتب.
 */
/** كل صنف أدبي مرتبط بلغة معيّنة — ما نخلط «أدب إنجليزي» ببذر عربي. */
const GENRE_LANGUAGE_LOCK: Partial<Record<BookGenre, string>> = {
  arabic_lit: 'ara',
  english_lit: 'eng',
  french_lit: 'fre',
  russian_lit: 'rus',
  german_lit: 'ger'
};

export function buildSeedSources(): SeedSource[] {
  const sources: SeedSource[] = [];
  const genreKeys = Object.keys(GENRE_SEED_SUBJECTS) as BookGenre[];

  // ١) العربية: لغة + كل صنف (بالعربي أولاً حتى الكتب العربية تاخذ نصيبها).
  sources.push({ q: 'language:ara', lang: 'ara' });
  for (const genre of genreKeys) {
    const locked = GENRE_LANGUAGE_LOCK[genre];
    if (locked && locked !== 'ara') continue;
    sources.push({ q: `language:ara AND subject:"${GENRE_SEED_SUBJECTS[genre]}"`, lang: 'ara', genre });
  }
  for (const subject of ['Arabic fiction', 'Arabic poetry', 'Arabic literature', 'Arabic drama']) {
    sources.push({ q: `language:ara AND subject:"${subject}"`, lang: 'ara' });
  }

  // ٢) اللغات الكبيرة: لغة + كل صنف.
  const bigLanguages = ['eng', 'fre', 'ger', 'rus', 'spa', 'ita', 'ron', 'tur'];
  for (const code of bigLanguages) {
    sources.push({ q: `language:${code}`, lang: code });
    for (const genre of genreKeys) {
      const locked = GENRE_LANGUAGE_LOCK[genre];
      if (locked && locked !== code) continue;
      sources.push({ q: `language:${code} AND subject:"${GENRE_SEED_SUBJECTS[genre]}"`, lang: code, genre });
    }
  }

  // ٣) بقية اللغات.
  for (const language of CATALOG_LANGUAGES) {
    if (language.code === 'ara' || bigLanguages.includes(language.code)) continue;
    sources.push({ q: `language:${language.code}`, lang: language.code });
  }
  return sources;
}

export const SEED_SOURCES = buildSeedSources();

/** مصادر الفلسفة وحدها (بكل لغة كبيرة + العربية) لتعويض الصنف الأشهر. */
export function buildPhilosophySources(): SeedSource[] {
  const sources: SeedSource[] = [];
  const languages = ['ara', 'eng', 'fre', 'ger', 'rus', 'spa', 'ita', 'ron', 'tur', 'per'];
  for (const code of languages) {
    for (const subject of PHILOSOPHY_SUBJECTS) {
      if (subject === 'فلسفة') {
        sources.push({ q: `language:${code} AND subject:"فلسفة"`, lang: code, genre: 'philosophy' });
        continue;
      }
      sources.push({ q: `language:${code} AND subject:"${subject}"`, lang: code, genre: 'philosophy' });
    }
  }
  return sources;
}

export const PHILOSOPHY_SOURCES = buildPhilosophySources();


/**
 * خريطة «موضوع Open Library ← تصنيفنا». المفاتيح إنجليزية لأن Open Library
 * توسم أغلب الكتب بمواضيع إنجليزية حتى لو الكتاب عربي، وأضفنا كلمات عربية
 * وفرنسية/ألمانية شائعة حتى نلتقط كتب ما إلها وسم إنجليزي.
 */

const CHUNK_SIZE = 200;
// سقف عالي للصفحات: الحاجة الفعلية ١٠,٠٠٠ كتاب، وكل استعلام يعطي ١٠٠ كتاب
// بالصفحة، فـ٤٠ صفحة لكل استعلام تكفي وتخلّي التوزيع بين اللغات متوازن.
const MAX_PAGE_PER_QUERY = 40;
/** كم مرة نعيد دورة اللغات كلها قبل ما نعتبر المكتبة خلصت (حماية من حلقة لا نهائية). */
const MAX_WRAP = 3;
/** عدد محاولات نفس الصفحة قبل ما نوقف دفعة البذر الحالية. */
const FETCH_ATTEMPTS = 3;
/** ترتيب Open Library لكل مرحلة: نكرر اللغات بترتيب مختلف حتى نتجاوز التكرار. */
const SORT_STAGES = ['', 'new', 'old', 'random'];
const API_FIELDS =
  'key,title,author_name,first_publish_year,number_of_pages_median,cover_i,language,subject,first_sentence,ia,public_scan_b';
const USER_AGENT = 'CodenamesTelegramBot/1.0 (book catalog; https://t.me/code_games)';

const META_KEY = 'books:meta';
const CHUNK_PREFIX = 'books:chunk:';

const EMPTY_META: CatalogMeta = {
  total: 0,
  chunkCount: 0,
  sourceIndex: 0,
  langIndex: 0,
  queryIndex: 0,
  page: 1,
  done: false,
  updatedAt: 0,
  requests: 0,
  failures: 0,
  rejected: 0,
  streak: 0,
  sortStage: 0,
  wrapCount: 0,
  phiIndex: 0,
  phiPage: 1
};

/** تخزين بالذاكرة — للتشغيل المحلي والفحوص لما ماكو Durable Object. */
export function memoryBookStorage(): BookStorageAdapter {
  const store = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return store.get(key) as T | undefined;
    },
    async put(key: string, value: unknown) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list<T>(options?: { prefix?: string }) {
      const prefix = options?.prefix || '';
      const out = new Map<string, T>();
      for (const [key, value] of store) if (key.startsWith(prefix)) out.set(key, value as T);
      return out;
    }
  };
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** ينظّف وصف Open Library من الوسوم والأسطر المتعددة. */
export function cleanDescription(value: string): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function tidy(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * تطبيع عربي/لاتيني للمقارنة: التشكيل، الهمزات، التاء المربوطة، الياء، الحروف
 * الكبيرة والصغيرة. بدونه «نجيب محفوظ» ما يطابق «نجيب محفوظ» لو مكتوب بهمزة،
 * وهذا سبب رسالة «ما لكيت نتيجة» اللي صارت.
 */
/** هل النص فيه حروف عربية؟ */
export function hasArabic(value: string): boolean {
  return /[\u0600-\u06FF]/.test(String(value || ''));
}

/** يشيل «تأليف» و«بقلم» من عبارة المؤلف. */
export function stripAuthorPrefix(value: string): string {
  return String(value || '')
    .replace(/^\s*(?:تأليف|بقلم|اعداد|إعداد|ترجمة|تحقيق)[:\s]+/u, '')
    .replace(/^\s*(?:by|author)[:\s]+/i, '')
    .trim();
}

export function normalizeQuery(value: string): string {
  return String(value || '')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '') // تشكيل وتطويل
    .replace(/[\u0623\u0625\u0622\u0671]/g, 'ا') // أ إ آ ٱ ← ا
    .replace(/\u0649/g, 'ي') // ى ← ي
    .replace(/\u0629/g, 'ه') // ة ← ه
    .replace(/\u0624/g, 'و') // ؤ ← و
    .replace(/\u0626/g, 'ي') // ئ ← ي
    .replace(/['\u2019\u2018`]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** يحوّل نتيجة Open Library لسجل نظيف، أو null لو ناقص. */
export function cleanCatalogDoc(doc: OpenLibraryDoc, fallbackLang: string, preferFallbackLang = false): CatalogBook | null {
  const rawKey = String(doc.key || '');
  const id = rawKey.replace('/works/', '').trim();
  const title = tidy(String(doc.title || ''), 120);
  const author = tidy(String(doc.author_name?.[0] || ''), 80);
  if (!id || title.length < 2 || author.length < 2) return null;
  const year = Number(doc.first_publish_year);
  const pages = Number(doc.number_of_pages_median);
  const cover = Number(doc.cover_i);
  const subjects = (doc.subject || []).map(item => String(item || ''));
  const firstRaw = Array.isArray(doc.first_sentence) ? doc.first_sentence[0] : doc.first_sentence;
  const firstSentence = tidy(String(firstRaw || ''), 240);
  const ia = tidy(String(doc.ia?.[0] || ''), 80);
  const langValue = tidy(String((preferFallbackLang ? fallbackLang : doc.language?.[0]) || fallbackLang), 8) || fallbackLang;
  const subject = tidy(subjects[0] || '', 40);
  return {
    id,
    title,
    author,
    year: Number.isFinite(year) && year > 600 && year <= new Date().getFullYear() + 1 ? year : null,
    pages: Number.isFinite(pages) && pages > 10 && pages < 5000 ? pages : null,
    cover: Number.isFinite(cover) && cover > 0 ? cover : null,
    lang: langValue,
    subject,
    genres: classifyBookStrict(subjects, title, langValue),
    first: firstSentence.length > 15 ? firstSentence : undefined,
    ia: ia || undefined,
    pd: doc.public_scan_b === true
  };
}

export interface ArchiveFile {
  /** رابط الملف المباشر على إنترنت أرشيف */
  url: string;
  /** معرّف النسخة على إنترنت أرشيف (identifier) */
  identifier: string;
  fileName: string;
  sizeBytes: number | null;
  /** من وين جبنا المعرّف: بطاقة الكتاب / طبعات Open Library */
  source: 'catalog' | 'editions';
}

/**
 * يختار ملف PDF **حر التحميل** من رد `archive.org/metadata/{id}`.
 *
 * قواعد القانونية (خط أحمر):
 *  - نرفض أي نسخة محفوظة: `access-restricted-item` أو مجموعات `inlibrary` / `printdisabled` / `lending*`.
 *  - نرفض أي ملف `private: true`.
 *  - غير هيك نرجّع null — ما نخترع رابط ولا نرسل ملف مقرصن.
 */
export function pickArchivePdf(
  identifier: string,
  payload: any,
  source: ArchiveFile['source'] = 'catalog'
): ArchiveFile | null {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(identifier) || !payload) return null;
  const meta = payload.metadata || {};
  // توفر الملف للعامة لا يعني انتهاء حقوقه. نقبل تصريح ملكية عامة صريح فقط.
  const rights = Array.isArray(meta.rights) ? meta.rights : [meta.rights];
  const licenses = Array.isArray(meta.licenseurl) ? meta.licenseurl : [meta.licenseurl];
  const publicDomain = rights.some((value: unknown) => /^(public domain|not_in_copyright|out of copyright)$/i.test(String(value || '').trim())) ||
    licenses.some((value: unknown) => /^https?:\/\/creativecommons\.org\/publicdomain\/(zero\/1\.0|mark\/1\.0)\/?$/i.test(String(value || '').trim()));
  if (!publicDomain) return null;
  if (/^(true|1|yes)$/i.test(String(meta['access-restricted-item'] || ''))) return null;
  if (/^(true|1|yes)$/i.test(String(meta['is_dark'] || payload.is_dark || ''))) return null;
  const rawCollection = meta.collection ?? meta.collections ?? [];
  const collections: string[] = Array.isArray(rawCollection) ? rawCollection.map(String) : [String(rawCollection)];
  const lowered = collections.map(value => value.toLowerCase());
  if (lowered.some(value => value === 'inlibrary' || value === 'printdisabled' || value.startsWith('lending'))) return null;

  const files: any[] = Array.isArray(payload.files) ? payload.files : [];
  const pdfs = files.filter(file => {
    if (typeof file?.name !== 'string' || !/\.pdf$/i.test(file.name)) return false;
    if (/^(true|1|yes)$/i.test(String(file.private ?? 'false')) || !/^[^/\\]+$/.test(file.name)) return false;
    return Number(file.size || 0) > 0;
  });
  if (!pdfs.length) return null;

  const exact = identifier.toLowerCase();
  pdfs.sort((a, b) => {
    const aExact = a.name.toLowerCase().startsWith(exact) ? 1 : 0;
    const bExact = b.name.toLowerCase().startsWith(exact) ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    return Number(b.size || 0) - Number(a.size || 0);
  });
  const chosen = pdfs[0];
  return {
    url: `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(chosen.name)}`,
    identifier,
    fileName: chosen.name,
    sizeBytes: Number(chosen.size) || null,
    source
  };
}

export class BookCatalog {
  private storage: BookStorageAdapter;
  private fetchImpl: typeof fetch;
  private books: CatalogBook[] = [];
  private index: Map<string, CatalogBook> = new Map();
  private meta: CatalogMeta = { ...EMPTY_META };
  private loaded: Promise<void> | null = null;
  private seeding: Promise<{ added: number; total: number; done: boolean }> | null = null;
  /** كاش عدد كتب الفلسفة (يصفّر مع كل إضافة جديدة) */
  private philosophyCache: number | null = null;

  /** فاصل الطلبات بالمللي ثانية (الفحوص تخليه صفر حتى تشتغل بسرعة). */
  private queryGapMs: number;

  /** يلخّص كتاباً بالعربي (يُمرَّر من البوت عبر Gemini). يرجع '' لو فشل. */
  private summarizer: ((book: CatalogBook) => Promise<string>) | null;

  constructor(
    storage?: BookStorageAdapter,
    fetchImpl?: typeof fetch,
    options: { queryGapMs?: number; summarizer?: (book: CatalogBook) => Promise<string> } = {}
  ) {
    this.storage = storage || memoryBookStorage();
    this.fetchImpl = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : (null as unknown as typeof fetch));
    this.queryGapMs = options.queryGapMs ?? 400;
    this.summarizer = options.summarizer || null;
  }

  /** يحمّل المكتبة من التخزين مرة وحدة. */
  async load(): Promise<void> {
    if (this.loaded) return this.loaded;
    this.loaded = (async () => {
      try {
        const meta = await this.storage.get<CatalogMeta>(META_KEY);
        if (meta) this.meta = { ...EMPTY_META, ...meta };
        const chunks = await this.storage.list<CatalogBook[]>({ prefix: CHUNK_PREFIX });
        const ordered = Array.from(chunks.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        const seen = new Set<string>();
        this.books = [];
        this.index = new Map();
        for (const [, chunk] of ordered) {
          for (const book of chunk || []) {
            if (!book?.id || seen.has(book.id)) continue;
            seen.add(book.id);
            this.books.push(book);
            this.index.set(book.id, book);
          }
        }
        // العدد الحقيقي من الملفات أدق من الـmeta لو صار انقطاع.
        this.meta.total = this.books.length;
        this.philosophyCache = null;
        // 🔴 إصلاح مهم: النسخ القديمة كانت تعلّم «خلصت» وهي ناقصة (توقفت على
        // ٣٠٠٠). لو العدد أقل من الهدف نرفع العلم ونرجّع المؤشر للبداية حتى
        // يكمّل البذر بدل ما يظل واقف للأبد.
        if (this.meta.done && !this.isComplete()) {
          console.warn(`Book catalog marked done at ${this.books.length}/${CATALOG_TARGET} — resuming seeding.`);
          this.meta.done = false;
          this.meta.wrapCount = 0;
          this.meta.sortStage = 0;
          this.meta.page = 1;
          this.meta.queryIndex = 0;
          this.meta.langIndex = 0;
          await this.storage.put(META_KEY, this.meta);
        }
      } catch {
        this.books = [];
        this.index = new Map();
        this.meta = { ...EMPTY_META };
      }
    })();
    return this.loaded;
  }

  /**
   * يعرّب عنوان الكتاب واسم المؤلف إذا كانت عند Open Library طبعة عربية.
   * كثير من الأعمال مسجّلة بالحروف اللاتينية (Najib Mahfuz / Children of
   * Gebelawi)، فنروح لـ editions.json وندوّر على طبعة عنوانها بالعربي.
   * النتيجة تتكاش بالتخزين حتى ما نعيد الطلب.
   */
  async localize(book: CatalogBook): Promise<{ title: string; author: string; localized: boolean }> {
    const original = { title: book.title, author: book.author, localized: false };
    if (hasArabic(`${book.title} ${book.author}`)) return original;

    const cacheKey = `books:loc:${book.id}`;
    try {
      const cached = await this.storage.get<{ title: string; author: string } | null>(cacheKey);
      if (cached === null) return original;
      if (cached) return { title: cached.title, author: cached.author, localized: true };
    } catch {
      /* التخزين مو دايماً متاح */
    }

    try {
      const entries = await this.fetchEditions(book.id);
      if (!entries.length) return original;
      let arabicTitle = '';
      let arabicAuthor = '';
      for (const entry of entries) {
        const title = cleanDescription(String(entry?.title || ''));
        if (!arabicTitle && hasArabic(title)) arabicTitle = title;
        if (!arabicAuthor) {
          const statement = cleanDescription(String(entry?.by_statement || ''));
          const candidate = stripAuthorPrefix(statement);
          if (hasArabic(candidate)) arabicAuthor = candidate;
          else {
            const contribution = (entry?.contributions || []).map((item: any) => String(item || '')).find(hasArabic);
            if (contribution) arabicAuthor = cleanDescription(contribution);
          }
        }
        if (arabicTitle && arabicAuthor) break;
      }
      if (!arabicTitle) {
        try {
          await this.storage.put(cacheKey, null);
        } catch {
          /* اختياري */
        }
        return original;
      }
      const result = { title: arabicTitle, author: arabicAuthor || book.author };
      try {
        await this.storage.put(cacheKey, result);
      } catch {
        /* اختياري */
      }
      return { ...result, localized: true };
    } catch {
      return original;
    }
  }

  /** طبعات العمل (كاش بالذاكرة لكل عملية) — تستعملها النبذة والتعريب سوية. */
  private editionsCache: Map<string, any[]> = new Map();

  private async fetchEditions(bookId: string): Promise<any[]> {
    if (this.editionsCache.has(bookId)) return this.editionsCache.get(bookId) || [];
    try {
      const res = await this.fetchImpl(`https://openlibrary.org/works/${bookId}/editions.json?limit=60`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10_000) : undefined
      });
      if (!res?.ok) return [];
      const payload: any = await res.json();
      const entries = Array.isArray(payload?.entries) ? payload.entries : [];
      this.editionsCache.set(bookId, entries);
      return entries;
    } catch {
      return [];
    }
  }

  /**
   * نبذة الكتاب: **شرح عن الكتاب**، مو بيانات نشر.
   *
   * المصادر بالترتيب:
   *  ١) وصف العمل عند Open Library (`/works/{id}.json`)
   *  ٢) وصف أول طبعة عندها وصف (`editions.json`)
   *  ٣) جملة الافتتاح
   *  ٤) تلخيص عربي من Gemini (لو المفتاح متوفر)
   *
   * إذا كلها فشلت نرجع '' — ولا نختلق جملة من السنة/الصفحات. (هذا كان الخلل:
   * «كتاب من تصنيف … · صدر سنة … · 200 صفحة» تظهر كنبذة.)
   */
  async describe(book: CatalogBook): Promise<string> {
    const cacheKey = `books:desc:${book.id}`;
    try {
      const cached = await this.storage.get<string | { empty: true; at: number }>(cacheKey);
      if (typeof cached === 'string' && cached) return cached;
      if (cached && typeof cached === 'object' && cached.empty) {
        // كاش سلبي لست ساعات حتى ما نضرب الـAPI كل مرة.
        if (Date.now() - cached.at < 6 * 60 * 60 * 1000) return '';
      }
    } catch {
      /* التخزين مو دايماً متاح */
    }

    let text = '';

    // ١) وصف العمل
    try {
      const res = await this.fetchImpl(`https://openlibrary.org/works/${book.id}.json`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10_000) : undefined
      });
      if (res?.ok) {
        const payload: any = await res.json();
        const raw = payload?.description;
        const candidate = tidyDescription(typeof raw === 'string' ? raw : String(raw?.value || ''));
        if (isUsableDescription(candidate, book)) text = candidate;
      }
    } catch {
      /* نكمل للمصدر التالي */
    }

    // ٢) وصف طبعة
    if (!text) {
      const entries = await this.fetchEditions(book.id);
      for (const entry of entries) {
        const raw = entry?.description;
        const candidate = tidyDescription(typeof raw === 'string' ? raw : String(raw?.value || ''));
        if (isUsableDescription(candidate, book)) {
          text = candidate;
          break;
        }
      }
    }

    // ٣) جملة الافتتاح
    if (!text) {
      const candidate = tidyDescription(book.first || '');
      if (isUsableDescription(candidate, book)) text = candidate;
    }

    // ٤) تلخيص عربي من Gemini
    if (!text && this.summarizer) {
      try {
        const summary = await this.summarizer(book);
        if (isUsableDescription(summary, book)) text = summary;
      } catch {
        /* ما نكسر البطاقة */
      }
    }

    try {
      if (text) await this.storage.put(cacheKey, text);
      else await this.storage.put(cacheKey, { empty: true, at: Date.now() });
    } catch {
      /* الكاش اختياري */
    }
    return text;
  }

  /* ─────────────── ملفات الكتب من إنترنت أرشيف ─────────────── */

  /** كاش بالذاكرة: نتائج الملفات المتاحة فقط. */
  private archiveCache: Map<string, { at: number; file: ArchiveFile | null }> = new Map();
  private static readonly ARCHIVE_TTL_MS = 12 * 60 * 60 * 1000;

  private async fetchJsonQuiet(url: string, ms = 9_000): Promise<any | null> {
    try {
      const res = await this.fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined
      });
      if (!res?.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /** بيانات نسخة من إنترنت أرشيف (metadata). */
  private async archiveMetadata(identifier: string): Promise<any | null> {
    if (!identifier) return null;
    return this.fetchJsonQuiet(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
  }

  /** أسماء النسخ الممسوحة (ocaid) من طبعات العمل عند Open Library. */
  private async editionIdentifiers(bookId: string): Promise<string[]> {
    const editions = await this.fetchEditions(bookId);
    const ids: string[] = [];
    for (const edition of editions) {
      const ocaid = String(edition?.ocaid || '').trim();
      if (ocaid && !ids.includes(ocaid)) ids.push(ocaid);
    }
    return ids;
  }

  /**
   * يطلّع ملف PDF حر لكتاب من إنترنت أرشيف — عند الطلب.
   *
   * الترتيب: معرّف النسخة المخزّن بالبطاقة ثم معرّفات طبعات نفس العمل.
   * نتحقق من تصريح الملكية العامة في بيانات إنترنت أرشيف لكل نسخة.
   *
   * نرجّع null إذا ماكو ملف حر — واللي يستدعيها يعطي رسالة واضحة، ولا نخترع رابط.
   */
  async archivePdf(book: CatalogBook): Promise<ArchiveFile | null> {
    if (!book?.id) return null;
    const cached = this.archiveCache.get(book.id);
    if (cached && Date.now() - cached.at < BookCatalog.ARCHIVE_TTL_MS) return cached.file;
    const remember = (file: ArchiveFile | null): ArchiveFile | null => {
      this.archiveCache.set(book.id, { at: Date.now(), file });
      return file;
    };

    const checked = new Set<string>();
    const check = async (id: string, source: ArchiveFile['source']): Promise<ArchiveFile | null> => {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(id) || checked.has(id)) return null;
      checked.add(id);
      return pickArchivePdf(id, await this.archiveMetadata(id), source);
    };
    if (book.ia) {
      const file = await check(book.ia, 'catalog');
      if (file) return remember(file);
    }
    const identifiers = await this.editionIdentifiers(book.id);
    for (const id of identifiers.slice(0, 3)) {
      const file = await check(id, 'editions');
      if (file) return remember(file);
    }
    // لا نخزن النتائج السلبية حتى يقدر يعيد المحاولة إذا المصدر ما استجاب.
    return null;
  }

  /** تصنيفات كتاب: من الحقل المخزّن، أو محسوبة من مواضيعه (كتب قديمة بلا حقل). */
  genresOf(book: CatalogBook): string[] {
    if (book.genres && book.genres.length) return book.genres;
    const computed = classifyBookStrict(book.subject ? [book.subject] : [], book.title, book.lang);
    book.genres = computed;
    return computed;
  }

  /** توزيع المكتبة على الأصناف + عدد الكتب اللي بلا صنف (لازم يكون صفر). */
  async genreDistribution(): Promise<{ total: number; unclassified: number; genres: Array<{ genre: string; count: number }> }> {
    await this.load();
    const counts = new Map<string, number>();
    let unclassified = 0;
    for (const book of this.books) {
      const genres = this.genresOf(book);
      if (!genres.length) {
        unclassified += 1;
        continue;
      }
      for (const genre of genres) counts.set(genre, (counts.get(genre) || 0) + 1);
    }
    return {
      total: this.books.length,
      unclassified,
      genres: Array.from(counts.entries())
        .map(([genre, count]) => ({ genre, count }))
        .sort((a, b) => b.count - a.count)
    };
  }

  /** كل كتب صنف معيّن (اختياري: داخل عقد معيّن). */
  async booksByGenre(genre: string, decade: number | 'all' = 'all'): Promise<CatalogBook[]> {
    await this.load();
    return this.books.filter(book => {
      if (!this.genresOf(book).includes(genre)) return false;
      if (decade === 'all') return true;
      if (!book.year) return false;
      return Math.floor(book.year / 10) * 10 === decade;
    });
  }

  /** عدد كتب صنف معيّن، وعدد كل عقد داخله (لأزرار الشاشة). */
  async genreStats(genre: string): Promise<{ total: number; decades: Array<{ decade: number; count: number }> }> {
    const books = await this.booksByGenre(genre);
    const counts = new Map<number, number>();
    for (const book of books) {
      if (!book.year) continue;
      const decade = Math.floor(book.year / 10) * 10;
      counts.set(decade, (counts.get(decade) || 0) + 1);
    }
    return {
      total: books.length,
      decades: Array.from(counts.entries())
        .map(([decade, count]) => ({ decade, count }))
        .sort((a, b) => b.decade - a.decade)
    };
  }

  /**
   * اختيار كتاب من المكتبة الكبيرة حسب الصنف/العقد مع استبعاد اللي شافه.
   * لو العقد ضيّق نوسّع للصنف كله بدل ما نرجع فاضي.
   */
  async pickByGenre(
    genre: string,
    decade: number | 'all' = 'all',
    excludeId?: string,
    excludeIds: string[] = []
  ): Promise<{ book: CatalogBook; widened: boolean } | undefined> {
    const excluded = this.exclusionSet(excludeId, excludeIds);
    const narrow = await this.booksByGenre(genre, decade);
    const fromNarrow = this.pickFrom(narrow, excluded);
    if (fromNarrow) return { book: fromNarrow, widened: false };
    if (decade !== 'all') {
      const wide = await this.booksByGenre(genre);
      const fromWide = this.pickFrom(wide, excluded);
      if (fromWide) return { book: fromWide, widened: true };
    }
    return undefined;
  }

  /** مجموعة الاستبعاد: الكتاب السابق + آخر ما شاهده المستخدم. */
  private exclusionSet(excludeId?: string, excludeIds: string[] = []): Set<string> {
    const set = new Set<string>(excludeIds.filter(Boolean));
    if (excludeId) set.add(excludeId);
    return set;
  }

  private pickFrom(pool: CatalogBook[], excluded: Set<string>): CatalogBook | undefined {
    if (!pool.length) return undefined;
    const candidates = excluded.size ? pool.filter(book => !excluded.has(book.id)) : pool;
    // لو اللي شافه المستخدم يغطي الصنف كله (صنف صغير)، نسمح بالتكرار بدل الفراغ.
    const source = candidates.length ? candidates : pool;
    return source[Math.floor(Math.random() * source.length)];
  }

  async stats(): Promise<{ total: number; languages: number; done: boolean; updatedAt: number; failures: number }> {
    await this.load();
    const langs = new Set(this.books.map(book => book.lang));
    return {
      total: this.books.length,
      languages: langs.size,
      done: this.meta.done,
      updatedAt: this.meta.updatedAt,
      failures: this.meta.failures
    };
  }

  /** كل الكتب المحمّلة (للاقتراح العشوائي والفحوص). */
  async all(): Promise<CatalogBook[]> {
    await this.load();
    return this.books;
  }

  async byId(id: string): Promise<CatalogBook | undefined> {
    await this.load();
    const local = this.index.get(id);
    if (local) return local;
    try {
      const saved = await this.storage.get<{ at: number; books: CatalogBook[] }>('books:recent-search-results');
      if (saved && Date.now() - saved.at < 24 * 60 * 60 * 1000) return saved.books.find(book => book.id === id);
    } catch { /* البحث الحي اختياري */ }
    return undefined;
  }

  async countByLanguage(): Promise<Array<{ code: string; label: string; count: number }>> {
    await this.load();
    const counts = new Map<string, number>();
    for (const book of this.books) counts.set(book.lang, (counts.get(book.lang) || 0) + 1);
    return CATALOG_LANGUAGES.map(entry => ({ ...entry, count: counts.get(entry.code) || 0 }))
      .filter(entry => entry.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  /** اقتراح عشوائي من المكتبة الكبيرة، مع استبعاد كتاب شفته قبل شوي. */
  async pickRandom(
    options: { excludeId?: string; excludeIds?: string[]; lang?: string } = {}
  ): Promise<CatalogBook | undefined> {
    await this.load();
    if (!this.books.length) return undefined;
    const pool = options.lang ? this.books.filter(book => book.lang === options.lang) : this.books;
    const base = pool.length ? pool : this.books;
    const excluded = this.exclusionSet(options.excludeId, options.excludeIds);
    const source = excluded.size ? (base.filter(book => !excluded.has(book.id)).length ? base.filter(book => !excluded.has(book.id)) : base) : base;
    if (source.length === 1) return source[0];
    return source[Math.floor(Math.random() * source.length)];
  }

  /** بحث محلي سريع بالعنوان أو المؤلف (يتحمّل الهمزات وترتيب الكلمات). */
  async searchLocal(query: string, limit = 6): Promise<CatalogBook[]> {
    await this.load();
    const needle = normalizeQuery(tidy(query, 60));
    if (needle.length < 2) return [];
    const words = needle.split(' ').filter(word => word.length >= 2);
    const scored: Array<{ book: CatalogBook; score: number }> = [];
    for (const book of this.books) {
      const title = normalizeQuery(book.title);
      const author = normalizeQuery(book.author);
      const haystack = `${title} ${author}`;
      let score = 0;
      if (title === needle) score += 120;
      if (author === needle) score += 100;
      if (title.includes(needle)) score += 45;
      if (author.includes(needle)) score += 40;
      // كل كلمة من البحث مطلوبة (بأي ترتيب) — يخلّي «محفوظ نجيب» تطابق «نجيب محفوظ».
      if (words.length && words.every(word => haystack.includes(word))) score += 30;
      for (const word of words) {
        if (title.includes(word)) score += 6;
        if (author.includes(word)) score += 5;
      }
      if (score > 0) scored.push({ book, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(entry => entry.book);
  }

  /** بحث موحّد: المحلي أولاً، وبعدها الـAPI لو النتائج قليلة. */
  async search(query: string, limit = 6): Promise<{ local: CatalogBook[]; remote: CatalogBook[] }> {
    const detail = await this.searchDetailed(query, limit);
    return { local: detail.local, remote: detail.remote };
  }

  /**
   * نفس البحث بس يرجّع هم هل الـAPI تعطّل (شبكة/429) حتى نقول للمستخدم
   * «جرّب بعد شوي» بدل «ماكو نتيجة» وهو كاتب اسم مؤلف موجود.
   */
  async searchDetailed(
    query: string,
    limit = 6
  ): Promise<{ local: CatalogBook[]; remote: CatalogBook[]; remoteFailed: boolean }> {
    const local = await this.searchLocal(query, limit);
    const clean = tidy(query, 60);
    if (local.length >= limit || clean.length < 2) {
      return { local, remote: [], remoteFailed: false };
    }
    const remoteResult = await this.searchRemoteDetailed(clean, limit);
    const seen = new Set(local.map(book => book.id));
    const remote = remoteResult.books.filter(book => !seen.has(book.id));
    if (remote.length) {
      try {
        const previous = await this.storage.get<{ at: number; books: CatalogBook[] }>('books:recent-search-results');
        const old = previous && Date.now() - previous.at < 24 * 60 * 60 * 1000 ? previous.books : [];
        const freshIds = new Set(remote.map(book => book.id));
        await this.storage.put('books:recent-search-results', { at: Date.now(), books: [...remote, ...old.filter(book => !freshIds.has(book.id))].slice(0, 100) });
      } catch { /* نتائج البحث المحلية تبقى شغالة */ }
    }
    return {
      local,
      remote,
      remoteFailed: remoteResult.failed
    };
  }

  /** بحث حيّ بـOpen Library (بلا مفتاح): يجرّب q ثم author ثم title. */
  async searchRemote(query: string, limit = 6): Promise<CatalogBook[]> {
    const result = await this.searchRemoteDetailed(tidy(query, 60), limit);
    return result.books;
  }

  private async searchRemoteDetailed(
    clean: string,
    limit: number
  ): Promise<{ books: CatalogBook[]; failed: boolean }> {
    if (clean.length < 2 || !this.fetchImpl) return { books: [], failed: false };
    const size = String(Math.max(1, Math.min(20, limit)));
    const urls: string[] = [
      `https://openlibrary.org/search.json?q=${encodeURIComponent(clean)}&limit=${size}&fields=${encodeURIComponent(API_FIELDS)}`,
      `https://openlibrary.org/search.json?author=${encodeURIComponent(clean)}&limit=${size}&fields=${encodeURIComponent(API_FIELDS)}`,
      `https://openlibrary.org/search.json?title=${encodeURIComponent(clean)}&limit=${size}&fields=${encodeURIComponent(API_FIELDS)}`
    ];
    let sawFailure = false;
    for (const url of urls) {
      const docs = await this.fetchDocs(url, 2);
      if (!docs) {
        sawFailure = true;
        continue;
      }
      const out: CatalogBook[] = [];
      for (const doc of docs) {
        const book = cleanCatalogDoc(doc, '');
        if (book) out.push(book);
        if (out.length >= limit) break;
      }
      if (out.length) return { books: out, failed: false };
    }
    return { books: [], failed: sawFailure };
  }

  private async fetchDocs(url: string, attempts = 1): Promise<OpenLibraryDoc[] | null> {
    if (!this.fetchImpl) return null;
    for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
      const docs = await this.fetchDocsOnce(url);
      if (docs !== null) return docs;
      if (attempt < attempts) await sleep(500 * attempt);
    }
    return null;
  }

  private async fetchDocsOnce(url: string): Promise<OpenLibraryDoc[] | null> {
    if (!this.fetchImpl) return null;
    try {
      const response = await this.fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(12_000) : undefined
      });
      if (!response?.ok) return null;
      const payload: any = await response.json();
      if (!payload || !Array.isArray(payload.docs)) return null;
      return payload.docs as OpenLibraryDoc[];
    } catch {
      return null;
    }
  }

  /**
   * يبذر دفعة من Open Library: كل نداء يجيب ١٠٠ كتاب.
   * يتنادى من منبّه الـDurable Object لحد ما توصل المكتبة للهدف.
   */
  async seed(queries = 3): Promise<{ added: number; total: number; done: boolean }> {
    await this.load();
    if (this.seeding) return this.seeding;
    if (this.isComplete()) {
      this.meta.done = true;
      return { added: 0, total: this.books.length, done: true };
    }
    this.seeding = (async () => {
      let added = 0;
      let pending: CatalogBook[] = [];
      const chunkStart = this.meta.chunkCount;
      for (let i = 0; i < queries; i += 1) {
        // ملاحظة: الكتب المضافة تنضاف لـthis.books فوراً، فالعدّ منها ومن added
        // سوية يسبّب توقّف مبكر — نعتمد على this.books.length وحدها.
        if (this.isComplete()) {
          this.meta.done = true;
          break;
        }
        // 🥇 الفلسفة أولوية: طول ما هي أقل من الحد الأدنى ناخذ من مصادرها هي،
        // حتى لو المكتبة وصلت الهدف العام. (الفلسفة أكثر صنف مطلوب.)
        const needPhilosophy = this.philosophyCount() < PHILOSOPHY_MIN && this.books.length < CATALOG_MAX;
        const sources = needPhilosophy ? PHILOSOPHY_SOURCES : SEED_SOURCES;
        const cursorLabel = needPhilosophy ? 'phi' : 'main';
        const cursor = needPhilosophy ? (this.meta.phiIndex || 0) : (this.meta.sourceIndex || 0);
        const page = needPhilosophy ? (this.meta.phiPage || 1) : this.meta.page;
        const source = sources[cursor % sources.length];
        if (!source) {
          this.meta.done = true;
          break;
        }
        const sort = SORT_STAGES[this.meta.sortStage] || '';
        const url =
          'https://openlibrary.org/search.json?q=' + encodeURIComponent(source.q) +
          '&page=' + String(page) +
          (sort ? `&sort=${sort}` : '') +
          '&limit=100&fields=' + encodeURIComponent(API_FIELDS);

        // فاصل بسيط بين الطلبات: Open Library تسمح بـ٣ طلبات/ثانية مع User-Agent واضح.
        if (i > 0 && this.queryGapMs > 0) await sleep(this.queryGapMs);

        // 🔴 الشي المهم: لو الطلب فشل (429 مثلاً) نعيد **نفس الصفحة**؛ ما نحرّك
        // المؤشر. قبل هذا كان الفشل يحرّك المؤشر ويوصل المكتبة لـ«خلصت» وهي
        // ناقصة، وهذا سبب توقّفها على ٣٠٠٠ كتاب.
        let docs: OpenLibraryDoc[] | null = null;
        for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
          this.meta.requests += 1;
          docs = await this.fetchDocs(url);
          if (docs !== null) break;
          this.meta.failures += 1;
          this.meta.streak += 1;
          if (this.queryGapMs > 0) await sleep(600 * (attempt + 1));
        }
        if (docs === null) {
          // نوقف الدفعة هنا — المؤشر ثابت، فالمنبّه الجاي يعيد نفس الصفحة.
          break;
        }
        this.meta.streak = 0;

        for (const doc of docs) {
          // نوسم الكتاب بلغة المصدر: يعني «متوفر بهذه اللغة».
          const book = cleanCatalogDoc(doc, source.lang, true);
          if (!book) {
            this.meta.rejected += 1;
            continue;
          }
          // ضمان: التصنيف اللي جبنا الكتاب بسببه ينحسب إله حتى لو المواضيع ما
          // ذكرته (بعض السجلات مواضيعها ناقصة).
          if (source.genre) {
            const genres = new Set(book.genres || []);
            genres.add(source.genre);
            book.genres = Array.from(genres).slice(0, 4);
          } else if (!book.genres || !book.genres.length) {
            book.genres = [DEFAULT_GENRE];
          }
          if (this.index.has(book.id)) continue;
          this.index.set(book.id, book);
          this.books.push(book);
          pending.push(book);
          added += 1;
          this.philosophyCache = null;
        }

        // دور بين المصادر: كل طلب ياخذ مصدر، وبعد ما نكمل المصادر كلها ننتقل
        // للصفحة الجاية عند الجميع — توزيع متوازن على اللغات والأصناف.
        if (cursorLabel === 'phi') {
          this.meta.phiIndex = (this.meta.phiIndex || 0) + 1;
          if (this.meta.phiIndex >= PHILOSOPHY_SOURCES.length) {
            this.meta.phiIndex = 0;
            this.meta.phiPage = (this.meta.phiPage || 1) + 1;
            if (this.meta.phiPage > MAX_PAGE_PER_QUERY) this.meta.phiPage = 1;
          }
        } else {
          this.meta.sourceIndex = (this.meta.sourceIndex || 0) + 1;
          if (this.meta.sourceIndex >= SEED_SOURCES.length) {
            this.meta.sourceIndex = 0;
            this.meta.page += 1;
            if (this.meta.page > MAX_PAGE_PER_QUERY) {
              this.meta.page = 1;
              this.meta.sortStage += 1;
              if (this.meta.sortStage >= SORT_STAGES.length) {
                this.meta.sortStage = 0;
                this.meta.wrapCount += 1;
              }
              if (this.meta.wrapCount >= MAX_WRAP && !this.isComplete()) {
                console.warn(
                  `Book catalog stalled at ${this.books.length}/${CATALOG_TARGET} (philosophy ${this.philosophyCount()}) ` +
                    `after ${this.meta.requests} requests (failures ${this.meta.failures})`
                );
                this.meta.done = true;
                break;
              }
            }
          }
        }
      }
      // كتابة الدفعات
      let chunkCount = chunkStart;
      while (pending.length) {
        const slice = pending.slice(0, CHUNK_SIZE);
        pending = pending.slice(CHUNK_SIZE);
        await this.storage.put(`${CHUNK_PREFIX}${String(chunkCount).padStart(4, '0')}`, slice);
        chunkCount += 1;
      }
      this.meta.chunkCount = chunkCount;
      this.meta.total = this.books.length;
      this.meta.updatedAt = Date.now();
      if (this.isComplete()) this.meta.done = true;
      await this.storage.put(META_KEY, this.meta);
      return { added, total: this.books.length, done: this.meta.done };
    })();
    try {
      return await this.seeding;
    } finally {
      this.seeding = null;
    }
  }

  /** عدد كتب الفلسفة بالمكتبة المحمّلة. */
  philosophyCount(): number {
    if (this.philosophyCache !== null) return this.philosophyCache;
    let count = 0;
    for (const book of this.books) {
      if (this.genresOf(book).includes('philosophy')) count += 1;
    }
    this.philosophyCache = count;
    return count;
  }

  /** خلصنا؟ لازم الهدف العام **و** الحد الأدنى للفلسفة. */
  isComplete(): boolean {
    return this.books.length >= CATALOG_TARGET && this.philosophyCount() >= PHILOSOPHY_MIN;
  }

  /** هل يحتاج منبّه تالي للبذر؟ (العبرة بالعدد الحقيقي مو بعلم «خلصت») */
  needsMore(): boolean {
    if (this.isComplete()) return false;
    if (this.meta.done) return false;
    return true;
  }

  /**
   * كم ننتظر قبل دفعة البذر الجاية؟ لو الـAPI صار يرفض (429) نهدّي الإيقاع
   * حتى ما نحرق الحصة، بدل ما نكرر الطلب كل ثانيتين ونفشل.
   */
  nextDelayMs(): number {
    if (this.meta.streak >= 3) return 60_000;
    if (this.meta.streak >= 1) return 10_000;
    return 2_500;
  }

  async reset(): Promise<void> {
    const chunks = await this.storage.list({ prefix: CHUNK_PREFIX });
    for (const key of chunks.keys()) await this.storage.delete(key);
    await this.storage.delete(META_KEY);
    this.books = [];
    this.index = new Map();
    this.meta = { ...EMPTY_META };
    this.philosophyCache = null;
    this.loaded = Promise.resolve();
  }

  /** ملخص للوحة المالك: كم كتاب، بأي لغة، وهل البذر خلص. */
  async summaryText(): Promise<string> {
    const stats = await this.stats();
    const langs = await this.countByLanguage();
    const top = langs.slice(0, 6).map(entry => `${entry.label} ${entry.count}`).join(' · ');
    const state = stats.done ? 'مكتملة' : 'جارية';
    return `📚 المكتبة: ${stats.total.toLocaleString('en-US')} / ${CATALOG_TARGET.toLocaleString('en-US')} كتاب · ${state}\n${top || 'ماكو سجلات بعد'}`;
  }
}

/** غلاف Open Library لرقم الغلاف. */
export function coverUrl(coverId: number | null | undefined, size: 'S' | 'M' | 'L' = 'M'): string | null {
  if (!coverId) return null;
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

/** صفحة العمل على Open Library. */
export function workUrl(book: Pick<CatalogBook, 'id'>): string {
  return `https://openlibrary.org/works/${book.id}`;
}
