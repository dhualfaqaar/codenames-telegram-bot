import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ChannelBookIndex } from '../src/services/channelBookIndex';
import { BookCatalog, memoryBookStorage } from '../src/services/bookCatalog';
import { TelegramBotManager } from '../server/telegramBot';

const dir = mkdtempSync(join(tmpdir(), 'channel-book-test-'));
try {
  const filename = join(dir, 'result.json');
  const output = join(dir, 'batches');
  writeFileSync(filename, JSON.stringify({ name: 'مكتبة المليون كتاب', type: 'public_channel', messages: [
    { id: 72, type: 'message', mime_type: 'application/pdf', file: 'files/سأعود حين يفيض النهر - أحمد الملك.pdf', text: [{ type: 'bold', text: 'أحمد الملك' }] },
    { id: 73, type: 'message', file: 'files/picture.jpg', text: 'لا تفهرس' }
  ] }));
  const script = resolve('scripts/split-lovekotob-export.mjs');
  execFileSync('node', [script, filename, output]);
  const batch = JSON.parse(readFileSync(join(output, readdirSync(output)[0]), 'utf8'));
  assert.equal(batch.records.length, 1);
  assert.equal(batch.records[0].title, 'سأعود حين يفيض النهر');
  const storage = memoryBookStorage();
  const index = new ChannelBookIndex(storage);
  assert.equal(await index.importBatch(batch), 1);
  assert.equal((await index.search('احمد الملك'))[0]?.id, 72);
  assert.equal((await index.search('ساعود النهر'))[0]?.id, 72);
  assert.equal((await index.search('غير موجود')).length, 0);
  assert.equal((await index.get('72'))?.title, 'سأعود حين يفيض النهر');
  assert.equal((await new ChannelBookIndex(storage).search('احمد'))[0]?.id, 72);
  assert.equal(await index.importBatch(batch), 1);
  assert.equal((await index.search('احمد')).length, 1);
  await assert.rejects(() => index.importBatch({ format: 'lovekotob-index-v1', records: Array(1001).fill(batch.records[0]) }));
  const wrong = join(dir, 'wrong.json');
  writeFileSync(wrong, JSON.stringify({ name: 'محادثة خاصة', type: 'personal_chat', messages: [] }));
  assert.throws(() => execFileSync('node', [script, wrong, join(dir, 'rejected')], { stdio: 'ignore' }));
  const catalog = new BookCatalog(memoryBookStorage(), (async () => new Response('{}')) as typeof fetch);
  const book = { id: 'OL32121331W', title: 'Sa-aʻūdu ḥīna yafīḍu al-nahr', author: 'Aḥmad Malik', year: 2020, pages: 155, cover: null, lang: 'ara', subject: '' };
  assert.deepEqual(await catalog.localize(book), { title: 'سأعود حين يفيض النهر', author: 'أحمد الملك', localized: true });
  const realStorage = memoryBookStorage();
  await realStorage.put('books:chunk:0000', [book]);
  const stored = new BookCatalog(realStorage, (async () => new Response('{}')) as typeof fetch);
  assert.equal((await stored.searchLocal('أحمد الملك'))[0]?.id, book.id);
  assert.equal((await stored.searchLocal('سأعود حين يفيض النهر'))[0]?.id, book.id);
  const sourceWithYear = new BookCatalog(memoryBookStorage(), (async (input: any) => {
    if (String(input).includes('/editions')) return new Response('{"entries":[]}');
    return new Response(JSON.stringify({ description: 'Published in 1900, the story follows a family facing difficult choices and searching for belonging.' }));
  }) as typeof fetch, { summarizer: async (_book, source) => {
    assert.ok(source.includes('1900'));
    return 'تتابع الرواية عائلة تواجه خيارات صعبة وتبحث عن الانتماء في عالم سريع التغير.';
  } });
  assert.ok((await sourceWithYear.describe(book)).includes('عائلة'));

  // أسماء المؤلفين من ربط Wikidata المباشر، وليس مجرد تشابه أسماء.
  const wikidataFetch = (async (input: any) => {
    const url = String(input);
    if (url.includes('/editions')) return new Response('{"entries":[]}');
    if (url.includes('/works/OL66554W')) return new Response('{"authors":[{"author":{"key":"/authors/OL21594A"}}]}');
    if (url.includes('/authors/OL21594A')) return new Response('{"name":"Jane Austen","remote_ids":{"wikidata":"Q36322"}}');
    if (url.includes('wikidata.org')) return new Response('{"entities":{"Q36322":{"labels":{"ar":{"value":"جاين أوستن"}}}}}');
    return new Response('{}');
  }) as typeof fetch;
  const wikidataCatalog = new BookCatalog(memoryBookStorage(), wikidataFetch);
  assert.equal((await wikidataCatalog.localize({ ...book, id: 'OL66554W', title: 'كبرياء وتحامل', author: 'Jane Austen' })).author, 'جاين أوستن');

  // فحص SQL/FTS الحقيقي المستخدم في Durable Object، فوق حد ألف نتيجة.
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  const sqlStorage = memoryBookStorage();
  sqlStorage.sql = { exec(query: string, ...bindings: any[]): Iterable<any> {
    const stmt = db.prepare(query);
    if (/^\s*SELECT/i.test(query)) return stmt.all(...bindings);
    stmt.run(...bindings);
    return [];
  } };
  const sqlIndex = new ChannelBookIndex(sqlStorage);
  for (let n = 0; n < 6; n++) {
    const records = Array.from({ length: 250 }, (_, k) => ({ id: n * 250 + k + 1, title: 'كتاب مشترك', text: n === 5 && k === 249 ? 'أحمد الملك مميز' : 'مؤلف آخر' }));
    await sqlIndex.importBatch({ format: 'lovekotob-index-v1', records });
  }
  assert.equal((await sqlIndex.search('مشترك مميز'))[0]?.id, 1500);
  assert.equal((await sqlIndex.get('1500'))?.title, 'كتاب مشترك');
  await sqlIndex.importBatch({ format: 'lovekotob-index-v1', records: [{ id: 1500, title: 'عنوان متغير', text: 'مؤلف جديد' }] });
  assert.equal((await sqlIndex.search('مشترك مميز')).length, 0);
  assert.equal((await sqlIndex.search('متغير جديد'))[0]?.id, 1500);
  db.close();
  const bot: any = new TelegramBotManager('TEST:TOKEN', '42', false, { bookStorage: storage });
  const englishDescription = 'A story about a family facing difficult choices and searching for meaning in a changing city.';
  const card = bot.bookCardText({ title: 'سأعود حين يفيض النهر', author: 'أحمد الملك', description: englishDescription });
  assert.ok(!card.includes('النبذة'));
  const translatedCard = bot.bookCardText({ title: 'عنوان عربي', author: 'كاتب عربي', description: 'تتابع الرواية عائلة تواجه خيارات صعبة وتبحث عن معنى حياتها وسط التغيرات.' });
  assert.ok(translatedCard.includes('*النبذة:*'));
  const mixedCard = bot.bookCardText({ title: 'عنوان عربي', author: 'كاتب عربي', description: 'قصة عربية قصيرة لكن the English description dominates this entire passage with many additional words.' });
  assert.ok(!mixedCard.includes('النبذة'));

  const messages: Array<{ text: string; keyboard: any }> = [];
  const documents: string[] = [];
  bot.sendMessage = async (_: string, text: string, keyboard: any) => { messages.push({ text, keyboard }); return { ok: true }; };
  bot.answerCallbackQuery = async (_: string, text: string) => { if (text) messages.push({ text, keyboard: [] }); };
  bot.sendPdfDocument = async (_: string, url: string) => { documents.push(url); return { ok: true }; };
  bot.bookCatalog = {
    searchDetailed: async () => ({ local: [book], remote: [], remoteFailed: false }),
    localize: (value: any) => catalog.localize(value),
    byId: async () => book,
    archivePdf: async () => ({ url: 'https://archive.org/download/test/book.pdf', sizeBytes: 10 }),
    channelPdf: async () => null
  };
  const bytes = new TextEncoder().encode(JSON.stringify(batch));
  bot.downloadTelegramFileBytes = async () => ({ bytes, filePath: 'documents/index.json' });
  await bot.handleMessage({ message_id: 9, date: 1, from: { id: 42, first_name: 'Owner' }, chat: { id: 42, type: 'private' }, document: { file_id: 'test', file_size: bytes.length, file_name: 'lovekotob-index-000001.json' } });
  assert.ok(messages.some(message => message.text.includes('انضافت 1')));
  await bot.handleBookSearchQuery('42', 'احمد الملك');
  assert.ok(messages.some(message => JSON.stringify(message.keyboard || []).includes('svc:books:chpdf:72')));
  const cb = { id: 'cb', from: { id: 42, first_name: 'Owner' }, message: { message_id: 1, chat: { id: 42, type: 'private' } } };
  await bot.handleExtraServicesCb(cb, 'svc:books:chpdf:72');
  assert.deepEqual(documents, ['https://archive.org/download/test/book.pdf']);
  // اسم مطابق من غير دليل على المؤلف لا يسبب إرسال كتاب ثاني.
  await index.importBatch({ format: 'lovekotob-index-v1', records: [{ id: 74, title: 'سأعود حين يفيض النهر', text: 'اسم المؤلف غير معروف' }] });
  documents.length = 0;
  await bot.handleExtraServicesCb(cb, 'svc:books:chpdf:74');
  assert.deepEqual(documents, []);
  // مسار النتيجة لا يتجاوز فحص حقوق أرشيف.
  bot.bookCatalog.archivePdf = async () => null;
  await bot.handleExtraServicesCb(cb, 'svc:books:chpdf:72');
  assert.deepEqual(documents, []);
  assert.ok(messages.some(message => message.text.includes('الملكية العامة')));
  console.log('Channel search checks passed.');
} finally { rmSync(dir, { recursive: true, force: true }); }
