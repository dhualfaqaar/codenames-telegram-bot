/**
 * معلومات البناء — بصمة ثابتة لكل نشر.
 *
 * الهدف: نعرف **بالضبط** أي نسخة شغالة على الـWorker. قبل هذا صار يصير
 * «التغيير ما وصل البوت» وماكو طريقة نتحقق غير التخمين.
 *
 * القاعدة: كل PR يغيّر `BUILD_TAG`. و`/version` بالبوت و`GET /version`
 * بالـWorker يعرضونه مع وقت أول تشغيل لهذي النسخة.
 */
export const BUILD_TAG = '2026-10-31-books-v51';

/** بصمة واجهة الألعاب، وليست نقطة دخول Worker مستقلة. */
export const INTERACTIVE_APP_BUILD = '2026-11-11-game-sounds-v49';

/** ملخّص اللي بهذي النسخة — يظهر بـ /version حتى نتأكد إن الميزة موجودة. */
export const BUILD_FEATURES: string[] = [
  'مكتبة كتب 20,000 من Open Library',
  '29 صنف (علم نفس، آداب بلغات، سياسة، اقتصاد، علوم…)',
  'نبذة عربية من وصف حقيقي عند توفر الترجمة',
  'ملفات PDF موثوقة من إنترنت أرشيف والقناة',
  'بحث ذكي بفهرس القناة مع التحقق من PDF'
];

/** بصمة قسم الكتب — تتغير مع كل تعديل بمنطق الكتب. */
export const BOOKS_BUILD = 'books-2026-10-31-write-protection';

/** مفتاح التخزين اللي نربط بيه وقت أول تشغيل لهذي النسخة. */
export const BUILD_STORAGE_KEY = 'build:seen';

export interface BuildStamp {
  tag: string;
  at: number;
}

/** نص `/version` الجاهز للعرض (يستخدمه البوت). */
export function buildVersionLines(extra: string[] = []): string[] {
  return [
    `*بصمة البناء:* \`${BUILD_TAG}\``,
    `*قسم الكتب:* \`${BOOKS_BUILD}\``,
    ...extra,
    '',
    '*الجديد بهذي النسخة:*',
    ...BUILD_FEATURES.map(feature => `• ${feature}`)
  ];
}
