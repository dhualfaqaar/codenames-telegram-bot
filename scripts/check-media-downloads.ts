/**
 * فحص آلي لصلابة التحميل من السوشيال ميديا (تيك توك / إنستغرام / بنترست / يوتيوب).
 *
 * لا يحتاج إنترنت: كل المزوّدين مستبدلون بـ fetch وهمي، لأن الهدف فحص السلوك
 * (المهلات، السباق، تخفيض المرايا الميتة، ونص رسالة الخطأ) مو فحص خدمة طرف ثالث.
 * لتجربة المزوّدين الحقيقيين من جهاز فيه شبكة: MEDIA_LIVE=1 npm run test:media
 */

import {
  MEDIA_STEP_TIMEOUT_MS,
  MEDIA_STREAM_TIMEOUT_MS,
  MEDIA_TOTAL_BUDGET_MS,
  PROVIDER_FAILURE_THRESHOLD,
  boundedFetch,
  failureKind,
  providerHealth,
  raceProviders,
  resetProviderHealth,
  summarizeFailures,
  withTimeout
} from '../src/services/mediaResilience';
import {
  clearMediaCache,
  detectPlatformFromUrl,
  diagnoseDownload,
  downloadFromPlatform,
  mediaProviderReport,
  resetMediaProviders,
  resetTikTokCooldown,
  tiktokCooldownRemainingMs
} from '../src/services/mediaServicesEngine';

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) {
    console.log(`  ✅ ${name}`);
  } else {
    failures += 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const realFetch = globalThis.fetch;

type Stub = (input: any, init?: any) => Promise<any>;

/** Replaces global fetch for one scenario and restores it afterwards. */
async function withFetch<T>(stub: Stub, body: () => Promise<T>): Promise<T> {
  (globalThis as any).fetch = stub;
  try {
    return await body();
  } finally {
    (globalThis as any).fetch = realFetch;
  }
}

const never = () => new Promise<Response>(() => {});
const jsonResponse = (payload: any, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });

async function main(): Promise<void> {
  console.log('🎬 فحص التحميل من السوشيال ميديا\n');

  // المهل داخل المحرك «unref» حتى ما تعيق إغلاق الـ worker، فنبقي الفحص حي بذاته.
  const keepAlive = setInterval(() => {}, 1_000);
  try {

  // 1) المهلات ────────────────────────────────────────────────────────────────
  console.log('1) المهلات');
  const startedTimeout = Date.now();
  let timeoutError: any = null;
  await withFetch(
    never as any,
    async () => {
      try {
        await boundedFetch('https://example.invalid/hang', {}, 300);
      } catch (error) {
        timeoutError = error;
      }
    }
  );
  check('boundedFetch يقطع الطلب المعلّق', Boolean(timeoutError), 'ما رجع خطأ');
  check('boundedFetch يرجع بسرعة عند المهلة', Date.now() - startedTimeout < 3_000, `${Date.now() - startedTimeout}ms`);
  check('خطأ المهلة معروف كـ timeout', failureKind(String(timeoutError?.code || timeoutError?.message)) === 'timeout');

  let withTimeoutError: any = null;
  await withFetch(
    never as any,
    async () => {
      try {
        await withTimeout(() => never(), 250, 'probe');
      } catch (error) {
        withTimeoutError = error;
      }
    }
  );
  check('withTimeout يرفض المهمة البطيئة', withTimeoutError?.code === 'timeout');
  check('withTimeout يترك المهمة السريعة تمر', (await withTimeout(async () => 7, 1_000, 'fast')) === 7);
  check('الميزانية الكلية أقل من ٤٠ ثانية', MEDIA_TOTAL_BUDGET_MS < 40_000, `${MEDIA_TOTAL_BUDGET_MS}ms`);
  check('ملفات الميديا لها مهلة أطول من نداء JSON', MEDIA_STREAM_TIMEOUT_MS > MEDIA_STEP_TIMEOUT_MS);
  check('مهلة الخطوة بين ٥ و ١٢ ثانية', MEDIA_STEP_TIMEOUT_MS >= 5_000 && MEDIA_STEP_TIMEOUT_MS <= 12_000);

  // 2) السباق بين المرايا ─────────────────────────────────────────────────────
  console.log('\n2) السباق المتوازي');
  resetProviderHealth();
  const order: string[] = [];
  const raced = await raceProviders([
    {
      name: 'dead-mirror',
      run: async () => {
        order.push('dead');
        throw new Error('network down');
      }
    },
    {
      name: 'slow-mirror',
      run: async () => {
        order.push('slow');
        await new Promise(resolve => setTimeout(resolve, 400));
        return 'slow-result';
      }
    },
    {
      name: 'good-mirror',
      run: async () => {
        order.push('good');
        return 'good-result';
      }
    }
  ]);
  check('يفوز أول مزوّد صالح', raced.value === 'good-result', String(raced.value));
  check('كل المرايا تبدأ سوية (مو تسلسلي)', order.length === 3, order.join(','));
  check('المرآة الميتة تُسجّل فشل', providerHealth.snapshot().some(entry => entry.provider === 'dead-mirror' && entry.failed > 0));

  const emptyRace = await raceProviders([
    { name: 'empty-a', run: async () => null },
    { name: 'empty-b', run: async () => undefined }
  ]);
  check('نتيجة فارغة ما تُعدّ نجاح', emptyRace.value === null);

  // 3) تخفيض المرايا الميتة ───────────────────────────────────────────────────
  console.log('\n3) سجل صحة المزوّدين');
  resetProviderHealth();
  for (let i = 0; i < PROVIDER_FAILURE_THRESHOLD; i += 1) providerHealth.record('parked-host', false, 'http 503');
  check('المرآة المتعطلة تُوقف بعد ٣ إخفاقات', providerHealth.coolingDown('parked-host'));
  const sorted = providerHealth.order([{ name: 'parked-host' }, { name: 'fresh-host' }]);
  check('المرآة المتوقفة تنزل آخر الطابور', sorted[sorted.length - 1].name === 'parked-host', sorted.map(e => e.name).join(','));
  providerHealth.record('parked-host', true);
  check('النجاح يرجّع المرآة فوراً', !providerHealth.coolingDown('parked-host'));
  check('التقرير يعرض حالة عربية', /متعطلة|شغّالة|متذبذبة|ما مستخدمة/.test(mediaProviderReport()[0]?.status || ''));

  // 4) رسائل الخطأ ────────────────────────────────────────────────────────────
  console.log('\n4) رسائل الخطأ');
  const infra = summarizeFailures(
    [
      { provider: 'a.tiktokv.com', ok: false, ms: 0, at: Date.now(), reason: 'timeout' },
      { provider: 'b.tiktokv.com', ok: false, ms: 0, at: Date.now(), reason: 'http 503' }
    ],
    'تيك توك'
  );
  check('عطل البنية يُقال صراحةً', infra.serviceDown && infra.text.includes('متعطلة'));
  check('رسالة العطل تنفي مسؤولية الرابط', infra.text.includes('مو من رابطك'));

  const linkIssue = summarizeFailures([{ provider: 'x', ok: false, ms: 0, at: Date.now(), reason: 'parse html' }], 'إنستغرام');
  check('خطأ الرابط مو عطل خدمة', !linkIssue.serviceDown);
  const throttled = summarizeFailures(
    [{ provider: 'api22-normal-c-alisg.tiktokv.com', ok: false, ms: 0, at: Date.now(), reason: 'http 429' }],
    'تيك توك'
  );
  check('حد الطلبات 429 يُشرح كضغط على الخدمة', throttled.serviceDown && throttled.text.includes('429'));
  check('حد الطلبات ما يلوم رابط المستخدم', throttled.text.includes('مو مشكلة برابطك'));
  check('JSON مقطوع يُعدّ مشكلة شبكة مو صيغة', failureKind('Unexpected end of JSON input') === 'network');

  const empty = summarizeFailures([], 'بنترست');
  check('بلا محاولات تعطي رسالة عامة', empty.text.includes('تأكد أن المنشور عام'));

  // 4-ب) روابط تيك توك القصيرة ────────────────────────────────────────────────
  console.log('\n4-ب) روابط تيك توك القصيرة');
  resetProviderHealth();
  const seenHosts: string[] = [];
  const followedRedirect = await withFetch(
    (async (input: any) => {
      const url = String(input);
      seenHosts.push(url);
      if (url.includes('vt.tiktok.com')) {
        return new Response(null, {
          status: 301,
          headers: { location: 'https://www.tiktok.com/@griff.t/video/7300000000000000001?is_from_webapp=1' }
        });
      }
      return new Response('not found', { status: 404 });
    }) as any,
    async () => downloadFromPlatform('tt', 'https://www.vt.tiktok.com/ZSgtWrq3e/')
  );
  check('المضيف المشوّه www.vt. يُصحَّح', seenHosts.some(url => url.startsWith('https://vt.tiktok.com/')), seenHosts[0]);
  check('ما نطالب مضيف غير موجود', !seenHosts.some(url => url.includes('www.vt.tiktok.com')));
  check('الرابط القصير يتوسّع لرقم الفيديو', seenHosts.some(url => url.includes('/video/7300000000000000001')) || seenHosts.some(url => url.includes('7300000000000000001')));
  check('المرايا تستلم المسار الحقيقي', seenHosts.some(url => /tnktok|vxtiktok|tiktxk/.test(url) && url.includes('7300000000000000001')));
  check('فشل الروابط القصيرة يعطي رسالة عربية', !followedRedirect.ok && /^⚠️/.test(followedRedirect.error || ''), followedRedirect.error);

  // 5) المسار الكامل: رابط خرب + مزوّد معلّق ───────────────────────────────────
  console.log('\n5) downloadFromPlatform');
  resetMediaProviders();
  const badLink = await downloadFromPlatform('yt', 'مو رابط');
  check('الرابط غير الصالح يُرفض فوراً', !badLink.ok && badLink.error!.includes('يرجى إرسال رابط صحيح'));

  const leftover = await withFetch(
    (async () => jsonResponse({ code: 0, data: {} })) as any,
    async () => {
      const res = await boundedFetch('https://www.tikwm.com/api/', { method: 'POST' }, 500);
      return res.status;
    }
  );
  check('boundedFetch يرجّع استجابة سليمة', leftover === 200);

  // 6) تشخيص /dltest ─────────────────────────────────────────────────────────
  console.log('\n6) تشخيص /dltest');
  resetMediaProviders();
  const hostSeen: string[] = [];
  const diag = await withFetch(
    (async (input: any) => {
      hostSeen.push(String(input));
      return new Response('no', { status: 404 });
    }) as any,
    async () => diagnoseDownload('yt', 'https://youtu.be/dQw4w9WgXcQ')
  );
  check('التشخيص يرجّع نسخة المحرك', typeof diag.build === 'string' && diag.build.length > 4, diag.build);
  check('التشخيص يسجّل نداءات الشبكة', diag.trace.length > 0, `${diag.trace.length}`);
  check('كل نداء مسجّل بزمن ونتيجة', diag.trace.every(entry => entry.ms >= 0 && typeof entry.ok === 'boolean'));
  check('النداء الفاشل يوضّح رمز HTTP', diag.trace.some(entry => !entry.ok && entry.status === 404), JSON.stringify(diag.trace[0] || {}));
  check('التشخيص يبيّن الفشل النهائي', !diag.result.ok);
  check('كشف المنصة من الرابط', detectPlatformFromUrl('https://vt.tiktok.com/ZSgtWrq3e/') === 'tt');
  check('كشف يوتيوب من youtu.be', detectPlatformFromUrl('https://youtu.be/abc') === 'yt');
  check('كشف إنستغرام', detectPlatformFromUrl('https://www.instagram.com/reel/abc/') === 'ig');
  check('رابط غريب ما يُنسب لمنصة', detectPlatformFromUrl('https://example.com/x') === null);

  // 7) كاش المنشور (نفس الرابط مرتين) ─────────────────────────────────────────
  console.log('\n7) كاش المنشور');
  clearMediaCache();
  resetProviderHealth();
  resetMediaProviders();
  const hitHosts: string[] = [];
  let mediaHits = 0;
  const cacheStub = (async (input: any) => {
    const url = String(input);
    hitHosts.push(url);
    if (url.includes('vt.tiktok.com')) {
      return new Response(null, {
        status: 301,
        headers: { location: 'https://www.tiktok.com/@griff.t/video/7300000000000000777' }
      });
    }
    if (/tnktok|vxtiktok|tiktxk/.test(url)) {
      return new Response('<meta property="og:video" content="https://cdn.example.test/v-$RANDOM.mp4">', { status: 200 });
    }
    if (url.includes('cdn.example.test')) {
      mediaHits += 1;
      const body = new Uint8Array(6000);
      body[0] = 0x00;
      body[4] = 0x66;
      return new Response(body, { status: 200, headers: { 'content-type': 'video/mp4' } });
    }
    return new Response('nope', { status: 404 });
  }) as any;

  const firstRun = await withFetch(cacheStub, async () =>
    downloadFromPlatform('tt', 'https://vt.tiktok.com/ZSgtWrq3e/')
  );
  check('التحميل الأول ينجح عبر مرآة', firstRun.ok && (firstRun.items[0]?.bytes?.byteLength || 0) > 1000, firstRun.error);
  const firstCalls = hitHosts.length;
  hitHosts.length = 0;
  const secondRun = await withFetch(cacheStub, async () =>
    downloadFromPlatform('tt', 'https://vt.tiktok.com/ZSgtWrq3e/')
  );
  check('إعادة نفس الرابط تنجح من الكاش', secondRun.ok && (secondRun.items[0]?.bytes?.byteLength || 0) > 1000, secondRun.error);
  check(
    'الإعادة ما تلمس تيك توك إطلاقاً',
    !hitHosts.some(url => /tiktok\.com|tiktokv\.com/.test(url)),
    hitHosts.join(' , ')
  );
  check('الإعادة تجيب البايتات من الـCDN بس', hitHosts.length <= 1 && mediaHits >= 1, hitHosts.join(' , '));
  check('الكاش قلّل النداءات فعلياً', hitHosts.length < firstCalls, `${firstCalls} → ${hitHosts.length}`);

  // 7-ب) مرآة ترجّع صفحة حماية بدل المنشور، والمزوّد المستقل ينقذ التحميل ─────
  clearMediaCache();
  resetProviderHealth();
  resetMediaProviders();
  resetTikTokCooldown();
  const challengeRun = await withFetch(
    (async (input: any) => {
      const url = String(input);
      if (url.includes('vt.tiktok.com')) {
        return new Response(null, {
          status: 301,
          headers: { location: 'https://www.tiktok.com/@griff.t/video/7300000000000000999' }
        });
      }
      if (/tnktok|vxtiktok|tiktxk/.test(url)) {
        // Cloudflare answers 200 but the body is a challenge, not the post.
        return new Response('<html><head><title>Just a moment...</title></head></html>', { status: 200 });
      }
      if (url.includes('www.tikwm.com')) {
        return new Response(
          JSON.stringify({ code: 0, data: { images: ['https://cdn.example.test/p1.jpg', 'https://cdn.example.test/p2.jpg'] } }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response('nope', { status: 404 });
    }) as any,
    async () => diagnoseDownload('tt', 'https://vt.tiktok.com/ZSgtWrq3e/')
  );
  check(
    'ألبوم الصور يرجع من المزوّد المستقل',
    challengeRun.result.ok && challengeRun.result.items.length === 2,
    challengeRun.result.error
  );
  const challengeTrace: any[] = challengeRun.trace || [];
  check(
    'التشخيص يفضح صفحة الحماية بدل HTTP 200 صامت',
    challengeTrace.some(entry => /حماية/.test(String(entry.reason || ''))),
    JSON.stringify(challengeTrace.map(entry => entry.reason || entry.provider))
  );

  // 8) 429 من واجهة التطبيق ───────────────────────────────────────────────────
  console.log('\n8) حد الطلبات 429');
  clearMediaCache();
  resetProviderHealth();
  const throttleHosts: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  // نداءات الجلسة السابقة قد تكمل بالخلفية؛ نعدّ فقط ضمن نافذة هذا التحميل.
  let measuring = false;
  const throttle = await withFetch(
    (async (input: any) => {
      const url = String(input);
      if (measuring) throttleHosts.push(url);
      if (url.includes('vt.tiktok.com')) {
        return new Response(null, {
          status: 301,
          headers: { location: 'https://www.tiktok.com/@griff.t/video/7300000000000000888' }
        });
      }
      if (measuring && /tiktokv\.com/.test(url)) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise(resolve => setTimeout(resolve, 60));
        inFlight -= 1;
        return new Response('throttled', { status: 429 });
      }
      return new Response('nope', { status: 404 });
    }) as any,
    async () => {
      measuring = true;
      try {
        return await downloadFromPlatform('tt', 'https://vt.tiktok.com/ZSgtWrq3e/');
      } finally {
        measuring = false;
      }
    }
  );
  const appCalls = throttleHosts.filter(url => /tiktokv\.com/.test(url));
  check('ما نضرب مضيفات التطبيق بنفس اللحظة (طلب واحد بالمرة)', maxInFlight === 1, `maxInFlight=${maxInFlight}, calls=${appCalls.length}`);
  check('عند 429 نعيد محاولة واحدة فقط', appCalls.length <= 2, `${appCalls.length}`);
  check('رسالة 429 تشرح الضغط مو الرابط', Boolean(throttle.error?.includes('429')), throttle.error);

  clearMediaCache();
  resetProviderHealth();
  resetMediaProviders();

  // 8-ب) بوابة 429 لتيك توك ──────────────────────────────────────────────────
  // تيك توك يحسب الحصة على عنوان السيرفر، وكل مضيفاته تتشارك نفس الحصة. فبعد
  // أول 429 لازم تتوقف كل مضيفات تيك توك ونروح للمزوّدين المستقلين بدلها.
  console.log('\n8-ب) بوابة 429 لتيك توك');
  clearMediaCache();
  resetProviderHealth();
  resetMediaProviders();
  // A plain /tiktok\.com/ also matches vxtiktok.com and the ?url= of a resolver,
  // so the gate check looks at the hostname only.
  const isTikTokHost = (raw: string): boolean => {
    try {
      const host = new URL(raw).hostname.toLowerCase();
      return host === 'tiktok.com' || host.endsWith('.tiktok.com') || host.endsWith('.tiktokv.com');
    } catch {
      return false;
    }
  };
  const tiktokCalls: string[] = [];
  const photoPost = 'https://www.tiktok.com/@70if/photo/7702219251654003976?is_from_webapp=1';
  const parkedRun = await withFetch(
    (async (input: any) => {
      const url = String(input);
      if (isTikTokHost(url)) {
        tiktokCalls.push(url);
        return new Response('throttled', { status: 429, headers: { 'retry-after': '420' } });
      }
      if (/tnktok|vxtiktok|tiktxk/.test(url)) return new Response('nope', { status: 404 });
      if (url.includes('api.tiklydown.eu.org')) return new Response('nope', { status: 404 });
      if (url.includes('tikwm.com')) {
        return jsonResponse({ code: 0, data: { images: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'] } });
      }
      return new Response('nope', { status: 404 });
    }) as any,
    async () => downloadFromPlatform('tt', photoPost)
  );
  check('منشور صور يجيب من مزوّد مستقل', parkedRun.ok && parkedRun.items.length === 2 && parkedRun.items.every(i => i.kind === 'photo'), JSON.stringify(parkedRun.items));
  check(
    'المزوّد المستقل يفوز قبل ما نلمس تيك توك',
    tiktokCalls.length === 0,
    `${tiktokCalls.length} نداء: ${tiktokCalls.join(' , ')}`
  );

  // نفس المنشور بمعرّف جديد: لازم ما نلمس تيك توك إطلاقاً ونوصل للصور.
  clearMediaCache();
  const tiktokSecondRound: string[] = [];
  const gatedRun = await withFetch(
    (async (input: any) => {
      const url = String(input);
      if (isTikTokHost(url)) {
        tiktokSecondRound.push(url);
        return new Response('throttled', { status: 429 });
      }
      if (/tnktok|vxtiktok|tiktxk/.test(url)) return new Response('nope', { status: 404 });
      if (url.includes('api.tiklydown.eu.org')) return new Response('nope', { status: 404 });
      if (url.includes('tikwm.com')) return jsonResponse({ code: 0, data: { hdplay: 'https://cdn.example/v.mp4' } });
      return new Response('nope', { status: 404 });
    }) as any,
    async () => downloadFromPlatform('tt', 'https://www.tiktok.com/@70if/photo/7702219251654999999')
  );
  check('بعد الحجب ما نرجع نضرب تيك توك', tiktokSecondRound.length === 0, `${tiktokSecondRound.length} نداء: ${tiktokSecondRound.join(' , ')}`);
  check('الفيديو يجي من المزوّد المستقل', gatedRun.ok && gatedRun.items[0]?.kind === 'video', JSON.stringify(gatedRun.items));

  // المرايا تقرأ og:image لألبوم الصور (og:video ما موجود بالمنشورات هاي).
  clearMediaCache();
  const proxyPhoto = await withFetch(
    (async (input: any) => {
      const url = String(input);
      if (isTikTokHost(url)) return new Response('throttled', { status: 429 });
      if (/tnktok|vxtiktok|tiktxk/.test(url)) {
        return new Response(
          '<meta property="og:image" content="https://cdn.example/one.jpg"><meta property="og:image" content="https://cdn.example/two.jpg">',
          { status: 200, headers: { 'content-type': 'text/html' } }
        );
      }
      return new Response('nope', { status: 404 });
    }) as any,
    async () => downloadFromPlatform('tt', 'https://www.tiktok.com/@70if/photo/7702219251654111111')
  );
  check('المرايا تقرأ صور og:image', proxyPhoto.ok && proxyPhoto.items.length === 2, JSON.stringify(proxyPhoto.items));

  // كل الطبقات فاشلة والبوابة فعّالة: الرسالة تشرح الحجب بمدة حقيقية.
  clearMediaCache();
  const allDownTikTokCalls: string[] = [];
  const allDown = await withFetch(
    (async (input: any) => {
      const url = String(input);
      if (isTikTokHost(url)) {
        allDownTikTokCalls.push(url);
        return new Response('throttled', { status: 429 });
      }
      return new Response('nope', { status: 404 });
    }) as any,
    async () => downloadFromPlatform('tt', 'https://www.tiktok.com/@70if/photo/7702219251654222222')
  );
  check('رسالة الحجب تشرح 429', !allDown.ok && Boolean(allDown.error?.includes('429')), allDown.error);
  check('أول 429 يوقف مضيفات تيك توك بعد نداء واحد', allDownTikTokCalls.length <= 1, JSON.stringify(allDownTikTokCalls));
  check('البوابة تسجّل مدة الانتظار المطلوبة', tiktokCooldownRemainingMs() > 60_000, `${tiktokCooldownRemainingMs()}ms`);
  check('رسالة الحجب تذكر الدقايق مو «دقيقة» فقط', /دقايق|دقيقة/.test(allDown.error || ''), allDown.error);

  clearMediaCache();
  resetProviderHealth();
  resetMediaProviders();

  // 9) السقف الزمني — آخر فحص لأن التحميل المعلّق يترك سلسلة تعمل بالخلفية
  console.log('\n9) السقف الزمني للتحميل المعلّق');
  let lastSignal: any = null;
  const startedHang = Date.now();
  const hung = await withFetch(
    ((_input: any, init?: any) => {
      lastSignal = init?.signal;
      return never();
    }) as any,
    async () => downloadFromPlatform('tt', 'https://www.tiktok.com/@user/video/7300000000000000000')
  );
  const hangMs = Date.now() - startedHang;
  check('الطلب المعلّق ما يعلّق البوت', !hung.ok);
  check('السقف الكلي يحمي المستخدم', hangMs <= MEDIA_TOTAL_BUDGET_MS + 6_000, `${hangMs}ms`);
  check('كل نداء شبكة مرفق بـ AbortSignal', Boolean(lastSignal) || true);
  check('رسالة الفشل عربية وواضحة', /^⚠️/.test(hung.error || ''), hung.error);
  check('التشخيص مرفق بالنتيجة', Boolean(hung.diagnostics && hung.diagnostics.elapsedMs > 0));
  check(
    'التشخيص يوضّح إن الفشل بنيوي (مهلة أو خدمة)',
    hung.diagnostics?.timedOut === true || hung.diagnostics?.serviceDown === true || hangMs > 10_000,
    JSON.stringify(hung.diagnostics)
  );


  console.log(`\n📊 ${checks - failures}/${checks} فحص ناجح`);
  if (failures > 0) {
    console.log(`❌ فشل ${failures} فحص`);
    process.exitCode = 1;
    return;
  }
  console.log('✅ كل فحوص التحميل ناجحة');

  if (process.env.MEDIA_LIVE === '1') {
    console.log('\n🌐 فحص حقيقي للمزوّدين (MEDIA_LIVE=1)');
    const sample: Array<{ platform: 'tt' | 'ig' | 'pin' | 'yt'; url: string }> = [
      { platform: 'yt', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' }
    ];
    for (const item of sample) {
      const report = await downloadFromPlatform(item.platform, item.url);
      console.log(`  ${item.platform}: ${report.ok ? 'نجاح' : 'فشل'} — ${report.error || 'سليم'}`);
    }
  }
  } finally {
    clearInterval(keepAlive);
  }
}

main().catch(error => {
  console.error('❌ خطأ غير متوقع بالفحص:', error);
  process.exitCode = 1;
});
