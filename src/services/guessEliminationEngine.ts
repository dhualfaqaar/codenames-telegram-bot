export type GuessCategory = 'football' | 'animals' | 'fruits' | 'mixed' | 'mashup';
export type GuessStatus = 'lobby' | 'selecting' | 'playing' | 'finished';
export interface GuessItem { id: string; name: string; traits: string[]; }
export interface GuessQuestion { id: string; label: string; trait: string; }
export interface GuessPlayer {
  id: string;
  name: string;
  dmReady?: boolean;
  dmChatId?: string;
  secretId?: string;
  eliminated: string[];
  canGuess?: boolean;
}
export interface GuessGame {
  id: string;
  chatId: string;
  chatTitle: string;
  messageId?: number;
  inlineMessageId?: string;
  /** جلسة المطابقة العشوائية تعمل بين رسائل اللاعبين الخاصة. */
  privateMatch?: boolean;
  category: GuessCategory;
  status: GuessStatus;
  players: GuessPlayer[];
  /** Per-game candidate set; mashup names are randomly recombined for every round. */
  items?: GuessItem[];
  activePlayerId?: string;
  usedQuestions: string[];
  winnerId?: string;
  createdAt: number;
}

const PLAYER_ITEMS: GuessItem[] = [
  { id: 'p1', name: 'ليونيل ميسي', traits: ['footballer', 'argentine', 'forward', 'left_foot', 'south_american'] },
  { id: 'p2', name: 'كريستيانو رونالدو', traits: ['footballer', 'portuguese', 'forward', 'right_foot', 'european'] },
  { id: 'p3', name: 'محمد صلاح', traits: ['footballer', 'arab', 'forward', 'left_foot', 'egyptian', 'african'] },
  { id: 'p4', name: 'كيليان مبابي', traits: ['footballer', 'french', 'forward', 'fast', 'european'] },
  { id: 'p5', name: 'نيمار', traits: ['footballer', 'brazilian', 'forward', 'skillful', 'south_american'] },
  { id: 'p6', name: 'لوكا مودريتش', traits: ['footballer', 'croatian', 'midfielder', 'right_foot', 'european'] },
  { id: 'p7', name: 'إيرلينغ هالاند', traits: ['footballer', 'norwegian', 'forward', 'tall', 'european'] },
  { id: 'p8', name: 'سون هيونغ مين', traits: ['footballer', 'asian', 'forward', 'left_foot'] },
  { id: 'p9', name: 'ياسر القحطاني', traits: ['footballer', 'arab', 'forward', 'retired', 'saudi', 'asian'] },
  { id: 'p10', name: 'يونس محمود', traits: ['footballer', 'iraqi', 'arab', 'forward', 'retired', 'asian'] },
  { id: 'p11', name: 'أليسون بيكر', traits: ['footballer', 'brazilian', 'goalkeeper', 'tall', 'south_american'] },
  { id: 'p12', name: 'كيفن دي بروين', traits: ['footballer', 'belgian', 'midfielder', 'right_foot', 'european'] }
];
const ANIMAL_ITEMS: GuessItem[] = [
  { id: 'a1', name: 'أسد', traits: ['animal', 'mammal', 'land', 'carnivore', 'wild'] },
  { id: 'a2', name: 'فيل', traits: ['animal', 'mammal', 'land', 'herbivore', 'wild', 'large'] },
  { id: 'a3', name: 'دلفين', traits: ['animal', 'mammal', 'water', 'carnivore', 'wild'] },
  { id: 'a4', name: 'نسر', traits: ['animal', 'bird', 'air', 'carnivore', 'wild'] },
  { id: 'a5', name: 'قط', traits: ['animal', 'mammal', 'land', 'carnivore', 'domestic'] },
  { id: 'a6', name: 'حصان', traits: ['animal', 'mammal', 'land', 'herbivore', 'domestic', 'large'] },
  { id: 'a7', name: 'تمساح', traits: ['animal', 'reptile', 'water', 'carnivore', 'wild'] },
  { id: 'a8', name: 'نحلة', traits: ['animal', 'insect', 'air', 'small'] },
  { id: 'a9', name: 'بطريق', traits: ['animal', 'bird', 'water', 'wild'] },
  { id: 'a10', name: 'زرافة', traits: ['animal', 'mammal', 'land', 'herbivore', 'wild', 'large'] },
  { id: 'a11', name: 'أخطبوط', traits: ['animal', 'water', 'carnivore', 'wild'] },
  { id: 'a12', name: 'أرنب', traits: ['animal', 'mammal', 'land', 'herbivore', 'domestic', 'small'] }
];
const FRUIT_ITEMS: GuessItem[] = [
  { id: 'f1', name: 'تفاح', traits: ['fruit', 'red', 'sweet', 'tree', 'seed'] },
  { id: 'f2', name: 'موز', traits: ['fruit', 'yellow', 'sweet', 'tropical', 'peel'] },
  { id: 'f3', name: 'برتقال', traits: ['fruit', 'orange', 'citrus', 'sweet', 'tree'] },
  { id: 'f4', name: 'ليمون', traits: ['fruit', 'yellow', 'citrus', 'sour', 'tree'] },
  { id: 'f5', name: 'عنب', traits: ['fruit', 'purple', 'sweet', 'vine', 'small'] },
  { id: 'f6', name: 'فراولة', traits: ['fruit', 'red', 'sweet', 'small', 'seed_outside'] },
  { id: 'f7', name: 'بطيخ', traits: ['fruit', 'green', 'sweet', 'large', 'water_rich'] },
  { id: 'f8', name: 'مانجو', traits: ['fruit', 'yellow', 'sweet', 'tropical', 'large'] },
  { id: 'f9', name: 'رمان', traits: ['fruit', 'red', 'sweet', 'seed', 'tree'] },
  { id: 'f10', name: 'أناناس', traits: ['fruit', 'yellow', 'sweet', 'tropical', 'spiky'] },
  { id: 'f11', name: 'خوخ', traits: ['fruit', 'orange', 'sweet', 'tree', 'pit'] },
  { id: 'f12', name: 'كرز', traits: ['fruit', 'red', 'sweet', 'small', 'pit'] }
];
const MIXED_ITEMS: GuessItem[] = [
  ...PLAYER_ITEMS.slice(0, 6), ...ANIMAL_ITEMS.slice(0, 3), FRUIT_ITEMS[0], FRUIT_ITEMS[1], FRUIT_ITEMS[6]
];
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function createMashupItems(): GuessItem[] {
  const players = shuffled(PLAYER_ITEMS);
  const fruits = shuffled(FRUIT_ITEMS);
  return players.map((player, i) => {
    const fruit = fruits[i];
    return {
      id: `m${i + 1}`,
      name: `${player.name} ${fruit.name}`,
      traits: Array.from(new Set(['mashup', ...player.traits, ...fruit.traits]))
    };
  });
}
const MASHUP_ITEMS = createMashupItems();

