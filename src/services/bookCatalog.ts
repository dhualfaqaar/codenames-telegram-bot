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
  langIndex: number;
  /** أي استعلام داخل اللغة الحالية (بعض اللغات إلها أكثر من استعلام) */
  queryIndex: number;
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
}

interface OpenLibraryDoc {
  key?: string;
  title?: string;
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
  { code: 'chi', label: 'الصينية', queries: ['language:chi'] }
];

export const CATALOG_TARGET = 10_000;
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
const API_FIELDS = 'key,title,author_name,first_publish_year,number_of_pages_median,cover_i,language,subject';
const USER_AGENT = 'CodenamesTelegramBot/1.0 (book catalog; https://t.me/code_games)';

const META_KEY = 'books:meta';
const CHUNK_PREFIX = 'books:chunk:';

const EMPTY_META: CatalogMeta = {
  total: 0,
  chunkCount: 0,
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
  wrapCount: 0
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

function tidy(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * تطبيع عربي/لاتيني للمقارنة: التشكيل، الهمزات، التاء المربوطة، الياء، الحروف
 * الكبيرة والصغيرة. بدونه «نجيب محفوظ» ما يطابق «نجيب محفوظ» لو مكتوب بهمزة،
 * وهذا سبب رسالة «ما لكيت نتيجة» اللي صارت.
 */
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
  const subject = tidy(String(doc.subject?.[0] || ''), 40);
  return {
    id,
    title,
    author,
    year: Number.isFinite(year) && year > 600 && year <= new Date().getFullYear() + 1 ? year : null,
    pages: Number.isFinite(pages) && pages > 10 && pages < 5000 ? pages : null,
    cover: Number.isFinite(cover) && cover > 0 ? cover : null,
    lang: tidy(String((preferFallbackLang ? fallbackLang : doc.language?.[0]) || fallbackLang), 8) || fallbackLang,
    subject
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

  constructor(storage?: BookStorageAdapter, fetchImpl?: typeof fetch) {
    this.storage = storage || memoryBookStorage();
    this.fetchImpl = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : (null as unknown as typeof fetch));
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
        // 🔴 إصلاح مهم: النسخ القديمة كانت تعلّم «خلصت» وهي ناقصة (توقفت على
        // ٣٠٠٠). لو العدد أقل من الهدف نرفع العلم ونرجّع المؤشر للبداية حتى
        // يكمّل البذر بدل ما يظل واقف للأبد.
        if (this.meta.done && this.books.length < CATALOG_TARGET) {
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
    return this.index.get(id);
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
  async pickRandom(options: { excludeId?: string; lang?: string } = {}): Promise<CatalogBook | undefined> {
    await this.load();
    if (!this.books.length) return undefined;
    const pool = options.lang ? this.books.filter(book => book.lang === options.lang) : this.books;
    const source = pool.length ? pool : this.books;
    if (source.length === 1) return source[0];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const picked = source[Math.floor(Math.random() * source.length)];
      if (picked && picked.id !== options.excludeId) return picked;
    }
    return source.find(book => book.id !== options.excludeId) || source[0];
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
    return {
      local,
      remote: remoteResult.books.filter(book => !seen.has(book.id)),
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
    if (this.books.length >= CATALOG_TARGET) {
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
        if (this.books.length >= CATALOG_TARGET) {
          this.meta.done = true;
          break;
        }
        const lang = CATALOG_LANGUAGES[this.meta.langIndex];
        if (!lang) {
          this.meta.done = true;
          break;
        }
        const langQueries = lang.queries && lang.queries.length ? lang.queries : [`language:${lang.code}`];
        const rawQuery = langQueries[Math.min(this.meta.queryIndex, langQueries.length - 1)];
        const sort = SORT_STAGES[this.meta.sortStage] || '';
        const url =
          'https://openlibrary.org/search.json?q=' + encodeURIComponent(rawQuery) +
          '&page=' + String(this.meta.page) +
          (sort ? `&sort=${sort}` : '') +
          '&limit=100&fields=' + encodeURIComponent(API_FIELDS);

        // فاصل بسيط بين الطلبات: Open Library تسمح بـ٣ طلبات/ثانية مع User-Agent واضح.
        if (i > 0) await sleep(400);

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
          await sleep(600 * (attempt + 1));
        }
        if (docs === null) {
          // نوقف الدفعة هنا — المؤشر ثابت، فالمنبّه الجاي يعيد نفس الصفحة.
          break;
        }
        this.meta.streak = 0;

        for (const doc of docs) {
          // نوسم الكتاب بلغة الاستعلام: يعني «متوفر بهذه اللغة» (الكتاب ممكن يكون
          // مترجم لأكثر من لغة، وسجل Open Library يجمعها كلها بمصفوفة واحدة).
          const book = cleanCatalogDoc(doc, lang.code, true);
          if (!book) {
            this.meta.rejected += 1;
            continue;
          }
          if (this.index.has(book.id)) continue;
          this.index.set(book.id, book);
          this.books.push(book);
          pending.push(book);
          added += 1;
        }

        // دور بين اللغات: كل طلب ياخذ لغة، وبعد ما نكمل اللغات كلها ننتقل
        // للصفحة الجاية عند الجميع. هذا يخلّي التوزيع متوازن (العربية أولاً)
        // بدل ما تبلع لغة وحدة كل الحصة.
        if (docs.length === 0) {
          // استعلام هاللغة فاضي؟ نتخطاه بقية الصفحات.
          this.meta.queryIndex = Math.max(this.meta.queryIndex, langQueries.length);
        }
        this.meta.langIndex += 1;
        if (this.meta.langIndex >= CATALOG_LANGUAGES.length) {
          this.meta.langIndex = 0;
          this.meta.page += 1;
          if (this.meta.page > MAX_PAGE_PER_QUERY) {
            this.meta.page = 1;
            this.meta.queryIndex += 1;
            const maxQueries = Math.max(...CATALOG_LANGUAGES.map(entry => (entry.queries || []).length || 1));
            if (this.meta.queryIndex >= maxQueries) {
              // خلصت كل الاستعلامات بكل اللغات؟ ترتيب ثاني.
              this.meta.queryIndex = 0;
              this.meta.sortStage += 1;
              if (this.meta.sortStage >= SORT_STAGES.length) {
                this.meta.sortStage = 0;
                this.meta.wrapCount += 1;
              }
              const maxPages = MAX_PAGE_PER_QUERY;
              if (this.meta.wrapCount >= MAX_WRAP && this.books.length < CATALOG_TARGET) {
                console.warn(
                  `Book catalog stalled at ${this.books.length}/${CATALOG_TARGET} after ${this.meta.requests} requests ` +
                    `(failures ${this.meta.failures}, pages ${maxPages})`
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
      if (this.books.length >= CATALOG_TARGET) this.meta.done = true;
      await this.storage.put(META_KEY, this.meta);
      return { added, total: this.books.length, done: this.meta.done };
    })();
    try {
      return await this.seeding;
    } finally {
      this.seeding = null;
    }
  }

  /** هل يحتاج منبّه تالي للبذر؟ (العبرة بالعدد الحقيقي مو بعلم «خلصت») */
  needsMore(): boolean {
    if (this.books.length >= CATALOG_TARGET) return false;
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
