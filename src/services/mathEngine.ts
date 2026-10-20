/**
 * 🔢 «تحدي الحساب»
 * مسائل جمع/طرح/ضرب، واللاعب يضغط الجواب الصح من أزرار سريعة.
 * من يجمع 5 نقاط أول.
 */

export interface MathRound {
  question: string;
  answer: number;
  options: number[];
  /** نقاط اللاعب */
  score: number;
  /** الهدف (أول من يوصل) */
  target: number;
  /** آخر ضغطة صح؟ */
  lastCorrect?: boolean;
  done: boolean;
  won: boolean;
  total: number;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function makeQuestion(): { question: string; answer: number } {
  const op = ['+', '-', '×'][randInt(0, 2)];
  let a = randInt(2, 20);
  let b = randInt(2, 20);
  let answer: number;
  if (op === '+') answer = a + b;
  else if (op === '-') {
    if (b > a) [a, b] = [b, a];
    answer = a - b;
  } else {
    a = randInt(2, 12);
    b = randInt(2, 12);
    answer = a * b;
  }
  return { question: `${a} ${op} ${b}`, answer };
}

function optionsFor(answer: number): number[] {
  const set = new Set<number>([answer]);
  while (set.size < 4) {
    const delta = randInt(1, 6) * (Math.random() < 0.5 ? -1 : 1);
    const v = answer + delta;
    if (v >= 0) set.add(v);
  }
  return shuffle(Array.from(set));
}

export function createGame(target = 5): MathRound {
  const { question, answer } = makeQuestion();
  return {
    question,
    answer,
    options: optionsFor(answer),
    score: 0,
    target,
    done: false,
    won: false,
    total: 0
  };
}

/** يعالج ضغطة الجواب ويرجّع الحالة الجديدة + هل كان صح */
export function answer(round: MathRound, value: number): { state: MathRound; correct: boolean } {
  if (round.done) return { state: round, correct: false };
  const correct = value === round.answer;
  const score = correct ? round.score + 1 : round.score;
  const total = round.total + 1;

  if (score >= round.target) {
    return {
      state: { ...round, score, total, done: true, won: true, lastCorrect: correct },
      correct
    };
  }

  const { question, answer } = makeQuestion();
  return {
    state: {
      ...round,
      question,
      answer,
      options: optionsFor(answer),
      score,
      total,
      lastCorrect: correct
    },
    correct
  };
}

export function pointsFor(round: MathRound): number {
  return round.won ? 10 : 0;
}

export function renderMessage(round: MathRound): string {
  const lines = [`🔢 *تحدي الحساب*`, `━━━━━━━━━━`];
  if (round.done) {
    lines.push(`🏁 *خلصت!*`);
    lines.push(`✅ جمعت *${round.target}* نقاط`);
    lines.push(`🎯 دقتك: ${round.total ? Math.round((round.score / round.total) * 100) : 0}%`);
    lines.push(`🎉 فزت!` + `\n⭐ +${pointsFor(round)} نقطة`);
    return lines.join('\n');
  }
  lines.push(`⭐ نقاطك: *${round.score}* من *${round.target}*`);
  lines.push(`━━━━━━━━━━`);
  lines.push(`🧮 *كم يساوي؟*`);
  lines.push(`❓ \`${round.question}\``);
  if (round.lastCorrect === false) lines.push(`❌ الغلط يخليك تخسر الثانية!`);
  return lines.join('\n');
}

export function keyboard(round: MathRound): any[][] {
  if (round.done) {
    return [
      [{ text: '🔄 جولة جديدة', callback_data: 'ma:new' }],
      [{ text: '🔙 رجوع', callback_data: 'hub:g:math' }]
    ];
  }
  const rows: any[][] = [];
  for (let i = 0; i < round.options.length; i += 2) {
    const row = [round.options[i]].concat(round.options[i + 1] !== undefined ? [round.options[i + 1]] : []);
    rows.push(
      row.map(v => ({ text: String(v), callback_data: `ma:${v}` }))
    );
  }
  rows.push([{ text: '🔙 رجوع', callback_data: 'hub:g:math' }]);
  return rows;
}
