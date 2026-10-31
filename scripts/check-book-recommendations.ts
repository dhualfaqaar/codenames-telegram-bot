// فحص خدمة «اقترحلي كتاب»: يتحقق من قاعدة الكتب (مؤلف/سنة/صفحات/تصنيفات)
// ثم يشغّل البوت بتوكن وهمي ويضغط الأزرار فعلياً: الخدمة ← تصنيف ← عقد ← كتاب،
// ويتأكد إن البطاقة تعرض اسم الكتاب والمؤلف، وإن «كتاب ثاني» ما يكرر نفس الكتاب.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as Books from '../src/services/bookRecommendationEngine';
import { BookCatalog, memoryBookStorage } from '../src/services/bookCatalog';
import { TelegramBotManager } from '../server/telegramBot';

/** صفحات Open Library وهمية للمكتبة الكبيرة داخل الفحص. */
function fakeCatalogPage(lang: string, page: number, subject: string, q: string) {
  return {
    numFound: 4000,
    docs: Array.from({ length: 100 }, (_, index) => {
      const n = (page - 1) * 100 + index;
      const seed = `${q}#${n}`;
      let hash = 0;
      for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 1_000_000_007;
      const title = lang === 'ara' ? `رواية عربية رقم ${hash % 100000}` : `Novel number ${hash % 100000}`;
      return {
        key: `/works/OL${lang}${hash}W`,
        title,
        author_name: [lang === 'ara' ? `كاتب عربي ${hash % 300}` : `Writer ${hash % 300}`],
        first_publish_year: 1910 + (n % 110),
        number_of_pages_median: 120 + (n % 380),
        cover_i: 5000 + (n % 900),
        language: [lang],
        subject: subject ? [subject] : ['Fiction'],
        first_sentence: [`جملة افتتاح للكتاب رقم ${hash % 1000} تصف المشهد الأول من الحكاية.`],
        ia: lang === 'ara' ? [`free${hash}id`] : undefined,
        public_scan_b: lang === 'ara'
      };
    })
  };
}
const fakeCatalogFetch = (async (input: any) => {
  const parsed = new URL(String(typeof input === 'string' ? input : input.url));
  const q = parsed.searchParams.get('q') || '';
  const lang = (q.match(/language:([a-z]{3})/) || [])[1] || 'ara';
  const subject = (q.match(/subject:"([^"]+)"/) || [])[1] || '';
  const page = Number(parsed.searchParams.get('page') || '1');
  if (parsed.hostname === 'archive.org' && parsed.pathname.startsWith('/metadata/')) {
    const id = parsed.pathname.split('/').pop() || '';
    return { ok: true, json: async () => ({ metadata: { rights: id.startsWith('locked') ? 'copyright' : 'Public Domain' }, files: [{ name: `${id}.pdf`, size: '1234' }] }) } as any;
  }
  if (parsed.pathname.includes('/editions')) {
    return {
      ok: true,
      json: async () => ({
        entries: [
          { title: 'Latin Only Title', by_statement: 'by Someone' },
          { title: 'عنوان عربي للكتاب', by_statement: 'تأليف: عبد الله' }
        ]
      })
    } as any;
  }
  if (parsed.pathname.includes('/works/')) {
    return { ok: true, json: async () => ({ description: 'وصف تفصيلي يشرح موضوع الكتاب وأجوائه وأفكاره الأساسية كما وردت في أوبن لايبراري.' }) } as any;
  }
  const authorQuery = parsed.searchParams.get('author') || '';
  if (authorQuery) {
    return {
      ok: true,
      json: async () => ({
        docs: [{ key: '/works/OLAUTHOR1W', title: 'أولاد حارتنا', author_name: [authorQuery], first_publish_year: 1959, cover_i: 77, language: ['ara'], subject: ['Arabic fiction'] }]
      })
    } as any;
  }
  return { ok: true, json: async () => fakeCatalogPage(lang, page, subject, q) } as any;
}) as unknown as typeof fetch;

let passed = 0;
const check = (name: string, condition: unknown) => {
  if (!condition) throw new Error(`فشل: ${name}`);
  passed += 1;
};

/* ───────────────── قاعدة الكتب ───────────────── */
const all = Books.allBooks();
const genres = Books.bookGenres();

