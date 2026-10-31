/**
 * اقتراح كتاب — قاعدة كتب منتقاة محلياً.
 *
 * مثل خدمة «اقترحلي شي أشوفه»، كل شي يشتغل بلا أي API خارجي: قائمة كتب
 * عربية وعالمية مع المؤلف وسنة النشر وعدد الصفحات وبلد المؤلف ونبذة قصيرة.
 * الترشيح بالسنة (عقود) والتصنيف، وبلا تكرار مباشر (excludeId).
 */
export type BookGenre =
  | 'novel'
  | 'short_stories'
  | 'poetry'
  | 'theater'
  | 'history'
  | 'philosophy'
  | 'self_help'
  | 'sci_fi'
  | 'mystery'
  | 'horror'
  | 'biography'
  | 'children';

export type BookDecade = number | 'all';

export interface BookRecommendation {
  id: string;
  title: string;
  author: string;
  year: number;
  genres: BookGenre[];
  pages: number;
  country: string;
  blurb: string;
}

export const BOOK_GENRE_LABELS: Record<BookGenre, string> = {
  novel: 'رواية',
  short_stories: 'قصة قصيرة',
  poetry: 'شعر',
  theater: 'مسرحيات',
  history: 'تاريخ',
  philosophy: 'فلسفة',
  self_help: 'تطوير الذات',
  sci_fi: 'خيال علمي',
  mystery: 'بوليسي وغموض',
  horror: 'رعب',
  biography: 'سيرة وواقعي',
  children: 'أطفال وحكايات'
};

