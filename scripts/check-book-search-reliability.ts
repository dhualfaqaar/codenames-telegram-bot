import assert from 'node:assert/strict';
import { TelegramBotManager } from '../server/telegramBot';
import { memoryBookStorage } from '../src/services/bookCatalog';

const storage = memoryBookStorage();
const messages: string[] = [];
const keyboards: any[] = [];
const callbacks: string[] = [];
const fakeBook = { id: 'OL1W', title: 'عنوان الاختبار', author: 'كاتب الاختبار', year: null, pages: null, cover: null, lang: 'ara', subject: '' };
const makeBot = (): any => {
  const bot: any = new TelegramBotManager('TEST:TOKEN', '42', false, { bookStorage: storage });
  bot.hasRequiredChannelMembership = async () => true;
  bot.sendMessage = async (_: string, text: string, keyboard: any) => { messages.push(text); keyboards.push(keyboard); return { ok: true }; };
  bot.editMessageText = async () => ({ ok: true });
  bot.answerCallbackQuery = async (_: string, text: string) => { callbacks.push(text); return { ok: true }; };
  bot.bookCatalog = {
    searchDetailed: async () => ({ local: [fakeBook], remote: [], remoteFailed: false }),
    searchLocal: async () => [fakeBook],
    localize: async () => ({ title: fakeBook.title, author: fakeBook.author, localized: true }),
    byId: async () => fakeBook,
    archivePdf: async () => null
  };
  return bot;
};
const first = makeBot();
const cb = { id: 'c1', from: { id: 42, first_name: 'Owner' }, message: { message_id: 1, chat: { id: 42, type: 'private' } } };
await first.handleExtraServicesCb(cb, 'svc:books:search');
const restarted = makeBot();
restarted.importState(first.exportState());
await restarted.handleMessage({ message_id: 2, date: 1, from: { id: 42, first_name: 'Owner' }, chat: { id: 42, type: 'private' }, text: 'عنوان الاختبار' });
assert.ok(messages.some(text => text.includes('نتائج البحث'))); // persists across a DO restart
assert.equal(restarted.pendingBookSearch.size, 0);

// Group search belongs to the player who opened it, not to someone else.
messages.length = 0;
const group = makeBot();
const groupCb = { ...cb, message: { message_id: 1, chat: { id: -88, type: 'group' } } };
await group.handleExtraServicesCb(groupCb, 'svc:books:search');
await group.handleMessage({ message_id: 3, date: 1, from: { id: 43, first_name: 'Other' }, chat: { id: -88, type: 'group' }, text: 'عنوان الاختبار' });
assert.equal(group.pendingBookSearch.size, 1);
await group.handleMessage({ message_id: 4, date: 1, from: { id: 42, first_name: 'Owner' }, chat: { id: -88, type: 'group' }, text: 'عنوان الاختبار' });
assert.equal(group.pendingBookSearch.size, 0);
assert.ok(messages.some(text => text.includes('نتائج البحث')));

// Expiration and cancellation are visible and survive restart without hijacking later messages.
messages.length = 0;
const stale = makeBot();
stale.pendingBookSearch.set('42:42', { at: Date.now() - 11 * 60_000 });
const resumedStale = makeBot();
resumedStale.importState(stale.exportState());
await resumedStale.handleMessage({ message_id: 5, date: 1, from: { id: 42, first_name: 'Owner' }, chat: { id: 42, type: 'private' }, text: 'الغريب' });
assert.ok(messages.some(text => text.includes('انتهى انتظار البحث')));

// A rejected Markdown result is retried as plain text.
const markdownBot = makeBot();
const modes: Array<string | undefined> = [];
markdownBot.sendMessage = async (_: string, _text: string, _keyboard: any, mode?: string) => {
  modes.push(mode);
  return modes.length === 1 ? { ok: false, description: "can't parse entities" } : { ok: true };
};
await markdownBot.handleBookSearchQuery('42', 'عنوان الاختبار');
assert.deepEqual(modes, [undefined, '']);

// A failed channel index does not hide catalog results.
messages.length = 0;
const partial = makeBot();
partial.channelBookIndex.search = async () => { throw new Error('database unavailable'); };
await partial.handleBookSearchQuery('42', 'عنوان الاختبار');
assert.ok(messages.some(text => text.includes('نتائج البحث')));
// A failed catalog does not hide channel results.
messages.length = 0;
partial.channelBookIndex.search = async () => [{ id: 9, title: 'الغريب البير كامو', text: 'الغريب البير كامو' }];
partial.bookCatalog.searchDetailed = async () => { throw new Error('catalog unavailable'); };
partial.bookCatalog.searchLocal = async () => [];
await partial.handleBookSearchQuery('42', 'غريب لكامو');
assert.ok(messages.some(text => text.includes('الغريب البير كامو')));
assert.ok(keyboards.some(keyboard => JSON.stringify(keyboard).includes('تحقق PDF')));
// Both failing return an explicit error instead of silence.
messages.length = 0;
partial.channelBookIndex.search = async () => { throw new Error('database unavailable'); };
await partial.handleBookSearchQuery('42', 'بحث');
assert.ok(messages.some(text => text.includes('ما ردّت')));
// Failure even reading the channel record is acknowledged and reported.
messages.length = 0;
const brokenRecord = makeBot();
brokenRecord.channelBookIndex.get = async () => { throw new Error('database unavailable'); };
await brokenRecord.handleExtraServicesCb(cb, 'svc:books:chpdf:9');
assert.ok(messages.some(text => text.includes('تعذّر التحقق')));
// A mismatched channel record must not claim that a protected PDF can be sent.
messages.length = 0;
const protectedBot = makeBot();
protectedBot.channelBookIndex.get = async () => ({ id: 9, title: 'الغريب البير كامو', text: 'الغريب البير كامو' });
protectedBot.sendPdfDocument = async () => { throw new Error('must not send an unverified PDF'); };
await protectedBot.handleExtraServicesCb(cb, 'svc:books:chpdf:9');
assert.ok(messages.some(text => text.includes('ما كدرت أتأكد من هوية الكتاب')));
assert.ok(callbacks.some(text => text.includes('جاري التحقق')));
// A real-looking title in the channel is still only metadata: no PDF without a verified Archive file.
messages.length = 0;
const camus = { ...fakeBook, id: 'OLCAMUSW', title: 'الغريب', author: 'ألبير كامو' };
protectedBot.bookCatalog.searchDetailed = async () => ({ local: [camus], remote: [], remoteFailed: false });
protectedBot.bookCatalog.localize = async () => ({ title: camus.title, author: camus.author, localized: true });
protectedBot.bookCatalog.byId = async () => camus;
protectedBot.bookCatalog.archivePdf = async () => null;
await protectedBot.handleExtraServicesCb(cb, 'svc:books:chpdf:9');
assert.ok(messages.some(text => text.includes('الملكية العامة')));
// Archive lookup failures are not incorrectly reported as "no rights".
messages.length = 0;
protectedBot.bookCatalog.archivePdf = async () => { throw new Error('network'); };
await protectedBot.handleExtraServicesCb(cb, 'svc:books:pdf:OL1W');
assert.ok(messages.some(text => text.includes('تعذّر التحقق')));
console.log('Book search reliability checks passed.');
