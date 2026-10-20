import { CodenamesEngine } from '../src/services/codenamesEngine';
import * as Wordle from '../src/services/wordleEngine';
import * as Poet from '../src/services/poetEngine';
import * as Economy from '../src/services/economy';
import { CodenamesGame, CardType, GameStats, PlayerStat, PlayerRole, Team, Player } from '../src/types/codenames';

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
}

interface TelegramChatShared {
  request_id: number;
  chat_id: number;
  title?: string;
  username?: string;
}

interface TelegramChatMember {
  status: string;
  user: TelegramUser;
}

interface TelegramChatMemberUpdated {
  chat: TelegramChat;
  from: TelegramUser;
  new_chat_member: TelegramChatMember;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  chat_shared?: TelegramChatShared;
  /** the message this one replies to (used by the owner's «حظر» replies) */
  reply_to_message?: TelegramMessage;
  // media people may send to the bot (delivered to the owner in his inbox)
  photo?: any[];
  sticker?: any;
  voice?: any;
  video?: any;
  video_note?: any;
  audio?: any;
  animation?: any;
  document?: any;
  location?: any;
  contact?: any;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  my_chat_member?: TelegramChatMemberUpdated;
}

/**
 * كلمات شائعة جداً — البوت ما يتعلمها أبداً كإساءة، حتى لا ينحظر إنسان بريء
 * بالغلط لمجرد إنه كتب كلمة عادية مثلها مثل البقية.
 */
const STOP_WORDS = new Set([
  'انت', 'انتي', 'انتو', 'انا', 'احنا', 'هذا', 'هاذ', 'هذه', 'هسه', 'هذول',
  'هو', 'هي', 'هم', 'كان', 'كانت', 'على', 'الي', 'اللي', 'شو', 'شنو', 'ليش',
  'كيف', 'وين', 'مثل', 'بس', 'ما', 'لا', 'مو', 'يا', 'من', 'في', 'عن', 'مع',
  'الى', 'قال', 'زين', 'طيب', 'اوكي', 'حبيبي', 'هلا', 'مرحبا', 'السلام',
  'عليكم', 'مساء', 'صباح', 'الخير', 'شكرا', 'اريد', 'اكو', 'اكيد', 'بعد',
  'قبل', 'كلش', 'وايد', 'هوايه', 'برب', 'تمام', 'اوك'
]);

/**
 * 🎮 صندوق الألعاب: كل لعبة بتفاصيلها وشرحها الخاص.
 * الترتيب: الصنف → اللعبة → صفحة اللعبة (الشرح + زر اللعب).
 */
interface BotGameCard {
  id: string;
  emoji: string;
  title: string;
  category: 'duo' | 'team' | 'guess' | 'luck';
  /** كم لاعب */
  players: string;
  /** وين تنلعب */
  where: string;
  /** هدف اللعبة / شرط الفوز */
  goal?: string;
  /** النقاط */
  reward?: string;
  /** الشرح الكامل */
  about: string;
  /** زر اللعب مع البوت نفسه (إن كانت تنلعب بالخاص) */
  play?: { label: string; data: string };
  /** تنلعب بقناة/كروب؟ */
  channel?: boolean;
  /** جاهزة للعب؟ (غير الجاهزة تظهر 🔜) */
  ready: boolean;
}

const BOT_GAMES: BotGameCard[] = [
  // ─────────────── 👥 ألعاب ثنائية (1 ضد 1) ───────────────
  {
    id: 'math',
    emoji: '🔢',
    title: 'تحدي الحساب',
    category: 'duo',
    players: 'لاعبين — إنت وواحد ثاني',
    where: 'هنا بالخاص',
    goal: 'أسرع واحد يضغط الجواب الصح',
    reward: 'نقطة لكل جواب صح، وأول من يجمع 5 يفوز',
    about:
      'تظهر نفس المسألة الحسابية للاثنين بنفس اللحظة (جمع وطرح وضرب)،\n' +
      'وأسرع واحد يضغط الجواب الصح ياخذ النقطة — واللي يجمع 5 نقاط أول يفوز 🏆.\n' +
      'اللعبة تقيس سرعتك ودقتك، والغلط يخليك تخسر الثانية.',
    ready: false
  },
  {
    id: 'rhyme',
    emoji: '🥊',
    title: 'تحدي القافية',
    category: 'duo',
    players: 'لاعبين — إنت وواحد ثاني',
    where: 'هنا بالخاص',
    goal: 'أكثر كلمات تقافي الكلمة المعطاة',
    about:
      'البوت يعطيكم كلمة (مثلاً: *كتاب*)، وعندكم وقت محدد تكتب كل واحد كلمات تقافيها\n' +
      '(باب، شباب، حساب…)، والكلمة المكررة ما تنحسب.\n' +
      'اللي يجيب كلمات صح أكثر يفوز 🏆.',
    ready: false
  },
  {
    id: 'longest',
    emoji: '📏',
    title: 'أطول كلمة',
    category: 'duo',
    players: 'لاعبين — إنت وواحد ثاني',
    where: 'هنا بالخاص',
    goal: 'أطول كلمة من نفس الحروف',
    about:
      'البوت يعطيكم مجموعة حروف، وكل واحد يحاول يكوّن منها أطول كلمة عربية صحيحة،\n' +
      'والكلمة لازم تكون من نفس الحروف المعطاة بلا زيادة.\n' +
      'أطول كلمة صحيحة تفوز 🏆.',
    ready: false
  },
  {
    id: 'rps',
    emoji: '✊',
    title: 'حجرة ورقة مقص',
    category: 'duo',
    players: 'لاعبين — إنت وواحد ثاني',
    where: 'بالقناة أو المجموعة',
    goal: 'تفوز على خصمك بأفضل من 3 جولات',
    reward: '0.011 💵 للفائز فقط',
    about:
      'اللعبة بالقناة: ينضغط زر العب، ينضم لاعبين (2 لاعبين)، يطلع لكل لاعب 3 أزرار (حجرة ✊ • ورقة ✋ • مقص ✌️) ويختارونهم، البوت يكشف النتيجة ويحسب الجولات (أفضل من 3 جولات) والتعادل يعيد الجولة.',
    play: { label: '🎮 العب بالقناة', data: 'hub:channel' },
    channel: true,
    ready: true
  },

  // ─────────────── ⚔️ ألعاب الفرق (2 ضد 2) ───────────────
  {
    id: 'codenames',
    emoji: '🎮',
    title: 'كود نيمز (Codenames)',
    category: 'team',
    players: '4 لاعبين — فريقين 2 ضد 2 (جاسوس 🕵️ + عميل 👤 لكل فريق)',
    where: 'بقناة أو كروب — إنت المشرف تنزّلها والأعضاء يشتركون بالأزرار',
    goal: 'أول فريق يكشف كل بطاقاته',
    about:
      'فريقين: أزرق 🔵 وأحمر 🔴، وكل فريق جاسوس 🕵️ وعميل 👤 (2 ضد 2).\n' +
      'الجاسوس يشوف خريطة البطاقات الملوّنة بالخاص، ويكتب تلميح *بكلمة وحدة + رقم* (مثلاً: بحر 2)،\n' +
      'والعملاء يخمّنون البطاقات بالقناة من ضغط الأزرار.\n' +
      'اللي يكشف كل بطاقات فريقه أول يفوز 🏁 — وإذا أحد كشف بطاقة القاتل 💀 يخسر فريقه فوراً!',
    channel: true,
    ready: true
  },

  // ─────────────── 🧠 ألعاب خمّن ───────────────
  {
    id: 'wordle',
    emoji: '🟩',
    title: 'خمّن الكلمة',
    category: 'guess',
    players: 'لاعب واحد — إنت والبوت',
    where: 'هنا بالخاص',
    goal: 'تكتشف الكلمة بـ 6 محاولات',
    reward: 'من 5 إلى 25 نقطة — كل ما كانت محاولاتك أقل نقاطك أكثر',
    about:
      'كلمة عربية من *5 حروف*، وعندك *6 محاولات*. تكتب بالضغط على الحروف من اللوحة،\n' +
      'وكل محاولة تتلوّن حتى تعرف وين غلطك:\n' +
      '🟩 الحرف بمكانه الصح • 🟨 الحرف موجود بس بمكان ثاني • ⬜ الحرف مو بالكلمة.\n' +
      'كل ما حلّيت بمحاولات أقل، نقاطك أكثر ⭐.',
    play: { label: '🤖 العب مع البوت', data: 'wl:new' },
    ready: true
  },
  {
    id: 'poet',
    emoji: '🎭',
    title: 'خمّن الشاعر',
    category: 'guess',
    players: 'لاعب واحد — إنت والبوت',
    where: 'هنا بالخاص',
    goal: 'تعرف منو ناظم البيت الشعري',
    reward: '10 نقاط إذا عرفتها من أول محاولة، و5 إذا من الثانية',
    about:
      'البوت يعرضلك *بيت شعر* مشهور، وتحتّه أربعة أسماء لشعراء عرب،\n' +
      'وإنت تختار منو ناظم البيت بالضغط على اسمه.\n' +
      'عندك *محاولتين* بس — إذا غلطت بالأولى نعلّم الغلط ❌ وتكمّل.\n' +
      'عرفتها من أول مرة؟ 10 نقاط ⭐ — من الثانية؟ 5 نقاط.',
    play: { label: '🤖 العب مع البوت', data: 'po:new' },
    ready: true
  },
  {
    id: 'guess_player',
    emoji: '⚽',
    title: 'خمّن اللاعب',
    category: 'guess',
    players: 'لاعبين — إنت وواحد ثاني',
    where: 'هنا بالخاص',
    goal: 'من يخمن اسم اللاعب أول يفوز',
    about: 'البوت يعطي تلميحات أو صورة، كل واحد يحاول يخمن اسم اللاعب أولاً — من يخمن صح أول يفوز.',
    play: { label: '🌐 العب أونلاين', data: 'room:create:guess_player' },
    ready: true
  },
  {
    id: 'guess_song',
    emoji: '🎵',
    title: 'خمّن الأغنية',
    category: 'guess',
    players: 'لاعب واحد — إنت والبوت',
    where: 'هنا بالخاص',
    goal: 'تعرف الأغنية من كلماتها',
    about:
      'البوت يوريك مقطع من كلمات أغنية مشهورة، وإنت تخمّن اسم الأغنية أو المطرب\n' +
      'من أزرار الاختيارات.\n' +
      'كل ما خمّنت بسرعة وبأقل تلميحات، نقاطك أكثر 🎶.',
    ready: false
  },

  // ─────────────── 🎲 ألعاب الحظ ───────────────
  {
    id: 'wheel',
    emoji: '🎰',
    title: 'عجلة الحظ',
    category: 'luck',
    players: 'لاعب واحد — إنت والبوت',
    where: 'هنا بالخاص',
    goal: 'ضاعف نقاطك أو اخسرها',
    about:
      'تدوّر العجلة مرة باليوم، والنتيجة إما تزيد نقاطك أو تنقصها (حظك وحظك 😅).\n' +
      'فيها جوايز مخفية ومضاعفات نادرة.',
    ready: false
  }
];

/** معلومات الأصناف (الترتيب هنا = ترتيب الشاشة) */
const GAME_CATEGORIES: Record<string, { emoji: string; title: string; intro: string }> = {
  duo: {
    emoji: '👥',
    title: 'ألعاب ثنائية (1 ضد 1)',
    intro: 'تتحدى واحد ثاني — واحد يفوز وواحد يخسر.'
  },
  team: {
    emoji: '⚔️',
    title: 'ألعاب الفرق (2 ضد 2)',
    intro: 'تنلعب بقناة أو كروب — إنت المشرف تنزّلها والأعضاء يشتركون بالأزرار.'
  },
  guess: {
    emoji: '🧠',
    title: 'ألعاب خمّن',
    intro: 'تنلعب هنا بالخاص — إنت والبوت، لحالك.'
  },
  luck: {
    emoji: '🎲',
    title: 'ألعاب الحظ',
    intro: 'حظك هو الحكم — دوّر واربح أو اخسر.'
  }
};

/** رقم اللعبة بمعرّفها */
function findBotGame(id: string): BotGameCard | undefined {
  return BOT_GAMES.find(g => g.id === id);
}


/** Everything the bot knows about one of its users. */
interface BotUserRecord {
  id: string;
  name: string;
  username?: string;
  firstSeen: number;
  lastSeen: number;
  /** pressed /start in the private chat at least once */
  started: boolean;
  /** he blocked the bot (we learnt it from a failed private message) */
  blocked: boolean;
  /** the owner banned him: the bot ignores him completely */
  banned?: boolean;
  /** how many times he interacted with the bot */
  actions: number;
  /** did we already tell the owner that this user blocked the bot? */
  blockNotified?: boolean;
  /** last time we forwarded one of his messages to the owner (throttle) */
  lastForward?: number;
  /** last time we answered him with the game explanation (throttle) */
  lastWelcome?: number;
  /** نقاط الألعاب (خمّن الكلمة وغيره) */
  points?: number;
  /** كم مرة حلّ «خمّن الكلمة» */
  wordleWins?: number;
  /** كم جولة خلّصها بـ«خمّن الكلمة» (فاز أو خسر) */
  wordleGames?: number;
  /** كم بيت عرف ناظمه بـ«خمّن الشاعر» */
  poetWins?: number;
  /** كم بيت لعبه بـ«خمّن الشاعر» (فاز أو خسر) */
  poetGames?: number;
  /** 💵 رصيد الفلوس (غالية — بس من الألعاب مع ناس حقيقيين) */
  money?: number;
  /** 🎖️ نقاط الخبرة (تزيد بكل لعبة أونلاين) */
  xp?: number;
  /** كم لعبة أونلاين لعب */
  onlineGames?: number;
  /** كم لعبة أونلاين فاز */
  onlineWins?: number;
  /** يوم آخر ربح (للسقف اليومي) */
  earnDay?: string;
  /** كم ربح بهاي اليوم */
  earnedToday?: number;
}

/** A chat the bot has seen (group, supergroup or channel). */
interface BotChatRecord {
  id: string;
  type: string;
  title: string;
  lastSeen: number;
}

export class TelegramBotManager {
  private token: string = '';
  private isPolling: boolean = false;
  private isWebhook: boolean = false;
  private webhookUrl: string = '';
  private pollAbortController: AbortController | null = null;
  private offset: number = 0;
  private botInfo: any = null;
  private lastError: string | undefined = undefined;
  private lastPollTimestamp: number = 0;

  // Active games stored in memory (Key: Chat ID string)
  private games: Map<string, CodenamesGame> = new Map();

  // Completed games history for statistics
  private completedGames: CodenamesGame[] = [];

  // Custom words per chat or global
  private customWords: string[] = [];

  // Private "no-command" clue flow:
  // user id -> game chat id that this spymaster must provide a clue for
  private awaitingClueWord: Map<string, string> = new Map();
  // user id -> the typed clue word while waiting for the number choice
  private pendingClueWord: Map<string, { chatId: string; word: string }> = new Map();

  // ---------------------------------------------------------------------
  // Users / chats / owner dashboard
  // ---------------------------------------------------------------------
  private users: Map<string, BotUserRecord> = new Map();
  private chats: Map<string, BotChatRecord> = new Map();
  /** Telegram id of the bot owner (who gets the dashboard + alerts) */
  private ownerId: string | null = null;
  /** Should the owner receive alerts (new users, blocks, ...)? */
  private ownerAlerts: boolean = true;
  /**
   * Should every message people send to the bot be delivered to the owner?
   * (He can switch this on/off from his panel — sometimes it is too noisy.)
   */
  private ownerInbox: boolean = true;
  /**
   * Banned users list is inside `users`; this maps a message the BOT sent to
   * the owner back to the user it came from, so the owner can reply "حظر".
   */
  private inboxMap: Map<string, string> = new Map();
  /** owner-message id -> the original text of the delivered message (for learning) */
  private inboxRaw: Map<string, string> = new Map();
  /** كلمات إساءة تعلّمها البوت من قرارات صاحب البوت نفسه (رد «حظر») */
  private bannedWords: string[] = [];
  /** الحظر التلقائي للسبّابين: يشتغل/ينطفي من اللوحة */
  private autoBan: boolean = true;
  /** 🟩 «خمّن الكلمة»: لعبة لكل مستخدم داخل الخاص */
  private wordle: Map<string, Wordle.WordleState> = new Map();
  /** 🎭 «خمّن الشاعر» — جولة لكل لاعب (Key: User ID) */
  private poet: Map<string, Poet.PoetRound> = new Map();

  constructor(initialToken?: string, ownerId?: string) {
    if (initialToken) {
      this.token = initialToken.trim();
    }
    if (ownerId) this.ownerId = String(ownerId);
    this.seedInitialMatchHistory();
  }

  private seedInitialMatchHistory() {
    // Seed initial realistic finished matches so stats have meaningful charts right away
    const sampleCards = [
      { id: 0, word: 'شمس', type: 'blue' as CardType, revealed: true, revealedBy: { team: 'blue' as const, playerName: 'سارة' } },
      { id: 1, word: 'بحر', type: 'blue' as CardType, revealed: true, revealedBy: { team: 'blue' as const, playerName: 'سارة' } },
      { id: 2, word: 'تاج', type: 'blue' as CardType, revealed: true, revealedBy: { team: 'blue' as const, playerName: 'أحمد' } },
      { id: 3, word: 'قمر', type: 'red' as CardType, revealed: true, revealedBy: { team: 'red' as const, playerName: 'نور' } },
      { id: 4, word: 'نار', type: 'red' as CardType, revealed: true, revealedBy: { team: 'red' as const, playerName: 'عمر' } },
      { id: 5, word: 'سيف', type: 'bystander' as CardType, revealed: true, revealedBy: { team: 'blue' as const, playerName: 'سارة' } },
      { id: 6, word: 'ليل', type: 'assassin' as CardType, revealed: false },
    ];

    const match1: CodenamesGame = {
      id: 'match_hist_1',
      chatTitle: 'كروب الشباب 🎮',
      status: 'game_over',
      startingTeam: 'blue',
      currentTurn: 'blue',
      cards: sampleCards,
      players: [
        { id: 'u1', name: 'أحمد', team: 'blue', role: 'spymaster' },
        { id: 'u2', name: 'سارة', team: 'blue', role: 'operative' },
        { id: 'u3', name: 'عمر', team: 'red', role: 'spymaster' },
        { id: 'u4', name: 'نور', team: 'red', role: 'operative' },
      ],
      clueHistory: [],
      winner: 'blue',
      winReason: 'all_cards_found',
      wordPack: 'arabic_standard',
      logs: [],
      createdAt: Date.now() - 3600000 * 4,
      updatedAt: Date.now() - 3600000 * 3.5,
    };

    const match2: CodenamesGame = {
      id: 'match_hist_2',
      chatTitle: 'ديوانية بغداد ☕',
      status: 'game_over',
      startingTeam: 'red',
      currentTurn: 'red',
      cards: [
        { id: 0, word: 'دجلة', type: 'red' as CardType, revealed: true, revealedBy: { team: 'red' as const, playerName: 'نور' } },
        { id: 1, word: 'كليجة', type: 'red' as CardType, revealed: true, revealedBy: { team: 'red' as const, playerName: 'نور' } },
        { id: 2, word: 'شناشيل', type: 'red' as CardType, revealed: true, revealedBy: { team: 'red' as const, playerName: 'علي' } },
        { id: 3, word: 'فانوس', type: 'blue' as CardType, revealed: true, revealedBy: { team: 'blue' as const, playerName: 'سارة' } },
        { id: 4, word: 'طوبة', type: 'assassin' as CardType, revealed: true, revealedBy: { team: 'blue' as const, playerName: 'حيدر' } },
      ],
      players: [
        { id: 'u3', name: 'عمر', team: 'red', role: 'spymaster' },
        { id: 'u4', name: 'نور', team: 'red', role: 'operative' },
        { id: 'u5', name: 'علي', team: 'red', role: 'operative' },
        { id: 'u1', name: 'أحمد', team: 'blue', role: 'spymaster' },
        { id: 'u6', name: 'حيدر', team: 'blue', role: 'operative' },
      ],
      clueHistory: [],
      winner: 'red',
      winReason: 'assassin_triggered',
      wordPack: 'arabic_iraqi',
      logs: [],
      createdAt: Date.now() - 3600000 * 2,
      updatedAt: Date.now() - 3600000 * 1.5,
    };

    const match3: CodenamesGame = {
      id: 'match_hist_3',
      chatTitle: 'أصدقاء الجامعة 🎓',
      status: 'game_over',
      startingTeam: 'blue',
      currentTurn: 'blue',
      cards: [
        { id: 0, word: 'ذهب', type: 'blue' as CardType, revealed: true, revealedBy: { team: 'blue' as const, playerName: 'فاطمة' } },
        { id: 1, word: 'فضة', type: 'blue' as CardType, revealed: true, revealedBy: { team: 'blue' as const, playerName: 'فاطمة' } },
        { id: 2, word: 'تاج', type: 'blue' as CardType, revealed: true, revealedBy: { team: 'blue' as const, playerName: 'سارة' } },
        { id: 3, word: 'قصر', type: 'blue' as CardType, revealed: true, revealedBy: { team: 'blue' as const, playerName: 'فاطمة' } },
        { id: 4, word: 'نور', type: 'red' as CardType, revealed: true, revealedBy: { team: 'red' as const, playerName: 'عمر' } },
      ],
      players: [
        { id: 'u7', name: 'فاطمة', team: 'blue', role: 'operative' },
        { id: 'u2', name: 'سارة', team: 'blue', role: 'operative' },
        { id: 'u1', name: 'أحمد', team: 'blue', role: 'spymaster' },
        { id: 'u3', name: 'عمر', team: 'red', role: 'spymaster' },
      ],
      clueHistory: [],
      winner: 'blue',
      winReason: 'all_cards_found',
      wordPack: 'arabic_standard',
      logs: [],
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 1800000,
    };

    this.completedGames = [match3, match2, match1];
  }

