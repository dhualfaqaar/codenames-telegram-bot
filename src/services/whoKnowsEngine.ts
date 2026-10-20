/**
 * 🤝 لعبة «منو يعرف الثاني أكثر؟»
 *
 * هيكل كامل خاص باللعبة:
 *  1) لوبي بالقناة/المجموعة ينضم له شخصان بزر «انضم».
 *  2) المرحلة الأولى بالخاص: البوت يرسل لكل مشارك سلسلة أسئلة شخصية (أكلتك المفضلة، لونك المفضل…)
 *     ويثبّت إجاباته السرية عند البوت (كتابةً بحرية كاملة أو من الاقتراحات السريعة).
 *  3) المرحلة الثانية بالخاص: كل مشارك يخمّن إجابات الطرف الثاني المثبّتة عند البوت.
 *  4) النهاية بالقناة: كشف البطاقات كاملة للطرفين — منو عرف الثاني أكثر وكم شغلة جابها صح من العدد الكلي.
 */

export interface WKQuestion {
  id: string;
  emoji: string;
  shortLabel: string;
  askSelf: string;
  askGuess: string;
  suggestions: string[];
}

export const WK_QUESTIONS: WKQuestion[] = [
  {
    id: 'food',
    emoji: '🍽️',
    shortLabel: 'الأكلة المفضلة',
    askSelf: 'أعطني أكلتك المفضلة:',
    askGuess: 'ما هي أكلته/أكلتها المفضلة برأيك؟',
    suggestions: ['دولمة', 'برياني', 'شاورما', 'بيتزا', 'مسگوف', 'برجر']
  },
  {
    id: 'color',
    emoji: '🎨',
    shortLabel: 'اللون المفضل',
    askSelf: 'أعطني لونك المفضل:',
    askGuess: 'ما هو لونه/لونها المفضل برأيك؟',
    suggestions: ['أسود', 'أزرق', 'أبيض', 'أحمر', 'أخضر', 'بنفسجي']
  },
  {
    id: 'drink',
    emoji: '🥤',
    shortLabel: 'المشروب المفضل',
    askSelf: 'أعطني مشروبك المفضل:',
    askGuess: 'ما هو مشروبه/مشروبها المفضل برأيك؟',
    suggestions: ['شاي', 'قهوة', 'عصير برتقال', 'مشروب غازي', 'موهيتو', 'حليب']
  },
  {
    id: 'time',
    emoji: '🌙',
    shortLabel: 'الوقت المفضل',
    askSelf: 'أعطني وقتك المفضل في اليوم:',
    askGuess: 'ما هو وقته/وقتها المفضل في اليوم؟',
    suggestions: ['آخر الليل', 'الفجر', 'الصباح', 'العصر', 'المغرب', 'المساء']
  },
  {
    id: 'travel',
    emoji: '✈️',
    shortLabel: 'وجهة السفر',
    askSelf: 'أعطني الدولة التي تتمنى السفر إليها:',
    askGuess: 'ما هي الدولة التي يتمنى/تتمنى السفر إليها؟',
    suggestions: ['تركيا', 'اليابان', 'إيطاليا', 'سويسرا', 'السعودية', 'إسبانيا']
  },
  {
    id: 'movies',
    emoji: '🎬',
    shortLabel: 'تصنيف الأفلام',
    askSelf: 'أعطني نوع الأفلام أو المسلسلات المفضل لديك:',
    askGuess: 'ما هو نوع الأفلام أو المسلسلات المفضل لديه/لديها؟',
    suggestions: ['أكشن', 'رعب', 'كوميدي', 'غموض وتحقيق', 'خيال علمي', 'دراما']
  },
  {
    id: 'season',
    emoji: '🌦️',
    shortLabel: 'الفصل المفضل',
    askSelf: 'أعطني فصلك المفضل في السنة:',
    askGuess: 'ما هو فصله/فصلها المفضل في السنة؟',
    suggestions: ['الشتاء', 'الربيع', 'الصيف', 'الخريف']
  },
  {
    id: 'sweet',
    emoji: '🍰',
    shortLabel: 'الحلويات المفضلة',
    askSelf: 'أعطني نوع الحلويات المفضل لديك:',
    askGuess: 'ما هو نوع الحلويات المفضل لديه/لديها؟',
    suggestions: ['بقلاوة', 'كنافة', 'كيك شوكولاتة', 'آيس كريم', 'داطلي', 'تشيز كيك']
  },
  {
    id: 'place',
    emoji: '🏞️',
    shortLabel: 'المكان المفضل',
    askSelf: 'أعطني مكانك المفضل للطلعة أو الاسترخاء:',
    askGuess: 'ما هو مكانه/مكانها المفضل للطلعة أو الاسترخاء؟',
    suggestions: ['البيت', 'الكافيه', 'البحر', 'الجبل', 'المول', 'الحديقة']
  },
  {
    id: 'mood',
    emoji: '😌',
    shortLabel: 'وقت الضوجة',
    askSelf: 'أعطني أول شيء تفعله وقت الضوجة أو الملل:',
    askGuess: 'ما هو أول شيء يفعله/تفعله وقت الضوجة؟',
    suggestions: ['النوم', 'الأكل', 'التصفح بالموبايل', 'سماع الموسيقى', 'الطلعة', 'اللعب']
  }
];

