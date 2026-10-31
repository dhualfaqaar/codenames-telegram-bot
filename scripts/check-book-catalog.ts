// فحص مكتبة الكتب الكبيرة: نبذر ١٠,٠٠٠ كتاب من Open Library برشاقة (fetch موقوف
// ومحاكي)، ونتأكد من: تقسيم التخزين لدفعات صغيرة، منع التكرار، التقاط الناقص،
// البحث المحلي والحيّ، الاقتراح العشوائي، والتراجع الآمن لو الـAPI تعطّل.
import assert from 'node:assert/strict';
import {
  BookCatalog,
  CATALOG_LANGUAGES,
  CATALOG_TARGET,
  cleanCatalogDoc,
  coverUrl,
  GENRE_SEED_SUBJECTS,
  PHILOSOPHY_MIN,
  PHILOSOPHY_SOURCES,
  SEED_SOURCES,
  DEFAULT_GENRE,
  classifyBook,
  classifyBookStrict,
  memoryBookStorage,
  normalizeQuery,
  workUrl
} from '../src/services/bookCatalog';

let passed = 0;
const check = (name: string, condition: unknown) => {
  if (!condition) throw new Error(`فشل: ${name}`);
  passed += 1;
};

/** يحلّل استعلام البذر: language:xx و subject:"..." */
function parseQuery(url: string) {
  const q = new URL(url).searchParams.get('q') || '';
  const lang = (q.match(/language:([a-z]{3})/) || [])[1] || 'ara';
  const subject = (q.match(/subject:"([^"]+)"/) || [])[1] || '';
  const page = Number(new URL(url).searchParams.get('page') || '1');
  return { q, lang, subject, page };
}

/** يولّد صفحة Open Library وهمية: ١٠٠ نتيجة مختلفة لكل (استعلام، صفحة). */
function fakePage(lang: string, page: number, subject = '', q = '') {
  return {
    numFound: 5000,
    docs: Array.from({ length: 100 }, (_, index) => {
      const n = (page - 1) * 100 + index;
      const seed = `${q}#${n}`;
      let hash = 0;
      for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 1_000_000_007;
      return {
        key: `/works/OL${hash}W`,
        title: `كتاب ${lang} رقم ${n}`,
        author_name: [`مؤلف ${lang} ${n % 500}`],
        first_publish_year: 1900 + (n % 120),
        number_of_pages_median: 100 + (n % 400),
        cover_i: (n % 900) + 100,
        language: [lang],
        subject: subject ? [subject] : ['Fiction']
      };
    })
  };
}

let requestLog: string[] = [];
let mode: 'ok' | 'fail' | 'garbage' | 'empty' = 'ok';

const fakeFetch = (async (input: any) => {
  const url = String(typeof input === 'string' ? input : input.url);
  requestLog.push(url);
  if (mode === 'fail') throw new Error('network down');
  const parsed = new URL(url);
  if (mode === 'garbage') return { ok: true, json: async () => ({ nope: true }) } as any;
  if (mode === 'empty') return { ok: true, json: async () => ({ numFound: 0, docs: [] }) } as any;
  const { q, lang, subject, page } = parseQuery(url);
  if (parsed.searchParams.get('author') || parsed.searchParams.get('q') === 'lord of the rings') {
    return { ok: true, json: async () => fakePage(lang, page, subject) } as any;
  }
  return { ok: true, json: async () => fakePage(lang, page, subject, q) } as any;
}) as unknown as typeof fetch;