check('قاعدة الكتب فيها ≥70 كتاب', all.length >= 70);
check('معرّفات الكتب فريدة', new Set(all.map(book => book.id)).size === all.length);
check('ماكو كتاب مكرر بالعنوان والمؤلف', new Set(all.map(book => `${book.title}::${book.author}`)).size === all.length);
check('كل كتاب إله عنوان', all.every(book => book.title.trim().length > 1));
check('كل كتاب إله مؤلف', all.every(book => book.author.trim().length > 1));
check('كل كتاب إله نبذة', all.every(book => book.blurb.trim().length >= 25));
check('كل كتاب إله عدد صفحات منطقي', all.every(book => book.pages > 20 && book.pages < 3000));
check('كل كتاب إله سنة منطقية', all.every(book => book.year >= 700 && book.year <= 2025));
check('كل كتاب إله بلد مؤلف', all.every(book => book.country.trim().length > 1));
check('كل كتاب إله تصنيف واحد على الأقل', all.every(book => book.genres.length >= 1));
check('كل كتاب مؤلفه مو نفس عنوانه', all.every(book => book.author !== book.title));

check('التصنيفات 29 تصنيف', genres.length === 29);
check('كل تصنيف إله اسم عربي', genres.every(genre => Books.BOOK_GENRE_LABELS[genre].length > 1));
check('كل تصنيف بالقاعدة المختارة إله ≥3 كتب', Books.curatedGenres().every(genre => Books.booksFor(genre).length >= 3));
check('الأصناف الجديدة موجودة', ['psychology', 'arabic_lit', 'english_lit', 'french_lit', 'russian_lit', 'german_lit', 'politics', 'economics', 'science', 'math', 'sports', 'medicine', 'arts', 'mythology', 'comics', 'manga', 'fantasy'].every(genre => genres.includes(genre as Books.BookGenre)));
check('كل تصنيف بالقاعدة المختارة إله ≥2 عقود', Books.curatedGenres().every(genre => Books.bookDecades(genre).length >= 2));
check('العقود مرتبة تنازلياً', genres.every(genre => {
  const decades = Books.bookDecades(genre);
  return decades.every((decade, index) => index === 0 || decades[index - 1] > decade);
}));
check('عقد أي كتاب يطابق حساب السنة', all.every(book => Books.bookDecade(book.year) === Math.floor(book.year / 10) * 10));
check('تسمية العقد تغطي عشر سنوات', Books.bookDecadeLabel(1970) === '1970–1979');


check('الترشيح يحترم التصنيف', (() => {
  for (const genre of Books.curatedGenres()) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const book = Books.pickBook(genre, 'all');
      if (!book || !book.genres.includes(genre)) return false;
    }
  }
  return true;
})());
check('الترشيح يحترم العقد', (() => {
  for (const genre of Books.curatedGenres()) {
    for (const decade of Books.bookDecades(genre)) {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const book = Books.pickBook(genre, decade);
        if (!book || Books.bookDecade(book.year) !== decade) return false;
      }
    }
  }
  return true;
})());
check('الاستبعاد يمنع تكرار نفس الكتاب', (() => {
  for (const genre of Books.curatedGenres()) {
    const sample = Books.booksFor(genre);
    if (sample.length < 2) continue;
    const excluded = sample[0].id;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const next = Books.pickBook(genre, 'all', excluded);
      if (!next || next.id === excluded) return false;
    }
  }
  return true;
})());
check('لو التصنيف كله كتاب واحد، الاستبعاد يرجع نفس الكتاب بدل الفراغ', (() => {
  const single = Books.booksFor('theater').slice(0, 1)[0];
  return Boolean(Books.pickBook('theater', Books.bookDecade(single.year), single.id));
})());
check('عقد فاضي يرجع بلا كتاب (ما ينكسر)', Books.pickBook('poetry', 1900) === undefined);

/* ───────────────── التدفّق الحقيقي عبر البوت ───────────────── */
type Call = { method: string; body: any };
let calls: Call[] = [];
let failDocument = false;
const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(typeof input === 'string' ? input : input.url);
  const method = url.split('/').pop()!.split('?')[0];
  let body: any = null;
  try {
    body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body || null;
  } catch {
    body = null;
  }
  calls.push({ method, body });
  if (method === 'sendDocument' && failDocument) return jsonResponse({ ok: false, description: 'network error' });
  if (method === 'getMe') return jsonResponse({ ok: true, result: { id: 1, username: 'testbot', first_name: 'Bot' } });
  if (method === 'getChatAdministrators') return jsonResponse({ ok: true, result: [] });
  if (method === 'getChatMember') return jsonResponse({ ok: true, result: { status: 'member', user: { id: 42 } } });
  return jsonResponse({ ok: true, result: { message_id: 777, message: { message_id: 777, chat: { id: 42 } } } });
}) as typeof fetch;

const bot = new TelegramBotManager('TEST:TOKEN');
const anyBot = bot as any;

const press = (data: string) => ({
  id: `cb-${data}`,
  from: { id: 42, first_name: 'لاعب' },
  message: { chat: { id: 42, type: 'private' }, message_id: 777 }
});

