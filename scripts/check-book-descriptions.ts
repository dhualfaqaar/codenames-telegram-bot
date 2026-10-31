// فحص نبذات الكتب: بوابة الجودة، برومبت Gemini، وتحليل الردود.
// الهدف: «النبذة» شرح عن الكتاب — مو إعادة للسنة/الصفحات/اللغة.
import {
  buildBookSummaryPrompt,
  isArabicText,
  isUsableDescription,
  parseSummaryResponse,
  summarizeBookWithGemini,
  tidyDescription
} from '../src/services/bookDescriptions';

let passed = 0;
const check = (name: string, condition: unknown) => {
  if (!condition) throw new Error(`فشل: ${name}`);
  passed += 1;
};

const BOOK = { title: 'الطريق', author: 'نجيب محفوظ' } as any;

/* ───────────── بوابة الجودة ───────────── */
check('وصف حقيقي ينقبل', isUsableDescription('رواية عن رجل يبحث عن أبيه الغائب بين القاهرة والإسكندرية، فيكتشف أن الحقيقة أوجع من الغياب.', BOOK));
check('وصف فاضي ينرفض', !isUsableDescription(''));
check('وصف قصير ينرفض', !isUsableDescription('كتاب عن الحياة.'));
check('«كتاب من تصنيف» ينرفض', !isUsableDescription('كتاب من تصنيف «رواية» · صدر سنة 1961 · 140 صفحة · متوفر بـara.', BOOK));
check('«صدر سنة» ينرفض', !isUsableDescription('صدر سنة 1961 وكان من أشهر ما كتبه المؤلف في تلك المرحلة.', BOOK));
check('«متوفر بـ» ينرفض', !isUsableDescription('متوفر بـara وله عدة طبعات قديمة في المكتبات العامة.', BOOK));
check('«N/A» ينرفض', !isUsableDescription('N/A'));
check('«no description available» ينرفض', !isUsableDescription('No description available for this book right now.'));
check('النص اللي هو العنوان لحاله ينرفض', !isUsableDescription('الطريق', BOOK));
check('النص اللي هو المؤلف لحاله ينرفض', !isUsableDescription('نجيب محفوظ', BOOK));
check('العنوان + المؤلف بس ينرفض', !isUsableDescription('الطريق — نجيب محفوظ', BOOK));
check('وصف إنجليزي طويل ينقبل', isUsableDescription('A novel about a man searching for his absent father across Egypt and finding a harder truth.', BOOK));

/* ───────────── تنظيف النص ───────────── */
check('وسوم HTML تنحذف', tidyDescription('<p>نص <b>مهم</b></p>') === 'نص مهم');
check('روابط ماركداون تنحذف', tidyDescription('نص [رابط](https://x.y) هنا') === 'نص رابط هنا');
check('الأسطر الزائدة تتجمع', tidyDescription('سطر\n\nثاني    ثالث') === 'سطر ثاني ثالث');
check('النص الطويل يتقصّر', tidyDescription('ا'.repeat(600), 120).length <= 121);
check('القص يتنهّى بنقاط', tidyDescription('ا'.repeat(600), 60).endsWith('…'));

/* ───────────── كشف اللغة ───────────── */
check('العربي ينعرف', isArabicText('رواية عربية'));
check('الإنجليزي ينعرف', !isArabicText('A novel in English'));

/* ───────────── البرومبت ───────────── */
{
  const prompt = buildBookSummaryPrompt({
    title: 'الطريق',
    author: 'نجيب محفوظ',
    year: 1961,
    genres: ['رواية', 'أدب عربي'],
    subjects: ['Fiction', 'Arabic fiction'],
    language: 'ara'
  });
  check('البرومبت يذكر العنوان', prompt.includes('الطريق'));
  check('البرومبت يذكر المؤلف', prompt.includes('نجيب محفوظ'));
  check('البرومبت يطلب العربية', prompt.includes('العربية'));
  check('البرومبت يمنع ذكر السنة والصفحات', prompt.includes('السنة أو الصفحات'));
  check('البرومبت يمنع اختلاق الأحداث', prompt.includes('ولا تضف أي معلومة'));
  check('البرومبت يطلب JSON', prompt.includes('{"description"'));
  check('البرومبت يطلب وصف المصدر', prompt.includes('الوصف المصدر'));
}

/* ───────────── تحليل رد Gemini ───────────── */
check('JSON نظيف ينحل', parseSummaryResponse('{"description":"رواية عن البحث عن الأب والحقيقة."}') === 'رواية عن البحث عن الأب والحقيقة.');
check('JSON داخل ``` ينحل', parseSummaryResponse('```json\n{"description":"وصف داخل بلوك كود."}\n```') === 'وصف داخل بلوك كود.');
check('JSON مع كلام زايد ينحل', parseSummaryResponse('ها هي النتيجة: {"description":"وصف وسط كلام."} شكراً') === 'وصف وسط كلام.');
check('نص خام ينقبل', parseSummaryResponse('نص خام يشرح الكتاب') === 'نص خام يشرح الكتاب');
check('رد فاضي يرجع فاضي', parseSummaryResponse('') === '');
check('JSON غلط ما ينكسر', typeof parseSummaryResponse('{oops') === 'string');

/* ───────────── نداء Gemini ───────────── */
{
  let body: any = null;
  const okFetch = (async (_url: any, init: any) => {
    body = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"description":"رواية تتبع رجلاً يبحث عن أبيه في مصر، وتطرح أسئلة الهوية والانتماء."}' }] } }] })
    } as any;
  }) as unknown as typeof fetch;

  const summary = await summarizeBookWithGemini({ title: 'الطريق', author: 'نجيب محفوظ' }, 'TEST_KEY', { fetchImpl: okFetch, source: 'A man searches for his father and confronts difficult choices in a changing city.' });
  check('التلخيص يرجع نص عربي', summary.startsWith('رواية تتبع'));
  check('النداء يستعمل مفتاح Gemini', Boolean(body?.contents?.[0]?.parts?.[0]?.text));

  const noKey = await summarizeBookWithGemini({ title: 'x', author: 'y' }, '', { fetchImpl: okFetch, source: 'A man searches for his father and confronts difficult choices in a changing city.' });
  check('بلا مفتاح ماكو نداء', noKey === '');

  const failFetch = (async () => ({ ok: false, status: 429, json: async () => ({}) }) as any) as unknown as typeof fetch;
  const failed = await summarizeBookWithGemini({ title: 'x', author: 'y' }, 'TEST_KEY', { fetchImpl: failFetch, source: 'A man searches for his father and confronts difficult choices in a changing city.' });
  check('فشل الـAPI يرجع فاضي', failed === '');

  const throwFetch = (async () => { throw new Error('network'); }) as unknown as typeof fetch;
  const thrown = await summarizeBookWithGemini({ title: 'x', author: 'y' }, 'TEST_KEY', { fetchImpl: throwFetch, source: 'A man searches for his father and confronts difficult choices in a changing city.' });
  check('خطأ الشبكة ما ينكسر', thrown === '');

  const junkFetch = (async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: '{"description":"N/A"}' }] } }] })
  }) as any) as unknown as typeof fetch;
  const junk = await summarizeBookWithGemini({ title: 'x', author: 'y' }, 'TEST_KEY', { fetchImpl: junkFetch, source: 'A man searches for his father and confronts difficult choices in a changing city.' });
  check('رد رديء (N/A) ينرفض', junk === '');
}

console.log(`Book description checks passed: ${passed} assertions (quality gate, HTML cleanup, Gemini prompt/response, safe fallbacks).`);
