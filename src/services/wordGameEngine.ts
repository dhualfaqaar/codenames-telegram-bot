/**
 * 🥊 «تحدي القافية» و📏«أطول كلمة» — ألعاب كلمات سريعة مع البوت.
 *
 * القافية: البوت يعطي كلمة، واللاعب يختار من أزرار الكلمات اللي تقافيها.
 * أطول كلمة: البوت يعطي حروف، واللاعب يكوّن أطول كلمة منها (من الخيارات).
 */

// ─────────────────────────── تحدي القافية ───────────────────────────

export interface RhymePuzzle {
  word: string;
  rhymes: string[];
  others: string[];
}

export const RHYME_PUZZLES: RhymePuzzle[] = [
  { word: 'كتاب', rhymes: ['باب', 'شباب', 'حساب'], others: ['قلم', 'ماء', 'شمس'] },
  { word: 'دار', rhymes: ['نار', 'بحار', 'صغار'], others: ['بيت', 'جبل', 'طير'] },
  { word: 'حبيب', rhymes: ['طبيب', 'غريب', 'قريب'], others: ['صديق', 'أخ', 'جار'] },
  { word: 'سماء', rhymes: ['ماء', 'ضياء', 'دعاء'], others: ['أرض', 'نجم', 'قمر'] },
  { word: 'زمان', rhymes: ['أمان', 'لسان', 'بيان'], others: ['يوم', 'سنة', 'شهر'] },
  { word: 'جميل', rhymes: ['دليل', 'طويل', 'نخيل'], others: ['قبيح', 'كبير', 'صغير'] },
  { word: 'قلبي', rhymes: ['دربي', 'حربي', 'جنبي'], others: ['راسي', 'إيدي', 'رجلي'] },
  { word: 'نور', rhymes: ['زهور', 'طيور', 'قدور'], others: ['ظلام', 'ليل', 'نجم'] },
  { word: 'سلام', rhymes: ['كلام', 'أيام', 'غمام'], others: ['حرب', 'قتال', 'صراع'] },
  { word: 'ورد', rhymes: ['برد', 'سعد', 'عهد'], others: ['شوك', 'حجر', 'ماء'] }
];