/* ───────────── تنظيف سجلات Open Library ───────────── */
{
  const good = cleanCatalogDoc(
    { key: '/works/OL27448W', title: 'The Lord of the Rings', author_name: ['J.R.R. Tolkien'], first_publish_year: 1954, number_of_pages_median: 1193, cover_i: 14625765, language: ['eng'], subject: ['Fantasy fiction'] },
    'eng'
  );
  check('السجل الصحيح ينحفظ', good?.id === 'OL27448W');
  check('عنوان ومؤلف صحيحين', good?.title === 'The Lord of the Rings' && good?.author === 'J.R.R. Tolkien');
  check('السنة والصفحات والغلاف تنحفظ', good?.year === 1954 && good?.pages === 1193 && good?.cover === 14625765);
  check('الموضوع ينحفظ', good?.subject === 'Fantasy fiction');
  check('سجل بلا مؤلف ينرفض', cleanCatalogDoc({ key: '/works/OL1W', title: 'بلا مؤلف' }, 'ara') === null);
  check('سجل بلا عنوان ينرفض', cleanCatalogDoc({ key: '/works/OL2W', author_name: ['فلان'] }, 'ara') === null);
  check('سجل بلا معرّف ينرفض', cleanCatalogDoc({ title: 'كتاب', author_name: ['فلان'] }, 'ara') === null);
  check('سنة مستحيلة تنرفض', cleanCatalogDoc({ key: '/works/OL3W', title: 'قديم', author_name: ['فلان'], first_publish_year: 12 }, 'ara')?.year === null);
  check('صفحات مستحيلة تنرفض', cleanCatalogDoc({ key: '/works/OL4W', title: 'ضخم', author_name: ['فلان'], number_of_pages_median: 90000 }, 'ara')?.pages === null);
  check('اللغة الاحتياطية تنحفظ', cleanCatalogDoc({ key: '/works/OL5W', title: 'عربي', author_name: ['فلان'] }, 'ara')?.lang === 'ara');
  check('رابط الغلاف يتكوّن صح', coverUrl(14625765, 'M') === 'https://covers.openlibrary.org/b/id/14625765-M.jpg');
  check('بلا غلاف ماكو رابط', coverUrl(null) === null);
  check('رابط صفحة الكتاب', workUrl({ id: 'OL27448W' }) === 'https://openlibrary.org/works/OL27448W');
  check('قائمة اللغات تغطي كل المطلوب', ['ara', 'eng', 'rus', 'ger', 'fre', 'ron', 'spa', 'ita', 'tur', 'per'].every(code => CATALOG_LANGUAGES.some(entry => entry.code === code)));
  check('العربية أول لغة بالبذر', CATALOG_LANGUAGES[0].code === 'ara');
  check('الهدف ١٠٠٠٠ كتاب', CATALOG_TARGET === 10_000);
}

/* ───────────── البذر + التخزين المقسّم ───────────── */
{
  const storage = memoryBookStorage();
  const catalog = new BookCatalog(storage, fakeFetch);
  requestLog = [];
  mode = 'ok';

  const first = await catalog.seed(3);
  check('أول دفعة بذر تضيف كتب', first.added > 250 && first.added <= 300);
  check('ثلاث طلبات بالدفعة', requestLog.length === 3);
  check('الطلب يستعمل Search API مع fields وlimit', requestLog[0].includes('/search.json?q=') && requestLog[0].includes('fields=') && requestLog[0].includes('limit=100'));
  check('الطلب يفلتر بلغة', decodeURIComponent(requestLog[0]).includes('language:ara'));

  const chunksAfterFirst = await storage.list({ prefix: 'books:chunk:' });
  check('التخزين مقسّم لدفعات', chunksAfterFirst.size >= 2);
  const biggest = Math.max(...Array.from(chunksAfterFirst.values()).map(chunk => JSON.stringify(chunk).length));
  check('كل دفعة أصغر من حد الـDurable Object (128KB)', biggest < 128 * 1024);
  check('كل دفعة بحد أقصى ٢٠٠ كتاب', Array.from(chunksAfterFirst.values()).every(chunk => (chunk as any[]).length <= 200));

  const meta = await storage.get<any>('books:meta');
  check('الـmeta يحفظ العدد والمؤشر', meta.total > 250 && meta.done === false);
  check('البذر يبدأ بتعويض الفلسفة أولاً', meta.phiIndex === 3 && meta.sourceIndex === 0);
  check('مصادر الفلسفة كلها موسومة فلسفة', PHILOSOPHY_SOURCES.every(source => source.genre === 'philosophy'));
  check('مصادر الفلسفة تغطي عدة لغات', new Set(PHILOSOPHY_SOURCES.map(source => source.lang)).size >= 8);
  check('مصادر الفلسفة تغطي مواضيع متعددة', PHILOSOPHY_SOURCES.some(source => source.q.includes('Stoicism')) && PHILOSOPHY_SOURCES.some(source => source.q.includes('Ethics')));
  check('أول ثلاثة مصادر كلها عربية', SEED_SOURCES.slice(0, 3).every(source => source.lang === 'ara'));
  check('المصادر تغطي كل الأصناف', Object.keys(GENRE_SEED_SUBJECTS).every(genre =>
    SEED_SOURCES.some(source => source.genre === genre)));
  check('المصادر تغطي 29 لغة', new Set(SEED_SOURCES.map(source => source.lang)).size >= 29);
  check('الـmeta يعدّ الطلبات', meta.requests === 3);

  // تكرار نفس الصفحة ما يزيد شي (منع التكرار بالمعرّف)
  const before = (await catalog.stats()).total;
  const repeat = await catalog.seed(3);
  check('ماكو تكرار بنفس السجلات', (await catalog.stats()).total === before + repeat.added);
  const ids = new Set((await catalog.all()).map(book => book.id));
  check('كل المعرّفات فريدة', ids.size === (await catalog.all()).length);
}

