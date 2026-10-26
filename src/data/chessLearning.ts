export type ChessExercise = {
  fen: string;
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
  prompt: string;
  hint: string;
  success: string;
};

export type ChessLesson = {
  id: string;
  icon: string;
  title: string;
  summary: string;
  detail: string;
  exercise: ChessExercise;
};

export type ChessPuzzle = ChessExercise & {
  id: string;
  title: string;
  level: 'سهل' | 'متوسط' | 'متقدم';
};

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const CASTLE = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
const PROMOTION = '7k/P7/8/8/8/8/8/7K w - - 0 1';
const EN_PASSANT = 'k7/8/8/3pP3/8/8/8/4K3 w - d6 0 2';
const HANGING_QUEEN = '4r2k/8/8/8/4Q3/8/8/K7 b - - 0 1';
const HANGING_ROOK = '8/k7/8/4r3/4Q3/8/8/K7 w - - 0 1';
const ESCAPE_CHECK = '4r2k/8/8/8/8/8/8/4K2R w - - 0 1';
const MATE_IN_ONE = '7k/6pp/5p2/8/8/5Q2/6PP/6K1 w - - 0 1';

export const CHESS_LESSONS: ChessLesson[] = [
  { id: 'knight', icon: '♘', title: 'حركة الحصان', summary: 'جرّب قفزة الحصان إلى وسط الرقعة.', detail: 'الحصان يتحرك بشكل حرف L: مربعان باتجاه ومربع إلى الجانب، ويقدر يقفز فوق القطع.', exercise: { fen: START, from: 'g1', to: 'f3', prompt: 'حرّك الحصان من g1 إلى f3.', hint: 'الحصان الأبيض الموجود قرب الملك يبدأ من g1.', success: 'صحيح! الحصان وصل لمربع مركزي.' } },
  { id: 'center', icon: '♙', title: 'السيطرة على الوسط', summary: 'افتح اللعب ببيدق الوسط.', detail: 'السيطرة على مربعي d4 وe4 تساعد قطعك تتحرك وتمنع الخصم من الاستحواذ على الرقعة.', exercise: { fen: START, from: 'e2', to: 'e4', prompt: 'تقدّم ببيدق الملك إلى e4.', hint: 'اختار البيدق الموجود أمام الملك مباشرة.', success: 'ممتاز! فتحت الطريق للفيل والملكة.' } },
  { id: 'queen', icon: '♕', title: 'التقط القطعة المعلّقة', summary: 'لاحظ الوزير الذي تركه الخصم بلا حماية.', detail: 'قبل أي نقلة، فتّش عن القطع التي يمكن أخذها بأمان. الفوز بقطعة كاملة أهم من هجوم شكلي.', exercise: { fen: HANGING_QUEEN, from: 'e8', to: 'e4', prompt: 'الأسود يلعب: خذ الوزير المكشوف.', hint: 'القلعة السوداء على e8 تستطيع النزول على نفس العمود.', success: 'أحسنت! أخذت الوزير بالقلعة.' } },
  { id: 'check', icon: '♔', title: 'النجاة من الكش', summary: 'حرّك الملك إلى مربع آمن.', detail: 'عندما يكون ملكك في كش، لازم ترد فوراً: حرّك الملك أو خذ القطعة المهاجمة أو اصدّ الخط.', exercise: { fen: ESCAPE_CHECK, from: 'e1', to: 'f2', prompt: 'الأبيض في كش. انقل الملك إلى f2.', hint: 'لا تبقَ على عمود القلعة السوداء.', success: 'صحيح! أخرجت الملك من خط الكش.' } },
  { id: 'castle', icon: '♜', title: 'التبييت', summary: 'أمّن الملك بالتبييت القصير.', detail: 'التبييت ينقل الملك خطوتين باتجاه القلعة، والقلعة تقف بجانبه. لا يصح إذا تحرك أحدهما أو مرّ الملك بمربع مهدد.', exercise: { fen: CASTLE, from: 'e1', to: 'g1', prompt: 'نفّذ التبييت القصير للأبيض.', hint: 'حرّك الملك من e1 إلى g1؛ القلعة تتحرك تلقائياً.', success: 'رائع! صار الملك أقرب للأمان والقلعة نشطة.' } },
  { id: 'promotion', icon: '♛', title: 'ترقية البيدق', summary: 'وصل البيدق إلى آخر صف وحوّله لملكة.', detail: 'إذا وصل البيدق إلى آخر صف، تختار قطعة جديدة. غالباً الملكة هي أقوى اختيار.', exercise: { fen: PROMOTION, from: 'a7', to: 'a8', promotion: 'q', prompt: 'قدّم البيدق a7 إلى a8 واختر الملكة.', hint: 'البيدق الأبيض على a7 يقدر يترقى مباشرة.', success: 'مبروك! البيدق صار ملكة.' } },
  { id: 'en-passant', icon: '♟', title: 'الأخذ بالتجاوز', summary: 'التقط بيدق الخصم بالنقلة الخاصة.', detail: 'إذا تقدم بيدق الخصم خطوتين ووقف بجانب بيدقك، تستطيع أخذه بالتجاوز في النقلة التالية فقط.', exercise: { fen: EN_PASSANT, from: 'e5', to: 'd6', prompt: 'الأبيض يلعب: خذ البيدق بالتجاوز إلى d6.', hint: 'الهدف هو المربع الفارغ خلف بيدق الخصم على d5.', success: 'صحيح! هذا هو الأخذ بالتجاوز.' } },
  { id: 'mate', icon: '♛', title: 'كش مات بحركة', summary: 'أنهِ المباراة بنقلة ملكة دقيقة.', detail: 'الكش مات يعني أن الملك مهدد ولا توجد أي نقلة قانونية تنقذه. فتّش عن المربعات التي تغلق طرق الهرب.', exercise: { fen: MATE_IN_ONE, from: 'f3', to: 'a8', prompt: 'الأبيض يلعب: ابحث عن كش مات بحركة واحدة.', hint: 'الملكة تقدر تعطي كش من القطر الطويل باتجاه a8.', success: 'كش مات! ماكو مربع آمن للملك الأسود.' } },
  { id: 'rook', icon: '♖', title: 'التقط القلعة', summary: 'استفد من قطعة ثقيلة غير محمية.', detail: 'الملكة تتحرك أفقياً وعمودياً وقطرياً. لا تضيّع فرصة أخذ قلعة مكشوفة إذا كانت النقلة آمنة.', exercise: { fen: HANGING_ROOK, from: 'e4', to: 'e5', prompt: 'الأبيض يلعب: خذ القلعة السوداء على e5.', hint: 'الملكة البيضاء والقلعة السوداء على نفس العمود.', success: 'ممتاز! ربحت قلعة كاملة.' } },
];

