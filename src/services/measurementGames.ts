// ألعاب عشوائية للتسلية فقط، وليست اختباراً أو قياساً حقيقياً.
export const MEASUREMENT_GAMES = {
  kiss: 'قياس القبلة',
  longing: 'قياس الاشتياق',
  love: 'قياس الحب',
  friendship: 'قياس الصداقة',
  understanding: 'قياس التفاهم',
  trust: 'قياس الثقة',
  loyalty: 'قياس الوفاء',
  luck: 'قياس الحظ',
  patience: 'قياس الصبر',
  intelligence: 'قياس الذكاء',
  average: 'قياس نسبة المعدل',
  arabic: 'قياس العربي',
  english: 'قياس الإنكليزي',
  biology: 'قياس الأحياء',
  chemistry: 'قياس الكيمياء',
  physics: 'قياس الفيزياء',
  islamic: 'قياس الإسلامية',
  maths: 'قياس الرياضيات'
} as const;

export type MeasurementKind = keyof typeof MEASUREMENT_GAMES;
export function isMeasurementKind(value: string): value is MeasurementKind {
  return Object.prototype.hasOwnProperty.call(MEASUREMENT_GAMES, value);
}
export interface MeasurementGame {
  kind: MeasurementKind;
  hostId: string;
  guestId?: string;
  status: 'playing' | 'rejected';
  cells: Array<number | null>;
  updatedAt: number;
}
export function measurementKeyboard(game: MeasurementGame): any[][] {
  const rows: any[][] = [];
  for (let i = 0; i < 16; i += 4) {
    rows.push(game.cells.slice(i, i + 4).map((value, offset) => ({
      text: value === null ? String(i + offset + 1) : `${value}%`,
      callback_data: `measure:pick:${i + offset}`
    })));
  }
  return rows;
}
export function randomMeasurement(): number {
  return Math.floor(Math.random() * 101);
}
