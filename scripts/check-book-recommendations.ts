// فحص خدمة «اقترحلي كتاب»: يتحقق من قاعدة الكتب (مؤلف/سنة/صفحات/تصنيفات)
// ثم يشغّل البوت بتوكن وهمي ويضغط الأزرار فعلياً: الخدمة ← تصنيف ← عقد ← كتاب،
// ويتأكد إن البطاقة تعرض اسم الكتاب والمؤلف، وإن «كتاب ثاني» ما يكرر نفس الكتاب.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as Books from '../src/services/bookRecommendationEngine';
import { TelegramBotManager } from '../server/telegramBot';

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

check('التصنيفات 12 تصنيف', genres.length === 12);
check('كل تصنيف إله ≥3 كتب', genres.every(genre => Books.booksFor(genre).length >= 3));
check('كل تصنيف إله ≥2 عقود', genres.every(genre => Books.bookDecades(genre).length >= 2));
check('العقود مرتبة تنازلياً', genres.every(genre => {
  const decades = Books.bookDecades(genre);
  return decades.every((decade, index) => index === 0 || decades[index - 1] > decade);
}));
check('عقد أي كتاب يطابق حساب السنة', all.every(book => Books.bookDecade(book.year) === Math.floor(book.year / 10) * 10));
check('تسمية العقد تغطي عشر سنوات', Books.bookDecadeLabel(1970) === '1970–1979');
check('كل تصنيف عربي مسمّى', genres.every(genre => Books.BOOK_GENRE_LABELS[genre].length > 1));

check('الترشيح يحترم التصنيف', (() => {
  for (const genre of genres) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const book = Books.pickBook(genre, 'all');
      if (!book || !book.genres.includes(genre)) return false;
    }
  }
  return true;
})());
check('الترشيح يحترم العقد', (() => {
  for (const genre of genres) {
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
  for (const genre of genres) {
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
  if (method === 'getMe') return jsonResponse({ ok: true, result: { id: 1, username: 'testbot', first_name: 'Bot' } });
  if (method === 'getChatAdministrators') return jsonResponse({ ok: true, result: [] });
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
  const call = edits.length ? edits[edits.length - 1] : sends[sends.length - 1];
  return {
    text: String(call?.body?.text || ''),
    keyboard: JSON.stringify(call?.body?.reply_markup?.inline_keyboard || [])
  };
}

calls = [];
await anyBot.handleExtraServicesCb(press('svc:main'), 'svc:main');
check('كارت «اقترحلي كتاب» موجود بقائمة الخدمات', lastScreen().keyboard.includes('svc:books'));

calls = [];
await anyBot.handleExtraServicesCb(press('svc:books'), 'svc:books');
{
  const screen = lastScreen();
  check('شاشة الكتب تعرض كل التصنيفات', genres.every(genre => screen.keyboard.includes(`svc:books:genre:${genre}`)));
  check('شاشة الكتب فيها اقتراح عشوائي', screen.keyboard.includes('svc:books:pick:all:all'));
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
  check('البطاقة تعرض اسم المؤلف بعد كلمة المؤلف', screen.text.includes('المؤلف:'));
  check('البطاقة تعرض سنة النشر', Boolean(book) && screen.text.includes(String(book!.year)));
  check('البطاقة تعرض عدد الصفحات', Boolean(book) && screen.text.includes(`${book!.pages} صفحة`));
  check('البطاقة تعرض بلد المؤلف', Boolean(book) && screen.text.includes(book!.country));
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

/* ───────────────── ربط السورس ───────────────── */
{
  const src = readFileSync(resolve(import.meta.dirname, '..', 'server', 'telegramBot.ts'), 'utf8');
  check('الخدمة مربوطة بالراوتر', src.includes("data === 'svc:books' || data.startsWith('svc:books:')"));
  check('كارت الخدمة موجود بالقائمة', src.includes("callback_data: 'svc:books'"));
  check('البطاقة تعرض المؤلف صراحة', src.includes('✍️ المؤلف:'));
}

console.log(`Book recommendation checks passed: ${passed} assertions (${all.length} books, ${genres.length} genres, menu → genre → decade → book card).`);
