/**
 * 🎭 لعبة «خمّن الشاعر»
 * البوت يعرض بيتاً شعرياً مشهوراً، ويطلّع أربعة أسماء لشعراء عرب،
 * واللاعب لازم يعرف منو ناظم البيت.
 */

export interface PoetVerse {
  /** البيت بشطرين (بينهم سطر جديد) */
  verse: string;
  /** ناظم البيت (الجواب الصح) */
  poet: string;
}

/**
 * أبيات مشهورة وناظموها — كلها أبيات معروفة ومنسوبة لصاحبها بلا خلاف.
 * نضيف عليها كل ما نتأكد من بيت جديد.
 */
export const POET_VERSES: PoetVerse[] = [
  { verse: 'على قدرِ أهلِ العزمِ تأتي العزائمُ\nوتأتي على قدرِ الكرامِ المكارمُ', poet: 'المتنبي' },
  { verse: 'الخيلُ والليلُ والبيداءُ تعرفني\nوالسيفُ والرمحُ والقرطاسُ والقلمُ', poet: 'المتنبي' },
  { verse: 'أنا الذي نظرَ الأعمى إلى أدبي\nوأسمعتْ كلماتي من بهِ صممُ', poet: 'المتنبي' },
  { verse: 'وإذا كانتِ النفوسُ كباراً\nتعبتْ في مرادِها الأجسامُ', poet: 'المتنبي' },
  { verse: 'ولم أرَ في عيوبِ الناسِ شيئاً\nكنقصِ القادرينَ على التمامِ', poet: 'المتنبي' },
  { verse: 'وإذا غامرتَ في شرفٍ مرومِ\nفلا تقنعْ بما دونَ النجومِ', poet: 'المتنبي' },
  { verse: 'وزائرتي كأنَّ بها حياءً\nفليس تزورُ إلا في الظلامِ', poet: 'المتنبي' },
  { verse: 'أعزُّ مكانٍ في الدنى سرجُ سابحٍ\nوخيرُ جليسٍ في الزمانِ كتابُ', poet: 'المتنبي' },
  { verse: 'ولقد ذكرتُكِ والرماحُ نواهلٌ\nمني وبيضُ الهندِ تقطرُ من دمي', poet: 'المتنبي' },

  { verse: 'وما نيلُ المطالبِ بالتمنّي\nولكن تُؤخذُ الدنيا غلابا', poet: 'أحمد شوقي' },
  { verse: 'قمْ للمعلّمِ وفِّهِ التبجيلا\nكادَ المعلّمُ أن يكونَ رسولا', poet: 'أحمد شوقي' },
  { verse: 'وطني لو شُغلتُ بالخلدِ عنه\nنازعتني إليه في الخلدِ نفسي', poet: 'أحمد شوقي' },
  { verse: 'سلوا قلبي غداةَ سلا وتابا\nلعلَّ على الجمالِ لهُ عتابا', poet: 'أحمد شوقي' },

  { verse: 'إذا الشعبُ يوماً أرادَ الحياةَ\nفلا بُدَّ أن يستجيبَ القدرْ', poet: 'أبو القاسم الشابي' },
  { verse: 'ومن يتهيّبْ صعودَ الجبالِ\nيعشْ أبدَ الدهرِ بينَ الحُفَرْ', poet: 'أبو القاسم الشابي' },

  { verse: 'ألا ليتَ الشبابَ يعودُ يوماً\nفأخبرهُ بما فعلَ المشيبُ', poet: 'أبو العتاهية' },
  { verse: 'وإنّما الأممُ الأخلاقُ ما بقيتْ\nفإنْ همُ ذهبتْ أخلاقُهم ذهبوا', poet: 'حافظ إبراهيم' },
  { verse: 'الحبُّ في الأرضِ بعضٌ من تخيّلنا\nلو لم نجدْهُ عليها لاخترعناهُ', poet: 'نزار قباني' },
  { verse: 'سجِّلْ! أنا عربي\nورقمُ بطاقتي خمسونَ ألفْ', poet: 'محمود درويش' },
  { verse: 'أحنُّ إلى خبزِ أمي\nوقهوةِ أمي ولمسةِ أمي', poet: 'محمود درويش' },

  { verse: 'ما لي وللنجمِ يرعاني وأرعاهُ\nأمسى كلانا يعافُ الغُمضَ جفناهُ', poet: 'إيليا أبو ماضي' },
  { verse: 'كنْ بلسمًا إن صارَ دهرُكَ أرقما\nوحلاوةً إن صارَ غيرُكَ علقما', poet: 'إيليا أبو ماضي' },

  { verse: 'دعْ عنكَ لومي فإنّ اللومَ إغراءُ\nوداوني بالتي كانتْ هيَ الداءُ', poet: 'أبو نواس' },
  { verse: 'قفا نبكِ من ذكرى حبيبٍ ومنزلِ\nبسقطِ اللوى بينَ الدخولِ فحوملِ', poet: 'امرؤ القيس' },
  { verse: 'شكوتُ إلى وكيعٍ سوءَ حفظي\nفأرشدني إلى تركِ المعاصي', poet: 'الإمام الشافعي' },
  { verse: 'أراكَ عصيَّ الدمعِ شيمتُكَ الصبرُ\nأما للهوى نهيٌ عليكَ ولا أمرُ', poet: 'أبو فراس الحمداني' }
];