export const CHESS_PUZZLES: ChessPuzzle[] = [
  { id: 'queen', title: 'الوزير المكشوف', level: 'سهل', fen: HANGING_QUEEN, from: 'e8', to: 'e4', prompt: 'الأسود يلعب. التقط الوزير المكشوف.', hint: 'استعمل القلعة على عمود e.', success: 'صح! ربحت الوزير.', },
  { id: 'mate', title: 'كش مات بحركة', level: 'متوسط', fen: MATE_IN_ONE, from: 'f3', to: 'a8', prompt: 'الأبيض يلعب. مات بحركة واحدة.', hint: 'فتّش عن كش على القطر الطويل.', success: 'كش مات! أحسنت.', },
  { id: 'rook', title: 'قلعة بلا حماية', level: 'سهل', fen: HANGING_ROOK, from: 'e4', to: 'e5', prompt: 'الأبيض يلعب. خذ القلعة.', hint: 'الملكة على e4 والقلعة على e5.', success: 'أخذت القلعة وكسبت التبادل.', },
  { id: 'escape', title: 'اهرب من الكش', level: 'متوسط', fen: ESCAPE_CHECK, from: 'e1', to: 'f2', prompt: 'الأبيض في كش. حرّك الملك بأمان.', hint: 'ابتعد عن عمود e.', success: 'الملك صار خارج خط الهجوم.', },
  { id: 'castle', title: 'أمّن ملكك', level: 'سهل', fen: CASTLE, from: 'e1', to: 'g1', prompt: 'نفّذ التبييت القصير.', hint: 'الملك يتحرك من e1 إلى g1.', success: 'التبييت يحمي الملك ويفعّل القلعة.', },
  { id: 'promotion', title: 'بيدق على وشك الترقية', level: 'سهل', fen: PROMOTION, from: 'a7', to: 'a8', promotion: 'q', prompt: 'رقِّ البيدق إلى ملكة.', hint: 'حرّك البيدق خطوة إلى الصف الأخير.', success: 'صار عندك ملكة جديدة.', },
  { id: 'en-passant', title: 'فرصة لن تتكرر', level: 'متوسط', fen: EN_PASSANT, from: 'e5', to: 'd6', prompt: 'التقط البيدق بالتجاوز الآن.', hint: 'المربع الهدف d6، خلف بيدق الخصم.', success: 'التقطته بالتجاوز في الوقت المناسب.', },
  { id: 'knight', title: 'قفزة الحصان', level: 'سهل', fen: START, from: 'g1', to: 'f3', prompt: 'طوّر الحصان إلى f3.', hint: 'الحصان الأبيض على g1.', success: 'الحصان يسيطر على مربعات الوسط.', },
  { id: 'center', title: 'افتح الوسط', level: 'سهل', fen: START, from: 'e2', to: 'e4', prompt: 'ادفع بيدق الملك إلى e4.', hint: 'اختار البيدق أمام الملك.', success: 'فتحت الطريق لقطعك.', },
  { id: 'queen-again', title: 'احسب قبل أن تلعب', level: 'متقدم', fen: HANGING_QUEEN, from: 'e8', to: 'e4', prompt: 'هناك قطعة ثمينة معلّقة. ما أفضل نقلة؟', hint: 'ابحث عن أخذ مباشر آمن.', success: 'النقلة الرابحة هي أخذ الوزير.', },
];