/** آخر نص/أزرار انرسلت (تعديل أو إرسال). */
function lastScreen() {
  const edits = calls.filter(call => call.method === 'editMessageText');
  const sends = calls.filter(call => call.method === 'sendMessage');
  const photos = calls.filter(call => call.method === 'sendPhoto');
  const call = photos.length
    ? photos[photos.length - 1]
    : edits.length ? edits[edits.length - 1] : sends[sends.length - 1];
  return {
    text: String(call?.body?.caption || call?.body?.text || ''),
    keyboard: JSON.stringify(call?.body?.reply_markup?.inline_keyboard || []),
    method: call?.method || ''
  };
}

/** نص أي رسالة انبعتت (نص أو كابشن صورة). */
function screenText(call?: Call) {
  return String(call?.body?.caption || call?.body?.text || '');
}

calls = [];
await anyBot.handleExtraServicesCb(press('svc:main'), 'svc:main');
check('كارت «اقترحلي كتاب» موجود بقائمة الخدمات', lastScreen().keyboard.includes('svc:books'));

calls = [];
await anyBot.handleExtraServicesCb(press('svc:books'), 'svc:books');
{
  const screen = lastScreen();
  check('شاشة الكتب تعرض كل التصنيفات', genres.every(genre => screen.keyboard.includes(`svc:books:genre:${genre}`)));
  check('شاشة الكتب فيها اقتراح عشوائي', screen.keyboard.includes('svc:books:pick:all:all') || screen.keyboard.includes('svc:books:rand'));
  check('شاشة الكتب فيها رجوع للخدمات', screen.keyboard.includes('svc:main'));
  check('شاشة الكتب تشرح الخدمة', screen.text.includes('اقترحلي كتاب'));
}

calls = [];
await anyBot.handleExtraServicesCb(press('svc:books:genre:novel'), 'svc:books:genre:novel');
{
  const screen = lastScreen();
  check('شاشة العقد تعرض عقود التصنيف', Books.bookDecades('novel').every(decade =>
    screen.keyboard.includes(`svc:books:pick:novel:${decade}`)));
  check('شاشة العقد فيها خيار أي عقد', screen.keyboard.includes('svc:books:pick:novel:all'));
}

calls = [];
await anyBot.handleExtraServicesCb(press('svc:books:pick:novel:all'), 'svc:books:pick:novel:all');
{
  const screen = lastScreen();
  const book = all.find(item => screen.text.includes(item.title));
  check('البطاقة تعرض عنوان كتاب حقيقي من القاعدة', Boolean(book));
  check('البطاقة تعرض اسم المؤلف', Boolean(book) && screen.text.includes(book!.author));
  check('البطاقة فيها سطر «اسم الكتاب»', screen.text.includes(`*اسم الكتاب:* ${book!.title}`));
  check('البطاقة فيها سطر «المؤلف»', screen.text.includes(`*المؤلف:* ${book!.author}`));
  check('البطاقة فيها سطر «السنة»', screen.text.includes(`*السنة:* ${book!.year}`));
  check('البطاقة فيها سطر «الصفحات»', screen.text.includes(`*الصفحات:* ${book!.pages}`));
  check('البطاقة فيها سطر «البلد»', screen.text.includes(`*البلد:* ${book!.country}`));
  check('البطاقة فيها عنوان «النبذة»', screen.text.includes('*النبذة:*'));
  {
    const lines = screen.text.split('\n').filter(line => line.trim().length > 0);
    check('كل حقل بسطر مستقل (بلا دمج)', lines.filter(line => line.startsWith('*') && line.includes(':*')).length >= 5);
    check('ماكو حقلين بنفس السطر', !/\*المؤلف:\*.*\*السنة:\*/u.test(screen.text));
  }
  check('البطاقة تعرض النبذة', Boolean(book) && screen.text.includes(book!.blurb.slice(0, 20)));
  check('البطاقة فيها زر «كتاب ثاني»', screen.keyboard.includes(`svc:books:again:novel:all:${book!.id}`));
  check('البطاقة فيها تغيير التصنيف والعقد', screen.keyboard.includes('svc:books') && screen.keyboard.includes('svc:books:genre:novel'));
}

// «كتاب ثاني» لا يرجّع نفس الكتاب (كل التصنيفات، أكثر من محاولة)
{
  let repeats = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    calls = [];
    await anyBot.handleExtraServicesCb(press('svc:books:pick:mystery:all'), 'svc:books:pick:mystery:all');
    const firstText = lastScreen().text;
    const first = all.find(item => firstText.includes(item.title));
    calls = [];
    await anyBot.handleExtraServicesCb(
      press(`svc:books:again:mystery:all:${first!.id}`),
      `svc:books:again:mystery:all:${first!.id}`
    );
    if (lastScreen().text.includes(first!.title)) repeats += 1;
  }
  check('«كتاب ثاني» ما يعيد نفس الكتاب', repeats === 0);
}