/* ───────────── الوصول لـ١٠,٠٠٠ كتاب ───────────── */
{
  const storage = memoryBookStorage();
  const catalog = new BookCatalog(storage, fakeFetch);
  mode = 'ok';
  let guard = 0;
  while (catalog.needsMore() && guard < 400) {
    await catalog.seed(3);
    guard += 1;
  }
  const stats = await catalog.stats();
  check('المكتبة توصل ١٠,٠٠٠ كتاب', stats.total >= 10_000);
  check('البذر يتوقف عند الهدف', catalog.needsMore() === false);
  check('الهدف ما يتجاوز بكثير', stats.total < 10_600);
  check('عدة لغات انبذرت', stats.languages >= 3);
  check('البذر توقّف بحد معقول من الطلبات', guard < 200);
  const byLang = await catalog.countByLanguage();
  check('كل لغة منبذرة إلها عدّاد', byLang.length >= 3 && byLang.every(entry => entry.count > 0));
  check('العربية منبذرة أولاً', byLang.some(entry => entry.code === 'ara'));
  check('ملخص المكتبة يذكر العدد', (await catalog.summaryText()).includes('المكتبة'));
  check('الملخص يذكر أنها مكتملة', (await catalog.summaryText()).includes('مكتملة'));

  // كل صنف لازم إله كتب كثيرة — مو ٤–٦ كتب
  const genreTotals: number[] = [];
  for (const genre of Object.keys(GENRE_SEED_SUBJECTS)) {
    genreTotals.push((await catalog.genreStats(genre)).total);
  }
  check('كل صنف إله ≥100 كتاب بالمكتبة الكبيرة', genreTotals.every(total => total >= 100));
  check('الأصناف الاثنا عشر كلها موجودة', genreTotals.length === 12);

  const pool = await catalog.booksByGenre('novel', 'all');
  check('صنف الرواية عنده مئات الكتب', pool.length >= 200);
  const seen = new Set<string>();
  let lastId: string | undefined;
  for (let round = 0; round < 60; round += 1) {
    const pick = await catalog.pickByGenre('novel', 'all', lastId);
    if (!pick) break;
    seen.add(pick.book.id);
    lastId = pick.book.id;
  }
  check('٦٠ سحبة تعطي ≥55 عنوان مختلف', seen.size >= 55);

  const widenedPick = await catalog.pickByGenre('horror', 1000, undefined);
  check('عقد فاضي يوسّع للصنف بدل الفراغ', Boolean(widenedPick) && widenedPick!.widened === true);

  // التغطية: كل الـ10,000 لازم يكونون داخل الأصناف
  const distribution = await catalog.genreDistribution();
  const sum = distribution.genres.reduce((total, entry) => total + entry.count, 0);
  check('صفر كتاب بدون صنف', distribution.unclassified === 0);
  check('كل الكتب موزعة على الأصناف', sum >= distribution.total && distribution.total >= 10_000);
  check('الأصناف الاثنا عشر كلها فيها كتب', distribution.genres.length === 12);
  check('أصغر صنف عنده ≥50 كتاب', distribution.genres[distribution.genres.length - 1].count >= 50);
  const philosophy = distribution.genres.find(entry => entry.genre === 'philosophy')?.count || 0;
  check('الفلسفة ≥1000 كتاب', philosophy >= PHILOSOPHY_MIN);
  check('عدّاد الفلسفة يطابق genreStats', philosophy === (await catalog.genreStats('philosophy')).total);
  check('philosophyCount يطابق التوزيع', catalog.philosophyCount() === philosophy);
  check('المكتبة تعتبر مكتملة (هدف + فلسفة)', catalog.isComplete() === true);
  check('needsMore صار false', catalog.needsMore() === false);

  // ما يكرر آخر ١٥ كتاب بالصنف
  {
    const seenIds: string[] = [];
    let repeats = 0;
    for (let round = 0; round < 40; round += 1) {
      const pick = await catalog.pickByGenre('philosophy', 'all', undefined, seenIds);
      if (!pick) break;
      if (seenIds.includes(pick.book.id)) repeats += 1;
      seenIds.push(pick.book.id);
      if (seenIds.length > 15) seenIds.shift();
    }
    check('ما يكرر كتاب خلال آخر ١٥ سحبة', repeats === 0);
  }
  console.log(
    'توزيع المكتبة على الأصناف:',
    distribution.genres.map(entry => `${entry.genre}=${entry.count}`).join(' · '),
    `| مجموع=${sum} من ${distribution.total}`
  );
}

