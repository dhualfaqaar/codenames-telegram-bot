export type RecommendationType = 'movie' | 'series' | 'anime';
export type RecommendationGenre =
  | 'action' | 'adventure' | 'animation' | 'comedy' | 'crime' | 'documentary'
  | 'drama' | 'family' | 'fantasy' | 'horror' | 'mystery' | 'romance' | 'sci_fi' | 'thriller' | 'western';
export type RecommendationDecade = number | 'all';

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  year: number;
  genres: RecommendationGenre[];
  blurb: string;
}

export const RECOMMENDATION_TYPE_LABELS: Record<RecommendationType, string> = {
  movie: '🎬 فيلم',
  series: '📺 مسلسل',
  anime: '🍥 أنمي'
};

export const RECOMMENDATION_GENRE_LABELS: Record<RecommendationGenre, string> = {
  action: 'أكشن',
  adventure: 'مغامرة',
  animation: 'أنيميشن',
  comedy: 'كوميديا',
  crime: 'جريمة',
  documentary: 'وثائقي',
  drama: 'دراما',
  family: 'عائلي',
  fantasy: 'فانتازيا',
  horror: 'رعب',
  mystery: 'غموض',
  romance: 'رومانسي',
  sci_fi: 'خيال علمي',
  thriller: 'تشويق',
  western: 'ويسترن'
};