// كل الكتب مختارة يدوياً: عربية أولاً ثم عالمية مترجمة.
const BOOKS: BookRecommendation[] = [
  /* ───────────── روايات عربية ───────────── */
  { id: 'harafish', title: 'الحرافيش', author: 'نجيب محفوظ', year: 1977, genres: ['novel'], pages: 500, country: 'مصر', blurb: 'ملحمة عن حارة مصرية وأجيالها المتعاقبة، وحكاية سلطة تتوارثها العائلات.' },
  { id: 'awlad-haretna', title: 'أولاد حارتنا', author: 'نجيب محفوظ', year: 1959, genres: ['novel'], pages: 552, country: 'مصر', blurb: 'رواية رمزية عن البحث عن العدل في حارة يتحكم بها الجبلاوي وأبناؤه.' },
  { id: 'zuqaq-elmadaq', title: 'زقاق المدق', author: 'نجيب محفوظ', year: 1947, genres: ['novel'], pages: 288, country: 'مصر', blurb: 'حياة زقاق شعبي وأحلام سكانه الصغيرة وسط تغيّرات المدينة.' },
  { id: 'elless-welkelab', title: 'اللص والكلاب', author: 'نجيب محفوظ', year: 1961, genres: ['novel'], pages: 160, country: 'مصر', blurb: 'سعيد مهران يخرج من السجن ليثأر ممن خانوه، فتتحول رحلته إلى مأساة.' },
  { id: 'rijal-fi-alshams', title: 'رجال في الشمس', author: 'غسان كنفاني', year: 1963, genres: ['novel'], pages: 100, country: 'فلسطين', blurb: 'ثلاثة فلسطينيين يبحثون عن طريق إلى الكويت في شاحنة صهريج، بحثاً عن حياة.' },
  { id: 'aed-ila-haifa', title: 'عائد إلى حيفا', author: 'غسان كنفاني', year: 1969, genres: ['novel'], pages: 96, country: 'فلسطين', blurb: 'زوجان يعودان إلى بيتهما في حيفا بعد سنوات، فيكتشفان أن الغياب غيّر كل شي.' },
  { id: 'mawsim-alhijra', title: 'موسم الهجرة إلى الشمال', author: 'الطيب صالح', year: 1966, genres: ['novel'], pages: 168, country: 'السودان', blurb: 'حكاية مصطفى سعيد بين قريته على النيل ولندن، وسؤال الهوية والاستلاب.' },
  { id: 'dhakirat-aljasad', title: 'ذاكرة الجسد', author: 'أحلام مستغانمي', year: 1993, genres: ['novel'], pages: 320, country: 'الجزائر', blurb: 'رسائل حب وذاكرة ثورة، بين رسّامة وثائر جزائري اسمه زياد.' },
  { id: 'mudun-almilh', title: 'مدن الملح', author: 'عبد الرحمن المنيف', year: 1984, genres: ['novel'], pages: 720, country: 'السعودية', blurb: 'خمس روايات عن تحوّل الخليج من صحراء إلى مدن نفطية، ودفع الناس الثمن.' },
  { id: 'saq-albamboo', title: 'ساق البامبو', author: 'سعود السنعوسي', year: 2012, genres: ['novel'], pages: 400, country: 'الكويت', blurb: 'شابّ وُلد من أب كويتي وأم فلبينية يبحث عن جذور لا تعترف به.' },
  { id: 'frankenstein-baghdad', title: 'فرانكشتاين في بغداد', author: 'أحمد سعداوي', year: 2013, genres: ['novel'], pages: 328, country: 'العراق', blurb: 'تجمّع أعضاء ضحايا الانفجارات في جسد واحد يخرج للثأر ببغداد.' },
  { id: 'alhafida-alamrikiya', title: 'الحفيدة الأميركية', author: 'إنعام كجة جي', year: 2008, genres: ['novel'], pages: 272, country: 'العراق', blurb: 'جدّة عراقية في باريس وحفيدة أميركية تلتقيان، وحكاية وطن مبعثر.' },
  { id: 'tantoriya', title: 'الطنطورية', author: 'رضوى عاشور', year: 2010, genres: ['novel'], pages: 424, country: 'مصر', blurb: 'سيرة امرأة فلسطينية من هجرة 1948 إلى المخيّمات، بذاكرة ريفية وحرب.' },
  { id: 'thulathiyat-gharnata', title: 'ثلاثية غرناطة', author: 'رضوى عاشور', year: 1994, genres: ['novel'], pages: 344, country: 'مصر', blurb: 'ثلاث روايات عن الأندلس: قبل سقوط غرناطة وبعده، ومصير من بقي.' },
  { id: 'yutopia', title: 'يوتوبيا', author: 'أحمد خالد توفيق', year: 2008, genres: ['novel', 'sci_fi'], pages: 176, country: 'مصر', blurb: 'مصر المستقبل منقسمة بأسوار: أغنياء في يوتوبيا وفقراء يقتاتون على الدم.' },

  /* ───────────── روايات عالمية ───────────── */
  { id: 'crime-punishment', title: 'الجريمة والعقاب', author: 'فيودور دوستويفسكي', year: 1866, genres: ['novel'], pages: 671, country: 'روسيا', blurb: 'طالب فقير يقتل مرابية ليختبر نظريته، فتبدأ محاكمته الأخلاقية من داخله.' },
  { id: 'karamazov', title: 'الإخوة كارامازوف', author: 'فيودور دوستويفسكي', year: 1880, genres: ['novel'], pages: 824, country: 'روسيا', blurb: 'ثلاثة إخوة وأب قاسٍ وجريمة، وصراع بين الإيمان والعقل والشهوة.' },
  { id: 'anna-karenina', title: 'آنا كارنينا', author: 'ليو تولستوي', year: 1878, genres: ['novel'], pages: 864, country: 'روسيا', blurb: 'حبّ محرّم في المجتمع الأرستقراطي الروسي، وميزان بين الشغف والانكسار.' },
  { id: 'war-and-peace', title: 'الحرب والسلام', author: 'ليو تولستوي', year: 1869, genres: ['novel', 'history'], pages: 1225, country: 'روسيا', blurb: 'عائلات روسية وحروب نابليون: تاريخ كبير يُروى من بيوت صغيرة.' },
  { id: 'hundred-years', title: 'مئة عام من العزلة', author: 'غابرييل غارسيا ماركيز', year: 1967, genres: ['novel'], pages: 448, country: 'كولومبيا', blurb: 'سبعة أجيال من عائلة بوينديا في ماكوندو، بين الواقع والوهم والخيال.' },
  { id: 'the-stranger', title: 'الغريب', author: 'ألبير كامو', year: 1942, genres: ['novel', 'philosophy'], pages: 123, country: 'فرنسا', blurb: 'مرسو يقتل رجلاً تحت شمس الجزائر، ثم يواجه سؤال معنى الحياة بلا معنى.' },
  { id: 'the-plague', title: 'الطاعون', author: 'ألبير كامو', year: 1947, genres: ['novel'], pages: 308, country: 'فرنسا', blurb: 'مدينة وهران مغلقة بوباء، وأطباء ومواطنون يختارون كيف يقاومون.' },
  { id: 'les-miserables', title: 'البؤساء', author: 'فيكتور هوغو', year: 1862, genres: ['novel'], pages: 1232, country: 'فرنسا', blurb: 'جان فالجان من السجن إلى الخلاص، وفرنسا الفقراء والثورة.' },
  { id: 'moby-dick', title: 'موبي ديك', author: 'هرمان ملفيل', year: 1851, genres: ['novel'], pages: 720, country: 'الولايات المتحدة', blurb: 'قبطان مهووس يلاحق حوتاً أبيض عبر البحار حتى الهلاك.' },
  { id: 'don-quixote', title: 'دون كيخوته', author: 'ميغيل دي ثيربانتس', year: 1605, genres: ['novel'], pages: 863, country: 'إسبانيا', blurb: 'نبيل يقرأ قصص الفروسية كثيراً فيصدّقها ويخرج بطلاً في زمن انتهى.' },
  { id: 'count-monte-cristo', title: 'الكونت دي مونت كريستو', author: 'ألكسندر دوما', year: 1844, genres: ['novel'], pages: 1276, country: 'فرنسا', blurb: 'سجين بريء يهرب ويصبح ثرياً ليدبّر ثأراً هندسياً من خونة.' },
  { id: 'madame-bovary', title: 'مادام بوفاري', author: 'غوستاف فلوبير', year: 1856, genres: ['novel'], pages: 384, country: 'فرنسا', blurb: 'زوجة طبيب ريفي تبحث عن حياة رواياتها، فتنتهي بالديون والخيانة.' },

  /* ───────────── قصص قصيرة ───────────── */
  { id: 'arkhas-layali', title: 'أرخص ليالي', author: 'يوسف إدريس', year: 1954, genres: ['short_stories'], pages: 160, country: 'مصر', blurb: 'مجموعة قصص عن الفقر والحب والمرض في الريف والمدينة، بلغة صريحة.' },
  { id: 'bayt-min-lahm', title: 'بيت من لحم', author: 'يوسف إدريس', year: 1971, genres: ['short_stories'], pages: 140, country: 'مصر', blurb: 'قصص عن العائلة والخوف والسلطة، بأسلوب يخلط اليومي بالغريب.' },
  { id: 'chekhov-stories', title: 'مختارات من قصص تشيخوف', author: 'أنطون تشيخوف', year: 1886, genres: ['short_stories'], pages: 320, country: 'روسيا', blurb: 'قصص صغيرة عن موظفين وفلاحين وأطباء، تنتهي بلحظة صمت تكشف كل شي.' },
  { id: 'metamorphosis', title: 'التحول', author: 'فرانتس كافكا', year: 1915, genres: ['short_stories'], pages: 96, country: 'التشيك', blurb: 'موظف يستيقظ حشرة، فتتغيّر علاقة عائلته فيه قبل جسده.' },
  { id: 'the-lottery', title: 'اليانصيب وقصص أخرى', author: 'شيرلي جاكسون', year: 1948, genres: ['short_stories', 'horror'], pages: 224, country: 'الولايات المتحدة', blurb: 'قرية صغيرة تحتفل بعادة سنوية، والقرعة تكشف وجهها المرعب.' },

  /* ───────────── شعر ───────────── */
  { id: 'la-oreed', title: 'لا أريد لهذه القصيدة أن تنتهي', author: 'محمود درويش', year: 1986, genres: ['poetry'], pages: 200, country: 'فلسطين', blurb: 'قصائد عن الحب والمنفى والوطن، بلغة تقترب من النثر وتترك أثره.' },
  { id: 'halat-hisar', title: 'حالة حصار', author: 'محمود درويش', year: 2002, genres: ['poetry'], pages: 80, country: 'فلسطين', blurb: 'نصّ شعري مكتوب تحت الحصار في رام الله، يخلط التفاصيل الصغيرة بالموت.' },
  { id: 'shawqiyat', title: 'الشوقيات', author: 'أحمد شوقي', year: 1898, genres: ['poetry'], pages: 480, country: 'مصر', blurb: 'ديوان أمير الشعراء: مدائح ووصف وحكايات على نهج القصيدة العربية.' },
  { id: 'almutanabbi', title: 'ديوان المتنبي', author: 'أبو الطيب المتنبي', year: 965, genres: ['poetry'], pages: 640, country: 'العراق', blurb: 'أشهر ديوان عربي: فخر وحكمة وهجاء، وما زال يُحفظ ويُردَّد.' },
  { id: 'qaria-alfinjan', title: 'قارئة الفنجان', author: 'نزار قباني', year: 1973, genres: ['poetry'], pages: 120, country: 'سوريا', blurb: 'قصيدة غنائية وأشعار حبّ بأسلوب نزار الساخر الحزين.' },

  /* ───────────── مسرحيات ───────────── */
  { id: 'hamlet', title: 'هاملت', author: 'وليام شكسبير', year: 1603, genres: ['theater'], pages: 192, country: 'إنجلترا', blurb: 'أمير الدنمارك يعرف كيف مات أبوه، فيتحول تفكيره إلى مأساة كبيرة.' },
  { id: 'macbeth', title: 'مكبث', author: 'وليام شكسبير', year: 1606, genres: ['theater'], pages: 160, country: 'إنجلترا', blurb: 'نبوءة بثلاث ساحرات تدفع قائداً طموحاً إلى القتل ثم إلى الجنون.' },
  { id: 'merchant-venice', title: 'تاجر البندقية', author: 'وليام شكسبير', year: 1596, genres: ['theater'], pages: 176, country: 'إنجلترا', blurb: 'سند دين وشرط قاسٍ: رطل من لحم المدين — ومحاكمة عن القانون والرحمة.' },
  { id: 'ahl-alkahf', title: 'أهل الكهف', author: 'توفيق الحكيم', year: 1933, genres: ['theater'], pages: 200, country: 'مصر', blurb: 'مسرحية عن أهل الكهف وعودتهم من الزمن، وسؤال هل يمكن العيش خارج زمانك.' },

  /* ───────────── تاريخ ───────────── */
  { id: 'muqaddimah', title: 'المقدمة', author: 'ابن خلدون', year: 1377, genres: ['history', 'philosophy'], pages: 640, country: 'تونس', blurb: 'أول محاولة عربية لفهم قوانين الاجتماع والعمران وصعود الدول وسقوطها.' },
  { id: 'ibn-battuta', title: 'رحلة ابن بطوطة', author: 'ابن بطوطة', year: 1355, genres: ['history'], pages: 760, country: 'المغرب', blurb: 'رحلات ثلاثين عاماً من المغرب إلى الصين، مكتوبة كحكاية شعبية حيّة.' },
  { id: 'tabari', title: 'تاريخ الطبري', author: 'محمد بن جرير الطبري', year: 915, genres: ['history'], pages: 900, country: 'العراق', blurb: 'أشهر تاريخ عربي قديم: من بداية الخلق إلى الدولة العباسية، بالسند.' },
  { id: 'story-of-civilization', title: 'قصة الحضارة', author: 'ول ديورانت', year: 1935, genres: ['history'], pages: 1100, country: 'الولايات المتحدة', blurb: 'موسوعة تروي حضارات العالم من الشرق القديم إلى العصر الحديث.' },

  /* ───────────── فلسفة ───────────── */
  { id: 'hayy-ibn-yaqzan', title: 'حي بن يقظان', author: 'ابن طفيل', year: 1160, genres: ['philosophy'], pages: 128, country: 'الأندلس', blurb: 'طفل ينشأ وحده في جزيرة فيصل بالعقل إلى معرفة الكون والإله.' },
  { id: 'tahafut', title: 'تهافت الفلاسفة', author: 'أبو حامد الغزالي', year: 1095, genres: ['philosophy'], pages: 280, country: 'بلاد فارس', blurb: 'نقد منهجي لدعاوى الفلاسفة، وهي أساس سؤال: شنو نعرف وشنو نعتقد.' },
  { id: 'zarathustra', title: 'هكذا تكلم زرادشت', author: 'فريدريك نيتشه', year: 1883, genres: ['philosophy'], pages: 352, country: 'ألمانيا', blurb: 'نبيّ يتكلم بالشِعر عن الإنسان الأعلى وموت القيم القديمة.' },

  /* ───────────── تطوير الذات ───────────── */
  { id: 'atomic-habits', title: 'العادات الذرية', author: 'جيمس كلير', year: 2018, genres: ['self_help'], pages: 320, country: 'الولايات المتحدة', blurb: 'تغيير الأنظمة الصغيرة يومياً أقوى من الاعتماد على الحماس والدوافع.' },
  { id: 'seven-habits', title: 'العادات السبع للناس الأكثر فعالية', author: 'ستيفن كوفي', year: 1989, genres: ['self_help'], pages: 381, country: 'الولايات المتحدة', blurb: 'من الاعتماد على غيره إلى الاستقلال ثم التعاون، بأولويات واضحة.' },
  { id: 'win-friends', title: 'كيف تكسب الأصدقاء وتؤثر في الناس', author: 'ديل كارنيجي', year: 1936, genres: ['self_help'], pages: 288, country: 'الولايات المتحدة', blurb: 'قواعد عملية في التعامل مع الناس مبنية على الإنصات والاحترام.' },
  { id: 'think-grow-rich', title: 'فكر تصبح غنياً', author: 'نابليون هيل', year: 1937, genres: ['self_help'], pages: 238, country: 'الولايات المتحدة', blurb: 'حوارات مع أثرياء عن الرغبة والخطة والمثابرة في بناء الثروة.' },

  /* ───────────── خيال علمي ───────────── */
  { id: '1984', title: '1984', author: 'جورج أورويل', year: 1949, genres: ['sci_fi', 'novel'], pages: 328, country: 'إنجلترا', blurb: 'دولة تراقب كل شي وتعيد كتابة التاريخ؛ وموظف يبدأ يفكر لحاله.' },
  { id: 'brave-new-world', title: 'عالم جديد شجاع', author: 'ألدوس هكسلي', year: 1932, genres: ['sci_fi'], pages: 311, country: 'إنجلترا', blurb: 'مجتمع مستقبلي يسيطر على الناس بالمتعة والتصنيف الجيني لا بالقوة.' },
  { id: 'time-machine', title: 'آلة الزمن', author: 'هربرت جورج ويلز', year: 1895, genres: ['sci_fi'], pages: 118, country: 'إنجلترا', blurb: 'مخترع يسافر إلى سنة 802701 فيجد مصير البشرية منقسماً لطرفين.' },
  { id: 'animal-farm', title: 'مزرعة الحيوان', author: 'جورج أورويل', year: 1945, genres: ['sci_fi'], pages: 112, country: 'إنجلترا', blurb: 'حيوانات تطرد صاحب المزرعة وتؤسس نظاماً، فيتكرر الظلم بلغة جديدة.' },

  /* ───────────── بوليسي وغموض ───────────── */
  { id: 'orient-express', title: 'جريمة في قطار الشرق السريع', author: 'أجاثا كريستي', year: 1934, genres: ['mystery'], pages: 256, country: 'إنجلترا', blurb: 'قطار عالق بالثلج وجثة وبوارو يسأل: من من الركاب لم يقتله؟' },
  { id: 'and-then-there-were-none', title: 'ثم لم يبقَ أحد', author: 'أجاثا كريستي', year: 1939, genres: ['mystery', 'horror'], pages: 272, country: 'إنجلترا', blurb: 'عشرة غرباء في جزيرة معزولة، وطفولة صوت تحكم عليهم بالموت واحداً واحداً.' },
  { id: 'baskervilles', title: 'كلب آل باسكرفيل', author: 'آرثر كونان دويل', year: 1902, genres: ['mystery'], pages: 256, country: 'إسكتلندا', blurb: 'أسطورة كلب شيطاني في المستنقع، وشارلوك هولمز يفكّ الخيط.' },
  { id: 'study-in-scarlet', title: 'دراسة في اللون القرمزي', author: 'آرثر كونان دويل', year: 1887, genres: ['mystery'], pages: 192, country: 'إسكتلندا', blurb: 'أول قضية لهولمز وواطسون: جثة بلا جرح ورسالة بلون الدم.' },

  /* ───────────── رعب ───────────── */
  { id: 'frankenstein', title: 'فرانكشتاين', author: 'ماري شيلي', year: 1818, genres: ['horror', 'sci_fi'], pages: 280, country: 'إنجلترا', blurb: 'عالم يخلق كائناً حياً ثم يهرب منه، والمخلوق يطالب بحقه بالحب.' },
  { id: 'dracula', title: 'دراكولا', author: 'برام ستوكر', year: 1897, genres: ['horror'], pages: 418, country: 'إيرلندا', blurb: 'مصاص دماء ينتقل من ترانسلفانيا إلى لندن، ورسائل ويوميات تتبعه.' },
  { id: 'phantom-opera', title: 'شبح الأوبرا', author: 'غاستون لورو', year: 1910, genres: ['horror'], pages: 240, country: 'فرنسا', blurb: 'وجه مخفي يسكن أوبرا باريس ويحب مغنية شابة إلى حدّ الجريمة.' },

  /* ───────────── سيرة وواقعي ───────────── */
  { id: 'al-ayyam', title: 'الأيام', author: 'طه حسين', year: 1929, genres: ['biography'], pages: 320, country: 'مصر', blurb: 'سيرة عميد الأدب العربي: طفل أعمى في القرية ثم طالب في الأزهر وباريس.' },
  { id: 'anne-frank', title: 'يوميات آن فرانك', author: 'آن فرانك', year: 1947, genres: ['biography'], pages: 283, country: 'هولندا', blurb: 'فتاة تختبئ من النازية في أمستردام وتكتب عن الخوف والأمل والبلوغ.' },
  { id: 'my-experiments-truth', title: 'قصتي مع الحقيقة', author: 'المهاتما غاندي', year: 1927, genres: ['biography'], pages: 480, country: 'الهند', blurb: 'غاندي يروي سيرته بنفسه: من جنوب أفريقيا إلى المقاومة السلمية.' },
  { id: 'i-am-malala', title: 'أنا ملالا', author: 'ملالا يوسفزاي', year: 2013, genres: ['biography'], pages: 327, country: 'باكستان', blurb: 'فتاة تطالب بحق البنات بالتعليم فتُستهدف، وتكمل الطريق من بعد الإصابة.' },

  /* ───────────── أطفال وحكايات ───────────── */
  { id: 'kalila-wa-dimna', title: 'كليلة ودمنة', author: 'عبد الله بن المقفع', year: 750, genres: ['children', 'philosophy'], pages: 240, country: 'العراق', blurb: 'حكايات على لسان الحيوانات، وكل حكاية درس في السياسة والأخلاق.' },
  { id: 'alf-layla', title: 'ألف ليلة وليلة', author: 'حكايات شعبية', year: 850, genres: ['children'], pages: 600, country: 'الشرق', blurb: 'شهرزاد تحكي للملك كل ليلة حكاية تفتح حكاية، حتى تنجو بحياتها.' },
  { id: 'alice', title: 'أليس في بلاد العجائب', author: 'لويس كارول', year: 1865, genres: ['children'], pages: 200, country: 'إنجلترا', blurb: 'فتاة تسقط في جُحر أرنب إلى عالم مقلوب المنطق والأحجام.' },
  { id: 'little-prince', title: 'الأمير الصغير', author: 'أنطوان دو سانت إكزوبيري', year: 1943, genres: ['children'], pages: 96, country: 'فرنسا', blurb: 'طيار يهبط في الصحراء ويلتقي طفلاً من كوكب آخر يحكي عن وردته.' },
  { id: 'charlie-chocolate', title: 'تشارلي ومصنع الشوكولاتة', author: 'روالد دال', year: 1964, genres: ['children'], pages: 192, country: 'إنجلترا', blurb: 'خمسة أطفال يفوزون بزيارة مصنع غريب، والفضول يعاقب كل واحد بطريقته.' }
];