/* ───────────── البحث والاقتراح العشوائي ───────────── */
{
  const storage = memoryBookStorage();
  const catalog = new BookCatalog(storage, fakeFetch);
  mode = 'ok';
  await catalog.seed(6);

  const all = await catalog.all();
  const sample = all[3];
  const byTitle = await catalog.searchLocal(sample.title, 5);
  check('البحث المحلي يلقى الكتاب بالعنوان', byTitle.some(book => book.id === sample.id));
  const byAuthor = await catalog.searchLocal(sample.author, 5);
  check('البحث المحلي يلقى الكتاب بالمؤلف', byAuthor.length > 0);
  check('البحث الفاضي يرجع بلا نتائج', (await catalog.searchLocal('   ', 5)).length === 0);

  const random = await catalog.pickRandom();
  check('الاقتراح العشوائي يرجع كتاب حقيقي', Boolean(random) && all.some(book => book.id === random!.id));
  const excluded = await catalog.pickRandom({ excludeId: all[0].id });
  check('الاقتراح العشوائي يستبعد الكتاب المطلوب', excluded?.id !== all[0].id);
  const byId = await catalog.byId(all[2].id);
  check('جلب كتاب بالمعرّف', byId?.id === all[2].id);

  const remote = await catalog.searchRemote('lord of the rings', 3);
  check('البحث الحيّ يفكّ نتيجة Open Library', remote.length > 0 && remote[0].id.startsWith('OL'));
}

/* ───────────── التراجع الآمن ───────────── */
{
  const storage = memoryBookStorage();
  const catalog = new BookCatalog(storage, fakeFetch);
  mode = 'fail';
  const beforeMeta = await storage.get<any>('books:meta');
  const result = await catalog.seed(3);
  check('لو الشبكة تعطّلت البذر ما ينكسر', result.added === 0);
  check('الفشل **ما** يحرّك مؤشر الصفحة (سبب توقّف المكتبة سابقاً)', (await storage.get<any>('books:meta'))?.page === (beforeMeta?.page ?? 1));
  check('الفشل ما يعلّم المكتبة «خلصت»', (await storage.get<any>('books:meta'))?.done === false);
  check('الفشل ينحسب بالـmeta', (await storage.get<any>('books:meta'))?.failures >= 1);
  check('ماكو كتب انحفظت من الفشل', (await catalog.stats()).total === 0);
  check('البحث الحيّ يرجع بلا نتائج بدل ما ينكسر', (await catalog.searchRemote('test', 3)).length === 0);
  check('الاقتراح العشوائي بلا مكتبة يرجع undefined', (await catalog.pickRandom()) === undefined);
  check('التأخير يطول بعد فشل متكرر', catalog.nextDelayMs() >= 10_000);

  mode = 'garbage';
  const garbage = await catalog.seed(2);
  check('رد غير متوقع ما ينكسر', garbage.added === 0);

  check('ثلاثة إخفاقات ورا بعض = تهدئة طويلة', catalog.nextDelayMs() === 60_000);

  mode = 'empty';
  const empty = await catalog.seed(6);
  check('صفحة فاضية ما تنحسب فشل شبكة', empty.added === 0 && (await storage.get<any>('books:meta'))?.streak === 0);
  check('الصفحة الفاضية تنتقل للاستعلام الجاي', (await storage.get<any>('books:meta'))?.page === 1);

  mode = 'ok';
  const recovered = await catalog.seed(3);
  check('يرجع يشتغل بعد ما تصلح الشبكة', recovered.added > 0);
  check('التأخير يرجع طبيعي بعد النجاح', catalog.nextDelayMs() === 2_500);
}