// قاعدة ترشيحات منتقاة محلياً، لذلك تعمل بلا مفاتيح API أو اعتماد على خدمة خارجية.
const RECOMMENDATIONS: Recommendation[] = [
  { id: 'gold-rush', type: 'movie', title: 'The Gold Rush', year: 1925, genres: ['comedy', 'adventure'], blurb: 'كوميديا صامتة كلاسيكية عن منقّب ذهب يواجه برد ألاسكا ومواقف طريفة.' },
  { id: 'metropolis', type: 'movie', title: 'Metropolis', year: 1927, genres: ['sci_fi', 'drama', 'fantasy'], blurb: 'مدينة مستقبلية منقسمة طبقياً، ورؤية مبكرة ومؤثرة لعالم الخيال العلمي.' },
  { id: 'nosferatu', type: 'movie', title: 'Nosferatu', year: 1922, genres: ['horror', 'fantasy'], blurb: 'فيلم رعب صامت عن مصاص دماء غامض يصل إلى بلدة صغيرة.' },
  { id: 'modern-times', type: 'movie', title: 'Modern Times', year: 1936, genres: ['comedy', 'drama'], blurb: 'تشارلي شابلن يحاول النجاة من إيقاع المصانع والحياة الحديثة.' },
  { id: 'wizard-oz', type: 'movie', title: 'The Wizard of Oz', year: 1939, genres: ['fantasy', 'adventure', 'family'], blurb: 'رحلة ساحرة إلى أرض أوز برفقة أصدقاء يبحث كل واحد منهم عن أمنية.' },
  { id: 'king-kong', type: 'movie', title: 'King Kong', year: 1933, genres: ['adventure', 'horror', 'fantasy'], blurb: 'بعثة إلى جزيرة غامضة تكتشف مخلوقاً أسطورياً يغيّر مصيرها.' },
  { id: 'casablanca', type: 'movie', title: 'Casablanca', year: 1942, genres: ['romance', 'drama'], blurb: 'قصة حب وقرار صعب في مدينة تعجّ باللاجئين خلال الحرب العالمية الثانية.' },
  { id: 'bicycle-thieves', type: 'movie', title: 'Bicycle Thieves', year: 1948, genres: ['drama', 'crime'], blurb: 'أب وابنه يبحثان عن دراجة مسروقة يعتمد عليها الأب في عمله.' },
  { id: 'rear-window', type: 'movie', title: 'Rear Window', year: 1954, genres: ['mystery', 'thriller', 'crime'], blurb: 'مصوّر يراقب جيرانه من نافذته ويبدأ بالشك بوقوع جريمة.' },
  { id: 'seven-samurai', type: 'movie', title: 'Seven Samurai', year: 1954, genres: ['action', 'adventure', 'drama'], blurb: 'قرية تستعين بسبعة ساموراي للدفاع عنها في ملحمة يابانية مؤثرة.' },
  { id: 'twelve-angry-men', type: 'movie', title: '12 Angry Men', year: 1957, genres: ['drama', 'crime', 'mystery'], blurb: 'هيئة محلفين تناقش قضية واحدة، ويعيد أحدهم فحص الأدلة والشكوك.' },
  { id: 'psycho', type: 'movie', title: 'Psycho', year: 1960, genres: ['horror', 'thriller', 'mystery'], blurb: 'زيارة إلى فندق منعزل تتحول إلى لغز رعب نفسي شهير.' },
  { id: '2001', type: 'movie', title: '2001: A Space Odyssey', year: 1968, genres: ['sci_fi', 'adventure', 'mystery'], blurb: 'رحلة فضائية فلسفية تتبع اكتشافاً غامضاً ومهمة إلى المشتري.' },
  { id: 'good-bad-ugly', type: 'movie', title: 'The Good, the Bad and the Ugly', year: 1966, genres: ['western', 'action', 'adventure'], blurb: 'ثلاثة رجال يتنافسون على كنز وسط أجواء الغرب الأمريكي.' },
  { id: 'godfather', type: 'movie', title: 'The Godfather', year: 1972, genres: ['crime', 'drama'], blurb: 'حكاية عائلة كورليوني وصراع السلطة والولاء داخل عالم الجريمة.' },
  { id: 'jaws', type: 'movie', title: 'Jaws', year: 1975, genres: ['thriller', 'horror', 'adventure'], blurb: 'بلدة ساحلية تواجه خطراً في البحر قبل موسم السياحة.' },
  { id: 'star-wars', type: 'movie', title: 'Star Wars', year: 1977, genres: ['sci_fi', 'action', 'adventure', 'fantasy'], blurb: 'مغامرة فضائية عن مقاومة إمبراطورية والانضمام إلى فرسان الجيداي.' },
  { id: 'alien', type: 'movie', title: 'Alien', year: 1979, genres: ['sci_fi', 'horror', 'thriller'], blurb: 'طاقم سفينة فضائية يواجه مخلوقاً خطراً في مساحة مغلقة.' },
  { id: 'shining', type: 'movie', title: 'The Shining', year: 1980, genres: ['horror', 'drama', 'mystery'], blurb: 'عائلة تقضي الشتاء في فندق معزول تحيط به أسرار مقلقة.' },
  { id: 'back-future', type: 'movie', title: 'Back to the Future', year: 1985, genres: ['sci_fi', 'comedy', 'adventure'], blurb: 'مراهق يسافر بالخطأ إلى الماضي ويحاول إصلاح أثر رحلته على المستقبل.' },
  { id: 'cinema-paradiso', type: 'movie', title: 'Cinema Paradiso', year: 1988, genres: ['drama', 'romance'], blurb: 'صداقة طفل مع عامل سينما تتحول إلى رسالة حب للسينما والذكريات.' },
  { id: 'shawshank', type: 'movie', title: 'The Shawshank Redemption', year: 1994, genres: ['drama', 'crime'], blurb: 'سجينان يبنيان صداقة وأملاً طويل الأمد داخل سجن شاوشانك.' },
  { id: 'pulp-fiction', type: 'movie', title: 'Pulp Fiction', year: 1994, genres: ['crime', 'thriller', 'comedy'], blurb: 'حكايات متقاطعة لشخصيات مختلفة في عالم الجريمة بلوس أنجلوس.' },
  { id: 'toy-story', type: 'movie', title: 'Toy Story', year: 1995, genres: ['animation', 'comedy', 'adventure', 'family'], blurb: 'ألعاب الأطفال تعيش مغامراتها الخاصة حين لا يكون أصحابها حولها.' },
  { id: 'titanic', type: 'movie', title: 'Titanic', year: 1997, genres: ['romance', 'drama'], blurb: 'قصة حب على متن السفينة الشهيرة قبل رحلتها المأساوية.' },
  { id: 'lotr', type: 'movie', title: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001, genres: ['fantasy', 'adventure', 'action'], blurb: 'رفاق من شعوب مختلفة ينطلقون في مهمة للتخلص من خاتم خطير.' },
  { id: 'city-god', type: 'movie', title: 'City of God', year: 2002, genres: ['crime', 'drama', 'thriller'], blurb: 'شاب يحاول شق طريقه في حيّ تتصاعد فيه العصابات والعنف.' },
  { id: 'eternal-sunshine', type: 'movie', title: 'Eternal Sunshine of the Spotless Mind', year: 2004, genres: ['romance', 'sci_fi', 'drama'], blurb: 'ثنائي يحاول محو ذكرياته العاطفية، لكن المشاعر تقاوم النسيان.' },
  { id: 'dark-knight', type: 'movie', title: 'The Dark Knight', year: 2008, genres: ['action', 'crime', 'thriller'], blurb: 'باتمان يواجه خصماً يختبر حدود العدالة والنظام في مدينة غوثام.' },
  { id: 'inception', type: 'movie', title: 'Inception', year: 2010, genres: ['sci_fi', 'action', 'thriller'], blurb: 'فريق متخصص يدخل الأحلام لزرع فكرة في عقل هدفه.' },
  { id: 'interstellar', type: 'movie', title: 'Interstellar', year: 2014, genres: ['sci_fi', 'adventure', 'drama'], blurb: 'رواد فضاء يبحثون عن مستقبل للبشرية عبر رحلة بعيدة.' },
  { id: 'inside-out', type: 'movie', title: 'Inside Out', year: 2015, genres: ['animation', 'comedy', 'drama', 'family'], blurb: 'مشاعر فتاة صغيرة تدير عالمها الداخلي خلال انتقال عائلتها إلى مدينة جديدة.' },
  { id: 'arrival', type: 'movie', title: 'Arrival', year: 2016, genres: ['sci_fi', 'mystery', 'drama'], blurb: 'خبيرة لغويات تحاول التواصل مع زوار غامضين وصلوا إلى الأرض.' },
  { id: 'parasite', type: 'movie', title: 'Parasite', year: 2019, genres: ['thriller', 'drama', 'comedy'], blurb: 'عائلتان من طبقتين مختلفتين تتشابك حياتهما بطريقة غير متوقعة.' },
  { id: 'dune', type: 'movie', title: 'Dune', year: 2021, genres: ['sci_fi', 'adventure', 'action'], blurb: 'وريث شاب يصل إلى كوكب صحراوي محوري وسط صراع على السلطة.' },
  { id: 'everything-everywhere', type: 'movie', title: 'Everything Everywhere All at Once', year: 2022, genres: ['sci_fi', 'action', 'comedy', 'fantasy'], blurb: 'امرأة عادية تتنقل بين احتمالات متعددة لإنقاذ عائلتها وعوالمها.' },
  { id: 'oppenheimer', type: 'movie', title: 'Oppenheimer', year: 2023, genres: ['drama', 'thriller'], blurb: 'دراما تاريخية عن العالم الذي قاد مشروع صنع القنبلة الذرية.' },
  { id: 'past-lives', type: 'movie', title: 'Past Lives', year: 2023, genres: ['romance', 'drama'], blurb: 'صديقان من الطفولة يلتقيان بعد سنوات ويتأملان اختيارات الحياة.' },

  { id: 'twilight-zone', type: 'series', title: 'The Twilight Zone', year: 1959, genres: ['sci_fi', 'mystery', 'horror'], blurb: 'حلقات مستقلة تمزج الخيال العلمي بالغموض والنهايات المفاجئة.' },
  { id: 'fawlty-towers', type: 'series', title: 'Fawlty Towers', year: 1975, genres: ['comedy'], blurb: 'فندق صغير ومديره العصبي يقدمان كوميديا مواقف بريطانية كلاسيكية.' },
  { id: 'mash', type: 'series', title: 'M*A*S*H', year: 1972, genres: ['comedy', 'drama'], blurb: 'أطباء وطاقم مستشفى ميداني يواجهون الحرب بروح ساخرة وإنسانية.' },
  { id: 'cheers', type: 'series', title: 'Cheers', year: 1982, genres: ['comedy', 'romance'], blurb: 'رواد وموظفو حانة في بوسطن تجمعهم صداقات وحكايات يومية.' },
  { id: 'star-trek-tng', type: 'series', title: 'Star Trek: The Next Generation', year: 1987, genres: ['sci_fi', 'adventure', 'drama'], blurb: 'طاقم سفينة فضائية يستكشف عوالم جديدة ويواجه معضلات أخلاقية.' },
  { id: 'x-files', type: 'series', title: 'The X-Files', year: 1993, genres: ['sci_fi', 'mystery', 'thriller'], blurb: 'محققان يبحثان في قضايا غريبة بين الأدلة العلمية والظواهر الخارقة.' },
  { id: 'friends', type: 'series', title: 'Friends', year: 1994, genres: ['comedy', 'romance'], blurb: 'ستة أصدقاء يتشاركون تفاصيل العمل والحب والحياة في نيويورك.' },
  { id: 'sopranos', type: 'series', title: 'The Sopranos', year: 1999, genres: ['crime', 'drama'], blurb: 'زعيم مافيا يحاول الموازنة بين أسرته وحياته الإجرامية.' },
  { id: 'wire', type: 'series', title: 'The Wire', year: 2002, genres: ['crime', 'drama', 'thriller'], blurb: 'نظرة واقعية إلى الجريمة والشرطة والمؤسسات في مدينة بالتيمور.' },
  { id: 'lost', type: 'series', title: 'Lost', year: 2004, genres: ['mystery', 'adventure', 'sci_fi', 'drama'], blurb: 'ناجون من تحطم طائرة يحاولون فهم جزيرة مليئة بالأسرار.' },
  { id: 'office', type: 'series', title: 'The Office (US)', year: 2005, genres: ['comedy', 'drama'], blurb: 'حياة موظفي مكتب مبيعات تُروى بأسلوب وثائقي ساخر.' },
  { id: 'breaking-bad', type: 'series', title: 'Breaking Bad', year: 2008, genres: ['crime', 'drama', 'thriller'], blurb: 'مدرس كيمياء يدخل عالم الجريمة بعد تشخيص صحي يغيّر حياته.' },
  { id: 'sherlock', type: 'series', title: 'Sherlock', year: 2010, genres: ['crime', 'mystery', 'drama'], blurb: 'المحقق الشهير يحل قضايا معاصرة بمساعدة صديقه الدكتور واطسون.' },
  { id: 'black-mirror', type: 'series', title: 'Black Mirror', year: 2011, genres: ['sci_fi', 'thriller', 'drama'], blurb: 'حكايات منفصلة تتأمل أثر التكنولوجيا والاختيارات البشرية.' },
  { id: 'stranger-things', type: 'series', title: 'Stranger Things', year: 2016, genres: ['sci_fi', 'horror', 'mystery', 'adventure'], blurb: 'أطفال في بلدة صغيرة يواجهون اختفاءً وأحداثاً خارقة للطبيعة.' },
  { id: 'the-bear', type: 'series', title: 'The Bear', year: 2022, genres: ['drama', 'comedy'], blurb: 'طاهٍ يعود إلى مطعم عائلته ويحاول إنقاذه مع فريق مضغوط.' },
  { id: 'wednesday', type: 'series', title: 'Wednesday', year: 2022, genres: ['mystery', 'comedy', 'fantasy'], blurb: 'وينزداي آدامز تحقق في أسرار أكاديمية غريبة.' },
  { id: 'last-of-us', type: 'series', title: 'The Last of Us', year: 2023, genres: ['drama', 'adventure', 'horror'], blurb: 'رجل وفتاة يعبران عالماً دمره وباء بحثاً عن الأمان.' },

  { id: 'astro-boy', type: 'anime', title: 'Astro Boy', year: 1963, genres: ['sci_fi', 'action', 'adventure'], blurb: 'روبوت صغير يحمي الناس ويبحث عن مكانه في عالم البشر.' },
  { id: 'lupin-iii', type: 'anime', title: 'Lupin the Third', year: 1971, genres: ['action', 'comedy', 'adventure', 'crime'], blurb: 'لصّ محترف وفريقه يخوضون مغامرات سرقة ومطاردات حول العالم.' },
  { id: 'dragon-ball', type: 'anime', title: 'Dragon Ball', year: 1986, genres: ['action', 'adventure', 'comedy', 'fantasy'], blurb: 'رحلة غوكو بحثاً عن كرات التنين تتحول إلى مغامرات ومعارك.' },
  { id: 'akira', type: 'anime', title: 'Akira', year: 1988, genres: ['sci_fi', 'action', 'thriller'], blurb: 'شابان في طوكيو المستقبلية يتورطان في تجربة غامضة.' },
  { id: 'evangelion', type: 'anime', title: 'Neon Genesis Evangelion', year: 1995, genres: ['sci_fi', 'drama', 'action', 'mystery'], blurb: 'مراهقون يقودون آلات عملاقة للدفاع عن الأرض وسط صراعات نفسية.' },
  { id: 'mononoke', type: 'anime', title: 'Princess Mononoke', year: 1997, genres: ['fantasy', 'adventure', 'action'], blurb: 'أمير شاب يجد نفسه بين غابة مسحورة ومدينة صناعية.' },
  { id: 'cowboy-bebop', type: 'anime', title: 'Cowboy Bebop', year: 1998, genres: ['sci_fi', 'action', 'adventure', 'comedy'], blurb: 'صيادو جوائز يتنقلون في الفضاء وتلاحقهم ماضيهم.' },
  { id: 'naruto', type: 'anime', title: 'Naruto', year: 2002, genres: ['action', 'adventure', 'comedy', 'drama'], blurb: 'نينجا شاب يسعى إلى الاعتراف به وتحقيق حلمه في قيادة قريته.' },
  { id: 'fullmetal', type: 'anime', title: 'Fullmetal Alchemist: Brotherhood', year: 2009, genres: ['action', 'adventure', 'fantasy', 'drama'], blurb: 'أخوان يبحثان عن حجر الفيلسوف لإصلاح ما فقداه بسبب تجربة محرّمة.' },
  { id: 'death-note', type: 'anime', title: 'Death Note', year: 2006, genres: ['mystery', 'thriller', 'crime', 'fantasy'], blurb: 'طالب يعثر على دفتر خارق ويخوض لعبة ذكاء مع محقق غامض.' },
  { id: 'steins-gate', type: 'anime', title: 'Steins;Gate', year: 2011, genres: ['sci_fi', 'thriller', 'drama', 'mystery'], blurb: 'مجموعة أصدقاء تكتشف طريقة لإرسال رسائل إلى الماضي.' },
  { id: 'attack-titan', type: 'anime', title: 'Attack on Titan', year: 2013, genres: ['action', 'drama', 'fantasy', 'mystery'], blurb: 'شباب يقاتلون للبقاء خلف أسوار تحميهم من عمالقة غامضين.' },
  { id: 'your-name', type: 'anime', title: 'Your Name', year: 2016, genres: ['romance', 'fantasy', 'drama'], blurb: 'مراهقان يبدآن بتبادل الجسد والرسائل رغم أن بينهما مسافة وزمناً.' },
  { id: 'demon-slayer', type: 'anime', title: 'Demon Slayer', year: 2019, genres: ['action', 'fantasy', 'adventure'], blurb: 'تانجيرو ينضم إلى صائدي الشياطين لإنقاذ أخته.' },
  { id: 'jujutsu-kaisen', type: 'anime', title: 'Jujutsu Kaisen', year: 2020, genres: ['action', 'fantasy', 'horror'], blurb: 'طالب يدخل عالم السحر بعد ابتلاع تعويذة ملعونة.' },
  { id: 'spy-family', type: 'anime', title: 'Spy x Family', year: 2022, genres: ['comedy', 'action', 'adventure'], blurb: 'جاسوس وقاتلة وطفلة قارئة للأفكار يشكلون عائلة سرية طريفة.' },
  { id: 'frieren', type: 'anime', title: 'Frieren: Beyond Journey’s End', year: 2023, genres: ['fantasy', 'adventure', 'drama'], blurb: 'ساحرة خالدة تبدأ رحلة جديدة بعد انتهاء مغامرة أبطالها.' },
  { id: 'chainsaw-man', type: 'anime', title: 'Chainsaw Man', year: 2022, genres: ['action', 'horror', 'comedy'], blurb: 'شاب فقير يندمج مع شيطان ويصبح صائد شياطين غير تقليدي.' }
];

