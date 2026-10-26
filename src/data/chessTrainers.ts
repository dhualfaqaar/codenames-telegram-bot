export type ChessTrainerStyle = 'balanced' | 'tactical' | 'positional' | 'aggressive' | 'defensive' | 'endgame';

export type ChessTrainer = {
  id: string;
  name: string;
  elo: number;
  style: ChessTrainerStyle;
  tagline: string;
  icon: string;
};

/** Playable trainer ladder. Keep ratings strictly increasing so each selection has a clear level. */
export const CHESS_TRAINERS: ChessTrainer[] = [
  { id: 'salem', name: 'بوت', elo: 200, style: 'balanced', tagline: 'خطوات أولى ونقلات بسيطة', icon: '♟' },
  { id: 'lina', name: 'بوت', elo: 300, style: 'positional', tagline: 'تعلّم السيطرة على الوسط', icon: '♙' },
  { id: 'marwan', name: 'بوت', elo: 400, style: 'balanced', tagline: 'مبتدئ هادئ', icon: '♞' },
  { id: 'nour', name: 'بوت', elo: 500, style: 'tactical', tagline: 'تحاول التقاط القطع المكشوفة', icon: '♗' },
  { id: 'jassim', name: 'بوت', elo: 600, style: 'defensive', tagline: 'يدافع عن قطعه قبل الهجوم', icon: '♜' },
  { id: 'sara', name: 'بوت', elo: 700, style: 'positional', tagline: 'تطوّر القطع وتسيطر على المربعات', icon: '♕' },
  { id: 'fahad', name: 'بوت', elo: 800, style: 'aggressive', tagline: 'هجوم نشيط مع بعض المخاطرة', icon: '♘' },
  { id: 'zainab', name: 'بوت', elo: 900, style: 'balanced', tagline: 'خصم متوازن للممارسة', icon: '♔' },
  { id: 'kazem', name: 'بوت', elo: 1000, style: 'tactical', tagline: 'يرى التكتيكات القصيرة', icon: '♞' },
  { id: 'yara', name: 'بوت', elo: 1100, style: 'defensive', tagline: 'تقلل الأخطاء وتحمي الملك', icon: '♖' },
  { id: 'omar', name: 'بوت', elo: 1200, style: 'positional', tagline: 'لعب مركزي وخطة واضحة', icon: '♗' },
  { id: 'rana', name: 'بوت', elo: 1300, style: 'aggressive', tagline: 'تضغط وتبحث عن المبادرة', icon: '♕' },
  { id: 'ali', name: 'بوت', elo: 1400, style: 'tactical', tagline: 'تكتيكات وحساب أعمق', icon: '♘' },
  { id: 'maryam', name: 'بوت', elo: 1500, style: 'balanced', tagline: 'خصم قوي ومتزن', icon: '♔' },
  { id: 'mustafa', name: 'بوت', elo: 1600, style: 'positional', tagline: 'يحسن القطع والمربعات الضعيفة', icon: '♜' },
  { id: 'dana', name: 'بوت', elo: 1700, style: 'defensive', tagline: 'دفاع صلب وتحويل جيد للهجمات', icon: '♖' },
  { id: 'haider', name: 'بوت', elo: 1800, style: 'aggressive', tagline: 'هجوم محسوب وضغط مستمر', icon: '♕' },
  { id: 'layla', name: 'بوت', elo: 1900, style: 'endgame', tagline: 'نهايات دقيقة وقطع فعّالة', icon: '♘' },
  { id: 'karrar', name: 'بوت', elo: 2000, style: 'tactical', tagline: 'يحسب التبادلات والتهديدات', icon: '♔' },
  { id: 'aya', name: 'بوت', elo: 2150, style: 'positional', tagline: 'تخطيط طويل المدى', icon: '♗' },
  { id: 'faris', name: 'بوت', elo: 2300, style: 'aggressive', tagline: 'مستوى متقدم وهجوم قوي', icon: '♕' },
  { id: 'nada', name: 'بوت', elo: 2450, style: 'endgame', tagline: 'حساب دقيق حتى نهاية المباراة', icon: '♖' },
  { id: 'shaheen', name: 'بوت', elo: 2600, style: 'balanced', tagline: 'خصم خبير بأخطاء نادرة', icon: '♘' },
  { id: 'grandmaster', name: 'بوت', elo: 2800, style: 'tactical', tagline: 'أعلى تحدّي متاح', icon: '♔' },
];

export function getChessTrainer(id?: unknown, fallbackElo = 200): ChessTrainer {
  if (typeof id === 'string') {
    const exact = CHESS_TRAINERS.find(trainer => trainer.id === id);
    if (exact) return exact;
  }
  const rating = Math.max(200, Math.min(2800, Number(fallbackElo) || 200));
  return CHESS_TRAINERS.reduce((best, trainer) => Math.abs(trainer.elo - rating) < Math.abs(best.elo - rating) ? trainer : best, CHESS_TRAINERS[0]);
}