export interface RhymeRound {
  word: string;
  options: string[];
  correct: number[];
  picked: number[];
  attempts: number;
  done: boolean;
  score: number;
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createRhyme(previousWord?: string): RhymeRound {
  let pool = RHYME_PUZZLES.filter(p => p.word !== previousWord);
  if (!pool.length) pool = RHYME_PUZZLES;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  const all = shuffle([...chosen.rhymes, ...chosen.others]);
  const correct = all
    .map((w, i) => (chosen.rhymes.includes(w) ? i : -1))
    .filter(i => i >= 0);
  return {
    word: chosen.word,
    options: all,
    correct,
    picked: [],
    attempts: 0,
    done: false,
    score: 0
  };
}

/** اللاعب يختار كلمة — إذا صحيحة نزيد النقطة، وإذا خلصت كل الصح خلصت الجولة */
export function pickRhyme(round: RhymeRound, index: number): RhymeRound {
  if (round.done || round.picked.includes(index)) return round;
  const isCorrect = round.correct.includes(index);
  const picked = [...round.picked, index];
  const score = isCorrect ? round.score + 1 : round.score;
  const foundAll = round.correct.every(i => picked.includes(i));
  const attempts = round.attempts + 1;
  const allDone = foundAll || attempts >= round.correct.length + 2;
  return { ...round, picked, score, attempts, done: allDone };
}

export function rhymePoints(round: RhymeRound): number {
  return round.score * 2;
}

export function renderRhyme(round: RhymeRound): string {
  const lines = [`🥊 *تحدي القافية*`, `━━━━━━━━━━━━━━━━━━━`];
  lines.push(`🔤 الكلمة: *${round.word}*`);
  lines.push(`👇 اختار الكلمات اللي تقافيها:`);
  if (round.done) {
    lines.push(`━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🏁 خلصت — جبت *${round.score}* كلمة صح`);
    lines.push(`⭐ +${rhymePoints(round)} نقطة`);
  } else {
    lines.push(`_جمعت ${round.score} من ${round.correct.length}_`);
  }
  return lines.join('\n');
}

export function rhymeKeyboard(round: RhymeRound): any[][] {
  if (round.done) {
    return [
      [{ text: '🔄 كلمة جديدة', callback_data: 'rh:new' }],
      [{ text: '🔙 رجوع', callback_data: 'hub:g:rhyme' }]
    ];
  }
  const rows: any[][] = [];
  for (let i = 0; i < round.options.length; i += 2) {
    const pair = [round.options[i]];
    if (round.options[i + 1] !== undefined) pair.push(round.options[i + 1]);
    rows.push(
      pair.map(w => {
        const idx = round.options.indexOf(w);
        const picked = round.picked.includes(idx);
        const wasRight = round.correct.includes(idx);
        const mark = picked ? (wasRight ? '✅ ' : '❌ ') : '';
        return {
          text: `${mark}${w}`,
          callback_data: picked ? 'rh:noop' : `rh:${idx}`
        };
      })
    );
  }
  rows.push([{ text: '🔙 رجوع', callback_data: 'hub:g:rhyme' }]);
  return rows;
}

// ─────────────────────────── أطول كلمة ───────────────────────────

export interface LongestPuzzle {
  letters: string[];
  /** كلمات ممكنة مرتبة من الأطول */
  words: string[];
}

export const LONGEST_PUZZLES: LongestPuzzle[] = [
  { letters: ['م', 'ف', 'ت', 'ا', 'ح'], words: ['مفتاح', 'فاتح', 'فتح', 'فم'] },
  { letters: ['م', 'د', 'ر', 'س', 'ة'], words: ['مدرسة', 'رسم', 'درس', 'رد'] },
  { letters: ['م', 'ل', 'ع', 'ب'], words: ['ملعب', 'علم', 'لعب', 'عم'] },
  { letters: ['م', 'س', 'ت', 'ق', 'ب', 'ل'], words: ['مستقبل', 'مستقل', 'مقبل', 'قلب'] },
  { letters: ['م', 'ك', 'ت', 'ب', 'ة'], words: ['مكتبة', 'مكتب', 'كتب', 'تب'] },
  { letters: ['ص', 'د', 'ا', 'ق', 'ة'], words: ['صداقة', 'صادق', 'صدق', 'قد'] },
  { letters: ['س', 'ف', 'ي', 'ن', 'ة'], words: ['سفينة', 'سيف', 'نفس', 'في'] },
  { letters: ['ح', 'د', 'ي', 'ق', 'ة'], words: ['حديقة', 'قدح', 'قيد', 'حد'] },
  { letters: ['م', 'ن', 'ا', 'ر', 'ة'], words: ['منارة', 'منار', 'نار', 'مر'] },
  { letters: ['ج', 'ز', 'ي', 'ر', 'ة'], words: ['جزيرة', 'جزر', 'زير', 'زر'] }
];

export interface LongestRound {
  letters: string[];
  options: string[];
  longest: string;
  picked?: string;
  done: boolean;
  won: boolean;
}

export function createLongest(previousSnippet?: string): LongestRound {
  let pool = LONGEST_PUZZLES.filter(p => p.letters.join('') !== previousSnippet);
  if (!pool.length) pool = LONGEST_PUZZLES;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  const options = shuffle(chosen.words).slice(0, 4);
  return {
    letters: chosen.letters,
    options,
    longest: chosen.words[0],
    done: false,
    won: false
  };
}

export function pickLongest(round: LongestRound, word: string): LongestRound {
  if (round.done) return round;
  const won = word === round.longest;
  return { ...round, picked: word, done: true, won };
}

export function longestPoints(round: LongestRound): number {
  return round.won ? 8 : 0;
}

export function renderLongest(round: LongestRound): string {
  const lines = [`📏 *أطول كلمة*`, `━━━━━━━━━━━━━━━━━━━`];
  lines.push(`🔡 الحروف: *${round.letters.join(' ')}*`);
  lines.push(`👇 اختار أطول كلمة صحيحة منها:`);
  if (round.done) {
    lines.push(`━━━━━━━━━━━━━━━━━━━`);
    if (round.won) {
      lines.push(`✅ صح! *${round.longest}* هي الأطول`);
      lines.push(`⭐ +${longestPoints(round)} نقطة`);
    } else {
      lines.push(`❌ غلط — الأطول هي: *${round.longest}*`);
    }
  }
  return lines.join('\n');
}

export function longestKeyboard(round: LongestRound): any[][] {
  if (round.done) {
    return [
      [{ text: '🔄 حروف جديدة', callback_data: 'lg:new' }],
      [{ text: '🔙 رجوع', callback_data: 'hub:g:longest' }]
    ];
  }
  return [
    ...round.options.map(w => [{ text: w, callback_data: `lg:${w}` }]),
    [{ text: '🔙 رجوع', callback_data: 'hub:g:longest' }]
  ];
}