/** شعراء إضافيون (وهم ما يطلعون جواب صح) — نخلي الخيارات متنوعة */
const POET_POOL: string[] = [
  'المتنبي',
  'أحمد شوقي',
  'حافظ إبراهيم',
  'أبو القاسم الشابي',
  'أبو العتاهية',
  'نزار قباني',
  'محمود درويش',
  'إيليا أبو ماضي',
  'أبو نواس',
  'امرؤ القيس',
  'الإمام الشافعي',
  'أبو فراس الحمداني',
  'ابن زيدون',
  'جرير',
  'الفرزدق',
  'أبو تمام',
  'البحتري',
  'المعرّي',
  'بشار بن برد',
  'أحمد مطر'
];

export interface PoetRound {
  /** البيت المعروض */
  verse: string;
  /** الجواب الصح */
  poet: string;
  /** الأربعة خيارات */
  options: string[];
  /** الخيارات الغلط اللي ضغطها */
  wrong: number[];
  /** آخر خيار ضغطه */
  picked?: number;
  /** محاولات اللاعب (أقصى شي محاولتين) */
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

/** يبدي بيت جديد (مع تجاهل البيت السابق حتى ما يتكرر عليه) */
export function createRound(previousVerse?: string, previousPoet?: string): PoetRound {
  let pool = POET_VERSES.filter(v => v.verse !== previousVerse);
  if (!pool.length) pool = POET_VERSES;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  const wrongPoets = shuffle(
    POET_POOL.filter(p => p !== chosen.poet && p !== previousPoet)
  ).slice(0, 3);

  return {
    verse: chosen.verse,
    poet: chosen.poet,
    options: shuffle([chosen.poet, ...wrongPoets]),
    wrong: [],
    attempts: 0,
    done: false,
    won: false
  };
}

/** نقاط الجواب: من أول محاولة 10، ومن الثانية 5، وبعدها صفر */
export function pointsFor(round: PoetRound): number {
  if (!round.won) return 0;
  return round.attempts <= 1 ? 10 : 5;
}

/** ضغط اللاعب على خيار */
export function answer(round: PoetRound, index: number): PoetRound {
  if (round.done) return round;
  if (index < 0 || index >= round.options.length) return round;
  if (round.wrong.includes(index)) return round;

  const attempts = round.attempts + 1;
  const correct = round.options[index] === round.poet;

  if (correct) {
    return { ...round, attempts, picked: index, done: true, won: true };
  }

  const wrong = [...round.wrong, index];
  // محاولتين وبس — بعدها نكشف الجواب
  return {
    ...round,
    attempts,
    wrong,
    picked: index,
    done: attempts >= 2,
    won: false
  };
}

/** نص الرسالة (البيت + الخيارات أو النتيجة) */
export function renderMessage(round: PoetRound): string {
  const lines = [`🎭 *خمّن الشاعر*`, `━━━━━━━━━━━━━━━━━━━`];
  lines.push(`❝ ${round.verse} ❞`);
  lines.push(`━━━━━━━━━━━━━━━━━━━`);

  if (!round.done) {
    lines.push(`👤 من قائل هذا البيت؟`);
    lines.push(round.attempts === 0 ? `_عندك محاولتان_` : `_بقيت لك محاولة واحدة_ ⏳`);
  } else if (round.won) {
    lines.push(`✅ *الجواب:* ${round.poet}`);
    lines.push(`🎉 عرفتها!`);
  } else {
    lines.push(`❌ *الجواب الصح:* ${round.poet}`);
    lines.push(`😅 المرة الجاية!`);
  }

  return lines.join('\n');
}

/** أزرار اللعبة */
export function keyboard(round: PoetRound): any[][] {
  if (round.done) {
    return [
      [{ text: '🔄 بيت جديد', callback_data: 'po:new' }],
      [{ text: '🔙 رجوع', callback_data: 'hub:g:poet' }]
    ];
  }

  const rows: any[][] = round.options.map((poet, i) => [
    {
      text: `${round.wrong.includes(i) ? '❌ ' : ''}${poet}`,
      callback_data: round.wrong.includes(i) ? 'po:noop' : `po:${i}`
    }
  ]);
  rows.push([{ text: '🔙 رجوع', callback_data: 'hub:g:poet' }]);
  return rows;
}
