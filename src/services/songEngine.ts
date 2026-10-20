/**
 * 🎵 «خمّن الأغنية»
 * البوت يعرض مقطع من كلمات أغنية مشهورة، واللاعب يختار المطرب/الأغنية من أزرار.
 */

export interface SongPuzzle {
  /** مقطع من الكلمات */
  snippet: string;
  /** الجواب الصح (اسم الأغنية/المطرب) */
  answer: string;
}

export const SONG_PUZZLES: SongPuzzle[] = [
  { snippet: 'يا طير يا طاير\nوين رايح وشايل أخبار', answer: 'كاظم الساهر' },
  { snippet: 'سلامي على من حبكم\nلو كان بعيد الدار', answer: 'راشد الماجد' },
  { snippet: 'أنا عمري من دونك\nساعات وما بحساب', answer: 'عمرو دياب' },
  { snippet: 'بتونس بيك\nوبحبك مهما كان', answer: 'وردة الجزائرية' },
  { snippet: 'أهواك وأتمنى لو أنساك\nوأنسى روحي وياك', answer: 'عبد الحليم حافظ' },
  { snippet: 'انت عمري اللي ابتدى\nبحياتي من أول لقاء', answer: 'أم كلثوم' },
  { snippet: 'يا مسافر وحدك\nويا راجع من بعيد', answer: 'محمد عبده' },
  { snippet: 'على بالي\nعلى بالي بشار', answer: 'فيروز' },
  { snippet: 'مكتوب على الجبين\nتلاقينا من جديد', answer: 'نجاة الصغيرة' },
  { snippet: 'قلبي ملكك\nوعقلي ما معايا', answer: 'أصالة نصري' },
  { snippet: 'شوقي إليك\nكل الدنيا ما تكفيه', answer: 'محمد عبده' },
  { snippet: 'بيني وبينك\nبحر وسنين', answer: 'كاظم الساهر' },
  { snippet: 'حبيبي يا نور العين\nيا أغلى من عيني', answer: 'عمرو دياب' },
  { snippet: 'قالوا العشق\nيا ريت ما قلناه', answer: 'ماجد المهندس' },
  { snippet: 'ذكرياتي\nكلها كانت معاك', answer: 'راشد الماجد' }
];

const SINGER_POOL: string[] = [
  'كاظم الساهر',
  'راشد الماجد',
  'عمرو دياب',
  'وردة الجزائرية',
  'عبد الحليم حافظ',
  'أم كلثوم',
  'محمد عبده',
  'فيروز',
  'نجاة الصغيرة',
  'أصالة نصري',
  'ماجد المهندس',
  'نانسي عجرم',
  'إليسا',
  'وائل كفوري',
  'محمد حماقي',
  'شيرين'
];

export interface SongRound {
  snippet: string;
  answer: string;
  options: string[];
  wrong: number[];
  attempts: number;
  done: boolean;
  won: boolean;
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createRound(previousSnippet?: string): SongRound {
  let pool = SONG_PUZZLES.filter(s => s.snippet !== previousSnippet);
  if (!pool.length) pool = SONG_PUZZLES;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  const wrongSingers = shuffle(SINGER_POOL.filter(s => s !== chosen.answer)).slice(0, 3);
  return {
    snippet: chosen.snippet,
    answer: chosen.answer,
    options: shuffle([chosen.answer, ...wrongSingers]),
    wrong: [],
    attempts: 0,
    done: false,
    won: false
  };
}

export function pointsFor(round: SongRound): number {
  if (!round.won) return 0;
  return round.attempts <= 1 ? 8 : 4;
}

export function answer(round: SongRound, index: number): SongRound {
  if (round.done) return round;
  if (index < 0 || index >= round.options.length) return round;
  if (round.wrong.includes(index)) return round;

  const attempts = round.attempts + 1;
  const correct = round.options[index] === round.answer;
  if (correct) return { ...round, attempts, done: true, won: true };

  const wrong = [...round.wrong, index];
  return { ...round, attempts, wrong, done: attempts >= 2, won: false };
}

export function renderMessage(round: SongRound): string {
  const lines = [`🎵 *خمّن الأغنية*`, `━━━━━━━━━━`];
  lines.push(`❝ ${round.snippet} ❞`);
  lines.push(`━━━━━━━━━━`);
  if (!round.done) {
    lines.push(`🎤 منو يغني هاي الأغنية؟`);
    lines.push(round.attempts === 0 ? `_عندك محاولتين_` : `_بقيتلك محاولة وحدة_ ⏳`);
  } else if (round.won) {
    lines.push(`✅ *الجواب:* ${round.answer}`);
    lines.push(`🎉 عرفتها!`);
  } else {
    lines.push(`❌ *الجواب الصح:* ${round.answer}`);
    lines.push(`😅 المرة الجاية!`);
  }
  return lines.join('\n');
}

export function keyboard(round: SongRound): any[][] {
  if (round.done) {
    return [
      [{ text: '🔄 أغنية جديدة', callback_data: 'sg:new' }],
      [{ text: '🔙 رجوع', callback_data: 'hub:g:guess_song' }]
    ];
  }
  const rows: any[][] = round.options.map((singer, i) => [
    {
      text: `${round.wrong.includes(i) ? '❌ ' : ''}${singer}`,
      callback_data: round.wrong.includes(i) ? 'sg:noop' : `sg:${i}`
    }
  ]);
  rows.push([{ text: '🔙 رجوع', callback_data: 'hub:g:guess_song' }]);
  return rows;
}
