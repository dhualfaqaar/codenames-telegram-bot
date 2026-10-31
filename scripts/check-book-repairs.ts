import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BookCatalog, memoryBookStorage, pickArchivePdf, type CatalogBook } from '../src/services/bookCatalog';
import { localizeBookWithGemini, summarizeBookWithGemini } from '../src/services/bookDescriptions';
import { TelegramBotManager } from '../server/telegramBot';

const book: CatalogBook = { id: 'OL66554W', title: 'Pride and Prejudice', author: 'Jane Austen', year: 1813, pages: 300, cover: null, lang: 'eng', subject: '', ia: 'locked' };
const english = 'The story follows Elizabeth Bennet and her family as they navigate social expectations and misunderstandings.';
let translations = 0;
const fetchWorks = (async (input: any) => {
  const url = String(input);
  if (url.includes('/editions')) return new Response(JSON.stringify({ entries: [{ title: 'كبرياء وتحامل', by_statement: 'Jane Austen' }] }));
  return new Response(JSON.stringify({ description: english }));
}) as typeof fetch;
const storage = memoryBookStorage();
await storage.put('books:loc:OL66554W', { title: 'خطأ قديم', author: 'Jane Austen' });
await storage.put('books:desc:OL66554W', english);
const catalog = new BookCatalog(storage, fetchWorks, {
  localizer: async () => ({ title: 'عنوان بديل', author: 'جَيْن أوستِن' }),
  summarizer: async (_book, source) => { translations++; assert.equal(source, english); return 'تتابع الرواية إليزابيث وعائلتها وسط التوقعات الاجتماعية وسوء الفهم بين الشخصيات.'; }
});
assert.deepEqual(await catalog.localize(book), { title: 'كبرياء وتحامل', author: 'جين أوستن', localized: true });
assert.match(await catalog.describe(book), /^تتابع الرواية/);
assert.match(await catalog.describe(book), /^تتابع الرواية/);
assert.equal(translations, 1);
const partiallyArabic = { ...book, id: 'OL999W', title: 'العنوان العربي', author: 'ʿAbd Allāh' };
const mixed = new BookCatalog(memoryBookStorage(), (async () => new Response('{"entries":[]}')) as typeof fetch);
assert.equal((await mixed.localize(partiallyArabic)).author, 'عبد الله');
const authorApi: typeof fetch = (async (input: any) => {
  const url = String(input);
  if (url.includes('/editions')) return new Response('{"entries":[]}');
  if (url.includes('/authors/OL123A')) return new Response('{"name":"Najib Mahfuz","alternate_names":["نجيب محفوظ"]}');
  if (url.includes('/works/')) return new Response('{"authors":[{"author":{"key":"/authors/OL123A"}}]}');
  return new Response('{}');
}) as typeof fetch;
const names = new BookCatalog(memoryBookStorage(), authorApi);
assert.equal((await names.localize({ ...book, id: 'OL123W', title: 'عنوان عربي', author: 'Najib Mahfuz' })).author, 'نجيب محفوظ');

const empty = new BookCatalog(memoryBookStorage(), (async () => new Response('{}')) as typeof fetch, { summarizer: async () => { throw new Error('must not invent'); } });
assert.equal(await empty.describe(book), '');
const foreignOnly = new BookCatalog(memoryBookStorage(), fetchWorks);
assert.equal(await foreignOnly.describe(book), '');
let count = 0;
const fakeAI = (async (_input: any, init: any) => {
  count++; const prompt = JSON.parse(init.body).contents[0].parts[0].text;
  if (prompt.includes('الوصف المصدر')) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"description":"تتابع الرواية إليزابيث وعائلتها وسط التوقعات الاجتماعية وسوء الفهم بين الشخصيات."}' }] } }] }));
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"title":"كبرياء وتحامل","author":"جين أوستن"}' }] } }] }));
}) as typeof fetch;
assert.equal(await summarizeBookWithGemini(book, 'key', { fetchImpl: fakeAI }), '');
assert.equal(count, 0);
assert.ok(await summarizeBookWithGemini(book, 'key', { fetchImpl: fakeAI, source: english }));
assert.equal((await localizeBookWithGemini(book, 'key', { fetchImpl: fakeAI }))?.author, 'جين أوستن');
const badAI = (async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"title":"unknown","author":"غير معروف"}' }] } }] }))) as typeof fetch;
assert.deepEqual(await localizeBookWithGemini(book, 'key', { fetchImpl: badAI }), { title: '', author: '' });

