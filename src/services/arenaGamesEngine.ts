import { GENERAL, GEOGRAPHY, HISTORY, NUMBERS } from './groupQuizData';
import {
  ISLAMIC_HERITAGE,
  SCIENCE_SPACE,
  ANIMALS_NATURE,
  TECH_GAMING,
  DIALECTS_MEANINGS,
  FOOTBALL_DEEP,
  EMOJI_MATH
} from './fastAndGuessBanks';
import { md, scoreLine } from './groupGamesEngine';

/**
 * 🏟️ محرك الألعاب التفاعلية المتكاملة (25 لعبة جماعية وثنائية وفرق 2v2 / 3v3 / 4v4)
 * متوافق بالكامل مع القنوات والمجموعات وCloudflare Durable Objects (حفظ/استرجاع + مؤقت 15 ثانية).
 */

export type ArenaMode =
  // 🎉 جماعية (2 - 10 لاعبين)
  | 'hot_potato'
  | 'memory_colors'
  | 'memory_words'
  | 'closest_num'
  // 👥 ثنائية 1v1
  | 'battleship_1v1'
  | 'cowboy_duel'
  | 'football_1v1'
  | 'split_steal'
  | 'tactical_dice'
  | 'mines_1v1'
  // ⚔️ فرق 2v2
  | 'double_quiz'
  | 'half_story'
  | 'football_2v2'
  | 'battleship_2v2'
  | 'bomb_defuse'
  | 'telepathy_2v2'
  // 🔥 فرق 3v3
  | 'three_castles'
  | 'telepathy_3v3'
  | 'king_hill_3v3'
  | 'tactics_3v3'
  // 🏰 فرق 4v4
  | 'clan_war_4v4'
  | 'tug_war_4v4'
  | 'golden_grid_4v4'
  | 'courtroom_4v4'
  | 'knockout_all_4v4';

export interface ArenaModeMeta {
  mode: ArenaMode;
  shortCode: string;
  emoji: string;
  title: string;
  category: 'group' | 'duo' | 'team' | 'team3' | 'team4';
  minPlayers: number;
  maxPlayers: number;
  teamSize?: number; // 2 أو 3 أو 4 لألعاب الفرق
  playersLabel: string;
  goal: string;
  reward: string;
  about: string;
}

export const ARENA_MODES: Record<ArenaMode, ArenaModeMeta> = {
  // ─────────────── 🎉 الجماعية ───────────────
  hot_potato: {
    mode: 'hot_potato',
    shortCode: 'hp',
    emoji: '💣',
    title: 'القنبلة الموقوتة',
    category: 'group',
    minPlayers: 2,
    maxPlayers: 10,
    playersLabel: 'من لاعبين إلى 10 لاعبين',
    goal: 'تمرير القنبلة بالإجابة الصحيحة والبقاء آخر ناجٍ في الحلبة',
    reward: 'جوائز وخبرة للناجي الأخير',
    about:
      'تنتقل القنبلة المشتعلة بين اللاعبين عشوائياً.\n' +
      'اللاعب الذي بيده القنبلة عليه الإجابة بشكل صحيح خلال 15 ثانية ليمرّرها لغيره، ومن يخطئ أو ينتهي وقته تنفجر بيده ويخرج حتى يبقى فائز واحد!'
  },
  memory_colors: {
    mode: 'memory_colors',
    shortCode: 'memc',
    emoji: '🎨',
    title: 'ذاكرة الألوان',
    category: 'group',
    minPlayers: 2,
    maxPlayers: 10,
    playersLabel: 'من لاعبين إلى 10 لاعبين',
    goal: 'حفظ ترتيب الألوان المكشوفة وتذكّر مواقعها بدقة',
    reward: 'نقطة لكل ذاكرة صحيحة وجوائز للمتصدر',
    about:
      'تظهر لوحة ألوان متتابعة أمام اللاعبين لبضع ثوانٍ ثم تختفي.\n' +
      'بعد إخفائها يُسأل الجميع عن لون موقع محدّد خلال 15 ثانية، وأقوى ذاكرة في ختام 6 جولات يفوز!'
  },
  memory_words: {
    mode: 'memory_words',
    shortCode: 'memw',
    emoji: '📝',
    title: 'ذاكرة الكلمات',
    category: 'group',
    minPlayers: 2,
    maxPlayers: 10,
    playersLabel: 'من لاعبين إلى 10 لاعبين',
    goal: 'حفظ الكلمات المعروضة وتذكّر ترتيبها بعد اختفائها',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about:
      'تُكشف قائمة من 6 كلمات مرقّمة لبضع ثوانٍ ثم تُطوى اللوحة.\n' +
      'في كل جولة يختبر البوت ذاكرتكم حول الكلمة التي كانت في رقم معيّن خلال 15 ثانية!'
  },
  closest_num: {
    mode: 'closest_num',
    shortCode: 'cnum',
    emoji: '🎯',
    title: 'أقرب رقم',
    category: 'group',
    minPlayers: 2,
    maxPlayers: 10,
    playersLabel: 'من لاعبين إلى 10 لاعبين',
    goal: 'إعطاء أقرب تخمين رقمي للإجابة الحقيقية',
    reward: 'نقطتان لأقرب تخمين في كل جولة وجوائز للمتصدر',
    about:
      'يطرح البوت سؤالاً رقمياً شيّقاً ويقدّم اللاعبون تخمينهم عبر الكتابة بالخاص أو الأزرار التقديرية خلال 15 ثانية.\n' +
      'أقرب لاعب للرقم الحقيقي في كل جولة يحصد نقطتي الجولة!'
  },

  // ─────────────── 👥 الثنائية 1v1 ───────────────
  battleship_1v1: {
    mode: 'battleship_1v1',
    shortCode: 'bs1',
    emoji: '🚢',
    title: 'حرب السفن',
    category: 'duo',
    minPlayers: 2,
    maxPlayers: 2,
    playersLabel: 'لاعبان (1 ضد 1)',
    goal: 'قصف وإغراق سفن الخصم الثلاث قبل أن يُغرق أسطولك',
    reward: 'جوائز وخبرة لقائد الأسطول الفائز',
    about:
      'يمتلك كل قائد أسطولاً سرّياً مكوّناً من 3 سفن حربية مخفية تحت الأمواج.\n' +
      'يتناوب اللاعبان قصف الإحداثيات البحرية، ومن يُغرق سفن خصمه الثلاث أولاً يحسم المعركة!'
  },
  cowboy_duel: {
    mode: 'cowboy_duel',
    shortCode: 'cow',
    emoji: '🤠',
    title: 'حرب الكاوبوي',
    category: 'duo',
    minPlayers: 2,
    maxPlayers: 2,
    playersLabel: 'لاعبان (1 ضد 1)',
    goal: 'إطلاق النار أسرع من خصمك فور ظهور إشارة الانطلاق',
    reward: 'جوائز وخبرة لأسرع رامٍ في الغرب',
    about:
      'مواجهة سرعة أعصاب من 5 جولات حاسمة.\n' +
      'انتبه: من يضغط قبل ظهور إشارة «🔥 أطلق الآن!» يخسر الجولة فوراً بالتسرّع، ومن يضغط أولاً بعد الإشارة يكسب النقطة!'
  },
  football_1v1: {
    mode: 'football_1v1',
    shortCode: 'fb1',
    emoji: '⚽',
    title: 'كرة القدم',
    category: 'duo',
    minPlayers: 2,
    maxPlayers: 2,
    playersLabel: 'لاعبان (1 ضد 1)',
    goal: 'تسجيل أهداف أكثر من خصمك في ركلات الترجيح',
    reward: 'جوائز وخبرة لبطل ركلات الترجيح',
    about:
      'تحدي ركلات جزاء ترجيحية مثير من 6 ركلات بالتناوب.\n' +
      'يختار المسدّد زاوية التسديد (يسار / وسط / يمين) سرّاً، بينما يتوقع الحارس الزاوية لصدّ الكرة!'
  },
  split_steal: {
    mode: 'split_steal',
    shortCode: 'sos',
    emoji: '💼',
    title: 'صفقة أو خدعة',
    category: 'duo',
    minPlayers: 2,
    maxPlayers: 2,
    playersLabel: 'لاعبان (1 ضد 1)',
    goal: 'جمع أعلى رصيد عبر قراءة نوايا خصمك بين التعاون والخداع',
    reward: 'جوائز وخبرة لصاحب الدهاء الأعلى',
    about:
      'مواجهة نفسية من 5 جولات: في كل جولة يختار الطرفان سرّاً بين «🤝 صفقة» أو «😈 خدعة».\n' +
      'إذا اتفقا على الصفقة يكسب كل منهما +2، وإذا خدع أحدهما الآخر يخطف +4 وحده، وإذا خدع كلاهما يخرجان بصفر!'
  },
  tactical_dice: {
    mode: 'tactical_dice',
    shortCode: 'dice',
    emoji: '🎲',
    title: 'النرد التكتيكي',
    category: 'duo',
    minPlayers: 2,
    maxPlayers: 2,
    playersLabel: 'لاعبان (1 ضد 1)',
    goal: 'الوصول إلى 35 نقطة مثبّتة قبل الخصم',
    reward: 'جوائز وخبرة للفائز بالسباق التكتيكي',
    about:
      'في دورك ارمِ النرد لتجمع النقاط في سلّة الجولة، أو اضغط «ثبّت الرصيد» لحفظها في بنكك.\n' +
      'حذارِ: إذا ظهر الرقم 1 تضيع نقاط جولتك غير المثبّتة وينتقل الدور لخصمك!'
  },
  mines_1v1: {
    mode: 'mines_1v1',
    shortCode: 'mine',
    emoji: '💣',
    title: 'حقل الألغام',
    category: 'duo',
    minPlayers: 2,
    maxPlayers: 2,
    playersLabel: 'لاعبان (1 ضد 1)',
    goal: 'تفادي الألغام المخفية وفتح المربعات الآمنة بذكاء',
    reward: 'جوائز وخبرة للناجي من حقل الألغام',
    about:
      'لوحة 4×4 تضم 4 ألغام مخفية ومربعات تكشف عدد الألغام المجاورة لها.\n' +
      'يتناوب اللاعبان فتح المربعات، ومن ينفجر به اللغم يمنح التقدّم لمنافسه!'
  },

  // ─────────────── ⚔️ فرق 2v2 ───────────────
  double_quiz: {
    mode: 'double_quiz',
    shortCode: 'dquiz',
    emoji: '⚡',
    title: 'دبل كويز',
    category: 'team',
    minPlayers: 4,
    maxPlayers: 4,
    teamSize: 2,
    playersLabel: '4 لاعبين — فريقان (2 ضد 2)',
    goal: 'تحقيق إجابات مزدوجة متزامنة لزميلي الفريق الواحد',
    reward: 'جوائز وخبرة للفريق الفائز',
    about:
      'مواجهة ثقافية سريعة بين الفريق الأزرق 🔵 والفريق الأحمر 🔴 من 6 جولات.\n' +
      'إذا أجاب أحد الزميلين صح يكسب الفريق نقطة، وإذا أصاب الزميلان معاً يكسب الفريق 3 نقاط مضاعفة!'
  },
  half_story: {
    mode: 'half_story',
    shortCode: 'half',
    emoji: '🧩',
    title: 'نص السالفة',
    category: 'team',
    minPlayers: 4,
    maxPlayers: 4,
    teamSize: 2,
    playersLabel: '4 لاعبين — فريقان (2 ضد 2)',
    goal: 'دمج نصفي التلميح السري بين الزميلين للوصول إلى الجواب الصحيح',
    reward: 'جوائز وخبرة للفريق الأسرع استنتاجاً',
    about:
      'يستلم اللاعب الأول في كل فريق النصف الأول من التلميح، ويستلم زميله النصف الثاني بنافذة سرّية.\n' +
      'بتكامل الاستنتاج بين الزميلين يحصد الفريق النقاط عبر 6 جولات!'
  },
  football_2v2: {
    mode: 'football_2v2',
    shortCode: 'fb2',
    emoji: '⚽',
    title: 'كرة قدم زوجية',
    category: 'team',
    minPlayers: 4,
    maxPlayers: 4,
    teamSize: 2,
    playersLabel: '4 لاعبين — فريقان (مهاجم + حارس لكل فريق)',
    goal: 'التسجيل بمهاجم الفريق والتصدي بحارسه لحسم المباراة',
    reward: 'جوائز وخبرة للفريق البطل',
    about:
      'في كل فريق لاعب يتولى الهجوم والتسديد ولاعب يتولى حراسة المرمى، مع تبادل الأدوار عبر 6 ركلات حاسمة!'
  },
  battleship_2v2: {
    mode: 'battleship_2v2',
    shortCode: 'bs2',
    emoji: '🚢',
    title: 'حرب السفن الزوجية',
    category: 'team',
    minPlayers: 4,
    maxPlayers: 4,
    teamSize: 2,
    playersLabel: '4 لاعبين — فريقان (2 ضد 2)',
    goal: 'تدمير سفن الفريق الخصم الأربع بالتناوب بين زميلي الأسطول',
    reward: 'جوائز وخبرة للأسطول المنتصر',
    about:
      'معركة بحرية للفرق الثنائية: يتناوب قادة الفريقين قصف مربعات العدو حتى إغراق جميع سفنه الأربع!'
  },
  bomb_defuse: {
    mode: 'bomb_defuse',
    shortCode: 'defuse',
    emoji: '💣',
    title: 'تفكيك القنبلة التعاوني',
    category: 'team',
    minPlayers: 4,
    maxPlayers: 4,
    teamSize: 2,
    playersLabel: '4 لاعبين — فريقان (خبير + مفكّك لكل فريق)',
    goal: 'قراءة شيفرة الدليل السري وقطع السلك الصحيح قبل الفريق المنافس',
    reward: 'جوائز وخبرة لفريق الهندسة الفائز',
    about:
      'يفتح خبير الفريق «دليل الأسلاك السري» ليعرف السلك الآمن، بينما يقطع زميله السلك الصحيح عبر 5 قنابل متتالية!'
  },
  telepathy_2v2: {
    mode: 'telepathy_2v2',
    shortCode: 'tel2',
    emoji: '🔮',
    title: 'التخاطر الزوجي',
    category: 'team',
    minPlayers: 4,
    maxPlayers: 4,
    teamSize: 2,
    playersLabel: '4 لاعبين — فريقان (2 ضد 2)',
    goal: 'اختيار نفس الخيار تماماً مع زميلك دون أي اتفاق مسبق',
    reward: 'جوائز وخبرة للفريق الأعلى تخاطراً',
    about:
      'يُطرح موضوع في كل جولة مع 4 خيارات متقاربة؛ لا توجد إجابة خاطئة، بل يفوز الفريق بنقطتي الجولة عندما يختار الزميلان نفس الزر بالضبط!'
  },

  // ─────────────── 🔥 ثلاثية 3v3 ───────────────
  three_castles: {
    mode: 'three_castles',
    shortCode: 'cas3',
    emoji: '🏰',
    title: 'احتلال القلاع الثلاث',
    category: 'team3',
    minPlayers: 6,
    maxPlayers: 6,
    teamSize: 3,
    playersLabel: '6 لاعبين — فريقان (3 ضد 3)',
    goal: 'السيطرة على قلعتين على الأقل من أصل 3 قلاع في كل جولة',
    reward: 'جوائز وخبرة للجيش الفاتح',
    about:
      'يخوض كل لاعب من الفريق مواجهة مباشرة على قلعته (قلعة الثقافة، قلعة التاريخ والجغرافيا، قلعة الذكاء)، والفريق الذي يفتح قلعتين أو أكثر يكسب راية الجولة!'
  },
  telepathy_3v3: {
    mode: 'telepathy_3v3',
    shortCode: 'tel3',
    emoji: '🔺',
    title: 'التخاطر الثلاثي',
    category: 'team3',
    minPlayers: 6,
    maxPlayers: 6,
    teamSize: 3,
    playersLabel: '6 لاعبين — فريقان (3 ضد 3)',
    goal: 'توحيد اختيار أعضاء الفريق الثلاثة على نفس الخيار سرّاً',
    reward: 'جوائز وخبرة للفريق الأعلى انسجاماً',
    about:
      'إذا تطابق اختيار الأعضاء الثلاثة جميعاً يحصد الفريق 4 نقاط كاملة، وإذا تطابق اثنان يحصد نقطة توافق!'
  },
  king_hill_3v3: {
    mode: 'king_hill_3v3',
    shortCode: 'koh3',
    emoji: '⚔️',
    title: 'البقاء للأقوى',
    category: 'team3',
    minPlayers: 6,
    maxPlayers: 6,
    teamSize: 3,
    playersLabel: '6 لاعبين — فريقان إقصائيان (3 ضد 3)',
    goal: 'إقصاء مقاتلي الفريق المنافس الثلاثة واحداً تلو الآخر',
    reward: 'جوائز وخبرة للفريق الصامد في الحلبة',
    about:
      'يدخل المقاتل الأول من كل فريق إلى الحلبة؛ الفائز يبقى صامداً والخاسر يخرج ليدخل زميله التالي حتى يُقصى جميع مقاتلي الخصم!'
  },
  tactics_3v3: {
    mode: 'tactics_3v3',
    shortCode: 'tac3',
    emoji: '🛡️',
    title: 'هجوم ودفاع ومناورة',
    category: 'team3',
    minPlayers: 6,
    maxPlayers: 6,
    teamSize: 3,
    playersLabel: '6 لاعبين — فريقان تكتيكيان (3 ضد 3)',
    goal: 'التفوّق في الخطوط الثلاثة عبر اختيار التكتيك المضاد لتشكيلة العدو',
    reward: 'جوائز وخبرة للفريق الأذكى تكتيكياً',
    about:
      'يختار كل مقاتل سرّاً وضعه القتالي: الهجوم ⚔️ يكسر المناورة 🌀، والمناورة 🌀 تخترق الدفاع 🛡️، والدفاع 🛡️ يصدّ الهجوم ⚔️!'
  },

  // ─────────────── 🏰 رباعية 4v4 ───────────────
  clan_war_4v4: {
    mode: 'clan_war_4v4',
    shortCode: 'clan4',
    emoji: '🏆',
    title: 'معركة العشائر',
    category: 'team4',
    minPlayers: 8,
    maxPlayers: 8,
    teamSize: 4,
    playersLabel: '8 لاعبين — عشيرتان (4 ضد 4)',
    goal: 'جمع أعلى مجموع نقاط للعشيرة عبر 6 جولات ملحمية',
    reward: 'جوائز وخبرة للعشيرة المنتصرة',
    about:
      'ملحمة معرفة وسرعة بين 4 مقاتلين في العشيرة الزرقاء 🔵 و4 مقاتلين في العشيرة الحمراء 🔴، مع نقطة إضافية لأسرع محارب يصيب في كل جولة!'
  },
  tug_war_4v4: {
    mode: 'tug_war_4v4',
    shortCode: 'tug4',
    emoji: '🪢',
    title: 'شد الحبل',
    category: 'team4',
    minPlayers: 8,
    maxPlayers: 8,
    teamSize: 4,
    playersLabel: '8 لاعبين — فريقان (4 ضد 4)',
    goal: 'سحب راية الحبل بالكامل نحو معسكر فريقك بالإجابات السريعة الصحيحة',
    reward: 'جوائز وخبرة للفريق الأقوى سحباً',
    about:
      'كل إجابة صحيحة من عضو في فريقك تسحب الحبل خطوة باتجاهكم، والخطأ يزلق الحبل خطوة للخصم — اسحبوا الحبل للنهاية لحسم الفوز!'
  },
  golden_grid_4v4: {
    mode: 'golden_grid_4v4',
    shortCode: 'grid4',
    emoji: '🟨',
    title: 'المربعات الذهبية',
    category: 'team4',
    minPlayers: 8,
    maxPlayers: 8,
    teamSize: 4,
    playersLabel: '8 لاعبين — فريقان (4 ضد 4)',
    goal: 'احتلال أكبر عدد من المربعات الذهبية أو تكوين خط متصل من 4 مربعات',
    reward: 'جوائز وخبرة للفريق المسيطر على اللوحة',
    about:
      'لوحة 4×4 من المربعات الذهبية؛ يختار الفريق المربع ويجيب عن سؤاله لاحتلاله بلون فريقه، وأول فريق يكوّن خطاً كاملاً أو يحصد أغلبية المربعات يفوز!'
  },
  courtroom_4v4: {
    mode: 'courtroom_4v4',
    shortCode: 'court4',
    emoji: '⚖️',
    title: 'المحكمة',
    category: 'team4',
    minPlayers: 8,
    maxPlayers: 8,
    teamSize: 4,
    playersLabel: '8 لاعبين — هيئة ادّعاء وهيئة تحقيق (4 ضد 4)',
    goal: 'تحليل الأدلة الأربعة الموزّعة على أعضاء الفريق وإدانة الجاني الحقيقي',
    reward: 'جوائز وخبرة لهيئة التحقيق الأبرع',
    about:
      'في كل قضية تتوزع 4 قرائن سرّية على أعضاء الفريق الأربعة؛ افتح قرينتك وصوّت لإدانة المشتبه به الحقيقي!'
  },
  knockout_all_4v4: {
    mode: 'knockout_all_4v4',
    shortCode: 'ko4',
    emoji: '🔥',
    title: 'الجولة القاضية',
    category: 'team4',
    minPlayers: 8,
    maxPlayers: 8,
    teamSize: 4,
    playersLabel: '8 لاعبين — فريقان (4 ضد 4)',
    goal: 'تحقيق علامة كاملة 4/4 لتوجيه ضربة قاضية تحطّم قلوب الفريق المنافس',
    reward: 'جوائز وخبرة للفريق صاحب الضربات القاضية',
    about:
      'يبدأ كل فريق بـ 3 قلوب ❤️❤️❤️؛ إذا أصاب أعضاء الفريق الأربعة معاً تنطلق الضربة القاضية وتُسقط قلباً كاملاً من الخصم!'
  }
};