const QUESTIONS: Record<GuessCategory, GuessQuestion[]> = {
  football: [
    ['arabic','هل هو لاعب عربي؟','arab'],['iraqi','هل هو عراقي؟','iraqi'],['europe','هل يمثل دولة أوروبية؟','european'],
    ['forward','هل يلعب في خط الهجوم؟','forward'],['keeper','هل هو حارس مرمى؟','goalkeeper'],['midfield','هل يلعب في الوسط؟','midfielder'],
    ['left','هل يستخدم قدمه اليسرى غالباً؟','left_foot'],['retired','هل اعتزل اللعب؟','retired'],['tall','هل يُعرف بطول قامته؟','tall'],
    ['south','هل هو من أمريكا الجنوبية؟','south_american'],['fast','هل يُعرف بسرعته؟','fast'],['skill','هل يشتهر بالمهارة الفردية؟','skillful']
  ].map(([id,label,trait])=>({id,label,trait})),
  animals: [
    ['mammal','هل هو من الثدييات؟','mammal'],['bird','هل هو طائر؟','bird'],['water','هل يعيش في الماء؟','water'],['air','هل يطير؟','air'],
    ['land','هل يعيش على اليابسة؟','land'],['carnivore','هل هو لاحم؟','carnivore'],['herbivore','هل يتغذى على النباتات؟','herbivore'],
    ['domestic','هل يمكن تربيته في المنزل أو المزرعة؟','domestic'],['wild','هل يعيش عادةً في البرية؟','wild'],['large','هل هو كبير الحجم؟','large'],
    ['small','هل هو صغير الحجم؟','small'],['insect','هل هو من الحشرات؟','insect']
  ].map(([id,label,trait])=>({id,label,trait})),
  fruits: [
    ['red','هل لونه أحمر غالباً؟','red'],['yellow','هل لونه أصفر غالباً؟','yellow'],['citrus','هل هو من الحمضيات؟','citrus'],['sour','هل طعمه حامض؟','sour'],
    ['tropical','هل ينمو في المناطق الاستوائية؟','tropical'],['tree','هل ينمو على شجرة؟','tree'],['seed','هل يحتوي على بذور ظاهرة؟','seed'],
    ['peel','هل نقشره قبل أكله عادةً؟','peel'],['small','هل هو صغير الحجم؟','small'],['large','هل هو كبير الحجم؟','large'],
    ['purple','هل يميل لونه إلى البنفسجي؟','purple'],['sweet','هل طعمه حلو؟','sweet']
  ].map(([id,label,trait])=>({id,label,trait})),
  mixed: [
    ['footballer','هل هو لاعب كرة قدم؟','footballer'],['animal','هل هو حيوان؟','animal'],['fruit','هل هو فاكهة؟','fruit'],['arab','هل له صلة بالعالم العربي؟','arab'],
    ['red','هل لونه أحمر أو يغلب عليه الأحمر؟','red'],['yellow','هل لونه أصفر أو يغلب عليه الأصفر؟','yellow'],['water','هل يعيش في الماء؟','water'],
    ['mammal','هل هو من الثدييات؟','mammal'],['forward','هل يلعب في الهجوم؟','forward'],['tree','هل ينمو على شجرة؟','tree'],
    ['sweet','هل طعمه حلو؟','sweet'],['large','هل هو كبير الحجم؟','large']
  ].map(([id,label,trait])=>({id,label,trait})),
  mashup: [
    ['arab','هل اللاعب عربي؟','arab'],['iraqi','هل اللاعب عراقي؟','iraqi'],['europe','هل اللاعب أوروبي؟','european'],
    ['south','هل اللاعب من أمريكا الجنوبية؟','south_american'],['asian','هل اللاعب آسيوي؟','asian'],['yellow','هل لون الفاكهة أصفر؟','yellow'],
    ['red','هل لون الفاكهة أحمر؟','red'],['tropical','هل الفاكهة استوائية؟','tropical'],['small','هل الفاكهة صغيرة؟','small'],
    ['large','هل الفاكهة كبيرة؟','large'],['citrus','هل الفاكهة من الحمضيات؟','citrus'],['sour','هل طعم الفاكهة حامض؟','sour']
  ].map(([id,label,trait])=>({id,label,trait}))
};

