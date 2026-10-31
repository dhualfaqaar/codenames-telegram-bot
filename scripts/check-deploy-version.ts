// فحص بصمة البناء: يتأكد إن أي نسخة منشورة تعرّف نفسها.
// السبب: صار يصير «التغيير ما وصل البوت» وماكو طريقة نتحقق غير التخمين.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BookCatalog, memoryBookStorage } from '../src/services/bookCatalog';
import { BOOKS_BUILD, BUILD_FEATURES, BUILD_STORAGE_KEY, BUILD_TAG, buildVersionLines } from '../src/services/buildInfo';
import { TelegramBotManager } from '../server/telegramBot';

let passed = 0;
const check = (name: string, condition: unknown) => {
  if (!condition) throw new Error(`فشل: ${name}`);
  passed += 1;
};

const root = resolve(import.meta.dirname, '..');
const workerSrc = readFileSync(resolve(root, 'worker', 'index.ts'), 'utf8');
const botSrc = readFileSync(resolve(root, 'server', 'telegramBot.ts'), 'utf8');

/* ───────────── بصمة البناء ───────────── */
check('بصمة البناء موجودة', BUILD_TAG.length >= 8);
check('بصمة قسم الكتب موجودة', BOOKS_BUILD.length >= 8);
check('البصمة تاريخية (سنة-شهر-يوم)', /^\d{4}-\d{2}-\d{2}/.test(BUILD_TAG));
check('قائمة الميزات مو فاضية', BUILD_FEATURES.length >= 3);
check('الميزات تذكر الأصناف', BUILD_FEATURES.some(feature => feature.includes('29 صنف')));
check('الميزات تذكر النبذة', BUILD_FEATURES.some(feature => feature.includes('نبذة')));
check('الميزات تذكر PDF', BUILD_FEATURES.some(feature => feature.includes('PDF')));
check('مفتاح التخزين محدد', BUILD_STORAGE_KEY === 'build:seen');

{
  const lines = buildVersionLines(['*المكتبة:* 20,000 كتاب']);
  const text = lines.join('\n');
  check('نص الإصدار يذكر البصمة', text.includes(BUILD_TAG));
  check('نص الإصدار يذكر بصمة الكتب', text.includes(BOOKS_BUILD));
  check('نص الإصدار يضم السطور الإضافية', text.includes('20,000 كتاب'));
  check('نص الإصدار يعرض الميزات', text.includes('•'));
}

/* ───────────── الـWorker يعرض /version ───────────── */
check('الـWorker فيه مسار /version', workerSrc.includes("pathname === '/version'"));
check('الـWorker يرجع البصمة بالمخرجات', workerSrc.includes('tag: BUILD_TAG'));
check('الـWorker يرجع بصمة الكتب', workerSrc.includes('booksBuild: BOOKS_BUILD'));
check('الـWorker يرجع وقت التشغيل', workerSrc.includes('servingSince'));
check('الـWorker يسجّل النسخة عند أول تشغيل', workerSrc.includes('ensureBuildSeen'));
check('الـWorker يخزّن بصمة النسخة', workerSrc.includes('BUILD_STORAGE_KEY'));
check('مسار /version بلا كاش', workerSrc.includes("'Cache-Control': 'no-store'"));
check('مسار /version يرجع عدد الكتب', workerSrc.includes('bookCatalogStats()'));

// افحص الصادرات الفعلية ونقطة الدخول الخارجية، لا وجود النص فقط.
const workerModule = await (new Function('url', 'return import(url)'))(new URL('../worker/index.ts', import.meta.url).href);
check('لا توجد صادرات قيم غير صالحة لـWorker', Object.keys(workerModule).every(name => name === 'default' || name === 'BotState'));
let fetchedPath = '';
const fakeEnv: any = { BOT_STATE: { idFromName: () => 'main', get: () => ({ fetch: async (url: string) => {
  fetchedPath = url;
  return Response.json({ ok: true, tag: BUILD_TAG });
} }) } };
const versionResponse = await workerModule.default.fetch(new Request('https://worker.test/version'), fakeEnv, {});
check('مسار الإصدار الخارجي يتصل بـDO', versionResponse.status === 200 && fetchedPath === 'https://bot.internal/version');
check('مسار الإصدار الخارجي يرجع بصمة DO', (await versionResponse.json()).tag === BUILD_TAG);
const badEnv: any = { BOT_STATE: { idFromName: () => 'main', get: () => ({ fetch: async () => { throw new Error('database unavailable'); } }) } };
const unavailable = await workerModule.default.fetch(new Request('https://worker.test/version'), badEnv, {});
const unavailableJson: any = await unavailable.json();
check('خطأ التخزين يعطي 503 واضح بلا تفاصيل خاصة', unavailable.status === 503 && unavailableJson.botState === 'storage' && unavailableJson.tag === BUILD_TAG);
const writtenKeys: string[] = [];
const brokenStateStorage: any = {
  get: async (key: string) => { if (key === 'state') throw new Error('temporary storage fault'); return undefined; },
  put: async (key: string) => { writtenKeys.push(key); },
  sql: { exec: () => { throw new Error('index unavailable'); } }
};
const brokenBotState = new workerModule.BotState({ storage: brokenStateStorage }, { WEBHOOK_URL: 'https://preview.invalid' });
let failedSafely = false;
try { await brokenBotState.fetch(new Request('https://bot.internal/status')); } catch { failedSafely = true; }
check('فشل قراءة حالة البوت لا يكتب حالة فارغة', failedSafely && !writtenKeys.includes('state'));


