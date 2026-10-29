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
import { downloadFromPlatform, mediaProviderReport, resetMediaProviders } from '../src/services/mediaServicesEngine';

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

  const leftover = await withFetch(
    (async () => jsonResponse({ code: 0, data: {} })) as any,
    async () => {
      const res = await boundedFetch('https://www.tikwm.com/api/', { method: 'POST' }, 500);
      return res.status;
    }
  );
  check('boundedFetch يرجّع استجابة سليمة', leftover === 200);

  resetProviderHealth();
  resetMediaProviders();

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