const metadata = { metadata: { 'possible-copyright-status': 'NOT_IN_COPYRIGHT', copyright_region: 'US', openlibrary_work: 'OL66554W', collection: ['americana'] }, files: [{ name: 'book.pdf', size: '123' }] };
assert.ok(pickArchivePdf('valid', metadata));
assert.equal(pickArchivePdf('valid', { ...metadata, metadata: { ...metadata.metadata, 'possible-copyright-status': 'IN_COPYRIGHT' } }), null);
assert.equal(pickArchivePdf('valid', { ...metadata, metadata: { ...metadata.metadata, rights: 'Copyright 2020' } }), null);
assert.equal(pickArchivePdf('valid', { ...metadata, files: [{ name: 'book_encrypted.pdf', size: '123' }] }), null);
const resultsFetch = (async (input: any) => {
  const url = String(input);
  if (url.includes('advancedsearch')) return new Response(JSON.stringify({ response: { docs: [{ identifier: 'wrong' }, { identifier: 'valid' }] } }));
  if (url.includes('/metadata/wrong')) return new Response(JSON.stringify({ ...metadata, metadata: { ...metadata.metadata, openlibrary_work: 'OL999W' } }));
  if (url.includes('/metadata/valid')) return new Response(JSON.stringify(metadata));
  if (url.includes('/metadata/locked')) return new Response(JSON.stringify({ metadata: { rights: 'Copyright' }, files: [] }));
  return new Response(JSON.stringify({ entries: [] }));
}) as typeof fetch;
assert.equal((await new BookCatalog(memoryBookStorage(), resultsFetch).archivePdf(book))?.identifier, 'valid');

const bytes = Buffer.from('%PDF-1.4\nreal pdf\n%%EOF');
const hash = createHash('sha1').update(bytes).digest('hex');
const bot: any = new TelegramBotManager('test:token', '42');
let uploaded = 0;
globalThis.fetch = (async (input: any, init: any) => {
  const url = String(input);
  if (url.startsWith('https://archive.org/')) return new Response(bytes);
  if (url.endsWith('/sendDocument')) { assert.ok(init.body instanceof FormData); assert.equal((init.body.get('document') as Blob).size, bytes.length); uploaded++; return new Response('{"ok":true}'); }
  throw new Error('unexpected request');
}) as typeof fetch;
assert.equal((await bot.uploadArchivePdf('42', 'https://archive.org/download/x/book.pdf', bytes.length, 'Book', [], hash))?.ok, true);
assert.equal(uploaded, 1);
assert.equal(await bot.uploadArchivePdf('42', 'https://archive.org/download/x/book.pdf', bytes.length, 'Book', [], 'a'.repeat(40)), null);
assert.equal(await bot.uploadArchivePdf('42', 'https://archive.org.evil.test/download/x/book.pdf', bytes.length, 'Book', []), null);
assert.equal(await bot.uploadArchivePdf('42', 'https://archive.org/download/x/book.pdf', 45 * 1024 * 1024, 'Book', []), null);
assert.equal(uploaded, 1);
// تدفق الزر بالكامل: لو تيليجرام رفض رابط أرشيف، نرفع الملف نفسه.
let urlAttempts = 0;
let uploadAttempts = 0;
let messages: string[] = [];
bot.bookCatalog = {
  byId: async () => book,
  archivePdf: async () => ({ url: 'https://archive.org/download/x/book.pdf', sizeBytes: bytes.length, sha1: hash }),
  channelPdf: async () => null,
  localize: async () => ({ title: 'كبرياء وتحامل', author: 'جين أوستن' })
};
bot.answerCallbackQuery = async () => ({ ok: true });
bot.sendMessage = async (_id: string, text: string) => { messages.push(text); };
globalThis.fetch = (async (input: any, init: any) => {
  const url = String(input);
  if (url.startsWith('https://archive.org/')) return new Response(bytes);
  if (url.endsWith('/sendDocument')) {
    if (typeof init.body === 'string') { urlAttempts++; return new Response('{"ok":false}'); }
    uploadAttempts++; assert.ok(init.body instanceof FormData);
    assert.ok(String(init.body.get('caption')).includes('جين أوستن'));
    return new Response('{"ok":true}');
  }
  throw new Error('unexpected request');
}) as typeof fetch;
const cb: any = { id: 'cb', from: { id: 42, first_name: 'Owner' }, message: { message_id: 1, chat: { id: 42, type: 'private' } } };
await bot.handleExtraServicesCb(cb, 'svc:books:pdf:OL66554W');
assert.equal(urlAttempts, 1);
assert.equal(uploadAttempts, 1);
assert.deepEqual(messages, []);
console.log('Book repair checks passed.');
