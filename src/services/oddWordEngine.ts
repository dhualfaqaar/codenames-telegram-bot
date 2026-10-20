/**
 * 🕵️ لعبة «الكلمة الغريبة»
 *
 * تعرض ٥ كلمات: ٤ منها بينها رابط ذكي أو غير تقليدي (لغوي، علمي، رياضي، منطقي، بصري)،
 * وكلمة خامسة واحدة فقط تخرج عن هذا الرابط — وعلى اللاعب اكتشاف الكلمة الغريبة!
 *
 * تدعم:
 *   1) اللعب الفردي المباشر في المحادثة الخاصة مع البوت.
 *   2) اللعب الجماعي التنافسي في القنوات والمجموعات (من لاعبين إلى ١٠ لاعبين عبر محرك الجماعية).
 */

export interface OddWordPuzzle {
  /** الكلمات الأربع المترابطة + الكلمة الغريبة كعنصر خامس */
  four: [string, string, string, string];
  odd: string;
  /** شرح الرابط الذكي الذي يجمع الأربع دون الخامسة */
  link: string;
}

export const ODD_WORD_PUZZLES: OddWordPuzzle[] = [
  {
    four: ['رجب', 'جبر', 'برج', 'جرب'],
    odd: 'صفر',
    link: 'الأربع تتكون من نفس الحروف الثلاثة (ب - ج - ر)، أما صفر ففخ للأشهر الهجرية'
  },
  {
    four: ['حلم', 'ملح', 'لحم', 'حمل'],
    odd: 'قمر',
    link: 'الأربع تتكون من نفس الحروف الثلاثة (ح - ل - م) بترتيب مختلف'
  },
  {
    four: ['بحر', 'حبر', 'ربح', 'حرب'],
    odd: 'سيف',
    link: 'الأربع تتكون من نفس الحروف الثلاثة (ب - ح - ر) بترتيب مختلف'
  },
  {
    four: ['توت', 'خوخ', 'كعك', 'باب'],
    odd: 'كتاب',
    link: 'الأربع تُقرأ من اليمين ومن اليسار بنفس اللفظ تماماً'
  },
  {
    four: ['محمد', 'أحمد', 'سعد', 'عمر'],
    odd: 'طارق',
    link: 'الأربع أسماء تخلو حروفها تماماً من أي نقطة'
  },
  {
    four: ['مرام', 'وداد', 'سمر', 'أمل'],
    odd: 'زينب',
    link: 'الأربع أسماء لا تحتوي على أي حرف منقوط إطلاقاً'
  },
  {
    four: ['بيت', 'بنت', 'تين', 'ثبت'],
    odd: 'قلم',
    link: 'الأربع كل حرف من حروفها منقوط بلا استثناء'
  },
  {
    four: ['المطرقة', 'السندان', 'الركاب', 'القوقعة'],
    odd: 'القرنية',
    link: 'الأربع أجزاء داخل الأذن البشرية، أما القرنية ففي العين'
  },
  {
    four: ['الملك', 'الوزير', 'الفيل', 'الحصان'],
    odd: 'الأسد',
    link: 'الأربع قطع في لعبة الشطرنج، والأسد ليس منها'
  },
  {
    four: ['عقرب', 'ميزان', 'دلو', 'قوس'],
    odd: 'سيف',
    link: 'الأربع أسماء أبراج فلكية معروفة'
  },
  {
    four: ['الخفاش', 'الحوت', 'الدلفين', 'الفقمة'],
    odd: 'القرش',
    link: 'الأربع ثدييات تلد وتتنفس بالرئتين، أما القرش فسمكة تتنفس بالخياشيم'
  },
  {
    four: ['النعامة', 'البطريق', 'الكيوي', 'الإيمو'],
    odd: 'الصقر',
    link: 'الأربع طيور حقيقية لكنها عاجزة عن الطيران'
  },
  {
    four: ['الطماطم', 'الخيار', 'الباذنجان', 'الفلفل'],
    odd: 'الجزر',
    link: 'الأربع ثمار علمياً بداخلها بذور، أما الجزر فجذر بلا بذور'
  },
  {
    four: ['النحلة', 'النملة', 'الفراشة', 'الجرادة'],
    odd: 'العنكبوت',
    link: 'الأربع حشرات بستة أرجل، أما العنكبوت فمن العنكبيات بثمانية أرجل'
  },
  {
    four: ['باريس', 'القاهرة', 'بغداد', 'طوكيو'],
    odd: 'نيويورك',
    link: 'الأربع عواصم رسمية لدولها، أما نيويورك فليست العاصمة'
  },
  {
    four: ['دبي', 'إسطنبول', 'نيويورك', 'سيدني'],
    odd: 'عمّان',
    link: 'الأربع مدن شهيرة ليست عواصم دولها، بينما عمّان عاصمة رسمية'
  },
  {
    four: ['اليابان', 'أيسلندا', 'مدغشقر', 'نيوزيلندا'],
    odd: 'البرازيل',
    link: 'الأربع دول جزرية بالكامل بلا أي حدود برية'
  },
  {
    four: ['سويسرا', 'النمسا', 'أفغانستان', 'إثيوبيا'],
    odd: 'المغرب',
    link: 'الأربع دول حبيسة لا تطل على أي بحر أو محيط'
  },
  {
    four: ['شمس', 'نار', 'أرض', 'حرب'],
    odd: 'قمر',
    link: 'الأربع مؤنث سماعي في اللغة العربية، أما القمر فمذكر'
  },
  {
    four: ['3', '5', '7', '11'],
    odd: '9',
    link: 'الأربع أعداد أولية لا تقبل القسمة إلا على نفسها و1، أما 9 يقبل القسمة على 3'
  },
  {
    four: ['8', '27', '64', '125'],
    odd: '100',
    link: 'الأربع مكعبات كاملة (2³، 3³، 4³، 5³)، أما 100 فليس مكعباً كاملاً'
  },
  {
    four: ['زئبق', 'ماء', 'زيت', 'عسل'],
    odd: 'حديد',
    link: 'الأربع مواد سائلة في درجة حرارة الغرفة (بما فيها معدن الزئبق!)'
  },
  {
    four: ['القلب', 'الكبد', 'المعدة', 'الطحال'],
    odd: 'الكلية',
    link: 'في جسم الإنسان عضو واحد فقط من كل منها، بينما يمتلك كليتين'
  },
  {
    four: ['البوصلة', 'الورق', 'البارود', 'الطباعة'],
    odd: 'الهاتف',
    link: 'الأربع هي الاختراعات الأربعة الكبرى للحضارة الصينية القديمة'
  },
  {
    four: ['الأكسجين', 'الهيدروجين', 'النيتروجين', 'الهيليوم'],
    odd: 'الماء',
    link: 'الأربع عناصر كيميائية نقية في الجدول الدوري، أما الماء فمركّب'
  },
  {
    four: ['المريخ', 'الزهرة', 'عطارد', 'المشتري'],
    odd: 'القمر',
    link: 'الأربع كواكب تدور حول الشمس، والقمر تابع يدور حول الأرض'
  },
  {
    four: ['الأمازون', 'النيل', 'الفرات', 'الدانوب'],
    odd: 'قزوين',
    link: 'الأربع أنهار جارية، أما قزوين فبحر مغلق'
  },
  {
    four: ['العراق', 'الكويت', 'الأردن', 'البحرين'],
    odd: 'عُمان',
    link: 'عملات الدول الأربع تسمى «الدينار»، أما عملة عُمان فهي «الريال»'
  },
  {
    four: ['الأحد', 'الاثنين', 'الأربعاء', 'الخميس'],
    odd: 'الجمعة',
    link: 'الأربع أسماء أيام مشتقة من الأعداد (1، 2، 4، 5)، أما الجمعة فمن الاجتماع'
  },
  {
    four: ['الذهب', 'الفضة', 'النحاس', 'الألمنيوم'],
    odd: 'الخشب',
    link: 'الأربع فلزات موصلة للكهرباء والحرارة، أما الخشب فعازل'
  }
];

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface OddWordRound {
  words: string[]; // 5 كلمات مبعثرة
  oddIdx: number;
  odd: string;
  link: string;
  picked?: number;
  done: boolean;
  won: boolean;
}