export const WK_TOTAL_CARDS = 6;
const SEP = '━━━━━━━━━━━━━━━━━━━';

export interface WKPlayer {
  id: string;
  name: string;
  /** إجابات اللاعب عن نفسه (بطاقاته السرية المثبّتة) */
  answers: string[];
  /** تخمينات اللاعب لإجابات الطرف الثاني */
  guesses: string[];
  /** نتائج مطابقة تخميناته لإجابات الطرف الثاني */
  hits: boolean[];
  /** مجموع ما عرفه صح عن الطرف الثاني */
  score: number;
  /** فتح الخاص مع البوت؟ */
  dmReady?: boolean;
}

export interface WKGame {
  id: string;
  chatId: string;
  chatTitle: string;
  messageId?: number;
  inlineMessageId?: string;
  status: 'lobby' | 'answering' | 'guessing' | 'game_over';
  questions: WKQuestion[];
  players: WKPlayer[];
  winnerId?: string; // undefined عند التعادل
  rewarded?: boolean;
  createdAt: number;
  updatedAt: number;
}

export function wkMd(s: string): string {
  return String(s || '').replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SYNONYM_MAP: Record<string, string> = {
  چاي: 'شاي',
  جاي: 'شاي',
  كهوه: 'قهوه',
  كوفي: 'قهوه',
  نسكافيه: 'قهوه',
  اسبريسو: 'قهوه',
  مسكوف: 'مسكوف',
  مسگوف: 'مسكوف',
  بركر: 'برجر',
  برغر: 'برجر',
  همبركر: 'برجر',
  بيبسي: 'غازي',
  كولا: 'غازي',
  سبرايت: 'غازي',
  مشروبغازي: 'غازي',
  شتا: 'شتاء',
  صيف: 'صيف',
  ربيع: 'ربيع',
  خريف: 'خريف',
  طوبه: 'كرهقدم',
  كوره: 'كرهقدم',
  انكليزي: 'انجليزي',
  اميركا: 'امريكا',
  اسطنبول: 'تركيا',
  طوكيو: 'يابان',
  روما: 'ايطاليا',
  مكه: 'سعوديه',
  رياض: 'سعوديه',
  كاكاو: 'شوكولاته',
  نوتيلا: 'شوكولاته',
  موطا: 'ايسكريم',
  بوظه: 'ايسكريم',
  فون: 'موبايل',
  تلفون: 'موبايل',
  جوال: 'موبايل',
  هاتف: 'موبايل',
  كافي: 'كافيه',
  مقهي: 'كافيه',
  منزل: 'بيت',
  دار: 'بيت'
};

const FILLER_WORDS = new Set([
  'احب', 'افضل', 'اكيد', 'طبعا', 'كلش', 'جدا', 'هواي', 'هوايه', 'اكثر', 'شي', 'شيء',
  'هو', 'هي', 'ان', 'في', 'من', 'على', 'الي', 'اللي', 'اني', 'انا', 'والله', 'صراحه',
  'لون', 'اكل', 'اكله', 'مشروب', 'عصير', 'وقت', 'فصل', 'دوله', 'مدينه', 'نوع', 'افلام', 'مسلسلات'
]);

/** تطبيع عربي ذكي لتطابق الإجابات حتى مع اختلاف الهمزات والتاء المربوطة و«ال» التعريف والأخطاء البسيطة */
export function normalizeAnswer(raw: string): string[] {
  const cleaned = String(raw || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // التشكيل والتطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/گ/g, 'ك')
    .replace(/پ/g, 'ب')
    .replace(/چ/g, 'ش')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim();

  if (!cleaned) return [];

  const tokens = cleaned
    .split(/\s+/)
    .map(w => (w.startsWith('ال') && w.length > 3 ? w.slice(2) : w))
    .map(w => SYNONYM_MAP[w] || w)
    .filter(Boolean);

  const meaningful = tokens.filter(w => !FILLER_WORDS.has(w));
  return meaningful.length ? meaningful : tokens;
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/** هل التخمين يطابق الإجابة الحقيقية؟ */
export function answersMatch(realAnswer: string, guess: string): boolean {
  const aTokens = normalizeAnswer(realAnswer);
  const gTokens = normalizeAnswer(guess);
  if (!aTokens.length || !gTokens.length) return false;

  const aFull = aTokens.join('');
  const gFull = gTokens.join('');
  if (aFull === gFull) return true;
  if (aFull.length >= 4 && gFull.length >= 4 && editDistance(aFull, gFull) <= 1) return true;

  // تطابق كلمة مفتاحية أساسية بين الإجابة والتخمين
  for (const at of aTokens) {
    for (const gt of gTokens) {
      if (at === gt && at.length >= 2) return true;
      if (at.length >= 4 && gt.length >= 4 && editDistance(at, gt) <= 1) return true;
    }
  }
  return false;
}

export function createWKGame(chatId: string, chatTitle: string): WKGame {
  return {
    id: `wk_${chatId}_${Date.now()}`,
    chatId,
    chatTitle,
    status: 'lobby',
    questions: shuffle(WK_QUESTIONS).slice(0, WK_TOTAL_CARDS),
    players: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function wkJoin(game: WKGame, id: string, name: string): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: 'اللعبة بدأت بالفعل' };
  if (game.players.some(p => p.id === id)) return { ok: false, msg: 'أنت منضم مسبقاً ✅' };
  if (game.players.length >= 2) return { ok: false, msg: 'اكتمل العدد (لاعبان)' };
  game.players.push({
    id,
    name: name || 'لاعب',
    answers: [],
    guesses: [],
    hits: [],
    score: 0
  });
  game.updatedAt = Date.now();
  return { ok: true, msg: 'تم انضمامك ✅' };
}

export function wkPartner(game: WKGame, userId: string): WKPlayer | undefined {
  return game.players.find(p => p.id !== userId);
}

/** يسجّل إجابة اللاعب عن نفسه في المرحلة الأولى */
export function wkSubmitSelfAnswer(
  game: WKGame,
  userId: string,
  text: string
): { ok: boolean; playerDone: boolean; phaseComplete: boolean; nextIndex: number } {
  if (game.status !== 'answering') {
    return { ok: false, playerDone: false, phaseComplete: false, nextIndex: 0 };
  }
  const p = game.players.find(x => x.id === userId);
  if (!p || p.answers.length >= game.questions.length) {
    return { ok: false, playerDone: true, phaseComplete: false, nextIndex: game.questions.length };
  }

  p.answers.push(text.trim().slice(0, 60));
  game.updatedAt = Date.now();

  const playerDone = p.answers.length >= game.questions.length;
  const bothDone = game.players.length === 2 && game.players.every(x => x.answers.length >= game.questions.length);
  if (bothDone) {
    game.status = 'guessing';
  }
  return {
    ok: true,
    playerDone,
    phaseComplete: bothDone,
    nextIndex: p.answers.length
  };
}

/** يسجّل تخمين اللاعب لإجابة الطرف الثاني في المرحلة الثانية */
export function wkSubmitGuess(
  game: WKGame,
  userId: string,
  guessText: string
): { ok: boolean; playerDone: boolean; gameOver: boolean; nextIndex: number } {
  if (game.status !== 'guessing') {
    return { ok: false, playerDone: false, gameOver: false, nextIndex: 0 };
  }
  const p = game.players.find(x => x.id === userId);
  const other = wkPartner(game, userId);
  if (!p || !other || p.guesses.length >= game.questions.length) {
    return { ok: false, playerDone: true, gameOver: false, nextIndex: game.questions.length };
  }

  const idx = p.guesses.length;
  const clean = guessText.trim().slice(0, 60);
  const hit = answersMatch(other.answers[idx] || '', clean);
  p.guesses.push(clean);
  p.hits.push(hit);
  if (hit) p.score += 1;
  game.updatedAt = Date.now();

  const playerDone = p.guesses.length >= game.questions.length;
  const bothDone = game.players.length === 2 && game.players.every(x => x.guesses.length >= game.questions.length);

  if (bothDone) {
    game.status = 'game_over';
    const [p1, p2] = game.players;
    if (p1.score > p2.score) game.winnerId = p1.id;
    else if (p2.score > p1.score) game.winnerId = p2.id;
    else game.winnerId = undefined; // تعادل
  }

  return {
    ok: true,
    playerDone,
    gameOver: bothDone,
    nextIndex: p.guesses.length
  };
}

/** نص السؤال المرسل بالخاص (المرحلة ١ أو المرحلة ٢) بصيغة MarkdownV2 */
export function renderWKPrompt(game: WKGame, userId: string): { text: string; keyboard: any[][] } | null {
  const p = game.players.find(x => x.id === userId);
  const other = wkPartner(game, userId);
  if (!p || !other) return null;

  if (game.status === 'answering') {
    const idx = p.answers.length;
    if (idx >= game.questions.length) return null;
    const q = game.questions[idx];
    const kb: any[][] = [];
    for (let i = 0; i < q.suggestions.length; i += 2) {
      const row: any[] = [{ text: q.suggestions[i], callback_data: `wkp:a:${game.chatId}:${idx}:${i}` }];
      if (q.suggestions[i + 1]) {
        row.push({ text: q.suggestions[i + 1], callback_data: `wkp:a:${game.chatId}:${idx}:${i + 1}` });
      }
      kb.push(row);
    }
    const text =
      `🤝 *منو يعرف الثاني أكثر؟*\n` +
      `📝 *تثبيت إجابتك \\(${idx + 1} من ${game.questions.length}\\)*\n` +
      `${SEP}\n` +
      `${q.emoji} *${wkMd(q.askSelf)}*\n` +
      `_اكتب إجابتك برسالة الآن أو اختر من الأزرار السريعة_ 🔒`;
    return { text, keyboard: kb };
  }

  if (game.status === 'guessing') {
    const idx = p.guesses.length;
    if (idx >= game.questions.length) return null;
    const q = game.questions[idx];
    // نبني ٤ خيارات ذكية تتضمن جواب الشريك الحقيقي بترتيب عشوائي ثابت للجولة + إمكانية الكتابة الحرة
    const realAns = other.answers[idx] || '';
    const pool = q.suggestions.filter(s => !answersMatch(realAns, s));
    const distractors = pool.slice(0, 3);
    const choices = shuffle([realAns, ...distractors]);

    const kb: any[][] = [];
    // نمرّر نص الاختيار مفهرساً عبر فهرس آمن أو نسمح بالضغط والكتابة معاً
    for (let i = 0; i < choices.length; i += 2) {
      const c1 = choices[i];
      const tag1 = c1 === realAns ? 'real' : `d${pool.indexOf(c1)}`;
      const row: any[] = [{ text: c1, callback_data: `wkp:g:${game.chatId}:${idx}:${tag1}` }];
      if (choices[i + 1] !== undefined) {
        const c2 = choices[i + 1];
        const tag2 = c2 === realAns ? 'real' : `d${pool.indexOf(c2)}`;
        row.push({ text: c2, callback_data: `wkp:g:${game.chatId}:${idx}:${tag2}` });
      }
      kb.push(row);
    }

    const text =
      `🃏 *خمّن بطاقة الطرف الثاني \\(${idx + 1} من ${game.questions.length}\\)*\n` +
      `> \\| *${wkMd(other.name)}* \\|\n` +
      `${SEP}\n` +
      `${q.emoji} *${wkMd(q.askGuess)}*\n` +
      `_اختر من البطاقات أو اكتب تخمينك برسالة_ 👇`;
    return { text, keyboard: kb };
  }

  return null;
}

/** لوحة القناة بصيغة MarkdownV2 — كل شخص داخل اقتباس ملوّن منفصل تماماً */
export function renderWKBoard(game: WKGame, notice?: string): string {
  const lines: string[] = [`🤝 *منو يعرف الثاني أكثر؟*`];

  if (game.status === 'lobby') {
    lines.push('');
    lines.push(`👥 *المشاركون \\(${game.players.length}/2\\):*`);
    if (!game.players.length) {
      lines.push(`_بانتظار انضمام اللاعبين_`);
    } else {
      lines.push(
        game.players
          .map((p, i) => `> ${i + 1} \\- \\| *${wkMd(p.name)}* \\|`)
          .join('\n')
      );
    }
    if (notice) {
      lines.push('');
      lines.push(`⚠️ ${wkMd(notice)}`);
    }
    return lines.join('\n');
  }

  if (game.status === 'answering') {
    lines.push(`📝 *المرحلة ١: تثبيت الإجابات بالخاص \\(${game.questions.length} أسئلة\\)*`);
    lines.push(SEP);
    lines.push(
      game.players
        .map(p => {
          const done = p.answers.length >= game.questions.length;
          const st = done
            ? `كمّل التثبيت ✅`
            : `ثبّت ${p.answers.length} من ${game.questions.length} ✍️`;
          return `> \\| *${wkMd(p.name)}* \\| — ${st}`;
        })
        .join('\n')
    );
    return lines.join('\n');
  }

  if (game.status === 'guessing') {
    lines.push(`🃏 *المرحلة ٢: تخمين بطاقات الطرف الثاني بالخاص*`);
    lines.push(SEP);
    lines.push(
      game.players
        .map(p => {
          const done = p.guesses.length >= game.questions.length;
          const st = done
            ? `أنهى التخمين ✅`
            : `خمّن ${p.guesses.length} من ${game.questions.length} 🤔`;
          return `> \\| *${wkMd(p.name)}* \\| — ${st}`;
        })
        .join('\n')
    );
    return lines.join('\n');
  }

  // 🏁 كشف البطاقات النهائي
  const total = game.questions.length;
  const sorted = game.players.slice().sort((a, b) => b.score - a.score);
  const winner = game.winnerId ? game.players.find(p => p.id === game.winnerId) : undefined;

  lines.push(`🃏 *كشف البطاقات والنتيجة النهائية*`);
  lines.push('');
  if (winner) {
    lines.push(`🏆 *الفائز \\(يعرف الثاني أكثر\\):*`);
    lines.push(`> \\| *${wkMd(winner.name)}* \\|`);
  } else {
    lines.push(`🤝 *النتيجة: تعادل\\! كلاهما بنفس المعرفة*`);
  }

  lines.push(SEP);
  lines.push(`📊 *عدد الإجابات الصحيحة من ${total}:*`);
  lines.push(
    sorted
      .map((p, i) => `> ${i + 1} \\- \\| *${wkMd(p.name)}* \\| — جاب *${p.score}* من *${total}* صح`)
      .join('\n')
  );

  // تفصيل البطاقات المكشوفة لكل شخص
  const [p1, p2] = game.players;
  if (p1 && p2) {
    for (const [subject, guesser] of [
      [p1, p2],
      [p2, p1]
    ] as [WKPlayer, WKPlayer][]) {
      lines.push(SEP);
      lines.push(`🗂️ *بطاقات:*`);
      lines.push(`> \\| *${wkMd(subject.name)}* \\|`);
      for (let i = 0; i < total; i++) {
        const q = game.questions[i];
        const realA = wkMd(subject.answers[i] || '—');
        const guessA = wkMd(guesser.guesses[i] || '—');
        const mark = guesser.hits[i] ? '✅' : '❌';
        lines.push(`${q.emoji} ${wkMd(q.shortLabel)}: *${realA}* ⟵ خمّنها: *${guessA}* ${mark}`);
      }
    }
  }

  return lines.join('\n');
}

export function wkBoardKeyboard(game: WKGame, botUsername?: string): any[][] {
  const rows: any[][] = [];
  if (game.status === 'lobby') {
    if (game.players.length < 2) {
      rows.push([{ text: 'انضم', callback_data: `wkj:${game.chatId}` }]);
    } else {
      rows.push([{ text: '🚀 ابدأ التحدي', callback_data: `wks:${game.chatId}` }]);
    }
    if (botUsername) {
      rows.push([
        {
          text: '💬 افتح الخاص مع البوت',
          url: `https://t.me/${botUsername}?start=wk_${game.chatId}`
        }
      ]);
    }
    return rows;
  }

  if (game.status === 'answering' || game.status === 'guessing') {
    if (botUsername) {
      rows.push([
        {
          text: '💬 الذهاب للخاص للإجابة',
          url: `https://t.me/${botUsername}?start=wk_${game.chatId}`
        }
      ]);
    }
    return rows;
  }

  return [[{ text: '🔄 لعبة جديدة', callback_data: `wkn:${game.chatId}` }]];
}