/* ───────────── بحث المؤلف: تطبيع عربي + احتياطي ───────────── */
{
  check('تطبيع الهمزات (أ = ا)', normalizeQuery('أحمد') === normalizeQuery('احمد'));
  check('تطبيع الألف الممدودة واللام ألف', normalizeQuery('آمنة') === normalizeQuery('امنه'));
  check('تطبيع التاء المربوطة (ة = ه)', normalizeQuery('حكاية') === normalizeQuery('حكايه'));
  check('تطبيع الياء (ى = ي)', normalizeQuery('مصطفى') === normalizeQuery('مصطفي'));
  check('حذف التشكيل', normalizeQuery('مَحْفوظ') === normalizeQuery('محفوظ'));
  check('حذف التطويل', normalizeQuery('محـــفوظ') === normalizeQuery('محفوظ'));

  // كتب داخل التخزين مباشرة: نتحقق من مطابقة الاسم وترتيب الكلمات
  const storage = memoryBookStorage();
  await storage.put('books:chunk:0000', [
    { id: 'OL9W', title: 'أولاد حارتنا', author: 'نجيب محفوظ', year: 1959, pages: 240, cover: 11, lang: 'ara', subject: 'Fiction' },
    { id: 'OL10W', title: 'The Old Man and the Sea', author: 'Ernest Hemingway', year: 1952, pages: 131, cover: 12, lang: 'eng', subject: 'Fiction' }
  ]);
  const local = new BookCatalog(storage, fakeFetch);
  check('البحث باسم المؤلف يلقى كتابه', (await local.searchLocal('نجيب محفوظ', 5)).length === 1);
  check('البحث بترتيب كلمات مقلوب يشتغل', (await local.searchLocal('محفوظ نجيب', 5)).length === 1);
  check('البحث بهمزة مختلفة يشتغل', (await local.searchLocal('نجيب محفوظ', 5)).length === 1);
  check('البحث باسم العائلة لحاله يشتغل', (await local.searchLocal('محفوظ', 5)).length === 1);
  check('البحث الإنجليزي يتجاهل حالة الحروف', (await local.searchLocal('hemingway', 5)).length === 1);
  check('البحث باسم مو موجود يرجع فاضي', (await local.searchLocal('اسم وهمي جدا', 5)).length === 0);

  // لو q= فشل (429) لازم يجرّب author=
  const hits: string[] = [];
  const flakyFetch = (async (input: any) => {
    const url = new URL(String(input));
    hits.push(url.search);
    if (url.searchParams.get('author')) {
      return {
        ok: true,
        json: async () => ({
          docs: [{ key: '/works/OL55W', title: 'الطريق', author_name: ['نجيب محفوظ'], first_publish_year: 1961, cover_i: 22 }]
        })
      } as any;
    }
    return { ok: false, status: 429, json: async () => ({}) } as any;
  }) as unknown as typeof fetch;
  const flaky = new BookCatalog(memoryBookStorage(), flakyFetch);
  const detailed = await flaky.searchDetailed('نجيب محفوظ', 5);
  check('لو البحث العام فشل يجرّب author', detailed.remote.length === 1 && hits.some(hit => hit.includes('author=')));
  check('ما يعلّم فشل لو نجح البديل', detailed.remoteFailed === false);

  // ولو كل المحاولات فشلت، نعلّم الفشل حتى نقول «جرّب بعد شوي»
  const deadFetch = (async () => ({ ok: false, status: 429, json: async () => ({}) }) as any) as unknown as typeof fetch;
  const dead = new BookCatalog(memoryBookStorage(), deadFetch);
  const deadResult = await dead.searchDetailed('نجيب محفوظ', 5);
  check('كل المحاولات فاشلة = remoteFailed', deadResult.remoteFailed === true && deadResult.remote.length === 0);
}