/* ───────────── البوت فيه /version ───────────── */
check('البوت يعالج /version', botSrc.includes('/^\\/version(?:@\\w+)?(?:\\s|$)/i'));
check('البوت يستعمل نص البصمة', botSrc.includes('buildVersionLines'));
check('البوت فيه زر «تحديث الشاشة»', botSrc.includes("'🔄 تحديث الشاشة'"));
check('البوت يعالج svc:books:refresh', botSrc.includes("data === 'svc:books:refresh'"));

/* ───────────── سلوك فعلي ───────────── */
type Call = { method: string; body: any };
let calls: Call[] = [];

const jsonOk = (result: any) =>
  new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { 'Content-Type': 'application/json' } });

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
  if (method === 'getChatMember') return jsonOk({ status: 'member', user: { id: 42 } });
  return jsonOk({ message_id: 777 });
}) as unknown as typeof fetch;

const fakeCatalogFetch = (async (input: any) => {
  const url = new URL(String(typeof input === 'string' ? input : input.url));
  if (url.pathname.includes('/editions')) return { ok: true, json: async () => ({ entries: [] }) } as any;
  if (url.pathname.includes('/works/')) return { ok: true, json: async () => ({}) } as any;
  const q = url.searchParams.get('q') || '';
  const lang = (q.match(/language:([a-z]{3})/) || [])[1] || 'ara';
  const subject = (q.match(/subject:"([^"]+)"/) || [])[1] || '';
  const page = Number(url.searchParams.get('page') || '1');
  return {
    ok: true,
    json: async () => ({
      docs: Array.from({ length: 100 }, (_, index) => ({
        key: `/works/OL${lang}${page}${index}${subject.length}W`,
        title: `${subject || lang} ${page}-${index}`,
        author_name: [`مؤلف ${index}`],
        first_publish_year: 1950 + (index % 60),
        number_of_pages_median: 200,
        cover_i: 100 + index,
        language: [lang],
        subject: subject ? [subject] : ['Fiction']
      }))
    })
  } as any;
}) as unknown as typeof fetch;

const bot: any = new TelegramBotManager('TEST:TOKEN');
// المالك بالفحص = 42 (الافتراضي يكون 1 من getMe الوهمي)
bot.ownerId = '42';
const catalog = new BookCatalog(memoryBookStorage(), fakeCatalogFetch, { queryGapMs: 0 });
await catalog.seed(30);
bot.bookCatalog = catalog;

const owner = (text: string) => ({
  message_id: 1,
  chat: { id: 42, type: 'private' as const },
  from: { id: 42, first_name: 'المالك' },
  text
});
const guest = (text: string) => ({
  message_id: 1,
  chat: { id: 99, type: 'private' as const },
  from: { id: 7, first_name: 'زائر' },
  text
});

// /version للمالك
calls = [];
await bot.handleMessage(owner('/version'));
{
  const sent = calls.filter(call => call.method === 'sendMessage').pop();
  const text = String(sent?.body?.text || '');
  check('المالك يشوف بصمة البناء', text.includes(BUILD_TAG));
  check('المالك يشوف بصمة الكتب', text.includes(BOOKS_BUILD));
  check('المالك يشوف عدد الكتب', /\*المكتبة:\*/.test(text));
  check('المالك يشوف عدد الأصناف', /\*الأصناف:\*/.test(text));
  check('رسالة المالك بلا \\n حرفية', !text.includes('\\n'));
}

// /version لغير المالك
calls = [];
await bot.handleMessage(guest('/version'));
{
  const sent = calls.filter(call => call.method === 'sendMessage').pop();
  const text = String(sent?.body?.text || '');
  check('الزائر يشوف البصمة بس', text.includes(BUILD_TAG) && !text.includes('*قسم الكتب:*'));
  check('الزائر ما يشوف تفاصيل المكتبة', !text.includes('*المكتبة:*'));
}

// زر تحديث الشاشة: يمسح القديمة ويرسل جديدة
calls = [];
await bot.handleExtraServicesCb(
  { id: 'cb1', from: { id: 42, first_name: 'المالك' }, message: { chat: { id: 42, type: 'private' }, message_id: 55 } },
  'svc:books:refresh'
);
{
  const methods = calls.map(call => call.method);
  check('التحديث يحذف الرسالة القديمة', methods.includes('deleteMessage'));
  check('التحديث يرسل شاشة جديدة', methods.includes('sendMessage'));
  check('التحديث ما يعدّل القديمة', !methods.includes('editMessageText'));
  const sent = calls.filter(call => call.method === 'sendMessage').pop();
  check('الشاشة الجديدة عنوانها «اقترحلي كتاب»', String(sent?.body?.text || '').includes('اقترحلي كتاب'));
  check('الشاشة الجديدة فيها زر العشوائي', JSON.stringify(sent?.body?.reply_markup || {}).includes('svc:books:rand'));
}

// شاشة الخدمة العادية فيها زر التحديث
calls = [];
await bot.handleExtraServicesCb(
  { id: 'cb2', from: { id: 42, first_name: 'المالك' }, message: { chat: { id: 42, type: 'private' }, message_id: 55 } },
  'svc:books'
);
{
  const screen = calls.filter(call => call.method === 'editMessageText').pop();
  check('شاشة الخدمة فيها زر «تحديث الشاشة»', JSON.stringify(screen?.body?.reply_markup || {}).includes('svc:books:refresh'));
}

console.log(`Deploy version checks passed: ${passed} assertions (build stamp, /version endpoint, /version command, refresh screen).`);