export function findArenaModeByShort(code: string): ArenaMode | undefined {
  const c = String(code || '').trim().toLowerCase();
  return (Object.keys(ARENA_MODES) as ArenaMode[]).find(
    k => ARENA_MODES[k].shortCode === c || k === c
  );
}

export interface ArenaPlayer {
  id: string;
  name: string;
  team?: 'blue' | 'red';
  score: number;
  alive: boolean;
  done: boolean;
  choice?: number;
  guessNum?: number;
  roundHit?: boolean;
}

export interface ArenaGame {
  id: string;
  chatId: string;
  chatName: string;
  mode: ArenaMode;
  messageId?: number;
  inlineMessageId?: string;
  status: 'lobby' | 'memorize' | 'arming' | 'playing' | 'result' | 'game_over';
  players: ArenaPlayer[];
  round: number;
  totalRounds: number;
  turnIdx: number;
  activeTeam: 'blue' | 'red';
  blueScore: number;
  redScore: number;
  blueHearts: number;
  redHearts: number;
  ropePos: number; // من -5 (فوز أزرق) إلى +5 (فوز أحمر)
  pot: number; // للنرد التكتيكي
  lastRoll?: number;
  prompt: string;
  options: string[];
  correctIdx: number;
  secretClues: string[]; // أنصاف التلميحات / أدلة المحكمة / دليل القنبلة
  targetNumber?: number;
  memItems: string[];
  // شبكات 4x4 (حرب السفن / حقل الألغام / المربعات الذهبية)
  blueGrid: number[]; // 0 فارغ، 1 سفينة، 2 إصابة، 3 ماء
  redGrid: number[];
  sharedGrid: number[]; // للألغام أو المربعات الذهبية: -1 لغم، 0..8 آمن / ملكية 0=ذهب 1=أزرق 2=أحمر
  revealedGrid: boolean[];
  selectedCell?: number;
  castleQuestions?: { q: string; opts: string[]; ans: number }[];
  blueFighterIdx: number;
  redFighterIdx: number;
  holderIdx: number;
  lastSummary: string;
  deadline?: number;
  winnerSide?: 'blue' | 'red' | 'player';
  winnerIds: string[];
  rewarded?: boolean;
  createdAt: number;
}

// =====================================================================
// 📚 بنوك بيانات خاصة بالألعاب التفاعلية
// =====================================================================

const COLOR_EMOJIS = ['🟥', '🟦', '🟩', '🟨', '🟪', '🟧'];
const COLOR_NAMES = ['أحمر 🟥', 'أزرق 🟦', 'أخضر 🟩', 'أصفر 🟨', 'بنفسجي 🟪', 'برتقالي 🟧'];

const MEMORY_WORD_POOL = [
  'نخلة', 'دجلة', 'قمر', 'سيف', 'ياقوت', 'فانوس', 'سفينة', 'قلعة',
  'صقر', 'مفتاح', 'مرآة', 'ذهب', 'بوصلة', 'شراع', 'منارة', 'تاج',
  'غزال', 'لؤلؤ', 'جبل', 'سحاب', 'برق', 'واحة', 'مزمار', 'درع'
];