  /**
   * تسجيل مباراة خلصت + صرف جوائزها (فلوس/مستوى) مرة وحدة بس.
   * يرجّع نص الجوائز إذا انصرفت، حتى ينرسل للقناة.
   */
  public recordFinishedGame(game: CodenamesGame): string | null {
    if (game.status !== 'game_over') return null;
    const exists = this.completedGames.some(g => g.id === game.id);
    if (!exists) {
      this.completedGames.unshift(game);
      if (this.completedGames.length > 50) {
        this.completedGames = this.completedGames.slice(0, 50);
      }
    }
    if (exists) return null;
    return this.settleCodenamesMatch(game);
  }

  // ---------------------------------------------------------------------
  // 💵 اقتصاد المباريات (فلوس غالية + خبرة/مستوى) — ناس حقيقيين بس
  // ---------------------------------------------------------------------

  /** سجل اللاعب (وينشئه إذا ما موجود) حتى نحدّث محفظته */
  private walletOf(player: Player): BotUserRecord {
    const id = String(player.id);
    let rec = this.users.get(id);
    if (!rec) {
      const now = Date.now();
      rec = {
        id,
        name: player.name,
        username: player.username,
        firstSeen: now,
        lastSeen: now,
        started: false,
        blocked: false,
        banned: false,
        actions: 0
      };
    }
    return rec;
  }

  /** لاعب حقيقي؟ (أرقام تليكرام بس — نتجاهل الحسابات التجريبية والألعاب الوهمية) */
  private isRealPlayer(player: Player): boolean {
    if (!player || player.isBot) return false;
    const raw = String(player.id);
    return /^\d{5,}$/.test(raw);
  }

  /**
   * 💵 يصرف جوائز مباراة كود نيمز:
   *  - الفائزون ياخذون فلوس حسب أدائهم (بطاقات كشفوها + مستوى الخصوم).
   *  - الخاسرون والخائبون ياخذون خبرة بس (المشاركة تزيد المستوى).
   * المباريات المزروعة (match_hist_) ما تنصرف لها أي جوائز.
   */
  private settleCodenamesMatch(game: CodenamesGame): string | null {
    if (String(game.id).startsWith('match_hist_')) return null;
    if (game.rewarded) return null;
    if (!game.winner) return null;
    // مباراة قديمة/مستوردة؟ ما نصرف عليها جوائز
    if (Date.now() - (game.updatedAt || game.createdAt || 0) > 6 * 3600 * 1000) return null;

    const winners = game.players.filter(p => p.team === game.winner && this.isRealPlayer(p));
    const losers = game.players.filter(p => p.team !== game.winner && this.isRealPlayer(p));
    if (!winners.length) return null;

    // الأداء: كم بطاقة صح كشف اللاعب (والغلط ينقص من أدائه)
    const isCorrect = (c: { type: string; revealedBy?: { team?: string } }) =>
      (c.type === 'blue' || c.type === 'red') && c.type === c.revealedBy?.team;
    const teamCorrect = game.cards.filter(c => c.revealed && c.revealedBy?.team === game.winner && isCorrect(c)).length;
    const correctBy = (name: string) =>
      game.cards.filter(c => c.revealed && c.revealedBy?.playerName === name && isCorrect(c)).length;
    const wrongBy = (name: string) =>
      game.cards.filter(c => c.revealed && c.revealedBy?.playerName === name && !isCorrect(c)).length;

    const shown = winners.map(p => {
      const correct = p.role === 'spymaster' ? teamCorrect : correctBy(p.name);
      const wrong = p.role === 'spymaster' ? 0 : wrongBy(p.name);
      return { player: p, correct, wrong, score: Math.max(0, correct - 0.5 * wrong) };
    });
    const best = Math.max(1, ...shown.map(s => s.score));

    // بطاقات صح لفريق معين (تستخدم لحساب أداء الخصم أيضاً)
    const teamCorrectOf = (team?: string) =>
      game.cards.filter(c => c.revealed && c.revealedBy?.team === team && isCorrect(c)).length;

    // متوسط مستوى الخصوم — الخصم الأقوى يدفع أكثر
    const loserLevels = losers.map(p => Economy.levelFromXp(this.users.get(String(p.id))?.xp || 0));
    const opponentLevel = loserLevels.length
      ? loserLevels.reduce((a, b) => a + b, 0) / loserLevels.length
      : 1;

    const gained: {
      name: string;
      money: number;
      xp: number;
      correct: number;
      wrong: number;
      level: number;
      levelUp: boolean;
      capped: boolean;
    }[] = [];

    for (const entry of shown) {
      const p = entry.player;
      const rec = this.walletOf(p);
      const levelBefore = Economy.levelFromXp(rec.xp || 0);
      const today = Economy.earnedToday(rec);
      const performance = 0.35 + 0.65 * (entry.score / best);
      const money = Economy.moneyForWin({
        gameId: 'codenames',
        performance,
        level: levelBefore,
        opponentLevel,
        earnedToday: today
      });
      // الخبرة تزيد مع الأداء (إبداع ودقة) — وما تتجاوز حد اللعبة (15)
      const xp = Economy.xpForResult('codenames', true, performance);

      rec.money = Economy.roundMoney((rec.money || 0) + money);
      rec.xp = (rec.xp || 0) + xp;
      rec.onlineGames = (rec.onlineGames || 0) + 1;
      rec.onlineWins = (rec.onlineWins || 0) + 1;
      Economy.addEarned(rec, money);
      this.users.set(rec.id, rec);

      gained.push({
        name: p.name,
        money,
        xp,
        correct: entry.correct,
        wrong: entry.wrong,
        level: Economy.levelFromXp(rec.xp || 0),
        levelUp: Economy.levelFromXp(rec.xp || 0) > levelBefore,
        capped: money === 0 && Economy.earnedToday(rec) >= Economy.DAILY_MONEY_CAP
      });
    }

    gained.sort((a, b) => b.money - a.money);

    // الخاسرون: خبرة بس — وتختلف حسب أدائهم حتى هم (بلا أي فلوس)
    const loserScores = losers.map(p => {
      const correct = p.role === 'spymaster' ? teamCorrectOf(p.team) : correctBy(p.name);
      const wrong = p.role === 'spymaster' ? 0 : wrongBy(p.name);
      return { player: p, score: Math.max(0, correct - 0.5 * wrong) };
    });
    const loserBest = Math.max(1, ...loserScores.map(s => s.score));

    const loserParts: string[] = [];
    for (const s of loserScores) {
      const rec = this.walletOf(s.player);
      const perf = 0.35 + 0.65 * (s.score / loserBest);
      const add = Economy.xpForResult('codenames', false, perf);
      rec.xp = (rec.xp || 0) + add;
      rec.onlineGames = (rec.onlineGames || 0) + 1;
      this.users.set(rec.id, rec);
      loserParts.push(`${this.mdSafe(s.player.name)} +${add}`);
    }

    game.rewarded = true;

    const lines: string[] = [`💰 *جوائز المباراة* — ${game.winner === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴'} فاز`, `━━━━━━━━━━━━━━━━━━━`];
    gained.forEach((g, i) => {
      const bits = [`${this.statMedal(i)} ${this.mdSafe(g.name)}`];
      if (g.money > 0) bits.push(`*+${Economy.formatMoney(g.money)}* 💵`);
      else if (g.capped) bits.push(`🔒 وصل السقف اليومي`);
      if (g.xp) bits.push(`✨+${g.xp} XP`);
      if (g.correct) bits.push(`_${g.correct} بطاقة_`);
      if (g.wrong) bits.push(`_${g.wrong} غلط_`);
      if (g.levelUp) bits.push(`🎖️ مستوى *${g.level}* جديد!`);
      else bits.push(`🎖️ مستوى ${g.level}`);
      lines.push(bits.join(' • '));
    });
    if (loserParts.length) {
      lines.push(`━━━━━━━━━━━━━━━━━━━`);
      lines.push(`_خبرة الخصم: ${loserParts.join(' • ')} — بلا أي فلوس 💸_`);
    }
    if (gained.every(g => g.money === 0) && gained.some(g => g.capped)) {
      lines.push(`🔒 *السقف اليومي:* ${Economy.formatMoney(Economy.DAILY_MONEY_CAP)} باليوم — ارجع باجر 🌙`);
    }
    lines.push(`_الأداء الأحسن يجيب فلوس وخبرة أكثر 🥇_`);

    return lines.join('\n');
  }

  /**
   * 👤 حالة اللاعب — كل فقرة بسطر لحالها (فوق رسالة /start بالخاص فقط).
   * مستواه، فلوسه، مبارياته، فوزه، خبرته المطلوبة، وتعليق قصير ذكي.
   * ترجع نص فاضي إذا ما عندنا اللاعب — يعني ما ينعرض ولا شي.
   */
  private playerStatusText(rec?: BotUserRecord): string {
    if (!rec) return '';
    const p = Economy.levelProgress(rec.xp || 0);
    const money = rec.money || 0;
    const games = rec.onlineGames || 0;
    const wins = rec.onlineWins || 0;

    const lines = [
      `🎖️ مستواي: *${p.level}* (${Economy.levelTitle(p.level)})`,
      `💵 فلوسي: *${Economy.formatMoney(money)}*`,
      `🎮 مبارياتي: *${games}*`,
      `🏆 فوزي: *${wins}*`
    ];
    if (p.level < 99) lines.push(`✨ باقي *${p.left}* XP للمستوى ${p.level + 1}`);

    const vibe = Economy.walletVibe({ level: p.level, money, onlineGames: games, wins });
    lines.push(`_${vibe}_`);
    return lines.join('\n');
  }

  public addSampleFinishedGame(): CodenamesGame {
    const sampleNames = ['أحمد', 'سارة', 'عمر', 'نور', 'علي', 'فاطمة', 'حيدر', 'مريم', 'يوسف', 'زينب'];
    const sampleWords = ['شمس', 'بحر', 'تاج', 'قمر', 'نار', 'سيف', 'ليل', 'نهر', 'ذهب', 'فانوس', 'نجم', 'كتاب', 'صقر', 'درع'];
    const sampleGroups = ['ديوانية الأصدقاء 🎮', 'مجموعة الرواد 🌟', 'تحدي كود نيمز 🏆', 'شلة الأنس ☕', 'كروب الكليات 🎓'];
    
    const randomGroup = sampleGroups[Math.floor(Math.random() * sampleGroups.length)];
    const randomWinner = Math.random() > 0.45 ? 'blue' : 'red';
    const isAssassin = Math.random() < 0.25;
    const winReason = isAssassin ? 'assassin_triggered' : 'all_cards_found';

    const p1 = sampleNames[Math.floor(Math.random() * 3)];
    const p2 = sampleNames[3 + Math.floor(Math.random() * 2)];
    const p3 = sampleNames[5 + Math.floor(Math.random() * 2)];
    const p4 = sampleNames[7 + Math.floor(Math.random() * 3)];

    const cards = [];
    const guessCount = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < guessCount; i++) {
      const cardType = i % 2 === 0 ? randomWinner : (randomWinner === 'blue' ? 'red' : 'blue');
      const guesser = cardType === 'blue' ? p2 : p4;
      cards.push({
        id: i,
        word: sampleWords[i % sampleWords.length],
        type: cardType as CardType,
        revealed: true,
        revealedBy: {
          team: cardType as 'blue' | 'red',
          playerName: guesser
        }
      });
    }

    if (isAssassin) {
      cards.push({
        id: 99,
        word: 'قنبلة',
        type: 'assassin' as CardType,
        revealed: true,
        revealedBy: {
          team: (randomWinner === 'blue' ? 'red' : 'blue') as 'blue' | 'red',
          playerName: randomWinner === 'blue' ? p4 : p2
        }
      });
    }

    const newMatch: CodenamesGame = {
      id: `match_auto_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      chatTitle: `${randomGroup} #${Math.floor(Math.random() * 90 + 10)}`,
      status: 'game_over',
      startingTeam: randomWinner,
      currentTurn: randomWinner,
      cards,
      players: [
        { id: `u_${p1}`, name: p1, team: 'blue', role: 'spymaster' },
        { id: `u_${p2}`, name: p2, team: 'blue', role: 'operative' },
        { id: `u_${p3}`, name: p3, team: 'red', role: 'spymaster' },
        { id: `u_${p4}`, name: p4, team: 'red', role: 'operative' },
      ],
      clueHistory: [],
      winner: randomWinner,
      winReason,
      wordPack: 'arabic_standard',
      logs: [],
      createdAt: Date.now() - Math.floor(Math.random() * 3600000),
      updatedAt: Date.now(),
    };

