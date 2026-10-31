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

/** هل النص عربي؟ (نستعمله لوسم النبذة الإنجليزية) */
export function isArabicText(value: string): boolean {
  return /[\u0600-\u06FF]/.test(String(value || ''));
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
export function buildBookSummaryPrompt(book: BookSummaryInput): string {
  const facts: string[] = [`العنوان: ${book.title}`, `المؤلف: ${book.author}`];
  if (book.year) facts.push(`سنة النشر: ${book.year}`);
  if (book.genres?.length) facts.push(`التصنيف: ${book.genres.join('، ')}`);
  if (book.subjects?.length) facts.push(`المواضيع: ${book.subjects.slice(0, 8).join('، ')}`);
  if (book.language) facts.push(`اللغة: ${book.language}`);
  return (
    'أنت محرر كتب عربي. اكتب نبذة قصيرة عن الكتاب المذكور أدناه.\n' +
    'الشروط:\n' +
    '- جملتين بالعربية الفصحى المبسطة، بين ٢٥ و٦٠ كلمة.\n' +
    '- تشرح **موضوع الكتاب وفكرته**، مو بيانات النشر.\n' +
    '- ممنوع ذكر السنة أو عدد الصفحات أو اللغة أو التصنيف.\n' +
    '- إذا ما تعرف الكتاب، اكتب من المواضيع والتصنيف وصفاً عاماً أميناً بلا اختلاق أحداث أو شخصيات.\n' +
    '- بلا مقدمات مثل «هذا الكتاب» أو «يتحدث الكتاب».\n\n' +
    `${facts.join('\n')}\n\n` +
    'أرجع JSON فقط بالشكل: {"description":"..."}'
  );
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
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<string> {
  const key = String(geminiApiKey || '').trim();
  if (!key) return '';
  const doFetch = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!doFetch) return '';
  try {
    const response = await doFetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildBookSummaryPrompt(book) }] }],
          generationConfig: { temperature: 0.4, responseMimeType: 'application/json', maxOutputTokens: 300 }
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
    return isUsableDescription(summary) ? summary : '';
  } catch {
    return '';
  }
}