/* ───────────── استئناف مكتبة قديمة وقفت على ٣٠٠٠ ───────────── */
{
  const storage = memoryBookStorage();
  // نجهّز مكتبة «متوقفة» مثل النسخة القديمة: ٣٠٠٠ كتاب وdone=true.
  for (let chunk = 0; chunk < 15; chunk += 1) {
    const slice = Array.from({ length: 200 }, (_, index) => {
      const n = chunk * 200 + index;
      return { id: `OLD${n}`, title: `كتاب قديم ${n}`, author: `مؤلف ${n}`, year: 1990, pages: 200, cover: null, lang: 'ara', subject: '' };
    });
    await storage.put(`books:chunk:${String(chunk).padStart(4, '0')}`, slice);
  }
  await storage.put('books:meta', {
    total: 3000, chunkCount: 15, langIndex: 0, queryIndex: 0, page: 1, done: true,
    updatedAt: Date.now(), requests: 100, failures: 10, rejected: 0, streak: 0, sortStage: 0, wrapCount: 4
  });

  const catalog = new BookCatalog(storage, fakeFetch);
  mode = 'ok';
  const stats = await catalog.stats();
  check('المكتبة القديمة المتوقفة تنقرأ ٣٠٠٠', stats.total === 3000);
  check('علم «خلصت» القديم ينرفع تلقائياً', stats.done === false);
  check('البذر يستأنف من نفس المكتبة', catalog.needsMore() === true);

  let guard = 0;
  while (catalog.needsMore() && guard < 400) {
    await catalog.seed(3);
    guard += 1;
  }
  const after = await catalog.stats();
  check('المكتبة تكمّل لـ١٠,٠٠٠ بعد الاستئناف', after.total >= 10_000);
  check('الكتب القديمة ما تنحذف', (await catalog.all()).some(book => book.id.startsWith('OLD')));
  check('الدفعات القديمة تبقى بالتخزين', (await storage.list({ prefix: 'books:chunk:' })).size >= 15);
}

/* ───────────── تصنيف الكتب من المواضيع ───────────── */
{
  check('«Science fiction» = خيال علمي', classifyBook(['Science fiction']).includes('sci_fi'));
  check('«Detective and mystery stories» = بوليسي', classifyBook(['Detective and mystery stories']).includes('mystery'));
  check('«Arabic poetry» = شعر', classifyBook(['Arabic poetry']).includes('poetry'));
  check('«Biography» = سيرة', classifyBook(['Biography']).includes('biography'));
  check('«Horror tales» = رعب', classifyBook(['Horror tales']).includes('horror'));
  check('«Juvenile fiction» = أطفال', classifyBook(['Juvenile fiction']).includes('children'));
  check('«History» = تاريخ', classifyBook(['History']).includes('history'));
  check('«Drama» = مسرحيات', classifyBook(['Drama']).includes('theater'));
  check('«Self-help» = تطوير الذات', classifyBook(['Self-help']).includes('self_help'));
  check('«Philosophy» = فلسفة', classifyBook(['Philosophy']).includes('philosophy'));
  check('«Short stories» = قصة قصيرة', classifyBook(['Short stories']).includes('short_stories'));
  check('«Fiction» = رواية', classifyBook(['Fiction']).includes('novel'));
  check('مواضيع عربية تنصنّف', classifyBook(['شعر عربي']).includes('poetry') && classifyBook(['رواية عربية']).includes('novel'));
  check('classifyBook العادي يرجع فاضي لكتاب بلا مواضيع', classifyBook([]).length === 0);
  check('classifyBookStrict يعطي صنف افتراضي', classifyBookStrict([]).join() === DEFAULT_GENRE);
  check('classifyBookStrict يحترم التصنيف الحقيقي', classifyBookStrict(['Arabic poetry']).includes('poetry'));
  check('التصنيفات محصورة بـ4', classifyBook(['Fiction', 'Poetry', 'Drama', 'History', 'Horror tales', 'Science fiction']).length <= 4);
}

/* ───────────── إعادة الضبط ───────────── */
{
  const storage = memoryBookStorage();
  const catalog = new BookCatalog(storage, fakeFetch);
  mode = 'ok';
  await catalog.seed(3);
  await catalog.reset();
  check('إعادة الضبط تمسح الكتب', (await catalog.stats()).total === 0);
  const chunks = await storage.list({ prefix: 'books:chunk:' });
  check('إعادة الضبط تمسح الدفعات', chunks.size === 0);
}

console.log(`Book catalog checks passed: ${passed} assertions (10k seeding, chunked storage, dedupe, search, random pick, safe fallback).`);