    this.recordFinishedGame(newMatch);
    return newMatch;
  }

  public getStats(): GameStats {
    const allGames = [...this.completedGames];
    // Also include any active games that just reached game_over
    for (const g of this.games.values()) {
      if (g.status === 'game_over' && !allGames.some(cg => cg.id === g.id)) {
        allGames.unshift(g);
      }
    }

    const totalGamesPlayed = allGames.length;
    let blueWins = 0;
    let redWins = 0;
    let assassinTriggers = 0;
    let allCardsFoundWins = 0;
    let totalWordsGuessed = 0;

    const playerMap = new Map<string, PlayerStat>();

    for (const g of allGames) {
      if (g.winner === 'blue') blueWins++;
      if (g.winner === 'red') redWins++;

      if (g.winReason === 'assassin_triggered') assassinTriggers++;
      if (g.winReason === 'all_cards_found') allCardsFoundWins++;

      // Track players in game
      for (const p of g.players) {
        if (!playerMap.has(p.name)) {
          playerMap.set(p.name, {
            name: p.name,
            team: p.team,
            wordsGuessed: 0,
            correctGuesses: 0,
            wrongGuesses: 0,
            gamesPlayed: 0,
            winCount: 0
          });
        }
        const stat = playerMap.get(p.name)!;
        stat.gamesPlayed++;
        if (p.team === g.winner) {
          stat.winCount++;
        }
      }

      // Count revealed cards
      for (const card of g.cards) {
        if (card.revealed && card.revealedBy?.playerName) {
          totalWordsGuessed++;
          const name = card.revealedBy.playerName;
          if (!playerMap.has(name)) {
            playerMap.set(name, {
              name,
              team: card.revealedBy.team,
              wordsGuessed: 0,
              correctGuesses: 0,
              wrongGuesses: 0,
              gamesPlayed: 1,
              winCount: card.revealedBy.team === g.winner ? 1 : 0
            });
          }
          const stat = playerMap.get(name)!;
          stat.wordsGuessed++;
          if (card.type === card.revealedBy.team) {
            stat.correctGuesses++;
          } else {
            stat.wrongGuesses++;
          }
        }
      }
    }

    const playerStats = Array.from(playerMap.values()).sort((a, b) => b.correctGuesses - a.correctGuesses);
    const blueWinPercentage = totalGamesPlayed > 0 ? Math.round((blueWins / totalGamesPlayed) * 100) : 50;
    const redWinPercentage = totalGamesPlayed > 0 ? Math.round((redWins / totalGamesPlayed) * 100) : 50;

    return {
      totalGamesPlayed,
      blueWins,
      redWins,
      blueWinPercentage,
      redWinPercentage,
      assassinTriggers,
      allCardsFoundWins,
      totalWordsGuessed,
      playerStats,
      recentMatches: allGames.slice(0, 20)
    };
  }

  public getStatus() {
    const activeToken = this.token || (process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.trim() : '');
    if (!this.token && activeToken) {
      this.token = activeToken;
    }
    return {
      hasToken: Boolean(activeToken),
      tokenPreview: activeToken ? `${activeToken.slice(0, 6)}...${activeToken.slice(-4)}` : null,
      isActive: this.isPolling || this.isWebhook,
      mode: this.isWebhook ? 'webhook' : 'polling',
      webhookUrl: this.webhookUrl,
      botInfo: this.botInfo,
      activeGamesCount: this.games.size,
      lastError: this.lastError,
      lastPollTime: this.lastPollTimestamp
    };
  }

  public getGames(): CodenamesGame[] {
    return Array.from(this.games.values());
  }

  public getGame(chatId: string): CodenamesGame | undefined {
    return this.games.get(chatId);
  }

  /**
   * Serialize every piece of mutable game state.
   * Used by the Cloudflare Worker (Durable Object) to persist games across requests.
   */
  public exportState(): any {
    return {
      games: Array.from(this.games.entries()),
      completedGames: this.completedGames,
      customWords: this.customWords,
      awaitingClueWord: Array.from(this.awaitingClueWord.entries()),
      pendingClueWord: Array.from(this.pendingClueWord.entries()),
      users: Array.from(this.users.entries()),
      chats: Array.from(this.chats.entries()),
      ownerId: this.ownerId,
      ownerAlerts: this.ownerAlerts,
      ownerInbox: this.ownerInbox,
      inboxMap: Array.from(this.inboxMap.entries()),
      inboxRaw: Array.from(this.inboxRaw.entries()),
      bannedWords: this.bannedWords,
      autoBan: this.autoBan,
      wordle: Array.from(this.wordle.entries()),
      poet: Array.from(this.poet.entries())
    };
  }

  /**
   * Restore state previously produced by exportState().
   */
  public importState(state: any) {
    if (!state) return;
    if (Array.isArray(state.games)) this.games = new Map(state.games);
    if (Array.isArray(state.completedGames)) this.completedGames = state.completedGames;
    if (Array.isArray(state.customWords)) this.customWords = state.customWords;
    if (Array.isArray(state.awaitingClueWord)) this.awaitingClueWord = new Map(state.awaitingClueWord);
    if (Array.isArray(state.pendingClueWord)) this.pendingClueWord = new Map(state.pendingClueWord);
    if (Array.isArray(state.users)) this.users = new Map(state.users);
    if (Array.isArray(state.chats)) this.chats = new Map(state.chats);
    if (state.ownerId) this.ownerId = String(state.ownerId);
    if (typeof state.ownerAlerts === 'boolean') this.ownerAlerts = state.ownerAlerts;
    if (typeof state.ownerInbox === 'boolean') this.ownerInbox = state.ownerInbox;
    if (Array.isArray(state.inboxMap)) this.inboxMap = new Map(state.inboxMap);
    if (Array.isArray(state.inboxRaw)) this.inboxRaw = new Map(state.inboxRaw);
    if (Array.isArray(state.bannedWords)) this.bannedWords = state.bannedWords;
    if (typeof state.autoBan === 'boolean') this.autoBan = state.autoBan;
    if (Array.isArray(state.wordle)) this.wordle = new Map(state.wordle);
    if (Array.isArray(state.poet)) this.poet = new Map(state.poet);
  }

  public setToken(token: string) {
    const trimmed = token ? token.trim() : '';
    if (!trimmed) {
      // If empty string passed, keep existing token or fallback to env var
      if (!this.token && process.env.TELEGRAM_BOT_TOKEN) {
        this.token = process.env.TELEGRAM_BOT_TOKEN.trim();
      }
      return;
    }
    this.token = trimmed;
    this.botInfo = null;
    this.lastError = undefined;
  }

  /**
   * Test Telegram connection with current token
   */
  public async testConnection(): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.token) {
      return { success: false, error: 'لم يتم إدخال رمز البوت (Bot Token).' };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/getMe`);
      const data = await res.json();
      if (data.ok) {
        this.botInfo = data.result;
        this.lastError = undefined;
        return { success: true, data: data.result };
      } else {
        this.lastError = data.description || 'فشل التحقق من التوكن';
        return { success: false, error: this.lastError };
      }
    } catch (err: any) {
      this.lastError = err.message || 'خطأ في الاتصال بسيرفرات تلجرام';
      return { success: false, error: this.lastError };
    }
  }

  /**
   * Start long-polling Telegram API
   */
  public async startPolling(): Promise<{ success: boolean; message: string }> {
    if (!this.token && process.env.TELEGRAM_BOT_TOKEN) {
      this.token = process.env.TELEGRAM_BOT_TOKEN.trim();
    }
    if (!this.token) {
      return { success: false, message: 'يرجى إدخال Bot Token أولاً من @BotFather' };
    }

    const test = await this.testConnection();
    if (!test.success) {
      return { success: false, message: `تعذر الاتصال بالبوت: ${test.error}` };
    }

    if (this.isPolling) {
      return { success: true, message: 'البوت يعمل بالفعل!' };
    }

    // ⚠️ ما نمسح وصلة الاستقبال (Webhook) — البوت مستضاف على Cloudflare
    // وتشغيل نسخة ثانية هنا يسكته للأبد. نفحصها ونرفض بدل ما نكسر البوت.
    try {
      const info = await fetch(`https://api.telegram.org/bot${this.token}/getWebhookInfo`).then(r => r.json());
      const hooked = info?.result?.url;
      if (hooked) {
        return {
          success: false,
          message:
            'البوت مستضاف ويستقبل الرسائل عبر وصلة (Webhook) — التشغيل المحلي يوقفها ويطير البوت. ' +
            'خلّه مستضاف، أو احذف الوصلة أولاً إذا تبي تشغّله محلياً.'
        };
      }
    } catch {
      // فشل الفحص — نكمل كالمعتاد
    }

    // Clear any conflicting webhooks before polling
    try {
      await fetch(`https://api.telegram.org/bot${this.token}/deleteWebhook`);
    } catch (e) {
      // ignore
    }

    this.isPolling = true;
    this.pollAbortController = new AbortController();
    this.runPollingLoop();

    return {
      success: true,
      message: `تم تشغيل البوت بنجاح باسم @${this.botInfo?.username || 'بوت كود نيمز'}!`
    };
  }

  /**
   * Stop polling
   */
  public stopPolling() {
    this.isPolling = false;
    if (this.pollAbortController) {
      this.pollAbortController.abort();
      this.pollAbortController = null;
    }
  }

  /**
   * Register Webhook for 24/7 on-demand execution
   */
  public async setWebhook(url: string): Promise<{ success: boolean; message: string; description?: string }> {
    if (!this.token) {
      return { success: false, message: 'يرجى إدخال Bot Token أولاً' };
    }

    this.stopPolling();

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/setWebhook?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.ok) {
        this.isWebhook = true;
        this.webhookUrl = url;
        this.lastError = undefined;
        return { success: true, message: 'تم تفعيل وضع الويب هوك (Webhook) بنجاح! البوت الآن يستقبل الرسائل على مدار الساعة.' };
      } else {
        this.lastError = data.description;
        return { success: false, message: data.description || 'فشل تسجيل الويب هوك في تلجرام' };
      }
    } catch (e: any) {
      this.lastError = e.message;
      return { success: false, message: e.message || 'خطأ في الاتصال بتلجرام' };
    }
  }

  /**
   * Delete Webhook and switch back
   */
  public async removeWebhook(): Promise<{ success: boolean; message: string }> {
    if (!this.token) return { success: false, message: 'لا يوجد توكن' };

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/deleteWebhook`);
      const data = await res.json();
      if (data.ok) {
        this.isWebhook = false;
        this.webhookUrl = '';
        return { success: true, message: 'تم إلغاء الويب هوك بنجاح.' };
      }
      return { success: false, message: data.description || 'فشل إلغاء الويب هوك' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Background polling loop
   */
  private async runPollingLoop() {
    while (this.isPolling) {
      this.lastPollTimestamp = Date.now();
      try {
        const url = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.offset}&timeout=25`;
        const res = await fetch(url, {
          signal: this.pollAbortController?.signal
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.offset = Math.max(this.offset, update.update_id + 1);
            await this.handleUpdate(update);
          }
        } else if (!data.ok) {
          this.lastError = data.description;
          await new Promise(r => setTimeout(r, 3000));
        }
      } catch (err: any) {
        if (err.name === 'AbortError') break;
        this.lastError = err.message;
        // Wait 3 seconds on error before retrying
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  /**
   * Handle incoming Telegram Update (Webhook or Polling or Simulator)
   */
  public async handleUpdate(update: TelegramUpdate) {
    try {
      const incoming = update.message || update.channel_post;

      // ---- bookkeeping: chats + users (used by the owner dashboard) ----
      const chat = incoming?.chat || update.callback_query?.message?.chat;
      if (chat) this.trackChat(chat);

      const actor = incoming?.from || update.callback_query?.from;
      if (actor && !actor.is_bot) {
        const record = this.trackUser(actor, false);

        // The owner banned him → the bot ignores him completely, silently.
        if ((record.banned || record.blocked) && !this.isOwner(actor.id)) {
          if (update.callback_query) {
            await this.answerCallbackQuery(update.callback_query.id, '');
          }
          return;
        }
      }

      if (incoming) {
        await this.handleMessage(incoming);
      } else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      } else if (update.my_chat_member) {
        await this.handleMyChatMember(update.my_chat_member);
      }
    } catch (e: any) {
      console.error('Error handling Telegram update:', e);
    }
  }

  /**
   * Process Chat Messages & Commands
   */
  private async handleMessage(message: TelegramMessage) {
    const chatId = String(message.chat.id);
    const text = message.text?.trim() || '';
    const sender = message.from;
    const senderName = sender ? (sender.first_name + (sender.last_name ? ` ${sender.last_name}` : '')) : 'مجهول';

    // Result of "share the game to a channel" (chat_shared service message)
    if (message.chat_shared) {
      await this.handleChatShared(message);
      return;
    }

    if (!text) {
      // صور / ملصقات / صوتيات — توصل لصاحب البوت هم، وما يجي العضو أي رد.
      if (message.chat.type === 'private' && sender && !this.isOwner(sender.id)) {
        await this.forwardToOwnerInbox(message, sender);
      }
      return;
    }

    const lower = text.toLowerCase();

    // ------------------------------------------------------------------
    // Owner: replying «حظر» to a delivered message bans that user
    // ------------------------------------------------------------------
    if (
      message.chat.type === 'private' &&
      sender &&
      this.isOwner(sender.id) &&
      message.reply_to_message
    ) {
      const targetId = this.inboxMap.get(String(message.reply_to_message.message_id));
      if (targetId) {
        const clean = text.replace(/[إأآٱ]/g, 'ا').replace(/[ًٌٍَُِّْـ]/g, '').trim();
        const target = this.users.get(targetId) || { id: targetId };

        if (clean === 'حظر' || clean === 'حض' || clean === 'بلك' || clean === 'block' || clean === 'حظر!') {
          await this.setBanned(targetId, true);
          // البوت يتعلّم من قرارك: نفس الكلام بعد لا يمرّ على أي واحد ثاني.
          const raw = this.inboxRaw.get(String(message.reply_to_message.message_id));
          if (raw) this.learnAbuse(raw);
          await this.sendMessage(
            chatId,
            `🛑 *تم الحظر:* ${this.linkUser(target)}\n` +
              `البوت صار يتجاهله تماماً — لا رسائل ولا أزرار ولا أي رد.\n\n` +
              `_(إذا تريد ترجّعه، رد على نفس الرسالة واكتب: الغاء الحظر)_`
          );
          return;
        }
        if (['الغاء الحظر', 'فك الحظر', 'الغاء', 'الغ حظر', 'رفع الحظر'].includes(clean)) {
          await this.setBanned(targetId, false);
          await this.sendMessage(chatId, `✅ *تم مسح الحظر عن:* ${this.linkUser(target)}`);
          return;
        }
      }
    }

    // ------------------------------------------------------------------
    // المالك: فك الحظر باليوزر — يكتب «الغاء حظر @username» (أو الآيدي)
    // ------------------------------------------------------------------
    if (message.chat.type === 'private' && sender && this.isOwner(sender.id)) {
      const unban = text.match(/^\s*(?:الغاء|الغ|فك|رفع)\s*(?:ال)?حظر\s*[،,:\-+]*\s*@?(\S+)\s*$/);
      if (unban) {
        const handle = unban[1].trim();
        const asId = /^\d+$/.test(handle);
        const target = Array.from(this.users.values()).find(u =>
          asId ? u.id === handle : (u.username || '').toLowerCase() === handle.toLowerCase()
        );

        if (!target) {
          await this.sendMessage(
            chatId,
            asId
              ? `⚠️ ما لكيت حساب بهذا الآيدي: \`${handle}\``
              : `⚠️ ما لكيت حساب بيوزر @${handle} — تأكد من اليوزر عدل.`
          );
          return;
        }

        await this.setBanned(target.id, false);
        await this.sendMessage(chatId, `✅ *تم مسح الحظر عن:* ${this.linkUser(target)}`);
        return;
      }
    }

    // Spymaster typing the clue word privately (NO command needed)
    if (message.chat.type === 'private' && sender && !text.startsWith('/')) {
      const pendingGameId = this.awaitingClueWord.get(String(sender.id));
      if (pendingGameId) {
        await this.handleClueWordInput(pendingGameId, sender, text);
        return;
      }
    }

    // زر «🎮 الألعاب» من كيبورد الخاص القديم — يفتح قائمة الألعاب (للجميع، حتى المالك)
    if (message.chat.type === 'private' && text === '🎮 الألعاب') {
      const view = await this.buildGamesMenu(
        'main',
        sender ? this.users.get(String(sender.id)) : undefined
      );
      await this.sendMessage(chatId, await this.withBotFooter(view.text), view.keyboard);
      await this.clearReplyKeyboard(chatId);
      return;
    }

    // Owner dashboard button (private chat only)
    if (message.chat.type === 'private' && text === '👑 لوحة التحكم' && this.isOwner(sender?.id)) {
      await this.sendAdminPanel(chatId);
      return;
    }

    // /start command
    if (lower.startsWith('/start')) {
      if (message.chat.type === 'private') {
        const payload = (text.split(/\s+/)[1] || '').toLowerCase();
        if (payload === 'spy') {
          await this.handleSpymasterReady(chatId, sender);
          return;
        }

        // He opened the bot in private → mark him as "started" (+ tell the owner)
        if (sender) {
          const before = this.users.get(String(sender.id));
          const wasStarted = Boolean(before?.started);
          this.trackUser(sender, true);

          if (!wasStarted) {
            if (this.ownerAlerts && !this.isOwner(sender.id)) {
              const rec = this.users.get(String(sender.id));
              if (rec) {
                await this.notifyOwner(`🆕 شغّل البوت: ${this.linkUser(rec)}`);
              }
            }
          }
        }

        await this.sendPrivateWelcome(chatId, senderName);

        if (this.isOwner(sender?.id)) {
          await this.sendAdminPanel(chatId);
        }
        return;
      } else {
        // Group or channel start
        const creator = await this.resolveCreator(chatId, message);
        await this.startNewGameLobby(chatId, message.chat.title || 'مجموعة اللعب', creator);
        return;
      }
    }

    // ملاحظة: البوت يعتمد كلياً على الأزرار والقناة/الخاص.
    // لا توجد أي أوامر غير /start — أي شيء آخر يُتجاهل.

    // كل شي آخر يكتبه الناس للبوت بالخاص:
    //  1) يوصل لصاحب البوت (الاسم أزرق + الآيدي + النص) حتى يعرف منو اللي يسيء.
    //  2) والشخص ما يشوف إلا رسالة شرح اللعبة — ولا شي غيرها بالدنيا.
    if (message.chat.type === 'private' && sender && !this.isOwner(sender.id)) {
      // 0) السباب: إذا الرسالة بيها إساءة واضحة → حظر تلقائي فوري وبلا أي رد.
      const abuse = this.autoBan ? this.checkAbuse(text) : { ban: false, flag: false };
      if (abuse.ban) {
        const rec = this.trackUser(sender, false);
        await this.setBanned(rec.id, true);
        this.learnAbuse(text);
        const alert = await this.notifyOwner(
          `🛡️ *حظر تلقائي (سباب)*\n` +
            `👤 ${this.linkUser(rec)}\n` +
            `🆔 \`${rec.id}\`\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `${this.escapeMd(text)}\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `📴 البوت صار يتجاهله تماماً.\n` +
            `_(إذا تريد ترجّعه: رد هنا واكتب: الغاء الحظر)_`
        );
        const alertId = alert?.result?.message_id;
        if (alertId) {
          this.inboxMap.set(String(alertId), rec.id);
          this.trimInboxMap();
        }
        return;
      }

      // 1) يوصل لصاحب البوت (الاسم أزرق + الآيدي + النص) حتى يعرف منو اللي يسيء.
      await this.forwardToOwnerInbox(message, sender, abuse.flag);

      // 2) والشخص ما يشوف إلا رسالة شرح اللعبة — ولا شي غيرها بالدنيا.
      const rec = this.users.get(String(sender.id));
      const now = Date.now();
      if (!rec || !rec.lastWelcome || now - rec.lastWelcome > 10000) {
        if (rec) {
          rec.lastWelcome = now;
          this.users.set(rec.id, rec);
        }
        await this.sendPrivateWelcome(chatId, senderName);
      }
    }
  }

  /**
   * Handle Callback Queries from Telegram Inline Buttons
   */
  private async handleCallbackQuery(cb: TelegramCallbackQuery) {
    const data = cb.data || '';
    const chatId = String(cb.message?.chat.id || cb.from.id);
    const userId = cb.from.id;
    const userName = cb.from.first_name + (cb.from.last_name ? ` ${cb.from.last_name}` : '');

    // ---- owner dashboard buttons (only the owner may use them) ----
    if (data.startsWith('admin:')) {
      // Invisible moderation: anyone who is not the owner is simply ignored —
      // no error, no hint that a dashboard (or an owner) even exists.
      if (!this.isOwner(userId)) {
        await this.answerCallbackQuery(cb.id, '');
        return;
      }

      const messageId = cb.message?.message_id;
      const parts = data.split(':');

      if (data === 'admin:noop') {
        await this.answerCallbackQuery(cb.id, '');
        return;
      }
      if (data === 'admin:alerts') {
        this.ownerAlerts = !this.ownerAlerts;
        await this.answerCallbackQuery(
          cb.id,
          this.ownerAlerts ? '🔔 الإشعارات مفعّلة' : '🔕 الإشعارات معطّلة'
        );
        await this.sendAdminPanel(chatId, messageId);
        return;
      }
      if (data === 'admin:panel' || data === 'admin:stats') {
        await this.answerCallbackQuery(cb.id, 'محدّث ✅');
        await this.sendAdminPanel(chatId, messageId);
        return;
      }
      if (parts[1] === 'list') {
        await this.answerCallbackQuery(cb.id, '');
        await this.sendUserList(chatId, messageId, parts[2] || 'all', parseInt(parts[3] || '0', 10));
        return;
      }
      if (parts[1] === 'u') {
        await this.answerCallbackQuery(cb.id, '');
        await this.sendUserDetail(chatId, messageId, parts[2] || '');
        return;
      }
      if (data === 'admin:inbox') {
        this.ownerInbox = !this.ownerInbox;
        await this.answerCallbackQuery(
          cb.id,
          this.ownerInbox ? '📨 وصل الرسائل: مفعّل' : '📴 وصل الرسائل: معطّل'
        );
        await this.sendAdminPanel(chatId, messageId);
        return;
      }
      if (data === 'admin:autoban') {
        this.autoBan = !this.autoBan;
        await this.answerCallbackQuery(
          cb.id,
          this.autoBan ? '🛡️ الحظر التلقائي: مفعّل' : '🛡️ الحظر التلقائي: معطّل'
        );
        await this.sendAdminPanel(chatId, messageId);
        return;
      }
      if (parts[1] === 'ban') {
        const target = this.users.get(parts[2] || '');
        if (!target) {
          await this.answerCallbackQuery(cb.id, 'المستخدم غير موجود.', true);
          return;
        }
        target.banned = !target.banned;
        this.users.set(target.id, target);
        await this.answerCallbackQuery(
          cb.id,
          target.banned ? `🚫 حظرت ${target.name}` : `✅ مسحت الحظر عن ${target.name}`
        );
        await this.sendUserDetail(chatId, messageId, target.id);
        return;
      }

      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    // ---- 📊 إحصائيات الألعاب (متاحة للكل — للقراءة فقط، بلا أي تأثير على اللاعبين) ----
    if (data.startsWith('gstat:')) {
      await this.handleGameStats(cb, data.slice(6));
      return;
    }

    // ---- 💰 المتصدرون بالفلوس / المستوى / ملفي (عامة — قراءة بس) ----
    if (data.startsWith('rank:')) {
      await this.handleRanking(cb, data.slice(5));
      return;
    }

    // ---- 🎮 قائمة الألعاب و«خمّن الكلمة» (كلها بالخاص) ----
    if (data.startsWith('hub:')) {
      await this.handleGamesMenu(cb, data.slice(4));
      return;
    }
    if (data.startsWith('wl:')) {
      await this.handleWordleKey(cb, data.slice(3));
      return;
    }
    if (data.startsWith('po:')) {
      await this.handlePoetKey(cb, data.slice(3));
      return;
    }

    // Number chosen for a private clue (no-command flow) — this comes from the DM, not the game chat
    if (data.startsWith('setclue:')) {
      await this.handleClueNumberChoice(cb, parseInt(data.split(':')[1], 10));
      return;
    }
    if (data === 'setclue_cancel') {
      this.pendingClueWord.delete(String(userId));
      if (cb.message?.message_id) {
        await this.editMessageText(String(userId), cb.message.message_id, '❌ تم إلغاء التلميح. اكتب كلمة جديدة وقت ما يحين دورك.');
      }
      await this.answerCallbackQuery(cb.id, 'تم الإلغاء');
      return;
    }

    // ---- «هل تريد الانسحاب؟» — هذه الأزرار بالخاص، فاللعبة تنحدد بالمعرّف داخل الزر
    if (data.startsWith('leave:')) {
      const parts = data.split(':');
      const answer = parts[1];
      const targetChatId = parts.slice(2).join(':');
      const targetGame = this.games.get(targetChatId);

      if (!targetGame || targetGame.status !== 'lobby') {
        await this.answerCallbackQuery(cb.id, 'ما صار انسحاب — اللعبة انطلقت بالفعل.', true);
        if (cb.message?.message_id) {
          await this.editMessageText(
            String(userId),
            cb.message.message_id,
            'ℹ️ ما تقدر تنسحب هسه — اللعبة انطلقت بالفعل.'
          );
        }
        return;
      }

      if (answer !== 'yes') {
        if (cb.message?.message_id) {
          await this.editMessageText(
            String(userId),
            cb.message.message_id,
            `✅ تمام — إنت باقي على مقعدك.\n\n` +
              `🔁 وإذا تريد تبدّل، اضغط على أي مقعد فاضي بلوحة اللعبة:\n` +
              `▪️ ${this.freeSeatsText(targetGame)}`
          );
        }
        await this.answerCallbackQuery(cb.id, '✅ تمام، إنت باقي على مقعدك');
        return;
      }

      const left = CodenamesEngine.leaveGame(targetGame, userId);
      if (!left.success) {
        await this.answerCallbackQuery(cb.id, left.message, true);
        return;
      }

      this.games.set(targetChatId, left.game);
      await this.updateTelegramGameBoard(targetChatId, left.game);

      if (cb.message?.message_id) {
        await this.editMessageText(
          String(userId),
          cb.message.message_id,
          `🚪 تم انسحابك من اللعبة.\n\n` +
            `تقدر ترجع بأي وقت بالضغط على أي مقعد فاضي بلوحة اللعبة 👇`
        );
      }
      await this.answerCallbackQuery(cb.id, '🚪 تم الانسحاب');
      return;
    }

    let game = this.games.get(chatId);

    // If no game in this chat, notify (game:new can create one from scratch)
    if (!game && !data.startsWith('action:secret_map') && data !== 'game:new') {
      await this.answerCallbackQuery(cb.id, 'لا توجد لعبة نشطة في هذه المحادثة! ابدأ لعبة جديدة من الخاص بأمر /start.');
      return;
    }

    // 1. Join Team or Role: join:blue:operative, join:blue:spymaster, etc.
    if (data.startsWith('join:') && game) {
      const [, team, role] = data.split(':');

      // He pressed the SAME seat he already owns → offer to leave the game.
      const mine = game.players.find(p => String(p.id) === String(userId));
      if (mine && mine.team === team && mine.role === (role as PlayerRole)) {
        if (game.status !== 'lobby') {
          await this.answerCallbackQuery(cb.id, 'هذا مقعدك بالفعل — اللعبة انطلقت.', true);
          return;
        }

        const roleName = role === 'spymaster' ? 'جاسوس 🕵️' : 'عميل 👤';
        const teamName = team === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
        const dm = await this.sendMessage(
          String(userId),
          `🚪 *إنت مسجّل بالفعل:* ${roleName} — فريق ${teamName}\n` +
            `فعلاً تريد تنسحب من لعبة «${this.mdSafe(game.chatTitle || 'اللعبة')}»؟\n\n` +
            `_إذا نسحبت، مقعدك يصير فاضي وواحد ثاني يقدر ياخذه._`,
          [
            [{ text: '🚪 نعم، انسحب', callback_data: `leave:yes:${chatId}` }],
            [{ text: '✅ لا، أبقى', callback_data: `leave:no:${chatId}` }]
          ]
        );

        await this.answerCallbackQuery(
          cb.id,
          dm?.ok
            ? '📩 أرسلتلك تأكيد الانسحاب بالخاص.'
            : '⚠️ افتح الخاص مع البوت واضغط Start حتى تقدر تنسحب.',
          !dm?.ok
        );
        return;
      }

      const wasFull = this.lobbyIsFull(game);
      const result = CodenamesEngine.joinGame(game, {
        id: userId,
        name: userName,
        username: cb.from.username,
        team: team as any,
        role: role as PlayerRole
      });

      if (!result.success) {
        await this.answerCallbackQuery(
          cb.id,
          `${this.mdSafe(result.message)}\n\n${this.freeSeatsText(game)}`,
          true
        );
        return;
      }

      this.games.set(chatId, result.game);
      await this.updateTelegramGameBoard(chatId, result.game, cb.message?.message_id);

      // كمل العدد؟ ننبّه المشرف اللي رسل اللعبة بالخاص — هو وحده اللي يبدأ.
      if (!wasFull && this.lobbyIsFull(result.game)) {
        await this.notifySupervisorLobbyFull(result.game);
      }

      let alertText = result.message;
      let showAlert = false;

      // If he was already in the lobby, this press MOVED him.
      if (mine) {
        const oldRole = mine.role === 'spymaster' ? 'جاسوس 🕵️' : 'عميل 👤';
        const oldTeam = mine.team === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
        const newRole = role === 'spymaster' ? 'جاسوس 🕵️' : 'عميل 👤';
        const newTeam = team === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
        alertText = `🔄 نقلناك من مقعدك القديم (${oldRole} — ${oldTeam}) إلى (${newRole} — ${newTeam})`;
        showAlert = true;
      }
      if (role === 'spymaster') {
        // Spymasters must be reachable in private chat for the no-command clue input
        const dm = await this.sendMessage(
          String(userId),
          `🕵️ سُجّلت *جاسوساً* في لعبة «${this.mdSafe(result.game.chatTitle || 'المجموعة')}»!\n\n` +
            CodenamesEngine.getSpymasterGuide(team as Team)
        );
        if (!dm?.ok) {
          showAlert = true;
          alertText +=
            `\n⚠️ فتح الخاص مع البوت واضغط Start (زر «🕵️ الجواسيس» بالرسالة) حتى توصلك خريطتك.`;
        }
      }
      await this.answerCallbackQuery(cb.id, alertText, showAlert);
      return;
    }

    // 2. Start game
    if (data === 'game:start' && game) {
      // Only the owner (the admin who opened the lobby) may start the round.
      if (game.createdBy && String(game.createdBy) !== String(userId)) {
        await this.answerCallbackQuery(cb.id, '⚠️ لازم المشرف يبدأ اللعبة.', true);
        return;
      }

      const blueSpy = game.players.some(p => p.team === 'blue' && p.role === 'spymaster');
      const redSpy = game.players.some(p => p.team === 'red' && p.role === 'spymaster');
      if (game.players.length < 2) {
        await this.answerCallbackQuery(cb.id, '⚠️ لازم ينضم لاعبين على الأقل قبل البدء.', true);
        return;
      }
      if (!blueSpy || !redSpy) {
        await this.answerCallbackQuery(
          cb.id,
          '⚠️ كل فريق لازم يختار جاسوس (🕵️) قبل ما تبدأ اللعبة.',
          true
        );
        return;
      }

      // Every captain must have opened the bot's private chat first, otherwise
      // Telegram blocks the bot and the map / clue can never reach him.
      const unreachable: string[] = [];
      for (const spy of game.players.filter(p => p.role === 'spymaster')) {
        if (!(await this.canReachPrivate(String(spy.id)))) unreachable.push(spy.name);
      }
      if (unreachable.length > 0) {
        await this.answerCallbackQuery(
          cb.id,
          `⚠️ الجاسوس (${unreachable.join('، ')}) لسه ما فتح الخاص مع البوت!\n\n` +
            `خلّيه يضغط الزر (🕵️ الجواسيس: افتحوا الخاص مع البوت) بالأسفل ويضغط Start، وبعدين اضغط ابدأ.`,
          true
        );
        return;
      }

      const result = CodenamesEngine.startGame(game, this.customWords);
      this.games.set(chatId, result.game);

      await this.answerCallbackQuery(cb.id, 'بدأت اللعبة! تم توزيع الكلمات 🚀');
      await this.updateTelegramGameBoard(chatId, result.game, cb.message?.message_id);

      // Tell everyone in the game (privately) that the round has begun
      await this.notifyPlayersRoundStarted(result.game);
      // Notify spymasters in private message if possible
      await this.notifySpymasters(result.game);
      // Immediately ask the starting spymaster for the first clue (no commands needed)
      await this.promptSpymasterForClue(result.game);
      return;
    }

    // 3. New game / Rematch
    if (data === 'game:new') {
      if (game && game.status !== 'game_over' && game.createdBy && String(game.createdBy) !== String(userId)) {
        await this.answerCallbackQuery(cb.id, '⚠️ فقط المشرف صاحب اللعبة يقدر يبدأ جولة جديدة.', true);
        return;
      }
      const title = cb.message?.chat.title || 'المجموعة';
      const newLobby = CodenamesEngine.createLobby(
        chatId,
        title,
        game?.wordPack || 'arabic_standard',
        this.customWords,
        game?.createdBy ?? userId
      );
      this.games.set(chatId, newLobby);

      await this.answerCallbackQuery(cb.id, 'تم بدء جولة جديدة! اختاروا الفرق 🔄');
      await this.updateTelegramGameBoard(chatId, newLobby, cb.message?.message_id);
      return;
    }

    // 4. View Secret Map (each spymaster sees only their own colored card)
    if (data === 'action:secret_map') {
      if (!game || game.status === 'lobby') {
        await this.answerCallbackQuery(cb.id, 'اللعبة لم تبدأ بعد!', true);
        return;
      }

      const player = game.players.find(p => String(p.id) === String(userId));
      const isSpymaster = player?.role === 'spymaster';

      if (!isSpymaster && game.status !== 'game_over') {
        await this.answerCallbackQuery(
          cb.id,
          '⚠️ هذي الخريطة للجواسيس (🕵️) بس! إنت عليك تنتظر تلميح جاسوسك.',
          true
        );
        return;
      }

      const myTeam: Team = (player?.team as Team) || 'blue';
      const fullMap = CodenamesEngine.getSecretKeyVisual(game, myTeam);

      // The popup is limited to ~200 chars, so it only shows the compact color grid.
      const popup =
        `🗺️ خريطتك السرية — ${myTeam === 'red' ? 'أحمر 🔴' : 'أزرق 🔵'}\n` +
        `🔵 فريقك | 🔴 الخصم | ⚪ محايد | 💣 القاتل\n\n` +
        CodenamesEngine.getSecretKeyGrid(game);

      // Send the full map (grid + the exact words of each color) in private.
      const dm = await this.sendMessage(
        String(userId),
        `🕵️ *خريطتك السرية يا جاسوس* — إنت وحدك تشوفها:\n\n${fullMap}\n\n⚠️ _لا تشاركها مع أحد!_`
      );

      if (!dm?.ok) {
        await this.answerCallbackQuery(
          cb.id,
          '⚠️ ما گدرت أرسللك الخريطة بالخاص.\n' +
            'افتح محادثة البوت بالخاص واضغط /start، وبعدين اضغط الزر مرة ثانية.',
          true
        );
        return;
      }

      const note = '\n\n📩 الخريطة الكاملة (بأسماء البطاقات) أرسلتها لك بالخاص.';
      const body = popup.length + note.length <= 200 ? popup + note : popup.slice(0, 200);
      await this.answerCallbackQuery(cb.id, body, true);
      return;
    }

    // 5. Show the full map after the game ended (nothing is secret anymore)
    if (data === 'game:show_all') {
      if (!game || game.status !== 'game_over') {
        await this.answerCallbackQuery(cb.id, '⚠️ هذا الزر يشتغل بس بعد نهاية اللعبة.', true);
        return;
      }
      await this.answerCallbackQuery(cb.id, '📩 أرسلت الخريطة كاملة بالمحادثة.');
      await this.sendMessage(chatId, CodenamesEngine.getSecretKeyVisual(game));
      return;
    }

    // 6. Guess Card
    if (data.startsWith('guess:') && game) {
      const cardId = parseInt(data.replace('guess:', ''), 10);

      // Verify it is operative turn
      if (game.status !== 'operative_turn') {
        await this.answerCallbackQuery(cb.id, '⏳ ليس دور التخمين الآن! بانتظار تلميح الجاسوس.', true);
        return;
      }

      // Verify that user is not the spymaster
      const player = game.players.find(p => String(p.id) === String(userId));
      if (player && player.role === 'spymaster') {
        await this.answerCallbackQuery(cb.id, '⛔ أنت الجاسوس! لا يجوز للجواسيس الضغط على بطاقات التخمين.', true);
        return;
      }

      // Guess card
      const result = CodenamesEngine.guessCard(game, cardId, userName);
      if (!result.success) {
        await this.answerCallbackQuery(cb.id, result.message, true);
        return;
      }

      this.games.set(chatId, result.game);
      let rewards: string | null = null;
      if (result.game.status === 'game_over') {
        rewards = this.recordFinishedGame(result.game);
      }
      const guessedCard = game.cards.find(c => c.id === cardId);
      await this.answerCallbackQuery(cb.id, result.message);
      await this.updateTelegramGameBoard(
        chatId,
        result.game,
        cb.message?.message_id,
        `${CodenamesEngine.nameTag(userName)} خمّن «${guessedCard?.word || ''}» — ${result.message}`
      );

      // 💵 جوائز المباراة (فلوس + مستوى) — الفائزون بس
      if (rewards) {
        await this.sendMessage(chatId, await this.withBotFooter(rewards));
      }

      // If the turn moved to the other team's spymaster, prompt them privately
      if (result.game.status === 'spymaster_turn') {
        await this.promptSpymasterForClue(result.game);
      }
      return;
    }

    // 7. Pass turn
    if (data === 'action:pass' && game) {
      if (game.status !== 'operative_turn') {
        await this.answerCallbackQuery(cb.id, 'لا يمكن إنهاء الدور الآن.', true);
        return;
      }

      const result = CodenamesEngine.passTurn(game, userName);
      this.games.set(chatId, result.game);

      await this.answerCallbackQuery(cb.id, 'تم إنهاء الدور والانتقال للفريق الآخر.');
      await this.updateTelegramGameBoard(
        chatId,
        result.game,
        cb.message?.message_id,
        `${CodenamesEngine.nameTag(userName)} أنهى الدور 🤝`
      );

      // Prompt the new team's spymaster privately
      await this.promptSpymasterForClue(result.game);
      return;
    }

    // Already revealed card clicked
    if (data.startsWith('info:revealed:')) {
      await this.answerCallbackQuery(cb.id, 'تم كشف هذه الكلمة مسبقاً!');
      return;
    }

    // Default acknowledge
    await this.answerCallbackQuery(cb.id, 'تم استقبال الإجراء');
  }

  /**
   * Start a new game lobby in a chat.
   * If a board message already exists in this chat, we EDIT it instead of sending a new one,
   * so the chat always has ONE single game message that keeps updating.
   * Returns the board message id (or null if it could not be sent).
   */
  private async startNewGameLobby(
    chatId: string,
    chatTitle: string,
    createdBy?: number | string
  ): Promise<{ messageId: number | null; error?: string }> {
    const existing = this.games.get(chatId);
    const game = CodenamesEngine.createLobby(
      chatId,
      chatTitle,
      existing?.wordPack || 'arabic_standard',
      this.customWords,
      createdBy ?? existing?.createdBy
    );
    const prevMessageId = existing?.messageId;
    this.games.set(chatId, game);

    const text = await this.withBotFooter(CodenamesEngine.getTelegramMessageText(game));
    const keyboard = await this.buildKeyboard(game);

    // Reuse the previous board message (single-message mode).
    // "message is not modified" also counts as success — nothing to change.
    if (prevMessageId) {
      const res = await this.editMessageText(chatId, prevMessageId, text, keyboard);
      const unchanged = String(res?.description || '').includes('not modified');
      if (res?.ok || unchanged) {
        game.messageId = prevMessageId;
        this.games.set(chatId, game);
        return { messageId: prevMessageId };
      }
    }

    const sent = await this.sendMessage(chatId, text, keyboard);
    const msgId = sent?.result?.message_id;
    if (msgId) {
      game.messageId = msgId;
      this.games.set(chatId, game);
      return { messageId: msgId };
    }

    const reason = sent?.description || 'ما وصل رد من تلجرام';
    console.error('startNewGameLobby failed for', chatId, reason);
    return { messageId: null, error: reason };
  }

  /**
   * Make sure the bot's own username is known (needed for t.me deep links).
   * In the webhook/Worker flow getMe() is never called by itself, so we do it
   * lazily here and cache the result.
   */
  public async ensureBotInfo(): Promise<void> {
    if (this.botInfo?.username) return;
    if (!this.token) return;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/getMe`);
      const data: any = await res.json();
      if (data?.ok) this.botInfo = data.result;
      else console.error('getMe failed:', data?.description);
    } catch (e) {
      console.error('getMe error:', e);
    }
  }

  /** The bot's @username, fetching it if we don't know it yet. */
  public async getBotUsername(): Promise<string | undefined> {
    await this.ensureBotInfo();
    return this.botInfo?.username;
  }

  /**
   * Every game message ends with the bot's username, so anyone who still has
   * not started the bot can tap it and press Start (and save it if he wants).
   */
  private async withBotFooter(text: string): Promise<string> {
    const botUser = await this.getBotUsername();
    if (!botUser) return text;
    return text + `\n━━━━━━━━━━━━━━━━━━━\n` + `🤖 *البوت:* @${botUser}`;
  }

  /**
   * Board keyboard + an extra button that opens the bot's private chat.
   * Captains MUST do this once, otherwise Telegram blocks the bot from
   * messaging them (the secret map / clue prompt can't be delivered).
   */
  private async buildKeyboard(game: CodenamesGame): Promise<any[][]> {
    const keyboard = CodenamesEngine.getTelegramInlineKeyboard(game);
    const botUser = await this.getBotUsername();
    if (botUser && game.status === 'lobby') {
      keyboard.push([{
        text: '🕵️ الجواسيس: افتحوا الخاص مع البوت',
        url: `https://t.me/${botUser}?start=spy`
      }]);
    }
    return keyboard;
  }

  /**
   * Can the bot start a private conversation with this user?
   * Telegram forbids bots from writing first, so we probe with sendChatAction.
   */
  private async canReachPrivate(userId: string): Promise<boolean> {
    if (!this.token) return false;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: userId, action: 'typing' })
      });
      const data: any = await res.json();
      return Boolean(data?.ok);
    } catch (e) {
      return false;
    }
  }

  /**
   * Every game in which this user is a captain (spymaster).
   */
  private findSpymasterGames(userId: string): { game: CodenamesGame; player: Player }[] {
    const out: { game: CodenamesGame; player: Player }[] = [];
    for (const game of this.games.values()) {
      const player = game.players.find(
        p => String(p.id) === userId && p.role === 'spymaster'
      );
      if (player) out.push({ game, player });
    }
    return out;
  }

  /**
   * The captain tapped «🕵️ الجواسيس: افتحوا الخاص مع البوت» in the channel and
   * pressed Start. From now on the bot can DM him the map and clue prompts.
   */
  private async handleSpymasterReady(chatId: string, sender?: TelegramUser) {
    if (!sender) return;
    const userId = String(sender.id);
    const mine = this.findSpymasterGames(userId);

    const lines: string[] = [];
    if (mine.length === 0) {
      lines.push(
        `✅ *تم تشغيل الخاص!*\n\n` +
          `إنت حالياً مو مسجّل جاسوس بأي لعبة. لما تنضم جاسوس بأي قناة، راح توصلك *خريطتك الملوّنة* وتلميحاتك هنا بالخاص 💬`
      );
    } else {
      for (const { game, player } of mine) {
        const teamName = player.team === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
        lines.push(`✅ *تم!* إنت الجاسوس بفريق ${teamName} بلعبة «${this.mdSafe(game.chatTitle || 'المجموعة')}».`);
        if (game.status === 'lobby') {
          lines.push(`📌 اللعبة بمرحلة الانضمام — أول ما تبدأ الجولة راح أرسللك خريطتك الملوّنة هنا.`);
          lines.push(CodenamesEngine.getSpymasterGuide(player.team));
        }
      }
    }

    await this.sendMessage(chatId, lines.join('\n\n'));

    // If a round is already running, push the map + guide right away.
    for (const { game, player } of mine) {
      if (game.status === 'spymaster_turn' || game.status === 'operative_turn') {
        await this.sendMessage(chatId, CodenamesEngine.getSpymasterGuide(player.team));
        await this.sendMessage(
          chatId,
          `🎨 *خريطتك الملوّنة (${player.team === 'blue' ? 'الفريق الأزرق 🔵' : 'الفريق الأحمر 🔴'})*\n\n` +
            CodenamesEngine.getSecretKeyVisual(game, player.team)
        );
      }
    }
  }

  /** عرض قسم من قائمة الألعاب (أزرار فقط) */
  private async handleGamesMenu(cb: TelegramCallbackQuery, section: string) {
    const chatId = String(cb.message?.chat.id || cb.from.id);
    const messageId = cb.message?.message_id;

    if (section === 'soon') {
      await this.answerCallbackQuery(cb.id, '🔜 هاي اللعبة جاية قريب!');
      return;
    }

    // «🎮 العب بالقناة» → يرسل مباشرة اختيار القناة
    if (section === 'channel') {
      await this.answerCallbackQuery(cb.id);
      await this.sendChannelKeyboard(chatId);
      return;
    }

    const view = await this.buildGamesMenu(
      section,
      section === 'main' && cb.message?.chat.type === 'private'
        ? this.users.get(String(cb.from.id))
        : undefined
    );
    const text = await this.withBotFooter(view.text);
    if (messageId) {
      await this.editMessageText(chatId, messageId, text, view.keyboard);
    } else {
      await this.sendMessage(chatId, text, view.keyboard);
    }
    await this.answerCallbackQuery(cb.id, '');
  }

  // ---------------------------------------------------------------------
  // 📊 إحصائيات الألعاب — تُعرض للكل (صاحب البوت وأي لاعب)، للقراءة فقط.
  // ما تغيّر أي حالة ولا تأثر على أي لعبة شغّالة.
  // ---------------------------------------------------------------------

  /** شريط صغير يبيّن النسبة بشكل مرتب */
  private statBar(part: number, total: number): string {
    if (!total) return '▱▱▱▱▱';
    const filled = Math.max(0, Math.min(5, Math.round((part / total) * 5)));
    return '▰'.repeat(filled) + '▱'.repeat(5 - filled);
  }

  private statPct(part: number, total: number): string {
    if (!total) return '0%';
    return `${Math.round((part / total) * 100)}%`;
  }

  private statMedal(index: number): string {
    return ['🥇', '🥈', '🥉'][index] || `${index + 1}.`;
  }

  /** المباريات الحقيقية فقط (الأمثلة القديمة للتجربة ما تنحسب) */
  private realMatches(): CodenamesGame[] {
    return this.completedGames.filter(g => !String(g.id).startsWith('match_hist_'));
  }

  /** كل أرقام الألعاب بمكان واحد */
  private gameStatsNumbers() {
    const users = Array.from(this.users.values());
    const matches = this.realMatches();
    const active = Array.from(this.games.values()).filter(g => g.status !== 'game_over');

    const blueWins = matches.filter(g => g.winner === 'blue').length;
    const redWins = matches.filter(g => g.winner === 'red').length;
    const assassinLosses = matches.filter(g => g.winReason === 'assassin_triggered').length;

    const solvers = users.filter(u => (u.wordleWins || 0) > 0);
    const solved = users.reduce((sum, u) => sum + (u.wordleWins || 0), 0);
    const totalPoints = users.reduce((sum, u) => sum + (u.points || 0), 0);

    return {
      users,
      matches,
      active,
      blueWins,
      redWins,
      assassinLosses,
      solvers,
      solved,
      totalPoints
    };
  }

  /** 🏆 أكثر اللاعبين فوزاً بمباريات «كود نيمز» (أي فريق) — limit = 0 يعني الكل */
  private codenamesWinBoard(limit = 5): { id: string; name: string; wins: number }[] {
    const tally = new Map<string, { id: string; name: string; wins: number }>();
    for (const g of this.realMatches()) {
      for (const p of g.players || []) {
        if (p.team !== g.winner) continue;
        const key = String(p.id);
        const cur = tally.get(key) || { id: key, name: p.name, wins: 0 };
        cur.wins += 1;
        cur.name = p.name;
        tally.set(key, cur);
      }
    }
    const board = Array.from(tally.values()).sort((a, b) => b.wins - a.wins);
    return limit > 0 ? board.slice(0, limit) : board;
  }

  /**
   * 👤 إحصائيات اللاعب الشخصية بلعبة معينة.
   * تنعرض أول شي (فوق إحصائيات اللعبة العامة) وترجع نص فاضي إذا ما نعرض شي.
   */
  private personalGameStats(
    gameId: string,
    viewerId: string,
    n: { users: BotUserRecord[]; matches: CodenamesGame[] }
  ): string {
    if (!gameId || !viewerId) return '';
    const rec = this.users.get(String(viewerId));
    if (!rec) return '';

    const head = `👤 *إحصائياتك:*`;
    const lines: string[] = [];

    // 🟩 خمّن الكلمة
    if (gameId === 'wordle') {
      const played = rec.wordleGames || 0;
      const wins = rec.wordleWins || 0;
      if (!played) return `${head}\n_بعدك ما حلّيتها — اضغط «🤖 العب مع البوت» وجرّب 😉_`;
      lines.push(`✅ حلّيت: *${wins}* من *${played}* كلمة`);
      lines.push(`🎯 نسبة النجاح: *${this.statPct(wins, played)}* ${this.statBar(wins, played)}`);
      const board = n.users
        .filter(u => (u.wordleWins || 0) > 0)
        .sort((a, b) => (b.wordleWins || 0) - (a.wordleWins || 0));
      const rank = board.findIndex(u => u.id === rec.id);
      if (rank >= 0) lines.push(`🏅 ترتيبك: *#${rank + 1}* من *${board.length}*`);
    }

    // 🎭 خمّن الشاعر
    else if (gameId === 'poet') {
      const played = rec.poetGames || 0;
      const wins = rec.poetWins || 0;
      if (!played) return `${head}\n_بعدك ما جرّبتها — اضغط «🤖 العب مع البوت» ويطلعلك بيت 😉_`;
      lines.push(`🧠 حلّيت: *${wins}* من *${played}* بيت`);
      lines.push(`🎯 دقتك: *${this.statPct(wins, played)}* ${this.statBar(wins, played)}`);
      const board = n.users
        .filter(u => (u.poetGames || 0) > 0)
        .sort((a, b) => (b.poetWins || 0) - (a.poetWins || 0));
      const rank = board.findIndex(u => u.id === rec.id);
      if (rank >= 0) lines.push(`🏅 ترتيبك: *#${rank + 1}* من *${board.length}*`);
    }

    // 🎮 كود نيمز
    else if (gameId === 'codenames') {
      const id = String(rec.id);
      const mine = n.matches.filter(g => (g.players || []).some(p => String(p.id) === id));
      if (!mine.length) {
        return `${head}\n_بعدك ما لعبت كود نيمز — نزّلها بقناتك والعب مع ناس حقيقيين 🎮_`;
      }
      const won = mine.filter(g => (g.players || []).some(p => String(p.id) === id && p.team === g.winner));
      const asSpy = won.filter(g =>
        (g.players || []).some(p => String(p.id) === id && p.role === 'spymaster')
      ).length;

      lines.push(
        `🎮 مباريات: *${mine.length}* • 🏆 فوز: *${won.length}* (${this.statPct(won.length, mine.length)})`
      );
      if (won.length) lines.push(`🕵️ جاسوس: *${asSpy}* فوز • 👤 عميل: *${won.length - asSpy}* فوز`);

      let correct = 0;
      let wrong = 0;
      for (const g of mine) {
        for (const c of g.cards || []) {
          if (!c.revealed || !c.revealedBy || c.revealedBy.playerName !== rec.name) continue;
          if ((c.type === 'blue' || c.type === 'red') && c.type === c.revealedBy.team) correct++;
          else wrong++;
        }
      }
      if (correct || wrong) {
        lines.push(`🃏 كشفت: *${correct}* بطاقة${wrong ? ` _(و${wrong} غلط)_` : ''}`);
      }
      lines.push(
        `💰 رصيدك: *${Economy.formatMoney(rec.money || 0)}* 💵 • 🎖️ مستوى *${Economy.levelFromXp(
          rec.xp || 0
        )}*`
      );

      const board = this.codenamesWinBoard(0);
      const rank = board.findIndex(u => u.id === id);
      if (rank >= 0) lines.push(`🏅 ترتيبك: *#${rank + 1}* من *${board.length}*`);
    } else {
      return '';
    }

    return `${head}\n${lines.join('\n')}`;
  }

  /** نصوص الإحصائيات: main / top / g:<id> (إحصائيات لعبة معينة) */
  private async buildGameStats(section: string, viewerId = ''): Promise<{ text: string; keyboard: any[][] }> {
    const n = this.gameStatsNumbers();
    const backStats = [{ text: '🔙 رجوع', callback_data: 'gstat:main' }];

    // 📊 إحصائيات لعبة معينة — توصل من صفحة اللعبة نفسها
    const gameId = section.startsWith('g:') ? section.slice(2) : section === 'cn' ? 'codenames' : '';
    const fromGame = section.startsWith('g:');
    const gameBack = [{ text: '🔙 رجوع', callback_data: `hub:g:${gameId}` }];

    // 👤 إحصائيات اللاعب نفسه — تطلع أول شي، وبعدها خط فاصل وبعدها إحصائيات اللعبة العامة
    const personal = this.personalGameStats(gameId, viewerId, n);
    const personalBlock = personal ? `${personal}\n━━━━━━━━━━━━━━━━━━━\n` : '';

    // 🟩 إحصائيات خمّن الكلمة
    if (gameId === 'wordle') {
      const topSolvers = n.users
        .filter(u => (u.wordleWins || 0) > 0)
        .sort((a, b) => (b.wordleWins || 0) - (a.wordleWins || 0))
        .slice(0, 10);
      const playingNow = Array.from(this.wordle.values()).filter(w => !w.done).length;

      const lines = topSolvers.length
        ? topSolvers
            .map(
              (u, i) =>
                `${this.statMedal(i)} ${this.mdSafe(u.name)} — *${u.wordleWins || 0}* كلمة`
            )
            .join('\n')
        : '_ما بعد أحد حلّها — كون أول واحد!_';

      const text =
        `🟩 *إحصائيات خمّن الكلمة*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        personalBlock +
        `✅ انحلّت: *${n.solved}* مرة\n` +
        `👥 لاعبون حلّوها: *${n.solvers.length}*\n` +
        `⏳ يلعبونها هسه: *${playingNow}*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🥇 *أكثر من حلّها:*\n${lines}`;

      return { text, keyboard: [gameBack] };
    }

    // 🎭 إحصائيات خمّن الشاعر
    if (gameId === 'poet') {
      const played = n.users.reduce((sum, u) => sum + (u.poetGames || 0), 0);
      const solved = n.users.reduce((sum, u) => sum + (u.poetWins || 0), 0);
      const experts = n.users.filter(u => (u.poetGames || 0) > 0);
      const topExperts = experts
        .slice()
        .sort((a, b) => (b.poetWins || 0) - (a.poetWins || 0))
        .slice(0, 10);
      const playingNow = Array.from(this.poet.values()).filter(p => !p.done).length;
      const accuracy = played ? Math.round((solved / played) * 100) : 0;

      const lines = topExperts.length
        ? topExperts
            .map((u, i) => {
              const games = u.poetGames || 0;
              const wins = u.poetWins || 0;
              const pct = games ? Math.round((wins / games) * 100) : 0;
              return `${this.statMedal(i)} ${this.mdSafe(u.name)} — *${wins}* بيت (${pct}%)`;
            })
            .join('\n')
        : '_ما بعد أحد خمّن — كون أول واحد!_';

      const text =
        `🎭 *إحصائيات خمّن الشاعر*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        personalBlock +
        `✅ أبيات انحلّت: *${solved}*\n` +
        `🎯 أبيات انلعبت: *${played}*\n` +
        `📈 دقة التخمين: *${accuracy}%*\n` +
        `⏳ يلعبونها هسه: *${playingNow}*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🥇 *أخبر من عرف الشعراء:*\n${lines}`;

      return { text, keyboard: [gameBack] };
    }

    // 🏆 لوحة الأبطال
    if (section === 'top') {
      const topPoints = n.users
        .filter(u => (u.points || 0) > 0)
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, 10);
      const topWordle = n.users
        .filter(u => (u.wordleWins || 0) > 0)
        .sort((a, b) => (b.wordleWins || 0) - (a.wordleWins || 0))
        .slice(0, 5);

      const pointsLines = topPoints.length
        ? topPoints
            .map((u, i) => `${this.statMedal(i)} ${this.mdSafe(u.name)} — *${u.points || 0}* نقطة`)
            .join('\n')
        : '_ما بعد أحد جمع نقاط — كونوا أول الأبطال!_';

      const wordleLines = topWordle.length
        ? topWordle
            .map(
              (u, i) => `${this.statMedal(i)} ${this.mdSafe(u.name)} — *${u.wordleWins || 0}* فوز`
            )
            .join('\n')
        : '_ما بعد أحد حلّ «خمّن الكلمة»._';

      const text =
        `🏆 *لوحة الأبطال*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `⭐ *الأكثر نقاط:*\n${pointsLines}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🧠 *أكثر من حلّ «خمّن الكلمة»:*\n${wordleLines}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `⭐ مجموع نقاط كل اللاعبين: *${n.totalPoints}*`;

      return { text, keyboard: [backStats] };
    }

    // ⚔️ إحصائيات كود نيمز
    if (gameId === 'codenames') {
      const spyWins = new Map<string, { name: string; wins: number }>();
      for (const g of n.matches) {
        for (const p of g.players || []) {
          if (p.role !== 'spymaster' || p.team !== g.winner) continue;
          const key = String(p.id);
          const cur = spyWins.get(key) || { name: p.name, wins: 0 };
          cur.wins += 1;
          cur.name = p.name;
          spyWins.set(key, cur);
        }
      }
      const topSpies = Array.from(spyWins.values())
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 5);

      const chatPlays = new Map<string, number>();
      for (const g of n.matches) {
        const title = g.chatTitle || 'قناة';
        chatPlays.set(title, (chatPlays.get(title) || 0) + 1);
      }
      const topChats = Array.from(chatPlays.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      // 🏆 أكثر لاعب فاز بالمباريات (أي فريق)
      const winBoard = this.codenamesWinBoard(5);

      const spyLines = topSpies.length
        ? topSpies
            .map((s, i) => `${this.statMedal(i)} ${this.mdSafe(s.name)} — *${s.wins}* فوز`)
            .join('\n')
        : '_ما بعد أكو جاسوس فاز — ننتظر أول مباراة!_';

      const winLines = winBoard.length
        ? winBoard
            .map((w, i) => `${this.statMedal(i)} ${this.mdSafe(w.name)} — *${w.wins}* فوز`)
            .join('\n')
        : '_ما بعد فاز أحد — ننتظر أول مباراة!_';

      const chatLines = topChats.length
        ? topChats
            .map(([title, count], i) => `${i + 1}. ${this.mdSafe(title)} — *${count}* مباراة`)
            .join('\n')
        : '_ما بعد انلعبت مباراة بقناة._';

      const text =
        `⚔️ *إحصائيات كود نيمز (2 ضد 2)*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        personalBlock +
        `🏁 مباريات مكتملة: *${n.matches.length}*\n` +
        `⏳ جارية الآن: *${n.active.length}*\n` +
        `🔵 الأزرق: *${n.blueWins}* ${this.statBar(n.blueWins, n.matches.length)} ${this.statPct(n.blueWins, n.matches.length)}\n` +
        `🔴 الأحمر: *${n.redWins}* ${this.statBar(n.redWins, n.matches.length)} ${this.statPct(n.redWins, n.matches.length)}\n` +
        `💀 خسارة بالقاتل: *${n.assassinLosses}*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 *أكثر لاعب فاز:*\n${winLines}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🕵️ *أفضل الجواسيس:*\n${spyLines}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `📣 *أكثر القنوات لعباً:*\n${chatLines}`;

      return { text, keyboard: [fromGame ? gameBack : backStats] };
    }

    // 🔜 لعبة بعدها ما نزلت
    if (gameId) {
      const game = findBotGame(gameId);
      return {
        text:
          `${game ? `${game.emoji} *إحصائيات ${game.title}*` : '📊 *إحصائيات اللعبة*'}\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `🔜 اللعبة بعدها ما نزلت — أول ما نجهّزها نفتح إحصائياتها الخاصة.`,
        keyboard: [gameBack]
      };
    }

    // 📊 الشاشة الرئيسية للإحصائيات
    const poetSolved = n.users.reduce((sum, u) => sum + (u.poetWins || 0), 0);
    const poetPlayers = n.users.filter(u => (u.poetWins || 0) > 0).length;
    const topPoints = n.users
      .filter(u => (u.points || 0) > 0)
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 5);
    const topLines = topPoints.length
      ? topPoints
          .map((u, i) => `${this.statMedal(i)} ${this.mdSafe(u.name)} — *${u.points || 0}* نقطة`)
          .join('\n')
      : '_ما بعد أحد جمع نقاط — العبوا وارجعوا تشوفون اسمكم هنا!_';

    const text =
      `📊 *إحصائيات الألعاب*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🎮 *المجموع:* ${n.matches.length + n.solved + poetSolved} لعبة مكتملة • ${n.active.length + Array.from(this.poet.values()).filter(p => !p.done).length} جارية الآن\n\n` +
      `⚔️ *كود نيمز (2 ضد 2)*\n` +
      `🔵 الأزرق: *${n.blueWins}* ${this.statBar(n.blueWins, n.matches.length)} ${this.statPct(n.blueWins, n.matches.length)}\n` +
      `🔴 الأحمر: *${n.redWins}* ${this.statBar(n.redWins, n.matches.length)} ${this.statPct(n.redWins, n.matches.length)}\n\n` +
      `🧠 *خمّن الكلمة*\n` +
      `✅ انحلّت: *${n.solved}* مرة • 👥 فازوا: *${n.solvers.length}*\n\n` +
      `🎭 *خمّن الشاعر*\n` +
      `✅ أبيات انحلّت: *${poetSolved}* • 👥 لاعبون: *${poetPlayers}*\n\n` +
      `👥 *ألعاب ثنائية:* 🔜 قريباً • 🎲 *ألعاب الحظ:* 🔜 قريباً\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🏆 *أقوى 5 بالنقاط:*\n${topLines}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `⭐ مجموع نقاط اللاعبين: *${n.totalPoints}*`;

    const keyboard: any[][] = [
      [
        { text: '🏆 لوحة الأبطال', callback_data: 'gstat:top' },
        { text: '⚔️ تفاصيل كود نيمز', callback_data: 'gstat:cn' }
      ],
      [
        { text: '🟩 تفاصيل خمّن الكلمة', callback_data: 'gstat:g:wordle' },
        { text: '🎭 تفاصيل خمّن الشاعر', callback_data: 'gstat:g:poet' }
      ]
    ];
    keyboard.push([{ text: '🔙 رجوع', callback_data: 'hub:main' }]);
    // صاحب البوت يرجع للوحته مباشرة
    keyboard.push([{ text: '👑 لوحة التحكم', callback_data: 'admin:panel' }]);

    return { text, keyboard };
  }

  // ---------------------------------------------------------------------
  // 💰 الفلوس والمستوى: لوحة المتصدرين + ملف اللاعب
  // (عامة للكل — قراءة بس، وما تأثر على أي لعبة شغّالة)
  // ---------------------------------------------------------------------

    // شاشات: rank:menu / rank:money / rank:level / rank:me
  private buildRanking(section: string, viewerId: string): { text: string; keyboard: any[][] } {
    if (section === 'menu') {
      return {
        text: `🏅 *المتصدرون*\nاختار لوحة الترتيم اللي تبيها 👇`,
        keyboard: [
          [{ text: '💵 متصدرين بالفلوس', callback_data: 'rank:money' }],
          [{ text: '🎖️ متصدرين بالمستوى', callback_data: 'rank:level' }],
          [{ text: '🔙 رجوع', callback_data: 'hub:main' }]
        ]
      };
    }

    const users = Array.from(this.users.values()).filter(u => !u.banned);
    const rich = users
      .filter(u => (u.money || 0) > 0 || u.id === viewerId)
      .sort((a, b) => (b.money || 0) - (a.money || 0));
    const ranked = users
      .filter(u => (u.onlineGames || 0) > 0 || u.id === viewerId)
      .sort((a, b) => (b.xp || 0) - (a.xp || 0) || (b.onlineWins || 0) - (a.onlineWins || 0));

    const tabs: any[][] = section === 'money'
      ? [[{ text: 'متصدرين بالمستوى', callback_data: 'rank:level' }], [{ text: '👤 ملفي', callback_data: 'rank:me' }], [{ text: 'رجوع', callback_data: 'hub:main' }]]
      : section === 'level'
        ? [[{ text: 'متصدرين بالفلوس', callback_data: 'rank:money' }], [{ text: '👤 ملفي', callback_data: 'rank:me' }], [{ text: 'رجوع', callback_data: 'hub:main' }]]
        : [[{ text: 'متصدرين بالفلوس', callback_data: 'rank:money' }, { text: 'متصدرين بالمستوى', callback_data: 'rank:level' }], [{ text: '👤 ملفي', callback_data: 'rank:me' }], [{ text: 'رجوع', callback_data: 'hub:main' }]];

    if (section === 'level') {
      const top = ranked.slice(0, 5);
      const lines = top.length
        ? top
            .map((u, i) => {
              const p = Economy.levelProgress(u.xp || 0);
              const games = u.onlineGames || 0;
              const wins = u.onlineWins || 0;
              return `${this.statMedal(i)} ${this.mdSafe(u.name)} — مستوى *${p.level}* (${Economy.levelTitle(p.level)}) • *${u.xp || 0}* XP • ${games}م/${wins}ف`;
            })
            .join('\n')
        : '_ما بعد أحد لعب مباراة أونلاين._';

      const myRec = this.users.get(String(viewerId));
      let myBlock = '_ما عندي معلومات عنك بعد — /start أولاً_';
      if (myRec) {
        const myIdx = ranked.findIndex(u => u.id === myRec.id);
        const p2 = Economy.levelProgress(myRec.xp || 0);
        const g2 = myRec.onlineGames || 0;
        const w2 = myRec.onlineWins || 0;
        myBlock = `معلوماتي:\n${myIdx >= 0 ? `ترتيبي: *#${myIdx + 1}*` : `ترتيبي: *--*`} • مستوى *${p2.level}* (${Economy.levelTitle(p2.level)}) • *${myRec.xp || 0}* XP • ${g2}م/${w2}ف`;
      }

      const text = [
        `🎖️ *متصدرين بالمستوى* (أعلى 5)`,
        '━━━━━━━━━━━━━━━━━━━',
        lines,
        '───────────',
        myBlock,
        '━━━━━━━━━━━━━━━━━━━',
        `_ملاحظة: الفلوس والمستوى ما يزيدان إلا باللعب مع ناس حقيقيين (أونلاين)._`
      ].join('\n');

      return { text, keyboard: [[{ text: 'رجوع', callback_data: 'hub:main' }]] };
    }

    // 👤 ملف اللاعب نفسه
    if (section === 'me') {
      const rec = this.users.get(String(viewerId));
      if (!rec) {
        return {
          text: `👤 *ملفي*\n━━━━━━━━━━━━━━━━━━━\nما عندي معلومات عنك بعد — اضغط /start أول 🙂`,
          keyboard: tabs
        };
      }

      const p = Economy.levelProgress(rec.xp || 0);
      const games = rec.onlineGames || 0;
      const wins = rec.onlineWins || 0;
      const money = rec.money || 0;
      const myRank = rich.findIndex(u => u.id === rec.id);
      const today = Economy.earnedToday(rec);

      const lines = [
        `👤 *ملفي* — ${this.mdSafe(rec.name)}`,
        `━━━━━━━━━━━━━━━━━━━`,
        `🎖️ المستوى: *${p.level}* (${Economy.levelTitle(p.level)})`,
        `${this.statBar(p.into, p.span)} *${p.into}* / ${p.span} XP • باقي *${p.left}* للمستوى ${p.level + 1}`,
        `_${Economy.walletVibe({ level: p.level, money, onlineGames: games, wins })}_`,
        `💵 رصيدي: *${Economy.formatMoney(money)}* 💵`,
        `🎮 مباريات أونلاين: *${games}* • 🏆 فوز: *${wins}* (${this.statPct(wins, games)})`,
        `🧠 نقاط ألعاب البوت: *${rec.points || 0}*`,
        `━━━━━━━━━━━━━━━━━━━`,
        `💰 ربحت اليوم: *${Economy.formatMoney(today)}* من *${Economy.formatMoney(
          Economy.DAILY_MONEY_CAP
        )}*`,
        myRank >= 0
          ? `🏅 ترتيبي بالفلوس: *#${myRank + 1}* من *${rich.length}*`
          : `🏅 ما بعدك على لوحة الفلوس — الفوز مع ناس حقيقيين يخليك تصعد 💪`,
        `_الفلوس والمستوى من الألعاب اللي مع ناس حقيقيين بس (مو مع البوت)_`
      ];

      return { text: lines.join('\n'), keyboard: tabs };
    }

    // 💰 متصدرين بالفلوس
    const top = rich.slice(0, 5);
    const lines = top.length
      ? top
          .map((u, i) => {
            const level = Economy.levelFromXp(u.xp || 0);
            return `${this.statMedal(i)} ${this.mdSafe(u.name)} — *${Economy.formatMoney(u.money || 0)}* 💵 • مستوى ${level}`;
          })
          .join('\n')
      : '_ما بعد أحد ربح فلوس._';

    const myRec2 = this.users.get(String(viewerId));
    let myBlock2 = '_ما عندي معلومات عنك بعد — /start أولاً_';
    if (myRec2) {
      const myIdx2 = rich.findIndex(u => u.id === myRec2.id);
      const level2 = Economy.levelFromXp(myRec2.xp || 0);
      myBlock2 = `معلوماتي:\n${myIdx2 >= 0 ? `ترتيبي: *#${myIdx2 + 1}*` : `ترتيبي: *--*`} • فلوسي: *${Economy.formatMoney(myRec2.money || 0)}* 💵 • مستوى *${level2}*`;
    }

    const text2 = [
      `💰 *متصدرين بالفلوس* (أعلى 5)`,
      '━━━━━━━━━━━━━━━━━━━',
      lines,
      '───────────',
      myBlock2,
      '━━━━━━━━━━━━━━━━━━━',
      `_ملاحظة: الفلوس ما تزيد إلا باللعب مع ناس حقيقيين (أونلاين)._`
    ].join('\n');

    return { text: text2, keyboard: [[{ text: 'رجوع', callback_data: 'hub:main' }]] };
  }

  /** يفتح/يحدّث شاشات الفلوس والمستوى (أي واحد يكدر يشوفها) */
  private async handleRanking(cb: TelegramCallbackQuery, section: string) {
    const chatId = String(cb.message?.chat.id || cb.from.id);
    const messageId = cb.message?.message_id;

    const view = this.buildRanking(section || 'money', String(cb.from.id));
    const text = await this.withBotFooter(view.text);

    if (messageId) {
      const res = await this.editMessageText(chatId, messageId, text, view.keyboard);
      if (res?.ok || String(res?.description || '').includes('not modified')) {
        await this.answerCallbackQuery(cb.id, 'محدّثة ✅');
        return;
      }
    }
    await this.sendMessage(chatId, text, view.keyboard);
    await this.answerCallbackQuery(cb.id, '');
  }
  private async handleGameStats(cb: TelegramCallbackQuery, section: string) {
    const chatId = String(cb.message?.chat.id || cb.from.id);
    const messageId = cb.message?.message_id;

    // 👤 إحصائيات اللاعب نفسه — تطلع أول شي (بالخاص فقط: مو بمعلومات الناس بالكروب)
    const viewerId = cb.message?.chat.type === 'private' ? String(cb.from.id) : '';
    const view = await this.buildGameStats(section || 'main', viewerId);
    // زر «👑 لوحة التحكم» يظهر لصاحب البوت فقط — للآخرين ما يبين
    const keyboard = this.isOwner(cb.from.id)
      ? view.keyboard
      : view.keyboard
          .map(row => row.filter((b: any) => b.callback_data !== 'admin:panel'))
          .filter(row => row.length);

    const text = await this.withBotFooter(view.text);
    if (messageId) {
      const res = await this.editMessageText(chatId, messageId, text, keyboard);
      if (res?.ok || String(res?.description || '').includes('not modified')) {
        await this.answerCallbackQuery(cb.id, 'محدّثة ✅');
        return;
      }
    }
    await this.sendMessage(chatId, text, keyboard);
    await this.answerCallbackQuery(cb.id, '');
  }

  private async buildGamesMenu(section: string, viewer?: BotUserRecord): Promise<{ text: string; keyboard: any[][] }> {
    const botUser = await this.getBotUsername();
    const back = [{ text: '🔙 رجوع', callback_data: 'hub:main' }];

    // 📂 صفحة الصنف: ألعاب الصنف فقط + رجوع
    if (GAME_CATEGORIES[section]) {
      const cat = GAME_CATEGORIES[section];
      const list = BOT_GAMES.filter(g => g.category === section);

      const keyboard: any[][] = list.map(g => [
        {
          text: `${g.emoji} ${g.title}`,
          callback_data: `hub:g:${g.id}`
        }
      ]);
      keyboard.push(back);

      const text =
        `${cat.emoji} *${cat.title}*\n` +
        `${cat.intro}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `👇 اختار اللعبة:`;

      return { text, keyboard };
    }

    // 🎯 قائمة اللعبة
    if (section.startsWith('g:')) {
      const game = findBotGame(section.slice(2));
      if (!game) {
        return {
          text: `ما لكيت هاي اللعبة — ارجع واختار من القائمة.`,
          keyboard: [[{ text: 'رجوع', callback_data: 'hub:main' }]]
        };
      }

      const lines = [`${game.emoji} *${game.title}*`];

      if (game.ready) {
        if (game.players) lines.push(game.players);
      } else {
        lines.push('قريباً');
      }

      const keyboard: any[][] = [];

      if (game.ready) {
        // إحصائيات اللعبة نفسها
        keyboard.push([{ text: 'إحصائيات اللعبة', callback_data: `gstat:g:${game.id}` }]);

        // العب في القناة
        if (game.channel) {
          keyboard.push([{ text: '🎮 العب بالقناة', callback_data: 'hub:channel' }]);
        }

        // العب مع البوت
        if (game.play && !game.channel) {
          keyboard.push([{ text: game.play.label, callback_data: game.play.data }]);
        } else if (game.play && game.channel) {
          // إذا اللعبة بالقناة، نستخدم زر القناة
        }
      }

      keyboard.push([{ text: 'رجوع', callback_data: `hub:${game.category}` }]);

      return { text: lines.join('\n'), keyboard };
    }

    // 📖 شرح اللعبة (جوّا اللعبة نفسها)
    if (section.startsWith('how:')) {
      const game = findBotGame(section.slice(4));
      if (!game) {
        return { text: `⚠️ ما لكيت هاي اللعبة.`, keyboard: [back] };
      }

      const lines = [`${game.emoji} *${game.title}*`, `━━━━━━━━━━━━━━━━━━━`, game.about];
      if (game.goal) lines.push(`🎯 *الهدف:* ${game.goal}`);
      if (game.reward) lines.push(`🏆 *النقاط:* ${game.reward}`);
      if (!game.ready) lines.push(`🔜 *قريباً* — اللعبة بعدها ما نزلت.`);

      return {
        text: lines.join('\n'),
        keyboard: [[{ text: 'رجوع', callback_data: `hub:g:${game.id}` }]]
      };
    }

    // ❓ الشرح
    if (section === 'help') {
      const text =
        `كيف ألعب؟\n` +
        `كل شي بالأزرار — ما تحتاج تكتب ولا أمر (بس /start).\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `1️⃣ اختار الصنف من الشاشة الرئيسية.\n` +
        `2️⃣ اختار اللعبة من الصنف.\n` +
        `3️⃣ اختر من الأزرار حسب اللعبة.\n`;
      return {
        text,
        keyboard: [[{ text: 'رجوع', callback_data: 'hub:main' }]]
      };
    }

    // 🏠 الشاشة الرئيسية (الأصناف بس بالمربعات، بلا تكرار بالنص)
    // وإذا احنا بالخاص: نعرض حالة اللاعب تحت عنوان الألعاب كل فقرة بسطر لحالها
    const personal = this.playerStatusText(viewer);
    const text =
      `🎮 *بوت الألعاب*\n` +
      `كل الألعاب هنا — اختار الصنف وبعدها اللعبة 👇` +
      (personal ? `\n\n${personal}` : '');
    const keyboard: any[][] = [
      [
        { text: '👥 ألعاب ثنائية 1v1', callback_data: 'hub:duo' },
        { text: '⚔️ ألعاب فرق 2v2', callback_data: 'hub:team' }
      ],
      [
        { text: '🧠 ألعاب خمّن', callback_data: 'hub:guess' },
        { text: '🎲 ألعاب الحظ', callback_data: 'hub:luck' }
      ]
    ];
    if (botUser) {
      keyboard.push([
        {
          text: '🛡️ ارفع البوت مشرف بقناتك',
          url: `https://t.me/${botUser}?startchannel=true`
        }
      ]);
    }
    // 💵 الفلوس والمستوى + القناة
    keyboard.push([
      { text: '🏅 المتصدرون', callback_data: 'rank:menu' },
      { text: '📢 القناة', url: 'https://t.me/pleasegodimtired' }
    ]);
    return { text, keyboard };
  }

  /** اختيار القناة مباشرة يفتح picker القنوات فوراً */
  private async sendChannelKeyboard(chatId: string) {
    const keyboard = [
      [
        {
          text: '🎮 اختيار القناة ونشر اللعبة',
          request_chat: {
            request_id: 1001,
            chat_is_channel: true,
            bot_is_member: false
          }
        }
      ]
    ];
    await this.sendMessageRaw(chatId, '🎮 اختر القناة لنشر اللعبة:', {
      keyboard,
      resize_keyboard: true,
      one_time_keyboard: true
    });
  }

  // ---------------------------------------------------------------------
  // 🟩 «خمّن الكلمة»
  // ---------------------------------------------------------------------

  /** تثبيت لعبة «خمّن الكلمة» مع تحديد حجم الذاكرة */
  private setWordle(userId: string, state: Wordle.WordleState) {
    if (!this.wordle.has(userId) && this.wordle.size >= 2000) {
      const oldest = this.wordle.keys().next().value;
      if (oldest) this.wordle.delete(oldest);
    }
    this.wordle.set(userId, state);
  }

  /** زر من أزرار «خمّن الكلمة» (حرف / مسح / إرسال / كلمة جديدة) */
  private async handleWordleKey(cb: TelegramCallbackQuery, key: string) {
    const userId = String(cb.from.id);

    if (key === 'new') {
      const previous = this.wordle.get(userId);
      const fresh = Wordle.createGame(previous?.target);
      this.setWordle(userId, fresh);
      await this.paintWordle(cb, fresh);
      await this.answerCallbackQuery(cb.id, '🟩 كلمة جديدة — بالتوفيق!');
      return;
    }

    const game = this.wordle.get(userId);
    if (!game) {
      await this.answerCallbackQuery(cb.id, 'اضغط «🟩 خمّن الكلمة» من قائمة الألعاب.', true);
      return;
    }

    if (key === 'del') {
      const next = Wordle.deleteLetter(game);
      this.setWordle(userId, next);
      await this.paintWordle(cb, next);
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    if (key === 'ok') {
      const res = Wordle.submitGuess(game);
      if (res.error) {
        await this.answerCallbackQuery(cb.id, res.error, true);
        return;
      }
      const next = res.state;
      this.setWordle(userId, next);

      // أول مرة تخلص الجولة → نسجّل النتيجة (حتى تطلع إحصائياتك الشخصية)
      if (!game.done && next.done) {
        const rec = this.users.get(userId);
        if (rec) {
          rec.wordleGames = (rec.wordleGames || 0) + 1;
          if (next.won) {
            rec.points = (rec.points || 0) + Wordle.pointsFor(next.guesses.length);
            rec.wordleWins = (rec.wordleWins || 0) + 1;
          }
          this.users.set(rec.id, rec);
        }
      }
      await this.paintWordle(cb, next);
      await this.answerCallbackQuery(cb.id, next.won ? '🎉 حليتها!' : next.done ? '😅 خلصت المحاولات' : '');
      return;
    }

    const next = Wordle.addLetter(game, key);
    this.setWordle(userId, next);
    await this.paintWordle(cb, next);
    await this.answerCallbackQuery(cb.id, '');
  }

  /** يعرض/يحدّث لوحة «خمّن الكلمة» داخل الرسالة نفسها */
  private async paintWordle(cb: TelegramCallbackQuery, state: Wordle.WordleState) {
    const chatId = String(cb.message?.chat.id || cb.from.id);
    const messageId = cb.message?.message_id;
    let text = Wordle.renderMessage(state);

    if (state.done) {
      const rec = this.users.get(String(cb.from.id));
      const gained = state.won ? Wordle.pointsFor(state.guesses.length) : 0;
      const total = rec?.points || 0;
      text += state.won
        ? `\n\n🏆 *نقاطك:* ${total} _(+${gained})_`
        : `\n\n🏆 *نقاطك:* ${total}\n_الله يعوّضك — جرّب مرة ثانية!_`;
    }

    if (messageId) {
      await this.editMessageText(chatId, messageId, text, Wordle.keyboard(state));
    } else {
      await this.sendMessage(chatId, text, Wordle.keyboard(state));
    }
  }

  // ---------------------------------------------------------------------
  // 🎭 «خمّن الشاعر»
  // ---------------------------------------------------------------------

  /** تثبيت جولة «خمّن الشاعر» مع تحديد حجم الذاكرة */
  private setPoet(userId: string, round: Poet.PoetRound) {
    if (!this.poet.has(userId) && this.poet.size >= 2000) {
      const oldest = this.poet.keys().next().value;
      if (oldest) this.poet.delete(oldest);
    }
    this.poet.set(userId, round);
  }

  /** زر من أزرار «خمّن الشاعر» (بيت جديد / اختيار شاعر) */
  private async handlePoetKey(cb: TelegramCallbackQuery, key: string) {
    const userId = String(cb.from.id);

    if (key === 'new') {
      const previous = this.poet.get(userId);
      const fresh = Poet.createRound(previous?.verse, previous?.poet);
      this.setPoet(userId, fresh);
      await this.paintPoet(cb, fresh);
      await this.answerCallbackQuery(cb.id, '🎭 بيت جديد — منو الشاعر؟');
      return;
    }

    if (key === 'noop') {
      await this.answerCallbackQuery(cb.id, '❌ هذا الخيار غلط — اختار غيره.', true);
      return;
    }

    const round = this.poet.get(userId);
    if (!round) {
      await this.answerCallbackQuery(cb.id, 'اضغط «🎭 خمّن الشاعر» من قائمة الألعاب.', true);
      return;
    }

    const index = parseInt(key, 10);
    if (isNaN(index)) {
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    const wasDone = round.done;
    const next = Poet.answer(round, index);
    this.setPoet(userId, next);

    // أول مرة تخلص الجولة → نسجّل النتيجة والنقاط
    if (!wasDone && next.done) {
      const rec = this.users.get(userId);
      if (rec) {
        rec.poetGames = (rec.poetGames || 0) + 1;
        if (next.won) {
          rec.poetWins = (rec.poetWins || 0) + 1;
          rec.points = (rec.points || 0) + Poet.pointsFor(next);
        }
        this.users.set(rec.id, rec);
      }
    }

    await this.paintPoet(cb, next);

    if (next.done) {
      await this.answerCallbackQuery(cb.id, next.won ? '🎉 عرفتها!' : '😅 الجواب كان: ' + next.poet);
    } else if (next.wrong.length) {
      await this.answerCallbackQuery(cb.id, '❌ غلط — بقيتلك محاولة وحدة!', true);
    } else {
      await this.answerCallbackQuery(cb.id, '');
    }
  }

  /** يعرض/يحدّث لوحة «خمّن الشاعر» داخل الرسالة نفسها */
  private async paintPoet(cb: TelegramCallbackQuery, round: Poet.PoetRound) {
    const chatId = String(cb.message?.chat.id || cb.from.id);
    const messageId = cb.message?.message_id;
    let text = Poet.renderMessage(round);

    if (round.done) {
      const rec = this.users.get(String(cb.from.id));
      const gained = Poet.pointsFor(round);
      const total = rec?.points || 0;
      text += round.won
        ? `\n\n🏆 *نقاطك:* ${total} _(+${gained})_`
        : `\n\n🏆 *نقاطك:* ${total}\n_الله يعوّضك — جرّب بيت ثاني!_`;
    }

    if (messageId) {
      await this.editMessageText(chatId, messageId, text, Poet.keyboard(round));
    } else {
      await this.sendMessage(chatId, text, Poet.keyboard(round));
    }
  }

  /**
   * Private /start welcome, with a button that lets the user pick a channel to play in.
   */
  private async sendPrivateWelcome(chatId: string, userName: string) {
    // بالخاص: نعرض للاعب حالته (مستواه + فلوسه + تعليق قصير) تحت عنوان الألعاب
    const rec = this.users.get(String(chatId));
    const view = await this.buildGamesMenu('main', rec);
    const welcome = `👋 أهلاً بك يا ${this.mdSafe(userName)}!\n\n${view.text}`;
    // الشاشة الرئيسية: مربعات قابلة للضغط (بلا أي كيبورد بالأسفل)
    // الشاشة الرئيسية: مربعات قابلة للضغط (بلا أي كيبورد بالأسفل)
    await this.sendMessage(chatId, await this.withBotFooter(welcome), view.keyboard);
    await this.clearReplyKeyboard(chatId);
  }

  /**
   * يشيل أي كيبورد سفلي قديم (مثل زر «🎮 الألعاب» اللي كان موجود).
   * تيليكرام يحتفظ بالكيبورد الأخير إلا إذا انبعثله remove_keyboard —
   * فنسوي رسالة صامتة ونمسحها فوراً.
   */
  private async clearReplyKeyboard(chatId: string) {
    const res = await this.sendMessageRaw(chatId, '✂️', { remove_keyboard: true });
    const messageId = res?.result?.message_id;
    if (messageId) await this.deleteMessage(chatId, messageId);
  }

  /**
   * The user picked a channel from the "share game to channel" button.
   */
  private async handleChatShared(message: TelegramMessage) {
    const shared = message.chat_shared!;
    const channelId = String(shared.chat_id);
    const title = shared.title || 'القناة';
    const byUser = message.from ? String(message.from.id) : '';


    // Fresh start in that channel: remove an old *lobby* board so the new one is clearly visible.
    const existing = this.games.get(channelId);
    if (existing && existing.status === 'lobby' && existing.messageId) {
      await this.deleteMessage(channelId, existing.messageId);
      this.games.delete(channelId);
    }

    let result = await this.startNewGameLobby(channelId, title, message.from?.id);
    // Right after the bot is added to a channel Telegram sometimes needs a second try.
    if (!result.messageId) {
      result = await this.startNewGameLobby(channelId, title, message.from?.id);
    }

    if (!byUser) return;

    if (result.messageId) {
      await this.sendMessage(
        byUser,
        `✅ نزّلت اللعبة بقناتك «${this.mdSafe(title)}».\n` +
          `روح للقناة — الأعضاء ينضمون للفرق 🔵🔴 وإنت المشرف تضغط (ابدأ اللعبة 🚀).`
      );
    } else {
      await this.sendMessage(
        byUser,
        `⚠️ ما گدرت أنزل اللعبة بقناة «${this.mdSafe(title)}».\n` +
          `*السبب:* ${this.mdSafe(String(result.error || 'غير معروف'))}\n\n` +
          `تأكد إن البوت *مشرف (Admin)* بالقناة وبعدين جرّب مرة ثانية.`
      );
    }

    // خلص اختيار القناة → نشيل الكيبورد السفلي (يرجع من مربع «📣 نزّل لعبة بقناتك»)
    await this.clearReplyKeyboard(byUser);
  }

  /**
   * Bot was added to a channel — offer a one-tap start button.
   */
  private async handleMyChatMember(update: TelegramChatMemberUpdated) {
    const status = update.new_chat_member?.status;
    if (status !== 'administrator' && status !== 'member') return;
    if (update.chat.type !== 'channel') return;

    const chatId = String(update.chat.id);
    const existing = this.games.get(chatId);
    // Never reset a lobby/match that is already open.
    if (existing && existing.status !== 'game_over') return;

    // In channels the update carries the admin who added the bot.
    const admins = update.from?.id ? [] : await this.getChatAdministrators(chatId);
    const creatorId = update.from?.id || admins.find((a: any) => a?.user?.id)?.user?.id;

    try {
      await this.startNewGameLobby(chatId, update.chat.title || 'القناة', creatorId);
    } catch (e) {
      console.error('failed to open channel lobby:', e);
    }
  }

  /**
   * Notify Spymasters with their secret map in private DM
   */
  private async notifySpymasters(game: CodenamesGame) {
    const spymasters = game.players.filter(p => p.role === 'spymaster');

    for (const spy of spymasters) {
      // 1) Explain the game in simple words (in case this is their first time)
      await this.sendMessage(String(spy.id), CodenamesEngine.getSpymasterGuide(spy.team));

      // 2) Then send the colored card map
      await this.sendMessage(
        String(spy.id),
        CodenamesEngine.getSecretKeyVisual(game, spy.team) +
          `\n\n💡 إذا ضاعت منك الخريطة، اضغط زر «🎨 بطاقاتي الملوّنة (للجاسوس 🕵️)» بالمحادثة.`
      );
    }
  }

  /**
   * Tell every player — privately — that the round has started.
   */
  private async notifyPlayersRoundStarted(game: CodenamesGame) {
    const firstTeam = game.currentTurn === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';

    for (const player of game.players) {
      const teamName = player.team === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
      const isSpy = player.role === 'spymaster';
      const roleName = isSpy ? 'جاسوس 🕵️' : 'عميل 👤';

      const tail = isSpy
        ? `🎨 خريطتك الملوّنة وصلتك 👆 وأول ما يجي دورك راح أطلب منك التلميح هنا.`
        : `👀 استنى *تلميح جاسوسك* — يوصلك هنا بالخاص.\n` +
          `وبعدها خمّنوا بالضغط على أزرار الكلمات بملعب القناة 👆`;

      await this.sendMessage(
        String(player.id),
        `🚀 *بدأت الجولة!*\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `👥 فريقك: ${teamName}\n` +
          `🎭 دورك: ${roleName}\n` +
          `🎯 يبدأ: ${firstTeam}\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          tail
      );
    }
  }

  /**
   * Privately prompt the current team's spymaster for a clue — no commands needed.
   * Uses a ForceReply "empty box" so the spymaster just types the word.
   */
  private async promptSpymasterForClue(game: CodenamesGame) {
    if (game.status !== 'spymaster_turn') return;
    const spy = game.players.find(p => p.team === game.currentTurn && p.role === 'spymaster');
    if (!spy) return;

    const teamName = game.currentTurn === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
    const res = await this.sendMessageRaw(
      String(spy.id),
      `🎯 *دورك يا جاسوس الفريق ${teamName}*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `✍️ ارسل *التلميح* اللي يوصل لصديقك (بالمربع بالأسفل):\n` +
        `• كلمة *وحدة* فقط، بلا أي كلمة ثانية.\n` +
        `• ممنوع تستخدم كلمات فريقك الموجودة بالبوكسات.\n\n` +
        `🔢 بعدها راح أطلب منك الرقم — خليه متساوي لعدد كلمات\n` +
        `فريقك اللي تربطهن بالتلميح، حتى يعرف صديقك شنو يختار.\n\n` +
        `🎨 تريد تشوف بطاقات فريقك؟ اضغط زر «🎨 بطاقاتي الملوّنة» بالقناة.`,
      { force_reply: true, selective: true, input_field_placeholder: 'اكتب كلمة التلميح (كلمة وحدة)' }
    );

    if (res?.ok) {
      this.awaitingClueWord.set(String(spy.id), String(game.id));
    }
  }

  /**
   * Spymaster typed the clue word privately (no command). Show the number chooser next.
   */
  private async handleClueWordInput(gameChatId: string, sender: TelegramUser, rawWord: string) {
    const userId = String(sender.id);
    const word = rawWord.trim();
    const game = this.games.get(gameChatId);

    if (!game) {
      this.awaitingClueWord.delete(userId);
      await this.sendMessage(userId, '⚠️ ما لقيت اللعبة، جرّب من جديد.');
      return;
    }

    const player = game.players.find(p => String(p.id) === userId);
    if (!player || player.role !== 'spymaster') {
      this.awaitingClueWord.delete(userId);
      await this.sendMessage(userId, '⚠️ إنت مو جاسوس بهذي اللعبة.');
      return;
    }

    if (game.status !== 'spymaster_turn') {
      this.awaitingClueWord.delete(userId);
      await this.sendMessage(userId, '⏳ ما حان دورك حالياً.');
      return;
    }

    if (word.includes(' ')) {
      await this.sendMessage(userId, '❌ التلميح لازم يكون *كلمة وحدة* بلا مسافات. اكتبها مره ثانية 👇');
      return;
    }

    const cardMatch = game.cards.find(c => !c.revealed && c.word.toLowerCase() === word.toLowerCase());
    if (cardMatch) {
      await this.sendMessage(userId, '🚫 هاي الكلمة موجودة على اللوحة! اختار كلمة تلميح ثانية 👇');
      return;
    }

    // Word accepted: stop expecting free text and ask for the number
    this.awaitingClueWord.delete(userId);
    this.pendingClueWord.set(userId, { chatId: gameChatId, word });

    await this.sendMessage(
      userId,
      `✅ *تلميحك:* «${this.mdSafe(word)}»\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🔢 كم كلمة من كلمات فريقك تربطهن بهذا التلميح؟\n` +
        `خلي الرقم متساوي لعدد الكلمات اللي قصدتها.\n\n` +
        `👇 اختار الرقم:`,
      [
        [
          { text: '1', callback_data: 'setclue:1' },
          { text: '2', callback_data: 'setclue:2' },
          { text: '3', callback_data: 'setclue:3' }
        ],
        [
          { text: '4', callback_data: 'setclue:4' },
          { text: '5', callback_data: 'setclue:5' },
          { text: '6', callback_data: 'setclue:6' }
        ],
        [
          { text: '7', callback_data: 'setclue:7' },
          { text: '8', callback_data: 'setclue:8' },
          { text: '9', callback_data: 'setclue:9' }
        ],
        [
          { text: '❌ إلغاء', callback_data: 'setclue_cancel' }
        ]
      ]
    );
  }

  /**
   * Spymaster pressed a number for their private clue: publish it to the game chat.
   */
  private async handleClueNumberChoice(cb: TelegramCallbackQuery, count: number) {
    const userId = String(cb.from.id);
    const userName = cb.from.first_name + (cb.from.last_name ? ` ${cb.from.last_name}` : '');
    const pending = this.pendingClueWord.get(userId);

    if (!pending) {
      await this.answerCallbackQuery(cb.id, 'انتهت صلاحية التلميح، اكتب الكلمة من جديد.', true);
      return;
    }

    const game = this.games.get(pending.chatId);
    if (!game || game.status !== 'spymaster_turn') {
      this.pendingClueWord.delete(userId);
      await this.answerCallbackQuery(cb.id, 'ما عاد دورك، اللعبة تقدمت.', true);
      return;
    }

    const result = CodenamesEngine.giveClue(game, pending.word, count, userName);
    if (!result.success) {
      this.pendingClueWord.delete(userId);
      await this.answerCallbackQuery(cb.id, '❌ ' + result.message, true);
      await this.sendMessage(userId, `❌ ${result.message}\nاكتب كلمة تلميح ثانية 👇`);
      this.awaitingClueWord.set(userId, pending.chatId);
      return;
    }

    this.pendingClueWord.delete(userId);
    this.games.set(pending.chatId, result.game);

    await this.answerCallbackQuery(cb.id, `تم ✅ التلميح: ${count}`);

    // Turn the DM chooser into a confirmation
    if (cb.message?.message_id) {
      await this.editMessageText(
        userId,
        cb.message.message_id,
        `✅ تم إرسال تلميحك: *${this.mdSafe(pending.word)}* (${count})\nبالتوفيق 🤞`
      );
    }

    // Publish to the game chat (single board message)
    const teamName = result.game.currentTurn === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
    await this.updateTelegramGameBoard(
      pending.chatId,
      result.game,
      game.messageId,
      `🎯 *${this.mdSafe(userName)}* (${teamName}) قال: «${this.mdSafe(pending.word)}» × ${count}`
    );
  }

  /**
   * Update or Edit existing Telegram Game Board message.
   * Single-message mode: we always try to EDIT the same board message.
   * A new message is only sent if the old one was deleted from the chat.
   */
  private async updateTelegramGameBoard(chatId: string, game: CodenamesGame, messageId?: number, lastEvent?: string) {
    const msgId = messageId || game.messageId;
    const text = await this.withBotFooter(CodenamesEngine.getTelegramMessageText(game, lastEvent));
    const keyboard = await this.buildKeyboard(game);

    if (msgId) {
      const res = await this.editMessageText(chatId, msgId, text, keyboard);

      // Remember the message id on success (or when nothing actually changed)
      if (res?.ok || res?.description === 'Bad Request: message is not modified') {
        game.messageId = msgId;
        this.games.set(chatId, game);
        return;
      }

      // Only fall back to a new message if the old one was deleted / can't be edited
      const desc = String(res?.description || '');
      const gone = desc.includes('message to edit not found') || desc.includes("message can't be edited");
      if (!gone) return;
    }

    const sent = await this.sendMessage(chatId, text, keyboard);
    if (sent?.result?.message_id) {
      game.messageId = sent.result.message_id;
      this.games.set(chatId, game);
    }
  }

  /** Remove characters that break Telegram Markdown from dynamic values. */
  private mdSafe(value: string): string {
    return (value || '').replace(/[*_`\[\]]/g, '');
  }

  /** Escape text written by a user so it can never break the Markdown parse. */
  private escapeMd(value: string): string {
    return String(value || '').replace(/([_*`\[\]])/g, '\\$1');
  }

  // ---------------------------------------------------------------------
  // حماية البوت من السباب (moderation)
  // ---------------------------------------------------------------------
  /**
   * أسوأ الكلمات — إذا انوجدت بالرسالة *ككلمة كاملة* ينحظر صاحبها تلقائياً.
   * مكتوبة بصيغتها المُوحّدة (بلا همزات/تشكيل، ة = ه، ى = ي).
   */
  private static readonly ABUSE_HARD: string[] = [
    'كس', 'كسك', 'كسه', 'كسها', 'كسم', 'كسمك', 'كسامك', 'كسخت', 'كسختك', 'كسكم',
    'زب', 'زبك', 'زبه', 'زبي', 'زبر', 'زبرك',
    'طيز', 'طيزك', 'طيزه',
    'كساس', 'نيكامك', 'نيكاختك', 'نيكك', 'نياك',
    'شرموط', 'شرموطه', 'شرموطك', 'شرمطه',
    'قحبه', 'قحبت', 'قحبتك', 'قحاب',
    'عرص', 'عرصه', 'عرصك', 'عرصات',
    'دعره', 'عاهره', 'عاهر', 'زانيه',
    'لوطي', 'لواط', 'منيك', 'منيوك', 'منيوكه',
    'fuck', 'fucker', 'fucking', 'bitch', 'whore', 'slut', 'cunt', 'asshole',
    'nigger', 'nigga', 'bastard'
  ];

  /**
   * كلمات بذيئة/خفيفة — تُعلَّم فقط بعلامة ⚠️ وينتظر قرار صاحب البوت
   * (حتى لا ينحظر إنسان بريء بالغلط).
   */
  private static readonly ABUSE_SOFT: string[] = [
    'كلب', 'كلبه', 'كلبك', 'كلاب', 'حمار', 'حماره', 'خنزير', 'خنزيره', 'خول',
    'غبي', 'غبيه', 'اهبل', 'هبل', 'مجنون', 'مجنونه', 'معتوه', 'حقير', 'حقيره',
    'قرد', 'تيس', 'بقره', 'وضيع', 'فاشل', 'فاشله', 'زفت', 'خرا', 'خرائي', 'وسخ',
    'عاهر', 'عاهره', 'زانيه', 'يلعن', 'لعنه', 'ملعون', 'انقلع', 'تخسا', 'نيك',
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'whore',
    'slut', 'cunt', 'idiot', 'stupid', 'moron'
  ];

  /**
   * توحيد النص حتى الإساءة تنمسك مهما تلاعبوا بالكتابة:
   * همزات، تشكيل، تطويل، محارف مخفية، ة/ه، ى/ي، حروف فارسية، رموز وإيموجي.
   */
  private normalizeAbuse(text: string): { compact: string; tokens: string[] } {
    const cleaned = String(text || '')
      .toLowerCase()
      .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '')
      .replace(/[\u064b-\u0652\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/[ىئ]/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ة/g, 'ه')
      .replace(/[کڪ]/g, 'ك')
      .replace(/ی/g, 'ي')
      .replace(/[گ]/g, 'ك')
      .replace(/[چ]/g, 'ج')
      .replace(/[ڤ]/g, 'ف')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = cleaned.split(' ').filter(Boolean);
    return { compact: tokens.join(''), tokens };
  }

  /** هل الرسالة سباب؟ (الحظر التلقائي للواضح بس) */
  private checkAbuse(text: string): { ban: boolean; flag: boolean } {
    const { compact, tokens } = this.normalizeAbuse(text);
    if (!compact) return { ban: false, flag: false };

    const hard = new Set([...TelegramBotManager.ABUSE_HARD, ...this.bannedWords]);
    const soft = new Set(TelegramBotManager.ABUSE_SOFT);

    // إذا الرسالة كلها كلمة وحدة → حظر (حتى لو كاتبها «ك س م» متفرقة)
    if (hard.has(compact)) return { ban: true, flag: true };

    // المرشحين: كل كلمة، وكل كلمتين ملزوقات («نيك» + «امك» = «نيكامك»)
    const candidates = [...tokens];
    for (let i = 0; i < tokens.length - 1; i++) {
      candidates.push(tokens[i] + tokens[i + 1]);
    }

    if (candidates.some(w => hard.has(w))) return { ban: true, flag: true };
    return { ban: false, flag: candidates.some(w => soft.has(w)) };
  }

  /** تعلّم كلمة إساءة جديدة من قرار صاحب البوت (رد «حظر»). */
  private learnAbuse(text: string) {
    const { compact, tokens } = this.normalizeAbuse(text);
    if (!compact || compact.length > 40) return;
    // نتعلّم نص الرسالة كامل (نفس الكلام بعد لا يمرّ)
    if (!this.bannedWords.includes(compact)) this.bannedWords.push(compact);
    // وإذا كانت الرسالة كلها كلمة وحدة، نتعلم الكلمة نفسها حتى لو جت داخل جملة.
    if (tokens.length === 1) {
      const token = tokens[0];
      if (token.length >= 3 && !STOP_WORDS.has(token) && !this.bannedWords.includes(token)) {
        this.bannedWords.push(token);
      }
    }
    if (this.bannedWords.length > 200) this.bannedWords = this.bannedWords.slice(-200);
  }

  // ---------------------------------------------------------------------
  // Users, chats and the owner dashboard
  // ---------------------------------------------------------------------

  /** A clickable (blue) mention of a user — tapping it opens his account. */
  private linkUser(user: { id: string | number; name?: string; username?: string }): string {
    const label = this.mdSafe(
      `${user.name || 'مستخدم'}${user.username ? ` (@${user.username})` : ''}`
    );
    return `[${label}](tg://user?id=${user.id})`;
  }

  /** Remember/refresh a user we saw in an update. */
  private trackUser(user: TelegramUser, privateStart = false): BotUserRecord {
    const id = String(user.id);
    const name = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
    const now = Date.now();

    const existing = this.users.get(id);
    if (!existing) {
      const fresh: BotUserRecord = {
        id,
        name,
        username: user.username,
        firstSeen: now,
        lastSeen: now,
        started: privateStart,
        blocked: false,
        banned: false,
        actions: 1
      };
      this.users.set(id, fresh);
      return fresh;
    }

    existing.name = name;
    if (user.username) existing.username = user.username;
    existing.lastSeen = Date.now();
    existing.actions += 1;
    if (privateStart) existing.started = true;
    this.users.set(id, existing);
    return existing;
  }

  /**
   * Ban / unban a user. A banned user gets absolutely nothing from the bot:
   * every update he sends is dropped before it is processed.
   */
  private async setBanned(userId: string, banned: boolean) {
    const rec = this.users.get(String(userId));
    if (!rec) return;
    rec.banned = banned;
    rec.lastSeen = Date.now();
    this.users.set(rec.id, rec);
  }

  /** Keep the reply→user map small (only the newest entries matter). */
  private trimInboxMap() {
    const max = 300;
    if (this.inboxMap.size <= max) return;
    const extra = this.inboxMap.size - max;
    const keys = Array.from(this.inboxMap.keys());
    for (let i = 0; i < extra; i++) {
      this.inboxMap.delete(keys[i]);
      this.inboxRaw.delete(keys[i]);
    }
  }

  /**
   * Send one message a user wrote to the bot into the owner's private chat.
   *
   * The owner sees the text, the sender's id and his name as a BLUE link, and
   * he can simply reply to that message with «حظر» to ban the sender.
   */
  private async forwardToOwnerInbox(message: TelegramMessage, sender: TelegramUser, warn = false) {
    if (!this.ownerId || !this.ownerInbox) return;
    if (message.chat.type !== 'private') return;
    if (this.isOwner(sender.id)) return;
    // Game messages (the captain typing his clue) are not "inbox" messages.
    if (
      this.awaitingClueWord.has(String(sender.id)) ||
      this.pendingClueWord.has(String(sender.id))
    ) {
      return;
    }

    const rec = this.trackUser(sender, false);
    const now = Date.now();
    // Very light anti-flood: at most one delivered message per 2 seconds.
    if (rec.lastForward && now - rec.lastForward < 2000) return;
    rec.lastForward = now;
    this.users.set(rec.id, rec);

    let body: string;
    if (message.text) {
      const raw = message.text.length > 2500 ? message.text.slice(0, 2500) + '…' : message.text;
      body = this.escapeMd(raw);
    } else if (message.photo) body = '🖼️ _صورة_';
    else if (message.sticker) body = `🎭 _ملصق_${message.sticker.emoji ? ' ' + message.sticker.emoji : ''}`;
    else if (message.voice) body = '🎤 _رسالة صوتية_';
    else if (message.video_note) body = '⭕ _فيديو دائري_';
    else if (message.video) body = '🎬 _فيديو_';
    else if (message.audio) body = '🎵 _تسجيل صوتي_';
    else if (message.animation) body = '🎞️ _صورة متحركة_';
    else if (message.document) body = '📎 _ملف_';
    else if (message.location) body = '📍 _موقع_';
    else if (message.contact) body = '👤 _جهة اتصال_';
    else body = '📨 _رسالة_';

    const header =
      `📨 *رسالة جديدة للبوت*\n` +
      (warn ? `⚠️ *يبدو بيها كلام مسيء* — راجعها وقرّر.\n` : '') +
      `👤 ${this.linkUser(rec)}\n` +
      `🆔 \`${rec.id}\`\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `${body}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `↩️ ردّ على هذه الرسالة واكتب *حظر* حتى تحظره.`;

    const sent = await this.sendMessage(String(this.ownerId), header);
    const sentId = sent?.result?.message_id;
    if (sentId) {
      this.inboxMap.set(String(sentId), rec.id);
      if (message.text) this.inboxRaw.set(String(sentId), message.text);
      this.trimInboxMap();
    }

    // Media: send a copy as well, so the owner really sees what was sent.
    if (!message.text && sentId) {
      const copy = await this.copyMessage(String(this.ownerId), String(message.chat.id), message.message_id);
      const copyId = copy?.result?.message_id;
      if (copyId) {
        this.inboxMap.set(String(copyId), rec.id);
        this.trimInboxMap();
      }
    }
  }

  /** «المقاعد الفاضية: 🔵 عميل — 🔴 جاسوس» — يخلي الرد واضح لكل واحد. */
  private freeSeatsText(game: CodenamesGame): string {
    const parts: string[] = [];
    for (const team of ['blue', 'red'] as Team[]) {
      const list = game.players.filter(p => p.team === team);
      const free: string[] = [];
      if (!list.some(p => p.role === 'spymaster')) free.push('جاسوس 🕵️');
      if (!list.some(p => p.role === 'operative')) free.push('عميل 👤');
      const teamName = team === 'blue' ? '🔵' : '🔴';
      parts.push(`${teamName} ${free.length ? free.join(' + ') : 'مكتمل ❌'}`);
    }
    return `المقاعد الفاضية: ${parts.join(' | ')}`;
  }

  /** كل المقاعد الأربعة ماخوذة؟ (جاسوس + عميل بكل فريق) */
  private lobbyIsFull(game: CodenamesGame): boolean {
    return (['blue', 'red'] as Team[]).every(
      team =>
        game.players.some(p => p.team === team && p.role === 'spymaster') &&
        game.players.some(p => p.team === team && p.role === 'operative')
    );
  }

  /**
   * لمّا يكمل عدد اللاعبين، ننبّه المشرف اللي رسل اللعبة بالخاص — هو وحده يبدأ.
   */
  private async notifySupervisorLobbyFull(game: CodenamesGame) {
    if (!game.createdBy) return;
    const title = this.mdSafe(game.chatTitle || 'المجموعة');
    const text =
      `✅ *العدد كمل — ${game.players.length} من 4!*\n\n` +
      `🎮 *اللعبة:* «${title}»\n` +
      `👥 الجواسيس والعملاء كلهن حاضرين:\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `${CodenamesEngine.teamRoster(game, 'blue')}\n\n` +
      `${CodenamesEngine.teamRoster(game, 'red')}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `👇 ارجع للمحادثة واضغط *(ابدأ اللعبة 🚀)*\n` +
      `_إنت وحدك المشرف اللي يكدر يبدأ الجولة._`;
    await this.sendMessage(String(game.createdBy), text);
  }

  /** Remember/refresh a group or channel the bot lives in. */
  private trackChat(chat?: TelegramChat) {
    if (!chat || chat.type === 'private') return;
    this.chats.set(String(chat.id), {
      id: String(chat.id),
      type: chat.type,
      title: chat.title || 'بدون اسم',
      lastSeen: Date.now()
    });
  }

  public isOwner(userId?: string | number): boolean {
    return Boolean(userId && this.ownerId && String(userId) === String(this.ownerId));
  }

  /** Send an alert to the bot owner. */
  private async notifyOwner(text: string) {
    if (!this.ownerId) return undefined;
    return await this.sendMessage(this.ownerId, text);
  }

  /**
   * Set the owner manually (used by the worker when the OWNER_ID variable is
   * configured). There is NO auto-detection: the dashboard belongs to exactly
   * one Telegram account.
   */
  public setOwnerId(ownerId?: string | number) {
    if (ownerId === undefined || ownerId === null || ownerId === '') return;
    this.ownerId = String(ownerId);
  }

  /**
   * A private message to a user failed. "blocked" means he blocked the bot —
   * the owner wants to know that.
   */
  private async noteDmFailure(userId: string, description?: string) {
    if (!this.ownerId || String(userId) === this.ownerId) return;
    const rec = this.users.get(String(userId));
    if (!rec) return;

    const desc = String(description || '').toLowerCase();
    const blocked =
      desc.includes('blocked') || desc.includes('deactivated') || desc.includes('kicked');
    if (!blocked) return;
    if (rec.blocked && rec.blockNotified) return;

    rec.blocked = true;
    rec.blockNotified = true;
    rec.lastSeen = Date.now();
    this.users.set(String(userId), rec);

    if (this.ownerAlerts) {
      await this.notifyOwner(`🚫 ${this.linkUser(rec)} حظر البوت!`);
    }
  }

  /** Compact human date (UTC) used inside the dashboard. */
  private stamp(ts: number): string {
    if (!ts) return '—';
    return new Date(ts).toISOString().replace('T', ' ').slice(0, 16);
  }

  /** The full statistics text. */
  private async buildDashboardText(): Promise<string> {
    const users = Array.from(this.users.values());
    const started = users.filter(u => u.started).length;
    const blocked = users.filter(u => u.blocked).length;
    const banned = users.filter(u => u.banned).length;

    const chats = Array.from(this.chats.values());
    const channels = chats.filter(c => c.type === 'channel');
    const groups = chats.filter(c => c.type === 'group' || c.type === 'supergroup');

    // In how many of those channels is the bot an admin?
    let adminIn = 0;
    if (this.botInfo?.id && channels.length) {
      for (const channel of channels.slice(0, 8)) {
        const admins = await this.getChatAdministrators(channel.id);
        if (admins.some(a => String(a?.user?.id) === String(this.botInfo.id))) adminIn += 1;
      }
    }

    return (
      `📊 *إحصائيات البوت*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `👥 *المستخدمون:* ${users.length}\n` +
      `✅ شغّلوا البوت: ${started}\n` +
      `🚫 حظروا البوت: ${blocked}\n` +
      `🛑 حظرتهم إنت: ${banned}\n` +
      `📨 وصول رسائل الناس إلك: ${this.ownerInbox ? 'مفعّل ✅' : 'معطّل ❌'}\n` +
      `🛡️ الحظر التلقائي للسباب: ${this.autoBan ? 'مفعّل ✅' : 'معطّل ❌'}\n\n` +
      `💬 *المحادثات:* ${chats.length}\n` +
      `📣 القنوات: ${channels.length} — البوت مشرف بـ ${adminIn}\n` +
      `👥 المجموعات: ${groups.length}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📊 إحصائيات الألعاب: من زر «📊 إحصائيات الألعاب» تحت.\n` +
      `🕒 آخر تحديث: ${this.stamp(Date.now())}`
    );
  }

  private adminPanelKeyboard(): any[][] {
    const users = Array.from(this.users.values());
    const banned = users.filter(u => u.banned).length;
    const blocked = users.filter(u => u.blocked).length;

    return [
      [{ text: '🔄 تحديث الإحصائيات', callback_data: 'admin:stats' }],
      [{ text: '📊 إحصائيات الألعاب', callback_data: 'gstat:main' }],
      [
        { text: `👥 المستخدمون (${users.length})`, callback_data: 'admin:list:all:0' },
        { text: `🛑 المحظورون (${banned})`, callback_data: 'admin:list:banned:0' }
      ],
      [
        { text: `🚫 حظروا البوت (${blocked})`, callback_data: 'admin:list:blocked:0' },
        {
          text: this.ownerInbox ? '📨 رسائل الناس: ✅' : '📴 رسائل الناس: ❌',
          callback_data: 'admin:inbox'
        }
      ],
      [
        {
          text: this.ownerAlerts ? '🔔 الإشعارات: ✅' : '🔕 الإشعارات: ❌',
          callback_data: 'admin:alerts'
        },
        {
          text: this.autoBan ? '🛡️ الحظر التلقائي: ✅' : '🛡️ الحظر التلقائي: ❌',
          callback_data: 'admin:autoban'
        }
      ]
    ];
  }

  /** Show/refresh the owner dashboard. */
  private async sendAdminPanel(chatId: string, messageId?: number) {
    const body = `👑 *لوحة تحكم صاحب البوت*\n\n${await this.buildDashboardText()}`;
    const keyboard = this.adminPanelKeyboard();

    if (messageId) {
      const res = await this.editMessageText(chatId, messageId, body, keyboard);
      if (res?.ok || String(res?.description || '').includes('not modified')) return;
    }
    await this.sendMessage(chatId, body, keyboard);
  }

  /** A page of the users list (all / banned / blocked). */
  private async sendUserList(
    chatId: string,
    messageId: number | undefined,
    kind: string,
    page: number
  ) {
    let list = Array.from(this.users.values()).sort((a, b) => b.lastSeen - a.lastSeen);
    if (kind === 'blocked') list = list.filter(u => u.blocked);
    if (kind === 'banned') list = list.filter(u => u.banned);

    const perPage = 8;
    const totalPages = Math.max(1, Math.ceil(list.length / perPage));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const slice = list.slice(safePage * perPage, safePage * perPage + perPage);

    const title =
      kind === 'blocked' ? '🚫 اللي حظروا البوت' : kind === 'banned' ? '🛑 المحظورون عندك' : '👥 المستخدمون';

    const keyboard: any[][] = slice.map(u => [
      {
        text: `${u.banned ? '🛑' : u.blocked ? '🚫' : u.started ? '✅' : '▪️'} ${u.name}${u.username ? ` (@${u.username})` : ''}`,
        callback_data: `admin:u:${u.id}`
      }
    ]);

    if (totalPages > 1) {
      const nav: any[] = [];
      if (safePage > 0) nav.push({ text: '⬅️', callback_data: `admin:list:${kind}:${safePage - 1}` });
      nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: 'admin:noop' });
      if (safePage < totalPages - 1) nav.push({ text: '➡️', callback_data: `admin:list:${kind}:${safePage + 1}` });
      keyboard.push(nav);
    }
    keyboard.push([{ text: '🔙 اللوحة', callback_data: 'admin:panel' }]);

    const body =
      `👑 *لوحة تحكم صاحب البوت*\n\n` +
      (list.length === 0
        ? `_لا أحد هنا._`
        : `${title} — *${list.length}*\n👇 اضغط على أي اسم حتى تشوف تفاصيله وتتحكم بيه.`);

    if (messageId) {
      const res = await this.editMessageText(chatId, messageId, body, keyboard);
      if (res?.ok || String(res?.description || '').includes('not modified')) return;
    }
    await this.sendMessage(chatId, body, keyboard);
  }

  /** One user's details + the control buttons. */
  private async sendUserDetail(chatId: string, messageId: number | undefined, targetId: string) {
    const u = this.users.get(String(targetId));
    if (!u) {
      if (messageId) await this.editMessageText(chatId, messageId, '⚠️ هذا المستخدم مو موجود بالقائمة.');
      return;
    }

    const body =
      `👤 ${this.linkUser(u)}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🆔 \`${u.id}\`\n` +
      `📅 أول ظهور: ${this.stamp(u.firstSeen)}\n` +
      `🕒 آخر نشاط: ${this.stamp(u.lastSeen)}\n` +
      `🔁 عدد التفاعلات: ${u.actions}\n` +
      `✅ شغّل البوت: ${u.started ? 'نعم' : 'لا'}\n` +
      `🚫 هو حظر البوت: ${u.blocked ? 'نعم' : 'لا'}\n` +
      `🛑 حظرته إنت: ${u.banned ? 'نعم — البوت يتجاهله' : 'لا'}`;

    const keyboard: any[][] = [
      [{ text: '🔗 افتح حسابه', url: `tg://user?id=${u.id}` }],
      [
        {
          text: u.banned ? '✅ امسح الحظر' : '🛑 احظره',
          callback_data: `admin:ban:${u.id}`
        }
      ],
      [{ text: '🔙 اللوحة', callback_data: 'admin:panel' }]
    ];

    const full = `👤 *تفاصيل المستخدم*\n\n${body}`;

    if (messageId) {
      const res = await this.editMessageText(chatId, messageId, full, keyboard);
      if (res?.ok || String(res?.description || '').includes('not modified')) return;
    }
    await this.sendMessage(chatId, full, keyboard);
  }

  /** Telegram API: getChatAdministrators (used to find the lobby owner inside channels). */
  private async getChatAdministrators(chatId: string): Promise<any[]> {
    if (!this.token) return [];
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.token}/getChatAdministrators?chat_id=${encodeURIComponent(chatId)}`
      );
      const data: any = await res.json();
      return data?.ok ? data.result || [] : [];
    } catch (e) {
      console.error('getChatAdministrators failed:', e);
      return [];
    }
  }

  /**
   * Who owns the lobby?
   * In groups it is whoever sent the message. Channel posts have no `from`,
   * so we fall back to the first chat administrator.
   */
  private async resolveCreator(chatId: string, message: TelegramMessage): Promise<number | string | undefined> {
    if (message.from?.id) return message.from.id;
    if (message.chat.type === 'channel') {
      const admins = await this.getChatAdministrators(chatId);
      const owner = admins.find(a => a?.user?.id)?.user?.id;
      if (owner) return owner;
    }
    return (message as any).sender_chat?.id;
  }

  /**
   * Telegram API: sendMessage with a custom reply_markup (reply keyboard, force reply, ...)
   */
  public async sendMessageRaw(chatId: string, text: string, replyMarkup?: any): Promise<any> {
    if (!this.token) return null;
    try {
      const body: any = {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      };
      if (replyMarkup) body.reply_markup = replyMarkup;

      const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (e) {
      console.error('sendMessageRaw failed:', e);
      return null;
    }
  }

  /**
   * Telegram API: copyMessage (used to show the owner the media people send)
   */
  public async copyMessage(toChatId: string, fromChatId: string, messageId: number): Promise<any> {
    if (!this.token) return null;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/copyMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: toChatId,
          from_chat_id: fromChatId,
          message_id: messageId
        })
      });
      return await res.json();
    } catch (e) {
      console.error('copyMessage failed:', e);
      return null;
    }
  }

  /**
   * Telegram API: deleteMessage (used when re-sharing a fresh lobby into a channel)
   */
  public async deleteMessage(chatId: string, messageId: number): Promise<any> {
    if (!this.token) return null;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId })
      });
      return await res.json();
    } catch (e) {
      console.error('deleteMessage failed:', e);
      return null;
    }
  }

  /**
   * Telegram API: sendMessage
   */
  public async sendMessage(chatId: string, text: string, inlineKeyboard?: any[][]): Promise<any> {
    if (!this.token) return null;

    try {
      const body: any = {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      };

      if (inlineKeyboard && inlineKeyboard.length > 0) {
        body.reply_markup = { inline_keyboard: inlineKeyboard };
      }

      const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data: any = await res.json();

      // A private message failed (positive id = private user) → learn from it.
      if (!data?.ok && Number(chatId) > 0) {
        await this.noteDmFailure(String(chatId), data?.description);
      }

      return data;
    } catch (e) {
      console.error('sendMessage failed:', e);
      return null;
    }
  }

  /**
   * Telegram API: editMessageText
   */
  public async editMessageText(chatId: string, messageId: number, text: string, inlineKeyboard?: any[][]): Promise<any> {
    if (!this.token) return null;

    try {
      const body: any = {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'Markdown'
      };

      if (inlineKeyboard) {
        body.reply_markup = { inline_keyboard: inlineKeyboard };
      }

      const res = await fetch(`https://api.telegram.org/bot${this.token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      return await res.json();
    } catch (e) {
      return null;
    }
  }

  /**
   * Telegram API: answerCallbackQuery
   */
  public async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert: boolean = false): Promise<any> {
    if (!this.token) return null;

    try {
      const body: any = {
        callback_query_id: callbackQueryId,
        show_alert: showAlert
      };
      if (text) body.text = text;

      const res = await fetch(`https://api.telegram.org/bot${this.token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      return await res.json();
    } catch (e) {
      return null;
    }
  }

  /**
   * Allow Simulator to inject simulated games directly into engine
   */
  public simulateAction(chatId: string, action: string, payload: any): any {
    let game = this.games.get(chatId);
    if (!game) {
      game = CodenamesEngine.createLobby(chatId, payload.chatTitle || 'مجموعة تجريبية', payload.wordPack || 'arabic_standard');
      this.games.set(chatId, game);
    }

    if (action === 'new_game') {
      game = CodenamesEngine.createLobby(chatId, payload.chatTitle || 'مجموعة تجريبية', payload.wordPack || 'arabic_standard');
      this.games.set(chatId, game);
      return { success: true, game };
    }

    if (action === 'join') {
      const res = CodenamesEngine.joinGame(game, payload.player);
      if (res.success) this.games.set(chatId, res.game);
      return res;
    }

    if (action === 'start') {
      const res = CodenamesEngine.startGame(game, this.customWords);
      if (res.success) this.games.set(chatId, res.game);
      return res;
    }

    if (action === 'clue') {
      const res = CodenamesEngine.giveClue(game, payload.word, payload.count, payload.spymasterName);
      if (res.success) this.games.set(chatId, res.game);
      return res;
    }

    if (action === 'guess') {
      const res = CodenamesEngine.guessCard(game, payload.cardId, payload.operativeName);
      if (res.success) {
        this.games.set(chatId, res.game);
        if (res.game.status === 'game_over') {
          this.recordFinishedGame(res.game);
        }
      }
      return res;
    }

    if (action === 'pass') {
      const res = CodenamesEngine.passTurn(game, payload.operativeName);
      if (res.success) this.games.set(chatId, res.game);
      return res;
    }

    if (action === 'record_finish' || action === 'record_game') {
      if (payload.game && payload.game.status === 'game_over') {
        this.recordFinishedGame(payload.game);
        return { success: true, message: 'Game recorded' };
      }
      return { success: false, message: 'Game is not over' };
    }

    if (action === 'sample_match') {
      const sample = this.addSampleFinishedGame();
      return { success: true, match: sample };
    }

    return { success: false, message: 'إجراء غير معروف' };
  }
}

export const telegramBot = new TelegramBotManager(process.env.TELEGRAM_BOT_TOKEN);
