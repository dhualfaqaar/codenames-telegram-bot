/**
 * نصوص وصف الكتب: بوابة جودة + تلخيص عربي عبر Gemini.
 *
 * القاعدة الذهبية: «النبذة» لازم تكون **شرح عن الكتاب**، مو إعادة للسنة أو
 * عدد الصفحات اللي معروضة فوق بالبطاقة. إذا ماكو وصف حقيقي، ما نكتب شي.
 */
import type { CatalogBook } from './bookCatalog';

/** الحد الأدنى لطول وصف مقبول (أقل من هذا يعتبر ناقص). */
const MIN_DESCRIPTION_LENGTH = 40;

/** عبارات تدل إن النص مجرد بيانات وصفية مو شرح للكتاب. */
const METADATA_PATTERNS: RegExp[] = [
  /^كتاب من تصنيف/,
  /^صدر سنة/,
  /كتاب من تصنيف «/,
  /^\d+\s*صفحة/,
  /^متوفر بـ/,
  /^no description/i,
  /^description not available/i,
  /^unknown$/i,
  /^n\/?a$/i
];

/**
 * هل النص صالح كننبذة فعلية عن الكتاب؟
 * نرفض: النص الفاضي، القصير جداً، المكرر من البيانات المعروضة، أو اللي يشبه
 * اسم الكتاب/المؤلف حرفياً (كثير من سجلات Open Library وصفها = العنوان).
 */
export function isUsableDescription(text: string, book?: Pick<CatalogBook, 'title' | 'author'>): boolean {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length < MIN_DESCRIPTION_LENGTH) return false;
  if (METADATA_PATTERNS.some(pattern => pattern.test(value))) return false;
  if (/(?:\b\d{4}\b|[٠-٩]{4}|(?:عدد\s+)?الصفحات|\d+\s*صفحة|سنة\s+[\d٠-٩]|لغة الكتاب|تصنيف الكتاب)/i.test(value)) return false;
  if (book) {
    const title = String(book.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const author = String(book.author || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const lower = value.toLowerCase();
    if (title && (lower === title || lower === `${title}.`)) return false;
    if (author && (lower === author || lower === `${author}.`)) return false;
    // نص ما هو إلا «العنوان — المؤلف» أو «العنوان by المؤلف».
    if (title && lower.startsWith(title) && lower.length <= title.length + author.length + 8) return false;
  }
  return true;
}

/** تنظيف وصف Open Library: يزيل HTML وروابط ماركداون والأسطر الزائدة. */
export function tidyDescription(value: string, max = 400): string {
  const clean = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 3).trim()}…` : clean;
}

/** هل أغلب حروف النص عربية؟ */
export function isArabicText(value: string): boolean {
  const text = String(value || '');
  const letters = text.match(/\p{L}/gu) || [];
  const arabic = text.match(/[\u0621-\u063a\u0641-\u064a\u066e-\u06d3]/g) || [];
  return arabic.length >= 4 && arabic.length / Math.max(letters.length, 1) >= 0.75;
}

export function isArabicName(value: string): boolean {
  if (/غير معروف|غير متوفر|لا أعرف|مجهول|لا يوجد/i.test(String(value || ''))) return false;
  const letters = String(value || '').match(/\p{L}/gu) || [];
  const arabic = String(value || '').match(/[\u0621-\u063a\u0641-\u064a\u066e-\u06d3]/g) || [];
  return arabic.length >= 2 && arabic.length / Math.max(letters.length, 1) >= 0.9;
}

export function cleanArabicName(value: string): string {
  return String(value || '').normalize('NFC').replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, '').replace(/\s+/g, ' ').trim();
}

export interface BookSummaryInput {
  title: string;
  author: string;
  year?: number | null;
  subjects?: string[];
  genres?: string[];
  language?: string;
}

/** يبني برومبت التلخيص (مصدَّر حتى يفحصه الاختبار). */
export function buildBookSummaryPrompt(book: BookSummaryInput, source = ''): string {
  return 'ترجم وصف الكتاب الآتي إلى العربية المبسطة باختصار وأمانة، ولا تضف أي معلومة غير موجودة في النص. ' +
    'لا تذكر بيانات النشر أو السنة أو الصفحات أو اللغة أو التصنيف. إن لم يكن النص وصفاً للكتاب أرجع وصفاً فارغاً.\n' +
    `العنوان: ${book.title}\nالمؤلف: ${book.author}\nالوصف المصدر: ${source}\n` +
    'أرجع JSON فقط بالشكل: {"description":"..."}';
}

/** يستخرج الوصف من رد Gemini (JSON أو نص خام). */
export function parseSummaryResponse(text: string): string {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed: any = JSON.parse(jsonText);
    if (parsed && typeof parsed.description === 'string') return tidyDescription(parsed.description, 320);
  } catch {
    /* مو JSON — نجرّب نص خام */
  }
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const parsed: any = JSON.parse(jsonText.slice(start, end + 1));
      if (parsed && typeof parsed.description === 'string') return tidyDescription(parsed.description, 320);
    } catch {
      /* تجاهل */
    }
  }
  return tidyDescription(jsonText.replace(/^["']|["']$/g, ''), 320);
}

/**
 * يلخّص الكتاب بالعربي عبر Gemini REST (بلا SDK، نفس أسلوب بقية الخدمات).
 * يرجع '' إذا ماكو مفتاح أو فشل النداء — ما نختلق وصف.
 */
export async function summarizeBookWithGemini(
  book: BookSummaryInput,
  geminiApiKey: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; source?: string } = {}
): Promise<string> {
  const key = String(geminiApiKey || '').trim();
  if (!key || !isUsableDescription(options.source || '', book)) return '';
  const doFetch = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!doFetch) return '';
  try {
    const response = await doFetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildBookSummaryPrompt(book, options.source || '') }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } }
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 12_000)
      }
    );
    if (!response.ok) return '';
    const payload: any = await response.json();
    const text = String(
      payload?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || ''
    ).trim();
    const summary = parseSummaryResponse(text);
    return isUsableDescription(summary, book) && isArabicText(summary) ? summary : '';
  } catch {
    return '';
  }
}

/** تحويل الأسماء للعربية، من دون إضافة عناوين أو مؤلفين غير مذكورين. */
export async function localizeBookWithGemini(
  book: Pick<CatalogBook, 'title' | 'author'>, geminiApiKey: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<{ title: string; author: string } | null> {
  if (!geminiApiKey) return null;
  const doFetch = options.fetchImpl || fetch;
  const prompt = 'اكتب عنوان الكتاب واسم المؤلف بالعربية. استعمل الاسم العربي المعروف إن كان واضحاً؛ ' +
    'وإلا ترجم العنوان وانقل اسم المؤلف صوتياً بأحرف عربية. لا تغيّر هوية المؤلف ولا تخترع معلومات. ' +
    'أرجع JSON فقط بمفتاحي title و author.\n' + JSON.stringify({ title: book.title, author: book.author });
  try {
    const res = await doFetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } } }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 12000)
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const raw = String(data?.candidates?.[0]?.content?.parts?.map((x: any) => x.text || '').join('') || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(raw);
    const title = tidyDescription(typeof parsed?.title === 'string' ? parsed.title : '', 200);
    const author = tidyDescription(typeof parsed?.author === 'string' ? parsed.author : '', 150);
    return { title: isArabicName(title) ? cleanArabicName(title) : '', author: isArabicName(author) ? cleanArabicName(author) : '' };
  } catch { return null; }
}
