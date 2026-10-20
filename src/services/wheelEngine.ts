/**
 * 🎰 «عجلة الحظ»
 * اللاعب يدوّر العجلة مرة باليوم، والنتيجة إما تزيد نقاطه أو تنقصها.
 * حظّية بحتة — فيها مضاعفات نادرة.
 */

export interface WheelOutcome {
  /** الاسم اللي يبين */
  label: string;
  /** المعامل: يمثل وش يصير بالنقاط */
  kind: 'points' | 'money' | 'xp' | 'nothing';
  /** القيمة */
  amount: number;
  /** احتمال الظهور (0..100) */
  weight: number;
}

export const WHEEL_OUTCOMES: WheelOutcome[] = [
  { label: '😐 لا شي — جرّب باجر', kind: 'nothing', amount: 0, weight: 30 },
  { label: '⭐ +1 نقطة', kind: 'points', amount: 1, weight: 22 },
  { label: '⭐ +3 نقاط', kind: 'points', amount: 3, weight: 14 },
  { label: '✨ +2 XP', kind: 'xp', amount: 2, weight: 12 },
  { label: '✨ +5 XP', kind: 'xp', amount: 5, weight: 8 },
  { label: '⭐ +8 نقاط', kind: 'points', amount: 8, weight: 6 },
  { label: '💵 +0.001', kind: 'money', amount: 0.001, weight: 5 },
  { label: '💵 +0.003', kind: 'money', amount: 0.003, weight: 2 },
  { label: '🌟 الجائزة الكبرى: +25 نقطة!', kind: 'points', amount: 25, weight: 1 }
];

/** يسحب نتيجة عشوائية حسب الأوزان */
export function spin(): WheelOutcome {
  const total = WHEEL_OUTCOMES.reduce((s, o) => s + o.weight, 0);
  let roll = Math.random() * total;
  for (const o of WHEEL_OUTCOMES) {
    roll -= o.weight;
    if (roll <= 0) return o;
  }
  return WHEEL_OUTCOMES[0];
}

/** مفتاح اليوم بتوقيت بغداد */
export function dayKey(now: number = Date.now()): string {
  return new Date(now + 3 * 3600 * 1000).toISOString().slice(0, 10);
}