const CLOSEST_NUM_BANK: [string, number][] = [
  ['كم متراً يبلغ الارتفاع الرسمي لقمة جبل إيفرست؟', 8849],
  ['كم كيلومتراً يبلغ طول نهر دجلة تقريباً من منبعه حتى القرنة؟', 1850],
  ['في أي عام ميلادي سقطت بغداد على يد هولاكو؟', 1258],
  ['كم عظمة توجد في الهيكل العظمي للإنسان البالغ؟', 206],
  ['كم يوماً يستغرق كوكب المريخ لإتمام دورة كاملة حول الشمس؟', 687],
  ['كم متراً يبلغ ارتفاع برج خليفة في دبي؟', 828],
  ['في أي عام أُغرقَت سفينة تايتانيك الشهيرة؟', 1912],
  ['كم كيلوغراماً يبلغ وزن جرس ساعة بيغ بن الشهير تقريباً؟', 13760],
  ['كم متراً يبلغ ارتفاع ملوية سامراء الأثرية تقريباً؟', 52],
  ['في أي عام بُنيت مدينة بغداد المدوّرة على يد أبي جعفر المنصور؟', 762],
  ['كم ثانية توجد في الساعة الواحدة؟', 3600],
  ['كم كيلومتراً يبلغ قطر كوكب الأرض عند خط الاستواء تقريباً؟', 12756],
  ['كم مفتاحاً أبيض وأسود يوجد في البيانو القياسي الكامل؟', 88],
  ['في أي عام هبط أول إنسان على سطح القمر (أبولو 11)؟', 1969]
];

const HALF_STORY_BANK: { a: string; b: string; ans: string; wrongs: [string, string, string] }[] = [
  { a: 'عاصمة عربية عريقة يشقّها نهر عظيم', b: 'بناها الخليفة المنصور وتشتهر بشارع المتنبي', ans: 'بغداد', wrongs: ['دمشق', 'القاهرة', 'الرباط'] },
  { a: 'عنصر كيميائي ثمين لا يصدأ أبداً', b: 'رمزه الكيميائي في الجدول الدوري هو Au', ans: 'الذهب', wrongs: ['الفضة', 'البلاتين', 'النحاس'] },
  { a: 'كائن بحري عجيب يمتلك ثلاثة قلوب', b: 'دمه أزرق ولديه ثماني أذرع مرنة', ans: 'الأخطبوط', wrongs: ['الدلفين', 'القرش', 'نجم البحر'] },
  { a: 'كوكب في مجموعتنا الشمسية يُلقّب بالكوكب الأحمر', b: 'يدور حوله القمران فوبوس وديموس', ans: 'المريخ', wrongs: ['زحل', 'عطارد', 'المشتري'] },
  { a: 'أكلة عراقية تراثية تُحضّر على نار هادئة عند النهر', b: 'قوامها السمك المشوي بخشب الطرفة', ans: 'المسكوف', wrongs: ['الدولمة', 'القوزي', 'البرياني'] },
  { a: 'معلم أندلسي تاريخي في جنوب إسبانيا', b: 'يطل على غرناطة ويشتهر ببهو الأسود', ans: 'قصر الحمراء', wrongs: ['تاج محل', 'آيا صوفيا', 'برج بيزا'] },
  { a: 'مخترع وعالم فيزياء وكهرباء صربي أمريكي', b: 'ابتكر نظام التيار المتردد AC وملفّاته الشهيرة', ans: 'نيكولا تسلا', wrongs: ['توماس إديسون', 'أينشتاين', 'فاراداي'] },
  { a: 'أكبر جزيرة غير قارية في العالم بأسره', b: 'يغطي الجليد معظم مساحتها وتتبع مملكة الدنمارك', ans: 'غرينلاند', wrongs: ['مدغشقر', 'آيسلندا', 'سومطرة'] }
];

const BOMB_MODULES: { rule: string; label: string; correctWire: number }[] = [
  { label: '⚡ الشيفرة 7391 • المؤشر يومض باللون الأصفر', rule: '📖 القاعدة السرية: إذا كان آخر رقم فردياً (1) اقطع السلك الأزرق 🔵 فوراً!', correctWire: 1 },
  { label: '⚡ الشيفرة 4820 • البطارية المزدوجة نشطة', rule: '📖 القاعدة السرية: إذا انتهت الشيفرة بصفر اقطع السلك الأخضر 🟢 فوراً!', correctWire: 2 },
  { label: '⚡ الشيفرة 9554 • جرس الإنذار مرتفع', rule: '📖 القاعدة السرية: عند تكرر الرقم 5 في الوسط اقطع السلك الأحمر 🔴 فوراً!', correctWire: 0 },
  { label: '⚡ الشيفرة 2068 • جميع الأرقام زوجية', rule: '📖 القاعدة السرية: إذا كانت كل الأرقام زوجية اقطع السلك الأصفر 🟡 فوراً!', correctWire: 3 },
  { label: '⚡ الشيفرة 6137 • المؤشر الحراري مستقر', rule: '📖 القاعدة السرية: إذا كان مجموع أول رقمين 7 اقطع السلك الأزرق 🔵 فوراً!', correctWire: 1 },
  { label: '⚡ الشيفرة 3319 • النبضة الكهرومغناطيسية عالية', rule: '📖 القاعدة السرية: إذا بدأت الشيفرة بـ 33 اقطع السلك الأخضر 🟢 فوراً!', correctWire: 2 }
];

const TELEPATHY_PROMPTS: { q: string; opts: [string, string, string, string] }[] = [
  { q: '☀️ أول شي يجي ببالك من نقول «صيف العراق»؟', opts: ['❄️ السبلت', '🍉 الرگي البارد', '🏊 المسبح', '🌙 السهر بالليل'] },
  { q: '☕ مشروبك المثالي بوقت الاستراحة؟', opts: ['🍵 استكان شاي مهيل', '☕ قهوة مختصة', '🧃 عصير طبيعي بارد', '🥛 لبن عيران'] },
  { q: '✈️ لو ربحت تذكرة سفر هسة وين تطير أول؟', opts: ['🇯🇵 طوكيو', '🇹🇷 إسطنبول', '🇨🇭 سويسرا', '🇲🇻 المالديف'] },
  { q: '🍽️ عزيمة الجمعة الأسطورية شنو لازم تكون؟', opts: ['🐟 مسكوف عالنار', '🍲 دولمة حامضة', '🍖 مندي وقوزي', '🍢 كباب عراقي'] },
  { q: '🎬 سهرة الفيلم الأحلى تكون أي تصنيف؟', opts: ['🕵️ غموض وتحقيق', '😂 كوميديا تضحك', '💥 أكشن وحماس', '👻 رعب وتوتر'] },
  { q: '🏆 أهم صفة بالصديق الحقيقي برأيك؟', opts: ['🤝 الوفاء بالمواقف', '😂 خفة الدم', '🤫 كتمان السر', '🧠 النصيحة الذكية'] },
  { q: '🌧️ أول ما تمطر الدنيا شنو تسوي؟', opts: ['☕ شاي گدام الشباك', '🚗 فرّة بالسيارة', '📸 أصوّر الغيوم', '😴 نومة دافية'] },
  { q: '🦁 لو تختار رمز قوة يمثّل فريقكم؟', opts: ['🦅 الصقر الجارح', '🦁 الأسد المهيب', '🐺 الذئب الذكي', '🐉 التنين الناري'] }
];

const COURTROOM_CASES: {
  story: string;
  suspects: [string, string, string, string];
  culprit: number;
  clues: [string, string, string, string];
}[] = [
  {
    story: '⚖️ سُرقت ياقوتة المتحف عند الساعة 10:00 مساءً تماماً أثناء انقطاع الكهرباء لثلاث دقائق!',
    suspects: ['الحارس نديم', 'المرمّم سامر', 'الأمينة رنا', 'السائق طارق'],
    culprit: 1,
    clues: [
      '🔎 قرينة 1: السارق فتح الخزنة برمزها الهندسي الدقيق دون أي كسر.',
      '🔎 قرينة 2: الحارس نديم والسائق طارق ظهرا معاً بكاميرا البوابة الخارجية طوال الانقطاع.',
      '🔎 قرينة 3: وُجد أثر طلاء ترميم أزرق نادر على مقبض الخزنة الداخلي.',
      '🔎 قرينة 4: الأمينة رنا غادرت المبنى رسمياً في الساعة 8:30 مساءً وسلمت مفاتيحها.'
    ]
  },
  {
    story: '⚖️ اختفت الوثيقة السرية من مكتب المدير في الطابق الخامس وقت الغداء!',
    suspects: ['المحاسب فؤاد', 'السكرتير مازن', 'المهندسة سلمى', 'المراسل كرم'],
    culprit: 3,
    clues: [
      '🔎 قرينة 1: بطاقة الدخول الإلكترونية استُخدمت في الساعة 1:15 ظهراً.',
      '🔎 قرينة 2: المحاسب فؤاد والمهندسة سلمى كانا في اجتماع مصوّر خارج الشركة.',
      '🔎 قرينة 3: السكرتير مازن نسي بطاقته على مكتبه قرب عربة البريد الداخلية.',
      '🔎 قرينة 4: رصدت كاميرا المصعد حاملاً حقيبة بريد كبيرة يخرج مسرعاً الساعة 1:18!'
    ]
  },
  {
    story: '⚖️ تبيّن استبدال اللوحة الأصلية في المعرض بنسخة مقلّدة متقنة قبل الافتتاح!',
    suspects: ['التاجر وائل', 'الرسام رامي', 'المنسّقة هالة', 'فني الإضاءة إياد'],
    culprit: 1,
    clues: [
      '🔎 قرينة 1: النسخة المقلّدة مرسومة بنفس خلطة الألوان الزيتية النادرة جداً.',
      '🔎 قرينة 2: التاجر وائل وصل المطار بعد الحادثة بساعتين بختم جواز رسمي.',
      '🔎 قرينة 3: وُجدت فاتورة إطار مطابق تماماً باسم ورشة خاصة للفنون.',
      '🔎 قرينة 4: المنسّقة هالة وفني الإضاءة كانا في قاعة المؤتمرات مع الصحفيين.'
    ]
  },
  {
    story: '⚖️ تعطّل محرّك سيارة السباق عمداً قبل انطلاق الجولة النهائية بدقائق!',
    suspects: ['الميكانيكي زيد', 'المنافس لؤي', 'المدير حازم', 'المصوّر نبيل'],
    culprit: 0,
    clues: [
      '🔎 قرينة 1: العطل تم بفك صمّام داخلي لا يعرف مكانه إلا خبير محركات محترف.',
      '🔎 قرينة 2: المنافس لؤي كان داخل سيارته مربوط الحزام تحت مراقبة الحكّام.',
      '🔎 قرينة 3: عُثر على مفتاح الربط الخاص مخبأً في خزانة الصيانة رقم 3.',
      '🔎 قرينة 4: الخزانة رقم 3 مسجّلة حصراً باسم مسؤول صيانة المحرّك!'
    ]
  },
  {
    story: '⚖️ تسربت أسئلة المسابقة الكبرى قبل إعلانها بساعة واحدة من غرفة الكنترول!',
    suspects: ['المراقب عادل', 'المطبعي وسام', 'المشرفة دينا', 'الحارس جاسم'],
    culprit: 1,
    clues: [
      '🔎 قرينة 1: الصور المسربة التُقطت للنسخة التجريبية التي تحوي خطأً مطبعياً في السطر الرابع.',
      '🔎 قرينة 2: النسخة المصححة هي التي وصلت للمراقب عادل والمشرفة دينا.',
      '🔎 قرينة 3: الحارس جاسم لا يملك صلاحية دخول غرفة الطباعة المغلقة.',
      '🔎 قرينة 4: وقت التقاط الصورة يطابق لحظة سحب التجربة الورقية الأولى على الطابعة!'
    ]
  }
];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mixedQuizPool() {
  return [
    ...GENERAL,
    ...GEOGRAPHY,
    ...HISTORY,
    ...NUMBERS,
    ...ISLAMIC_HERITAGE,
    ...SCIENCE_SPACE,
    ...ANIMALS_NATURE,
    ...TECH_GAMING,
    ...DIALECTS_MEANINGS,
    ...FOOTBALL_DEEP,
    ...EMOJI_MATH
  ];
}

function randomQuestion(): { q: string; opts: string[]; ans: number } {
  const pool = mixedQuizPool();
  const row = pool[Math.floor(Math.random() * pool.length)];
  const correct = row[1];
  const opts = shuffle(row.slice(1).filter(Boolean));
  return { q: row[0], opts, ans: opts.indexOf(correct) };
}

function makeShipGrid(shipCount: number): number[] {
  const g = new Array(16).fill(0);
  const idxs = shuffle(Array.from({ length: 16 }, (_, i) => i)).slice(0, shipCount);
  for (const idx of idxs) g[idx] = 1;
  return g;
}