export function bookGenres(): BookGenre[] {
  return Array.from(new Set(BOOKS.flatMap(book => book.genres)))
    .sort((a, b) => BOOK_GENRE_LABELS[a].localeCompare(BOOK_GENRE_LABELS[b], 'ar'));
}

export function bookDecade(year: number): number {
  return Math.floor(year / 10) * 10;
}

export function bookDecades(genre: BookGenre): number[] {
  return Array.from(new Set(BOOKS
    .filter(book => book.genres.includes(genre))
    .map(book => bookDecade(book.year))))
    .sort((a, b) => b - a);
}

export function bookDecadeLabel(decade: number): string {
  return `${decade}–${decade + 9}`;
}

export function booksFor(genre: BookGenre, decade: BookDecade = 'all'): BookRecommendation[] {
  return BOOKS.filter(book =>
    book.genres.includes(genre) && (decade === 'all' || bookDecade(book.year) === decade)
  );
}

export function pickBook(
  genre: BookGenre,
  decade: BookDecade,
  excludeId?: string
): BookRecommendation | undefined {
  const matches = booksFor(genre, decade);
  const fresh = matches.filter(book => book.id !== excludeId);
  const pool = fresh.length ? fresh : matches;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined;
}

/** كل الكتب — تستعملها الفحوص والإحصاءات. */
export function allBooks(): BookRecommendation[] {
  return BOOKS.slice();
}