export function recommendationGenres(type: RecommendationType): RecommendationGenre[] {
  return Array.from(new Set(RECOMMENDATIONS.filter(item => item.type === type).flatMap(item => item.genres)))
    .sort((a, b) => RECOMMENDATION_GENRE_LABELS[a].localeCompare(RECOMMENDATION_GENRE_LABELS[b], 'ar'));
}

export function recommendationDecades(type: RecommendationType, genre: RecommendationGenre): number[] {
  return Array.from(new Set(RECOMMENDATIONS
    .filter(item => item.type === type && item.genres.includes(genre))
    .map(item => Math.floor(item.year / 10) * 10)))
    .sort((a, b) => b - a);
}

export function pickRecommendation(
  type: RecommendationType,
  genre: RecommendationGenre,
  decade: RecommendationDecade,
  excludeId?: string
): Recommendation | undefined {
  const matches = RECOMMENDATIONS.filter(item =>
    item.type === type && item.genres.includes(genre) && (decade === 'all' || Math.floor(item.year / 10) * 10 === decade)
  );
  const choices = matches.filter(item => item.id !== excludeId);
  const pool = choices.length ? choices : matches;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined;
}

export function recommendationDecadeLabel(decade: number): string {
  return `${decade}–${decade + 9}`;
}