export const GUESS_CATEGORY_INFO: Record<GuessCategory, { label: string; emoji: string }> = {
  football: { label: 'لاعبو كرة القدم', emoji: '⚽' },
  animals: { label: 'الحيوانات', emoji: '🐾' },
  fruits: { label: 'الفواكه', emoji: '🍉' },
  mixed: { label: 'مزيج عشوائي', emoji: '🎲' },
  mashup: { label: 'لاعبون وفواكه ممزوجة', emoji: '🥭' }
};
export const GUESS_QUESTION_SETS = QUESTIONS;

export function getGuessItems(category: GuessCategory): GuessItem[] {
  return category === 'football' ? PLAYER_ITEMS : category === 'animals' ? ANIMAL_ITEMS : category === 'fruits' ? FRUIT_ITEMS : category === 'mashup' ? MASHUP_ITEMS : MIXED_ITEMS;
}
export function createGuessGame(chatId: string, chatTitle: string, category: GuessCategory): GuessGame {
  return { id: Math.random().toString(36).slice(2, 10), chatId, chatTitle, category, status: 'lobby', players: [], items: category === 'mashup' ? createMashupItems() : undefined, usedQuestions: [], createdAt: Date.now() };
}
export function guessJoin(game: GuessGame, id: string, name: string): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: 'التحدي بدأ بالفعل.' };
  if (game.players.some(p => p.id === id)) return { ok: false, msg: 'أنت منضم بالفعل.' };
  if (game.players.length >= 2) return { ok: false, msg: 'التحدي لشخصين فقط.' };
  game.players.push({ id, name: name || 'لاعب', eliminated: [] });
  return { ok: true, msg: 'انضممت! افتح الخاص مع البوت لتختار الشخصية السرية.' };
}
export function guessStart(game: GuessGame): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: 'التحدي بدأ بالفعل.' };
  if (game.players.length !== 2) return { ok: false, msg: 'نحتاج لاعبين اثنين بالضبط.' };
  game.status = 'selecting';
  return { ok: true, msg: 'اختاروا شخصياتكم السرية بالخاص.' };
}
export function guessSelectSecret(game: GuessGame, playerId: string, itemId: string): { ok: boolean; msg: string; started: boolean } {
  if (game.status !== 'selecting') return { ok: false, msg: 'اختيار الشخصيات مغلق.', started: false };
  const player = game.players.find(p => p.id === playerId);
  const items = guessGameItems(game);
  const opponent = game.players.find(p => p.id !== playerId);
  if (!player || !items.some(item => item.id === itemId)) return { ok: false, msg: 'اختيار غير صالح.', started: false };
  if (opponent?.secretId === itemId) return { ok: false, msg: 'اختار خصمك الاسم نفسه؛ لازم كل واحد يختار اسماً مختلفاً.', started: false };
  player.secretId = itemId;
  const started = game.players.every(p => Boolean(p.secretId));
  if (started) {
    game.status = 'playing';
    game.activePlayerId = game.players[0].id;
    game.players.forEach(p => { p.eliminated = []; p.canGuess = false; });
  }
  return { ok: true, msg: started ? 'اختيرت الشخصيتان؛ بدأ التحدي!' : 'اختيارك محفوظ بسرية، بانتظار خصمك.', started };
}
export function guessGameItems(game: GuessGame): GuessItem[] {
  return game.items || getGuessItems(game.category);
}
export function guessQuestions(game: GuessGame): GuessQuestion[] {
  return QUESTIONS[game.category].filter(q => !game.usedQuestions.includes(q.id));
}
export function guessRemainingItems(game: GuessGame, playerId: string): GuessItem[] {
  const player = game.players.find(p => p.id === playerId);
  const eliminated = new Set(player?.eliminated || []);
  return guessGameItems(game).filter(item => !eliminated.has(item.id));
}
export function guessAsk(game: GuessGame, playerId: string, questionId: string): { ok: boolean; msg: string; yes?: boolean; remaining?: number; finished?: boolean } {
  if (game.status !== 'playing' || game.activePlayerId !== playerId) return { ok: false, msg: 'مو دورك هسه.' };
  const question = guessQuestions(game).find(q => q.id === questionId);
  if (!question) return { ok: false, msg: 'هذا السؤال انطرح من قبل أو مو متاح.' };
  const opponent = game.players.find(p => p.id !== playerId);
  const secret = guessGameItems(game).find(item => item.id === opponent?.secretId);
  if (!secret) return { ok: false, msg: 'الشخصية السرية غير متوفرة.' };
  const yes = secret.traits.includes(question.trait);
  const player = game.players.find(p => p.id === playerId)!;
  player.eliminated.push(...guessGameItems(game).filter(item => item.traits.includes(question.trait) !== yes).map(item => item.id));
  player.eliminated = Array.from(new Set(player.eliminated));
  player.canGuess = true;
  game.usedQuestions.push(question.id);
  const remaining = guessRemainingItems(game, playerId).length;
  if (remaining === 1) {
    game.status = 'finished';
    game.winnerId = playerId;
    return { ok: true, msg: `الجواب نعم، وبقت شخصية وحدة فقط — ${guessGameItems(game).find(x => !player.eliminated.includes(x.id))?.name}! فزت 🎉`, yes, remaining, finished: true };
  }
  return { ok: true, msg: yes ? '✅ الجواب: نعم' : '❌ الجواب: لا', yes, remaining, finished: false };
}
export function guessMakeGuess(game: GuessGame, playerId: string, itemId: string): { ok: boolean; msg: string; finished: boolean; correct: boolean } {
  if (game.status !== 'playing' || game.activePlayerId !== playerId) return { ok: false, msg: 'مو دورك هسه.', finished: false, correct: false };
  const player = game.players.find(p => p.id === playerId);
  const opponent = game.players.find(p => p.id !== playerId);
  if (!player || !opponent || !player.canGuess) return { ok: false, msg: 'اسأل سؤالاً أولاً حتى تضيّق الخيارات.', finished: false, correct: false };
  if (!guessRemainingItems(game, playerId).some(item => item.id === itemId)) return { ok: false, msg: 'هذا الاسم مستبعد؛ اختار من البقية.', finished: false, correct: false };
  if (itemId === opponent.secretId) {
    game.status = 'finished';
    game.winnerId = playerId;
    return { ok: true, msg: `🎉 صحيح! الشخصية هي ${guessGameItems(game).find(x => x.id === itemId)?.name}.`, finished: true, correct: true };
  }
  player.eliminated.push(itemId);
  const remaining = guessRemainingItems(game, playerId).length;
  if (remaining === 1) {
    game.status = 'finished';
    game.winnerId = playerId;
    const last = guessRemainingItems(game, playerId)[0];
    return { ok: true, msg: `❌ مو صحيح، لكن استبعدت البقية وبقيت ${last.name} — هي جواب خصمك! فزت 🎉`, finished: true, correct: false };
  }
  player.canGuess = false;
  game.activePlayerId = opponent.id;
  return { ok: true, msg: '❌ مو هي! استبعدناها، وينتقل الدور إلى خصمك.', finished: false, correct: false };
}
export function guessPass(game: GuessGame, playerId: string): { ok: boolean; msg: string } {
  if (game.status !== 'playing' || game.activePlayerId !== playerId || !game.players.find(p => p.id === playerId)?.canGuess) return { ok: false, msg: 'اسأل سؤالاً أولاً.' };
  const player = game.players.find(p => p.id === playerId)!;
  player.canGuess = false;
  game.activePlayerId = game.players.find(p => p.id !== playerId)?.id;
  return { ok: true, msg: 'انتهى دورك؛ انتقل الدور إلى خصمك.' };
}
