import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { ChannelImportQueue } from '../src/services/channelImportQueue';
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
  const bulkPath = join(dir, 'lovekotob-import.json');
  execFileSync('node', [resolve('scripts/build-lovekotob-import.mjs'), filename, bulkPath]);
  const bulk = JSON.parse(readFileSync(bulkPath, 'utf8'));
  assert.equal(bulk.count, 1);
  assert.equal(bulk.batches.length, 1);
  const encodeBatch = (records: any[]) => gzipSync(Buffer.from(JSON.stringify({ format: 'lovekotob-index-v1', records }))).toString('base64');
  const queueStorage = memoryBookStorage();
  const queueIndex = new ChannelBookIndex(queueStorage);
  let alarms = 0;
  const queue = new ChannelImportQueue(queueStorage, queueIndex, async () => { alarms++; });
  const payload = { format: 'lovekotob-bulk-v1', source: 'lovekotob', count: 2, batches: [
    encodeBatch([{ id: 11, title: 'الغريب البير كامو', text: 'الغريب البير كامو' }]),
    encodeBatch([{ id: 12, title: 'سأعود حين يفيض النهر', text: 'أحمد الملك' }])
  ] };
  await assert.rejects(() => queue.stage({ ...payload, source: 'wrong' }, '42'));
  await assert.rejects(() => queue.stage({ ...payload, batches: ['a'.repeat(120001)] }, '42'));
  await queue.stage(payload, '42');
  assert.equal(alarms, 1);
  await assert.rejects(() => queue.stage(payload, '42'), /busy/);
  // Simulate a crash after writing a batch but before saving its cursor.
  await queueIndex.importBatch({ format: 'lovekotob-index-v1', records: [{ id: 11, title: 'الغريب البير كامو', text: 'الغريب البير كامو' }] });
  const resumed = new ChannelImportQueue(queueStorage, new ChannelBookIndex(queueStorage));
  assert.deepEqual({ ...(await resumed.processOne()), id: undefined }, { id: undefined, status: 'processing', batches: 2, next: 1, indexed: 1, expected: 2, chatId: '42' });
  assert.equal((await resumed.processOne())?.status, 'done');
  assert.equal((await resumed.state())?.indexed, 2);
  assert.equal((await queueIndex.search('غريب لكامو')).length, 1);
  await resumed.stage({ ...payload, count: 1, batches: [Buffer.from('not a gzip archive').toString('base64')] }, '42');
  assert.equal((await resumed.processOne())?.status, 'error');
  const bomb = gzipSync(Buffer.alloc(3 * 1024 * 1024 + 1, 65)).toString('base64');
  await resumed.stage({ ...payload, count: 1, batches: [bomb] }, '42');
  assert.equal((await resumed.processOne())?.status, 'error');
  await resumed.stage(payload, '42'); // a fresh upload can recover
  assert.equal((await resumed.processOne())?.next, 1);
  assert.equal((await resumed.processOne())?.status, 'done');
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
  await sqlIndex.importBatch({ format: 'lovekotob-index-v1', records: [
    { id: 1600, title: 'الغريب البير كامو', text: 'الغريب البير كامو' },
    { id: 1601, title: 'رواية الغريب لألبير كامو', text: 'رواية الغريب لألبير كامو' },
    { id: 1602, title: 'الغريب مؤلف آخر', text: 'الغريب مؤلف آخر' },
    { id: 1603, title: 'كش ملك أحمد خيري', text: 'كش ملك أحمد خيري' },
    { id: 1604, title: 'ملكوت الواقع أحمد العمري', text: 'ملكوت الواقع أحمد العمري' },
    { id: 1605, title: 'عنوان متشابه', text: 'الكاتب سليم' },
    { id: 1606, title: 'عنوان متشابه', text: 'الكاتب علي' }
  ] });
  for (const query of ['الغريب لألبير كامو', 'الغريب', 'غريب لكامو', 'كامو غريب']) {
    assert.ok((await sqlIndex.search(query, 10)).some(item => item.id === 1600 || item.id === 1601), query);
  }
  assert.equal((await sqlIndex.search('غريب لكامو')).length, 1); // same title and author, not two buttons
  assert.ok(!(await sqlIndex.search('أحمد الملك')).some(item => item.id === 1604)); // not a prefix of ملكوت
  assert.equal((await sqlIndex.search('عنوان متشابه')).length, 2); // different author evidence
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

  bot.hasRequiredChannelMembership = async () => true;
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
  assert.ok(messages.some(message => message.text.includes('متوقفة مؤقتاً')));
  const bulkBytes = new TextEncoder().encode(JSON.stringify(payload));
  let downloads = 0;
  bot.downloadTelegramFileBytes = async () => { downloads++; return { bytes: bulkBytes }; };
  const upload = { message_id: 10, date: 1, from: { id: 43, first_name: 'Not owner' }, chat: { id: 43, type: 'private' }, document: { file_id: 'test', file_size: bulkBytes.length, file_name: 'lovekotob-import.json' } };
  await bot.handleMessage(upload);
  assert.equal(downloads, 0);
  await bot.handleMessage({ ...upload, from: { id: 42, first_name: 'Owner' }, chat: { id: -42, type: 'group' } });
  assert.equal(downloads, 0);
  await bot.handleMessage({ ...upload, from: { id: 42, first_name: 'Owner' }, chat: { id: 42, type: 'private' } });
  assert.equal(downloads, 0); // no staging while paused
  // A previously staged job survives unchanged and is not processed by alarms.
  await bot.channelImportQueue.stage(payload, '42');
  const saved = JSON.stringify(await bot.channelImportQueue.state());
  await bot.processChannelImport();
  assert.equal(JSON.stringify(await bot.channelImportQueue.state()), saved);
  assert.equal(await bot.channelImportPending(), true);
  await bot.handleMessage({ message_id: 11, date: 1, text: '/channelindex', from: { id: 42, first_name: 'Owner' }, chat: { id: 42, type: 'private' } });
  assert.ok(messages.some(message => message.text.includes('متوقفة مؤقتاً')));
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
  // اسم ملف يضم العنوان والمؤلف يُطابق، أما اسم كتاب إضافي فلا يُطابق.
  await index.importBatch({ format: 'lovekotob-index-v1', records: [
    { id: 75, title: 'سأعود حين يفيض النهر أحمد الملك', text: 'سأعود حين يفيض النهر أحمد الملك' },
    { id: 76, title: 'سأعود حين يفيض النهر وقصص أخرى أحمد الملك', text: 'سأعود حين يفيض النهر وقصص أخرى أحمد الملك' },
    { id: 77, title: 'سأعود حين يفيض النهر أحمد ملك', text: 'سأعود حين يفيض النهر أحمد ملك' }
  ] });
  documents.length = 0;
  await bot.handleExtraServicesCb(cb, 'svc:books:chpdf:75');
  assert.equal(documents.length, 1);
  documents.length = 0;
  await bot.handleExtraServicesCb(cb, 'svc:books:chpdf:76');
  assert.equal(documents.length, 0);
  await bot.handleExtraServicesCb(cb, 'svc:books:chpdf:77');
  assert.equal(documents.length, 0); // search normalization must not prove identity
  // مسار النتيجة لا يتجاوز فحص حقوق أرشيف.
  bot.bookCatalog.archivePdf = async () => null;
  await bot.handleExtraServicesCb(cb, 'svc:books:chpdf:72');
  assert.deepEqual(documents, []);
  assert.ok(messages.some(message => message.text.includes('الملكية العامة')));
  console.log('Channel search checks passed.');
} finally { rmSync(dir, { recursive: true, force: true }); }