export function createOddWordRound(previousOdd?: string): OddWordRound {
  let pool = ODD_WORD_PUZZLES.filter(p => p.odd !== previousOdd);
  if (!pool.length) pool = ODD_WORD_PUZZLES;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  const words = shuffle([...chosen.four, chosen.odd]);
  return {
    words,
    oddIdx: words.indexOf(chosen.odd),
    odd: chosen.odd,
    link: chosen.link,
    done: false,
    won: false
  };
}

export function pickOddWord(round: OddWordRound, idx: number): OddWordRound {
  if (round.done || idx < 0 || idx >= round.words.length) return round;
  const won = idx === round.oddIdx;
  return {
    ...round,
    picked: idx,
    done: true,
    won
  };
}

export const ODD_WORD_POINTS = 10;

export function renderOddWordSolo(round: OddWordRound): string {
  const SEP = '━━━━━━━━━━━━━━━━━━━';
  const lines = [
    `🕵️ *الكلمة الغريبة*`,
    SEP,
    `أمامك *5 كلمات* — أربعٌ منها يجمعها رابط ذكي ومشترك، وواحدة فقط غريبة عنها:`,
    ``,
    round.words.map(w => `🔹 *${w}*`).join('   '),
    ``
  ];

  if (!round.done) {
    lines.push(`🤔 أيّ كلمة هي الغريبة؟`);
  } else if (round.won) {
    lines.push(SEP);
    lines.push(`✅ *إجابة ذكية!* الكلمة الغريبة هي: *${round.odd}*`);
    lines.push(`💡 *الرابط:* ${round.link}`);
    lines.push(`⭐ +${ODD_WORD_POINTS} نقاط`);
  } else {
    lines.push(SEP);
    lines.push(`❌ اخترت: *${round.words[round.picked ?? 0]}*`);
    lines.push(`🎯 الكلمة الغريبة الصحيحة: *${round.odd}*`);
    lines.push(`💡 *الرابط:* ${round.link}`);
  }
  return lines.join('\n');
}

export function oddWordSoloKeyboard(round: OddWordRound): any[][] {
  if (round.done) {
    return [
      [{ text: '🔄 لغز جديد', callback_data: 'ow:new' }],
      [{ text: '🔙 رجوع', callback_data: 'hub:g:odd_word' }]
    ];
  }
  const kb: any[][] = [
    [
      { text: round.words[0], callback_data: 'ow:0' },
      { text: round.words[1], callback_data: 'ow:1' }
    ],
    [
      { text: round.words[2], callback_data: 'ow:2' },
      { text: round.words[3], callback_data: 'ow:3' }
    ],
    [{ text: round.words[4], callback_data: 'ow:4' }],
    [{ text: '🔙 رجوع', callback_data: 'hub:g:odd_word' }]
  ];
  return kb;
}