function makeMineGrid(mineCount: number): number[] {
  const g = new Array(16).fill(0);
  const mines = shuffle(Array.from({ length: 16 }, (_, i) => i)).slice(0, mineCount);
  for (const m of mines) g[m] = -1;
  for (let i = 0; i < 16; i++) {
    if (g[i] === -1) continue;
    const r = Math.floor(i / 4);
    const c = i % 4;
    let cnt = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4 && g[nr * 4 + nc] === -1) cnt++;
      }
    }
    g[i] = cnt;
  }
  return g;
}

function check4x4Line(grid: number[], ownerVal: number): boolean {
  const lines = [
    [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
    [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
    [0, 5, 10, 15], [3, 6, 9, 12]
  ];
  return lines.some(line => line.every(idx => grid[idx] === ownerVal));
}

export function createArenaLobby(chatId: string, chatName: string, mode: ArenaMode): ArenaGame {
  const meta = ARENA_MODES[mode];
  const roundsMap: Partial<Record<ArenaMode, number>> = {
    memory_colors: 6,
    memory_words: 6,
    closest_num: 5,
    cowboy_duel: 5,
    football_1v1: 6,
    split_steal: 5,
    double_quiz: 6,
    half_story: 6,
    football_2v2: 6,
    bomb_defuse: 5,
    telepathy_2v2: 6,
    three_castles: 5,
    telepathy_3v3: 6,
    tactics_3v3: 5,
    clan_war_4v4: 6,
    tug_war_4v4: 7,
    courtroom_4v4: 5,
    knockout_all_4v4: 6
  };
  return {
    id: `arx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    chatId,
    chatName,
    mode,
    status: 'lobby',
    players: [],
    round: 1,
    totalRounds: roundsMap[mode] || 10,
    turnIdx: 0,
    activeTeam: 'blue',
    blueScore: 0,
    redScore: 0,
    blueHearts: 3,
    redHearts: 3,
    ropePos: 0,
    pot: 0,
    prompt: '',
    options: [],
    correctIdx: 0,
    secretClues: [],
    memItems: [],
    blueGrid: [],
    redGrid: [],
    sharedGrid: [],
    revealedGrid: new Array(16).fill(false),
    blueFighterIdx: 0,
    redFighterIdx: 0,
    holderIdx: 0,
    lastSummary: '',
    winnerIds: [],
    createdAt: Date.now()
  };
}

export function arenaJoin(
  game: ArenaGame,
  id: string,
  name: string,
  preferredTeam?: 'blue' | 'red'
): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: '⚠️ اللعبة بدأت بالفعل!' };
  const meta = ARENA_MODES[game.mode];
  const existing = game.players.find(p => p.id === id);

  if (meta.teamSize) {
    const blueCount = game.players.filter(p => p.team === 'blue').length;
    const redCount = game.players.filter(p => p.team === 'red').length;

    if (existing) {
      if (preferredTeam && existing.team !== preferredTeam) {
        const targetCount = preferredTeam === 'blue' ? blueCount : redCount;
        if (targetCount >= meta.teamSize) return { ok: false, msg: '🚫 هذا الفريق مكتمل العدد!' };
        existing.team = preferredTeam;
        return { ok: true, msg: preferredTeam === 'blue' ? '🔵 انتقلت للفريق الأزرق!' : '🔴 انتقلت للفريق الأحمر!' };
      }
      return { ok: false, msg: '✅ أنت منضم بالفعل!' };
    }

    if (game.players.length >= meta.maxPlayers) {
      return { ok: false, msg: `🚫 اكتمل العدد (${meta.maxPlayers} لاعبين)!` };
    }

    let assigned: 'blue' | 'red' = preferredTeam || (blueCount <= redCount ? 'blue' : 'red');
    if (assigned === 'blue' && blueCount >= meta.teamSize) assigned = 'red';
    if (assigned === 'red' && redCount >= meta.teamSize) assigned = 'blue';

    game.players.push({
      id,
      name,
      team: assigned,
      score: 0,
      alive: true,
      done: false
    });
    return { ok: true, msg: assigned === 'blue' ? '🔵 انضممت للفريق الأزرق!' : '🔴 انضممت للفريق الأحمر!' };
  }

  if (existing) return { ok: false, msg: '✅ أنت مشترك باللعبة!' };
  if (game.players.length >= meta.maxPlayers) return { ok: false, msg: '🚫 اكتمل العدد!' };
  game.players.push({ id, name, score: 0, alive: true, done: false });
  return { ok: true, msg: '✅ انضميت!' };
}

// =====================================================================
// 🔄 تجهيز كل جولة حسب نوع اللعبة
// =====================================================================

export function setupArenaRound(game: ArenaGame, now = Date.now()) {
  for (const p of game.players) {
    p.done = false;
    p.choice = undefined;
    p.guessNum = undefined;
    p.roundHit = undefined;
  }
  game.secretClues = [];
  game.selectedCell = undefined;

  switch (game.mode) {
    case 'hot_potato': {
      const aliveIdxs = game.players.map((p, i) => (p.alive ? i : -1)).filter(i => i >= 0);
      if (aliveIdxs.length <= 1) {
        finishArenaGame(game);
        return;
      }
      if (!game.players[game.holderIdx]?.alive) {
        game.holderIdx = aliveIdxs[Math.floor(Math.random() * aliveIdxs.length)];
      }
      const q = randomQuestion();
      game.prompt = q.q;
      game.options = q.opts;
      game.correctIdx = q.ans;
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }

    case 'memory_colors': {
      const seq = Array.from({ length: 5 }, () => Math.floor(Math.random() * COLOR_EMOJIS.length));
      game.memItems = seq.map(i => COLOR_EMOJIS[i]);
      const askPos = Math.floor(Math.random() * 5);
      const ansIdx = seq[askPos];
      const wrongPool = shuffle([0, 1, 2, 3, 4, 5].filter(x => x !== ansIdx)).slice(0, 3);
      const optsIdx = shuffle([ansIdx, ...wrongPool]);
      game.prompt = `أي لون كان في المربع رقم (${askPos + 1})؟`;
      game.options = optsIdx.map(i => COLOR_NAMES[i]);
      game.correctIdx = optsIdx.indexOf(ansIdx);
      game.status = 'memorize';
      game.deadline = now + 4_500;
      return;
    }

    case 'memory_words': {
      const picked = shuffle(MEMORY_WORD_POOL).slice(0, 6);
      game.memItems = picked;
      const askPos = Math.floor(Math.random() * 6);
      const correctWord = picked[askPos];
      const distractors = shuffle(MEMORY_WORD_POOL.filter(w => w !== correctWord)).slice(0, 3);
      const opts = shuffle([correctWord, ...distractors]);
      game.prompt = `أي كلمة كانت في الترتيب رقم (${askPos + 1})؟`;
      game.options = opts;
      game.correctIdx = opts.indexOf(correctWord);
      game.status = 'memorize';
      game.deadline = now + 5_000;
      return;
    }

    case 'closest_num': {
      const item = CLOSEST_NUM_BANK[(game.round - 1) % CLOSEST_NUM_BANK.length];
      const truth = item[1];
      game.targetNumber = truth;
      game.prompt = item[0];
      // 4 تقديرات رقمية متباعدة لمن يلعب مباشرة من القناة + إمكانية إرسال أي رقم حر بالخاص!
      const deltas = shuffle([-Math.max(15, Math.round(truth * 0.22)), -Math.max(6, Math.round(truth * 0.08)), Math.max(7, Math.round(truth * 0.09)), Math.max(19, Math.round(truth * 0.25))]);
      game.options = deltas.map(d => String(Math.max(1, truth + d))).sort((a, b) => Number(a) - Number(b));
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }

    case 'battleship_1v1':
    case 'battleship_2v2': {
      const ships = game.mode === 'battleship_2v2' ? 4 : 3;
      if (!game.blueGrid.length) {
        game.blueGrid = makeShipGrid(ships);
        game.redGrid = makeShipGrid(ships);
      }
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }

    case 'cowboy_duel': {
      game.status = 'arming';
      game.deadline = now + 3_000 + Math.floor(Math.random() * 2_000);
      return;
    }

    case 'football_1v1':
    case 'football_2v2': {
      game.options = ['⬅️ يسار', '⬆️ وسط', '➡️ يمين'];
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }

    case 'split_steal': {
      game.options = ['🤝 صفقة', '😈 خدعة'];
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }

    case 'tactical_dice': {
      game.pot = 0;
      game.lastRoll = undefined;
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }

    case 'mines_1v1': {
      if (!game.sharedGrid.length) {
        game.sharedGrid = makeMineGrid(4);
        game.revealedGrid = new Array(16).fill(false);
      }
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }

    case 'double_quiz':
    case 'clan_war_4v4':
    case 'tug_war_4v4':
    case 'knockout_all_4v4':
    case 'king_hill_3v3': {
      const q = randomQuestion();
      game.prompt = q.q;
      game.options = q.opts;
      game.correctIdx = q.ans;
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }

    case 'half_story': {
      const row = HALF_STORY_BANK[(game.round - 1 + Math.floor(game.createdAt % 7)) % HALF_STORY_BANK.length];
      const opts = shuffle([row.ans, ...row.wrongs]);
      game.prompt = 'افتح تلميحك السري وتعاون مع زميلك لاختيار الإجابة الصحيحة!';
      game.options = opts;
      game.correctIdx = opts.indexOf(row.ans);
      game.secretClues = [`🧩 النصف الأول: ${row.a}`, `🧩 النصف الثاني: ${row.b}`];
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }

    case 'bomb_defuse': {
      const mod = BOMB_MODULES[(game.round - 1 + Math.floor(game.createdAt % 5)) % BOMB_MODULES.length];
      game.prompt = mod.label;
      game.options = ['🔴 السلك الأحمر', '🔵 السلك الأزرق', '🟢 السلك الأخضر', '🟡 السلك الأصفر'];
      game.correctIdx = mod.correctWire;
      game.secretClues = [mod.rule];
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }

    case 'telepathy_2v2':
    case 'telepathy_3v3': {
      const t = TELEPATHY_PROMPTS[(game.round - 1 + Math.floor(game.createdAt % 8)) % TELEPATHY_PROMPTS.length];
      game.prompt = t.q;
      game.options = [...t.opts];
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }

    case 'three_castles': {
      game.castleQuestions = [randomQuestion(), randomQuestion(), randomQuestion()];
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }

    case 'tactics_3v3': {
      game.options = ['⚔️ هجوم', '🛡️ دفاع', '🌀 مناورة'];
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }

    case 'golden_grid_4v4': {
      if (!game.sharedGrid.length) {
        game.sharedGrid = new Array(16).fill(0);
      }
      game.selectedCell = undefined;
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }

    case 'courtroom_4v4': {
      const c = COURTROOM_CASES[(game.round - 1) % COURTROOM_CASES.length];
      game.prompt = c.story;
      game.options = [...c.suspects];
      game.correctIdx = c.culprit;
      game.secretClues = [...c.clues];
      game.status = 'playing';
      game.deadline = now + 15_000;
      return;
    }
  }
}

export function arenaStart(game: ArenaGame): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: '⚠️ اللعبة بدأت بالفعل!' };
  const meta = ARENA_MODES[game.mode];
  if (game.players.length < meta.minPlayers) {
    return {
      ok: false,
      msg: `⚠️ تحتاجون ${meta.minPlayers} لاعبين على الأقل (المنضمون حالياً: ${game.players.length})`
    };
  }
  if (meta.teamSize) {
    const b = game.players.filter(p => p.team === 'blue').length;
    const r = game.players.filter(p => p.team === 'red').length;
    if (b < meta.teamSize || r < meta.teamSize) {
      return { ok: false, msg: `⚠️ يجب اكتمال الفريقين (${meta.teamSize} ضد ${meta.teamSize})` };
    }
  }
  game.round = 1;
  game.holderIdx = Math.floor(Math.random() * game.players.length);
  setupArenaRound(game);
  return { ok: true, msg: '🔥 انطلقت المواجهة!' };
}

function finishArenaGame(game: ArenaGame) {
  game.status = 'game_over';
  game.deadline = undefined;
  const meta = ARENA_MODES[game.mode];
  if (meta.teamSize) {
    if (game.blueScore === game.redScore) {
      // كسر تعادل تلقائي حسب مجموع نقاط الأفراد ثم الأسبقية
      const bSum = game.players.filter(p => p.team === 'blue').reduce((s, p) => s + p.score, 0);
      const rSum = game.players.filter(p => p.team === 'red').reduce((s, p) => s + p.score, 0);
      if (bSum >= rSum) game.blueScore += 1;
      else game.redScore += 1;
    }
    const winTeam: 'blue' | 'red' = game.blueScore >= game.redScore ? 'blue' : 'red';
    game.winnerSide = winTeam;
    game.winnerIds = game.players.filter(p => p.team === winTeam).map(p => p.id);
    return;
  }

  if (game.mode === 'hot_potato') {
    const alive = game.players.filter(p => p.alive);
    const w = alive[0] || game.players.slice().sort((a, b) => b.score - a.score)[0];
    if (w) {
      w.score = Math.max(w.score, 5);
      game.winnerSide = 'player';
      game.winnerIds = [w.id];
    }
    return;
  }

  const sorted = game.players.slice().sort((a, b) => b.score - a.score);
  if (sorted[0]) {
    game.winnerSide = 'player';
    game.winnerIds = [sorted[0].id];
  }
}

// =====================================================================
// 🎮 معالجة نقرات الأزرار والمهلة التلقائية لكل لعبة من الـ 25 لعبة
// =====================================================================

export function arenaInspectSecret(game: ArenaGame, userId: string): { ok: boolean; alert: string } {
  const p = game.players.find(x => x.id === userId);
  if (!p) return { ok: false, alert: '🚫 أنت غير مشترك في هذه المباراة!' };

  if (game.mode === 'half_story') {
    const mates = game.players.filter(x => x.team === p.team);
    const idx = mates.findIndex(x => x.id === userId);
    return { ok: true, alert: game.secretClues[idx % 2] || game.secretClues[0] || '' };
  }

  if (game.mode === 'bomb_defuse') {
    const mates = game.players.filter(x => x.team === p.team);
    const expertIdx = (game.round - 1) % mates.length;
    if (mates[expertIdx]?.id !== userId) {
      return { ok: false, alert: '✂️ أنت «المفكّك» في هذه الجولة! زميلك الخبير يقرأ الدليل السري وأنت تقطع السلك!' };
    }
    return { ok: true, alert: game.secretClues[0] || '' };
  }

  if (game.mode === 'courtroom_4v4') {
    const mates = game.players.filter(x => x.team === p.team);
    const idx = Math.max(0, mates.findIndex(x => x.id === userId));
    return { ok: true, alert: game.secretClues[idx % game.secretClues.length] || game.secretClues[0] || '' };
  }

  return { ok: false, alert: 'لا يوجد ملف سري في هذه الجولة.' };
}

export function arenaSubmitFreeNumber(game: ArenaGame, userId: string, num: number): { ok: boolean; closed: boolean; msg: string } {
  if (game.mode !== 'closest_num' || game.status !== 'playing') {
    return { ok: false, closed: false, msg: '⏳ لا توجد جولة تخمين رقمي مفتوحة الآن.' };
  }
  const p = game.players.find(x => x.id === userId);
  if (!p) return { ok: false, closed: false, msg: '🚫 لست مشتركاً في هذه اللعبة.' };
  p.guessNum = num;
  p.done = true;
  if (game.players.every(x => x.done)) {
    resolvePlayingRound(game);
    return { ok: true, closed: true, msg: `✅ ثبت تخمينك (${num}) واكتملت تخمينات الجميع!` };
  }
  return { ok: true, closed: false, msg: `✅ تم تثبيت تخمينك السري (${num}) بنجاح!` };
}

export function arenaAction(
  game: ArenaGame,
  userId: string,
  action: string,
  val: number,
  now = Date.now()
): { ok: boolean; msg: string; popupAlert?: boolean } {
  const pIdx = game.players.findIndex(x => x.id === userId);
  if (pIdx < 0) return { ok: false, msg: '🚫 أنت غير مشترك في هذه المباراة' };
  const player = game.players[pIdx];

  // 🤠 حرب الكاوبوي: التسرّع قبل الإشارة!
  if (game.mode === 'cowboy_duel' && game.status === 'arming' && action === 'early') {
    const rival = game.players[1 - pIdx];
    rival.score += 1;
    game.lastSummary = `💥 تسرّع قبل الإشارة — النقطة لخصمه\\!\n> \\| *${md(rival.name)}* \\|`;
    if (rival.score >= 3 || game.round >= game.totalRounds) {
      finishArenaGame(game);
    } else {
      game.status = 'result';
      game.deadline = now + 2_500;
    }
    return { ok: true, msg: '💥 أطلقت قبل الإشارة وخسرت الجولة!' };
  }

  if (game.mode === 'cowboy_duel' && game.status === 'playing' && action === 'fire') {
    player.score += 1;
    game.lastSummary = `🤠 طلقة خاطفة حاسمة من:\n> \\| *${md(player.name)}* \\|`;
    if (player.score >= 3 || game.round >= game.totalRounds) {
      finishArenaGame(game);
    } else {
      game.status = 'result';
      game.deadline = now + 2_500;
    }
    return { ok: true, msg: '🔥 أسرع يد في الغرب! +1 نقطة' };
  }

  if (game.status !== 'playing') {
    return { ok: false, msg: '⏳ انتظر لحظة انتقال الجولة…' };
  }

  // 💣 القنبلة الموقوتة
  if (game.mode === 'hot_potato') {
    if (pIdx !== game.holderIdx) return { ok: false, msg: '😅 القنبلة مو بيدك هسة!' };
    const aliveOthers = game.players.map((x, i) => (x.alive && i !== pIdx ? i : -1)).filter(i => i >= 0);
    if (val === game.correctIdx) {
      player.score += 1;
      game.holderIdx = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
      setupArenaRound(game, now);
      return { ok: true, msg: '😮‍💨 صح! مرّرت القنبلة المشتعلة!' };
    }
    player.alive = false;
    game.lastSummary = `💥 انفجرت القنبلة بيد:\n> \\| *${md(player.name)}* \\|`;
    const rem = game.players.filter(x => x.alive);
    if (rem.length <= 1) {
      finishArenaGame(game);
    } else {
      game.status = 'result';
      game.deadline = now + 2_200;
    }
    return { ok: true, msg: '💥 غلط! انفجرت القنبلة بيدك!' };
  }

  // 🎲 النرد التكتيكي
  if (game.mode === 'tactical_dice') {
    const activeIdx = game.turnIdx % 2;
    if (pIdx !== activeIdx) return { ok: false, msg: '⏳ مو دورك هسة!' };
    if (action === 'roll') {
      const die = 1 + Math.floor(Math.random() * 6);
      game.lastRoll = die;
      if (die === 1) {
        game.pot = 0;
        game.turnIdx = 1 - activeIdx;
        game.deadline = now + 15_000;
        game.lastSummary = `💀 ظهر الرقم 1 وضاعت سلّة الجولة\\! انتقل الدور\\.`;
        return { ok: true, msg: '💀 طلع 1! ضاعت سلّة هالدور!' };
      }
      game.pot += die;
      game.deadline = now + 15_000;
      game.lastSummary = `🎲 رمية *${die}* — في السلّة الآن *${game.pot}* نقطة\\!`;
      return { ok: true, msg: `🎲 طلع ${die}! بالسلّة ${game.pot}` };
    }
    if (action === 'bank') {
      player.score += game.pot;
      const banked = game.pot;
      game.pot = 0;
      if (player.score >= 35) {
        finishArenaGame(game);
        return { ok: true, msg: `🏆 ثبّتت الرصيد ووصلت ${player.score} وحسمت الفوز!` };
      }
      game.turnIdx = 1 - activeIdx;
      game.deadline = now + 15_000;
      game.lastSummary = `🏦 تم تثبيت *+${banked}* نقطة في الرصيد بنجاح\\!`;
      return { ok: true, msg: `🏦 ثبّتت +${banked} نقطة!` };
    }
  }

  // 🚢 حرب السفن 1v1 و 2v2
  if (game.mode === 'battleship_1v1' || game.mode === 'battleship_2v2') {
    const isTeam = game.mode === 'battleship_2v2';
    const mySide: 'blue' | 'red' = isTeam ? (player.team || 'blue') : pIdx === 0 ? 'blue' : 'red';
    const expectedSide: 'blue' | 'red' = game.turnIdx % 2 === 0 ? 'blue' : 'red';
    if (mySide !== expectedSide) return { ok: false, msg: '⏳ دور الأسطول المنافس بالقصف!' };

    const enemyGrid = mySide === 'blue' ? game.redGrid : game.blueGrid;
    if (enemyGrid[val] === 2 || enemyGrid[val] === 3) {
      return { ok: false, msg: '⚠️ هذا المربع مقصوف مسبقاً!' };
    }
    const hit = enemyGrid[val] === 1;
    enemyGrid[val] = hit ? 2 : 3;
    if (hit) {
      player.score += 2;
      if (mySide === 'blue') game.blueScore += 1;
      else game.redScore += 1;
    }
    const shipsLeft = enemyGrid.filter(v => v === 1).length;
    if (shipsLeft === 0) {
      if (!isTeam) player.score += 5;
      finishArenaGame(game);
      return { ok: true, msg: '🔥 أغرقت آخر سفينة معادية وحسمت النصر!' };
    }
    game.turnIdx += 1;
    game.deadline = now + 15_000;
    game.lastSummary = hit
      ? `🔥 *إصابة مباشرة للسفينة\\!* \\(المتبقي لدى العدو: *${shipsLeft}*\\)`
      : `💨 قذيفة في الماء — انتقل الدور للخصم`;
    return { ok: true, msg: hit ? '🔥 إصابة مباشرة!' : '💨 بالماء!' };
  }

  // 💣 حقل الألغام 1v1
  if (game.mode === 'mines_1v1') {
    if (pIdx !== game.turnIdx % 2) return { ok: false, msg: '⏳ مو دورك هسة!' };
    if (game.revealedGrid[val]) return { ok: false, msg: '⚠️ هذا المربع مفتوح مسبقاً!' };
    game.revealedGrid[val] = true;
    if (game.sharedGrid[val] === -1) {
      const rival = game.players[1 - pIdx];
      rival.score += 10;
      finishArenaGame(game);
      return { ok: true, msg: '💥 بوووم! فتحت لغماً مخفياً!' };
    }
    player.score += 2;
    const safeLeft = game.sharedGrid.some((v, i) => v >= 0 && !game.revealedGrid[i]);
    if (!safeLeft) {
      finishArenaGame(game);
      return { ok: true, msg: '🏆 فُتحت كل المربعات الآمنة!' };
    }
    game.turnIdx += 1;
    game.deadline = now + 15_000;
    return { ok: true, msg: `✅ آمن! (${game.sharedGrid[val]} ألغام مجاورة)` };
  }

  // 🟨 المربعات الذهبية 4v4
  if (game.mode === 'golden_grid_4v4') {
    if (player.team !== game.activeTeam) return { ok: false, msg: '⏳ الدور حالياً للفريق المنافس!' };
    if (action === 'cell') {
      if (game.selectedCell !== undefined) return { ok: false, msg: '⚠️ أجب عن سؤال المربع المفتوح أولاً!' };
      if (game.sharedGrid[val] !== 0) return { ok: false, msg: '⚠️ هذا المربع محتل مسبقاً!' };
      game.selectedCell = val;
      const q = randomQuestion();
      game.prompt = q.q;
      game.options = q.opts;
      game.correctIdx = q.ans;
      game.deadline = now + 15_000;
      return { ok: true, msg: `🟨 فُتح سؤال المربع #${val + 1}!` };
    }
    if (action === 'opt' && game.selectedCell !== undefined) {
      const cell = game.selectedCell;
      game.selectedCell = undefined;
      const isRight = val === game.correctIdx;
      if (isRight) {
        const markVal = game.activeTeam === 'blue' ? 1 : 2;
        game.sharedGrid[cell] = markVal;
        player.score += 2;
        if (game.activeTeam === 'blue') game.blueScore += 1;
        else game.redScore += 1;
        if (check4x4Line(game.sharedGrid, markVal) || game.sharedGrid.every(x => x !== 0)) {
          if (check4x4Line(game.sharedGrid, markVal)) {
            if (game.activeTeam === 'blue') game.blueScore += 5;
            else game.redScore += 5;
          }
          finishArenaGame(game);
          return { ok: true, msg: '🏆 خط ذهبي كامل — فوز ساحق!' };
        }
      }
      game.activeTeam = game.activeTeam === 'blue' ? 'red' : 'blue';
      game.round += 1;
      if (game.round > 12) {
        finishArenaGame(game);
        return { ok: true, msg: isRight ? '✅ احتللت المربع وانتهت الجولات!' : '❌ خطأ وانتهت الجولات!' };
      }
      game.deadline = now + 15_000;
      return { ok: true, msg: isRight ? '🟨 تم احتلال المربع الذهبي!' : '❌ خطأ! انتقل الدور للفريق الخصم' };
    }
  }

  // 💣 تفكيك القنبلة التعاوني: المقطّع فقط يقص السلك لكل فريق
  if (game.mode === 'bomb_defuse') {
    const mates = game.players.filter(x => x.team === player.team);
    const expertIdx = (game.round - 1) % mates.length;
    if (mates[expertIdx]?.id === userId) {
      return { ok: false, msg: '📖 أنت الخبير في هذه الجولة — افتح الدليل السري ودع زميلك يقطع السلك!' };
    }
    if (mates.some(m => m.done)) return { ok: false, msg: '✅ فريقك حسم سلك هذه الجولة بالفعل!' };
    for (const m of mates) {
      m.done = true;
      m.choice = val;
    }
    if (game.players.every(x => x.done)) {
      resolvePlayingRound(game, now);
    }
    return { ok: true, msg: val === game.correctIdx ? '✂️ تفكيك سليم! +2 لفريقك!' : '💥 السلك الخطأ!' };
  }

  // ⚔️ البقاء للأقوى 3v3: المقاتلان الحاليان في الحلبة فقط يجيبان
  if (game.mode === 'king_hill_3v3') {
    const blues = game.players.filter(x => x.team === 'blue');
    const reds = game.players.filter(x => x.team === 'red');
    const bFighter = blues[game.blueFighterIdx];
    const rFighter = reds[game.redFighterIdx];
    if (userId !== bFighter?.id && userId !== rFighter?.id) {
      return { ok: false, msg: '👀 زميلك يقاتل الآن في الحلبة — استعد لدورك!' };
    }
    if (player.done) return { ok: false, msg: '✅ أجبت في هذه المواجهة!' };
    player.done = true;
    player.choice = val;
    if (val === game.correctIdx) {
      // أول مقاتل يصيب يقصي مقاتل الخصم فوراً!
      player.score += 2;
      if (player.team === 'blue') {
        game.blueScore += 1;
        game.redFighterIdx += 1;
        game.lastSummary = `⚔️ البطل الصامد أقصى خصمه من الحلبة:\n> \\| *${md(player.name)}* \\|`;
        if (game.redFighterIdx >= reds.length) {
          finishArenaGame(game);
          return { ok: true, msg: '🏆 أقصيت آخر مقاتل وحسمت البطولة!' };
        }
      } else {
        game.redScore += 1;
        game.blueFighterIdx += 1;
        game.lastSummary = `⚔️ البطل الصامد أقصى خصمه من الحلبة:\n> \\| *${md(player.name)}* \\|`;
        if (game.blueFighterIdx >= blues.length) {
          finishArenaGame(game);
          return { ok: true, msg: '🏆 أقصيت آخر مقاتل وحسمت البطولة!' };
        }
      }
      game.status = 'result';
      game.deadline = now + 2_200;
      return { ok: true, msg: '⚡ ضربة حاسمة! أقصيت خصمك!' };
    }
    if (bFighter?.done && rFighter?.done) {
      game.lastSummary = `🛡️ أخطأ المقاتلان معاً — جولة حاسمة جديدة بينهما\\!`;
      game.status = 'result';
      game.deadline = now + 2_000;
    }
    return { ok: true, msg: '❌ أخطأت الضربة!' };
  }

  // ⚽ كرة القدم الزوجية 2v2: فقط المهاجم الحالي والحارس المقابل يشتركان بالركلة
  if (game.mode === 'football_2v2') {
    const blues = game.players.filter(x => x.team === 'blue');
    const reds = game.players.filter(x => x.team === 'red');
    const blueKicking = game.round % 2 === 1;
    const kicker = blueKicking ? blues[Math.floor((game.round - 1) / 2) % blues.length] : reds[Math.floor((game.round - 1) / 2) % reds.length];
    const keeper = blueKicking ? reds[Math.floor((game.round - 1) / 2) % reds.length] : blues[Math.floor((game.round - 1) / 2) % blues.length];
    if (userId !== kicker?.id && userId !== keeper?.id) {
      return { ok: false, msg: '👀 هذه الركلة بين مهاجم الفريق وحارس الخصم!' };
    }
    if (player.done) return { ok: false, msg: '✅ اخترت زاويتك بالفعل!' };
    player.done = true;
    player.choice = val;
    if (kicker?.done && keeper?.done) {
      resolvePlayingRound(game, now);
    }
    return { ok: true, msg: userId === kicker?.id ? '⚽ ثبتت زاوية التسديد!' : '🧤 ثبتت زاوية الارتماء!' };
  }

  // 🏰 احتلال القلاع الثلاث 3v3: كل قائد قلعة يجيب عن قلعته المخصّصة فقط!
  if (game.mode === 'three_castles' && action.startsWith('cas_')) {
    const castleIdx = Number(action.slice(4));
    const mates = game.players.filter(x => x.team === player.team);
    const myCastleIdx = mates.findIndex(x => x.id === userId);
    if (myCastleIdx !== castleIdx) {
      return { ok: false, msg: `🏰 أنت قائد القلعة رقم (${myCastleIdx + 1}) — أجب عن سؤال قلعتك!` };
    }
    if (player.done) return { ok: false, msg: '✅ سجّلت جواب قلعتك بالفعل!' };
    player.done = true;
    player.choice = val;
    if (game.players.every(x => x.done)) {
      resolvePlayingRound(game, now);
    }
    return { ok: true, msg: `🏰 ثبتت إجابتك على القلعة رقم (${castleIdx + 1})!` };
  }

  // بقية الألعاب الجماعية والفرق (كل لاعب يختار مرة في الجولة)
  if (player.done) return { ok: false, msg: '✅ سجّلت اختيارك لهذه الجولة!' };
  player.done = true;
  player.choice = val;
  if (game.mode === 'closest_num') {
    player.guessNum = Number(game.options[val] || 0);
  }

  // في شد الحبل نحرّك الحبل حياً مع كل إجابة!
  if (game.mode === 'tug_war_4v4') {
    const right = val === game.correctIdx;
    if (right) player.score += 1;
    const dir = player.team === 'blue' ? -1 : 1;
    game.ropePos += right ? dir : -dir;
    if (game.ropePos <= -4) {
      game.blueScore += 10;
      finishArenaGame(game);
      return { ok: true, msg: '🪢 سحبتم الحبل بالكامل لمعسكركم وحسمتم الفوز!' };
    }
    if (game.ropePos >= 4) {
      game.redScore += 10;
      finishArenaGame(game);
      return { ok: true, msg: '🪢 سحبتم الحبل بالكامل لمعسكركم وحسمتم الفوز!' };
    }
  }

  if (game.players.every(x => x.done)) {
    resolvePlayingRound(game, now);
  }
  return { ok: true, msg: '✅ تم تثبيت اختيارك!' };
}

export function resolvePlayingRound(game: ArenaGame, now = Date.now()) {
  switch (game.mode) {
    case 'memory_colors':
    case 'memory_words': {
      for (const p of game.players) {
        p.roundHit = p.done && p.choice === game.correctIdx;
        if (p.roundHit) p.score += 1;
      }
      game.lastSummary = `✅ الجواب الصحيح: *${md(game.options[game.correctIdx] || '')}*`;
      break;
    }

    case 'closest_num': {
      const truth = game.targetNumber ?? 0;
      const submitted = game.players.filter(p => typeof p.guessNum === 'number');
      if (submitted.length > 0) {
        const bestDiff = Math.min(...submitted.map(p => Math.abs((p.guessNum ?? 0) - truth)));
        const winners = submitted.filter(p => Math.abs((p.guessNum ?? 0) - truth) === bestDiff);
        for (const w of winners) {
          w.score += 2;
          w.roundHit = true;
        }
        game.lastSummary = `🎯 الرقم الحقيقي: *${truth}* \\(فارق الفائز: *${bestDiff}*\\)`;
      } else {
        game.lastSummary = `🎯 الرقم الحقيقي كان: *${truth}*`;
      }
      break;
    }

    case 'football_1v1': {
      const kickerIdx = (game.round - 1) % 2;
      const kicker = game.players[kickerIdx];
      const keeper = game.players[1 - kickerIdx];
      const kChoice = kicker.choice ?? Math.floor(Math.random() * 3);
      const gChoice = keeper.choice ?? Math.floor(Math.random() * 3);
      const saved = kChoice === gChoice;
      if (!saved) {
        kicker.score += 1;
        game.lastSummary = `⚽ *هدف رائع\\!* سكن الشباك لصالح:\n> \\| *${md(kicker.name)}* \\|`;
      } else {
        game.lastSummary = `🧤 *تصدٍّ أسطوري\\!* صدّ الحارس الكرة ببراعة:\n> \\| *${md(keeper.name)}* \\|`;
      }
      break;
    }

    case 'football_2v2': {
      const blues = game.players.filter(x => x.team === 'blue');
      const reds = game.players.filter(x => x.team === 'red');
      const blueKicking = game.round % 2 === 1;
      const kicker = blueKicking
        ? blues[Math.floor((game.round - 1) / 2) % blues.length]
        : reds[Math.floor((game.round - 1) / 2) % reds.length];
      const keeper = blueKicking
        ? reds[Math.floor((game.round - 1) / 2) % reds.length]
        : blues[Math.floor((game.round - 1) / 2) % blues.length];
      const kChoice = kicker?.choice ?? 0;
      const gChoice = keeper?.choice ?? 1;
      if (kChoice !== gChoice) {
        if (blueKicking) game.blueScore += 1;
        else game.redScore += 1;
        if (kicker) kicker.score += 1;
        game.lastSummary = `⚽ *هدف جميل في الشباك\\!*`;
      } else {
        if (keeper) keeper.score += 1;
        game.lastSummary = `🧤 *تصدٍّ بارع من حارس المرمى\\!*`;
      }
      break;
    }

    case 'split_steal': {
      const [p1, p2] = game.players;
      const c1 = p1.choice ?? 0;
      const c2 = p2.choice ?? 0;
      if (c1 === 0 && c2 === 0) {
        p1.score += 2;
        p2.score += 2;
        game.lastSummary = `🤝 اتفق الطرفان على الصفقة\\! *\\+2* لكل لاعب`;
      } else if (c1 === 1 && c2 === 0) {
        p1.score += 4;
        game.lastSummary = `😈 خدعة ناجحة خطفت الجائزة كاملة لصالح:\n> \\| *${md(p1.name)}* \\|`;
      } else if (c1 === 0 && c2 === 1) {
        p2.score += 4;
        game.lastSummary = `😈 خدعة ناجحة خطفت الجائزة كاملة لصالح:\n> \\| *${md(p2.name)}* \\|`;
      } else {
        game.lastSummary = `💥 اختار الاثنان الخدعة فاحترقت الجائزة وخرجا بصفر\\!`;
      }
      break;
    }

    case 'double_quiz': {
      const bHits = game.players.filter(p => p.team === 'blue' && p.done && p.choice === game.correctIdx);
      const rHits = game.players.filter(p => p.team === 'red' && p.done && p.choice === game.correctIdx);
      bHits.forEach(p => { p.score += 1; });
      rHits.forEach(p => { p.score += 1; });
      const bPts = bHits.length === 2 ? 3 : bHits.length;
      const rPts = rHits.length === 2 ? 3 : rHits.length;
      game.blueScore += bPts;
      game.redScore += rPts;
      game.lastSummary = `⚡ الأزرق *\\+${bPts}* • الأحمر *\\+${rPts}* \\(الجواب: *${md(game.options[game.correctIdx] || '')}*\\)`;
      break;
    }

    case 'half_story':
    case 'courtroom_4v4':
    case 'clan_war_4v4': {
      let bPts = 0;
      let rPts = 0;
      for (const p of game.players) {
        if (p.done && p.choice === game.correctIdx) {
          p.score += 1;
          if (p.team === 'blue') bPts += 1;
          else rPts += 1;
        }
      }
      game.blueScore += bPts;
      game.redScore += rPts;
      game.lastSummary = `🏆 الأزرق *\\+${bPts}* • الأحمر *\\+${rPts}* — الصحيح: *${md(game.options[game.correctIdx] || '')}*`;
      break;
    }

    case 'bomb_defuse': {
      const bOk = game.players.some(p => p.team === 'blue' && p.choice === game.correctIdx);
      const rOk = game.players.some(p => p.team === 'red' && p.choice === game.correctIdx);
      if (bOk) game.blueScore += 2;
      if (rOk) game.redScore += 2;
      game.lastSummary = `💣 السلك الصحيح كان: *${md(game.options[game.correctIdx] || '')}*`;
      break;
    }

    case 'telepathy_2v2':
    case 'telepathy_3v3': {
      const calcTeamSync = (team: 'blue' | 'red') => {
        const picks = game.players.filter(p => p.team === team && p.done && p.choice !== undefined).map(p => p.choice!);
        const counts = new Map<number, number>();
        for (const c of picks) counts.set(c, (counts.get(c) || 0) + 1);
        const best = Math.max(0, ...Array.from(counts.values()));
        if (game.mode === 'telepathy_2v2') return best >= 2 ? 2 : 0;
        if (best >= 3) return 4;
        if (best === 2) return 1;
        return 0;
      };
      const bAdd = calcTeamSync('blue');
      const rAdd = calcTeamSync('red');
      game.blueScore += bAdd;
      game.redScore += rAdd;
      game.lastSummary = `🔮 تخاطر الجولة — الأزرق *\\+${bAdd}* • الأحمر *\\+${rAdd}*`;
      break;
    }

    case 'three_castles': {
      const blues = game.players.filter(p => p.team === 'blue');
      const reds = game.players.filter(p => p.team === 'red');
      const qs = game.castleQuestions || [];
      let bCastles = 0;
      let rCastles = 0;
      for (let i = 0; i < 3; i++) {
        const bOk = blues[i]?.done && blues[i]?.choice === qs[i]?.ans;
        const rOk = reds[i]?.done && reds[i]?.choice === qs[i]?.ans;
        if (bOk) { bCastles += 1; blues[i].score += 1; }
        if (rOk) { rCastles += 1; reds[i].score += 1; }
      }
      if (bCastles > rCastles) game.blueScore += 2;
      else if (rCastles > bCastles) game.redScore += 2;
      else {
        game.blueScore += 1;
        game.redScore += 1;
      }
      game.lastSummary = `🏰 القلاع المفتوحة — الأزرق *${bCastles}* مقابل الأحمر *${rCastles}*`;
      break;
    }

    case 'tactics_3v3': {
      const blues = game.players.filter(p => p.team === 'blue');
      const reds = game.players.filter(p => p.team === 'red');
      let bWins = 0;
      let rWins = 0;
      // 0=هجوم يهزم 2=مناورة، 2=مناورة يهزم 1=دفاع، 1=دفاع يهزم 0=هجوم
      const beats = (a: number, b: number) =>
        (a === 0 && b === 2) || (a === 2 && b === 1) || (a === 1 && b === 0);
      for (let i = 0; i < 3; i++) {
        const bc = blues[i]?.choice ?? Math.floor(Math.random() * 3);
        const rc = reds[i]?.choice ?? Math.floor(Math.random() * 3);
        if (beats(bc, rc)) { bWins += 1; if (blues[i]) blues[i].score += 1; }
        else if (beats(rc, bc)) { rWins += 1; if (reds[i]) reds[i].score += 1; }
      }
      game.blueScore += bWins;
      game.redScore += rWins;
      game.lastSummary = `🛡️ نتيجة الاشتباك — الأزرق *\\+${bWins}* • الأحمر *\\+${rWins}*`;
      break;
    }

    case 'tug_war_4v4': {
      game.blueScore = Math.max(0, -game.ropePos);
      game.redScore = Math.max(0, game.ropePos);
      game.lastSummary = `🪢 موقع الحبل الحالي: *${game.ropePos < 0 ? `أزرق \\+${-game.ropePos}` : game.ropePos > 0 ? `أحمر \\+${game.ropePos}` : 'تعادل بالمنتصف'}*`;
      break;
    }

    case 'knockout_all_4v4': {
      const bHits = game.players.filter(p => p.team === 'blue' && p.done && p.choice === game.correctIdx).length;
      const rHits = game.players.filter(p => p.team === 'red' && p.done && p.choice === game.correctIdx).length;
      if (bHits === 4) game.redHearts = Math.max(0, game.redHearts - 1);
      if (rHits === 4) game.blueHearts = Math.max(0, game.blueHearts - 1);
      if (bHits > rHits && bHits < 4 && rHits < 4) game.blueScore += 2;
      else if (rHits > bHits && bHits < 4 && rHits < 4) game.redScore += 2;
      game.blueScore += bHits;
      game.redScore += rHits;
      game.lastSummary = `🔥 إصابات الجولة — الأزرق *${bHits}/4* • الأحمر *${rHits}/4*`;
      if (game.blueHearts === 0 || game.redHearts === 0) {
        if (game.blueHearts > game.redHearts) game.blueScore += 20;
        else if (game.redHearts > game.blueHearts) game.redScore += 20;
        finishArenaGame(game);
        return;
      }
      break;
    }
  }

  if (game.round >= game.totalRounds) {
    finishArenaGame(game);
  } else {
    game.status = 'result';
    game.deadline = now + 2_200;
  }
}

export function tickSingleArenaGame(game: ArenaGame, now = Date.now()): boolean {
  if (!game.deadline || now < game.deadline) return false;

  if (game.status === 'memorize' || game.status === 'arming') {
    game.status = 'playing';
    game.deadline = now + 15_000;
    return true;
  }

  if (game.status === 'result') {
    game.round += 1;
    setupArenaRound(game, now);
    return true;
  }

  if (game.status === 'playing') {
    if (game.mode === 'hot_potato') {
      const holder = game.players[game.holderIdx];
      if (holder) {
        holder.alive = false;
        game.lastSummary = `⏰ انتهى الوقت وانفجرت القنبلة بيد:\n> \\| *${md(holder.name)}* \\|`;
      }
      const rem = game.players.filter(p => p.alive);
      if (rem.length <= 1) finishArenaGame(game);
      else {
        game.status = 'result';
        game.deadline = now + 2_200;
      }
      return true;
    }

    if (
      game.mode === 'tactical_dice' ||
      game.mode === 'battleship_1v1' ||
      game.mode === 'battleship_2v2' ||
      game.mode === 'mines_1v1' ||
      game.mode === 'golden_grid_4v4'
    ) {
      game.pot = 0;
      game.selectedCell = undefined;
      game.turnIdx += 1;
      game.activeTeam = game.activeTeam === 'blue' ? 'red' : 'blue';
      game.round += 1;
      if (game.round > 14) finishArenaGame(game);
      else {
        game.lastSummary = `⏰ انتهت مهلة الـ 15 ثانية وانتقل الدور تلقائياً\\!`;
        game.deadline = now + 15_000;
      }
      return true;
    }

    if (game.mode === 'cowboy_duel') {
      game.lastSummary = `⏰ لم يطلق أحد النار بالوقت المحدد\\!`;
      if (game.round >= game.totalRounds) finishArenaGame(game);
      else {
        game.status = 'result';
        game.deadline = now + 2_000;
      }
      return true;
    }

    if (game.mode === 'king_hill_3v3') {
      game.blueFighterIdx += 1;
      game.redFighterIdx += 1;
      const half = 3;
      if (game.blueFighterIdx >= half || game.redFighterIdx >= half) finishArenaGame(game);
      else {
        game.status = 'result';
        game.lastSummary = `⏰ انتهى الوقت وأُقصي المقاتلان معاً\\!`;
        game.deadline = now + 2_000;
      }
      return true;
    }

    resolvePlayingRound(game, now);
    return true;
  }

  return false;
}

// =====================================================================
// 🎨 رندر اللوحات والأزرار بصيغة MarkdownV2 موحّدة نظيفة 100٪
// =====================================================================

function renderTeamBoxes(game: ArenaGame, showStatus = false): string {
  const meta = ARENA_MODES[game.mode];
  const blue = game.players.filter(p => p.team === 'blue');
  const red = game.players.filter(p => p.team === 'red');

  const fmtTeam = (list: ArenaPlayer[]) =>
    list.length
      ? list
          .map((p, i) => {
            const st = showStatus ? (p.done ? ' ✅' : ' ⏳') : '';
            return `> ${i + 1} \\- \\| *${md(p.name)}* \\| \\(p ${p.score}\\)${st}`;
          })
          .join('\n')
      : `_بانتظار الانضمام_`;

  return [
    `🔵 *الفريق الأزرق \\(${blue.length}/${meta.teamSize}\\) — النقاط: ${game.blueScore}*`,
    fmtTeam(blue),
    '',
    `🔴 *الفريق الأحمر \\(${red.length}/${meta.teamSize}\\) — النقاط: ${game.redScore}*`,
    fmtTeam(red)
  ].join('\n');
}

function renderRopeBar(pos: number): string {
  // pos من -4 إلى +4 (المركز 4 في مصفوفة طولها 9)
  const cells = ['🟦', '🟦', '⬜', '⬜', '⬜', '⬜', '⬜', '🟥', '🟥'];
  const marker = Math.max(0, Math.min(8, 4 + pos));
  cells[marker] = '🪢';
  return cells.join('');
}

export function renderArenaText(game: ArenaGame): string {
  const meta = ARENA_MODES[game.mode];
  const SEP = '━━━━━━━━━━━━━━━━━━━';

  if (game.status === 'lobby') {
    const lines = [`${meta.emoji} *${md(meta.title)}*`, SEP];
    if (meta.teamSize) {
      lines.push(renderTeamBoxes(game, false));
    } else {
      lines.push(`👥 *اللاعبون \\(${game.players.length}/${meta.maxPlayers}\\):*`);
      if (!game.players.length) lines.push(`_بانتظار انضمام اللاعبين_`);
      else lines.push(game.players.map((p, i) => scoreLine(i + 1, p.name, p.score)).join('\n'));
    }
    return lines.join('\n');
  }

  if (game.status === 'game_over') {
    const lines = [`${meta.emoji} *${md(meta.title)}*`, `🏁 *انتهت المباراة\\!*`, SEP];
    if (meta.teamSize) {
      const winBlue = game.winnerSide === 'blue';
      lines.push(`🏆 *الفريق الفائز:* ${winBlue ? '*الفريق الأزرق 🔵*' : '*الفريق الأحمر 🔴*'}`);
      lines.push('');
      lines.push(renderTeamBoxes(game, false));
    } else {
      const sorted = game.players.slice().sort((a, b) => b.score - a.score);
      const top = game.winnerIds.length
        ? game.players.find(p => p.id === game.winnerIds[0]) || sorted[0]
        : sorted[0];
      if (top) {
        lines.push(`🏆 *الفائز:*`);
        lines.push(`> \\| *${md(top.name)}* \\|`);
        lines.push('');
      }
      lines.push(`📊 *الترتيب النهائي:*`);
      lines.push(sorted.map((p, i) => scoreLine(i + 1, p.name, p.score)).join('\n'));
    }
    return lines.join('\n');
  }

  const lines = [`${meta.emoji} *${md(meta.title)}* • الجولة *${game.round}*`];

  if (game.status === 'memorize') {
    lines.push(SEP);
    lines.push(`👀 *احفظ اللوحة جيداً قبل اختفائها:*`);
    if (game.mode === 'memory_colors') {
      lines.push(game.memItems.map((c, i) => `*${i + 1}:* ${c}`).join('   '));
    } else {
      lines.push(game.memItems.map((w, i) => `*${i + 1}\\.* ${md(w)}`).join('  •  '));
    }
    return lines.join('\n');
  }

  if (game.status === 'arming') {
    lines.push(SEP);
    lines.push(`🏜️ *استعد… يدك قرب المسدس\\!*`);
    lines.push(`⚠️ *إيّاك أن تطلق النار قبل ظهور إشارة الانطلاق\\!*`);
    lines.push(SEP);
    lines.push(game.players.map((p, i) => scoreLine(i + 1, p.name, p.score)).join('\n'));
    return lines.join('\n');
  }

  if (game.status === 'result') {
    lines.push(SEP);
    if (game.lastSummary) lines.push(game.lastSummary);
    lines.push(SEP);
    if (meta.teamSize) lines.push(renderTeamBoxes(game, false));
    else lines.push(game.players.map((p, i) => scoreLine(i + 1, p.name, p.score)).join('\n'));
    return lines.join('\n');
  }

  // status === 'playing'
  lines.push(SEP);

  if (game.mode === 'hot_potato') {
    const holder = game.players[game.holderIdx];
    lines.push(`💣 *القنبلة المشتعلة الآن بيد:*`);
    if (holder) lines.push(`> \\| *${md(holder.name)}* \\|`);
    lines.push('');
    lines.push(`❓ *${md(game.prompt)}*`);
    lines.push(SEP);
    lines.push(
      game.players
        .map((p, i) => scoreLine(i + 1, p.name, p.score, p.alive ? ' 🔥' : ' 💀'))
        .join('\n')
    );
    return lines.join('\n');
  }

  if (game.mode === 'cowboy_duel') {
    lines.push(`🔥🔥 *أطلق النار الآن\\!\\! أسرع ضغطة تحسم الجولة\\!* 🔥🔥`);
    lines.push(SEP);
    lines.push(game.players.map((p, i) => scoreLine(i + 1, p.name, p.score)).join('\n'));
    return lines.join('\n');
  }

  if (game.mode === 'tactical_dice') {
    const cur = game.players[game.turnIdx % 2];
    lines.push(`🎯 *الدور الآن عند:*`);
    if (cur) lines.push(`> \\| *${md(cur.name)}* \\|`);
    lines.push(`🧺 *سلّة الدور الحالي:* *${game.pot}* نقطة \\(الهدف: *35*\\)`);
    if (game.lastSummary) lines.push(game.lastSummary);
    lines.push(SEP);
    lines.push(game.players.map((p, i) => scoreLine(i + 1, p.name, p.score)).join('\n'));
    return lines.join('\n');
  }

  if (game.mode === 'battleship_1v1' || game.mode === 'battleship_2v2') {
    const side = game.turnIdx % 2 === 0 ? 'blue' : 'red';
    if (game.mode === 'battleship_1v1') {
      const shooter = game.players[game.turnIdx % 2];
      lines.push(`🎯 *نوبة القصف البحري لقائد الأسطول:*`);
      if (shooter) lines.push(`> \\| *${md(shooter.name)}* \\|`);
      if (game.lastSummary) lines.push(game.lastSummary);
      lines.push(SEP);
      lines.push(game.players.map((p, i) => scoreLine(i + 1, p.name, p.score)).join('\n'));
    } else {
      lines.push(`🎯 *نوبة القصف البحري:* ${side === 'blue' ? '*الأسطول الأزرق 🔵*' : '*الأسطول الأحمر 🔴*'}`);
      if (game.lastSummary) lines.push(game.lastSummary);
      lines.push(SEP);
      lines.push(renderTeamBoxes(game, false));
    }
    return lines.join('\n');
  }

  if (game.mode === 'mines_1v1') {
    const cur = game.players[game.turnIdx % 2];
    lines.push(`💣 *دور فتح المربع الآمن عند:*`);
    if (cur) lines.push(`> \\| *${md(cur.name)}* \\|`);
    lines.push(SEP);
    lines.push(game.players.map((p, i) => scoreLine(i + 1, p.name, p.score)).join('\n'));
    return lines.join('\n');
  }

  if (game.mode === 'football_1v1') {
    const kicker = game.players[(game.round - 1) % 2];
    const keeper = game.players[1 - ((game.round - 1) % 2)];
    lines.push(`⚽ *المسدّد:*`);
    if (kicker) lines.push(`> \\| *${md(kicker.name)}* \\|`);
    lines.push(`🧤 *حارس المرمى:*`);
    if (keeper) lines.push(`> \\| *${md(keeper.name)}* \\|`);
    lines.push(SEP);
    lines.push(game.players.map((p, i) => scoreLine(i + 1, p.name, p.score, p.done ? ' ✅' : ' ⏳')).join('\n'));
    return lines.join('\n');
  }

  if (game.mode === 'football_2v2') {
    const blues = game.players.filter(x => x.team === 'blue');
    const reds = game.players.filter(x => x.team === 'red');
    const blueKicking = game.round % 2 === 1;
    const kicker = blueKicking
      ? blues[Math.floor((game.round - 1) / 2) % blues.length]
      : reds[Math.floor((game.round - 1) / 2) % reds.length];
    const keeper = blueKicking
      ? reds[Math.floor((game.round - 1) / 2) % reds.length]
      : blues[Math.floor((game.round - 1) / 2) % blues.length];
    lines.push(`⚽ *المهاجم المسدّد:*`);
    if (kicker) lines.push(`> \\| *${md(kicker.name)}* \\|`);
    lines.push(`🧤 *الحارس المتصدّي:*`);
    if (keeper) lines.push(`> \\| *${md(keeper.name)}* \\|`);
    lines.push(SEP);
    lines.push(renderTeamBoxes(game, false));
    return lines.join('\n');
  }

  if (game.mode === 'king_hill_3v3') {
    const bF = game.players.filter(x => x.team === 'blue')[game.blueFighterIdx];
    const rF = game.players.filter(x => x.team === 'red')[game.redFighterIdx];
    lines.push(`⚔️ *مواجهة الحلبة الحالية:*`);
    if (bF) lines.push(`> 🔵 \\| *${md(bF.name)}* \\|`);
    lines.push('');
    if (rF) lines.push(`> 🔴 \\| *${md(rF.name)}* \\|`);
    lines.push('');
    lines.push(`❓ *${md(game.prompt)}*`);
    lines.push(SEP);
    lines.push(renderTeamBoxes(game, false));
    return lines.join('\n');
  }

  if (game.mode === 'three_castles') {
    const qs = game.castleQuestions || [];
    lines.push(`🏰 *قلعة 1 \\(اللاعب الأول من كل فريق\\):* ${md(qs[0]?.q || '')}`);
    lines.push(`🏰 *قلعة 2 \\(اللاعب الثاني من كل فريق\\):* ${md(qs[1]?.q || '')}`);
    lines.push(`🏰 *قلعة 3 \\(اللاعب الثالث من كل فريق\\):* ${md(qs[2]?.q || '')}`);
    lines.push(SEP);
    lines.push(renderTeamBoxes(game, true));
    return lines.join('\n');
  }

  if (game.mode === 'tug_war_4v4') {
    lines.push(`🔵 ${renderRopeBar(game.ropePos)} 🔴`);
    lines.push(`❓ *${md(game.prompt)}*`);
    lines.push(SEP);
    lines.push(renderTeamBoxes(game, true));
    return lines.join('\n');
  }

  if (game.mode === 'knockout_all_4v4') {
    const hearts = (n: number) => (n > 0 ? '❤️'.repeat(n) : '💔');
    lines.push(`🔵 قلوب الأزرق: ${hearts(game.blueHearts)}  •  🔴 قلوب الأحمر: ${hearts(game.redHearts)}`);
    lines.push(`❓ *${md(game.prompt)}*`);
    lines.push(SEP);
    lines.push(renderTeamBoxes(game, true));
    return lines.join('\n');
  }

  if (game.mode === 'golden_grid_4v4') {
    lines.push(`🎯 *الدور الآن:* ${game.activeTeam === 'blue' ? '*الفريق الأزرق 🔵*' : '*الفريق الأحمر 🔴*'}`);
    if (game.selectedCell !== undefined) {
      lines.push(`🟨 *سؤال المربع \\#${game.selectedCell + 1}:* ${md(game.prompt)}`);
    } else {
      lines.push(`👇 اختر مربعاً ذهبياً لفتح سؤاله واحتلاله\\!`);
    }
    lines.push(SEP);
    lines.push(renderTeamBoxes(game, false));
    return lines.join('\n');
  }

  if (game.prompt) {
    lines.push(`❓ *${md(game.prompt)}*`);
  }
  lines.push(SEP);
  if (meta.teamSize) lines.push(renderTeamBoxes(game, true));
  else lines.push(game.players.map((p, i) => scoreLine(i + 1, p.name, p.score, p.done ? ' ✅' : ' ⏳')).join('\n'));
  return lines.join('\n');
}

export function renderArenaKeyboard(game: ArenaGame, botUsername?: string): any[][] {
  const c = game.chatId;
  const meta = ARENA_MODES[game.mode];

  if (game.status === 'lobby') {
    if (meta.teamSize) {
      return [
        [
          { text: '🔵 انضم للأزرق', callback_data: `arx:jb:${game.mode}:${c}` },
          { text: '🔴 انضم للأحمر', callback_data: `arx:jr:${game.mode}:${c}` }
        ],
        [{ text: '🎮 ابدأ المباراة', callback_data: `arx:st:${game.mode}:${c}` }]
      ];
    }
    return [
      [{ text: 'انضم', callback_data: `arx:j:${game.mode}:${c}` }],
      [{ text: '🎮 ابدأ اللعبة', callback_data: `arx:st:${game.mode}:${c}` }]
    ];
  }

  if (game.status === 'game_over') {
    return [[{ text: '🔄 لعبة جديدة', callback_data: `arx:nw:${game.mode}:${c}` }]];
  }

  if (game.status === 'memorize' || game.status === 'result') {
    return [[{ text: '⏳ استعد للجولة…', callback_data: `arx:wait:${game.mode}:${c}` }]];
  }

  if (game.status === 'arming' && game.mode === 'cowboy_duel') {
    return [[{ text: '⏳ انتظر إشارة النار…', callback_data: `arx:act:early:0:${c}` }]];
  }

  if (game.mode === 'cowboy_duel' && game.status === 'playing') {
    return [[{ text: '🔥 أطلق الآن!! 🔥', callback_data: `arx:act:fire:1:${c}` }]];
  }

  if (game.mode === 'tactical_dice') {
    return [
      [
        { text: '🎲 ارمِ النرد', callback_data: `arx:act:roll:0:${c}` },
        { text: `🏦 ثبّت الرصيد (+${game.pot})`, callback_data: `arx:act:bank:0:${c}` }
      ]
    ];
  }

  if (game.mode === 'battleship_1v1' || game.mode === 'battleship_2v2') {
    const side = game.turnIdx % 2 === 0 ? 'blue' : 'red';
    const enemy = side === 'blue' ? game.redGrid : game.blueGrid;
    const rows: any[][] = [];
    for (let r = 0; r < 4; r++) {
      const row: any[] = [];
      for (let col = 0; col < 4; col++) {
        const idx = r * 4 + col;
        const cell = enemy[idx];
        const label = cell === 2 ? '🔥' : cell === 3 ? '💨' : '🌊';
        row.push({ text: label, callback_data: `arx:act:shot:${idx}:${c}` });
      }
      rows.push(row);
    }
    return rows;
  }

  if (game.mode === 'mines_1v1') {
    const rows: any[][] = [];
    const numIcons = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
    for (let r = 0; r < 4; r++) {
      const row: any[] = [];
      for (let col = 0; col < 4; col++) {
        const idx = r * 4 + col;
        let label = '🟦';
        if (game.revealedGrid[idx]) {
          label = game.sharedGrid[idx] === -1 ? '💣' : numIcons[game.sharedGrid[idx]] || '✅';
        }
        row.push({ text: label, callback_data: `arx:act:mine:${idx}:${c}` });
      }
      rows.push(row);
    }
    return rows;
  }

  if (game.mode === 'golden_grid_4v4' && game.selectedCell === undefined) {
    const rows: any[][] = [];
    for (let r = 0; r < 4; r++) {
      const row: any[] = [];
      for (let col = 0; col < 4; col++) {
        const idx = r * 4 + col;
        const v = game.sharedGrid[idx];
        const label = v === 1 ? '🟦' : v === 2 ? '🟥' : '🟨';
        row.push({ text: label, callback_data: `arx:act:cell:${idx}:${c}` });
      }
      rows.push(row);
    }
    return rows;
  }

  if (game.mode === 'three_castles') {
    const qs = game.castleQuestions || [];
    const rows: any[][] = [];
    for (let ci = 0; ci < 3; ci++) {
      const opts = qs[ci]?.opts || [];
      rows.push(
        opts.slice(0, 2).map((o, oi) => ({
          text: `ق${ci + 1}: ${o.slice(0, 14)}`,
          callback_data: `arx:act:cas_${ci}:${oi}:${c}`
        }))
      );
      rows.push(
        opts.slice(2, 4).map((o, oi) => ({
          text: `ق${ci + 1}: ${o.slice(0, 14)}`,
          callback_data: `arx:act:cas_${ci}:${oi + 2}:${c}`
        }))
      );
    }
    return rows;
  }

  const kb: any[][] = [];
  if (game.mode === 'half_story' || game.mode === 'bomb_defuse' || game.mode === 'courtroom_4v4') {
    const secLabel =
      game.mode === 'half_story'
        ? '🔍 اكشف نصف السالفة السري'
        : game.mode === 'bomb_defuse'
          ? '📖 افتح دليل الأسلاك السري'
          : '📂 افتح ملف دليلك السري';
    kb.push([{ text: secLabel, callback_data: `arx:sec:0:0:${c}` }]);
  }

  for (let i = 0; i < game.options.length; i += 2) {
    const row: any[] = [{ text: game.options[i], callback_data: `arx:act:opt:${i}:${c}` }];
    if (game.options[i + 1] !== undefined) {
      row.push({ text: game.options[i + 1], callback_data: `arx:act:opt:${i + 1}:${c}` });
    }
    kb.push(row);
  }

  if (game.mode === 'closest_num' && botUsername) {
    kb.push([
      {
        text: '✍️ أو أرسل رقمك الدقيق بالخاص',
        url: `https://t.me/${botUsername}?start=cnum_${encodeURIComponent(c)}`
      }
    ]);
  }

  return kb;
}