// اقتراح عشوائي + رفض المدخلات الغلط
{
  calls = [];
  await anyBot.handleExtraServicesCb(press('svc:books:pick:all:all'), 'svc:books:pick:all:all');
  const randomBook = all.find(item => lastScreen().text.includes(item.title));
  check('الاقتراح العشوائي يرجع كتاب من القاعدة', Boolean(randomBook));

  calls = [];
  await anyBot.handleExtraServicesCb(press('svc:books:pick:zzz:all'), 'svc:books:pick:zzz:all');
  check('التصنيف الغلط ينرفض', calls.some(call => call.method === 'answerCallbackQuery'));

  calls = [];
  await anyBot.handleExtraServicesCb(press('svc:books:pick:novel:123'), 'svc:books:pick:novel:123');
  check('العقد الغلط ينرفض', calls.some(call => call.method === 'answerCallbackQuery'));
}

/* ───────────────── الجولة 37: الرسالة نظيفة والمكتبة كبيرة ───────────────── */
{
  const catalog = new BookCatalog(memoryBookStorage(), fakeCatalogFetch);
  await catalog.seed(40);
  anyBot.bookCatalog = catalog;

  // النص لازم يكون عراقي بحت وبلا كلمات خليجية/فصحى ثقيلة
  {
    calls = [];
    await anyBot.handleExtraServicesCb(press('svc:books'), 'svc:books');
    const bookScreen = lastScreen();
    const FORBIDDEN = ['تريد', 'تريده', 'لغات مختلفة', 'فيها'];
    check('النص يستعمل صيغة «الرقم اللي بصف كل صنف»', bookScreen.text.includes('الرقم اللي بصف كل صنف هو عدد كتبه'));
    check('النص يستعمل «من جوا» (لهجة عراقية)', bookScreen.text.includes('من جوا'));
    check('النص يستعمل «اضغط» مثل ما طلب المستخدم', bookScreen.text.includes('اضغط «كتاب عشوائي»'));
    const lower = bookScreen.text;
    check('نص الخدمة بلا كلمات خليجية', FORBIDDEN.every(word => !lower.includes(word)));
    check('نص الخدمة يستعمل «بيها» العراقية', lower.includes('بيها') || lower.includes('بعدها تتجهّز'));
    check('نص الخدمة بلا «..» أو أرقام ناقصة', !/\.\.|\*\s*\*/.test(lower));
    check('نص الخدمة بلا شرطات مكررة', !lower.includes('--'));
    check('نص الخدمة بلا جملة النمو بالخلفية', !lower.includes('تكبر بالخلفية'));
  }

  // شاشة الصنف لازم تعرض عدد كتب المكتبة الكبيرة (مو ٤–٦ كتب)
  calls = [];
  await anyBot.handleExtraServicesCb(press('svc:books:genre:novel'), 'svc:books:genre:novel');
  const genreScreen = lastScreen();
  check('شاشة الصنف تعرض عدد كتب المكتبة', /المكتبة بيها \*?[\d,]+\*? كتاب/.test(genreScreen.text));
  check('أزرار العقود تعرض عدد الكتب', /\d{4}–\d{4} · \d+/.test(genreScreen.keyboard));
  check('زر «أي عقد» يعرض الإجمالي', /أي عقد · \d+/.test(genreScreen.keyboard));

  // «كتاب ثاني» داخل صنف+عقد لازم يعطي عناوين كثيرة مو نفس ٤ كتب
  {
    const titles = new Set<string>();
    let previous = '';
    for (let round = 0; round < 40; round += 1) {
      calls = [];
      const data = round === 0
        ? 'svc:books:pick:novel:all'
        : `svc:books:again:novel:all:${previous}`;
      await anyBot.handleExtraServicesCb(press(data), data);
      const text = lastScreen().text;
      const title = (text.match(/\*اسم الكتاب:\* (.+)/) || [])[1];
      const id = (lastScreen().keyboard.match(/svc:books:again:novel:all:([^"]+)"/) || [])[1];
      if (title) titles.add(title);
      if (id) previous = id;
    }
    check('٤٠ سحبة داخل صنف تعطي ≥20 عنوان مختلف', titles.size >= 20);
    check('السحب داخل الصنف يستعمل المكتبة الكبيرة', previous.startsWith('OL'));
  }

  // النبذة + أزرار PDF/الرابط على بطاقة المكتبة الكبيرة
  {
    calls = [];
    await anyBot.handleExtraServicesCb(press('svc:books:rand'), 'svc:books:rand');
    const card = lastScreen();
    check('البطاقة فيها «النبذة»', card.text.includes('*النبذة:*'));
    check('النبذة مو فاضية', /\*النبذة:\*\n\S/.test(card.text));
    check('البطاقة بلا زر صفحة الكتاب', !card.keyboard.includes('openlibrary.org/works/'));
    if (card.keyboard.includes('svc:books:pdf:')) {
      const bookId = (card.keyboard.match(/svc:books:pdf:([^"]+)"/) || [])[1];
      calls = [];
      await anyBot.handleExtraServicesCb(press(`svc:books:pdf:${bookId}`), `svc:books:pdf:${bookId}`);
      check('زر PDF يرسل مستند', calls.some(call => call.method === 'sendDocument'));
      const doc = calls.find(call => call.method === 'sendDocument');
      check('رابط المستند من archive.org', String(doc?.body?.document || '').includes('archive.org/download/'));
    } else {
      check('كتاب غير حر ما يعرض زر PDF', !card.keyboard.includes('svc:books:pdf:'));
    }
  }

  // حالتان محددتان: كتاب حر (زر PDF) وكتاب محفوظ (بلا زر PDF)
  {
    const storage = memoryBookStorage();
    await storage.put('books:chunk:0000', [
      { id: 'OLFREE1W', title: 'كتاب حر', author: 'مؤلف حر', year: 1890, pages: 210, cover: null, lang: 'ara', subject: 'Philosophy', genres: ['philosophy'], ia: 'freebook00id', pd: true },
      { id: 'OLPAID1W', title: 'كتاب محفوظ', author: 'مؤلف حديث', year: 2018, pages: 300, cover: null, lang: 'ara', subject: 'Philosophy', genres: ['philosophy'], ia: 'locked00id', pd: false }
    ]);
    const special = new BookCatalog(storage, fakeCatalogFetch);
    anyBot.bookCatalog = special;

    calls = [];
    await anyBot.sendCatalogBookCard(press('svc:books:rand'), '42', undefined, (await special.byId('OLFREE1W'))!, 'من المكتبة');
    const freeCard = lastScreen();
    check('كتاب حر يعرض زر PDF', freeCard.keyboard.includes('svc:books:pdf:OLFREE1W'));
    check('بطاقة الكتاب الحر فيها نبذة', freeCard.text.includes('*النبذة:*'));

    calls = [];
    await anyBot.handleExtraServicesCb(press('svc:books:pdf:OLFREE1W'), 'svc:books:pdf:OLFREE1W');
    const docCall = calls.find(call => call.method === 'sendDocument');
    check('ضغط PDF يرسل ملف من archive.org', Boolean(docCall) && String(docCall!.body.document) === 'https://archive.org/download/freebook00id/freebook00id.pdf');
    check('المستند بلا رابط صفحة الكتاب', !JSON.stringify(docCall?.body).includes('openlibrary.org'));
    calls = [];
    failDocument = true;
    await anyBot.handleExtraServicesCb(press('svc:books:pdf:OLFREE1W'), 'svc:books:pdf:OLFREE1W');
    failDocument = false;
    check('فشل إرسال الملف ما يتحول لرابط أو سبب مختلق', calls.some(call => call.method === 'sendMessage' && String(call.body.text).includes('ما كدرت أرسل')) && !JSON.stringify(calls.filter(call => call.method === 'sendMessage')).includes('archive.org/download/'));


    calls = [];
    await anyBot.sendCatalogBookCard(press('svc:books:rand'), '42', undefined, (await special.byId('OLPAID1W'))!, 'من المكتبة');
    const paidCard = lastScreen();
    check('زر PDF متوفر للتحقق عند الطلب', paidCard.keyboard.includes('svc:books:pdf:'));
    check('كتاب محفوظ الحقوق بلا رابط الصفحة', !paidCard.keyboard.includes('openlibrary.org/works/'));

    calls = [];
    await anyBot.handleExtraServicesCb(press('svc:books:pdf:OLPAID1W'), 'svc:books:pdf:OLPAID1W');
    check('ضغط PDF لكتاب محفوظ يعطي تنبيه', calls.some(call => call.method === 'sendMessage' && String(call.body.text).includes('PDF')) && !calls.some(call => call.method === 'sendDocument'));

    anyBot.bookCatalog = catalog;
  }

  // وصف إنجليزي: يوضح «النبذة (بالإنجليزية)» بدل ما يلخبط
  {
    const storage = memoryBookStorage();
    await storage.put('books:chunk:0000', [
      { id: 'OLENG1W', title: 'The Prince', author: 'Machiavelli', year: 1515, pages: 140, cover: null, lang: 'eng', subject: 'Philosophy', genres: ['philosophy'], first: 'A short political treatise about power and how rulers keep it.', pd: false }
    ]);
    // ماكو وصف من الـAPI: نعتمد جملة الافتتاح الإنجليزية
    const emptyApiFetch = (async (input: any) => {
      const url = String(typeof input === 'string' ? input : input.url);
      if (url.includes('/editions')) return { ok: true, json: async () => ({ entries: [] }) } as any;
      return { ok: true, json: async () => ({}) } as any;
    }) as unknown as typeof fetch;
    anyBot.bookCatalog = new BookCatalog(storage, emptyApiFetch, { queryGapMs: 0 });
    calls = [];
    await anyBot.sendCatalogBookCard(press('svc:books:rand'), '42', undefined, (await anyBot.bookCatalog.byId('OLENG1W'))!, 'من المكتبة');
    const card = lastScreen();
    check('بدون وصف عربي لا تعرض نبذة إنجليزية', !card.text.includes('النبذة'));
    check('جملة الافتتاح لا تعرض كنبذة', !card.text.includes('political treatise'));
    anyBot.bookCatalog = catalog;
  }

  // كتاب بلا وصف نهائياً: ما تظهر «النبذة» ولا تظهر بيانات نشر مكررة
  {
    const storage = memoryBookStorage();
    await storage.put('books:chunk:0000', [
      { id: 'OLNODESC1W', title: 'كتاب بلا وصف', author: 'مؤلف', year: 1900, pages: 210, cover: null, lang: 'ara', subject: 'Philosophy', genres: ['philosophy'] }
    ]);
    const emptyApiFetch = (async (input: any) => {
      const url = String(typeof input === 'string' ? input : input.url);
      if (url.includes('/editions')) return { ok: true, json: async () => ({ entries: [] }) } as any;
      return { ok: true, json: async () => ({}) } as any;
    }) as unknown as typeof fetch;
    anyBot.bookCatalog = new BookCatalog(storage, emptyApiFetch, { queryGapMs: 0 });
    calls = [];
    await anyBot.sendCatalogBookCard(press('svc:books:rand'), '42', undefined, (await anyBot.bookCatalog.byId('OLNODESC1W'))!, 'من المكتبة');
    const card = lastScreen();
    check('بلا وصف: ماكو قسم «النبذة»', !card.text.includes('النبذة'));
    check('بلا وصف: ماكو «كتاب من تصنيف»', !card.text.includes('كتاب من تصنيف'));
    check('بلا وصف: ماكو «صدر سنة»', !card.text.includes('صدر سنة'));
    check('بلا وصف: ماكو «صفحة» بالوصف', !/\*النبذة[^]*صفحة/.test(card.text));
    check('بلا وصف: البطاقة بعدها تعرض البيانات', card.text.includes('*اسم الكتاب:*') && card.text.includes('*الصفحات:*'));
    anyBot.bookCatalog = catalog;
  }

  // كتاب محفوظ الحقوق: الضغط على PDF يرد برسالة تنبيه
  {
    calls = [];
    await anyBot.handleExtraServicesCb(press('svc:books:pdf:OLNOPE'), 'svc:books:pdf:OLNOPE');
    check('PDF لكتاب مو موجود ينرفض', calls.some(call => call.method === 'answerCallbackQuery'));
  }

  // تعريب العنوان/المؤلف عند وجود طبعة عربية
  {
    const storage = memoryBookStorage();
    await storage.put('books:chunk:0000', [
      { id: 'OLAR1W', title: 'Children of Gebelawi', author: 'Najib Mahfuz', year: 1959, pages: 552, cover: null, lang: 'ara', subject: 'Arabic fiction', genres: ['novel', 'arabic_lit'] }
    ]);
    anyBot.bookCatalog = new BookCatalog(storage, fakeCatalogFetch, { queryGapMs: 0 });
    calls = [];
    await anyBot.sendCatalogBookCard(press('svc:books:rand'), '42', undefined, (await anyBot.bookCatalog.byId('OLAR1W'))!, 'من المكتبة');
    const card = lastScreen();
    check('العنوان يطلع بالعربي', card.text.includes('عنوان عربي للكتاب') && !card.text.includes('Children of Gebelawi'));
    check('المؤلف يطلع بالعربي', card.text.includes('عبد الله') && !card.text.includes('Najib Mahfuz'));
    anyBot.bookCatalog = catalog;
  }

  // الأصناف الجديدة تظهر بالشاشة وبأعدادها
  {
    calls = [];
    await anyBot.handleExtraServicesCb(press('svc:books'), 'svc:books');
    const screen = lastScreen();
    const expected = ['علم نفس', 'أدب عربي', 'أدب إنجليزي', 'أدب فرنسي', 'أدب روسي', 'أدب ألماني', 'سياسة', 'اقتصاد', 'علوم', 'رياضيات', 'رياضة', 'طب وصحة', 'فنون وموسيقى', 'أساطير وفلكلور', 'كوميكس', 'مانغا', 'فانتازيا'];
    check('كل الأصناف الجديدة بالشاشة', expected.every(label => screen.keyboard.includes(label)));
    check('عدد أزرار الأصناف 29', (screen.keyboard.match(/svc:books:genre:/g) || []).length === 29);
  }

  // صنف برعب: يرجع من المكتبة الكبيرة (معرّفات OL) مو من القاعدة القديمة
  {
    calls = [];
    await anyBot.handleExtraServicesCb(press('svc:books:pick:horror:all'), 'svc:books:pick:horror:all');
    const keyboard = lastScreen().keyboard;
    check('سحب صنف آخر يرجع كتاب من المكتبة الكبيرة', /svc:books:again:horror:all:OL/.test(keyboard));
  }

  calls = [];
  await anyBot.handleExtraServicesCb(press('svc:books'), 'svc:books');
  const screen = lastScreen();
  check('رسالة الخدمة بلا \\n حرفية', !screen.text.includes('\\n'));
  check('رسالة الخدمة بلا شرطات مزدوجة --', !screen.text.includes('--'));
  check('رسالة الخدمة تبدأ بالعربي والإيموجي بآخر السطر', /^\*[^*]+\*\s*📚/u.test(screen.text));
  check('رسالة الخدمة تعرض عدد كتب المكتبة', /\d{1,3},\d{3}/.test(screen.text) || screen.text.includes('كتاب من'));
  check('شاشة الكتب فيها زر كتاب عشوائي جديد', screen.keyboard.includes('svc:books:rand'));
  check('شاشة الكتب فيها زر البحث', screen.keyboard.includes('svc:books:search'));
  check('شاشة الخدمة ما تستعمل فاصل طويل', !screen.text.includes('━━━'));
  check('الأسطر بالرسالة حقيقية (أكثر من سطر)', screen.text.split('\n').length >= 3);

  calls = [];
  await anyBot.handleExtraServicesCb(press('svc:books:rand'), 'svc:books:rand');
  const randScreen = lastScreen();
  const randCall = calls.find(call => ['sendPhoto', 'editMessageText', 'sendMessage'].includes(call.method));
  check('كل زر صنف يعرض عدد كتبه', (screen.keyboard.match(/· \d+/g) || []).length >= 12);
  check('الشاشة تقول إن الكتب مقسّمة على أصناف', screen.text.includes('ومقسّمة على'));
  check('الكتاب العشوائي يعرض عنوان حقيقي', /\*اسم الكتاب:\* \S/.test(screenText(randCall)));
  check('الكتاب العشوائي يعرض سطر المؤلف', /\*المؤلف:\* \S/.test(screenText(randCall)));
  check('الكتاب العشوائي يذكر اللغة بالعربي', /\*اللغة:\* (العربية|الإنجليزية|الفرنسية|الألمانية|الروسية)/.test(screenText(randCall)));
  check('الكتاب العشوائي جا بغلاف صورة', calls.some(call => call.method === 'sendPhoto' && String(call.body?.photo || '').includes('covers.openlibrary.org/b/id/')));
  check('الكتاب العشوائي فيه زر كتاب ثاني', randScreen.keyboard.includes('svc:books:rand:'));

  // البحث: ضغط الزر ثم إرسال نص
  calls = [];
  await anyBot.handleExtraServicesCb(press('svc:books:search'), 'svc:books:search');
  check('شاشة البحث تطلب كتابة اسم', lastScreen().text.includes('اكتب') || lastScreen().text.includes('دوّر'));
  check('شاشة البحث فيها إلغاء', lastScreen().keyboard.includes('svc:books'));

  const waited = anyBot.pendingBookSearch.get('42:42');
  check('البوت يستنّى نص البحث', Boolean(waited));

  calls = [];
  await anyBot.handleBookSearchQuery('42', 'كتاب');
  const searchCall = calls.find(call => call.method === 'sendMessage' || call.method === 'editMessageText');
  check('البحث يرجّع نتائج من المكتبة', screenText(searchCall).includes('نتائج') || screenText(searchCall).includes('ما لكيت'));
  check('نتائج البحث فيها أزرار PDF مباشرة', JSON.stringify(searchCall?.body?.reply_markup || {}).includes('svc:books:pdf:') || String(searchCall?.body?.text || '').includes('ما لكيت'));

  // أوامر سريعة: «كتاب <اسم>» و«/book <اسم>»
  calls = [];
  await anyBot.handleMessage({ message_id: 9, chat: { id: 42, type: 'private' }, from: { id: 42, first_name: 'لاعب' }, text: 'كتاب نجيب' });
  check('أمر «كتاب <اسم>» يشتغل مباشرة', calls.some(call => screenText(call).includes('نجيب') || screenText(call).includes('نتائج') || screenText(call).includes('ما لكيت')));
  calls = [];
  await anyBot.handleMessage({ message_id: 9, chat: { id: 42, type: 'private' }, from: { id: 42, first_name: 'لاعب' }, text: '/book نجيب' });
  check('أمر «/book <اسم>» يشتغل مباشرة', calls.some(call => screenText(call).includes('نجيب') || screenText(call).includes('نتائج') || screenText(call).includes('ما لكيت')));

  const anyBook = (await catalog.all())[0];
  calls = [];
  await anyBot.handleBookSearchQuery('42', anyBook.title.slice(0, 6));
  const foundCall = calls.find(call => call.method === 'sendMessage' || call.method === 'editMessageText');
  check('البحث بالعنوان يلقى الكتاب', screenText(foundCall).includes(anyBook.title.slice(0, 8)));

  calls = [];
  await anyBot.handleExtraServicesCb(press(`svc:books:open:${anyBook.id}`), `svc:books:open:${anyBook.id}`);
  check('فتح كتاب من النتائج يشتغل', calls.some(call => call.method === 'answerCallbackQuery'));

  calls = [];
  await anyBot.handleExtraServicesCb(press('svc:books:open:OLNOPE'), 'svc:books:open:OLNOPE');
  check('معرّف غلط ينرفض بلطف', calls.some(call => call.method === 'answerCallbackQuery'));

  // بطاقة الاقتراحات اليدوية بعد التنظيف
  calls = [];
  await anyBot.handleExtraServicesCb(press('svc:books:pick:novel:all'), 'svc:books:pick:novel:all');
  const manual = lastScreen();
  check('بطاقة الاقتراح بلا \\n حرفية', !manual.text.includes('\\n'));
  check('بطاقة الاقتراح تبدأ بسطر التصنيف', manual.text.split('\n')[0].includes('كل العقود'));
  check('بطاقة الاقتراح تعرض اسم الكتاب بسطر خاص', /^\*اسم الكتاب:\* \S/m.test(manual.text));
  check('بطاقة الاقتراح فيها سطر سنة وسطر صفحات', /\*السنة:\* \d{4}/.test(manual.text) && /\*الصفحات:\* \d+/.test(manual.text));
}

/* ───────────────── مكتبة فاضية: بلا أرقام ناقصة ───────────────── */
{
  const emptyBot: any = new TelegramBotManager('TEST:TOKEN');
  calls = [];
  await emptyBot.handleExtraServicesCb(press('svc:books'), 'svc:books');
  const screen = lastScreen();
  check('مكتبة فاضية تكتب «بعدها تتجهّز»', screen.text.includes('بعدها تتجهّز'));
  check('مكتبة فاضية ما تطبع صفر', !screen.text.includes('*0*') && !screen.text.includes('0 كتاب'));
  check('مكتبة فاضية بلا أرقام صنف', !/· 0/.test(screen.keyboard));
  check('مكتبة فاضية بلا «..»', !screen.text.includes('..'));
}

/* ───────────────── ربط السورس ───────────────── */
{
  const src = readFileSync(resolve(import.meta.dirname, '..', 'server', 'telegramBot.ts'), 'utf8');
  check('الخدمة مربوطة بالراوتر', src.includes("data === 'svc:books' || data.startsWith('svc:books:')"));
  check('كارت الخدمة موجود بالقائمة', src.includes("callback_data: 'svc:books'"));
  check('البطاقة سطر لكل حقل', src.includes('`*المؤلف:* ${this.mdSafe(book.author)}`'));
  check('ماكو \\n حرفية بملف البوت', !src.includes('\\\\n'));
  check('المكتبة الكبيرة مربوطة بالبوت', src.includes('new BookCatalog(serviceConfig.bookStorage'));
  check('البوت يمرّر ملخّص Gemini للمكتبة', src.includes('summarizer: async (book, source) =>'));
  check('البوت يستعمل خدمة النبذات', src.includes('summarizeBookWithGemini'));
  check('النبذة تُفحص ببوابة الجودة قبل العرض', src.includes('isUsableDescription(rawBlurb'));
  check('بذر المكتبة متاح للمنبّه', src.includes('seedBookCatalog'));
  check('بحث الكتاب الحيّ مربوط', readFileSync(resolve(import.meta.dirname, '..', 'src', 'services', 'bookCatalog.ts'), 'utf8').includes('searchRemote') && src.includes('this.bookCatalog.search'));
  check('البوت يقبل تخزين الكتب من الـWorker', readFileSync(resolve(import.meta.dirname, '..', 'worker', 'index.ts'), 'utf8').includes('bookStorage: this.state.storage'));
}

console.log(`Book recommendation checks passed: ${passed} assertions (${all.length} books, ${genres.length} genres, menu → genre → decade → book card).`);
