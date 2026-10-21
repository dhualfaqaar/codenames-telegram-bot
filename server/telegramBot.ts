import { CodenamesEngine } from '../src/services/codenamesEngine';
import * as Wordle from '../src/services/wordleEngine';
import * as Poet from '../src/services/poetEngine';
import * as RPS from '../src/services/rpsEngine';
import * as GG from '../src/services/groupGamesEngine';
import * as Song from '../src/services/songEngine';
import * as MathGame from '../src/services/mathEngine';
import * as Economy from '../src/services/economy';
import * as WK from '../src/services/whoKnowsEngine';
import * as MF from '../src/services/mafiaEngine';
import * as OOL from '../src/services/outOfLoopEngine';
import * as MS from '../src/services/mediaServicesEngine';
import * as ARX from '../src/services/arenaGamesEngine';
import * as TRN from '../src/services/tournamentEngine';
import * as EXT from '../src/services/extraToolsEngine';
import { BOT_AVATAR_JPG_BASE64, BOT_AVATAR_PNG_BASE64 } from '../src/assets/botAvatarBase64';

const ZW_GUARD = '\u2060\u200D\u2060';
function encodeHiddenTag(payload: string): string {
  const bytes = Buffer.from(payload, 'utf8');
  let bits = '';
  for (const b of bytes) {
    bits += b.toString(2).padStart(8, '0').replace(/0/g, '\u200B').replace(/1/g, '\u200C');
  }
  return ZW_GUARD + bits + ZW_GUARD;
}
function decodeHiddenTag(text: string): { tag: string; deployerId?: string } | null {
  const s = String(text || '');
  const i = s.indexOf(ZW_GUARD);
  if (i < 0) return null;
  const j = s.indexOf(ZW_GUARD, i + ZW_GUARD.length);
  if (j < 0) return null;
  const raw = s.slice(i + ZW_GUARD.length, j);
  if (!raw || raw.length % 8 !== 0) return null;
  const bytes: number[] = [];
  for (let k = 0; k < raw.length; k += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit++) {
      byte = (byte << 1) | (raw[k + bit] === '\u200C' ? 1 : 0);
    }
    bytes.push(byte);
  }
  const decoded = Buffer.from(bytes).toString('utf8');
  const [tag, deployerId] = decoded.split('|');
  return tag ? { tag, deployerId: deployerId || undefined } : null;
}
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
  sender_chat?: TelegramChat;
  author_signature?: string;
  chat: TelegramChat;
  date: number;
  text?: string;
  chat_shared?: TelegramChatShared;
  /** الرسالة نُشرت عبر بوت إنلاين (بطاقات «العب بالقناة») */
  via_bot?: TelegramUser;
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
  /** موجود بدل message لو الرسالة أصلها إنلاين — الأزرار منها توصل هكذا */
  inline_message_id?: string;
  data?: string;
}

/** رسالة إنلاين — لما المستخدم يكتب @bot بالمحادثة */
interface TelegramInlineQuery {
  id: string;
  from: TelegramUser;
  query: string;
  offset?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  inline_query?: TelegramInlineQuery;
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
  category: 'duo' | 'team' | 'team3' | 'team4' | 'group';
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
  /** لعبة خمّن؟ (تظهر داخل قسم «ألعاب خمّن» بالجماعية) */
  guess?: boolean;
  /** حمولة زر «العب بالقناة» للإنلاين (مثلاً 'gq speed') */
  inline?: string;
  /** جاهزة للعب؟ (غير الجاهزة تظهر 🔜) */
  ready: boolean;
}

const BOT_GAMES: BotGameCard[] = [
  // ─────────────── 👥 ألعاب ثنائية (1 ضد 1) ───────────────
  {
    id: 'mafia',
    emoji: '🕵️',
    title: 'المافيا',
    category: 'group',
    players: 'من 4 إلى 12 لاعباً',
    where: 'في القناة أو المجموعة',
    goal: 'كشف أفراد المافيا وطردهم قبل سيطرتهم على المدينة',
    reward: 'خبرة وجوائز للفريق الفائز',
    about:
      'تتوزع الأدوار سرّاً بين المشاركين (مافيا، طبيب، محقق، ومواطنون).\n' +
      'في الليل تتحرك المافيا والطبيب والمحقق سرّاً، وفي النهار يصوّت الأحياء لطرد المشتبه به.',
    channel: true,
    inline: 'mf',
    ready: true
  },
  {
    id: 'out_of_loop',
    emoji: '🎭',
    title: 'منو برا السالفة؟',
    category: 'group',
    players: 'من 3 إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'كشف اللاعب الوحيد الذي لا يعرف السالفة السرية',
    reward: 'نقاط وخبرة وجوائز للأذكى بالتصويت والتخمين',
    about:
      'يعرف جميع اللاعبين الكلمة السرية ضمن الصنف المختار ما عدا لاعباً واحداً يكون «برا السالفة».\n' +
      'يتساءل اللاعبون ويصوّتون لكشفه، ثم يحصل هو على فرصة أخيرة لتخمين الكلمة السرية!',
    channel: true,
    inline: 'ool',
    ready: true
  },
  {
    id: 'who_knows',
    emoji: '🤝',
    title: 'منو يعرف الثاني أكثر؟',
    category: 'duo',
    players: 'لاعبان (شخصان في التحدي)',
    where: 'في القناة والخاص مع البوت',
    goal: 'معرفة أكبر عدد من إجابات الطرف الثاني الحقيقية',
    reward: 'جوائز وخبرة للفائز ونقاط لكل بطاقة صحيحة',
    about:
      'يرسل البوت لكل مشارك في الخاص سلسلة أسئلة شخصية (أكلتك المفضلة، لونك المفضل، مشروبك، وجهتك…) وتُثبَّت إجابات كل طرف بسرية تامة عند البوت.\n' +
      'بعدها يحاول كل طرف تخمين إجابات الطرف الثاني، وفي النهاية تُكشف جميع البطاقات في القناة لمعرفة من يعرف الثاني أكثر وكم بطاقة أصاب كل طرف.',
    channel: true,
    inline: 'wk',
    ready: true
  },
  {
    id: 'rps',
    emoji: '✊',
    title: 'حجرة ورقة مقص',
    category: 'duo',
    players: 'لاعبان (1 ضد 1)',
    where: 'في القناة أو المجموعة',
    goal: 'الفوز بأغلبية الجولات على منافسك',
    reward: '0.011 💵 للفائز',
    about:
      'مواجهة ثنائية كلاسيكية: الحجرة تكسر المقص، والمقص يقص الورقة، والورقة تغطي الحجرة.\n' +
      'التعادل يعيد الجولة، وصاحب أعلى نقاط في النهاية يحسم الفوز.',
    channel: true,
    ready: true
  },

  // ─────────────── ⚔️ ألعاب الفرق (2 ضد 2) ───────────────
  {
    id: 'codenames',
    emoji: '🎮',
    title: 'كود نيمز (Codenames)',
    category: 'team',
    players: '4 لاعبين — فريقان (جاسوس 🕵️ + عميل 👤 لكل فريق)',
    where: 'في القناة أو المجموعة',
    goal: 'كشف جميع بطاقات فريقك قبل الفريق المنافس',
    about:
      'يتنافس الفريقان الأزرق 🔵 والأحمر 🔴 لكشف بطاقاتهما السرية على اللوحة.\n' +
      'يعطي الجاسوس تلميحاً من كلمة واحدة مع عدد البطاقات المرتبطة بها، ويختار العميل البطاقات المقصودة.\n' +
      'الفريق الذي يكشف جميع بطاقاته أولاً يفوز، ومن يكشف بطاقة القاتل 💀 يخسر فوراً.',
    channel: true,
    ready: true
  },

  // ─────────────── 🎉 الألعاب الجماعية بالقناة ───────────────
  {
    id: 'poet',
    emoji: '🎭',
    title: 'الشعراء',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة الشاعر صاحب البيت الشهير',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about:
      'يُعرض بيت شعر عربي شهير في كل جولة مع أربعة شعراء، وعليك معرفة الشاعر القائل.',
    channel: true,
    inline: 'gq poet',
    ready: true
  },
  {
    id: 'guess_player',
    emoji: '⚽',
    title: 'اللاعبون',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة اسم لاعب كرة القدم من مسيرته وألقابه',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about:
      'تُعرض معلومات وتلميحات عن نجم كرة قدم عربي أو عالمي مع أربعة أسماء، وعليك معرفة اللاعب المقصود.',
    channel: true,
    inline: 'gq player',
    ready: true
  },
  {
    id: 'guess_song',
    emoji: '🎵',
    title: 'الأغاني',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة الفنان صاحب الأغنية المعروضة',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about:
      'اختر الأغاني العربية أو الإنجليزية، ويعرض البوت اسم أغنية معروفة مع أربعة أسماء فنانين لتعرف لمنو هذه الأغنية.',
    channel: true,
    ready: true
  },
  {
    id: 'odd_word',
    emoji: '🕵️',
    title: 'الكلمة الغريبة',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'اكتشاف الكلمة الدخيلة التي لا تنتمي لبقية الكلمات',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about:
      'يعرض البوت 5 كلمات: 4 منها من نفس الصنف الواضح، وكلمة خامسة دخيلة لا تنتمي إليها.\n' +
      'اختر الكلمة الغريبة قبل انتهاء وقت الجولة.',
    channel: true,
    inline: 'gq odd',
    ready: true
  },

  // ─────────────── 🎉 الألعاب الجماعية بالقناة (من لاعبين إلى 10 لاعبين) ───────────────
  {
    id: 'math',
    emoji: '🧮',
    title: 'تحدي الحساب',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'حصد أعلى نقاط عبر سرعة الحل الصحيح',
    reward: 'نقطة لأسرع إجابة صحيحة في كل جولة',
    about:
      'مسائل حسابية سريعة في الجمع والطرح والضرب من 10 جولات.\n' +
      'يكسب نقطة الجولة أسرع لاعب يختار الناتج الصحيح، وصاحب أعلى رصيد في النهاية يفوز.',
    channel: true,
    inline: 'gq math',
    ready: true
  },
  {
    id: 'speed_quiz',
    emoji: '⚡',
    title: 'مسابقة السرعة',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'حصد أعلى نقاط عبر سرعة الإجابة الصحيحة',
    reward: 'نقطة لأسرع إجابة صحيحة في كل جولة',
    about:
      'أسئلة ثقافية سريعة من 10 جولات.\n' +
      'أسرع لاعب يختار الإجابة الصحيحة يكسب نقطة الجولة، والأعلى نقاطاً يفوز.',
    channel: true,
    inline: 'gq speed',
    ready: true
  },
  {
    id: 'trivia_battle',
    emoji: '🧠',
    title: 'معركة المعلومات',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'تحقيق أعلى مجموع نقاط في 10 جولات',
    reward: 'نقطة لكل إجابة صحيحة',
    about:
      'منافسة معلومات عامة من 10 جولات في مختلف المجالات.\n' +
      'كل إجابة صحيحة تمنح صاحبها نقطة، وصاحب أعلى مجموع في النهاية يفوز.',
    channel: true,
    inline: 'gq trivia',
    ready: true
  },
  {
    id: 'general_quiz',
    emoji: '📚',
    title: 'أسئلة عامة',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'حصد أعلى نقاط في 10 جولات ثقافية متنوعة',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about:
      'مسابقة جماعية متجددة من 10 جولات تغطي العلوم والفضاء واللغة والطبيعة والثقافة العامة.\n' +
      'تُحتسب نقطة لكل إجابة صحيحة خلال 15 ثانية، وصاحب أعلى رصيد في النهاية يحسم الفوز.',
    channel: true,
    inline: 'gq general',
    ready: true
  },
  {
    id: 'geography_quiz',
    emoji: '🗺️',
    title: 'جغرافيا',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'حصد أعلى نقاط في 10 جولات جغرافية',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about:
      'منافسة جغرافية شيّقة من 10 جولات تشمل الدول والجزر والمضائق والأنهار والجبال والمحيطات وجغرافية العراق والعالم.\n' +
      'كل إجابة صحيحة تمنح نقطة، والأعلى رصيداً في ختام الجولات يفوز.',
    channel: true,
    inline: 'gq geo',
    ready: true
  },
  {
    id: 'history_quiz',
    emoji: '🏛️',
    title: 'تاريخ',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'حصد أعلى نقاط في 10 جولات تاريخية',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about:
      'منافسة تاريخية ممتعة من 10 جولات تمتد من حضارات سومر وبابل وآشور في العراق إلى التاريخ العربي والإسلامي وأبرز محطات التاريخ العالمي.\n' +
      'كل إجابة صحيحة تمنح نقطة، وصاحب الصدارة في النهاية يفوز.',
    channel: true,
    inline: 'gq history',
    ready: true
  },
  {
    id: 'gq_country',
    emoji: '🏳️',
    title: 'الدول',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة أكبر عدد من الدول الصحيحة',
    reward: 'نقطة لكل إجابة صحيحة',
    about:
      'تُعرض معلومة مميزة عن دولة من دول العالم في كل جولة، وعليك معرفة الدولة المقصودة.',
    channel: true,
    inline: 'gq country',
    ready: true
  },
  {
    id: 'gq_movie',
    emoji: '🎬',
    title: 'الأفلام',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة أكبر عدد من الأفلام الصحيحة',
    reward: 'نقطة لكل إجابة صحيحة',
    about:
      'نبذة موجزة عن قصة فيلم شهير دون حرق للأحداث، وعليك معرفة اسم الفيلم الصحيح.',
    channel: true,
    inline: 'gq movie',
    ready: true
  },
  {
    id: 'gq_series',
    emoji: '📺',
    title: 'المسلسلات',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة أكبر عدد من المسلسلات الصحيحة',
    reward: 'نقطة لكل إجابة صحيحة',
    about:
      'نبذة موجزة عن مسلسل عربي أو عالمي شهير، وعليك معرفة اسم المسلسل الصحيح.',
    channel: true,
    inline: 'gq series',
    ready: true
  },
  {
    id: 'gq_number',
    emoji: '🔢',
    title: 'الأرقام',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة أكبر عدد من الأرقام الصحيحة',
    reward: 'نقطة لكل إجابة صحيحة',
    about:
      'أسئلة ثقافية وحقائق رقمية ممتعة، وعليك معرفة الرقم الصحيح في كل جولة.',
    channel: true,
    inline: 'gq number',
    ready: true
  },
  {
    id: 'gq_food',
    emoji: '🍲',
    title: 'الأكلات',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة أكبر عدد من الأكلات الصحيحة',
    reward: 'نقطة لكل إجابة صحيحة',
    about:
      'وصف لأشهر الأكلات العربية والعالمية، وعليك معرفة اسم الأكلة الصحيحة.',
    channel: true,
    inline: 'gq food',
    ready: true
  },
  {
    id: 'gq_flags',
    emoji: '🚩',
    title: 'الأعلام',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة أكبر عدد من أعلام الدول',
    reward: 'نقطة لكل إجابة صحيحة',
    about:
      'يُعرض علم إحدى الدول في كل جولة، وعليك معرفة الدولة صاحبة هذا العلم.',
    channel: true,
    inline: 'gq flags',
    ready: true
  },
  {
    id: 'gq_capitals',
    emoji: '🏛️',
    title: 'العواصم',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة أكبر عدد من عواصم الدول',
    reward: 'نقطة لكل إجابة صحيحة',
    about:
      'تُذكر دولة في كل جولة، وعليك معرفة عاصمتها الصحيحة.',
    channel: true,
    inline: 'gq capitals',
    ready: true
  },
  {
    id: 'gq_continents',
    emoji: '🌍',
    title: 'دولة القارة',
    category: 'group',
    guess: true,
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة الدولة التي تقع ضمن القارة المطلوبة',
    reward: 'نقطة لكل إجابة صحيحة',
    about:
      'تُحدَّد قارة في كل جولة، وعليك معرفة الدولة التي تقع ضمن هذه القارة من بين الدول المعروضة.',
    channel: true,
    inline: 'gq continents',
    ready: true
  },

  // ─────────────── 🏟️ جميع الألعاب التفاعلية الـ 25 الجديدة (جماعية + 1v1 + 2v2 + 3v3 + 4v4) ───────────────
  ...(Object.keys(ARX.ARENA_MODES) as ARX.ArenaMode[]).map(m => {
    const meta = ARX.ARENA_MODES[m];
    return {
      id: meta.mode,
      emoji: meta.emoji,
      title: meta.title,
      category: meta.category,
      players: meta.playersLabel,
      where: 'في القناة أو المجموعة',
      goal: meta.goal,
      reward: meta.reward,
      about: meta.about,
      channel: true,
      inline: `arx ${meta.shortCode}`,
      ready: true
    } as BotGameCard;
  }),

  // ─────────────── ⚡ ألعاب جماعية سريعة ───────────────
  {
    id: 'fast_islamic',
    emoji: '🕌',
    title: 'إسلاميات وتراث',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'حصد أعلى النقاط في القصص القرآنية والسيرة والتراث الأصيل',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about: 'منافسة متجددة من 10 جولات تشمل السور والأنبياء والصحابة والأمثال الشعبية والتراث العراقي والعربي.',
    channel: true,
    inline: 'gq islamic',
    ready: true
  },
  {
    id: 'fast_science',
    emoji: '🔬',
    title: 'علوم وفضاء واختراعات',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'حصد أعلى النقاط في العلوم والفضاء والاختراعات',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about: 'جولات مشوّقة في الكواكب والفيزياء والكيمياء وجسم الإنسان وأعظم المكتشفين والمخترعين.',
    channel: true,
    inline: 'gq science',
    ready: true
  },
  {
    id: 'fast_animals',
    emoji: '🦁',
    title: 'عالم الحيوان والطبيعة',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة أسرار الكائنات والطبيعة وحصد الصدارة',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about: 'معلومات مدهشة وأرقام قياسية عن الحيوانات والطيور والكائنات البحرية والطبيعة.',
    channel: true,
    inline: 'gq animals',
    ready: true
  },
  {
    id: 'fast_tech',
    emoji: '💻',
    title: 'تقنية وألعاب فيديو',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'التفوّق في عالم التقنية والحواسيب والألعاب الإلكترونية',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about: 'أسئلة متنوّعة في الأنظمة والشركات التقنية والعتاد وأشهر سلاسل الألعاب العالمية.',
    channel: true,
    inline: 'gq tech',
    ready: true
  },
  {
    id: 'fast_dialects',
    emoji: '🗣️',
    title: 'معاني الكلمات واللهجات',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة معاني المفردات العراقية والعربية المتنوعة',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about: 'اختبر معرفتك بمعاني المفردات العراقية والخليجية والشامية والمصرية والمغربية والفصحى.',
    channel: true,
    inline: 'gq dialects',
    ready: true
  },
  {
    id: 'fast_brands',
    emoji: '🚗',
    title: 'شعارات وماركات وسيارات',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة أشهر الشركات والسيارات وبلدان منشئها',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about: 'منافسة سريعة حول أشهر الماركات العالمية وشركات السيارات وشعاراتها.',
    channel: true,
    inline: 'gq brands',
    ready: true
  },
  {
    id: 'fast_football_quiz',
    emoji: '🏆',
    title: 'كرة قدم عالمية وعراقية',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'حصد صدارة الكرة العراقية والعالمية',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about: 'أسئلة كروية ممتعة تشمل أسود الرافدين والأندية العراقية وكأس العالم ودوري أبطال أوروبا.',
    channel: true,
    inline: 'gq fbquiz',
    ready: true
  },
  {
    id: 'fast_tf',
    emoji: '✅',
    title: 'صح لو خطأ السريع',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'سباق سرعة حاسم لاختيار صح أو خطأ قبل الجميع',
    reward: 'نقطة لأسرع إجابة صحيحة في كل جولة',
    about: 'تُعرض حقيقة مدهشة مع زرّين فقط (✅ صح / ❌ خطأ)؛ أول إجابة صحيحة تحسم نقطة الجولة فوراً!',
    channel: true,
    inline: 'gq tf',
    ready: true
  },
  {
    id: 'fast_emoji_math',
    emoji: '🧮',
    title: 'إيموجي المعادلات الذكية',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'حل المعادلات المصوّرة بالإيموجي بأسرع وقت',
    reward: 'نقطة لأسرع حل صحيح في كل جولة',
    about: 'ألغاز معادلات رمزية بالرموز التعبيرية تختبر سرعة البديهة والحساب الذهني.',
    channel: true,
    inline: 'gq emath',
    ready: true
  },

  {
    id: 'guess_novel',
    emoji: '📚',
    title: 'الروايات والكتب',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة الرواية أو الكتاب الشهير من فكرته وأبطاله',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about: 'نبذة مشوّقة عن كتاب أو رواية عربية أو عالمية خالدة مع 4 خيارات لاختيار العمل الصحيح.',
    channel: true,
    inline: 'gq novel',
    ready: true
  },
  {
    id: 'guess_landmark',
    emoji: '🏛️',
    title: 'المعالم السياحية',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة المعلم السياحي أو الأثري الشهير من وصفه',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about: 'وصف معماري وتاريخي لأشهر المعالم العراقية والعربية والعالمية وعليك معرفة المعلم المقصود.',
    channel: true,
    inline: 'gq landmark',
    ready: true
  },
  {
    id: 'guess_vgame',
    emoji: '🎮',
    title: 'ألعاب الفيديو',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة اللعبة الإلكترونية الشهيرة من قصتها أو طريقة لعبها',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about: 'وصف لعالم اللعبة أو بطلها الشهير مع 4 خيارات لمعرفة اللعبة الإلكترونية الصحيحة.',
    channel: true,
    inline: 'gq vgame',
    ready: true
  },
  {
    id: 'guess_creature',
    emoji: '🐾',
    title: 'الكائنات الحية',
    category: 'group',
    players: 'من لاعبين إلى 10 لاعبين',
    where: 'في القناة أو المجموعة',
    goal: 'معرفة الكائن الحي من صفاته وحقائقه الفريدة',
    reward: 'نقطة لكل إجابة صحيحة وجوائز للمتصدر',
    about: 'ثلاث صفات وحقائق مدهشة عن كائن برّي أو بحري أو طائر وعليك معرفة الكائن المقصود.',
    channel: true,
    inline: 'gq creature',
    ready: true
  }
];

/** معلومات الأصناف */
const GAME_CATEGORIES: Record<string, { emoji: string; title: string; intro: string }> = {
  duo: {
    emoji: '👥',
    title: 'ألعاب ثنائية (1 ضد 1)',
    intro: 'منافسات ثنائية مباشرة وجهاً لوجه.'
  },
  team: {
    emoji: '⚔️',
    title: 'ألعاب الفرق (2 ضد 2)',
    intro: 'منافسات تكتيكية وتعاونية بنظام الفريقين (2 ضد 2).'
  },
  team3: {
    emoji: '🔥',
    title: 'ألعاب ثلاثية (3v3)',
    intro: 'مواجهات حماسية بنظام الفريقين الثلاثيين (3 ضد 3).'
  },
  team4: {
    emoji: '🏰',
    title: 'ألعاب رباعية (4v4)',
    intro: 'معارك عشائر وفرق كبرى بنظام (4 ضد 4).'
  },
  group: {
    emoji: '🎉',
    title: 'الألعاب الجماعية',
    intro: 'ألعاب جماعية في القناة أو المجموعة، وعدد اللاعبين يختلف حسب اللعبة.'
  },
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
  /** ✊ كم مباراة حجرة ورقة مقص فاز */
  rpsWins?: number;
  /** ✊ كم مباراة حجرة ورقة مقص لعب (فاز أو خسر) */
  rpsGames?: number;
  /** 🎵 كم أغنية عرف بـ«خمّن الأغنية» */
  guessSongWins?: number;
  /** 🎵 كم أغنية لعب بـ«خمّن الأغنية» */
  guessSongGames?: number;
  /** 🔢 كم جولة فاز بـ«تحدي الحساب» */
  mathWins?: number;
  /** 🔢 كم جولة لعب بـ«تحدي الحساب» */
  mathGames?: number;
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
  /** إحصائيات الألعاب الجماعية لكل نوع (speed / trivia / math / flags / ...) */
  gqStats?: Record<string, { games: number; wins: number; points: number }>;
  /** 🔐 ماسترمايند: كم لعبة لعب / فاز / أقل محاولات */
  mmGames?: number;
  mmWins?: number;
  mmBestTries?: number;
  /** ⚽ خمّن اللاعب: كم مباراة لعب / فاز */
  guessPlayerGames?: number;
  guessPlayerWins?: number;
  wkGames?: number;
  wkWins?: number;
  wkCorrect?: number;
  mfGames?: number;
  mfWins?: number;
  oolGames?: number;
  oolWins?: number;
  owGames?: number;
  owWins?: number;
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
  /** أي لعبة راح تنشرها بالقناة (Key: User ID) */
  private pendingChannelGame: Map<string, { gameId: string; rounds?: number; at: number }> = new Map();
  /** ✊✋✌️ مباريات حجرة ورقة مقص بالقنوات (Key: chatId) */
  private rpsGames: Map<string, RPS.RPSGame> = new Map();
  private gqGames: Map<string, GG.QuizGame> = new Map();
  private mmGames: Map<string, GG.MMGame> = new Map();
  /** 🎵 جولات خمّن الأغنية (Key: user id) */
  private song: Map<string, Song.SongRound> = new Map();
  /** 🔢 جولات تحدي الحساب (Key: user id) */
  private mathGames: Map<string, MathGame.MathRound> = new Map();
  private wkGames: Map<string, WK.WKGame> = new Map();
  private mafiaGames: Map<string, MF.MafiaGame> = new Map();
  private oolGames: Map<string, OOL.OOLGame> = new Map();
  private arenaGames: Map<string, ARX.ArenaGame> = new Map();
  private tournamentGames: Map<string, TRN.TournamentGame> = new Map();
  private pendingClosestNum: Map<string, string> = new Map();
  private whispers: Map<string, MS.WhisperRecord> = new Map();
  private pendingWhispers: Map<string, MS.PendingWhisperDraft> = new Map();
  private pendingSocialDl: Map<string, MS.SocialPlatform> = new Map();
  private seenUpdateIds: Set<number> = new Set();
  private activeSocialDownloads: Set<string> = new Set();
  private mediaSessionMsgs: Map<string, number[]> = new Map();
  private activeDownloadSlots: number = 0;
  private waitingDownloadResolvers: Array<() => void> = [];
  private rouletteSessions: Map<string, EXT.RouletteSession> = new Map();
  private privateRouletteLists: Map<string, string[]> = new Map();
  private pendingRouletteText: Set<string> = new Set();
  private pendingAgeCalc: Set<string> = new Set();
  private pendingConvert: Map<string, { fileId: string; kind: string }> = new Map();
  private audioEditDrafts: Map<string, EXT.AudioMetadataDraft> = new Map();
  private avatarDeliveredV2: boolean = false;
  private pendingVocalSep: Set<string> = new Set();
  private songSearches: Map<string, MS.SongSearchHit[]> = new Map();
  private lastInlineDeployer?: { id: string; at: number };
  private commandsSyncVer: number = 0;
  /** هل البيئة الخارجية (Cloudflare Durable Object Alarm) تدير المؤقت؟ */
  private externalScheduler: boolean = false;
  private localQuizTimer: any = null;

  constructor(initialToken?: string, ownerId?: string, externalScheduler: boolean = false) {
    if (initialToken) {
      this.token = initialToken.trim();
    }
    if (ownerId) this.ownerId = String(ownerId);
    this.externalScheduler = externalScheduler;
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
    return this.ensureUser(player.id, player.name, player.username);
  }

  /** يجلب سجل المستخدم أو ينشئه فوراً حتى ما تضيع إحصائية أي لاعب بالقناة أو الخاص */
  private ensureUser(id: string | number, name?: string, username?: string): BotUserRecord {
    const key = String(id);
    let rec = this.users.get(key);
    if (!rec) {
      const now = Date.now();
      rec = {
        id: key,
        name: name || 'لاعب',
        username,
        firstSeen: now,
        lastSeen: now,
        started: false,
        blocked: false,
        banned: false,
        actions: 0
      };
      this.users.set(key, rec);
    } else {
      if (name && name !== 'لاعب' && name !== 'الناشر') rec.name = name;
      if (username) rec.username = username;
    }
    return rec;
  }

  /** سطر اقتباس ملوّن موحّد لأي اسم شخص بكل مكان بالبوت: > 1 - | *الاسم* | ... */
  private quoteRow(rankOrIcon: number | string, name: string, detail = ''): string {
    const safeName = GG.md(name || 'لاعب');
    const prefix = typeof rankOrIcon === 'number' ? `${rankOrIcon} - ` : rankOrIcon ? `${rankOrIcon} ` : '';
    const suffix = detail ? ` ${detail}` : '';
    return `> ${prefix}\\| *${safeName}* \\|${suffix}`;
  }

  private static readonly GQ_GAME_KIND: Record<string, GG.QuizKind> = {
    general_quiz: 'general',
    geography_quiz: 'geo',
    history_quiz: 'history',
    speed_quiz: 'speed',
    trivia_battle: 'trivia',
    math: 'math',
    gq_country: 'country',
    gq_movie: 'movie',
    gq_series: 'series',
    gq_number: 'number',
    gq_food: 'food',
    gq_flags: 'flags',
    gq_capitals: 'capitals',
    gq_continents: 'continents',
    odd_word: 'odd',
    poet: 'poet',
    guess_player: 'player',
    fast_islamic: 'islamic',
    fast_science: 'science',
    fast_animals: 'animals',
    fast_tech: 'tech',
    fast_dialects: 'dialects',
    fast_brands: 'brands',
    fast_football_quiz: 'fbquiz',
    fast_tf: 'tf',
    fast_emoji_math: 'emath',
    guess_novel: 'novel',
    guess_landmark: 'landmark',
    guess_vgame: 'vgame',
    guess_creature: 'creature'
  };

  private userGqStat(u: BotUserRecord, kind: GG.QuizKind): { games: number; wins: number; points: number } {
    const cur = u.gqStats?.[kind] || { games: 0, wins: 0, points: 0 };
    if (kind === 'math') {
      return {
        games: cur.games + (u.mathGames || 0),
        wins: cur.wins + (u.mathWins || 0),
        points: cur.points
      };
    }
    if (kind === 'odd') {
      return {
        games: cur.games + (u.owGames || 0),
        wins: cur.wins + (u.owWins || 0),
        points: cur.points + (u.owWins || 0) * 10
      };
    }
    if (kind === 'poet') {
      return {
        games: cur.games + (u.poetGames || 0),
        wins: cur.wins + (u.poetWins || 0),
        points: cur.points + (u.poetWins || 0) * 10
      };
    }
    if (kind === 'player') {
      return {
        games: cur.games + (u.guessPlayerGames || 0),
        wins: cur.wins + (u.guessPlayerWins || 0),
        points: cur.points + (u.guessPlayerWins || 0)
      };
    }
    return cur;
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
      rec.points = (rec.points || 0) + 5 + entry.correct;
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

    const loserLines: string[] = [];
    for (const s of loserScores) {
      const rec = this.walletOf(s.player);
      const perf = 0.35 + 0.65 * (s.score / loserBest);
      const add = Economy.xpForResult('codenames', false, perf);
      rec.xp = (rec.xp || 0) + add;
      rec.onlineGames = (rec.onlineGames || 0) + 1;
      this.users.set(rec.id, rec);
      loserLines.push(this.quoteRow('✨', s.player.name, `(+${add} XP)`));
    }

    game.rewarded = true;

    const lines: string[] = [`💰 *جوائز المباراة* — ${game.winner === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴'} فاز`, `━━━━━━━━━━━━━━━━━━━`];
    lines.push(
      gained
        .map((g, i) => {
          const details: string[] = [];
          if (g.money > 0) details.push(`+${Economy.formatMoney(g.money)} 💵`);
          else if (g.capped) details.push(`وصل السقف اليومي 🔒`);
          if (g.xp) details.push(`+${g.xp} XP`);
          if (g.correct) details.push(`${g.correct} بطاقة`);
          if (g.wrong) details.push(`${g.wrong} غلط`);
          details.push(`مستوى ${g.level}${g.levelUp ? ' 🎖️' : ''}`);
          return this.quoteRow(i + 1, g.name, `(${details.join(' • ')})`);
        })
        .join('\n\n')
    );
    if (loserLines.length) {
      lines.push(`━━━━━━━━━━━━━━━━━━━`);
      lines.push(`🎖️ *خبرة الفريق الثاني:*`);
      lines.push(loserLines.join('\n\n'));
    }
    if (gained.every(g => g.money === 0) && gained.some(g => g.capped)) {
      lines.push(`🔒 *السقف اليومي:* ${Economy.formatMoney(Economy.DAILY_MONEY_CAP)} باليوم — ارجع باجر 🌙`);
    }

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
      completedGames: (this.completedGames || []).slice(-100),
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
      poet: Array.from(this.poet.entries()),
      rpsGames: Array.from(this.rpsGames.entries()),
      gqGames: Array.from(this.gqGames.entries()),
      mmGames: Array.from(this.mmGames.entries()),
      song: Array.from(this.song.entries()),
      mathGames: Array.from(this.mathGames.entries()),
      wkGames: Array.from(this.wkGames.entries()),
      mafiaGames: Array.from(this.mafiaGames.entries()),
      oolGames: Array.from(this.oolGames.entries()),
      arenaGames: Array.from(this.arenaGames.entries()),
      tournamentGames: Array.from(this.tournamentGames.entries()).slice(-200),
      pendingClosestNum: Array.from(this.pendingClosestNum.entries()),
      whispers: Array.from(this.whispers.entries()).slice(-300),
      pendingWhispers: Array.from(this.pendingWhispers.entries()),
      pendingSocialDl: Array.from(this.pendingSocialDl.entries()),
      rouletteSessions: Array.from(this.rouletteSessions.entries()).slice(-200),
      privateRouletteLists: Array.from(this.privateRouletteLists.entries()).slice(-200),
      pendingRouletteText: Array.from(this.pendingRouletteText.values()),
      pendingAgeCalc: Array.from(this.pendingAgeCalc.values()),
      pendingConvert: Array.from(this.pendingConvert.entries()),
      audioEditDrafts: Array.from(this.audioEditDrafts.entries()),
      avatarDeliveredV2: this.avatarDeliveredV2,
      pendingVocalSep: Array.from(this.pendingVocalSep.values()),
      songSearches: Array.from(this.songSearches.entries()).slice(-200),
      commandsSyncVer: this.commandsSyncVer,
      pendingChannelGame: Array.from(this.pendingChannelGame.entries())
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
    if (Array.isArray(state.rpsGames)) this.rpsGames = new Map(state.rpsGames);
    if (Array.isArray(state.gqGames)) this.gqGames = new Map(state.gqGames);
    if (Array.isArray(state.mmGames)) this.mmGames = new Map(state.mmGames);
    if (Array.isArray(state.song)) this.song = new Map(state.song);
    if (Array.isArray(state.mathGames)) this.mathGames = new Map(state.mathGames);
    if (Array.isArray(state.wkGames)) this.wkGames = new Map(state.wkGames);
    if (Array.isArray(state.mafiaGames)) this.mafiaGames = new Map(state.mafiaGames);
    if (Array.isArray(state.oolGames)) this.oolGames = new Map(state.oolGames);
    if (Array.isArray(state.arenaGames)) this.arenaGames = new Map(state.arenaGames);
    if (Array.isArray(state.tournamentGames)) this.tournamentGames = new Map(state.tournamentGames);
    if (Array.isArray(state.pendingClosestNum)) this.pendingClosestNum = new Map(state.pendingClosestNum);
    if (Array.isArray(state.whispers)) this.whispers = new Map(state.whispers);
    if (Array.isArray(state.pendingWhispers)) this.pendingWhispers = new Map(state.pendingWhispers);
    if (Array.isArray(state.pendingSocialDl)) this.pendingSocialDl = new Map(state.pendingSocialDl);
    if (Array.isArray(state.rouletteSessions)) this.rouletteSessions = new Map(state.rouletteSessions);
    if (Array.isArray(state.privateRouletteLists)) this.privateRouletteLists = new Map(state.privateRouletteLists);
    if (Array.isArray(state.pendingRouletteText)) this.pendingRouletteText = new Set(state.pendingRouletteText);
    if (Array.isArray(state.pendingAgeCalc)) this.pendingAgeCalc = new Set(state.pendingAgeCalc);
    if (Array.isArray(state.pendingConvert)) this.pendingConvert = new Map(state.pendingConvert);
    if (Array.isArray(state.audioEditDrafts)) this.audioEditDrafts = new Map(state.audioEditDrafts);
    if (typeof state.avatarDeliveredV2 === 'boolean') this.avatarDeliveredV2 = state.avatarDeliveredV2;
    if (Array.isArray(state.pendingVocalSep)) this.pendingVocalSep = new Set(state.pendingVocalSep);
    if (Array.isArray(state.songSearches)) this.songSearches = new Map(state.songSearches);
    if (typeof state.commandsSyncVer === 'number') this.commandsSyncVer = state.commandsSyncVer;
    if (Array.isArray(state.pendingChannelGame)) this.pendingChannelGame = new Map(state.pendingChannelGame);
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

    await this.syncBotCommands();
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
        await this.syncBotCommands();
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
  public async syncBotCommands(): Promise<void> {
    if (!this.token) return;
    const api = (method: string, body?: any) =>
      fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      }).catch(() => null);

    const scopes = [
      { type: 'default' },
      { type: 'all_private_chats' },
      { type: 'all_group_chats' },
      { type: 'all_chat_administrators' }
    ];
    for (const scope of scopes) {
      for (const language_code of [undefined, 'ar', 'en']) {
        await api('deleteMyCommands', language_code ? { scope, language_code } : { scope });
      }
    }
    const onlyStart = [{ command: 'start', description: 'تشغيل البوت والقائمة الرئيسية' }];
    for (const scope of [{ type: 'default' }, { type: 'all_private_chats' }]) {
      for (const language_code of [undefined, 'ar', 'en']) {
        await api(
          'setMyCommands',
          language_code ? { commands: onlyStart, scope, language_code } : { commands: onlyStart, scope }
        );
      }
    }
    await api('setChatMenuButton', { menu_button: { type: 'commands' } });
    this.commandsSyncVer = 3;
  }

  public async applyAndDeliverOfficialAvatar(force = false): Promise<{ applied: boolean; sent: boolean }> {
    if (!this.token) return { applied: false, sent: false };
    if (this.avatarDeliveredV2 && !force) return { applied: true, sent: false };
    this.avatarDeliveredV2 = true;

    let applied = false;
    let sent = false;
    try {
      const jpgBin = Uint8Array.from(atob(BOT_AVATAR_JPG_BASE64), c => c.charCodeAt(0));
      const pngBin = Uint8Array.from(atob(BOT_AVATAR_PNG_BASE64), c => c.charCodeAt(0));

      // 1) محاولة تعيين الصورة الشخصية للبوت مباشرة عبر واجهة تيليجرام الرسمية setMyProfilePhoto (Bot API 9.4+)
      try {
        const avatarForm = new FormData();
        avatarForm.append('photo', JSON.stringify({ type: 'static', photo: 'attach://avatar_file' }));
        avatarForm.append(
          'avatar_file',
          new Blob([jpgBin as unknown as ArrayBuffer], { type: 'image/jpeg' }),
          'code-games-avatar.jpg'
        );
        const setRes = await fetch(`https://api.telegram.org/bot${this.token}/setMyProfilePhoto`, {
          method: 'POST',
          body: avatarForm
        });
        const setJson: any = await setRes.json().catch(() => null);
        applied = Boolean(setJson?.ok);
      } catch {
        applied = false;
      }

      // 2) إرسال النسخة المربعة المضبوطة 1024×1024 مباشرة لمحادثة المالك بالخاص (صورة + ملف PNG أصلي كامل الدقة قابل للحفظ بنقرة واحدة)
      if (this.ownerId) {
        const pId = await this.sendBinaryMultipart(
          this.ownerId,
          'sendPhoto',
          'photo',
          jpgBin,
          'Code-Games-1024x1024.jpg',
          'image/jpeg',
          {
            caption: applied
              ? '🖼️ تم تثبيت لوغو البوت المربع (1024×1024) على حساب البوت مباشرة، وهذه النسخة جاهزة للحفظ بجهازك ✅'
              : '🖼️ لوغو البوت الأبيض ذو البطاقتين بمقاس مربع مضبوط 1024×1024 جاهز للحفظ بجهازك ✅'
          }
        );
        const dId = await this.sendBinaryMultipart(
          this.ownerId,
          'sendDocument',
          'document',
          pngBin,
          'Code-Games-Logo-1024x1024.png',
          'image/png',
          { caption: '📎 النسخة الأصلية بدون ضغط (PNG — 1024×1024)' }
        );
        sent = Boolean(pId || dId);
      }
    } catch {
      // ignore
    }
    return { applied, sent };
  }

  private async ensureCommandsSynced(): Promise<void> {
    if (!this.token) return;
    if (!this.avatarDeliveredV2) {
      await this.applyAndDeliverOfficialAvatar(false);
    }
    if (this.commandsSyncVer === 3) return;
    await this.syncBotCommands();
  }

  public async handleUpdate(update: TelegramUpdate) {
    try {
      const uidNum = Number((update as any)?.update_id);
      if (Number.isFinite(uidNum)) {
        if (this.seenUpdateIds.has(uidNum)) {
          return;
        }
        this.seenUpdateIds.add(uidNum);
        if (this.seenUpdateIds.size > 1500) {
          const oldest = this.seenUpdateIds.values().next().value;
          if (oldest !== undefined) this.seenUpdateIds.delete(oldest);
        }
      }
      await this.ensureCommandsSynced();
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
      } else if (update.inline_query) {
        await this.handleInlineQuery(update.inline_query);
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

    // بطاقة «العب بالقناة» نزلت هنا عبر الإنلاين؟ نشوف ونحوّلها للوبي فوراً
    if (message.via_bot && message.chat.type !== 'private') {
      await this.handleInlineLanding(message);
      return;
    }

    // 🔄 استقبال الوسائط والملفات المرسلة بالخاص لخدمة «تحويل الصيغ» أو «عزل الموسيقى»
    if (message.chat.type === 'private' && sender) {
      const mUid = String(sender.id);
      const hasMedia = Boolean(
        message.video ||
          message.audio ||
          message.voice ||
          message.photo ||
          message.sticker ||
          message.animation ||
          message.document
      );
      const editDraft = this.audioEditDrafts.get(mUid);
      if (hasMedia && editDraft?.waitingField === 'cover') {
        const coverFid =
          message.photo?.[message.photo.length - 1]?.file_id ||
          (String(message.document?.mime_type || '').startsWith('image/')
            ? message.document.file_id
            : '');
        if (coverFid) {
          editDraft.coverFileId = coverFid;
          editDraft.waitingField = undefined;
          this.audioEditDrafts.set(mUid, editDraft);
          this.trackMediaMsg(mUid, message.message_id);
          await this.sendAudioMetadataEditorCard(mUid);
          return;
        }
      }
      if (hasMedia && this.pendingVocalSep.has(mUid)) {
        await this.handleVocalSeparationMediaInput(mUid, message);
        return;
      }
      if (hasMedia && this.pendingConvert.has(mUid)) {
        await this.handleFormatConvertMediaInput(mUid, message);
        return;
      }
    }

    if (!text) {
      // صور / ملصقات / صوتيات — توصل لصاحب البوت هم، وما يجي العضو أي رد.
      if (message.chat.type === 'private' && sender && !this.isOwner(sender.id)) {
        await this.forwardToOwnerInbox(message, sender);
      }
      return;
    }

    // 🎵 أمر البحث عن الأغاني «يوت <اسم الأغنية>» (يشتغل بالخاص والكروبات والقنوات!)
    const youtMatch = text.match(/^(?:\/?(?:يوت|yout))(?:\s+|:)(.+)$/i);
    if (youtMatch && youtMatch[1].trim()) {
      await this.handleYoutSongSearch(chatId, youtMatch[1].trim(), message.message_id);
      return;
    }

    // 🤫 إكمال خطوات الخدمات الإضافية بالخاص
    if (message.chat.type === 'private' && sender && !text.startsWith('/') && text !== '🎮 الألعاب' && text !== '👑 لوحة التحكم') {
      const uid = String(sender.id);
      const activeAudioDraft = this.audioEditDrafts.get(uid);
      if (activeAudioDraft?.waitingField && activeAudioDraft.waitingField !== 'cover') {
        const cleanedVal = text.trim();
        if (activeAudioDraft.waitingField === 'title') activeAudioDraft.title = cleanedVal;
        else if (activeAudioDraft.waitingField === 'artist') activeAudioDraft.artist = cleanedVal;
        else if (activeAudioDraft.waitingField === 'fileName') {
          activeAudioDraft.fileName = cleanedVal.replace(/[\\/:*?"<>|]/g, '').trim() || 'audio';
        }
        activeAudioDraft.waitingField = undefined;
        this.audioEditDrafts.set(uid, activeAudioDraft);
        this.trackMediaMsg(uid, message.message_id);
        await this.sendAudioMetadataEditorCard(uid);
        return;
      }
      if (this.pendingWhispers.has(uid)) {
        await this.handleWhisperTextStep(uid, sender, text);
        return;
      }
      if (this.pendingSocialDl.has(uid)) {
        await this.handleSocialDownloadInput(uid, text, message.message_id);
        return;
      }
      if (this.pendingAgeCalc.has(uid)) {
        await this.handleAgeCalcTextInput(uid, text);
        return;
      }
      if (this.pendingRouletteText.has(uid)) {
        await this.handlePrivateRouletteTextInput(uid, text);
        return;
      }
      if (this.pendingVocalSep.has(uid)) {
        await this.handleVocalSeparationTextInput(uid, text, message.message_id);
        return;
      }
      if (this.pendingClosestNum.has(uid)) {
        const targetChat = this.pendingClosestNum.get(uid)!;
        const parsed = parseFloat(
          text.replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/,/g, '')
        );
        if (!Number.isFinite(parsed)) {
          await this.sendMessage(uid, '⚠️ أرسل رقماً صحيحاً فقط (مثال: `1850`).');
          return;
        }
        const ag = this.arenaGames.get(targetChat);
        if (!ag || ag.status !== 'playing') {
          this.pendingClosestNum.delete(uid);
          await this.sendMessage(uid, 'ℹ️ انتهت الجولة الحالية — انتظر السؤال القادم بالقناة!');
          return;
        }
        const sub = ARX.arenaSubmitFreeNumber(ag, uid, parsed);
        this.pendingClosestNum.delete(uid);
        await this.sendMessage(uid, sub.msg);
        if ((ag.status as string) === 'game_over') this.recordArenaFinish(ag);
        await this.paintArena(ag);
        this.scheduleLocalQuizTimer();
        return;
      }
    }

    // 🤝 إذا المستخدم يشارك حالياً بلعبة «منو يعرف الثاني أكثر؟» بالخاص → نثبّت جوابه/تخمينه فوراً
    if (message.chat.type === 'private' && sender && !text.startsWith('/') && text !== '🎮 الألعاب' && text !== '👑 لوحة التحكم') {
      if (!message.reply_to_message && !this.awaitingClueWord.get(String(sender.id))) {
        const handledWK = await this.tryHandleWhoKnowsText(sender, text);
        if (handledWK) return;
      }
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
        if (sender) {
          this.pendingWhispers.delete(String(sender.id));
          this.pendingSocialDl.delete(String(sender.id));
        }
        const rawPayload = (text.split(/\s+/)[1] || '').trim();
        const payload = rawPayload.toLowerCase();
        if (payload === 'spy') {
          await this.handleSpymasterReady(chatId, sender);
          return;
        }
        if (rawPayload.startsWith('wk_')) {
          await this.handleWhoKnowsPrivateReady(chatId, sender, rawPayload.slice(3));
          return;
        }
        if (rawPayload.startsWith('mf_')) {
          await this.handleMafiaPrivateReady(chatId, sender, rawPayload.slice(3));
          return;
        }
        if (rawPayload.startsWith('cnum_')) {
          const targetChat = decodeURIComponent(rawPayload.slice(5));
          const ag = this.arenaGames.get(targetChat);
          if (!ag || ag.mode !== 'closest_num' || ag.status !== 'playing') {
            await this.sendMessage(chatId, 'ℹ️ لا توجد جولة «أقرب رقم» مفتوحة حالياً في القناة.');
            return;
          }
          if (sender) this.pendingClosestNum.set(String(sender.id), targetChat);
          await this.sendMessage(
            chatId,
            `🎯 *تخمينك السري — أقرب رقم*\n━━━━━━━━━━━━━━━━━━━\n❓ *${this.mdSafe(ag.prompt)}*\n\n✍️ أرسل الرقم الذي تتوقعه الآن بالأرقام فقط:`
          );
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
    // 🧭 المحادثة: من الرسالة، أو من مختوم الزر (رسائل الإنلاين ما توصل معها محادثة)
    let chatId = String(cb.message?.chat.id || '');
    if (!chatId) {
      const tail = data.split(':').slice(-1)[0] || '';
      if (/^-?\d{4,}$/.test(tail)) chatId = tail;
    }
    if (!chatId) chatId = String(cb.from.id);
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

      if (data === 'admin:avatar') {
        await this.answerCallbackQuery(cb.id, '🖼️ جاري تثبيت وإرسال لوغو البوت المربع...');
        const res = await this.applyAndDeliverOfficialAvatar(true);
        if (!res.sent) {
          await this.sendMessage(chatId, '✅ تم تنفيذ تثبيت لوغو البوت المربع (1024×1024).');
        }
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

    // ---- 🎰 سحب الروليت بالقنوات والكروبات ----
    if (data.startsWith('rlt:')) {
      await this.handleRouletteChannelCb(cb, data);
      return;
    }

    // ---- ✨ الخدمات الإضافية ----
    if (
      data.startsWith('svc:') ||
      data.startsWith('wh:') ||
      data.startsWith('dl:') ||
      data.startsWith('ytq:') ||
      data.startsWith('yts:') ||
      data.startsWith('rltl:') ||
      data.startsWith('conv:')
    ) {
      await this.handleExtraServicesCb(cb, data);
      return;
    }

    // ---- 🎮 قائمة الألعاب ----
    if (data.startsWith('hub:')) {
      await this.handleGamesMenu(cb, data.slice(4));
      return;
    }
    if (data.startsWith('po:')) {
      await this.handlePoetKey(cb, data.slice(3));
      return;
    }

    // ---- ✊✋✌️ حجرة ورقة مقص ----
    if (data.startsWith('rpsb:')) {
      await this.handleRPSBoard(cb, data.slice(5));
      return;
    }
    if (data.startsWith('rpsm:')) {
      await this.handleRPSMove(cb, data.slice(5));
      return;
    }

    // ---- 🎉 ألعاب الجماعة بالقنوات (أسئلة) ----
    if (data.startsWith('gq')) {
      await this.handleGroupQuizCb(cb, data);
      return;
    }

    // ---- 🏆 نظام البطولات والدوريات الإقصائية (8 / 16 / 32) ----
    if (data.startsWith('trn:')) {
      await this.handleTournamentCallback(cb, data);
      return;
    }

    // ---- 🏟️ الألعاب التفاعلية الـ 25 الجديدة ----
    if (data.startsWith('arx:')) {
      await this.handleArenaCb(cb, data);
      return;
    }

    // ---- 🎵 خمّن الأغنية ----
    if (data.startsWith('sg:')) {
      await this.handleSongKey(cb, data.slice(3));
      return;
    }
    // ---- 🔢 تحدي الحساب ----
    if (data.startsWith('ma:')) {
      await this.handleMathKey(cb, data.slice(3));
      return;
    }
    // ---- 🤝 منو يعرف الثاني أكثر؟ ----
    if (data.startsWith('wk')) {
      await this.handleWhoKnowsCb(cb, data);
      return;
    }
    // ---- 🕵️ المافيا ----
    if (data.startsWith('mf:') || data.startsWith('mfn:')) {
      await this.handleMafiaCb(cb, data);
      return;
    }
    // ---- 🎭 منو برا السالفة؟ ----
    if (data.startsWith('ool:')) {
      await this.handleOOLCb(cb, data);
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

    // أول دوسة على لوحة إنلاين؟ نربطها بمعرّفها حتى كل تعديل جاي يطل عليها بالضبط
    if (cb.inline_message_id && game && !(game as any).inlineMessageId) {
      (game as any).inlineMessageId = cb.inline_message_id;
      this.games.set(chatId, game);
    }

    // 🛡️ لوحة كود نيمز ضايعة (نظام نام أو لوحة قديمة)؟ نعيد بناء اللوبي بنفس الرسالة
    // بدل ما يوكل اللاعب «لا توجد لعبة» — ودوسة المقعد تكمل طبيعي عاللوبي الجديد.
    if (!game && data.startsWith('join:')) {
      const rebuilt = CodenamesEngine.createLobby(
        chatId,
        cb.message?.chat.title || 'المحادثة',
        'arabic_standard',
        this.customWords,
        String(cb.from.id)
      );
      if (cb.message?.message_id) rebuilt.messageId = cb.message.message_id;
      if (cb.inline_message_id) (rebuilt as any).inlineMessageId = cb.inline_message_id;
      this.games.set(chatId, rebuilt);
      game = rebuilt;
    }

    // If no game in this chat, notify (game:new can create one from scratch)
    if (!game && !data.startsWith('action:secret_map') && !data.startsWith('game:new')) {
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
    if ((data === 'game:start' || data.startsWith('game:start:')) && game) {
      const fullLobby = this.lobbyIsFull(game);
      const isJoinedPlayer = game.players.some(p => String(p.id) === String(userId));
      let allowedStarter =
        !game.createdBy ||
        String(game.createdBy) === String(userId) ||
        this.isOwner(userId) ||
        (fullLobby && isJoinedPlayer);
      if (!allowedStarter) {
        const admins = await this.getChatAdministrators(chatId);
        if (admins.some(a => String(a?.user?.id || '') === String(userId))) {
          allowedStarter = true;
        }
      }
      if (!allowedStarter) {
        await this.answerCallbackQuery(cb.id, '⚠️ المشرف أو أحد اللاعبين بعد اكتمال العدد يقدر يبدأ اللعبة.', true);
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
    if (data === 'game:new' || data.startsWith('game:new:')) {
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
    if (data === 'action:secret_map' || data.startsWith('action:secret_map:')) {
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
    if (data === 'game:show_all' || data.startsWith('game:show_all:')) {
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
        await this.sendMessage(
          chatId,
          GG.toV2(await this.withBotFooter(rewards, true)),
          undefined,
          'MarkdownV2'
        );
      }

      // If the turn moved to the other team's spymaster, prompt them privately
      if (result.game.status === 'spymaster_turn') {
        await this.promptSpymasterForClue(result.game);
      }
      return;
    }

    // 7. Pass turn
    if ((data === 'action:pass' || data.startsWith('action:pass:')) && game) {
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
    createdBy?: number | string,
    forcedGameId?: string,
    rounds?: number
  ): Promise<{ messageId: number | null; error?: string }> {
    // ── ✊✋✌️ حجرة ورقة مقص ──
    if (forcedGameId === 'rps') {
      const game = RPS.createGame(chatId, chatTitle, rounds ?? 5, String(createdBy ?? ''));
      this.rpsGames.set(chatId, game);
      const text = await this.withBotFooter(RPS.renderGame(game), true);
      const keyboard = RPS.boardKeyboard(game);

      const sent = await this.sendMessage(chatId, text, keyboard, 'MarkdownV2');
      const msgId = sent?.result?.message_id;
      if (msgId) {
        game.messageId = msgId;
        this.rpsGames.set(chatId, game);
        return { messageId: msgId };
      }
      const reason = sent?.description || 'ما وصل رد من تلجرام';
      console.error('startRPSLobby failed for', chatId, reason);
      return { messageId: null, error: reason };
    }

    const existing = this.games.get(chatId);
    const game = CodenamesEngine.createLobby(
      chatId,
      chatTitle,
      existing?.wordPack || 'arabic_standard',
      this.customWords,
      createdBy ?? existing?.createdBy
    );
    this.games.set(chatId, game);

    const text = GG.toV2(await this.withBotFooter(CodenamesEngine.getTelegramMessageText(game), true));
    const keyboard = await this.buildKeyboard(game);

    const sent = await this.sendMessage(chatId, text, keyboard, 'MarkdownV2');
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

  /** Caption attribution for sent songs, rendered by Telegram as a quote. */
  private async getSongBotQuote(): Promise<{ caption: string; caption_entities: Array<{ type: 'blockquote'; offset: number; length: number }> } | null> {
    const username = await this.getBotUsername();
    if (!username) return null;
    const caption = `@${username}`;
    return {
      caption,
      caption_entities: [{ type: 'blockquote', offset: 0, length: caption.length }]
    };
  }

  /**
   * Every game message ends with the bot's username, so anyone who still has
   * not started the bot can tap it and press Start (and save it if he wants).
   */
  private async withBotFooter(text: string, v2: boolean = false): Promise<string> {
    const botUser = await this.getBotUsername();
    if (!botUser) return text;
    // بصيغة MarkdownV2 (لوحات الألعاب الجماعية) لازم نهرّب الشرطة السفلية باليوزرنيم
    const shown = v2 ? botUser.replace(/_/g, '\\_') : botUser;
    return text + `\n━━━━━━━━━━━━━━━━━━━\n` + `🤖 *البوت:* @${shown}`;
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

    await this.sendMessage(chatId, lines.join('\n'));

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

    // حجرة ورقة مقص: اختار عدد الروندات → يحذف الرسالة ويطلع اختيار القناة
    if (section.startsWith('rpschan:')) {
      const r = parseInt(section.split(':')[1] || '5', 10);
      const rounds = [5, 10, 15].includes(r) ? r : 5;
      await this.answerCallbackQuery(cb.id);
      if (this.pendingChannelGame) {
        this.pendingChannelGame.set(String(cb.from.id), { gameId: 'rps', rounds, at: Date.now() });
      }
      if (messageId) {
        await this.deleteMessage(chatId, messageId);
      }
      await this.sendChannelKeyboard(chatId);
      return;
    }

    // ─────────────── 📢 نشر الألعاب على القنوات ───────────────

    // زر «🎮 العب بالقناة» من صفحة اللعبة (يشتغل لكل لعبة)
    if (section.startsWith('chpick:')) {
      const gameId = section.slice(7);
      const game = findBotGame(gameId);
      if (!game) {
        await this.answerCallbackQuery(cb.id, '⚠️ اللعبة غير معروفة.', true);
        return;
      }

      // ألعاب الخاص تنلعب هنا مع البوت بس — ما تننشر بقناة
      if (!game.channel) {
        await this.renderPrivateOnly(cb, game);
        return;
      }

      // حجرة ورقة مقص: أول نختار كم راوند، وبعدين منتقي القنوات
      if (gameId === 'rps') {
        await this.renderRoundsPicker(cb, game);
        return;
      }

      // الألعاب الثانية: نفتح منتقي تليجرام الرسمي (شكل «تحويل رسالة») مباشرة
      await this.answerCallbackQuery(cb.id);
      await this.sendChannelKeyboard(chatId);
      return;
    }

    // بعد اختيار الروندات (حجرة ورقة) → منتقي تليجرام الرسمي
    if (section.startsWith('chshare:')) {
      const parts = section.slice(8).split(':');
      const gameId = parts[0];
      const rounds = parseInt(parts[1] || '0', 10) || undefined;
      this.pendingChannelGame.set(String(cb.from.id), { gameId, rounds, at: Date.now() });
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
  // 📢 القنوات: نشر الألعاب عناوينها (من صفحة اللعبة)
  // ---------------------------------------------------------------------

  /** يعدّل رسالة القائمة الحالية — ولو ما كدر يرسل رسالة جديدة */
  private async paintMenuView(cb: TelegramCallbackQuery, view: { text: string; keyboard: any[][] }) {
    const chatId = String(cb.message?.chat.id || cb.from.id);
    const messageId = cb.message?.message_id;
    if (messageId) {
      const res = await this.editMessageText(chatId, messageId, view.text, view.keyboard);
      if (res?.ok || String(res?.description || '').includes('not modified')) {
        await this.answerCallbackQuery(cb.id, '');
        return;
      }
    }
    await this.sendMessage(chatId, view.text, view.keyboard);
    await this.answerCallbackQuery(cb.id, '');
  }

  /** حجرة ورقة مقص: شاشة اختيار الروندات قبل منتقي القنوات */
  private async renderRoundsPicker(cb: TelegramCallbackQuery, game: BotGameCard) {
    await this.paintMenuView(cb, {
      text:
        `${game.emoji} *${game.title}*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🎯 اختار كم راوند تلعبون بالقناة:`,
      keyboard: [
        [{ text: '🎮 بالقناة — 5 راوندات', switch_inline_query: 'rps 5' }],
        [{ text: '🎮 بالقناة — 10 راوندات', switch_inline_query: 'rps 10' }],
        [{ text: '🎮 بالقناة — 15 راوندات', switch_inline_query: 'rps 15' }],
        [{ text: '🔙 رجوع', callback_data: 'hub:g:rps' }]
      ]
    });
  }

  /** ألعاب الخاص: تشتغل مع البوت — نعلم المستخدم ونعطيه زر البدء */
  private async renderPrivateOnly(cb: TelegramCallbackQuery, game: BotGameCard) {
    const keyboard: any[][] = [];
    if (game.play) {
      keyboard.push([{ text: game.play.label, callback_data: game.play.data }]);
    }
    keyboard.push([{ text: '🔙 رجوع', callback_data: `hub:g:${game.id}` }]);
    await this.paintMenuView(cb, {
      text:
        `${game.emoji} *${game.title}*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `💬 هاللعبة *خاصة*: تنلعبها هنا مع البوت — ما تننشر بقناة.\n\n` +
        `👇 اضغط زر اللعب حتى تبدأ هسه:`,
      keyboard
    });
  }

  /**
   * نشر لعبة (كود نيمز / حجرة ورقة) على قناة:
   * ينضّف لوحاتها القديمة، يرسل اللوحة الجديدة، ويرجّع رسالة نجاح/فشل للمستخدم.
   */
  private async deployGameToChannel(
    channelId: string,
    title: string,
    byUser?: string | number,
    gameId?: string,
    rounds?: number
  ): Promise<{ ok: boolean; text: string }> {
    // نبقي اللوحات السابقة موجودة بالقناة وما نحذفها أبداً — نبدأ لعبة جديدة بأسفلها فقط
    if (gameId === 'rps') {
      this.rpsGames.delete(channelId);
    } else {
      const existing = this.games.get(channelId);
      if (existing && existing.status === 'lobby') {
        this.games.delete(channelId);
      }
    }

    let result = await this.startNewGameLobby(channelId, title, byUser, gameId, rounds);
    // تليجرام أحياناً يحتاج محاولة ثانية مباشرة بعد ما ينضاف البوت للقناة
    if (!result.messageId) {
      result = await this.startNewGameLobby(channelId, title, byUser, gameId, rounds);
    }

    if (result.messageId) {
      const text =
        gameId === 'rps'
          ? `✅ نزّلت *حجرة ورقة مقص* بقناتك «${this.mdSafe(title)}».\n` +
            `روح للقناة — اللاعبين يضغطون (انضم) وبعدها تضغط (🚀 ابدأ).`
          : `✅ نزّلت *كود نيمز* بقناتك «${this.mdSafe(title)}».\n` +
            `روح للقناة — الأعضاء ينضمون للفرق 🔵🔴 وإنت المشرف تضغط (ابدأ اللعبة 🚀).`;
      return { ok: true, text };
    }
    return {
      ok: false,
      text:
        `⚠️ ما گدرت أنزل اللعبة بقناة «${this.mdSafe(title)}».\n` +
        `*السبب:* ${this.mdSafe(String(result.error || 'غير معروف'))}\n\n` +
        `تأكد إن البوت *مشرف (Admin)* بالقناة وبعدين جرّب مرة ثانية.`
    };
  }

  // ---------------------------------------------------------------------
  // 🚀 «العب بالقناة» عبر الإنلاين: ضغطة وحدة → منتقي التحويل الرسمي →
  // الرسالة تنزل بالقناة وتحوّل نفسها للوبي تلقائياً (بلا رسايل ولا بوكس)
  // ---------------------------------------------------------------------

  /** بطاقة النشر لكل لعبة (العنوان والوصف والنص اللي ينزل بالقناة لحظة الإرسال) */
  private inlineDeployCard(
    gameId: string,
    rounds?: number,
    deployerId?: string
  ): { title: string; desc: string; text: string; keyboard: any[][] } {
    const SEP = '━━━━━━━━━━━━━━━━━━━';
    const uid = deployerId ? `|${deployerId}` : '';
    if (gameId === 'rps') {
      const r = rounds || 5;
      const hidden = encodeHiddenTag(`rps:${r}${uid}`);
      return {
        title: `✊✋✌️ حجرة ورقة مقص (${r} راوندات)`,
        desc: 'اضغط لإرسال اللعبة مباشرة للقناة',
        text: `✊✋✌️ *حجرة ورقة مقص* (${r} راوندات)${hidden}\n${SEP}\n👥 *اللاعبون:* بانتظار الانضمام`,
        keyboard: [[{ text: 'انضم', callback_data: 'rpsb:join' }]]
      };
    }
    const hidden = encodeHiddenTag(`cn${uid}`);
    return {
      title: '🎮 كود نيمز (2 ضد 2)',
      desc: 'اضغط لإرسال اللعبة مباشرة للقناة',
      text:
        `🕵️‍♂️ *لعبة كود نيمز (Codenames)* 🕵️‍♀️${hidden}\n` +
        `${SEP}\n` +
        `👥 *المنضمون:* بانتظار اختيار الفرق`,
      keyboard: [
        [{ text: 'انضم', callback_data: 'join:auto:auto' }],
        [
          { text: '⬜ عميل أزرق 🔵', callback_data: 'join:blue:operative' },
          { text: '⬜ عميل أحمر 🔴', callback_data: 'join:red:operative' }
        ],
        [
          { text: '⬜ جاسوس أزرق 🕵️', callback_data: 'join:blue:spymaster' },
          { text: '⬜ جاسوس أحمر 🕵️', callback_data: 'join:red:spymaster' }
        ]
      ]
    };
  }

  /** بطاقة بطولة إقصائية (8 / 16 / 32) نظيفة 100٪ بدون أي كود ظاهر */
  private trnCard(rawDiscipline: string, rawCap: string | number, deployerId?: string): any {
    const SEP = '━━━━━━━━━━━━━━━━━━━';
    const uid = deployerId ? `|${deployerId}` : '';
    const discipline: TRN.TournamentDiscipline = TRN.isValidDiscipline(rawDiscipline)
      ? rawDiscipline
      : 'general';
    const capacity = TRN.parseCapacity(rawCap);
    const meta = TRN.getDisciplineMeta(discipline);
    const arCap = String(capacity);
    const hidden = encodeHiddenTag(`trn:${discipline}:${capacity}${uid}`);
    return {
      type: 'article',
      id: `trn:${discipline}:${capacity}`,
      title: `🏆 دوري الـ ${arCap} لاعباً — ${meta.emoji} ${meta.title}`,
      description: `اضغط لإرسال البطولة الإقصائية (خروج المغلوب حتى يتوَّج فائز واحد فقط)`,
      input_message_content: {
        message_text:
          `🏆 *بطولة إقصائية — ${meta.emoji} ${meta.title}*${hidden}\n` +
          `${SEP}\n` +
          `🏟️ فئة البطولة: *دوري الـ ${arCap} لاعباً* (خروج المغلوب)\n` +
          `👥 *المسجلون:* بانتظار انضمام اللاعبين`,
        parse_mode: 'Markdown'
      },
      reply_markup: {
        inline_keyboard: [
          [{ text: `🙋 انضمام للبطولة (0/${capacity})`, callback_data: `trn:auto:${discipline}:${capacity}` }]
        ]
      }
    };
  }

  /** بطاقة لعبة جماعية نظيفة 100٪ بدون أي كود ظاهر أو نص تحضير */
  private gqCard(kind: string, deployerId?: string): any {
    const SEP = '━━━━━━━━━━━━━━━━━━━';
    const uid = deployerId ? `|${deployerId}` : '';
    const k: GG.QuizKind = (Object.keys(GG.QUIZ_KINDS) as GG.QuizKind[]).includes(kind as GG.QuizKind)
      ? (kind as GG.QuizKind)
      : 'speed';
    const meta = GG.QUIZ_KINDS[k];
    const title = `${meta.emoji} ${meta.title}`;
    const hidden = encodeHiddenTag(`gq:${k}${uid}`);
    return {
      type: 'article',
      id: `gq:${k}`,
      title,
      description: 'اضغط لإرسال اللعبة مباشرة للقناة',
      input_message_content: {
        message_text: `${meta.emoji} *${meta.title}*${hidden}\n${SEP}\n👥 *المنضمون:* بانتظار اللاعبين`,
        parse_mode: 'Markdown'
      },
      reply_markup: {
        inline_keyboard: [[{ text: 'انضم', callback_data: 'gqj:auto' }]]
      }
    };
  }

  /** بطاقة ماسترمايند نظيفة بدون أي كود ظاهر */
  private gqCardMM(deployerId?: string): any {
    const SEP = '━━━━━━━━━━━━━━━━━━━';
    const uid = deployerId ? `|${deployerId}` : '';
    const hidden = encodeHiddenTag(`gq:mm${uid}`);
    return {
      type: 'article',
      id: 'gq:mm',
      title: '🔐 ماسترمايند — كسر الرقم السري',
      description: 'اضغط لإرسال اللعبة مباشرة للقناة',
      input_message_content: {
        message_text: `🔐 *ماسترمايند*${hidden}\n${SEP}\n👥 *المنضمون:* بانتظار اللاعبين`,
        parse_mode: 'Markdown'
      },
      reply_markup: {
        inline_keyboard: [[{ text: 'انضم', callback_data: 'mmj:auto' }]]
      }
    };
  }

  /** المستخدم اختار لعبة لتحويلها للقناة — البطاقة تنزل نظيفة وجاهزة من أول لحظة بدون أي كود ظاهر */
  private async handleInlineQuery(iq: TelegramInlineQuery) {
    const q = (iq.query || '').trim().toLowerCase();
    const SEP = '━━━━━━━━━━━━━━━━━━━';
    if (iq.from && !iq.from.is_bot) {
      this.trackUser(iq.from, false);
      this.lastInlineDeployer = { id: String(iq.from.id), at: Date.now() };
    }
    const deployerId = iq.from?.id ? String(iq.from.id) : '';
    const uid = deployerId ? `|${deployerId}` : '';

    // ── 🤫 همسة سرية ──
    if (q.startsWith('wh:')) {
      const whId = q.slice(3).trim();
      const wh = this.whispers.get(whId);
      if (wh) {
        await this.answerInlineQuery(iq.id, [
          {
            type: 'article',
            id: `wh:${wh.id}`,
            title: `🤫 إرسال همستك (${MS.whisperModeLabel(wh.mode)})`,
            description: `اضغط لإرسال الهمسة الآن: «${wh.text.slice(0, 45)}${wh.text.length > 45 ? '…' : ''}»`,
            input_message_content: {
              message_text: MS.renderWhisperCardText(wh),
              parse_mode: 'MarkdownV2'
            },
            reply_markup: {
              inline_keyboard: MS.whisperCardKeyboard(wh)
            }
          }
        ]);
        return;
      }
    }

    // ── 🕵️ المافيا ──
    if (q === 'mf' || q.includes('مافيا')) {
      const hidden = encodeHiddenTag(`mf${uid}`);
      await this.answerInlineQuery(iq.id, [
        {
          type: 'article',
          id: 'mf',
          title: '🕵️ لعبة المافيا',
          description: 'اضغط لإرسال لعبة المافيا مباشرة للقناة (4 – 12 لاعباً)',
          input_message_content: {
            message_text: `🕵️ *لعبة المافيا*${hidden}\n${SEP}\n👥 *المنضمون:* بانتظار اللاعبين`,
            parse_mode: 'Markdown'
          },
          reply_markup: {
            inline_keyboard: [[{ text: 'انضم', callback_data: 'mf:j:auto' }]]
          }
        }
      ]);
      return;
    }

    // ── 🎭 منو برا السالفة؟ ──
    if (q === 'ool' || q.includes('السالفة') || q.includes('السالفه')) {
      const hidden = encodeHiddenTag(`ool${uid}`);
      await this.answerInlineQuery(iq.id, [
        {
          type: 'article',
          id: 'ool',
          title: '🎭 منو برا السالفة؟',
          description: 'اضغط لإرسال اللعبة مباشرة للقناة (3 – 10 لاعبين)',
          input_message_content: {
            message_text: `🎭 *منو برا السالفة؟*${hidden}\n${SEP}\n👥 *المنضمون:* بانتظار اللاعبين`,
            parse_mode: 'Markdown'
          },
          reply_markup: {
            inline_keyboard: [[{ text: 'انضم', callback_data: 'ool:j:auto' }]]
          }
        }
      ]);
      return;
    }

    // ── 🤝 منو يعرف الثاني أكثر؟ ──
    if (q === 'wk' || q.includes('يعرف')) {
      const hidden = encodeHiddenTag(`wk${uid}`);
      await this.answerInlineQuery(iq.id, [
        {
          type: 'article',
          id: 'wk',
          title: '🤝 منو يعرف الثاني أكثر؟',
          description: 'تحدي شخصين — اضغط لإرسال اللعبة مباشرة للقناة',
          input_message_content: {
            message_text: `🤝 *منو يعرف الثاني أكثر؟*${hidden}\n${SEP}\n👥 *اللاعبون:* بانتظار الانضمام`,
            parse_mode: 'Markdown'
          },
          reply_markup: {
            inline_keyboard: [[{ text: 'انضم', callback_data: 'wkj:auto' }]]
          }
        }
      ]);
      return;
    }

    // ── 🏟️ الألعاب التفاعلية الـ 25 الجديدة (arx <shortCode>) ──
    if (q.startsWith('arx ') || q.startsWith('arx:')) {
      const code = q.slice(4).trim();
      const mode = ARX.findArenaModeByShort(code);
      if (mode) {
        const meta = ARX.ARENA_MODES[mode];
        const hidden = encodeHiddenTag(`arx:${mode}${uid}`);
        const initKb = meta.teamSize
          ? [
              [
                { text: '🔵 انضم للأزرق', callback_data: `arx:jb:${mode}:auto` },
                { text: '🔴 انضم للأحمر', callback_data: `arx:jr:${mode}:auto` }
              ]
            ]
          : [[{ text: 'انضم', callback_data: `arx:j:${mode}:auto` }]];
        await this.answerInlineQuery(iq.id, [
          {
            type: 'article',
            id: `arx:${mode}`,
            title: `${meta.emoji} ${meta.title}`,
            description: `اضغط لإرسال اللعبة مباشرة للقناة (${meta.playersLabel})`,
            input_message_content: {
              message_text: `${meta.emoji} *${meta.title}*${hidden}\n${SEP}\n👥 *المنضمون:* بانتظار اللاعبين`,
              parse_mode: 'Markdown'
            },
            reply_markup: { inline_keyboard: initKb }
          }
        ]);
        return;
      }
    }

    // ── 🎰 روليت السحب للقنوات والكروبات والمحادثات ──
    if (q === 'roulette' || q.includes('روليت')) {
      const rltId = Date.now().toString(36).slice(-5) + Math.random().toString(36).substring(2, 5);
      const creatorName = iq.from
        ? `${iq.from.first_name}${iq.from.last_name ? ` ${iq.from.last_name}` : ''}`
        : 'منظّم السحب';
      const sess = EXT.createRouletteSession(rltId, '', deployerId, creatorName);
      this.rouletteSessions.set(rltId, sess);
      const rendered = EXT.renderRouletteChannelView(sess);
      await this.answerInlineQuery(iq.id, [
        {
          type: 'article',
          id: `rlt:${rltId}`,
          title: '🎰 نشر سحب الروليت العشوائي',
          description: 'اضغط لنشر لوحة المشاركة والسحب العشوائي في القناة أو الكروب',
          input_message_content: {
            message_text: rendered.text,
            parse_mode: 'MarkdownV2'
          },
          reply_markup: { inline_keyboard: rendered.keyboard }
        }
      ]);
      return;
    }

    // ── 🏆 نظام البطولات والدوريات الإقصائية (trn <discipline> <8|16|32>) ──
    if (q.startsWith('trn')) {
      const parts = q.replace(/^trn[:\s]*/, '').trim().split(/\s+/).filter(Boolean);
      const disc = parts[0] || 'general';
      const cap = parts[1] || '8';
      await this.answerInlineQuery(iq.id, [this.trnCard(disc, cap, deployerId)]);
      return;
    }

    // ── 🎉 الألعاب الجماعية وألعاب خمّن ──
    if (q.startsWith('gq')) {
      const kind = q.replace(/^gq\s*/, '').trim() || 'speed';
      const card = this.gqCard(kind, deployerId);
      await this.answerInlineQuery(iq.id, [card]);
      return;
    }
    if (q.includes('عام') || q.includes('اسئل') || q.includes('أسئل')) {
      await this.answerInlineQuery(iq.id, [this.gqCard('general', deployerId)]);
      return;
    }
    if (q.includes('جغراف')) {
      await this.answerInlineQuery(iq.id, [this.gqCard('geo', deployerId)]);
      return;
    }
    if (q.includes('تاريخ')) {
      await this.answerInlineQuery(iq.id, [this.gqCard('history', deployerId)]);
      return;
    }

    const wantsCn = q === 'cn' || q === '' || q.includes('كود') || q.includes('codenames');
    const wantsRps = q.startsWith('rps') || q === '' || q.includes('حجرة');

    const results: any[] = [];
    if (wantsCn) {
      const card = this.inlineDeployCard('codenames', undefined, deployerId);
      results.push({
        type: 'article',
        id: 'cn',
        title: card.title,
        description: card.desc,
        input_message_content: { message_text: card.text, parse_mode: 'Markdown' },
        reply_markup: { inline_keyboard: card.keyboard }
      });
    }
    if (wantsRps) {
      const r = parseInt((q.match(/(\d+)/) || [])[1] || '5', 10);
      const rounds = [5, 10, 15].includes(r) ? r : 5;
      const card = this.inlineDeployCard('rps', rounds, deployerId);
      results.push({
        type: 'article',
        id: `rps:${rounds}`,
        title: card.title,
        description: card.desc,
        input_message_content: { message_text: card.text, parse_mode: 'Markdown' },
        reply_markup: { inline_keyboard: card.keyboard }
      });
    }
    if (q === '') {
      const mfHidden = encodeHiddenTag(`mf${uid}`);
      results.push({
        type: 'article',
        id: 'mf',
        title: '🕵️ لعبة المافيا',
        description: 'اضغط لإرسال لعبة المافيا مباشرة للقناة',
        input_message_content: {
          message_text: `🕵️ *لعبة المافيا*${mfHidden}\n${SEP}\n👥 *المنضمون:* بانتظار اللاعبين`,
          parse_mode: 'Markdown'
        },
        reply_markup: { inline_keyboard: [[{ text: 'انضم', callback_data: 'mf:j:auto' }]] }
      });
      const oolHidden = encodeHiddenTag(`ool${uid}`);
      results.push({
        type: 'article',
        id: 'ool',
        title: '🎭 منو برا السالفة؟',
        description: 'اضغط لإرسال اللعبة مباشرة للقناة',
        input_message_content: {
          message_text: `🎭 *منو برا السالفة؟*${oolHidden}\n${SEP}\n👥 *المنضمون:* بانتظار اللاعبين`,
          parse_mode: 'Markdown'
        },
        reply_markup: { inline_keyboard: [[{ text: 'انضم', callback_data: 'ool:j:auto' }]] }
      });
    }
    if (!results.length) {
      const card = this.inlineDeployCard('codenames', undefined, deployerId);
      results.push({
        type: 'article',
        id: 'cn',
        title: card.title,
        description: card.desc,
        input_message_content: { message_text: card.text, parse_mode: 'Markdown' },
        reply_markup: { inline_keyboard: card.keyboard }
      });
    }

    await this.answerInlineQuery(iq.id, results);
  }

  /**
   * لحظة نزول بطاقة الإنلاين بقناة/كروب (via_bot):
   * نقرأ العلامة المخفية غير المرئية (Zero-Width) ونربط اللوحة بالمحادثة فوراً ونجلس الناشر تلقائياً حتى بالقنوات العامة.
   */
  private async handleInlineLanding(message: TelegramMessage) {
    const text = message.text || '';
    const hidden = decodeHiddenTag(text);
    const hiddenTag = hidden?.tag || '';

    const isTrnCard = hiddenTag.startsWith('trn:');

    let gqMark: string[] | null = !isTrnCard && hiddenTag.startsWith('gq:')
      ? [hiddenTag, hiddenTag.slice(3)]
      : !isTrnCard
        ? text.match(/gq:(\w+)/)
        : null;
    if (!isTrnCard && !gqMark) {
      for (const k of Object.keys(GG.QUIZ_KINDS) as GG.QuizKind[]) {
        if (text.includes(GG.QUIZ_KINDS[k].title)) {
          gqMark = [`gq:${k}`, k];
          break;
        }
      }
    }
    let arxMode: ARX.ArenaMode | undefined = !isTrnCard && hiddenTag.startsWith('arx:')
      ? (hiddenTag.slice(4) as ARX.ArenaMode)
      : undefined;
    if (!isTrnCard && !arxMode) {
      for (const m of Object.keys(ARX.ARENA_MODES) as ARX.ArenaMode[]) {
        if (text.includes(ARX.ARENA_MODES[m].title)) {
          arxMode = m;
          break;
        }
      }
    }
    const isMafiaCard = !isTrnCard && (hiddenTag === 'mf' || (text.includes('لعبة المافيا') && text.includes('المنضمون')));
    const isOOLCard = !isTrnCard && (hiddenTag === 'ool' || (text.includes('منو برا السالفة') && text.includes('المنضمون')));
    const isWkCard = !isTrnCard && (hiddenTag === 'wk' || text.includes('wk:start') || (text.includes('منو يعرف الثاني') && (text.includes('تحضير') || text.includes('بانتظار'))));
    const isCodenamesCard = !isTrnCard && (hiddenTag === 'cn' || text.includes('كود نيمز'));
    const isRpsCard = !isTrnCard && (hiddenTag.startsWith('rps:') || text.includes('حجرة ورقة مقص'));

    if (!isTrnCard && !gqMark && !arxMode && !isMafiaCard && !isOOLCard && !isWkCard && !isCodenamesCard && !isRpsCard) return;

    await this.ensureBotInfo();
    const ours =
      String(message.via_bot?.id || '') === String(this.botInfo?.id || '') ||
      String(message.via_bot?.username || '') === String(this.botInfo?.username || '');
    if (!ours) return;

    const chatId = String(message.chat.id);
    const recentDeployer =
      this.lastInlineDeployer && Date.now() - this.lastInlineDeployer.at < 30_000
        ? this.lastInlineDeployer.id
        : '';
    const deployerUserId = message.from?.id ? String(message.from.id) : hidden?.deployerId || recentDeployer;
    const deployerRecord = deployerUserId ? this.users.get(deployerUserId) : undefined;
    const deployerName = message.from?.first_name || deployerRecord?.name || 'الناشر';
    const deployerUsername = message.from?.username || deployerRecord?.username;

    // ── 🏆 البطولات والدوريات الإقصائية ──
    if (isTrnCard) {
      const trnParts = hiddenTag.split(':');
      const rawDisc = trnParts[1] || 'general';
      const rawCap = trnParts[2] || '8';
      const discipline: TRN.TournamentDiscipline = TRN.isValidDiscipline(rawDisc) ? rawDisc : 'general';
      const capacity = TRN.parseCapacity(rawCap);
      const trnId = this.newTournamentId();
      const trnGame = TRN.createTournamentLobby(
        trnId,
        chatId,
        message.chat.title || 'المحادثة',
        discipline,
        capacity
      );
      trnGame.messageId = message.message_id;
      if (deployerUserId) {
        TRN.joinTournament(trnGame, deployerUserId, deployerName);
      }
      this.tournamentGames.set(trnId, trnGame);
      await this.paintTournament(trnGame);
      return;
    }

    // ── 🕵️ المافيا ──
    if (isMafiaCard) {
      const mfGame = MF.createMafiaLobby(chatId, message.chat.title || 'المحادثة', deployerUserId || undefined);
      mfGame.messageId = message.message_id;
      if (deployerUserId) {
        MF.mafiaJoin(mfGame, deployerUserId, deployerName);
      }
      this.mafiaGames.set(chatId, mfGame);
      const botUser = await this.getBotUsername();
      const res = await this.editMessageText(
        chatId,
        message.message_id,
        await this.withBotFooter(MF.renderMafiaBoard(mfGame), true),
        MF.mafiaBoardKeyboard(mfGame, botUser),
        'MarkdownV2'
      );
      if (!res?.ok) this.mafiaGames.delete(chatId);
      return;
    }

    // ── 🎭 منو برا السالفة؟ ──
    if (isOOLCard) {
      const oolGame = OOL.createOOLLobby(chatId, message.chat.title || 'المحادثة', deployerUserId || undefined);
      oolGame.messageId = message.message_id;
      if (deployerUserId) {
        OOL.oolJoin(oolGame, deployerUserId, deployerName);
      }
      this.oolGames.set(chatId, oolGame);
      const res = await this.editMessageText(
        chatId,
        message.message_id,
        await this.withBotFooter(OOL.renderOOLBoard(oolGame), true),
        OOL.oolBoardKeyboard(oolGame),
        'MarkdownV2'
      );
      if (!res?.ok) this.oolGames.delete(chatId);
      return;
    }

    // ── 🏟️ الألعاب التفاعلية الـ 25 الجديدة بالقناة ──
    if (arxMode && ARX.ARENA_MODES[arxMode]) {
      const ag = ARX.createArenaLobby(chatId, message.chat.title || 'المحادثة', arxMode);
      ag.messageId = message.message_id;
      if (deployerUserId) {
        ARX.arenaJoin(ag, deployerUserId, deployerName);
      }
      this.arenaGames.set(chatId, ag);
      const botUser = await this.getBotUsername();
      const res = await this.editMessageText(
        chatId,
        message.message_id,
        await this.withBotFooter(ARX.renderArenaText(ag), true),
        ARX.renderArenaKeyboard(ag, botUser),
        'MarkdownV2'
      );
      if (!res?.ok) this.arenaGames.delete(chatId);
      return;
    }

    // ── 🤝 منو يعرف الثاني أكثر؟ ──
    if (isWkCard) {
      const wkGame = WK.createWKGame(chatId, message.chat.title || 'المحادثة');
      wkGame.messageId = message.message_id;
      if (deployerUserId) {
        WK.wkJoin(wkGame, deployerUserId, deployerName);
      }
      this.wkGames.set(chatId, wkGame);
      const botUser = await this.getBotUsername();
      const res = await this.editMessageText(
        chatId,
        message.message_id,
        await this.withBotFooter(WK.renderWKBoard(wkGame), true),
        WK.wkBoardKeyboard(wkGame, botUser),
        'MarkdownV2'
      );
      if (!res?.ok) this.wkGames.delete(chatId);
      return;
    }

    // ── 🎉 ألعاب الجماعة (أسئلة + ماسترمايند) ──
    if (gqMark) {
      const kind = gqMark[1];
      this.gqGames.delete(chatId);
      this.mmGames.delete(chatId);

      if (kind === 'mm') {
        const game = GG.mmCreate(chatId, message.chat.title || 'المحادثة');
        game.messageId = message.message_id;
        if (deployerUserId) {
          GG.mmJoin(game, deployerUserId, deployerName);
        }
        this.mmGames.set(chatId, game);
        const res = await this.editMessageText(
          chatId,
          message.message_id,
          await this.withBotFooter(GG.renderMM(game), true),
          GG.mmKeyboard(game),
          'MarkdownV2'
        );
        if (!res?.ok) this.mmGames.delete(chatId);
        return;
      }

      const kind2: GG.QuizKind = (Object.keys(GG.QUIZ_KINDS) as GG.QuizKind[]).includes(kind as GG.QuizKind)
        ? (kind as GG.QuizKind)
        : 'speed';
      const game = GG.createQuiz(chatId, message.chat.title || 'المحادثة', kind2);
      game.messageId = message.message_id;
      if (deployerUserId) {
        GG.quizJoin(game, deployerUserId, deployerName);
      }
      this.gqGames.set(chatId, game);
      const res = await this.editMessageText(
        chatId,
        message.message_id,
        await this.withBotFooter(GG.renderQuiz(game), true),
        GG.quizKeyboard(game),
        'MarkdownV2'
      );
      if (!res?.ok) this.gqGames.delete(chatId);
      return;
    }

    // ── ✊✋✌️ حجرة ورقة مقص ──
    if (isRpsCard) {
      const rFromHidden = hiddenTag.startsWith('rps:') ? parseInt(hiddenTag.split(':')[1] || '5', 10) : NaN;
      const rMatch = text.match(/(\d+)\s*راوند/);
      const r = !Number.isNaN(rFromHidden) ? rFromHidden : rMatch ? parseInt(rMatch[1], 10) : 5;
      const rounds = [5, 10, 15].includes(r) ? r : 5;

      let game = RPS.createGame(chatId, message.chat.title || 'المحادثة', rounds, deployerUserId);
      if (deployerUserId) {
        game = RPS.join(game, deployerUserId, deployerName);
      }
      game.messageId = message.message_id;
      this.rpsGames.set(chatId, game);

      const res = await this.editMessageText(
        chatId,
        message.message_id,
        await this.withBotFooter(RPS.renderGame(game), true),
        RPS.boardKeyboard(game),
        'MarkdownV2'
      );
      if (!res?.ok) {
        this.rpsGames.delete(chatId);
      }
      return;
    }

    // ── ⚔️ كود نيمز ──
    const existing = this.games.get(chatId);
    if (existing && existing.status === 'lobby' && existing.messageId && existing.messageId !== message.message_id) {
      this.games.delete(chatId);
    }

    let creator: number | string | undefined = deployerUserId || undefined;
    if (!creator) {
      const admins = await this.getChatAdministrators(chatId);
      creator = admins.find(a => a?.user?.id && !a.user.is_bot)?.user?.id;
    }

    const game = CodenamesEngine.createLobby(
      chatId,
      message.chat.title || 'المحادثة',
      existing?.wordPack || 'arabic_standard',
      this.customWords,
      creator
    );
    game.messageId = message.message_id;

    // 🤝 الناشر يجلس تلقائياً بالمقعد الأول حتى بالقنوات العامة (channel_post)
    let seated: CodenamesGame = game;
    if (deployerUserId) {
      const joined = CodenamesEngine.joinGame(seated, {
        id: deployerUserId,
        name: deployerName,
        username: deployerUsername,
        team: 'auto' as any,
        role: 'auto' as any
      });
      if (joined.success) seated = joined.game;
    }
    this.games.set(chatId, seated);

    const res = await this.editMessageText(
      chatId,
      message.message_id,
      GG.toV2(await this.withBotFooter(CodenamesEngine.getTelegramMessageText(seated), true)),
      await this.buildKeyboard(seated),
      'MarkdownV2'
    );
    if (!res?.ok) {
      this.games.delete(chatId);
    }
  }

  // ---------------------------------------------------------------------
  // 🎉 أزرار ألعاب الجماعة داخل القناة (gqj انضم / gqs ابدأ / gqa جواب / gqn بطولة جديدة)
  // ---------------------------------------------------------------------

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  /** أقرب موعد انتهاء جولة أو شاشة نتيجة (للمنبّه التلقائي 10 ثواني) */
  public getNextQuizDeadline(): number | null {
    let earliest = Infinity;
    const now = Date.now();
    for (const g of this.gqGames.values()) {
      if (g.status === 'playing') {
        const d = g.roundDeadline ?? (g.roundDeadline = now + GG.ROUND_MS);
        if (d < earliest) earliest = d;
      } else if (g.status === 'result') {
        const d = g.resultDeadline ?? (g.resultDeadline = now + GG.RESULT_MS);
        if (d < earliest) earliest = d;
      }
    }
    for (const mf of this.mafiaGames.values()) {
      if ((mf.status === 'night' || mf.status === 'day') && mf.phaseDeadline !== undefined) {
        if (mf.phaseDeadline < earliest) earliest = mf.phaseDeadline;
      }
    }
    for (const ool of this.oolGames.values()) {
      if ((ool.status === 'voting' || ool.status === 'guessing') && ool.phaseDeadline !== undefined) {
        if (ool.phaseDeadline < earliest) earliest = ool.phaseDeadline;
      }
    }
    for (const ag of this.arenaGames.values()) {
      if (ag.status !== 'lobby' && ag.status !== 'game_over' && ag.deadline !== undefined) {
        if (ag.deadline < earliest) earliest = ag.deadline;
      }
    }
    for (const trn of this.tournamentGames.values()) {
      if (trn.status === 'playing' && trn.roundDeadline !== undefined && trn.roundDeadline < earliest) {
        earliest = trn.roundDeadline;
      } else if (trn.status === 'between' && trn.resultDeadline !== undefined && trn.resultDeadline < earliest) {
        earliest = trn.resultDeadline;
      }
    }
    return Number.isFinite(earliest) ? earliest : null;
  }

  /** جدولة محلية عند التشغيل خارج Cloudflare Durable Object */
  private scheduleLocalQuizTimer() {
    if (this.externalScheduler) return;
    if (this.localQuizTimer) {
      clearTimeout(this.localQuizTimer);
      this.localQuizTimer = null;
    }
    const nextAt = this.getNextQuizDeadline();
    if (nextAt === null) return;
    const delay = Math.max(50, nextAt - Date.now());
    this.localQuizTimer = setTimeout(() => {
      this.localQuizTimer = null;
      this.processQuizTimers().catch(err => console.error('localQuizTimer error:', err));
    }, delay);
  }

  /** يسجّل إحصائيات وخبرة وفلوس الألعاب الجماعية عند انتهائها (مرة واحدة فقط لكل جولة) */
  private recordGroupQuizFinish(game: GG.QuizGame) {
    if (game.rewarded || !game.players.length) return;
    game.rewarded = true;

    const topScore = Math.max(0, ...game.players.map(p => p.score));
    const avgOpponentLevel =
      game.players.reduce((s, p) => s + Economy.levelFromXp(this.users.get(p.id)?.xp || 0), 0) /
      Math.max(1, game.players.length);

    for (const p of game.players) {
      const rec = this.ensureUser(p.id, p.name);
      if (!rec.gqStats) rec.gqStats = {};
      const st = rec.gqStats[game.kind] || { games: 0, wins: 0, points: 0 };
      const won = topScore > 0 && p.score === topScore;
      st.games += 1;
      st.points += p.score;
      if (won) st.wins += 1;
      rec.gqStats[game.kind] = st;
      rec.points = (rec.points || 0) + p.score + (won ? 2 : 0);

      if (topScore > 0) {
        const levelBefore = Economy.levelFromXp(rec.xp || 0);
        const perf = Math.min(1, p.score / Math.max(1, game.totalRounds));
        rec.onlineGames = (rec.onlineGames || 0) + 1;
        const ecoGameId =
          game.kind === 'general'
            ? 'general_quiz'
            : game.kind === 'geo'
              ? 'geography_quiz'
              : game.kind === 'history'
                ? 'history_quiz'
                : 'group_quiz';
        if (won) {
          rec.onlineWins = (rec.onlineWins || 0) + 1;
          const money = Economy.moneyForWin({
            gameId: ecoGameId,
            performance: perf,
            level: levelBefore,
            opponentLevel: avgOpponentLevel,
            earnedToday: Economy.earnedToday(rec)
          });
          if (money > 0) {
            rec.money = Economy.roundMoney((rec.money || 0) + money);
            Economy.addEarned(rec, money);
          }
        }
        rec.xp = (rec.xp || 0) + Economy.xpForResult('group_quiz', won, perf);
      }
      this.users.set(rec.id, rec);
    }
  }

  /** يسجّل إحصائيات وخبرة وفلوس ماسترمايند عند انتهاء اللعبة */
  private recordMastermindFinish(game: GG.MMGame) {
    if (game.rewarded || !game.players.length) return;
    game.rewarded = true;

    const avgOpponentLevel =
      game.players.reduce((s, p) => s + Economy.levelFromXp(this.users.get(p.id)?.xp || 0), 0) /
      Math.max(1, game.players.length);

    for (const p of game.players) {
      const rec = this.ensureUser(p.id, p.name);
      const won = Boolean(game.winnerId && p.id === game.winnerId);
      rec.mmGames = (rec.mmGames || 0) + 1;
      rec.points = (rec.points || 0) + (won ? 5 : 1);
      rec.onlineGames = (rec.onlineGames || 0) + 1;
      if (won) {
        rec.mmWins = (rec.mmWins || 0) + 1;
        rec.onlineWins = (rec.onlineWins || 0) + 1;
        rec.mmBestTries = rec.mmBestTries ? Math.min(rec.mmBestTries, p.tries) : p.tries;
        const levelBefore = Economy.levelFromXp(rec.xp || 0);
        const perf = Math.min(1, Math.max(0.4, (GG.MM_MAX_TRIES_EACH - p.tries + 1) / GG.MM_MAX_TRIES_EACH));
        const money = Economy.moneyForWin({
          gameId: 'mastermind',
          performance: perf,
          level: levelBefore,
          opponentLevel: avgOpponentLevel,
          earnedToday: Economy.earnedToday(rec)
        });
        if (money > 0) {
          rec.money = Economy.roundMoney((rec.money || 0) + money);
          Economy.addEarned(rec, money);
        }
        rec.xp = (rec.xp || 0) + Economy.xpForResult('mastermind', true, perf);
      } else {
        rec.xp = (rec.xp || 0) + Economy.xpForResult('mastermind', false, 0.5);
      }
      this.users.set(rec.id, rec);
    }
  }

  /** ينقل الجولات المنتهية تلقائياً للسؤال اللي بعده (بعد 15 ثانية أو بعد شاشة النتيجة القصيرة) */
  public async processQuizTimers(): Promise<void> {
    const now = Date.now();
    for (const g of Array.from(this.gqGames.values())) {
      const roundExpired = g.status === 'playing' && g.roundDeadline !== undefined && now >= g.roundDeadline;
      const resultExpired = g.status === 'result' && g.resultDeadline !== undefined && now >= g.resultDeadline;
      if (!roundExpired && !resultExpired) continue;

      const adv = GG.quizAdvance(g);
      if (adv.over) {
        this.recordGroupQuizFinish(g);
      }
      await this.paintQuiz(g);
    }

    for (const mf of Array.from(this.mafiaGames.values())) {
      if (mf.phaseDeadline === undefined || now < mf.phaseDeadline) continue;
      if (mf.status === 'night') {
        const nextSt = MF.resolveNight(mf);
        if (nextSt === 'finished') this.recordMafiaFinish(mf);
        await this.paintMafia(mf);
      } else if (mf.status === 'day') {
        const nextSt = MF.resolveDay(mf);
        if (nextSt === 'finished') {
          this.recordMafiaFinish(mf);
        } else if (nextSt === 'night') {
          await this.sendMafiaNightPrompts(mf);
        }
        await this.paintMafia(mf);
      }
    }

    for (const ool of Array.from(this.oolGames.values())) {
      if (ool.phaseDeadline === undefined || now < ool.phaseDeadline) continue;
      if (ool.status === 'voting') {
        OOL.oolFinishVoting(ool);
        await this.paintOOL(ool);
      } else if (ool.status === 'guessing') {
        OOL.oolTimeoutGuess(ool);
        this.recordOOLFinish(ool);
        await this.paintOOL(ool);
      }
    }

    for (const ag of Array.from(this.arenaGames.values())) {
      if (ARX.tickSingleArenaGame(ag, now)) {
        if (ag.status === 'game_over') {
          this.recordArenaFinish(ag);
        }
        await this.paintArena(ag);
      }
    }

    for (const trn of Array.from(this.tournamentGames.values())) {
      if (TRN.handleTournamentTimeout(trn)) {
        if (trn.status === 'finished') {
          this.recordTournamentFinish(trn);
        }
        await this.paintTournament(trn);
      }
    }

    this.scheduleLocalQuizTimer();
  }

  private newTournamentId(): string {
    let id = '';
    do {
      id = Math.random().toString(36).slice(2, 9);
    } while (this.tournamentGames.has(id));
    return id;
  }

  private recordTournamentFinish(game: TRN.TournamentGame) {
    if (game.rewarded || !game.champion || !game.players.length) return;
    game.rewarded = true;

    const champId = game.champion.id;
    const avgOpponentLevel =
      game.players.reduce((s, p) => s + Economy.levelFromXp(this.users.get(p.id)?.xp || 0), 0) /
      Math.max(1, game.players.length);

    for (const p of game.players) {
      const rec = this.ensureUser(p.id, p.name);
      const won = p.id === champId;
      rec.onlineGames = (rec.onlineGames || 0) + 1;
      rec.points = (rec.points || 0) + (won ? 8 : game.runnerUp?.id === p.id ? 3 : 1);
      if (game.discipline === 'rps') {
        rec.rpsGames = (rec.rpsGames || 0) + 1;
        if (won) rec.rpsWins = (rec.rpsWins || 0) + 1;
      } else {
        if (!rec.gqStats) rec.gqStats = {};
        const st = rec.gqStats[game.discipline] || { games: 0, wins: 0, points: 0 };
        st.games += 1;
        if (won) st.wins += 1;
        st.points += won ? 5 : 1;
        rec.gqStats[game.discipline] = st;
      }
      if (won) {
        rec.onlineWins = (rec.onlineWins || 0) + 1;
        const levelBefore = Economy.levelFromXp(rec.xp || 0);
        const perf = Math.min(1, 0.7 + game.players.length / 32);
        const money = Economy.moneyForWin({
          gameId: 'tournament',
          performance: perf,
          level: levelBefore,
          opponentLevel: avgOpponentLevel,
          earnedToday: Economy.earnedToday(rec)
        });
        if (money > 0) {
          rec.money = Economy.roundMoney((rec.money || 0) + money);
          Economy.addEarned(rec, money);
        }
        rec.xp = (rec.xp || 0) + Economy.xpForResult('tournament', true, perf);
      } else {
        rec.xp = (rec.xp || 0) + Economy.xpForResult('tournament', false, game.runnerUp?.id === p.id ? 0.8 : 0.5);
      }
      this.users.set(rec.id, rec);
    }
  }

  private async paintTournament(game: TRN.TournamentGame) {
    const rendered = TRN.renderTournamentView(game);
    const fullText = await this.withBotFooter(rendered.text, true);
    if (game.messageId && game.chatId && !game.chatId.startsWith('inline:')) {
      await this.editMessageText(game.chatId, game.messageId, fullText, rendered.buttons, 'MarkdownV2');
    } else if (game.inlineMessageId) {
      await this.editInlineMessageText(game.inlineMessageId, fullText, rendered.buttons, 'MarkdownV2');
    }
    this.scheduleLocalQuizTimer();
  }

  private async handleTournamentCallback(cb: TelegramCallbackQuery, rawData: string) {
    const parts = rawData.split(':');
    const action = parts[1] || '';
    const userId = String(cb.from.id);
    const userName = cb.from.first_name || cb.from.username || 'لاعب';

    // التهيئة الفورية إذا نقر لاعب على بطاقة إنلاين قبل أو بدون وصول رسالة المحادثة
    if (action === 'auto') {
      const rawDisc = parts[2] || 'general';
      const rawCap = parts[3] || '8';
      const discipline: TRN.TournamentDiscipline = TRN.isValidDiscipline(rawDisc) ? rawDisc : 'general';
      const capacity = TRN.parseCapacity(rawCap);
      const chatKey = cb.message ? String(cb.message.chat.id) : `inline:${cb.inline_message_id || userId}`;

      let existing: TRN.TournamentGame | undefined;
      for (const g of this.tournamentGames.values()) {
        if (cb.message && g.chatId === chatKey && g.messageId === cb.message.message_id) {
          existing = g;
          break;
        }
        if (cb.inline_message_id && g.inlineMessageId === cb.inline_message_id) {
          existing = g;
          break;
        }
      }

      if (!existing) {
        const id = this.newTournamentId();
        existing = TRN.createTournamentLobby(
          id,
          chatKey,
          cb.message?.chat.title || 'البطولة',
          discipline,
          capacity
        );
        if (cb.message) existing.messageId = cb.message.message_id;
        if (cb.inline_message_id) existing.inlineMessageId = cb.inline_message_id;
        this.tournamentGames.set(id, existing);
      }

      const j = TRN.joinTournament(existing, userId, userName);
      if (!j.ok) {
        await this.answerCallbackQuery(cb.id, j.reason || '', true);
        return;
      }
      await this.answerCallbackQuery(cb.id, '✅ انضممت للبطولة الإقصائية!');
      await this.paintTournament(existing);
      return;
    }

    const trnId = parts[2] || '';
    const game = this.tournamentGames.get(trnId);
    if (!game) {
      await this.answerCallbackQuery(cb.id, '⚠️ انتهت صلاحية هذه البطولة — أنشئ بطولة جديدة من البوت.', true);
      return;
    }
    if (cb.inline_message_id && !game.inlineMessageId) {
      game.inlineMessageId = cb.inline_message_id;
    }

    if (action === 'j') {
      const j = TRN.joinTournament(game, userId, userName);
      if (!j.ok) {
        await this.answerCallbackQuery(cb.id, j.reason || '', true);
        return;
      }
      await this.answerCallbackQuery(cb.id, '✅ تم تسجيلك في البطولة!');
      await this.paintTournament(game);
      return;
    }

    if (action === 'l') {
      const lv = TRN.leaveTournament(game, userId);
      if (!lv.ok) {
        await this.answerCallbackQuery(cb.id, lv.reason || '', true);
        return;
      }
      await this.answerCallbackQuery(cb.id, 'تم انسحابك من البطولة.');
      await this.paintTournament(game);
      return;
    }

    if (action === 's') {
      const st = TRN.startTournament(game);
      if (!st.ok) {
        await this.answerCallbackQuery(cb.id, st.reason || '', true);
        return;
      }
      await this.answerCallbackQuery(cb.id, '🎲 انطلقت القرعة والمواجهات الإقصائية!');
      await this.paintTournament(game);
      return;
    }

    if (action === 'a') {
      const optIdx = parseInt(parts[3] || '0', 10);
      const ans = TRN.handleTournamentQuizAnswer(game, userId, optIdx);
      if (!ans.ok) {
        await this.answerCallbackQuery(cb.id, ans.alert || '', Boolean(ans.alert));
        return;
      }
      await this.answerCallbackQuery(cb.id, ans.alert || '');
      if (game.status === 'finished') {
        this.recordTournamentFinish(game);
      }
      if (ans.changed) {
        await this.paintTournament(game);
      }
      return;
    }

    if (action === 'r') {
      const mv = (parts[3] || 'r') as TRN.RpsThrow;
      if (mv !== 'r' && mv !== 'p' && mv !== 's') {
        await this.answerCallbackQuery(cb.id, '');
        return;
      }
      const res = TRN.handleTournamentRpsMove(game, userId, mv);
      if (!res.ok) {
        await this.answerCallbackQuery(cb.id, res.alert || '', Boolean(res.alert));
        return;
      }
      await this.answerCallbackQuery(cb.id, res.alert || '');
      if (game.status === 'finished') {
        this.recordTournamentFinish(game);
      }
      if (res.changed) {
        await this.paintTournament(game);
      }
      return;
    }

    if (action === 'n') {
      const freshId = this.newTournamentId();
      const fresh = TRN.createTournamentLobby(
        freshId,
        game.chatId,
        game.chatName,
        game.discipline,
        game.capacity
      );
      TRN.joinTournament(fresh, userId, userName);
      // لا نحذف لوحة التتويج السابقة في القناة أبداً — نرسل لوحة البطولة الجديدة أسفلها
      if (game.chatId && !game.chatId.startsWith('inline:')) {
        const rendered = TRN.renderTournamentView(fresh);
        const fullText = await this.withBotFooter(rendered.text, true);
        const sent = await this.sendMessage(game.chatId, fullText, rendered.buttons, 'MarkdownV2');
        if (sent?.ok && sent.result?.message_id) {
          fresh.messageId = sent.result.message_id;
          this.tournamentGames.set(freshId, fresh);
          await this.answerCallbackQuery(cb.id, '🏆 نزّلت بطولة إقصائية جديدة أسفل القناة!');
          return;
        }
      }
      if (game.inlineMessageId) {
        fresh.inlineMessageId = game.inlineMessageId;
        this.tournamentGames.set(freshId, fresh);
        await this.answerCallbackQuery(cb.id, '🏆 بدأت بطولة جديدة!');
        await this.paintTournament(fresh);
        return;
      }
      await this.answerCallbackQuery(cb.id, '');
    }
  }

  private async paintArena(game: ARX.ArenaGame) {
    const botUser = await this.getBotUsername();
    const text = await this.withBotFooter(ARX.renderArenaText(game), true);
    const kb = ARX.renderArenaKeyboard(game, botUser);
    if (game.messageId) {
      const res = await this.editMessageText(game.chatId, game.messageId, text, kb, 'MarkdownV2');
      if (res?.ok || String(res?.description || '').includes('not modified')) return;
    }
    if (game.inlineMessageId) {
      await this.editInlineMessageText(game.inlineMessageId, text, kb, 'MarkdownV2');
    }
  }

  private recordArenaFinish(game: ARX.ArenaGame) {
    if (game.rewarded || !game.players.length) return;
    game.rewarded = true;
    const meta = ARX.ARENA_MODES[game.mode];
    const ecoId =
      meta.category === 'duo'
        ? 'arena_duo'
        : meta.category === 'team'
          ? 'arena_team'
          : meta.category === 'team3'
            ? 'arena_team3'
            : meta.category === 'team4'
              ? 'arena_team4'
              : 'arena_group';

    const avgOpponentLevel =
      game.players.reduce((s, p) => s + Economy.levelFromXp(this.users.get(p.id)?.xp || 0), 0) /
      Math.max(1, game.players.length);

    for (const p of game.players) {
      const rec = this.ensureUser(p.id, p.name);
      if (!rec.gqStats) rec.gqStats = {};
      const st = rec.gqStats[game.mode] || { games: 0, wins: 0, points: 0 };
      const won = game.winnerIds.includes(p.id);
      st.games += 1;
      st.points += Math.max(0, p.score);
      if (won) st.wins += 1;
      rec.gqStats[game.mode] = st;
      rec.points = (rec.points || 0) + Math.max(1, p.score) + (won ? 3 : 0);
      rec.onlineGames = (rec.onlineGames || 0) + 1;
      const levelBefore = Economy.levelFromXp(rec.xp || 0);
      const perf = won ? 0.9 : 0.45;
      if (won) {
        rec.onlineWins = (rec.onlineWins || 0) + 1;
        const money = Economy.moneyForWin({
          gameId: ecoId,
          performance: perf,
          level: levelBefore,
          opponentLevel: avgOpponentLevel,
          earnedToday: Economy.earnedToday(rec)
        });
        if (money > 0) {
          rec.money = Economy.roundMoney((rec.money || 0) + money);
          Economy.addEarned(rec, money);
        }
      }
      rec.xp = (rec.xp || 0) + Economy.xpForResult(ecoId, won, perf);
      this.users.set(rec.id, rec);
    }
  }

  private async handleArenaCb(cb: TelegramCallbackQuery, data: string) {
    const parts = data.split(':');
    const op = parts[1] || '';
    const tailId = parts[parts.length - 1] || '';
    const cbChatId = /^-?\d{4,}$/.test(tailId) ? tailId : String(cb.message?.chat.id || '');
    const playerId = String(cb.from.id);
    const playerName = cb.from.first_name || 'لاعب';

    const modeCandidate = (parts[2] || '') as ARX.ArenaMode;
    let game = this.arenaGames.get(cbChatId);

    // بناء/استرجاع اللوحة الخالدة إذا كانت جديدة أو ضاعت من الذاكرة
    if (!game && cbChatId && ARX.ARENA_MODES[modeCandidate]) {
      game = ARX.createArenaLobby(cbChatId, cb.message?.chat.title || 'المحادثة', modeCandidate);
      if (cb.message?.message_id) game.messageId = cb.message.message_id;
      if (cb.inline_message_id) game.inlineMessageId = cb.inline_message_id;
      this.arenaGames.set(cbChatId, game);
    }

    if (!game) {
      await this.answerCallbackQuery(cb.id, '⚠️ أرسل اللعبة من جديد عبر زر العب بالقناة', true);
      return;
    }

    if (cb.inline_message_id && !game.inlineMessageId) game.inlineMessageId = cb.inline_message_id;
    if (cb.message?.message_id && !game.messageId) game.messageId = cb.message.message_id;

    if (op === 'wait') {
      await this.answerCallbackQuery(cb.id, '⏳ استعد للحظة القادمة!');
      return;
    }

    if (op === 'j' || op === 'jb' || op === 'jr') {
      const pref = op === 'jb' ? 'blue' : op === 'jr' ? 'red' : undefined;
      const r = ARX.arenaJoin(game, playerId, playerName, pref);
      await this.paintArena(game);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      return;
    }

    if (op === 'st') {
      const r = ARX.arenaStart(game);
      if (!r.ok) {
        await this.answerCallbackQuery(cb.id, r.msg, true);
        return;
      }
      await this.paintArena(game);
      this.scheduleLocalQuizTimer();
      await this.answerCallbackQuery(cb.id, r.msg);
      return;
    }

    if (op === 'nw') {
      const mode = ARX.ARENA_MODES[modeCandidate] ? modeCandidate : game.mode;
      const fresh = ARX.createArenaLobby(cbChatId, game.chatName || 'المحادثة', mode);
      ARX.arenaJoin(fresh, playerId, playerName);
      this.arenaGames.set(cbChatId, fresh);
      const botUser = await this.getBotUsername();
      const sent = await this.sendMessage(
        cbChatId,
        await this.withBotFooter(ARX.renderArenaText(fresh), true),
        ARX.renderArenaKeyboard(fresh, botUser),
        'MarkdownV2'
      );
      if (sent?.result?.message_id) {
        fresh.messageId = sent.result.message_id;
        this.arenaGames.set(cbChatId, fresh);
      }
      await this.answerCallbackQuery(cb.id, '🆕 تم فتح لوبي مباراة جديدة!');
      return;
    }

    if (op === 'sec') {
      const sec = ARX.arenaInspectSecret(game, playerId);
      await this.answerCallbackQuery(cb.id, sec.alert, true);
      return;
    }

    if (op === 'act') {
      const actType = parts[2] || 'opt';
      const val = parseInt(parts[3] || '0', 10);
      const res = ARX.arenaAction(game, playerId, actType, val);
      if (game.status === 'game_over') {
        this.recordArenaFinish(game);
      }
      await this.paintArena(game);
      this.scheduleLocalQuizTimer();
      await this.answerCallbackQuery(cb.id, res.msg, !res.ok);
      return;
    }
  }

  /** يعيد رسم لوحة لعبة جماعية — بنفس الرسالة إن كانت عادية، أو بمعرّف الإنلاين إن كانت أصلها تحويل */
  private async paintQuiz(game: GG.QuizGame) {
    const text = await this.withBotFooter(GG.renderQuiz(game), true);
    const kb = GG.quizKeyboard(game);
    if (game.messageId) {
      const res = await this.editMessageText(game.chatId, game.messageId, text, kb, 'MarkdownV2');
      if (res?.ok || String(res?.description || '').includes('not modified')) return;
    }
    if (game.inlineMessageId) {
      const res = await this.editInlineMessageText(game.inlineMessageId, text, kb, 'MarkdownV2');
      if (res?.ok || String(res?.description || '').includes('not modified')) return;
    }
  }

  private async paintMM(game: GG.MMGame) {
    const text = await this.withBotFooter(GG.renderMM(game), true);
    const kb = GG.mmKeyboard(game);
    if (game.messageId) {
      const res = await this.editMessageText(game.chatId, game.messageId, text, kb, 'MarkdownV2');
      if (res?.ok || String(res?.description || '').includes('not modified')) return;
    }
    if (game.inlineMessageId) {
      const res = await this.editInlineMessageText(game.inlineMessageId, text, kb, 'MarkdownV2');
      if (res?.ok || String(res?.description || '').includes('not modified')) return;
    }
  }

  /**
   * 🛡️ اللوحة الخالدة: اسم اللعبة منحوت بكل زر (gqj:<kind>:<chatId> …)
   * فلو اللعبة ضاعت من الذاكرة (نظام نام أو لوحة قديمة) — نبنيها من الزر نفسه
   * بلكرفة بدل ما يطلع للاعب «انتهت». عمراً ما تموت لوحة.
   */
  private async handleGroupQuizCb(cb: TelegramCallbackQuery, data: string) {
    // 🧭 المحادثة من مختوم الزر نفسه (رسائل الإنلاين ما توصل محادثة معها)
    const tailId = data.split(':').slice(-1)[0] || '';
    const cbChatId = /^-?\d{4,}$/.test(tailId) ? tailId : String(cb.message?.chat.id || '');
    const playerId = String(cb.from.id);
    const playerName = cb.from.first_name || 'لاعب';

    const parts = data.split(':');
    const op = parts[0]; // gqj gqs gqa gqn gqv gqskip

    // النوع داخل الزر — اللوحات القديمة (بدون نوع) ما نكدر نبنيها، ندكنعهم بذوق
    const kindRaw = op === 'gqa' ? parts[2] : parts[1];
    const kinds = Object.keys(GG.QUIZ_KINDS) as GG.QuizKind[];
    const kind: GG.QuizKind = kinds.includes(kindRaw as GG.QuizKind) ? (kindRaw as GG.QuizKind) : 'speed';

    let game = this.gqGames.get(cbChatId);

    // 🛡️ اللعبة ضايعة؟ نبني لوحة جديدة بنفس الرسالة ونرجّع اللاعب للوبي
    if (!game) {
      if (!cbChatId) {
        await this.answerCallbackQuery(cb.id, '⚠️ لوحة قديمة — ابعث اللعبة من جديد من صفحتها 🆕', true);
        return;
      }
      const rebuilt = GG.createQuiz(cbChatId, cb.message?.chat.title || 'المحادثة', kind);
      if (cb.message?.message_id) rebuilt.messageId = cb.message.message_id;
      if (cb.inline_message_id) rebuilt.inlineMessageId = cb.inline_message_id;
      this.gqGames.set(cbChatId, rebuilt);

      if (op === 'gqj') {
        // داس انضم على لوحة ضايعة → ننفذ انضمامه على اللوحة المبنية
        const r = GG.quizJoin(rebuilt, playerId, playerName);
        await this.paintQuiz(rebuilt);
        await this.answerCallbackQuery(cb.id, r.ok ? '✅ اللوحة كانت قديمة — رجّعناها وانضميت منها 🆕' : r.msg, !r.ok);
        return;
      }
      // أي زر آخر → نرجّع لوحة اللوبي وي ورّيهم إنها انبنت من جديد
      await this.paintQuiz(rebuilt);
      await this.sendMessage(cbChatId, '🛡️ هاي اللوحة كانت قديمة — رجّعناها لوبي جديد بنفس الرسالة، انضموا من جديد 👇');
      await this.answerCallbackQuery(cb.id, '🛡️ انبنى لوبي جديد');
      return;
    }

    // اللعبة موجودة — نكمل طبيعي
    game = game as GG.QuizGame;
    // أول دوسة من لوحة إنلاين؟ نربطها بمعرّفها
    if (cb.inline_message_id && !game.inlineMessageId) {
      game.inlineMessageId = cb.inline_message_id;
      this.gqGames.set(cbChatId, game);
    }

    // زر وهمي «الجولة الجاية…» — ما يسوي شي
    if (op === 'gqv') {
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    // ⏭️ ختم الجولة حتى ما تعلق
    if (op === 'gqskip') {
      const r = GG.quizSkip(game, playerId);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      if (r.ok) {
        await this.paintQuiz(game);
        this.scheduleLocalQuizTimer();
      }
      return;
    }

    // 🔄 لعبة جديدة — نبقي نتيجة اللعبة السابقة محفوظة فوق ونرسل لوحة جديدة بأسفلها
    if (op === 'gqn') {
      const fresh = GG.createQuiz(game.chatId, game.chatName, game.kind);
      GG.quizJoin(fresh, playerId, playerName);
      this.gqGames.set(game.chatId, fresh);
      const sent = game.chatId
        ? await this.sendMessage(
            game.chatId,
            await this.withBotFooter(GG.renderQuiz(fresh), true),
            GG.quizKeyboard(fresh),
            'MarkdownV2'
          )
        : null;
      if (sent?.ok && sent.result?.message_id) {
        fresh.messageId = sent.result.message_id;
        this.gqGames.set(game.chatId, fresh);
      } else {
        fresh.messageId = game.messageId;
        fresh.inlineMessageId = game.inlineMessageId;
        this.gqGames.set(game.chatId, fresh);
        await this.paintQuiz(fresh);
      }
      await this.answerCallbackQuery(cb.id, '🔄 لعبة جديدة — انضموا!');
      return;
    }

    // ➕ انضم
    if (op === 'gqj') {
      const r = GG.quizJoin(game, playerId, playerName);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      if (r.ok) await this.paintQuiz(game);
      return;
    }

    // 🎮 ابدأ
    if (op === 'gqs') {
      const r = GG.quizStart(game);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      if (r.ok) {
        await this.paintQuiz(game);
        this.scheduleLocalQuizTimer();
      }
      return;
    }

    // 🅰️ جواب — gqa:<idx>:<kind>:<chatId>
    if (op === 'gqa') {
      const idx = parseInt(parts[1] || '0', 10);
      const r = GG.quizAnswer(game, playerId, playerName, idx);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok && r.msg.startsWith('🚫'));
      if (r.ok) {
        await this.paintQuiz(game);
        this.scheduleLocalQuizTimer();
      }
      return;
    }
  }

  // ---------------------------------------------------------------------
  // 🔐 أزرار ماسترمايند (mmj انضم / mms ابدأ / mmd رقم / mmb مسح / mmc تأكيد / mmn جديدة)
  // ---------------------------------------------------------------------

  private async handleMastermindCb(cb: TelegramCallbackQuery, data: string) {
    const tailId = data.split(':').slice(-1)[0] || '';
    const cbChatId = /^-?\d{4,}$/.test(tailId) ? tailId : String(cb.message?.chat.id || '');
    const playerId = String(cb.from.id);
    const playerName = cb.from.first_name || 'لاعب';

    let game = this.mmGames.get(cbChatId);

    // 🛡️ لوحة ضايعة؟ نبنيها من جديد بنفس الرسالة ونرجّع اللاعب للوبي
    if (!game) {
      if (!cbChatId) {
        await this.answerCallbackQuery(cb.id, '⚠️ لوحة قديمة — ابعث اللعبة من جديد من صفحتها 🆕', true);
        return;
      }
      const rebuilt = GG.mmCreate(cbChatId, cb.message?.chat.title || 'المحادثة');
      if (cb.message?.message_id) rebuilt.messageId = cb.message.message_id;
      if (cb.inline_message_id) rebuilt.inlineMessageId = cb.inline_message_id;
      this.mmGames.set(cbChatId, rebuilt);

      if (data.startsWith('mmj:')) {
        const r = GG.mmJoin(rebuilt, playerId, playerName);
        await this.paintMM(rebuilt);
        await this.answerCallbackQuery(cb.id, r.ok ? '✅ اللوحة كانت قديمة — رجّعناها وانضميت منها 🆕' : r.msg, !r.ok);
        return;
      }
      await this.paintMM(rebuilt);
      await this.sendMessage(cbChatId, '🛡️ هاي اللوحة كانت قديمة — رجّعناها لوبي جديد بنفس الرسالة، انضموا من جديد 👇');
      await this.answerCallbackQuery(cb.id, '🛡️ انبنى لوبي جديد');
      return;
    }

    // أول دوسة من لوحة إنلاين؟ نربطها بمعرّفها
    if (cb.inline_message_id && !(game as GG.MMGame).inlineMessageId) {
      (game as GG.MMGame).inlineMessageId = cb.inline_message_id;
      this.mmGames.set(cbChatId, game);
    }

    // 🔄 لعبة جديدة — نبقي نتيجة اللعبة السابقة محفوظة فوق ونرسل لوحة جديدة بأسفلها
    if (data.startsWith('mmn:')) {
      const fresh = GG.mmCreate(game.chatId, game.chatName);
      GG.mmJoin(fresh, playerId, playerName);
      this.mmGames.set(game.chatId, fresh);
      const sent = game.chatId
        ? await this.sendMessage(
            game.chatId,
            await this.withBotFooter(GG.renderMM(fresh), true),
            GG.mmKeyboard(fresh),
            'MarkdownV2'
          )
        : null;
      if (sent?.ok && sent.result?.message_id) {
        fresh.messageId = sent.result.message_id;
        this.mmGames.set(game.chatId, fresh);
      } else {
        fresh.messageId = game.messageId;
        fresh.inlineMessageId = game.inlineMessageId;
        this.mmGames.set(game.chatId, fresh);
        await this.paintMM(fresh);
      }
      await this.answerCallbackQuery(cb.id, '🔄 رقم سري جديد — انضموا!');
      return;
    }

    if (data.startsWith('mmt:')) {
      const r = GG.mmSkipTurn(game, playerId);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      if (r.ok) await this.paintMM(game);
      return;
    }

    if (data.startsWith('mmj:')) {
      const r = GG.mmJoin(game, playerId, playerName);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      if (r.ok) await this.paintMM(game);
      return;
    }

    if (data.startsWith('mms:')) {
      const r = GG.mmStart(game);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      if (r.ok) await this.paintMM(game);
      return;
    }

    if (data.startsWith('mmd:')) {
      const digit = data.split(':')[1] || '';
      const r = GG.mmPress(game, playerId, digit);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok && !!r.msg);
      if (r.ok) await this.paintMM(game);
      return;
    }

    if (data.startsWith('mmb:')) {
      const r = GG.mmBack(game, playerId);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok && !!r.msg);
      if (r.ok) await this.paintMM(game);
      return;
    }

    if (data.startsWith('mmc:')) {
      const r = GG.mmConfirm(game, playerId);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      if (r.ok) {
        if (r.won || r.stuck) {
          this.recordMastermindFinish(game);
        }
        await this.paintMM(game);
      }
      return;
    }
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
   * 👤 قسم إحصائية اللاعب نفسه ومقارنته المباشرة بالمتصدرين — كل معلومة بسطر مستقل واضح.
   */
  private buildPersonalComparison(opts: {
    viewerId: string;
    myScore: number;
    myGames: number;
    unitLabel: string;
    statLines: string[];
    board: { id: string; score: number }[];
  }): string {
    const SEP = '━━━━━━━━━━━━━━━━━━━';
    if (!opts.viewerId) return '';
    const rec = this.users.get(String(opts.viewerId));
    const myName = rec?.name || 'أنت';
    const rankIdx = opts.board.findIndex(x => String(x.id) === String(opts.viewerId));

    const out: string[] = [
      SEP,
      `👤 *إحصائيتك ومقارنتك بالمتصدرين:*`,
      this.quoteRow('', myName)
    ];

    if (rankIdx >= 0) {
      out.push(`🏅 ترتيبك: *#${rankIdx + 1}* من *${opts.board.length}*`);
    } else {
      out.push(`🏅 ترتيبك: غير مصنّف بعد`);
    }

    for (const ln of opts.statLines) {
      if (ln) out.push(ln);
    }

    if (!opts.board.length) {
      out.push(`📊 المقارنة: لا يوجد متصدر بعد — العب جولة وتصدّر!`);
    } else if (rankIdx === 0) {
      const lead = opts.board[1] ? opts.myScore - opts.board[1].score : -1;
      if (lead > 0) {
        out.push(`🥇 الصدارة: أنت المركز الأول بفارق *${lead} ${opts.unitLabel}* عن الثاني`);
      } else {
        out.push(`🥇 الصدارة: أنت في المركز الأول بـ *${opts.myScore} ${opts.unitLabel}*`);
      }
    } else if (!opts.myGames) {
      out.push(`📊 المتصدر الأول: *${opts.board[0].score} ${opts.unitLabel}*`);
    } else {
      const gap = opts.board[0].score - opts.myScore;
      if (gap <= 0) {
        out.push(`🥇 المقارنة: متعادل مع المركز الأول بـ *${opts.myScore} ${opts.unitLabel}*`);
      } else {
        out.push(`📊 الفرق عن المركز الأول: *${gap} ${opts.unitLabel}*`);
      }
    }

    return out.join('\n');
  }

  /** نصوص الإحصائيات: كل بند بسطر مستقل — عامة أولاً + المتصدرون + خط كامل + إحصائيتك ومقارنتك */
  private async buildGameStats(section: string, viewerId = ''): Promise<{ text: string; keyboard: any[][] }> {
    const SEP = '━━━━━━━━━━━━━━━━━━━';
    const n = this.gameStatsNumbers();
    const backStats = [{ text: '🔙 رجوع للإحصائيات', callback_data: 'gstat:main' }];

    if (section === 'cat:group' || section === 'cat:guess') {
      const list = BOT_GAMES.filter(g => g.category === 'group');
      const kb: any[][] = [];
      for (let i = 0; i < list.length; i += 2) {
        const row: any[] = [{ text: `${list[i].emoji} ${list[i].title}`, callback_data: `gstat:f:${list[i].id}` }];
        if (list[i + 1]) {
          row.push({ text: `${list[i + 1].emoji} ${list[i + 1].title}`, callback_data: `gstat:f:${list[i + 1].id}` });
        }
        kb.push(row);
      }
      kb.push(backStats);
      return {
        text: `🎉 *إحصائيات الألعاب الجماعية*\n${SEP}\nاختر اللعبة لعرض إحصائياتها ومقارنتك بالمتصدرين:`,
        keyboard: kb
      };
    }

    const fromGame = section.startsWith('g:');
    const fromHub = section.startsWith('f:');
    const gameId = fromGame || fromHub ? section.slice(2) : section === 'cn' ? 'codenames' : '';
    const backRow = fromGame
      ? [{ text: '🔙 رجوع للعبة', callback_data: `hub:g:${gameId}` }]
      : fromHub
        ? (() => {
            const gCard = findBotGame(gameId);
            if (gCard && gCard.category === 'group') {
              return [{ text: '🔙 رجوع للجماعية', callback_data: 'gstat:cat:group' }];
            }
            return backStats;
          })()
        : backStats;

    const myRec = viewerId ? this.users.get(String(viewerId)) : undefined;

    // 🎉 1) الألعاب الجماعية الـ 11
    const gqKind = gameId ? TelegramBotManager.GQ_GAME_KIND[gameId] : undefined;
    if (gqKind) {
      const meta = GG.QUIZ_KINDS[gqKind];
      const rows = n.users
        .map(u => ({ u, st: this.userGqStat(u, gqKind) }))
        .filter(x => x.st.games > 0)
        .sort((a, b) => b.st.wins - a.st.wins || b.st.points - a.st.points);

      const totalParticipations = rows.reduce((s, x) => s + x.st.games, 0);
      const totalWins = rows.reduce((s, x) => s + x.st.wins, 0);
      const totalPts = rows.reduce((s, x) => s + x.st.points, 0);
      const top = rows.slice(0, 10);

      const lines = top.length
        ? top
            .map((x, i) => this.quoteRow(i + 1, x.u.name, `(🏆 ${x.st.wins} فوز • ⭐ ${x.st.points} نقطة)`)).join('\n')
        : '_لا يوجد متصدرون بعد_';

      const mySt = myRec ? this.userGqStat(myRec, gqKind) : { games: 0, wins: 0, points: 0 };
      const bottom = this.buildPersonalComparison({
        viewerId,
        myScore: mySt.wins,
        myGames: mySt.games,
        unitLabel: 'فوز',
        statLines: [
          `🎮 مبارياتك: *${mySt.games}*`,
          `🏆 فوزك: *${mySt.wins}*`,
          `⭐ نقاطك: *${mySt.points}*`,
          `🎯 نسبة الفوز: *${this.statPct(mySt.wins, mySt.games)}*`
        ],
        board: rows.map(x => ({ id: x.u.id, score: x.st.wins }))
      });

      const text =
        `${meta.emoji} *إحصائيات ${meta.title}*\n` +
        `👥 اللاعبون المشاركون: *${rows.length}*\n` +
        `🎮 المشاركات المكتملة: *${totalParticipations}*\n` +
        `🏆 إجمالي مرات الفوز: *${totalWins}*\n` +
        `⭐ إجمالي الإجابات الصحيحة: *${totalPts}*\n\n` +
        `🥇 *المتصدرون:*\n${lines}` +
        (bottom ? `\n${bottom}` : '');

      return { text, keyboard: [backRow] };
    }

    // 🕵️ إحصائيات المافيا
    if (gameId === 'mafia') {
      const players = n.users
        .filter(u => (u.mfGames || 0) > 0)
        .sort((a, b) => (b.mfWins || 0) - (a.mfWins || 0));
      const totalPlayed = players.reduce((acc, u) => acc + (u.mfGames || 0), 0);
      const totalWins = players.reduce((acc, u) => acc + (u.mfWins || 0), 0);
      const top = players.slice(0, 10);
      const lines = top.length
        ? top.map((u, i) => this.quoteRow(i + 1, u.name, `(🏆 ${u.mfWins || 0} فوز)`)).join('\n')
        : '_لا يوجد متصدرون بعد_';
      const myGames = myRec?.mfGames || 0;
      const myWins = myRec?.mfWins || 0;
      const bottom = this.buildPersonalComparison({
        viewerId,
        myScore: myWins,
        myGames,
        unitLabel: 'فوز',
        statLines: [
          `🎮 مبارياتك: *${myGames}*`,
          `🏆 فوزك: *${myWins}*`,
          `🎯 نسبة الفوز: *${this.statPct(myWins, myGames)}*`
        ],
        board: players.map(u => ({ id: u.id, score: u.mfWins || 0 }))
      });
      const text =
        `🕵️ *إحصائيات المافيا*\n` +
        `👥 اللاعبون المشاركون: *${players.length}*\n` +
        `🎮 المشاركات المكتملة: *${totalPlayed}*\n` +
        `🏆 إجمالي مرات الفوز: *${totalWins}*\n\n` +
        `🥇 *المتصدرون:*\n${lines}` +
        (bottom ? `\n${bottom}` : '');
      return { text, keyboard: [backRow] };
    }

    // 🎭 إحصائيات منو برا السالفة؟
    if (gameId === 'out_of_loop') {
      const players = n.users
        .filter(u => (u.oolGames || 0) > 0)
        .sort((a, b) => (b.oolWins || 0) - (a.oolWins || 0));
      const totalPlayed = players.reduce((acc, u) => acc + (u.oolGames || 0), 0);
      const totalWins = players.reduce((acc, u) => acc + (u.oolWins || 0), 0);
      const top = players.slice(0, 10);
      const lines = top.length
        ? top.map((u, i) => this.quoteRow(i + 1, u.name, `(🏆 ${u.oolWins || 0} فوز)`)).join('\n')
        : '_لا يوجد متصدرون بعد_';
      const myGames = myRec?.oolGames || 0;
      const myWins = myRec?.oolWins || 0;
      const bottom = this.buildPersonalComparison({
        viewerId,
        myScore: myWins,
        myGames,
        unitLabel: 'فوز',
        statLines: [
          `🎮 مبارياتك: *${myGames}*`,
          `🏆 فوزك: *${myWins}*`,
          `🎯 نسبة الفوز: *${this.statPct(myWins, myGames)}*`
        ],
        board: players.map(u => ({ id: u.id, score: u.oolWins || 0 }))
      });
      const text =
        `🎭 *إحصائيات منو برا السالفة؟*\n` +
        `👥 اللاعبون المشاركون: *${players.length}*\n` +
        `🎮 المشاركات المكتملة: *${totalPlayed}*\n` +
        `🏆 إجمالي مرات الفوز: *${totalWins}*\n\n` +
        `🥇 *المتصدرون:*\n${lines}` +
        (bottom ? `\n${bottom}` : '');
      return { text, keyboard: [backRow] };
    }

    // 🤝 منو يعرف الثاني أكثر؟
    if (gameId === 'who_knows') {
      const players = n.users
        .filter(u => (u.wkGames || 0) > 0)
        .sort((a, b) => (b.wkWins || 0) - (a.wkWins || 0) || (b.wkCorrect || 0) - (a.wkCorrect || 0));
      const totalPlayed = players.reduce((acc, u) => acc + (u.wkGames || 0), 0);
      const totalWins = players.reduce((acc, u) => acc + (u.wkWins || 0), 0);
      const totalCards = players.reduce((acc, u) => acc + (u.wkCorrect || 0), 0);
      const top = players.slice(0, 10);

      const lines = top.length
        ? top
            .map((u, i) =>
              this.quoteRow(i + 1, u.name, `(🏆 ${u.wkWins || 0} فوز • 🃏 ${u.wkCorrect || 0} بطاقة صح)`)
            )
            .join('\n')
        : '_لا يوجد متصدرون بعد_';

      const myGames = myRec?.wkGames || 0;
      const myWins = myRec?.wkWins || 0;
      const myCards = myRec?.wkCorrect || 0;
      const bottom = this.buildPersonalComparison({
        viewerId,
        myScore: myWins,
        myGames,
        unitLabel: 'فوز',
        statLines: [
          `🎮 مبارياتك: *${myGames}*`,
          `🏆 فوزك: *${myWins}*`,
          `🃏 بطاقاتك الصحيحة: *${myCards}*`,
          `🎯 نسبة الفوز: *${this.statPct(myWins, myGames)}*`
        ],
        board: players.map(u => ({ id: u.id, score: u.wkWins || 0 }))
      });

      const text =
        `🤝 *إحصائيات منو يعرف الثاني أكثر؟*\n` +
        `👥 اللاعبون المشاركون: *${players.length}*\n` +
        `🎮 المشاركات المكتملة: *${totalPlayed}*\n` +
        `🏆 إجمالي مرات الفوز: *${totalWins}*\n` +
        `🃏 إجمالي البطاقات الصحيحة: *${totalCards}*\n\n` +
        `🥇 *المتصدرون:*\n${lines}` +
        (bottom ? `\n${bottom}` : '');

      return { text, keyboard: [backRow] };
    }

    // 🏟️ إحصائيات جميع الألعاب التفاعلية الـ 25 الجديدة (1v1 / 2v2 / 3v3 / 4v4 / الجماعية)
    if (gameId && ARX.ARENA_MODES[gameId as ARX.ArenaMode]) {
      const meta = ARX.ARENA_MODES[gameId as ARX.ArenaMode];
      const rows = n.users
        .map(u => ({ u, st: u.gqStats?.[meta.mode] || { games: 0, wins: 0, points: 0 } }))
        .filter(x => x.st.games > 0)
        .sort((a, b) => b.st.wins - a.st.wins || b.st.points - a.st.points);

      const totalParticipations = rows.reduce((s, x) => s + x.st.games, 0);
      const totalWins = rows.reduce((s, x) => s + x.st.wins, 0);
      const totalPts = rows.reduce((s, x) => s + x.st.points, 0);
      const top = rows.slice(0, 10);

      const lines = top.length
        ? top
            .map((x, i) => this.quoteRow(i + 1, x.u.name, `(🏆 ${x.st.wins} فوز • ⭐ ${x.st.points} نقطة)`))
            .join('\n')
        : '_لا يوجد متصدرون بعد_';

      const mySt = myRec?.gqStats?.[meta.mode] || { games: 0, wins: 0, points: 0 };
      const bottom = this.buildPersonalComparison({
        viewerId,
        myScore: mySt.wins,
        myGames: mySt.games,
        unitLabel: 'فوز',
        statLines: [
          `🎮 مبارياتك: *${mySt.games}*`,
          `🏆 فوزك: *${mySt.wins}*`,
          `⭐ نقاطك: *${mySt.points}*`,
          `🎯 نسبة الفوز: *${this.statPct(mySt.wins, mySt.games)}*`
        ],
        board: rows.map(x => ({ id: x.u.id, score: x.st.wins }))
      });

      const text =
        `${meta.emoji} *إحصائيات ${meta.title}*\n` +
        `👥 اللاعبون المشاركون: *${rows.length}*\n` +
        `🎮 المشاركات المكتملة: *${totalParticipations}*\n` +
        `🏆 إجمالي مرات الفوز: *${totalWins}*\n` +
        `⭐ إجمالي النقاط: *${totalPts}*\n\n` +
        `🥇 *المتصدرون:*\n${lines}` +
        (bottom ? `\n${bottom}` : '');

      return { text, keyboard: [backRow] };
    }

    // 🎵 4) خمّن الأغنية (الأغاني العربية + الإنجليزية معاً)
    if (gameId === 'guess_song') {
      const songStat = (u: BotUserRecord) => {
        const ar = u.gqStats?.song_ar || { games: 0, wins: 0, points: 0 };
        const en = u.gqStats?.song_en || { games: 0, wins: 0, points: 0 };
        return {
          games: ar.games + en.games + (u.guessSongGames || 0),
          wins: ar.wins + en.wins + (u.guessSongWins || 0),
          points: ar.points + en.points + (u.guessSongWins || 0) * 10
        };
      };
      const rows = n.users
        .map(u => ({ u, st: songStat(u) }))
        .filter(x => x.st.games > 0)
        .sort((a, b) => b.st.wins - a.st.wins || b.st.points - a.st.points);

      const totalParticipations = rows.reduce((s, x) => s + x.st.games, 0);
      const totalWins = rows.reduce((s, x) => s + x.st.wins, 0);
      const totalPts = rows.reduce((s, x) => s + x.st.points, 0);
      const top = rows.slice(0, 10);

      const lines = top.length
        ? top
            .map((x, i) => this.quoteRow(i + 1, x.u.name, `(🏆 ${x.st.wins} فوز • ⭐ ${x.st.points} نقطة)`))
            .join('\n')
        : '_لا يوجد متصدرون بعد_';

      const mySt = myRec ? songStat(myRec) : { games: 0, wins: 0, points: 0 };
      const bottom = this.buildPersonalComparison({
        viewerId,
        myScore: mySt.wins,
        myGames: mySt.games,
        unitLabel: 'فوز',
        statLines: [
          `🎮 مبارياتك: *${mySt.games}*`,
          `🏆 فوزك: *${mySt.wins}*`,
          `⭐ نقاطك: *${mySt.points}*`,
          `🎯 نسبة الفوز: *${this.statPct(mySt.wins, mySt.games)}*`
        ],
        board: rows.map(x => ({ id: x.u.id, score: x.st.wins }))
      });

      const text =
        `🎵 *إحصائيات الأغاني*\n` +
        `👥 اللاعبون المشاركون: *${rows.length}*\n` +
        `🎮 المشاركات المكتملة: *${totalParticipations}*\n` +
        `🏆 إجمالي مرات الفوز: *${totalWins}*\n` +
        `⭐ إجمالي الإجابات الصحيحة: *${totalPts}*\n\n` +
        `🥇 *المتصدرون:*\n${lines}` +
        (bottom ? `\n${bottom}` : '');

      return { text, keyboard: [backRow] };
    }

    // ⚔️ 5) كود نيمز (خاص بالأشخاص فقط)
    if (gameId === 'codenames') {
      const spyWins = new Map<string, { name: string; wins: number }>();
      const uniquePlayers = new Set<string>();
      for (const g of n.matches) {
        for (const p of g.players || []) {
          uniquePlayers.add(String(p.id));
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

      const fullBoard = this.codenamesWinBoard(0);
      const winBoard = fullBoard.slice(0, 5);

      const spyLines = topSpies.length
        ? topSpies
            .map((s, i) => this.quoteRow(i + 1, s.name, `(${s.wins} فوز)`)).join('\n')
        : '_لا يوجد جواسيس متصدرون بعد_';

      const winLines = winBoard.length
        ? winBoard
            .map((w, i) => this.quoteRow(i + 1, w.name, `(🏆 ${w.wins} فوز)`)).join('\n')
        : '_لا يوجد متصدرون بعد_';

      const myId = String(viewerId);
      const mine = viewerId ? n.matches.filter(g => (g.players || []).some(p => String(p.id) === myId)) : [];
      const myWins = mine.filter(g => (g.players || []).some(p => String(p.id) === myId && p.team === g.winner)).length;
      const mySpyWins = mine.filter(g =>
        (g.players || []).some(p => String(p.id) === myId && p.team === g.winner && p.role === 'spymaster')
      ).length;

      const bottom = this.buildPersonalComparison({
        viewerId,
        myScore: myWins,
        myGames: mine.length,
        unitLabel: 'فوز',
        statLines: [
          `🎮 مبارياتك: *${mine.length}*`,
          `🏆 فوزك: *${myWins}*`,
          `🕵️ فوزك كجاسوس: *${mySpyWins}*`,
          `👤 فوزك كعميل: *${myWins - mySpyWins}*`,
          `🎯 نسبة الفوز: *${this.statPct(myWins, mine.length)}*`
        ],
        board: fullBoard.map(w => ({ id: w.id, score: w.wins }))
      });

      const text =
        `⚔️ *إحصائيات كود نيمز*\n` +
        `👥 اللاعبون المشاركون: *${uniquePlayers.size}*\n` +
        `🏁 المباريات المكتملة: *${n.matches.length}*\n` +
        `🔵 فوز الفريق الأزرق: *${n.blueWins}*\n` +
        `🔴 فوز الفريق الأحمر: *${n.redWins}*\n` +
        `💀 الخسارة ببطاقة القاتل: *${n.assassinLosses}*\n\n` +
        `🏆 *أكثر اللاعبين فوزاً:*\n${winLines}\n\n` +
        `🕵️ *أفضل الجواسيس:*\n${spyLines}` +
        (bottom ? `\n${bottom}` : '');

      return { text, keyboard: [backRow] };
    }

    // ✊ 6) حجرة ورقة مقص
    if (gameId === 'rps') {
      const players = n.users
        .filter(u => (u.rpsGames || 0) > 0)
        .sort((a, b) => (b.rpsWins || 0) - (a.rpsWins || 0));
      const totalGames = players.reduce((s, u) => s + (u.rpsGames || 0), 0);
      const totalWins = players.reduce((s, u) => s + (u.rpsWins || 0), 0);
      const topPlayers = players.slice(0, 10);

      const lines = topPlayers.length
        ? topPlayers
            .map((u, i) => {
              const games = u.rpsGames || 0;
              const wins = u.rpsWins || 0;
              const pct = games ? Math.round((wins / games) * 100) : 0;
              return this.quoteRow(i + 1, u.name, `(🏆 ${wins} فوز • ${pct}%)`);
            }).join('\n')
        : '_لا يوجد متصدرون بعد_';

      const myGames = myRec?.rpsGames || 0;
      const myWins = myRec?.rpsWins || 0;
      const bottom = this.buildPersonalComparison({
        viewerId,
        myScore: myWins,
        myGames,
        unitLabel: 'فوز',
        statLines: [
          `🎮 مبارياتك: *${myGames}*`,
          `🏆 فوزك: *${myWins}*`,
          `🎯 نسبة الفوز: *${this.statPct(myWins, myGames)}*`
        ],
        board: players.map(u => ({ id: u.id, score: u.rpsWins || 0 }))
      });

      const text =
        `✊ *إحصائيات حجرة ورقة مقص*\n` +
        `👥 اللاعبون المشاركون: *${players.length}*\n` +
        `🎮 المشاركات المكتملة: *${totalGames}*\n` +
        `🏆 إجمالي مرات الفوز: *${totalWins}*\n\n` +
        `🥇 *المتصدرون:*\n${lines}` +
        (bottom ? `\n${bottom}` : '');

      return { text, keyboard: [backRow] };
    }

        // 🏆 لوحة الأبطال الشاملة
    if (section === 'top') {
      const pointsBoard = n.users
        .filter(u => (u.points || 0) > 0)
        .sort((a, b) => (b.points || 0) - (a.points || 0));
      const topPoints = pointsBoard.slice(0, 10);

      const pointsLines = topPoints.length
        ? topPoints
            .map((u, i) => this.quoteRow(i + 1, u.name, `(⭐ ${u.points || 0} نقطة)`)).join('\n')
        : '_لا يوجد متصدرون بعد_';

      const myPts = myRec?.points || 0;
      const myGames = myRec?.onlineGames || 0;
      const myWins = myRec?.onlineWins || 0;
      const bottom = this.buildPersonalComparison({
        viewerId,
        myScore: myPts,
        myGames: myGames + myPts,
        unitLabel: 'نقطة',
        statLines: [
          `⭐ نقاطك الكلية: *${myPts}*`,
          `🎮 مبارياتك: *${myGames}*`,
          `🏆 فوزك: *${myWins}*`
        ],
        board: pointsBoard.map(u => ({ id: u.id, score: u.points || 0 }))
      });

      const text =
        `🏆 *لوحة الأبطال*\n` +
        `👥 اللاعبون المسجلون: *${pointsBoard.length}*\n` +
        `⭐ مجموع نقاط اللاعبين: *${n.totalPoints}*\n\n` +
        `🥇 *الأكثر نقاطاً:*\n${pointsLines}` +
        (bottom ? `\n${bottom}` : '');

      return { text, keyboard: [backStats] };
    }

    // 📊 الشاشة الرئيسية للإحصائيات
    const poetSolved = n.users.reduce((sum, u) => sum + (u.poetWins || 0), 0);
    const gqTotal = n.users.reduce((s, u) => {
      if (!u.gqStats) return s;
      return s + Object.values(u.gqStats).reduce((acc, v) => acc + (v.games || 0), 0);
    }, 0);
    const mmTotal = n.users.reduce((s, u) => s + (u.mmGames || 0), 0);
    const soloPlayed = n.users.reduce(
      (s, u) =>
        s +
        (u.mathGames || 0) +
        (u.guessSongGames || 0),
      0
    );
    const rpsPlayed = n.users.reduce((s, u) => s + (u.rpsGames || 0), 0);
    const totalCompleted = n.matches.length + n.solved + poetSolved + soloPlayed + rpsPlayed + gqTotal + mmTotal;

    const pointsBoard = n.users
      .filter(u => (u.points || 0) > 0)
      .sort((a, b) => (b.points || 0) - (a.points || 0));
    const topPoints = pointsBoard.slice(0, 5);
    const topLines = topPoints.length
      ? topPoints
          .map((u, i) => this.quoteRow(i + 1, u.name, `(⭐ ${u.points || 0} نقطة)`)).join('\n')
      : '_لا يوجد متصدرون بعد_';

    const myPts = myRec?.points || 0;
    const myGames = myRec?.onlineGames || 0;
    const myWins = myRec?.onlineWins || 0;
    const bottom = this.buildPersonalComparison({
      viewerId,
      myScore: myPts,
      myGames: myGames + myPts,
      unitLabel: 'نقطة',
      statLines: [
        `⭐ نقاطك: *${myPts}*`,
        `🎮 مبارياتك: *${myGames}*`,
        `🏆 فوزك: *${myWins}*`
      ],
      board: pointsBoard.map(u => ({ id: u.id, score: u.points || 0 }))
    });

    const text =
      `📊 *إحصائيات الألعاب*\n` +
      `👥 اللاعبون: *${n.users.length}*\n` +
      `🎮 المشاركات المكتملة: *${totalCompleted}*\n` +
      `⚔️ مباريات كود نيمز: *${n.matches.length}*\n` +
      `🎉 الألعاب الجماعية: *${gqTotal + mmTotal}*\n` +
      `✊ حجرة ورقة مقص: *${rpsPlayed}*\n` +
      `🧩 الكلمات المحلولة: *${n.solved}*\n\n` +
      `🏆 *أقوى 5 لاعبين بالنقاط:*\n${topLines}` +
      (bottom ? `\n${bottom}` : '');

    const keyboard: any[][] = [
      [
        { text: '🎉 إحصائيات الجماعية', callback_data: 'gstat:cat:group' },
        { text: '🏆 لوحة الأبطال', callback_data: 'gstat:top' }
      ],
      [
        { text: '⚔️ كود نيمز', callback_data: 'gstat:cn' },
        { text: '✊ حجرة ورقة مقص', callback_data: 'gstat:f:rps' }
      ],
      [{ text: '🔙 رجوع', callback_data: 'hub:main' }],
      [{ text: '👑 لوحة التحكم', callback_data: 'admin:panel' }]
    ];

    return { text, keyboard };
  }

  // ---------------------------------------------------------------------
  // 💰 الفلوس والمستوى: كل معلومة بسطر مستقل بدون زر «ملفي» منفصل
  // ---------------------------------------------------------------------

  private buildRanking(section: string, viewerId: string): { text: string; keyboard: any[][] } {
    const SEP = '━━━━━━━━━━━━━━━━━━━';
    if (section === 'menu') {
      return {
        text: `🏅 *المتصدرون*\n${SEP}\nاختر التصنيف لعرض المتصدرين ومقارنتك بهم:`,
        keyboard: [
          [{ text: '💵 متصدرين بالفلوس', callback_data: 'rank:money' }],
          [{ text: '🎖️ متصدرين بالمستوى', callback_data: 'rank:level' }],
          [{ text: '🔙 رجوع', callback_data: 'hub:main' }]
        ]
      };
    }

    const users = Array.from(this.users.values()).filter(u => !u.banned);
    const rich = users
      .filter(u => (u.money || 0) > 0)
      .sort((a, b) => (b.money || 0) - (a.money || 0));
    const ranked = users
      .filter(u => (u.xp || 0) > 0 || (u.onlineGames || 0) > 0)
      .sort((a, b) => (b.xp || 0) - (a.xp || 0) || (b.onlineWins || 0) - (a.onlineWins || 0));

    const myRec = this.users.get(String(viewerId));

    // 🎖️ متصدرين بالمستوى — كل بند بسطر مستقل واضح
    if (section === 'level') {
      const top = ranked.slice(0, 5);
      const lines = top.length
        ? top
            .map((u, i) => {
              const p = Economy.levelProgress(u.xp || 0);
              return this.quoteRow(
                i + 1,
                u.name,
                `(مستوى ${p.level} • ${u.xp || 0} XP)`
              );
            }).join('\n')
        : '_لا يوجد متصدرون بالمستوى بعد_';

      const myXp = myRec?.xp || 0;
      const p2 = Economy.levelProgress(myXp);
      const g2 = myRec?.onlineGames || 0;
      const w2 = myRec?.onlineWins || 0;
      const myIdx = myRec ? ranked.findIndex(u => u.id === myRec.id) : -1;

      let cmpLine = '📊 المقارنة: لا يوجد متصدر بعد — العب أول مباراة وتصدّر!';
      if (top.length) {
        if (myIdx === 0) {
          const leadXp = top[1] ? myXp - (top[1].xp || 0) : -1;
          cmpLine = leadXp > 0
            ? `🥇 الصدارة: أنت المركز الأول بفارق *+${leadXp} XP* عن الثاني`
            : `🥇 الصدارة: أنت في المركز الأول بالمستوى!`;
        } else {
          const xpGap = (top[0].xp || 0) - myXp;
          cmpLine = xpGap <= 0 && myXp > 0
            ? `🥇 المقارنة: متعادل مع المركز الأول بـ *${myXp} XP*`
            : `📊 الفرق عن المركز الأول: *${Math.max(1, xpGap)} XP*`;
        }
      }

      const myBlock = [
        `👤 *إحصائيتك ومقارنتك بالمتصدرين:*`,
        this.quoteRow('', myRec?.name || 'أنت'),
        myIdx >= 0 ? `🏅 ترتيبك: *#${myIdx + 1}* من *${ranked.length}*` : `🏅 ترتيبك: غير مصنّف بعد`,
        `🎖️ مستواك: *${p2.level}* (${Economy.levelTitle(p2.level)})`,
        `✨ خبرتك الحالية: *${p2.into}* من *${p2.span} XP*`,
        `⏳ المتبقي للمستوى القادم: *${p2.left} XP*`,
        `🎮 مبارياتك: *${g2}*`,
        `🏆 فوزك: *${w2}*`,
        `🎯 نسبة الفوز: *${this.statPct(w2, g2)}*`,
        cmpLine
      ].join('\n');

      const text = [
        `🎖️ *متصدرين بالمستوى*`,
        lines,
        SEP,
        myBlock
      ].join('\n');

      return {
        text,
        keyboard: [
          [{ text: '💵 متصدرين بالفلوس', callback_data: 'rank:money' }],
          [{ text: '🔙 رجوع', callback_data: 'hub:main' }]
        ]
      };
    }

    // 💰 متصدرين بالفلوس — كل بند بسطر مستقل واضح
    const top = rich.slice(0, 5);
    const lines = top.length
      ? top
          .map((u, i) => {
            const level = Economy.levelFromXp(u.xp || 0);
            return this.quoteRow(i + 1, u.name, `(${Economy.formatMoney(u.money || 0)} 💵 • مستوى ${level})`);
          }).join('\n')
      : '_لا يوجد متصدرون بالفلوس بعد_';

    const myMoney = myRec?.money || 0;
    const myLevel = Economy.levelFromXp(myRec?.xp || 0);
    const myToday = myRec ? Economy.earnedToday(myRec) : 0;
    const myGames = myRec?.onlineGames || 0;
    const myWins = myRec?.onlineWins || 0;
    const myIdx2 = myRec ? rich.findIndex(u => u.id === myRec.id) : -1;

    let cmpLine2 = '📊 المقارنة: لا يوجد متصدر بعد — أول فوز يضعك في الصدارة!';
    if (top.length) {
      if (myIdx2 === 0) {
        const leadMoney = top[1] ? Economy.roundMoney(myMoney - (top[1].money || 0)) : -1;
        cmpLine2 = leadMoney > 0
          ? `🥇 الصدارة: أنت المركز الأول بفارق *${Economy.formatMoney(leadMoney)}* 💵 عن الثاني`
          : `🥇 الصدارة: أنت في المركز الأول بالفلوس!`;
      } else {
        const rawGap = Economy.roundMoney((top[0].money || 0) - myMoney);
        cmpLine2 = rawGap <= 0 && myMoney > 0
          ? `🥇 المقارنة: متعادل مع المركز الأول بـ *${Economy.formatMoney(myMoney)}* 💵`
          : `📊 الفرق عن المركز الأول: *${Economy.formatMoney(Math.max(0.001, rawGap))}* 💵`;
      }
    }

    const myBlock2 = [
      `👤 *إحصائيتك ومقارنتك بالمتصدرين:*`,
      this.quoteRow('', myRec?.name || 'أنت'),
      myIdx2 >= 0 ? `🏅 ترتيبك: *#${myIdx2 + 1}* من *${rich.length}*` : `🏅 ترتيبك: غير مصنّف بعد`,
      `💵 رصيدك الكلي: *${Economy.formatMoney(myMoney)}* 💵`,
      `💰 ربحك اليوم: *${Economy.formatMoney(myToday)}* من *${Economy.formatMoney(Economy.DAILY_MONEY_CAP)}* 💵`,
      `🎖️ مستواك: *${myLevel}* (${Economy.levelTitle(myLevel)})`,
      `🎮 مبارياتك: *${myGames}*`,
      `🏆 فوزك: *${myWins}*`,
      cmpLine2
    ].join('\n');

    const text2 = [
      `💰 *متصدرين بالفلوس*`,
      lines,
      SEP,
      myBlock2
    ].join('\n');

    return {
      text: text2,
      keyboard: [
        [{ text: '🎖️ متصدرين بالمستوى', callback_data: 'rank:level' }],
        [{ text: '🔙 رجوع', callback_data: 'hub:main' }]
      ]
    };
  }

  /** يفتح/يحدّث شاشات الفلوس والمستوى بصيغة MarkdownV2 لدعم الاقتباسات الملوّنة */
  private async handleRanking(cb: TelegramCallbackQuery, section: string) {
    const chatId = String(cb.message?.chat.id || cb.from.id);
    const messageId = cb.message?.message_id;
    this.ensureUser(cb.from.id, cb.from.first_name, cb.from.username);

    const view = this.buildRanking(section || 'money', String(cb.from.id));
    const text = GG.toV2(await this.withBotFooter(view.text, true));

    if (messageId) {
      const res = await this.editMessageText(chatId, messageId, text, view.keyboard, 'MarkdownV2');
      if (res?.ok || String(res?.description || '').includes('not modified')) {
        await this.answerCallbackQuery(cb.id, 'محدّثة ✅');
        return;
      }
    }
    await this.sendMessage(chatId, text, view.keyboard, 'MarkdownV2');
    await this.answerCallbackQuery(cb.id, '');
  }

  private async handleGameStats(cb: TelegramCallbackQuery, section: string) {
    const chatId = String(cb.message?.chat.id || cb.from.id);
    const messageId = cb.message?.message_id;
    this.ensureUser(cb.from.id, cb.from.first_name, cb.from.username);

    const viewerId = cb.message?.chat.type === 'private' ? String(cb.from.id) : '';
    const view = await this.buildGameStats(section || 'main', viewerId);
    const keyboard = this.isOwner(cb.from.id)
      ? view.keyboard
      : view.keyboard
          .map(row => row.filter((b: any) => b.callback_data !== 'admin:panel'))
          .filter(row => row.length);

    const text = GG.toV2(await this.withBotFooter(view.text, true));
    if (messageId) {
      const res = await this.editMessageText(chatId, messageId, text, keyboard, 'MarkdownV2');
      if (res?.ok || String(res?.description || '').includes('not modified')) {
        await this.answerCallbackQuery(cb.id, 'محدّثة ✅');
        return;
      }
    }
    await this.sendMessage(chatId, text, keyboard, 'MarkdownV2');
    await this.answerCallbackQuery(cb.id, '');
  }

  private async buildGamesMenu(section: string, viewer?: BotUserRecord): Promise<{ text: string; keyboard: any[][] }> {
    const botUser = await this.getBotUsername();
    const back = [{ text: '🔙 رجوع', callback_data: 'hub:main' }];

    // 📂 صفحة اختيار نوع الأغاني
    if (section === 'songpick') {
      return {
        text:
          `🎵 *الأغاني*\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `👇 اختار نوع الأغاني لتحويل اللعبة للقناة:`,
        keyboard: [
          [{ text: '🎤 أغاني عربية', switch_inline_query: 'gq song_ar' }],
          [{ text: '🎸 أغاني إنجليزية', switch_inline_query: 'gq song_en' }],
          [{ text: '🔙 رجوع', callback_data: 'hub:g:guess_song' }]
        ]
      };
    }

    // ✊ حجرة ورقة مقص — النظام العادي (اختيار عدد الراوندات القابلة للتحويل فوراً)
    if (section === 'rps_normal') {
      return {
        text:
          `✊ *حجرة ورقة مقص — النظام العادي*\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `🎯 اختار عدد الراوندات لتحويل اللعبة للقناة أو المجموعة:`,
        keyboard: [
          [{ text: '🎮 5 راوندات', switch_inline_query: 'rps 5' }],
          [{ text: '🎮 10 راوندات', switch_inline_query: 'rps 10' }],
          [{ text: '🎮 15 راوند', switch_inline_query: 'rps 15' }],
          [{ text: '🔙 رجوع', callback_data: 'hub:g:rps' }]
        ]
      };
    }

    const normalizedSection = section === 'guess' ? 'group' : section;
    if (GAME_CATEGORIES[normalizedSection]) {
      const cat = GAME_CATEGORIES[normalizedSection];
      const list = BOT_GAMES.filter(g => g.category === normalizedSection);

      // أزرار صغيرة مرتبة: مربعان بكل سطر بدلاً من الأزرار العريضة الطويلة
      const keyboard: any[][] = [];
      for (let i = 0; i < list.length; i += 2) {
        const row: any[] = [
          {
            text: `${list[i].emoji} ${list[i].title}`,
            callback_data: `hub:g:${list[i].id}`
          }
        ];
        if (list[i + 1]) {
          row.push({
            text: `${list[i + 1].emoji} ${list[i + 1].title}`,
            callback_data: `hub:g:${list[i + 1].id}`
          });
        }
        keyboard.push(row);
      }

      keyboard.push(back);

      const text =
        `${cat.emoji} *${cat.title}*\n` +
        `${cat.intro}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `👇 اختار اللعبة:`;

      return { text, keyboard };
    }

    // 🏆 شاشة اختيار سعة البطولة الإقصائية (8 / 16 / 32) للعبة المختارة
    if (section.startsWith('trn:') || section.startsWith('trn_emoji:')) {
      const useEmoji = section.startsWith('trn_emoji:');
      const targetGameId = useEmoji ? section.slice('trn_emoji:'.length) : section.slice('trn:'.length);
      const game = findBotGame(targetGameId);
      if (!game) {
        return {
          text: `ما لكيت هاي اللعبة — ارجع واختار من القائمة.`,
          keyboard: [[{ text: 'رجوع', callback_data: 'hub:main' }]]
        };
      }

      if (game.id === 'guess_song' && !useEmoji) {
        return {
          text:
            `🏆 *نظام البطولات والدوريات — 🎵 الأغاني*\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `خروج المغلوب مثل أدوار كرة القدم تماماً حتى يتوَّج لاعب واحد فقط باللقب!\n` +
            `يشترط عدد زوجي من اللاعبين عند بدء القرعة.\n\n` +
            `👇 اختار نوع الأغاني وسعة البطولة:`,
          keyboard: [
            [
              { text: '🎤 عربي — 8', switch_inline_query: 'trn song_ar 8' },
              { text: '🎤 عربي — 16', switch_inline_query: 'trn song_ar 16' },
              { text: '🎤 عربي — 32', switch_inline_query: 'trn song_ar 32' }
            ],
            [
              { text: '🎸 إنجليزي — 8', switch_inline_query: 'trn song_en 8' },
              { text: '🎸 إنجليزي — 16', switch_inline_query: 'trn song_en 16' },
              { text: '🎸 إنجليزي — 32', switch_inline_query: 'trn song_en 32' }
            ],
            [{ text: '😀 بطولات الإيموجي (8 / 16 / 32)', callback_data: 'hub:trn_emoji:guess_song' }],
            [{ text: '🔙 رجوع للعبة', callback_data: `hub:g:${game.id}` }]
          ]
        };
      }

      let baseKind: GG.QuizKind | null = null;
      if (game.id === 'guess_song') baseKind = 'song_ar';
      else if (game.inline?.startsWith('gq ')) baseKind = game.inline.slice(3).trim() as GG.QuizKind;

      const emojiVariant = baseKind ? GG.EMOJI_VARIANT_OF[baseKind] : undefined;
      const disc: TRN.TournamentDiscipline =
        game.id === 'rps'
          ? 'rps'
          : useEmoji && emojiVariant
            ? emojiVariant
            : baseKind || 'general';

      const kb: any[][] = [
        [{ text: '🥇 دوري الـ 8 لاعبين', switch_inline_query: `trn ${disc} 8` }],
        [{ text: '🥈 دوري الـ 16 لاعباً', switch_inline_query: `trn ${disc} 16` }],
        [{ text: '👑 دوري الـ 32 لاعباً', switch_inline_query: `trn ${disc} 32` }]
      ];
      if (!useEmoji && emojiVariant) {
        kb.push([{ text: '😀 بطولات نظام الإيموجي (8 / 16 / 32)', callback_data: `hub:trn_emoji:${game.id}` }]);
      } else if (useEmoji) {
        kb.push([{ text: '🏆 رجوع لبطولات النظام العادي', callback_data: `hub:trn:${game.id}` }]);
      }
      kb.push([{ text: '🔙 رجوع للعبة', callback_data: `hub:g:${game.id}` }]);

      const modeTag = useEmoji ? ' (نظام الإيموجي 😀)' : '';
      return {
        text:
          `🏆 *نظام البطولات والدوريات — ${game.emoji} ${game.title}${modeTag}*\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `يتواجه كل لاعبين اثنين وجهاً لوجه بنظام خروج المغلوب مثل أدوار كرة القدم تماماً:\n` +
          `🏟️ دور الـ 32 ⬅️ دور الـ 16 ⬅️ ربع النهائي ⬅️ نصف النهائي ⬅️ النهائي الكبير 🏆\n` +
          `يشترط اكتمال *عدد زوجي* من اللاعبين لبدء القرعة، ويتوَّج *لاعب واحد فقط* بطلاً في النهاية!\n\n` +
          `👇 اختار حجم البطولة للإرسال للقناة أو المجموعة:`,
        keyboard: kb
      };
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

      const gqKind: GG.QuizKind | null =
        game.id === 'guess_song'
          ? 'song_ar'
          : game.inline?.startsWith('gq ')
            ? (game.inline.slice(3).trim() as GG.QuizKind)
            : null;
      const emojiKind: GG.QuizKind | undefined = gqKind ? GG.EMOJI_VARIANT_OF[gqKind] : undefined;
      const supportsMultiMode = Boolean(gqKind || game.id === 'rps');

      const lines = [`${game.emoji} *${game.title}*`];

      if (game.ready) {
        if (game.players) lines.push(game.players);
        if (supportsMultiMode) {
          lines.push(`⚙️ *اختر نظام نوع اللعب:* 👇`);
        }
      } else {
        lines.push('قريباً');
      }

      const keyboard: any[][] = [];

      if (game.ready) {
        // ── أنظمة نوع اللعب للألعاب المتوافقة (عادي | بطولات 8/16/32 | إيموجي) ──
        if (game.channel) {
          if (game.id === 'guess_song') {
            keyboard.push([{ text: '🎮 النظام العادي (العب بالقناة)', callback_data: 'hub:songpick' }]);
            keyboard.push([{ text: '🏆 نظام البطولات والدوريات (8 / 16 / 32)', callback_data: `hub:trn:${game.id}` }]);
            if (emojiKind) {
              keyboard.push([{ text: '😀 نظام الإيموجي (العب بالقناة)', switch_inline_query: `gq ${emojiKind}` }]);
            }
          } else if (gqKind && game.inline) {
            keyboard.push([{ text: '🎮 النظام العادي (العب بالقناة)', switch_inline_query: game.inline }]);
            keyboard.push([{ text: '🏆 نظام البطولات والدوريات (8 / 16 / 32)', callback_data: `hub:trn:${game.id}` }]);
            if (emojiKind) {
              keyboard.push([{ text: '😀 نظام الإيموجي (العب بالقناة)', switch_inline_query: `gq ${emojiKind}` }]);
            }
          } else if (game.id === 'rps') {
            keyboard.push([{ text: '🎮 النظام العادي', callback_data: 'hub:rps_normal' }]);
            keyboard.push([{ text: '🏆 نظام البطولات', callback_data: 'hub:trn:rps' }]);
          } else if (game.inline) {
            keyboard.push([{ text: '🎮 العب بالقناة', switch_inline_query: game.inline }]);
          } else {
            keyboard.push([{ text: '🎮 العب بالقناة', switch_inline_query: 'cn' }]);
          }
          if (game.play) {
            keyboard.push([{ text: game.play.label, callback_data: game.play.data }]);
          }
        } else {
          keyboard.push([{ text: '🎮 العب بالقناة', callback_data: `hub:chpick:${game.id}` }]);
          if (game.play) {
            keyboard.push([{ text: game.play.label, callback_data: game.play.data }]);
          }
        }

        // ── المربعين جنب بعض: شرح + إحصائيات ──
        keyboard.push([
          { text: '📖 شرح اللعبة', callback_data: `hub:how:${game.id}` },
          { text: '📊 إحصائيات اللعبة', callback_data: `gstat:g:${game.id}` }
        ]);
      }

      // ── آخر زر (عريض): الخروج من القسم — يرجعك خطوة ──
      keyboard.push([{ text: '🔙 الخروج من القسم', callback_data: `hub:${game.category}` }]);

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
        { text: '🔥 ألعاب ثلاثية 3v3', callback_data: 'hub:team3' },
        { text: '🏰 ألعاب رباعية 4v4', callback_data: 'hub:team4' }
      ],
      [{ text: '🎉 الألعاب الجماعية', callback_data: 'hub:group' }]
    ];
    // 💵 المتصدرون + خدمات أخرى، وتحتهم ارفع البوت مشرف بقناتك، وتحتهم القناة العريض
    keyboard.push([
      { text: '🏅 المتصدرون', callback_data: 'rank:menu' },
      { text: '✨ خدمات أخرى', callback_data: 'svc:main' }
    ]);
    if (botUser) {
      keyboard.push([
        {
          text: '🛡️ ارفع البوت مشرف بقناتك',
          url: `https://t.me/${botUser}?startchannel=true`
        }
      ]);
    }
    keyboard.push([
      { text: '📢 القناة', url: 'https://t.me/pleasegodimtired' }
    ]);
    return { text, keyboard };
  }

  /** اختيار القناة مباشرة يفتح picker القنوات فوراً */
  private async sendChannelKeyboard(chatId: string) {
    // ملاحظة: request_chat يشتغل بس داخل ReplyKeyboard (مو inline)
    const keyboard = [
      [
        {
          text: '📢 اختيار القناة ونشر اللعبة',
          request_chat: {
            request_id: 1001,
            chat_is_channel: true,
            bot_is_member: false
          }
        }
      ]
    ];
    await this.sendMessageRaw(chatId, '📢 اضغط الزر تحت لاختيار قناتك:', {
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
    const isChannel = Boolean(cb.message?.chat && cb.message.chat.type !== 'private');
    const scopeId = isChannel ? String(cb.message!.chat.id) : String(cb.from.id);
    const userId = String(cb.from.id);

    if (key === 'new') {
      const previous = this.wordle.get(scopeId);
      const fresh = Wordle.createGame(previous?.target);
      this.setWordle(scopeId, fresh);
      if (isChannel) {
        const sent = await this.sendMessage(
          scopeId,
          await this.withBotFooter(Wordle.renderMessage(fresh)),
          Wordle.keyboard(fresh)
        );
        if (!sent?.ok) {
          await this.paintWordle(cb, fresh);
        }
      } else {
        await this.paintWordle(cb, fresh);
      }
      await this.answerCallbackQuery(cb.id, '🟩 كلمة جديدة — بالتوفيق!');
      return;
    }

    let game = this.wordle.get(scopeId);
    if (!game) {
      game = Wordle.createGame();
      this.setWordle(scopeId, game);
    }

    if (key === 'del') {
      const next = Wordle.deleteLetter(game);
      this.setWordle(scopeId, next);
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
      this.setWordle(scopeId, next);

      if (!game.done && next.done) {
        const rec = this.ensureUser(userId, cb.from.first_name, cb.from.username);
        if (rec) {
          rec.wordleGames = (rec.wordleGames || 0) + 1;
          rec.onlineGames = (rec.onlineGames || 0) + 1;
          if (next.won) {
            rec.points = (rec.points || 0) + Wordle.pointsFor(next.guesses.length);
            rec.wordleWins = (rec.wordleWins || 0) + 1;
            rec.onlineWins = (rec.onlineWins || 0) + 1;
            const perf = Math.min(1, Math.max(0.4, (7 - next.guesses.length) / 6));
            const money = Economy.moneyForWin({
              gameId: 'wordle',
              performance: perf,
              level: Economy.levelFromXp(rec.xp || 0),
              opponentLevel: Economy.levelFromXp(rec.xp || 0),
              earnedToday: Economy.earnedToday(rec)
            });
            if (money > 0) {
              rec.money = Economy.roundMoney((rec.money || 0) + money);
              Economy.addEarned(rec, money);
            }
            rec.xp = (rec.xp || 0) + Economy.xpForResult('wordle', true, perf);
          } else {
            rec.xp = (rec.xp || 0) + Economy.xpForResult('wordle', false, 0.4);
          }
          this.users.set(rec.id, rec);
        }
      }
      await this.paintWordle(cb, next, next.done && next.won ? cb.from.first_name : undefined);
      await this.answerCallbackQuery(cb.id, next.won ? '🎉 حليتها!' : next.done ? '😅 خلصت المحاولات' : '');
      return;
    }

    const next = Wordle.addLetter(game, key);
    this.setWordle(scopeId, next);
    await this.paintWordle(cb, next);
    await this.answerCallbackQuery(cb.id, '');
  }

  /** يعرض/يحدّث لوحة «خمّن الكلمة» داخل الرسالة نفسها */
  private async paintWordle(cb: TelegramCallbackQuery, state: Wordle.WordleState, solverName?: string) {
    const chatId = String(cb.message?.chat.id || cb.from.id);
    const messageId = cb.message?.message_id;
    let text = Wordle.renderMessage(state);

    if (state.done && solverName) {
      text += `\n\n🏆 *الفائز:*\n${this.quoteRow('', solverName)}`;
    }

    const useV2 = Boolean(state.done && solverName);
    const fullText = await this.withBotFooter(text, useV2);
    const wireText = useV2 ? GG.toV2(fullText) : fullText;
    const mode = useV2 ? 'MarkdownV2' : 'Markdown';
    if (messageId) {
      await this.editMessageText(chatId, messageId, wireText, Wordle.keyboard(state), mode);
    } else {
      await this.sendMessage(chatId, wireText, Wordle.keyboard(state), mode);
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
      await this.answerCallbackQuery(cb.id, 'اضغط «🎭 الشعراء» من قائمة الألعاب.', true);
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
      const rec = this.ensureUser(userId, cb.from.first_name, cb.from.username);
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

  // ---------------------------------------------------------------------
  // 🎵 خمّن الأغنية
  // ---------------------------------------------------------------------

  /** زر من أزرار «خمّن الأغنية» */
  private async handleSongKey(cb: TelegramCallbackQuery, key: string) {
    const userId = String(cb.from.id);

    if (key === 'new') {
      const previous = this.song.get(userId);
      const fresh = Song.createRound(previous?.snippet);
      this.song.set(userId, fresh);
      await this.paintSong(cb, fresh);
      await this.answerCallbackQuery(cb.id, '🎵 أغنية جديدة — منو المطرب؟');
      return;
    }

    if (key === 'noop') {
      await this.answerCallbackQuery(cb.id, '❌ هذا الخيار غلط — اختار غيره.', true);
      return;
    }

    const round = this.song.get(userId);
    if (!round) {
      await this.answerCallbackQuery(cb.id, 'اضغط «🎵 الأغاني» من قائمة الألعاب.', true);
      return;
    }

    const index = Number(key);
    if (!Number.isFinite(index)) {
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    const wasDone = round.done;
    const next = Song.answer(round, index);
    this.song.set(userId, next);

    if (!wasDone && next.done) {
      const rec = this.ensureUser(userId, cb.from.first_name, cb.from.username);
      if (rec) {
        rec.guessSongGames = (rec.guessSongGames || 0) + 1;
        if (next.won) {
          rec.guessSongWins = (rec.guessSongWins || 0) + 1;
          rec.points = (rec.points || 0) + Song.pointsFor(next);
        }
        this.users.set(rec.id, rec);
      }
    }

    await this.paintSong(cb, next);

    if (next.done) {
      await this.answerCallbackQuery(cb.id, next.won ? '🎉 عرفتها!' : '😅 الجواب كان: ' + next.answer);
    } else if (next.wrong.length) {
      await this.answerCallbackQuery(cb.id, '❌ غلط — بقيتلك محاولة وحدة!', true);
    } else {
      await this.answerCallbackQuery(cb.id, '');
    }
  }

  /** يعرض/يحدّث لوحة «خمّن الأغنية» */
  private async paintSong(cb: TelegramCallbackQuery, round: Song.SongRound) {
    const chatId = String(cb.message?.chat.id || cb.from.id);
    const messageId = cb.message?.message_id;
    let text = Song.renderMessage(round);

    if (round.done) {
      const rec = this.users.get(String(cb.from.id));
      const gained = Song.pointsFor(round);
      const total = rec?.points || 0;
      text += round.won
        ? `\n\n🏆 *نقاطك:* ${total} _(+${gained})_`
        : `\n\n🏆 *نقاطك:* ${total}\n_الله يعوّضك — جرّب أغنية ثانية!_`;
    }

    if (messageId) {
      await this.editMessageText(chatId, messageId, text, Song.keyboard(round));
    } else {
      await this.sendMessage(chatId, text, Song.keyboard(round));
    }
  }

  // ---------------------------------------------------------------------
  // 🔢 تحدي الحساب
  // ---------------------------------------------------------------------

  /** زر من أزرار «تحدي الحساب» */
  private async handleMathKey(cb: TelegramCallbackQuery, key: string) {
    const userId = String(cb.from.id);

    if (key === 'new') {
      const fresh = MathGame.createGame();
      this.mathGames.set(userId, fresh);
      await this.paintMath(cb, fresh);
      await this.answerCallbackQuery(cb.id, '🔢 يلا — أسرع بالحساب!');
      return;
    }

    const round = this.mathGames.get(userId);
    if (!round) {
      await this.answerCallbackQuery(cb.id, 'اضغط «🔢 تحدي الحساب» من قائمة الألعاب.', true);
      return;
    }

    const value = Number(key);
    if (!Number.isFinite(value)) {
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    const wasDone = round.done;
    const { state: next, correct } = MathGame.answer(round, value);
    this.mathGames.set(userId, next);

    if (!wasDone && next.done) {
      const rec = this.ensureUser(userId, cb.from.first_name, cb.from.username);
      if (rec) {
        rec.mathGames = (rec.mathGames || 0) + 1;
        if (next.won) {
          rec.mathWins = (rec.mathWins || 0) + 1;
          rec.points = (rec.points || 0) + MathGame.pointsFor(next);
        }
        this.users.set(rec.id, rec);
      }
    }

    await this.paintMath(cb, next);

    if (next.done) {
      await this.answerCallbackQuery(cb.id, next.won ? '🏆 فزت! 🎉' : '😅');
    } else {
      await this.answerCallbackQuery(cb.id, correct ? '✅ صح!' : '❌ غلط!', !correct);
    }
  }

  /** يعرض/يحدّث لوحة «تحدي الحساب» */
  private async paintMath(cb: TelegramCallbackQuery, round: MathGame.MathRound) {
    const chatId = String(cb.message?.chat.id || cb.from.id);
    const messageId = cb.message?.message_id;
    let text = MathGame.renderMessage(round);

    if (round.done && round.won) {
      const rec = this.users.get(String(cb.from.id));
      text += `\n\n🏆 *نقاطك:* ${rec?.points || 0}`;
    }

    if (messageId) {
      await this.editMessageText(chatId, messageId, text, MathGame.keyboard(round));
    } else {
      await this.sendMessage(chatId, text, MathGame.keyboard(round));
    }
  }



  // ---------------------------------------------------------------------
  // 🤝 «منو يعرف الثاني أكثر؟» — هيكل خاص كامل (قناة + رسائل بالخاص + كشف البطاقات)
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // ✨ الخدمات الإضافية: 🤫 همسة | 📥 تحميل سوشيال ميديا | 🎵 الأغاني («يوت»)
  // ---------------------------------------------------------------------

  private async handleExtraServicesCb(cb: TelegramCallbackQuery, data: string) {
    const userId = String(cb.from.id);
    const userName = cb.from.first_name + (cb.from.last_name ? ` ${cb.from.last_name}` : '');
    const chatId = String(cb.message?.chat.id || userId);
    const messageId = cb.message?.message_id;
    const SEP = '━━━━━━━━━━━━━━━━━━━';

    // ── 1) فتح همسة منشورة بالكروب أو القناة (تعمل للرسائل العادية ورسائل الإنلاين!) ──
    if (data.startsWith('wh:open:')) {
      const whId = data.slice(8).trim();
      const wh = this.whispers.get(whId);
      if (!wh) {
        await this.answerCallbackQuery(cb.id, '⚠️ انتهت صلاحية هذه الهمسة.', true);
        return;
      }

      const res = MS.attemptOpenWhisper(wh, {
        id: userId,
        name: userName,
        username: cb.from.username
      });
      this.whispers.set(wh.id, wh);

      // تحديث بطاقة الهمسة فوراً لإظهار اسم القارئ داخل البطاقة وعلى الزر (وكذلك عند القفل)
      if (res.shouldUpdateCard) {
        const updatedText = MS.renderWhisperCardText(wh);
        const updatedKb = MS.whisperCardKeyboard(wh);
        if (cb.inline_message_id) {
          await this.editInlineMessageText(cb.inline_message_id, updatedText, updatedKb, 'MarkdownV2');
        } else if (cb.message?.chat?.id && cb.message?.message_id) {
          await this.editMessageText(
            String(cb.message.chat.id),
            cb.message.message_id,
            updatedText,
            updatedKb,
            'MarkdownV2'
          );
        }
      }

      // إرسال إشعار فوري بالخاص لصاحب الهمسة يوضّح منو فتحها ومحتواها وحالتها
      if (res.shouldNotifyCreator) {
        const notifText = MS.buildWhisperOwnerNotificationV2(wh, {
          id: userId,
          name: userName,
          username: cb.from.username
        });
        await this.sendMessage(wh.creatorId, notifText, undefined, 'MarkdownV2');
      }

      await this.answerCallbackQuery(cb.id, res.popupText, true);
      return;
    }

    // ── 2) اختيار أغنية من نتائج أمر «يوت» → إرسال ملف صوتي صافي فقط (أغنية وبس!) ──
    if (data.startsWith('yts:')) {
      const parts = data.split(':');
      const searchKey = parts[1] || '';
      const idx = parseInt(parts[2] || '0', 10);
      const list = this.songSearches.get(searchKey);
      const hit = list?.[idx];
      if (!hit) {
        await this.answerCallbackQuery(cb.id, '⚠️ انتهت صلاحية البحث — اكتب «يوت» واسم الأغنية من جديد.', true);
        return;
      }

      await this.answerCallbackQuery(cb.id, '🎶 جاري تجهيز الأغنية...');
      if (messageId) {
        await this.editMessageText(chatId, messageId, `⏳ جاري إرسال الأغنية: *${this.mdSafe(hit.title)}* ...`);
      }

      let audioPayload = await MS.resolveSongAudioPayload(hit);
      let sentOk = audioPayload ? await this.sendAudioPayload(chatId, audioPayload, hit.title, hit.artist) : false;

      // تعويض تلقائي متعدد المستويات: نجرب SoundCloud المطابق ثم البدائل الأخرى في نفس القائمة تلقائياً!
      if (!sentOk && !hit.videoId.startsWith('sc:')) {
        const scBackup = await MS.resolveFallbackSongFromSoundCloud(hit);
        if (scBackup) {
          sentOk = await this.sendAudioPayload(chatId, scBackup, hit.title, hit.artist);
        }
      }
      if (!sentOk && list) {
        for (let altIdx = 0; altIdx < list.length && !sentOk; altIdx++) {
          if (altIdx === idx) continue;
          const altPayload = await MS.resolveSongAudioPayload(list[altIdx]);
          if (altPayload) {
            sentOk = await this.sendAudioPayload(chatId, altPayload, hit.title, hit.artist);
          }
        }
      }

      if (sentOk) {
        if (messageId) {
          await this.deleteMessage(chatId, messageId);
        }
      } else if (messageId) {
        await this.editMessageText(
          chatId,
          messageId,
          '⚠️ تعذّر إرسال هذه النسخة حالياً — جرّب اختيار نتيجة ثانية من القائمة.'
        );
      }
      return;
    }

    if (data.startsWith('svc:')) {
      this.pendingWhispers.delete(userId);
      this.pendingSocialDl.delete(userId);
      this.pendingAgeCalc.delete(userId);
      this.pendingRouletteText.delete(userId);
      this.pendingConvert.delete(userId);
      this.audioEditDrafts.delete(userId);
      this.pendingVocalSep.delete(userId);
    }

    // ── القائمة الرئيسية للخدمات الأخرى ──
    if (data === 'svc:main') {
      const text =
        `✨ *خدمات أخرى*\n` +
        `${SEP}\n` +
        `اختر الخدمة 👇`;
      const keyboard = [
        [
          { text: '🤫 همسة', callback_data: 'svc:whisper' },
          { text: '📥 تحميل سوشيال', callback_data: 'svc:dl' }
        ],
        [
          { text: '🎵 الأغاني', callback_data: 'svc:songs' },
          { text: '🎰 روليت', callback_data: 'svc:roulette' }
        ],
        [
          { text: '🔄 تحويل الصيغ', callback_data: 'svc:convert' },
          { text: '🎼 عزل الموسيقى', callback_data: 'svc:vocal' }
        ],
        [{ text: '🎂 حساب العمر', callback_data: 'svc:age' }],
        [{ text: '🔙 رجوع', callback_data: 'hub:main' }]
      ];
      if (messageId) await this.editMessageText(chatId, messageId, await this.withBotFooter(text), keyboard);
      else await this.sendMessage(chatId, await this.withBotFooter(text), keyboard);
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    // ── قائمة إنشاء همسة جديدة ──
    if (data === 'svc:whisper') {
      const text =
        `🤫 *إنشاء همسة سرية*\n` +
        `${SEP}\n` +
        `اختر لمن تريد توجيه الهمسة، وستصلك رسالة فورية من البوت تخبرك بمن فتحها مع محتوى الهمسة 👇`;
      const keyboard = [
        [
          { text: '👤 لشخص واحد', callback_data: 'wh:m:1' },
          { text: '👥 لشخصين', callback_data: 'wh:m:2' }
        ],
        [
          { text: '👥 لـ 3 أشخاص', callback_data: 'wh:m:3' },
          { text: '👥 لـ 4 أشخاص', callback_data: 'wh:m:4' }
        ],
        [
          { text: '👥 لـ 5 أشخاص', callback_data: 'wh:m:5' },
          { text: '🌍 للجميع', callback_data: 'wh:m:all' }
        ],
        [{ text: '⚡ لأول شخص فقط (تقفل بعده)', callback_data: 'wh:m:first' }],
        [{ text: '🔙 رجوع', callback_data: 'svc:main' }]
      ];
      if (messageId) await this.editMessageText(chatId, messageId, text, keyboard);
      else await this.sendMessage(chatId, text, keyboard);
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    // ── اختيار نوع الهمسة ──
    if (data.startsWith('wh:m:')) {
      const mode = data.slice(5) as MS.WhisperMode;
      this.pendingSocialDl.delete(userId);
      this.pendingWhispers.set(userId, { step: 'awaiting_text', mode });
      const text =
        `🤫 *همسة جديدة — ${MS.whisperModeLabel(mode)}*\n` +
        `${SEP}\n` +
        `✍️ اكتب الآن *نص الهمسة* وأرسله هنا بالمحادثة:`;
      const keyboard = [[{ text: '🔙 إلغاء ورجوع', callback_data: 'svc:whisper' }]];
      if (messageId) await this.editMessageText(chatId, messageId, text, keyboard);
      else await this.sendMessage(chatId, text, keyboard);
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    // ── تخطي تحديد اليوزرات (لأول N أشخاص يفتحوها) ──
    if (data === 'wh:notarget') {
      const draft = this.pendingWhispers.get(userId);
      if (!draft || !draft.text) {
        await this.answerCallbackQuery(cb.id, 'اكتب نص الهمسة أولاً.', true);
        return;
      }
      this.pendingWhispers.delete(userId);
      const wh = MS.createWhisperRecord({
        creatorId: userId,
        creatorName: userName,
        creatorUsername: cb.from.username,
        mode: draft.mode,
        text: draft.text,
        allowedTargets: []
      });
      this.whispers.set(wh.id, wh);
      const readyText =
        `✅ *همستك جاهزة للإرسال!*\n` +
        `${SEP}\n` +
        `🔐 *النوع:* ${MS.whisperModeLabel(wh.mode)}\n` +
        `💬 *المحتوى:* «${this.mdSafe(wh.text)}»\n\n` +
        `👇 اضغط الزر بالأسفل لاختيار الكروب أو القناة وإرسالها فوراً:`;
      const readyKb = [
        [{ text: '📤 إرسال الهمسة للكروب أو القناة', switch_inline_query: `wh:${wh.id}` }],
        [{ text: '🤫 إنشاء همسة أخرى', callback_data: 'svc:whisper' }],
        [{ text: '🔙 رجوع', callback_data: 'svc:main' }]
      ];
      if (messageId) await this.editMessageText(chatId, messageId, readyText, readyKb);
      else await this.sendMessage(chatId, readyText, readyKb);
      await this.answerCallbackQuery(cb.id, '✅ جاهزة للإرسال!');
      return;
    }

    // ── قائمة التحميل من السوشيال ميديا ──
    if (data === 'svc:dl') {
      const text =
        `📥 *التحميل من السوشيال ميديا*\n` +
        `${SEP}\n` +
        `اختر المنصة التي تريد تحميل المنشور منها 👇`;
      const keyboard = [
        [
          { text: '▶️ تحميل من يوتيوب', callback_data: 'dl:yt' },
          { text: '📌 تحميل من بنترست', callback_data: 'dl:pin' }
        ],
        [
          { text: '🎵 تحميل من تيك توك', callback_data: 'dl:tt' },
          { text: '📸 تحميل من إنستغرام', callback_data: 'dl:ig' }
        ],
        [{ text: '🔙 رجوع', callback_data: 'svc:main' }]
      ];
      if (messageId) await this.editMessageText(chatId, messageId, text, keyboard);
      else await this.sendMessage(chatId, text, keyboard);
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    // ── مسح جميع رسائل الميديا والروابط المحمّلة لتخفيف الضغط والحفاظ على سرعة البوت ──
    if (data === 'dl:clean') {
      const tracked = this.mediaSessionMsgs.get(userId) || [];
      const toDelete = new Set<number>(tracked);
      if (messageId) toDelete.add(messageId);
      this.mediaSessionMsgs.delete(userId);
      await this.answerCallbackQuery(cb.id, '🗑️ تم مسح الميديا والروابط المحمّلة بنجاح!', false);
      await Promise.allSettled(Array.from(toDelete).map(mid => this.deleteMessage(chatId, mid)));
      return;
    }

    // ── تحميل فيديو يوتيوب بدقة عالية HD (1080p / 720p) حتى لو تجاوز 50MB ──
    if (data.startsWith('ytq:hd:')) {
      const videoId = data.slice('ytq:hd:'.length).trim();
      const lockKey = `hd:${userId}`;
      if (this.activeSocialDownloads.has(lockKey)) {
        await this.answerCallbackQuery(cb.id, '⏳ جاري تجهيز نسخة HD بالفعل، انتظر لحظات...', false);
        return;
      }
      this.activeSocialDownloads.add(lockKey);
      await this.answerCallbackQuery(cb.id, '🎬 جاري تجهيز النسخة عالية الدقة HD...');

      const waitMsg = await this.sendMessage(chatId, '⏳ جاري استخراج وتحميل النسخة عالية الدقة *HD* ...');
      const waitMsgId = waitMsg?.result?.message_id;

      await this.acquireDownloadSlot();
      try {
        const hdRes = await MS.extractYouTubeHighDefinition(videoId);
        if (waitMsgId) await this.deleteMessage(chatId, waitMsgId);

        if (!hdRes.ok || !hdRes.items.length) {
          const errSent = await this.sendMessage(
            chatId,
            hdRes.error || '⚠️ تعذّر استخراج نسخة HD حالياً — حاول مجدداً بعد لحظات.'
          );
          if (errSent?.result?.message_id) this.trackMediaMsg(userId, errSent.result.message_id);
          return;
        }

        const hdItem = hdRes.items[0];
        let deliveredInline = false;
        if (!hdItem.oversized) {
          const sentId = await this.sendMediaBinaryOrUrl(
            chatId,
            'video',
            hdItem.url,
            hdItem.headers,
            hdItem.bytes
          );
          hdItem.bytes = undefined;
          if (sentId) {
            this.trackMediaMsg(userId, sentId);
            deliveredInline = true;
          }
        } else {
          hdItem.bytes = undefined;
        }

        const qBadge = hdItem.quality ? `${hdItem.quality}p ` : '';
        const sizeNote = hdItem.sizeMB ? ` (${hdItem.sizeMB} MB)` : '';
        const kb: any[][] = [];
        if (!deliveredInline) {
          kb.push([{ text: `📥 تنزيل نسخة ${qBadge}HD الكاملة مباشرة${sizeNote}`, url: hdItem.url }]);
        }
        kb.push([{ text: '🗑️ مسح الميديا المحمّلة', callback_data: 'dl:clean' }]);
        kb.push([
          { text: '📥 تحميل منشور آخر', callback_data: 'svc:dl' },
          { text: '🔙 خدمات أخرى', callback_data: 'svc:main' }
        ]);

        const doneMsg = await this.sendMessage(
          chatId,
          deliveredInline
            ? `🎬 *تم إرسال النسخة عالية الدقة (${qBadge}HD) بنجاح!*\n\n` +
                `💡 _ملاحظة: بعد حفظ الفيديو بجهازك، ننصحك بالضغط على «🗑️ مسح الميديا المحمّلة» لحذف الرسائل والوسائط المنتهية والحفاظ على خفة وسرعة البوت للجميع._`
            : `🎬 *النسخة عالية الدقة (${qBadge}HD) جاهزة للتحميل الكامل${sizeNote}!*\n` +
                `بما أن حجم النسخة يتجاوز سقف الرفع المباشر في تيليجرام (50MB)، اضغط الزر أدناه لتنزيل الملف الكامل بأقصى سرعة مباشرة إلى جهازك:\n\n` +
                `💡 _ملاحظة: بعد إتمام التنزيل، ننصحك بالضغط على «🗑️ مسح الميديا المحمّلة» لحذف الروابط والرسائل المنتهية والحفاظ على خفة وسرعة البوت._`,
          kb
        );
        if (doneMsg?.result?.message_id) this.trackMediaMsg(userId, doneMsg.result.message_id);
      } finally {
        this.releaseDownloadSlot();
        this.activeSocialDownloads.delete(lockKey);
      }
      return;
    }

    // ── اختيار منصة التحميل ──
    if (data.startsWith('dl:')) {
      const platform = data.slice(3) as MS.SocialPlatform;
      this.pendingWhispers.delete(userId);
      this.pendingSocialDl.set(userId, platform);
      const text =
        `📥 *التحميل من ${MS.socialPlatformLabel(platform)}*\n` +
        `${SEP}\n` +
        `🔗 أرسل الآن *رابط المنشور* هنا بالمحادثة ليتم تحميله وإرساله لك مباشرة 👇`;
      const keyboard = [[{ text: '🔙 رجوع للمنصات', callback_data: 'svc:dl' }]];
      if (messageId) {
        await this.editMessageText(chatId, messageId, text, keyboard);
        this.trackMediaMsg(userId, messageId);
      } else {
        const promptSent = await this.sendMessage(chatId, text, keyboard);
        if (promptSent?.result?.message_id) this.trackMediaMsg(userId, promptSent.result.message_id);
      }
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    // ── 🎵 البحث عن الأغاني ──
    if (data === 'svc:songs') {
      const text =
        `🎵 *البحث عن الأغاني*\n` +
        `${SEP}\n` +
        `اكتب \`يوت + اسم الأغنية\` للبحث والتحميل.`;
      const keyboard = [[{ text: '🔙 رجوع', callback_data: 'svc:main' }]];
      if (messageId) await this.editMessageText(chatId, messageId, text, keyboard);
      else await this.sendMessage(chatId, text, keyboard);
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    // ── 🎰 الروليت (سحب القنوات التفاعلي + قرعة الأسماء السريعة) ──
    if (data === 'svc:roulette') {
      const text =
        `🎰 *الروليت*\n` +
        `${SEP}\n` +
        `اختر نوع الروليت 👇`;
      const keyboard = [
        [{ text: '📢 نشر روليت بالقناة أو الكروب', switch_inline_query: 'roulette' }],
        [{ text: '📝 قرعة أسماء سريعة', callback_data: 'svc:roulette_list' }],
        [{ text: '🔙 رجوع', callback_data: 'svc:main' }]
      ];
      if (messageId) await this.editMessageText(chatId, messageId, text, keyboard);
      else await this.sendMessage(chatId, text, keyboard);
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    if (data === 'svc:roulette_list') {
      this.pendingRouletteText.add(userId);
      const text =
        `📝 *قرعة أسماء سريعة*\n` +
        `${SEP}\n` +
        `أرسل الأسماء أو الخيارات (كل اسم بسطر أو بينها فواصل) 👇`;
      const keyboard = [[{ text: '🔙 رجوع', callback_data: 'svc:roulette' }]];
      if (messageId) await this.editMessageText(chatId, messageId, text, keyboard);
      else await this.sendMessage(chatId, text, keyboard);
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    if (data === 'rltl:spin') {
      const saved = this.privateRouletteLists.get(userId);
      if (!saved || saved.length < 2) {
        await this.answerCallbackQuery(cb.id, 'أرسل قائمة الأسماء أولاً.', true);
        return;
      }
      const winner = EXT.pickRandomFromChoices(saved);
      await this.answerCallbackQuery(cb.id, `🎉 الفائز: ${winner}`);
      const text =
        `🎰 *نتيجة الروليت*\n` +
        `${SEP}\n` +
        `👥 العدد: *${saved.length}*\n` +
        `🏆 *الفائز:* *${this.mdSafe(winner)}*`;
      const keyboard = [
        [{ text: '🔄 تدوير مرة ثانية', callback_data: 'rltl:spin' }],
        [{ text: '📝 قائمة جديدة', callback_data: 'svc:roulette_list' }],
        [{ text: '🔙 خدمات أخرى', callback_data: 'svc:main' }]
      ];
      if (messageId) await this.editMessageText(chatId, messageId, text, keyboard);
      else await this.sendMessage(chatId, text, keyboard);
      return;
    }

    // ── 🔄 تحويل الصيغ وتعديل معلومات الصوتيات ──
    if (data === 'svc:convert') {
      this.pendingConvert.set(userId, { fileId: '', kind: 'waiting' });
      const text =
        `🔄 *تحويل الصيغ وتعديل الصوتيات*\n` +
        `${SEP}\n` +
        `أرسل الآن الملف هنا بالمحادثة:\n` +
        `• 🎵 أغنية أو 🎙️ بصمة ⬅️ تحويل الصيغة أو *تعديل الاسم والفنان والملف والصورة*\n` +
        `• 🎬 فيديو ⬅️ صوت / بصمة / GIF\n` +
        `• 🖼️ صورة ⇄ ✨ ملصق / 📑 PDF\n` +
        `• 🎞️ متحركة GIF ⬅️ 🎬 فيديو`;
      const keyboard = [[{ text: '🔙 رجوع', callback_data: 'svc:main' }]];
      if (messageId) await this.editMessageText(chatId, messageId, text, keyboard);
      else await this.sendMessage(chatId, text, keyboard);
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    if (data.startsWith('conv:')) {
      await this.executeFormatConversion(cb, data.slice(5));
      return;
    }

    // ── 🎼 عزل الموسيقى عن الأغنية ──
    if (data === 'svc:vocal') {
      this.pendingVocalSep.add(userId);
      const text =
        `🎼 *عزل الموسيقى عن الأغنية*\n` +
        `${SEP}\n` +
        `أرسل الآن *ملف الأغنية / الفيديو / البصمة* أو اكتب *اسم الأغنية* ليتم فصل الصوت عن الموسيقى 👇`;
      const keyboard = [[{ text: '🔙 رجوع', callback_data: 'svc:main' }]];
      if (messageId) await this.editMessageText(chatId, messageId, text, keyboard);
      else await this.sendMessage(chatId, text, keyboard);
      await this.answerCallbackQuery(cb.id, '');
      return;
    }

    // ── 🎂 حساب العمر ──
    if (data === 'svc:age') {
      this.pendingAgeCalc.add(userId);
      const text =
        `🎂 *حساب العمر*\n` +
        `${SEP}\n` +
        `أرسل تاريخ ميلادك — مثال: \`15/8/2003\` 👇`;
      const keyboard = [[{ text: '🔙 رجوع', callback_data: 'svc:main' }]];
      if (messageId) await this.editMessageText(chatId, messageId, text, keyboard);
      else await this.sendMessage(chatId, text, keyboard);
      await this.answerCallbackQuery(cb.id, '');
      return;
    }
  }

  /** معالجة سحب الروليت التفاعلي داخل القنوات والكروبات والرسائل المضمّنة */
  private async handleRouletteChannelCb(cb: TelegramCallbackQuery, rawData: string) {
    const parts = rawData.split(':');
    const action = parts[1] || '';
    const rltId = parts[2] || '';
    let sess = this.rouletteSessions.get(rltId);

    if (!sess) {
      const clickerName = `${cb.from.first_name}${cb.from.last_name ? ` ${cb.from.last_name}` : ''}`.trim();
      sess = EXT.createRouletteSession(
        rltId || Date.now().toString(36).slice(-5),
        String(cb.message?.chat.id || ''),
        String(cb.from.id),
        clickerName
      );
      this.rouletteSessions.set(sess.id, sess);
    }

    const uid = String(cb.from.id);
    const uname = `${cb.from.first_name}${cb.from.last_name ? ` ${cb.from.last_name}` : ''}`.trim();

    if (action === 'join') {
      const res = EXT.toggleRouletteParticipant(sess, uid, uname);
      if (!res.ok) {
        await this.answerCallbackQuery(cb.id, res.reason || 'مغلق', true);
        return;
      }
      await this.answerCallbackQuery(
        cb.id,
        res.joined ? '✅ تم تسجيل اسمك بالسحب!' : '↩️ تم انسحابك من السحب.'
      );
    } else if (action === 'spin' || action === 'lock') {
      const isOrganizer = !sess.creatorId || sess.creatorId === uid || this.isOwner(uid);
      let isAdmin = isOrganizer;
      if (!isAdmin && cb.message?.chat.id) {
        const admins = await this.getChatAdministrators(String(cb.message.chat.id));
        isAdmin = admins.some(a => String(a?.user?.id || '') === uid);
      }
      if (!isAdmin) {
        await this.answerCallbackQuery(cb.id, '⛔ السحب والقفل خاص بمنظّم الروليت فقط!', true);
        return;
      }

      if (action === 'lock') {
        sess.open = !sess.open;
        await this.answerCallbackQuery(cb.id, sess.open ? '🔓 تم فتح المشاركة' : '🔒 تم قفل المشاركة');
      } else {
        const spin = EXT.spinRouletteWinner(sess);
        if (!spin.ok || !spin.winner) {
          await this.answerCallbackQuery(cb.id, spin.reason || 'لا يوجد مشاركون!', true);
          return;
        }
        await this.answerCallbackQuery(cb.id, `🎉 الفائز: ${spin.winner.name}`, true);
      }
    }

    const view = EXT.renderRouletteChannelView(sess);
    if (cb.inline_message_id) {
      await this.editInlineMessageText(cb.inline_message_id, view.text, view.keyboard, 'MarkdownV2');
    } else if (cb.message?.chat.id && cb.message?.message_id) {
      await this.editMessageText(
        String(cb.message.chat.id),
        cb.message.message_id,
        view.text,
        view.keyboard,
        'MarkdownV2'
      );
    }
  }

  private async handlePrivateRouletteTextInput(uid: string, rawText: string) {
    const items = EXT.parseRouletteTextChoices(rawText);
    if (items.length < 2) {
      await this.sendMessage(uid, '⚠️ أرسل خيارين أو اسمين على الأقل (كل اسم بسطر أو بينها فواصل).');
      return;
    }
    this.pendingRouletteText.delete(uid);
    this.privateRouletteLists.set(uid, items);
    const winner = EXT.pickRandomFromChoices(items);
    await this.sendMessage(
      uid,
      `🎰 *نتيجة الروليت*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `👥 العدد: *${items.length}*\n` +
        `🏆 *الفائز:* *${this.mdSafe(winner)}*`,
      [
        [{ text: '🔄 تدوير مرة ثانية', callback_data: 'rltl:spin' }],
        [{ text: '📝 قائمة جديدة', callback_data: 'svc:roulette_list' }],
        [{ text: '🔙 خدمات أخرى', callback_data: 'svc:main' }]
      ]
    );
  }

  private async handleAgeCalcTextInput(uid: string, rawText: string) {
    const res = EXT.calculateExactAge(rawText);
    if (!res.ok) {
      await this.sendMessage(uid, res.error || '⚠️ صيغة التاريخ غير صحيحة — مثال: `15/8/2003`', [
        [{ text: '🔙 رجوع', callback_data: 'svc:main' }]
      ]);
      return;
    }
    this.pendingAgeCalc.delete(uid);
    await this.sendMessage(uid, EXT.formatAgeCard(res), [
      [{ text: '🎂 حساب تاريخ آخر', callback_data: 'svc:age' }],
      [{ text: '🔙 خدمات أخرى', callback_data: 'svc:main' }]
    ]);
  }

  /** تنزيل بايتات أي ملف مرسل إلى تيليجرام عبر getFile */
  private async downloadTelegramFileBytes(fileId: string): Promise<{ bytes: Uint8Array; filePath: string } | null> {
    if (!this.token || !fileId) return null;
    try {
      const r = await fetch(`https://api.telegram.org/bot${this.token}/getFile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId })
      });
      const j: any = await r.json();
      const filePath = j?.result?.file_path;
      if (!j?.ok || !filePath) return null;
      const dl = await fetch(`https://api.telegram.org/file/bot${this.token}/${filePath}`);
      if (!dl.ok) return null;
      const bytes = new Uint8Array(await dl.arrayBuffer());
      return { bytes, filePath: String(filePath) };
    } catch {
      return null;
    }
  }

  private async sendBinaryMultipart(
    chatId: string,
    method: 'sendAudio' | 'sendVoice' | 'sendDocument' | 'sendPhoto' | 'sendSticker' | 'sendVideo' | 'sendAnimation',
    fieldName: string,
    bytes: Uint8Array,
    fileName: string,
    mimeType: string,
    extraFields?: Record<string, string>
  ): Promise<number | null> {
    if (!this.token) return null;
    try {
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append(fieldName, new Blob([bytes as unknown as ArrayBuffer], { type: mimeType }), fileName);
      if (method === 'sendAudio') {
        const quote = await this.getSongBotQuote();
        if (quote) {
          form.append('caption', quote.caption);
          form.append('caption_entities', JSON.stringify(quote.caption_entities));
        }
      }
      if (extraFields) {
        for (const [k, v] of Object.entries(extraFields)) {
          form.append(k, v);
        }
      }
      const r = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        body: form
      });
      const j: any = await r.json();
      if (j?.ok) return Number(j?.result?.message_id) || 1;
      return null;
    } catch {
      return null;
    }
  }

  /** استلام الملف المراد تحويل صيغته وعرض الصيغ المتاحة فوراً */
  private async handleFormatConvertMediaInput(uid: string, msg: TelegramMessage) {
    let fileId = '';
    let kind = '';

    if (msg.video) {
      fileId = msg.video.file_id;
      kind = 'video';
    } else if (msg.animation) {
      fileId = msg.animation.file_id;
      kind = 'animation';
    } else if (msg.audio) {
      fileId = msg.audio.file_id;
      kind = 'audio';
    } else if (msg.voice) {
      fileId = msg.voice.file_id;
      kind = 'voice';
    } else if (msg.photo && msg.photo.length) {
      fileId = msg.photo[msg.photo.length - 1].file_id;
      kind = 'photo';
    } else if (msg.sticker) {
      if (msg.sticker.is_animated) {
        await this.sendMessage(uid, '⚠️ أرسل ملصقاً ثابتاً أو صورة لتحويلها.');
        return;
      }
      fileId = msg.sticker.file_id;
      kind = 'sticker';
    } else if (msg.document) {
      const mime = String(msg.document.mime_type || '').toLowerCase();
      fileId = msg.document.file_id;
      if (mime.startsWith('image/')) kind = 'photo';
      else if (mime.startsWith('video/')) kind = 'video';
      else if (mime.startsWith('audio/')) kind = 'audio';
    }

    if (!fileId || !kind) {
      await this.sendMessage(uid, '⚠️ أرسل فيديو أو صوتاً أو بصمة أو صورة أو ملصقاً لتحويل صيغته.');
      return;
    }

    this.pendingConvert.set(uid, { fileId, kind });
    this.trackMediaMsg(uid, msg.message_id);

    if (kind === 'audio' || kind === 'voice' || kind === 'video') {
      const initialTitle = String(msg.audio?.title || '').trim();
      const initialArtist = String(msg.audio?.performer || '').trim();
      const rawName = String(msg.audio?.file_name || msg.document?.file_name || 'audio')
        .replace(/\.[^.]+$/, '')
        .trim();
      this.audioEditDrafts.set(uid, {
        fileId,
        sourceKind: kind,
        title: initialTitle,
        artist: initialArtist,
        fileName: rawName || 'audio'
      });
    }

    const optionsByKind: Record<string, any[][]> = {
      video: [
        [{ text: '🎵 تحويل إلى ملف صوتي (M4A)', callback_data: 'conv:to_audio' }],
        [{ text: '✏️ استخراج الصوت وتعديل الاسم والفنان والصورة', callback_data: 'conv:edit_open' }],
        [{ text: '🎙️ تحويل إلى بصمة صوتية (Voice)', callback_data: 'conv:to_voice' }],
        [{ text: '🎞️ تحويل إلى متحركة (GIF)', callback_data: 'conv:to_gif' }]
      ],
      animation: [[{ text: '🎬 تحويل المتحركة إلى فيديو (MP4)', callback_data: 'conv:to_video' }]],
      audio: [
        [{ text: '✏️ تعديل الاسم والفنان والملف والصورة', callback_data: 'conv:edit_open' }],
        [{ text: '🎙️ تحويل الأغنية إلى بصمة صوتية', callback_data: 'conv:to_voice' }],
        [{ text: '📄 إرسال كملف (Document)', callback_data: 'conv:to_doc_mp3' }]
      ],
      voice: [
        [{ text: '🎵 تحويل البصمة إلى ملف صوتي (MP3)', callback_data: 'conv:to_audio' }],
        [{ text: '✏️ تحويل وتعديل الاسم والفنان والملف والصورة', callback_data: 'conv:edit_open' }]
      ],
      photo: [
        [{ text: '📑 تحويل الصورة إلى PDF', callback_data: 'conv:to_pdf' }],
        [{ text: '✨ تحويل الصورة إلى ملصق (Sticker)', callback_data: 'conv:to_sticker' }],
        [{ text: '🖼️ ملف صورة بدون ضغط (PNG)', callback_data: 'conv:to_doc_png' }]
      ],
      sticker: [
        [{ text: '🖼️ تحويل الملصق إلى صورة', callback_data: 'conv:to_photo' }],
        [{ text: '✨ ملف PNG شفاف', callback_data: 'conv:to_doc_png' }]
      ]
    };

    const kb = [...(optionsByKind[kind] || []), [{ text: '🔙 إلغاء', callback_data: 'svc:main' }]];
    const promptMsg = await this.sendMessage(uid, '🔄 *اختر الإجراء أو الصيغة المطلوبة:* 👇', kb);
    if (promptMsg?.result?.message_id) this.trackMediaMsg(uid, promptMsg.result.message_id);
  }

  private async sendAudioMetadataEditorCard(uid: string, editMsgId?: number) {
    const draft = this.audioEditDrafts.get(uid);
    if (!draft) return;
    const text =
      `🎛️ *تعديل معلومات وصورة المقطع الصوتي*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🎵 *اسم الأغنية:* ${this.mdSafe(draft.title || 'غير محدد')}\n` +
      `🎤 *اسم الفنان:* ${this.mdSafe(draft.artist || 'غير محدد')}\n` +
      `📁 *اسم الملف:* \`${this.mdSafe(draft.fileName || 'audio')}.mp3\`\n` +
      `🖼️ *صورة الغلاف:* ${draft.coverFileId ? 'تمت إضافتها ✅' : 'بدون صورة'}`;

    const kb: any[][] = [
      [
        { text: '📝 اسم الأغنية', callback_data: 'conv:ef:title' },
        { text: '🎤 اسم الفنان', callback_data: 'conv:ef:artist' }
      ],
      [
        { text: '📁 اسم الملف', callback_data: 'conv:ef:fileName' },
        { text: '🖼️ الصورة', callback_data: 'conv:ef:cover' }
      ],
      [{ text: '✅ حفظ وإرسال المقطع بالتعديلات', callback_data: 'conv:edit_send' }],
      [{ text: '🔙 إلغاء', callback_data: 'svc:main' }]
    ];

    if (editMsgId) {
      const ed = await this.editMessageText(uid, editMsgId, text, kb);
      if (ed?.ok) return;
    }
    const sent = await this.sendMessage(uid, text, kb);
    if (sent?.result?.message_id) this.trackMediaMsg(uid, sent.result.message_id);
  }

  private async executeFormatConversion(cb: TelegramCallbackQuery, targetAction: string) {
    const uid = String(cb.from.id);
    const chatId = String(cb.message?.chat.id || uid);

    if (targetAction === 'edit_open') {
      const draft = this.audioEditDrafts.get(uid);
      if (!draft) {
        await this.answerCallbackQuery(cb.id, '⚠️ أرسل الأغنية أو البصمة أولاً.', true);
        return;
      }
      await this.answerCallbackQuery(cb.id, '');
      await this.sendAudioMetadataEditorCard(uid, cb.message?.message_id);
      return;
    }

    if (targetAction.startsWith('ef:')) {
      const field = targetAction.slice(3) as 'title' | 'artist' | 'fileName' | 'cover';
      const draft = this.audioEditDrafts.get(uid);
      if (!draft) {
        await this.answerCallbackQuery(cb.id, '⚠️ أرسل الأغنية أو البصمة أولاً.', true);
        return;
      }
      draft.waitingField = field;
      this.audioEditDrafts.set(uid, draft);
      await this.answerCallbackQuery(cb.id, '');
      const prompts: Record<string, string> = {
        title: '📝 أرسل الآن *اسم الأغنية الجديد*:',
        artist: '🎤 أرسل الآن *اسم الفنان الجديد*:',
        fileName: '📁 أرسل الآن *اسم الملف الجديد* (بدون امتداد):',
        cover: '🖼️ أرسل الآن *الصورة* التي تريد وضعها غلافاً للأغنية:'
      };
      const pMsg = await this.sendMessage(chatId, prompts[field] || 'أرسل القيمة الجديدة:', [
        [{ text: '🔙 رجوع للمحرر', callback_data: 'conv:edit_open' }]
      ]);
      if (pMsg?.result?.message_id) this.trackMediaMsg(uid, pMsg.result.message_id);
      return;
    }

    if (targetAction === 'edit_send') {
      const draft = this.audioEditDrafts.get(uid);
      if (!draft || !draft.fileId) {
        await this.answerCallbackQuery(cb.id, '⚠️ أرسل الأغنية أو البصمة أولاً.', true);
        return;
      }
      await this.answerCallbackQuery(cb.id, '⏳ جارٍ تجهيز المقطع بالتعديلات...');
      const waitMsg = await this.sendMessage(chatId, '⏳ جارٍ حفظ التعديلات وإرسال المقطع...');
      const waitId = waitMsg?.result?.message_id;

      try {
        const srcDl = await this.downloadTelegramFileBytes(draft.fileId);
        if (!srcDl) {
          if (waitId) await this.editMessageText(chatId, waitId, '⚠️ تعذّر قراءة الملف (تأكد أن حجمه أقل من 20MB).');
          return;
        }

        let audioBytes =
          draft.sourceKind === 'video' ? EXT.stripVideoTracksFromMp4ToM4a(srcDl.bytes) : srcDl.bytes;
        let coverBytes: Uint8Array | undefined;
        if (draft.coverFileId) {
          const covDl = await this.downloadTelegramFileBytes(draft.coverFileId);
          if (covDl?.bytes) coverBytes = covDl.bytes;
        }

        const isM4a = draft.sourceKind === 'video';
        if (!isM4a) {
          audioBytes = EXT.writeId3v23Tags(audioBytes, {
            title: draft.title,
            artist: draft.artist,
            coverBytes
          });
        }

        const safeBase = (draft.fileName || draft.title || 'audio').replace(/[\\/:*?"<>|]/g, '').trim() || 'audio';
        const outExt = isM4a ? 'm4a' : 'mp3';
        const outMime = isM4a ? 'audio/mp4' : 'audio/mpeg';

        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('audio', new Blob([audioBytes as unknown as ArrayBuffer], { type: outMime }), `${safeBase}.${outExt}`);
        const quote = await this.getSongBotQuote();
        if (quote) {
          form.append('caption', quote.caption);
          form.append('caption_entities', JSON.stringify(quote.caption_entities));
        }
        if (draft.title) form.append('title', draft.title);
        if (draft.artist) form.append('performer', draft.artist);
        if (coverBytes) {
          form.append('thumbnail', new Blob([coverBytes as unknown as ArrayBuffer], { type: 'image/jpeg' }), 'thumb.jpg');
        }

        const up = await fetch(`https://api.telegram.org/bot${this.token}/sendAudio`, {
          method: 'POST',
          body: form
        });
        const upJson: any = await up.json();
        if (waitId) await this.deleteMessage(chatId, waitId);

        if (upJson?.ok) {
          const sentMsgId = Number(upJson?.result?.message_id) || 1;
          this.trackMediaMsg(uid, sentMsgId);
          this.audioEditDrafts.delete(uid);
          this.pendingConvert.delete(uid);
          const done = await this.sendMessage(chatId, '✅ *تم إرسال المقطع الصوتي بالتعديلات الجديدة!*', [
            [{ text: '🗑️ مسح الميديا المحمّلة', callback_data: 'dl:clean' }],
            [
              { text: '🔄 تعديل / تحويل ملف آخر', callback_data: 'svc:convert' },
              { text: '🔙 خدمات أخرى', callback_data: 'svc:main' }
            ]
          ]);
          if (done?.result?.message_id) this.trackMediaMsg(uid, done.result.message_id);
        } else {
          await this.sendMessage(chatId, '⚠️ تعذّر إرسال الملف المعدّل — حاول مجدداً.');
        }
      } catch {
        if (waitId) await this.deleteMessage(chatId, waitId);
      }
      return;
    }

    const saved = this.pendingConvert.get(uid);
    if (!saved || !saved.fileId) {
      await this.answerCallbackQuery(cb.id, '⚠️ أرسل الملف أولاً من خدمة تحويل الصيغ.', true);
      return;
    }

    await this.answerCallbackQuery(cb.id, '⏳ جاري التحويل...');
    const waitMsg = await this.sendMessage(chatId, '⏳ جاري تحويل الصيغة ...');
    const waitId = waitMsg?.result?.message_id;

    try {
      const dl = await this.downloadTelegramFileBytes(saved.fileId);
      if (!dl) {
        if (waitId) {
          await this.editMessageText(chatId, waitId, '⚠️ يتعذّر قراءة هذا الملف (تأكد أن حجمه أقل من 20MB).');
        }
        return;
      }

      let sentId: number | null = null;
      if (targetAction === 'to_audio') {
        const outBytes =
          saved.kind === 'video' ? EXT.stripVideoTracksFromMp4ToM4a(dl.bytes) : dl.bytes;
        const isM4a = saved.kind === 'video';
        sentId = await this.sendBinaryMultipart(
          chatId,
          'sendAudio',
          'audio',
          outBytes,
          isM4a ? 'converted-audio.m4a' : 'converted-audio.mp3',
          isM4a ? 'audio/mp4' : 'audio/mpeg',
          { title: 'ملف صوتي محوّل' }
        );
      } else if (targetAction === 'to_voice') {
        const outBytes =
          saved.kind === 'video' ? EXT.stripVideoTracksFromMp4ToM4a(dl.bytes) : dl.bytes;
        sentId = await this.sendBinaryMultipart(
          chatId,
          'sendVoice',
          'voice',
          outBytes,
          'voice.ogg',
          'audio/ogg'
        );
      } else if (targetAction === 'to_gif') {
        sentId = await this.sendBinaryMultipart(
          chatId,
          'sendAnimation',
          'animation',
          dl.bytes,
          'converted.mp4',
          'video/mp4'
        );
      } else if (targetAction === 'to_video') {
        sentId = await this.sendBinaryMultipart(
          chatId,
          'sendVideo',
          'video',
          dl.bytes,
          'converted.mp4',
          'video/mp4'
        );
      } else if (targetAction === 'to_pdf') {
        const pdfBytes = EXT.buildPdfFromJpegBytes(dl.bytes);
        if (pdfBytes) {
          sentId = await this.sendBinaryMultipart(
            chatId,
            'sendDocument',
            'document',
            pdfBytes,
            'document.pdf',
            'application/pdf'
          );
        }
      } else if (targetAction === 'to_sticker') {
        sentId = await this.sendBinaryMultipart(
          chatId,
          'sendSticker',
          'sticker',
          dl.bytes,
          'sticker.webp',
          'image/webp'
        );
      } else if (targetAction === 'to_photo') {
        sentId = await this.sendBinaryMultipart(
          chatId,
          'sendPhoto',
          'photo',
          dl.bytes,
          'image.png',
          'image/png'
        );
      } else if (targetAction === 'to_doc_png') {
        sentId = await this.sendBinaryMultipart(
          chatId,
          'sendDocument',
          'document',
          dl.bytes,
          'image.png',
          'image/png'
        );
      } else if (targetAction === 'to_doc_mp3') {
        sentId = await this.sendBinaryMultipart(
          chatId,
          'sendDocument',
          'document',
          dl.bytes,
          'audio.mp3',
          'audio/mpeg'
        );
      }

      if (waitId) await this.deleteMessage(chatId, waitId);

      if (sentId) {
        this.trackMediaMsg(uid, sentId);
        this.pendingConvert.delete(uid);
        const done = await this.sendMessage(chatId, '✅ *تم تحويل الصيغة بنجاح!*', [
          [{ text: '🗑️ مسح الميديا المحمّلة', callback_data: 'dl:clean' }],
          [
            { text: '🔄 تحويل ملف آخر', callback_data: 'svc:convert' },
            { text: '🔙 خدمات أخرى', callback_data: 'svc:main' }
          ]
        ]);
        if (done?.result?.message_id) this.trackMediaMsg(uid, done.result.message_id);
      } else {
        await this.sendMessage(chatId, '⚠️ تعذّر إتمام هذا التحويل على هذا الملف — جرّب صيغة أخرى.', [
          [{ text: '🔄 ملف آخر', callback_data: 'svc:convert' }]
        ]);
      }
    } catch {
      if (waitId) await this.deleteMessage(chatId, waitId);
    }
  }

  /** عزل الموسيقى عن الأغنية عند إرسال ملف صوت/فيديو/بصمة */
  private async handleVocalSeparationMediaInput(uid: string, msg: TelegramMessage) {
    const fileObj = msg.audio || msg.voice || msg.video || msg.document;
    if (!fileObj?.file_id) {
      await this.sendMessage(uid, '⚠️ أرسل ملف صوت أو فيديو أو اكتب اسم الأغنية.');
      return;
    }
    this.trackMediaMsg(uid, msg.message_id);
    const titleHint = String(msg.audio?.title || msg.document?.file_name || 'الأغنية').replace(/\.[^.]+$/, '');
    const waitMsg = await this.sendMessage(uid, '⏳ جارٍ فصل الصوت عن الموسيقى...');
    const waitId = waitMsg?.result?.message_id;

    await this.acquireDownloadSlot();
    try {
      const dl = await this.downloadTelegramFileBytes(fileObj.file_id);
      if (!dl) {
        if (waitId) {
          await this.editMessageText(
            uid,
            waitId,
            '⚠️ حجم الملف يتجاوز حد 20MB لملفات تيليجرام — اكتب اسم الأغنية نصاً وسأقوم بعزلها لك فوراً!'
          );
        }
        return;
      }

      const wavFast = EXT.separateWavStereoInstant(dl.bytes);
      const sep = wavFast || (await EXT.separateAudioViaGradioAI(dl.bytes, dl.filePath.split('/').pop() || 'song.mp3'));
      let delivered = 0;

      if (sep?.ok) {
        if (sep.vocalsBytes) {
          const s1 = await this.sendBinaryMultipart(
            uid,
            'sendAudio',
            'audio',
            sep.vocalsBytes,
            `vocals.${sep.vocalsExt || 'mp3'}`,
            sep.vocalsExt === 'wav' ? 'audio/wav' : 'audio/mpeg',
            { title: `${titleHint} — الصوت فقط (بدون موسيقى)`, performer: 'Vocals Only' }
          );
          sep.vocalsBytes = undefined;
          if (s1) {
            this.trackMediaMsg(uid, s1);
            delivered += 1;
          }
        }
        if (sep.instrumentalBytes) {
          const s2 = await this.sendBinaryMultipart(
            uid,
            'sendAudio',
            'audio',
            sep.instrumentalBytes,
            `music.${sep.instrumentalExt || 'mp3'}`,
            sep.instrumentalExt === 'wav' ? 'audio/wav' : 'audio/mpeg',
            { title: `${titleHint} — الموسيقى فقط (بدون غناء)`, performer: 'Music Only' }
          );
          sep.instrumentalBytes = undefined;
          if (s2) {
            this.trackMediaMsg(uid, s2);
            delivered += 1;
          }
        }
      }

      // إذا كانت خوادم GPU مزدحمة وكان للأغنية عنوان معروف، نجلب نسخة الموسيقى الصافية تلقائياً
      if (delivered === 0 && titleHint && titleHint !== 'الأغنية') {
        delivered = await this.deliverStudioKaraokeAndVocalsByQuery(uid, titleHint);
      }

      if (waitId) await this.deleteMessage(uid, waitId);
      if (delivered > 0) {
        this.pendingVocalSep.delete(uid);
        const done = await this.sendMessage(uid, '✅ *تم عزل الصوت والموسيقى بنجاح!*', [
          [{ text: '🗑️ مسح الميديا المحمّلة', callback_data: 'dl:clean' }],
          [
            { text: '🎼 عزل أغنية أخرى', callback_data: 'svc:vocal' },
            { text: '🔙 خدمات أخرى', callback_data: 'svc:main' }
          ]
        ]);
        if (done?.result?.message_id) this.trackMediaMsg(uid, done.result.message_id);
      } else {
        await this.sendMessage(
          uid,
          '⚠️ خادم العزل مزدحم حالياً — أرسل *اسم الأغنية* كتابةً أو أعد المحاولة بعد لحظات.',
          [[{ text: '🔙 خدمات أخرى', callback_data: 'svc:main' }]]
        );
      }
    } finally {
      this.releaseDownloadSlot();
    }
  }

  private async deliverStudioKaraokeAndVocalsByQuery(uid: string, songQuery: string): Promise<number> {
    let delivered = 0;
    const instHits = await MS.searchSongs(`${songQuery} instrumental karaoke بدون موسيقى`, 3);
    const cleanInst =
      instHits.length > 0 ? instHits[0] : (await MS.searchSongs(`${songQuery} karaoke instrumental`, 2))[0];
    if (cleanInst) {
      const pInst = await MS.resolveSongAudioPayload(cleanInst);
      if (pInst) {
        const okInst = await this.sendAudioPayload(
          uid,
          pInst,
          `${songQuery} — الموسيقى فقط`,
          'Instrumental'
        );
        if (okInst) delivered += 1;
      }
    }

    const vocHits = await MS.searchSongs(`${songQuery} acapella vocals بدون موسيقى`, 2);
    if (vocHits[0]) {
      const pVoc = await MS.resolveSongAudioPayload(vocHits[0]);
      if (pVoc) {
        const okVoc = await this.sendAudioPayload(
          uid,
          pVoc,
          `${songQuery} — الصوت بدون موسيقى`,
          'Vocals Only'
        );
        if (okVoc) delivered += 1;
      }
    }
    return delivered;
  }

  /** عزل الموسيقى عن الأغنية عند كتابة اسم الأغنية نصاً */
  private async handleVocalSeparationTextInput(uid: string, query: string, incomingMsgId?: number) {
    if (incomingMsgId) this.trackMediaMsg(uid, incomingMsgId);
    const waitMsg = await this.sendMessage(uid, '⏳ جارٍ فصل الصوت عن الموسيقى...');
    const waitId = waitMsg?.result?.message_id;

    await this.acquireDownloadSlot();
    try {
      let delivered = 0;
      const baseHits = await MS.searchSongs(query, 2);
      if (baseHits[0]) {
        const srcAudio = await MS.resolveSongAudioPayload(baseHits[0]);
        if (srcAudio?.bytes || srcAudio?.url) {
          let rawBytes = srcAudio.bytes;
          if (!rawBytes && srcAudio.url) {
            const fetched = await fetch(srcAudio.url).catch(() => null);
            if (fetched?.ok) rawBytes = new Uint8Array(await fetched.arrayBuffer());
          }
          if (rawBytes && rawBytes.byteLength < 25 * 1024 * 1024) {
            const aiSep = await EXT.separateAudioViaGradioAI(rawBytes, 'song.mp3');
            rawBytes = undefined;
            if (aiSep?.ok) {
              if (aiSep.vocalsBytes) {
                const s1 = await this.sendBinaryMultipart(
                  uid,
                  'sendAudio',
                  'audio',
                  aiSep.vocalsBytes,
                  'vocals.mp3',
                  'audio/mpeg',
                  { title: `${baseHits[0].title} — الصوت فقط (بدون موسيقى)`, performer: baseHits[0].artist }
                );
                aiSep.vocalsBytes = undefined;
                if (s1) {
                  this.trackMediaMsg(uid, s1);
                  delivered += 1;
                }
              }
              if (aiSep.instrumentalBytes) {
                const s2 = await this.sendBinaryMultipart(
                  uid,
                  'sendAudio',
                  'audio',
                  aiSep.instrumentalBytes,
                  'music.mp3',
                  'audio/mpeg',
                  { title: `${baseHits[0].title} — الموسيقى فقط`, performer: baseHits[0].artist }
                );
                aiSep.instrumentalBytes = undefined;
                if (s2) {
                  this.trackMediaMsg(uid, s2);
                  delivered += 1;
                }
              }
            }
          }
        }
      }

      if (delivered === 0) {
        delivered = await this.deliverStudioKaraokeAndVocalsByQuery(uid, query);
      }

      if (waitId) await this.deleteMessage(uid, waitId);
      if (delivered > 0) {
        this.pendingVocalSep.delete(uid);
        const done = await this.sendMessage(uid, '✅ *تم عزل الصوت والموسيقى بنجاح!*', [
          [{ text: '🗑️ مسح الميديا المحمّلة', callback_data: 'dl:clean' }],
          [
            { text: '🎼 عزل أغنية أخرى', callback_data: 'svc:vocal' },
            { text: '🔙 خدمات أخرى', callback_data: 'svc:main' }
          ]
        ]);
        if (done?.result?.message_id) this.trackMediaMsg(uid, done.result.message_id);
      } else {
        await this.sendMessage(uid, '⚠️ ما لكيت نسخة متاحة لهذه الأغنية — جرّب إرسال ملف الأغنية مباشرة.', [
          [{ text: '🔙 رجوع', callback_data: 'svc:main' }]
        ]);
      }
    } finally {
      this.releaseDownloadSlot();
    }
  }

  /** معالجة رسائل المستخدم بالخاص أثناء إنشاء همسة */
  private async handleWhisperTextStep(userId: string, sender: TelegramUser, rawText: string) {
    const draft = this.pendingWhispers.get(userId);
    if (!draft) return;
    const SEP = '━━━━━━━━━━━━━━━━━━━';
    const creatorName = sender.first_name + (sender.last_name ? ` ${sender.last_name}` : '');

    if (draft.step === 'awaiting_text') {
      const clean = rawText.trim().slice(0, 190);
      if (draft.mode === 'all' || draft.mode === 'first') {
        this.pendingWhispers.delete(userId);
        const wh = MS.createWhisperRecord({
          creatorId: userId,
          creatorName,
          creatorUsername: sender.username,
          mode: draft.mode,
          text: clean,
          allowedTargets: []
        });
        this.whispers.set(wh.id, wh);
        await this.sendMessage(
          userId,
          `✅ *همستك جاهزة للإرسال!*\n` +
            `${SEP}\n` +
            `🔐 *النوع:* ${MS.whisperModeLabel(wh.mode)}\n` +
            `💬 *المحتوى:* «${this.mdSafe(wh.text)}»\n\n` +
            `👇 اضغط الزر بالأسفل لاختيار الكروب أو القناة وإرسالها فوراً:`,
          [
            [{ text: '📤 إرسال الهمسة للكروب أو القناة', switch_inline_query: `wh:${wh.id}` }],
            [{ text: '🤫 إنشاء همسة أخرى', callback_data: 'svc:whisper' }],
            [{ text: '🔙 رجوع', callback_data: 'svc:main' }]
          ]
        );
        return;
      }

      const count = MS.whisperMaxCount(draft.mode) || 1;
      const example = count > 1 ? '`@user1 @user2`' : '`@username`';
      draft.step = 'awaiting_targets';
      draft.text = clean;
      this.pendingWhispers.set(userId, draft);
      await this.sendMessage(
        userId,
        `🎯 *تحديد المستلمين (${MS.whisperModeLabel(draft.mode)})*\n` +
          `${SEP}\n` +
          `أرسل الآن يوزرات الأشخاص المسموح لهم قراءة الهمسة (مثلاً: ${example})،\n` +
          `أو اضغط الزر بالأسفل إذا تريد أي *${count}* يفتحوها وبعدهم تقفل تلقائياً:`,
        [
          [{ text: `🔓 لأول ${count} يفتحوها (بدون تحديد يوزر)`, callback_data: 'wh:notarget' }],
          [{ text: '🔙 إلغاء', callback_data: 'svc:whisper' }]
        ]
      );
      return;
    }

    const maxCount = MS.whisperMaxCount(draft.mode) || 1;
    const targets = MS.parseWhisperTargets(rawText, maxCount);
    this.pendingWhispers.delete(userId);
    const wh = MS.createWhisperRecord({
      creatorId: userId,
      creatorName,
      creatorUsername: sender.username,
      mode: draft.mode,
      text: draft.text || '',
      allowedTargets: targets
    });
    this.whispers.set(wh.id, wh);
    await this.sendMessage(
      userId,
      `✅ *همستك جاهزة للإرسال!*\n` +
        `${SEP}\n` +
        `🔐 *النوع:* ${MS.whisperModeLabel(wh.mode)}\n` +
        (targets.length ? `🎯 *المستلمون:* ${targets.map(t => (/^\d+$/.test(t) ? t : `@${t}`)).join(' ، ')}\n` : '') +
        `💬 *المحتوى:* «${this.mdSafe(wh.text)}»\n\n` +
        `👇 اضغط الزر بالأسفل لاختيار الكروب أو القناة وإرسالها فوراً:`,
      [
        [{ text: '📤 إرسال الهمسة للكروب أو القناة', switch_inline_query: `wh:${wh.id}` }],
        [{ text: '🤫 إنشاء همسة أخرى', callback_data: 'svc:whisper' }],
        [{ text: '🔙 رجوع', callback_data: 'svc:main' }]
      ]
    );
  }

  private trackMediaMsg(userId: string, msgId?: number | null) {
    if (!msgId || !Number.isFinite(msgId)) return;
    const arr = this.mediaSessionMsgs.get(userId) || [];
    if (!arr.includes(msgId)) arr.push(msgId);
    if (arr.length > 60) arr.shift();
    this.mediaSessionMsgs.set(userId, arr);
  }

  private async acquireDownloadSlot(): Promise<void> {
    if (this.activeDownloadSlots < 2) {
      this.activeDownloadSlots += 1;
      return;
    }
    await new Promise<void>(resolve => {
      this.waitingDownloadResolvers.push(resolve);
    });
  }

  private releaseDownloadSlot(): void {
    const next = this.waitingDownloadResolvers.shift();
    if (next) {
      next();
    } else {
      this.activeDownloadSlots = Math.max(0, this.activeDownloadSlots - 1);
    }
  }

  /** معالجة رابط التحميل المرسل بالخاص من يوتيوب / بنترست / تيك توك / إنستغرام (يدعم > 50MB + زر HD + مسح الميديا + منع التكرار 100%) */
  private async handleSocialDownloadInput(userId: string, rawUrl: string, incomingMsgId?: number) {
    const platform = this.pendingSocialDl.get(userId);
    if (!platform) return;

    // قفل فوري لكل مستخدم حتى يستحيل إرسال «جاري تحميل المنشور...» أكثر من مرة واحدة إطلاقاً!
    if (this.activeSocialDownloads.has(userId)) {
      return;
    }
    this.activeSocialDownloads.add(userId);
    if (incomingMsgId) this.trackMediaMsg(userId, incomingMsgId);

    const statusMsg = await this.sendMessage(userId, `⏳ جاري تحميل المنشور من *${MS.socialPlatformLabel(platform)}* ...`);
    const statusMsgId = statusMsg?.result?.message_id;

    await this.acquireDownloadSlot();
    try {
      const result = await MS.downloadFromPlatform(platform, rawUrl);
      if (!result.ok || !result.items.length) {
        const errText = result.error || '⚠️ تعذّر تحميل هذا الرابط — تأكد أنه رابط منشور عام وصحيح.';
        if (statusMsgId) {
          await this.editMessageText(userId, statusMsgId, errText, [
            [{ text: '🔙 اختيار منصة أخرى', callback_data: 'svc:dl' }]
          ]);
        } else {
          await this.sendMessage(userId, errText, [[{ text: '🔙 اختيار منصة أخرى', callback_data: 'svc:dl' }]]);
        }
        return;
      }

      let deliveredInline = 0;
      const oversizedButtons: Array<{ text: string; url: string }> = [];

      for (const item of result.items.slice(0, 5)) {
        if (item.oversized) {
          item.bytes = undefined;
          const sizeTag = item.sizeMB ? ` (${item.sizeMB} MB)` : '';
          oversizedButtons.push({
            text: `📥 تنزيل الفيديو الكامل مباشرة${sizeTag}`,
            url: item.url
          });
          continue;
        }

        const sentId = await this.sendMediaBinaryOrUrl(userId, item.kind, item.url, item.headers, item.bytes);
        // تحرير البايتات من الذاكرة فوراً بعد الإرسال لمنع أي ضغط على البوت عند تعدد المستخدمين
        item.bytes = undefined;

        if (sentId) {
          this.trackMediaMsg(userId, sentId);
          deliveredInline += 1;
        } else if (item.url && item.url.startsWith('http')) {
          oversizedButtons.push({
            text: '📥 تنزيل الفيديو الكامل مباشرة',
            url: item.url
          });
        }
      }

      if (deliveredInline > 0 || oversizedButtons.length > 0) {
        this.pendingSocialDl.delete(userId);
        if (statusMsgId) {
          await this.deleteMessage(userId, statusMsgId);
        }

        const kb: any[][] = [];
        for (const btn of oversizedButtons) {
          kb.push([btn]);
        }
        if (platform === 'yt' && result.videoId) {
          kb.push([{ text: '🎬 تحميل بدقة عالية HD', callback_data: `ytq:hd:${result.videoId}` }]);
        }
        kb.push([{ text: '🗑️ مسح الميديا المحمّلة', callback_data: 'dl:clean' }]);
        kb.push([
          { text: '📥 تحميل منشور آخر', callback_data: 'svc:dl' },
          { text: '🔙 خدمات أخرى', callback_data: 'svc:main' }
        ]);

        const noteLine =
          `💡 _ملاحظة: بعد حفظ الفيديو أو الصورة بجهازك، ننصحك بالضغط على زر «🗑️ مسح الميديا المحمّلة» بالأسفل لحذف الروابط والوسائط المنتهية والحفاظ على خفة وسرعة البوت للجميع._`;

        const doneText =
          deliveredInline > 0
            ? `✅ *تم تحميل وإرسال المنشور بنجاح!*\n\n${noteLine}`
            : `✅ *تم تجهيز الفيديو الكامل بنجاح (حجم أكبر من 50MB)!*\n` +
              `بما أن حجم الفيديو يتجاوز حد الرفع المباشر في تيليجرام (50MB)، اضغط الزر أدناه لتنزيله كاملاً مباشرة وبأقصى سرعة:\n\n${noteLine}`;

        const doneMsg = await this.sendMessage(userId, doneText, kb);
        if (doneMsg?.result?.message_id) this.trackMediaMsg(userId, doneMsg.result.message_id);
      } else if (statusMsgId) {
        await this.editMessageText(
          userId,
          statusMsgId,
          '⚠️ تعذّر استلام الملف من المصدر حالياً — حاول مرة أخرى بعد لحظات.',
          [[{ text: '🔙 رجوع', callback_data: 'svc:dl' }]]
        );
      }
    } finally {
      this.releaseDownloadSlot();
      this.activeSocialDownloads.delete(userId);
    }
  }

  /** البحث بأمر «يوت <اسم الأغنية>» بالخاص أو الكروبات أو القنوات */
  private async handleYoutSongSearch(chatId: string, query: string, replyToMessageId?: number) {
    const hits = await MS.searchSongs(query, 5);
    if (!hits.length) {
      await this.sendMessage(chatId, `⚠️ ما لكيت نتائج مطابقة لـ «${this.mdSafe(query)}» — جرّب كتابة اسم الأغنية أو الفنان بوضوح.`);
      return;
    }

    const searchKey = Date.now().toString(36).slice(-5) + Math.random().toString(36).substring(2, 5);
    this.songSearches.set(searchKey, hits);

    const kb = hits.map((h, i) => [
      {
        text: `🎵 ${h.title.slice(0, 46)}${h.duration ? ` (${h.duration})` : ''}`,
        callback_data: `yts:${searchKey}:${i}`
      }
    ]);

    const body: any = {
      chat_id: chatId,
      text: `🎶 *نتائج البحث عن:* «${this.mdSafe(query)}»\nاختر الأغنية لإرسالها:`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: kb }
    };
    if (replyToMessageId) {
      body.reply_parameters = { message_id: replyToMessageId, allow_sending_without_reply: true };
    }
    await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(() => null);
  }

  /** إرسال ملف صوتي صافي 100% على شكل أغنية فقط (يدعم البايتات المباشرة والروابط مع Headers مطابقة) */
  private async sendAudioPayload(
    chatId: string,
    payload: MS.ResolvedAudioPayload,
    title: string,
    performer: string
  ): Promise<boolean> {
    if (!this.token) return false;
    const mime = payload.ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4';
    const fileName = `${title.replace(/[\\/:*?"<>|]/g, '').slice(0, 60) || 'song'}.${payload.ext}`;
    const quote = await this.getSongBotQuote();

    // 1) إذا كانت البيانات الثنائية جاهزة مسبقاً بالذاكرة (مثل HLS المجمّع من SoundCloud CloudFront)
    if (payload.bytes && payload.bytes.byteLength > 1000 && payload.bytes.byteLength <= 49 * 1024 * 1024) {
      try {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('title', title);
        form.append('performer', performer);
        if (quote) {
          form.append('caption', quote.caption);
          form.append('caption_entities', JSON.stringify(quote.caption_entities));
        }
        form.append('audio', new Blob([payload.bytes as unknown as ArrayBuffer], { type: mime }), fileName);

        const up = await fetch(`https://api.telegram.org/bot${this.token}/sendAudio`, {
          method: 'POST',
          body: form
        });
        const upJson: any = await up.json();
        if (upJson?.ok) return true;
      } catch {
        // continue
      }
    }

    if (!payload.url) return false;

    // 2) سحب الملف الصوتي بالـ Headers المطابقة (User-Agent الأصلي) ثم رفعه ثنائياً لتيليجرام
    try {
      const reqHeaders: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        ...(payload.headers || {})
      };
      const mediaRes = await fetch(payload.url, {
        headers: reqHeaders,
        redirect: 'follow'
      });
      if (mediaRes.ok) {
        const ct = (mediaRes.headers.get('content-type') || '').toLowerCase();
        const buf = await mediaRes.arrayBuffer();
        const bytesView = new Uint8Array(buf);
        const isHtml =
          ct.includes('text/html') ||
          ct.includes('application/json') ||
          (bytesView[0] === 0x3c && (bytesView[1] === 0x21 || bytesView[1] === 0x68 || bytesView[1] === 0x48));
        if (!isHtml && buf.byteLength > 15_000 && buf.byteLength <= 49 * 1024 * 1024) {
          const blob = new Blob([buf], { type: mime });
          const form = new FormData();
          form.append('chat_id', chatId);
          form.append('title', title);
          form.append('performer', performer);
          if (quote) {
            form.append('caption', quote.caption);
            form.append('caption_entities', JSON.stringify(quote.caption_entities));
          }
          form.append('audio', blob, fileName);

          const up = await fetch(`https://api.telegram.org/bot${this.token}/sendAudio`, {
            method: 'POST',
            body: form
          });
          const upJson: any = await up.json();
          if (upJson?.ok) return true;
        }
      }
    } catch {
      // ننتقل للمحاولة المباشرة عبر الرابط
    }

    try {
      const direct = await fetch(`https://api.telegram.org/bot${this.token}/sendAudio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          audio: payload.url,
          title,
          performer,
          ...(quote || {})
        })
      });
      const dj: any = await direct.json();
      return Boolean(dj?.ok);
    } catch {
      return false;
    }
  }

  /** إرسال فيديو أو صورة (مع حماية كاملة للذاكرة وإعادة message_id ليتم مسحها بضغطة زر «مسح الميديا المحمّلة») */
  private async sendMediaBinaryOrUrl(
    chatId: string,
    kind: 'video' | 'photo',
    mediaUrl: string,
    customHeaders?: Record<string, string>,
    preloadedBytes?: Uint8Array
  ): Promise<number | null> {
    if (!this.token) return null;
    const method = kind === 'video' ? 'sendVideo' : 'sendPhoto';
    const field = kind === 'video' ? 'video' : 'photo';

    if (preloadedBytes && preloadedBytes.byteLength > 500 && preloadedBytes.byteLength <= 49 * 1024 * 1024) {
      try {
        const mime = kind === 'video' ? 'video/mp4' : 'image/jpeg';
        const ext = kind === 'video' ? 'mp4' : 'jpg';
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append(field, new Blob([preloadedBytes as unknown as ArrayBuffer], { type: mime }), `media.${ext}`);
        if (kind === 'video') form.append('supports_streaming', 'true');

        const up = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
          method: 'POST',
          body: form
        });
        const upJson: any = await up.json();
        if (upJson?.ok) return Number(upJson?.result?.message_id) || 1;
      } catch {
        // continue
      }
    }

    try {
      const reqHeaders: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        ...(customHeaders || {})
      };
      const r = await fetch(mediaUrl, {
        headers: reqHeaders,
        redirect: 'follow'
      });
      if (r.ok) {
        const declaredLen = parseInt(r.headers.get('content-length') || '0', 10);
        if (declaredLen > 49 * 1024 * 1024) {
          await r.body?.cancel().catch(() => undefined);
        } else {
          const buf = await r.arrayBuffer();
          if (buf.byteLength > 500 && buf.byteLength <= 49 * 1024 * 1024) {
            const mime = kind === 'video' ? 'video/mp4' : 'image/jpeg';
            const ext = kind === 'video' ? 'mp4' : 'jpg';
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append(field, new Blob([buf], { type: mime }), `media.${ext}`);
            if (kind === 'video') form.append('supports_streaming', 'true');

            const up = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
              method: 'POST',
              body: form
            });
            const upJson: any = await up.json();
            if (upJson?.ok) return Number(upJson?.result?.message_id) || 1;
          }
        }
      }
    } catch {
      // ننتقل للمحاولة الثانية عبر الرابط المباشر
    }

    try {
      const payload: any = { chat_id: chatId, [field]: mediaUrl };
      if (kind === 'video') payload.supports_streaming = true;
      const direct = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const dj: any = await direct.json();
      if (dj?.ok) return Number(dj?.result?.message_id) || 1;
      return null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------
  // 🕵️ «المافيا» — لعبة جماعية متكاملة بالقناة + الخاص
  // ---------------------------------------------------------------------

  private async paintMafia(game: MF.MafiaGame) {
    const botUser = await this.getBotUsername();
    const text = await this.withBotFooter(MF.renderMafiaBoard(game), true);
    const kb = MF.mafiaBoardKeyboard(game, botUser);
    if (game.messageId) {
      const res = await this.editMessageText(game.chatId, game.messageId, text, kb, 'MarkdownV2');
      if (res?.ok || String(res?.description || '').includes('not modified')) return;
    }
    const sent = await this.sendMessage(game.chatId, text, kb, 'MarkdownV2');
    if (sent?.result?.message_id) {
      game.messageId = sent.result.message_id;
      this.mafiaGames.set(game.chatId, game);
    }
  }

  private async sendMafiaNightPrompts(game: MF.MafiaGame) {
    for (const p of game.players) {
      const prompt = MF.buildNightDmPrompt(game, p);
      if (prompt) {
        await this.sendMessage(p.id, prompt.text, prompt.keyboard);
      }
    }
  }

  private async handleMafiaPrivateReady(dmChatId: string, sender?: TelegramUser, gameChatId?: string) {
    if (!sender || !gameChatId) return;
    const game = this.mafiaGames.get(gameChatId);
    if (!game) {
      await this.sendMessage(dmChatId, '✅ تم فتح الخاص! ارجع للقناة وانضم للجولة.');
      return;
    }
    const me = game.players.find(p => p.id === String(sender.id));
    if (!me) {
      await this.sendMessage(dmChatId, '✅ تم تفعيل الخاص! اضغط «انضم» بلوحة المافيا بالقناة.');
      return;
    }
    if (game.status === 'lobby') {
      await this.sendMessage(dmChatId, '✅ تم ربط الخاص! أول ما تبدأ لعبة المافيا يوصلك دورك السري هنا فوراً.');
      return;
    }
    await this.sendMessage(dmChatId, MF.secretRolePopupText(game, me.id));
    const prompt = MF.buildNightDmPrompt(game, me);
    if (prompt) {
      await this.sendMessage(dmChatId, prompt.text, prompt.keyboard);
    }
  }

  private recordMafiaFinish(game: MF.MafiaGame) {
    if (game.rewarded || !game.players.length || !game.winner) return;
    game.rewarded = true;
    const citizensWon = game.winner === 'citizens';
    const avgOpponentLevel =
      game.players.reduce((s, p) => s + Economy.levelFromXp(this.users.get(p.id)?.xp || 0), 0) /
      Math.max(1, game.players.length);

    for (const p of game.players) {
      const rec = this.ensureUser(p.id, p.name);
      const won = citizensWon ? p.role !== 'mafia' : p.role === 'mafia';
      rec.mfGames = (rec.mfGames || 0) + 1;
      rec.onlineGames = (rec.onlineGames || 0) + 1;
      rec.points = (rec.points || 0) + (won ? 5 : 1);
      if (won) {
        rec.mfWins = (rec.mfWins || 0) + 1;
        rec.onlineWins = (rec.onlineWins || 0) + 1;
        const money = Economy.moneyForWin({
          gameId: 'mafia',
          performance: p.alive ? 1 : 0.7,
          level: Economy.levelFromXp(rec.xp || 0),
          opponentLevel: avgOpponentLevel,
          earnedToday: Economy.earnedToday(rec)
        });
        if (money > 0) {
          rec.money = Economy.roundMoney((rec.money || 0) + money);
          Economy.addEarned(rec, money);
        }
        rec.xp = (rec.xp || 0) + Economy.xpForResult('mafia', true, p.alive ? 1 : 0.7);
      } else {
        rec.xp = (rec.xp || 0) + Economy.xpForResult('mafia', false, 0.5);
      }
      this.users.set(rec.id, rec);
    }
  }

  private async handleMafiaCb(cb: TelegramCallbackQuery, data: string) {
    const userId = String(cb.from.id);
    const userName = cb.from.first_name + (cb.from.last_name ? ` ${cb.from.last_name}` : '');

    // حركات الليل بالخاص: mfn:k|s|c:<chatId>:<targetIdx>
    if (data.startsWith('mfn:')) {
      const parts = data.split(':');
      const action = parts[1];
      const targetIdx = parseInt(parts[parts.length - 1], 10);
      const gameChatId = parts.slice(2, -1).join(':');
      const game = this.mafiaGames.get(gameChatId);
      if (!game || game.status !== 'night') {
        await this.answerCallbackQuery(cb.id, 'انتهت الليلة بالفعل.', true);
        return;
      }
      const actor = game.players.find(p => p.id === userId && p.alive);
      const target = game.players[targetIdx];
      if (!actor || !target || !target.alive) {
        await this.answerCallbackQuery(cb.id, 'اختيار غير متاح.', true);
        return;
      }

      if (action === 'k' && actor.role === 'mafia') {
        game.nightKills[actor.id] = target.id;
        if (cb.message?.message_id) {
          await this.editMessageText(userId, cb.message.message_id, `🔪 اخترت تصفية: *${this.mdSafe(target.name)}*`);
        }
        await this.answerCallbackQuery(cb.id, `🔪 تم اختيار ${target.name}`);
      } else if (action === 's' && actor.role === 'doctor') {
        game.doctorSave = target.id;
        if (cb.message?.message_id) {
          await this.editMessageText(userId, cb.message.message_id, `🩺 اخترت حماية: *${this.mdSafe(target.name)}*`);
        }
        await this.answerCallbackQuery(cb.id, `🩺 تمت حماية ${target.name}`);
      } else if (action === 'c' && actor.role === 'detective') {
        game.detectiveChecked = true;
        const verdict = target.role === 'mafia' ? '🔪 مافيا!' : '✅ بريء';
        game.detectiveNotes.push(`${target.name}: ${verdict}`);
        if (cb.message?.message_id) {
          await this.editMessageText(
            userId,
            cb.message.message_id,
            `🔍 نتيجة فحص *${this.mdSafe(target.name)}*: *${verdict}*`
          );
        }
        await this.answerCallbackQuery(cb.id, `🔍 ${target.name}: ${verdict}`, true);
      } else {
        await this.answerCallbackQuery(cb.id, 'غير مسموح.', true);
        return;
      }

      if (MF.isNightComplete(game)) {
        const nextSt = MF.resolveNight(game);
        if (nextSt === 'finished') this.recordMafiaFinish(game);
        await this.paintMafia(game);
      }
      this.scheduleLocalQuizTimer();
      return;
    }

    // أزرار القناة: mf:j|s|r|v|n:<chatId>[:extra]
    const parts = data.split(':');
    const op = parts[1];
    const hasExtra = op === 'v';
    const extra = hasExtra ? parts[parts.length - 1] : '';
    const rawChat = hasExtra ? parts.slice(2, -1).join(':') : parts.slice(2).join(':');
    const chatId = rawChat === 'auto' || !rawChat ? String(cb.message?.chat.id || '') : rawChat;
    if (!chatId) return;

    let game = this.mafiaGames.get(chatId);
    if (!game && (op === 'j' || op === 'n')) {
      game = MF.createMafiaLobby(chatId, cb.message?.chat.title || 'المحادثة', userId);
      if (cb.message?.message_id && op === 'j') game.messageId = cb.message.message_id;
      this.mafiaGames.set(chatId, game);
    }

    if (op === 'n') {
      const fresh = MF.createMafiaLobby(chatId, cb.message?.chat.title || 'المحادثة', userId);
      MF.mafiaJoin(fresh, userId, userName);
      this.mafiaGames.set(chatId, fresh);
      const botUser = await this.getBotUsername();
      const sent = await this.sendMessage(
        chatId,
        await this.withBotFooter(MF.renderMafiaBoard(fresh), true),
        MF.mafiaBoardKeyboard(fresh, botUser),
        'MarkdownV2'
      );
      if (sent?.result?.message_id) {
        fresh.messageId = sent.result.message_id;
        this.mafiaGames.set(chatId, fresh);
      }
      await this.answerCallbackQuery(cb.id, '🕵️ تم فتح لوبي مافيا جديد!');
      return;
    }

    if (!game) {
      await this.answerCallbackQuery(cb.id, 'انتهت هذه الجولة.', true);
      return;
    }
    if (cb.message?.message_id && !game.messageId) game.messageId = cb.message.message_id;

    if (op === 'j') {
      const r = MF.mafiaJoin(game, userId, userName);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      if (r.ok) await this.paintMafia(game);
      return;
    }

    if (op === 's') {
      const r = MF.mafiaStart(game);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      if (r.ok) {
        // نرسل لكل لاعب دوره السري بالخاص + قائمة الحركة الليلية للأدوار الليلية
        for (const p of game.players) {
          await this.sendMessage(p.id, MF.secretRolePopupText(game, p.id));
        }
        await this.sendMafiaNightPrompts(game);
        await this.paintMafia(game);
        this.scheduleLocalQuizTimer();
      }
      return;
    }

    if (op === 'r') {
      const popup = MF.secretRolePopupText(game, userId);
      const me = game.players.find(p => p.id === userId);
      if (me && game.status === 'night') {
        const prompt = MF.buildNightDmPrompt(game, me);
        if (prompt) {
          await this.sendMessage(userId, prompt.text, prompt.keyboard);
        }
      }
      await this.answerCallbackQuery(cb.id, popup, true);
      return;
    }

    if (op === 'v') {
      const targetId = extra === 'skip' ? 'skip' : game.players[parseInt(extra, 10)]?.id || '';
      const r = MF.mafiaVoteDay(game, userId, targetId);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      if (r.ok) {
        if (r.allVoted) {
          const nextSt = MF.resolveDay(game);
          if (nextSt === 'finished') {
            this.recordMafiaFinish(game);
          } else if (nextSt === 'night') {
            await this.sendMafiaNightPrompts(game);
          }
        }
        await this.paintMafia(game);
        this.scheduleLocalQuizTimer();
      }
      return;
    }
  }

  // ---------------------------------------------------------------------
  // 🎭 «منو برا السالفة؟» — لعبة جماعية بالقناة
  // ---------------------------------------------------------------------

  private async paintOOL(game: OOL.OOLGame) {
    const text = await this.withBotFooter(OOL.renderOOLBoard(game), true);
    const kb = OOL.oolBoardKeyboard(game);
    if (game.messageId) {
      const res = await this.editMessageText(game.chatId, game.messageId, text, kb, 'MarkdownV2');
      if (res?.ok || String(res?.description || '').includes('not modified')) return;
    }
    const sent = await this.sendMessage(game.chatId, text, kb, 'MarkdownV2');
    if (sent?.result?.message_id) {
      game.messageId = sent.result.message_id;
      this.oolGames.set(game.chatId, game);
    }
  }

  private recordOOLFinish(game: OOL.OOLGame) {
    if (game.rewarded || !game.players.length) return;
    game.rewarded = true;
    const topScore = Math.max(0, ...game.players.map(p => p.score));
    const avgOpponentLevel =
      game.players.reduce((s, p) => s + Economy.levelFromXp(this.users.get(p.id)?.xp || 0), 0) /
      Math.max(1, game.players.length);

    for (const p of game.players) {
      const rec = this.ensureUser(p.id, p.name);
      const won = topScore > 0 && p.score === topScore;
      rec.oolGames = (rec.oolGames || 0) + 1;
      rec.onlineGames = (rec.onlineGames || 0) + 1;
      rec.points = (rec.points || 0) + p.score + (won ? 3 : 0);
      if (won) {
        rec.oolWins = (rec.oolWins || 0) + 1;
        rec.onlineWins = (rec.onlineWins || 0) + 1;
        const money = Economy.moneyForWin({
          gameId: 'out_of_loop',
          performance: Math.min(1, Math.max(0.5, p.score / 3)),
          level: Economy.levelFromXp(rec.xp || 0),
          opponentLevel: avgOpponentLevel,
          earnedToday: Economy.earnedToday(rec)
        });
        if (money > 0) {
          rec.money = Economy.roundMoney((rec.money || 0) + money);
          Economy.addEarned(rec, money);
        }
        rec.xp = (rec.xp || 0) + Economy.xpForResult('out_of_loop', true, 0.9);
      } else {
        rec.xp = (rec.xp || 0) + Economy.xpForResult('out_of_loop', false, 0.5);
      }
      this.users.set(rec.id, rec);
    }
  }

  private async handleOOLCb(cb: TelegramCallbackQuery, data: string) {
    const userId = String(cb.from.id);
    const userName = cb.from.first_name + (cb.from.last_name ? ` ${cb.from.last_name}` : '');
    const parts = data.split(':');
    const op = parts[1];
    const hasIdx = op === 'v' || op === 'g';
    const idx = hasIdx ? parseInt(parts[parts.length - 1], 10) : -1;
    const rawChat = hasIdx ? parts.slice(2, -1).join(':') : parts.slice(2).join(':');
    const chatId = rawChat === 'auto' || !rawChat ? String(cb.message?.chat.id || '') : rawChat;
    if (!chatId) return;

    let game = this.oolGames.get(chatId);
    if (!game && op === 'j') {
      game = OOL.createOOLLobby(chatId, cb.message?.chat.title || 'المحادثة', userId);
      if (cb.message?.message_id) game.messageId = cb.message.message_id;
      this.oolGames.set(chatId, game);
    }

    if (op === 'n') {
      const fresh = OOL.createOOLLobby(chatId, cb.message?.chat.title || 'المحادثة', userId);
      OOL.oolJoin(fresh, userId, userName);
      this.oolGames.set(chatId, fresh);
      const sent = await this.sendMessage(
        chatId,
        await this.withBotFooter(OOL.renderOOLBoard(fresh), true),
        OOL.oolBoardKeyboard(fresh),
        'MarkdownV2'
      );
      if (sent?.result?.message_id) {
        fresh.messageId = sent.result.message_id;
        this.oolGames.set(chatId, fresh);
      }
      await this.answerCallbackQuery(cb.id, '🎭 تم فتح جولة جديدة!');
      return;
    }

    if (!game) {
      await this.answerCallbackQuery(cb.id, 'انتهت هذه الجولة.', true);
      return;
    }
    if (cb.message?.message_id && !game.messageId) game.messageId = cb.message.message_id;

    if (op === 'j') {
      const r = OOL.oolJoin(game, userId, userName);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      if (r.ok) await this.paintOOL(game);
      return;
    }

    if (op === 's') {
      const r = OOL.oolStart(game);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      if (r.ok) {
        for (const p of game.players) {
          await this.sendMessage(p.id, OOL.oolSecretPopup(game, p.id));
        }
        await this.paintOOL(game);
        this.scheduleLocalQuizTimer();
      }
      return;
    }

    if (op === 'sec') {
      await this.answerCallbackQuery(cb.id, OOL.oolSecretPopup(game, userId), true);
      return;
    }

    if (op === 'v') {
      const r = OOL.oolVote(game, userId, idx);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      if (r.ok) {
        if (r.allVoted) {
          OOL.oolFinishVoting(game);
        }
        await this.paintOOL(game);
        this.scheduleLocalQuizTimer();
      }
      return;
    }

    if (op === 'g') {
      const r = OOL.oolOutsiderGuess(game, userId, idx);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok || Boolean(r.msg));
      if (r.ok) {
        this.recordOOLFinish(game);
        await this.paintOOL(game);
        this.scheduleLocalQuizTimer();
      }
      return;
    }
  }

  private findActiveWKForUser(userId: string): WK.WKGame | undefined {
    for (const g of this.wkGames.values()) {
      if ((g.status === 'answering' || g.status === 'guessing') && g.players.some(p => p.id === userId)) {
        const p = g.players.find(x => x.id === userId)!;
        if (g.status === 'answering' && p.answers.length < g.questions.length) return g;
        if (g.status === 'guessing' && p.guesses.length < g.questions.length) return g;
      }
    }
    return undefined;
  }

  private async paintWKBoard(game: WK.WKGame, notice?: string) {
    const botUser = await this.getBotUsername();
    const text = await this.withBotFooter(WK.renderWKBoard(game, notice), true);
    const kb = WK.wkBoardKeyboard(game, botUser);

    if (game.inlineMessageId && !game.messageId) {
      await this.editInlineMessageText(game.inlineMessageId, text, kb, 'MarkdownV2');
      return;
    }
    if (game.messageId) {
      const res = await this.editMessageText(game.chatId, game.messageId, text, kb, 'MarkdownV2');
      if (res?.ok || String(res?.description || '').includes('not modified')) return;
    }
    const sent = await this.sendMessage(game.chatId, text, kb, 'MarkdownV2');
    if (sent?.result?.message_id) {
      game.messageId = sent.result.message_id;
      this.wkGames.set(game.chatId, game);
    }
  }

  private async sendWKCurrentPrompt(game: WK.WKGame, userId: string, editMsgId?: number) {
    const player = game.players.find(p => p.id === userId);
    const prompt = WK.renderWKPrompt(game, userId);
    if (!player || !prompt) return;

    // في مرحلة التخمين: نحدّث نفس الرسالة بمكانها (editMessageText) بدل إرسال رسائل متكررة
    if (game.status === 'guessing') {
      const targetMsgId = editMsgId || player.guessMsgId;
      if (targetMsgId) {
        const edited = await this.editMessageText(userId, targetMsgId, prompt.text, prompt.keyboard, 'MarkdownV2');
        if (edited?.ok || String(edited?.description || '').includes('not modified')) {
          player.guessMsgId = targetMsgId;
          this.wkGames.set(game.chatId, game);
          return;
        }
      }
      const sent = await this.sendMessage(userId, prompt.text, prompt.keyboard, 'MarkdownV2');
      if (sent?.result?.message_id) {
        player.guessMsgId = sent.result.message_id;
        this.wkGames.set(game.chatId, game);
      }
      return;
    }

    await this.sendMessage(userId, prompt.text, prompt.keyboard, 'MarkdownV2');
  }

  private recordWhoKnowsFinish(game: WK.WKGame) {
    if (game.rewarded || game.players.length < 2) return;
    game.rewarded = true;

    const avgLevel =
      game.players.reduce((acc, p) => acc + Economy.levelFromXp(this.users.get(p.id)?.xp || 0), 0) / 2;

    for (const p of game.players) {
      const rec = this.ensureUser(p.id, p.name);
      const won = Boolean(game.winnerId && game.winnerId === p.id);
      rec.wkGames = (rec.wkGames || 0) + 1;
      rec.wkCorrect = (rec.wkCorrect || 0) + p.score;
      rec.points = (rec.points || 0) + p.score * 2 + (won ? 3 : 0);
      rec.onlineGames = (rec.onlineGames || 0) + 1;

      const perf = Math.min(1, Math.max(0.3, p.score / Math.max(1, game.questions.length)));
      if (won) {
        rec.wkWins = (rec.wkWins || 0) + 1;
        rec.onlineWins = (rec.onlineWins || 0) + 1;
        const money = Economy.moneyForWin({
          gameId: 'who_knows',
          performance: perf,
          level: Economy.levelFromXp(rec.xp || 0),
          opponentLevel: avgLevel,
          earnedToday: Economy.earnedToday(rec)
        });
        if (money > 0) {
          rec.money = Economy.roundMoney((rec.money || 0) + money);
          Economy.addEarned(rec, money);
        }
        rec.xp = (rec.xp || 0) + Economy.xpForResult('who_knows', true, perf);
      } else {
        rec.xp = (rec.xp || 0) + Economy.xpForResult('who_knows', false, perf);
      }
      this.users.set(rec.id, rec);
    }
  }

  private async startWhoKnowsGame(game: WK.WKGame): Promise<{ started: boolean; missingNames: string[] }> {
    const missing: string[] = [];
    for (const p of game.players) {
      if (p.dmReady) continue;
      const ok = await this.canReachPrivate(p.id);
      if (ok) p.dmReady = true;
      else missing.push(p.name);
    }
    if (missing.length) {
      return { started: false, missingNames: missing };
    }

    game.status = 'answering';
    game.updatedAt = Date.now();
    this.wkGames.set(game.chatId, game);
    await this.paintWKBoard(game);
    for (const p of game.players) {
      await this.sendWKCurrentPrompt(game, p.id);
    }
    return { started: true, missingNames: [] };
  }

  private async handleWhoKnowsPrivateReady(dmChatId: string, sender: TelegramUser | undefined, targetChatId: string) {
    if (!sender) return;
    this.trackUser(sender, true);
    const uid = String(sender.id);
    const game = this.wkGames.get(targetChatId);

    if (!game) {
      await this.sendMessage(dmChatId, '✅ تم فتح الخاص بنجاح! ارجع للقناة وانضم للتحدي.');
      return;
    }

    const player = game.players.find(p => p.id === uid);
    if (!player) {
      // إذا بعد اكو مقعد شاغر باللوبي، نضمّه مباشرة لراحته!
      if (game.status === 'lobby' && game.players.length < 2) {
        WK.wkJoin(game, uid, sender.first_name || 'لاعب');
        const joined = game.players.find(p => p.id === uid);
        if (joined) joined.dmReady = true;
        this.wkGames.set(game.chatId, game);
        await this.paintWKBoard(game);
        await this.sendMessage(dmChatId, '✅ انضميت للتحدي وتم تفعيل الخاص! بانتظار اكتمال اللاعب الثاني.');
        return;
      }
      await this.sendMessage(dmChatId, '✅ تم تفعيل الخاص بنجاح!');
      return;
    }

    player.dmReady = true;
    this.wkGames.set(game.chatId, game);

    if (game.status === 'lobby' && game.players.length === 2) {
      const res = await this.startWhoKnowsGame(game);
      if (!res.started) {
        await this.sendMessage(
          dmChatId,
          `✅ خاصك جاهز! بانتظار فتح الخاص من الطرف الثاني (${res.missingNames.join('، ')}).`
        );
      }
      return;
    }

    if (game.status === 'answering' || game.status === 'guessing') {
      await this.sendWKCurrentPrompt(game, uid);
      return;
    }

    await this.sendMessage(dmChatId, '✅ خاصك جاهز! بانتظار انضمام اللاعب الثاني وبدء التحدي.');
  }

  private async advanceWhoKnowsStep(game: WK.WKGame, userId: string, rawInput: string, editMsgId?: number) {
    if (game.status === 'answering') {
      const res = WK.wkSubmitSelfAnswer(game, userId, rawInput);
      if (!res.ok) return;
      this.wkGames.set(game.chatId, game);
      await this.paintWKBoard(game);

      if (res.phaseComplete) {
        const partner = WK.wkPartner(game, userId);
        if (partner) {
          partner.guessMsgId = undefined;
          await this.sendWKCurrentPrompt(game, partner.id);
        }
        const me = game.players.find(p => p.id === userId);
        if (me) me.guessMsgId = undefined;
        await this.sendWKCurrentPrompt(game, userId);
        return;
      }

      if (res.playerDone) {
        await this.sendMessage(
          userId,
          '✅ تم تثبيت جميع إجاباتك السرية عند البوت 🔒\n⏳ بانتظار إكمال الطرف الثاني حتى تبدأ مرحلة التخمين!'
        );
        return;
      }

      await this.sendWKCurrentPrompt(game, userId);
      return;
    }

    if (game.status === 'guessing') {
      const player = game.players.find(p => p.id === userId);
      const res = WK.wkSubmitGuess(game, userId, rawInput);
      if (!res.ok) return;
      if (player && editMsgId) player.guessMsgId = editMsgId;
      this.wkGames.set(game.chatId, game);

      if (res.gameOver) {
        this.recordWhoKnowsFinish(game);
        await this.paintWKBoard(game);
        const privateReveal = await this.withBotFooter(WK.renderWKPrivateReveal(game), true);
        for (const p of game.players) {
          if (p.guessMsgId) {
            const edited = await this.editMessageText(p.id, p.guessMsgId, privateReveal, [], 'MarkdownV2');
            if (edited?.ok || String(edited?.description || '').includes('not modified')) continue;
          }
          await this.sendMessage(p.id, privateReveal, [], 'MarkdownV2');
        }
        return;
      }

      await this.paintWKBoard(game);
      if (res.playerDone) {
        const waitText =
          `✅ *أنهيت تخمين جميع البطاقات\\!*\n` +
          `⏳ _بانتظار انتهاء الطرف الثاني حتى توصلكم بطاقات الكشف هنا بالخاص_ 🃏`;
        const targetId = editMsgId || player?.guessMsgId;
        if (targetId) {
          const edited = await this.editMessageText(userId, targetId, waitText, [], 'MarkdownV2');
          if (edited?.ok || String(edited?.description || '').includes('not modified')) return;
        }
        const sent = await this.sendMessage(userId, waitText, [], 'MarkdownV2');
        if (player && sent?.result?.message_id) {
          player.guessMsgId = sent.result.message_id;
          this.wkGames.set(game.chatId, game);
        }
        return;
      }

      await this.sendWKCurrentPrompt(game, userId, editMsgId || player?.guessMsgId);
    }
  }

  private async tryHandleWhoKnowsText(sender: TelegramUser, text: string): Promise<boolean> {
    const uid = String(sender.id);
    const game = this.findActiveWKForUser(uid);
    if (!game) return false;
    await this.advanceWhoKnowsStep(game, uid, text);
    return true;
  }

  private async handleWhoKnowsCb(cb: TelegramCallbackQuery, data: string) {
    const uid = String(cb.from.id);
    const uname = cb.from.first_name || 'لاعب';

    // أزرار الإجابة/التخمين بالخاص: wkp:a:<chatId>:<qIdx>:<sIdx> أو wkp:g:<chatId>:<qIdx>:<tag>
    if (data.startsWith('wkp:')) {
      const parts = data.split(':');
      const mode = parts[1];
      const gChatId = parts[2] || '';
      const qIdx = parseInt(parts[3] || '0', 10);
      const token = parts[4] || '';
      const game = this.wkGames.get(gChatId);
      if (!game) {
        await this.answerCallbackQuery(cb.id, 'انتهت هذه الجولة', true);
        return;
      }
      const player = game.players.find(p => p.id === uid);
      const other = WK.wkPartner(game, uid);
      if (!player || !other) {
        await this.answerCallbackQuery(cb.id, 'غير مشارك في هذه الجولة', true);
        return;
      }

      if (mode === 'g') {
        if (game.status !== 'guessing' || player.guesses.length !== qIdx) {
          await this.answerCallbackQuery(cb.id, 'تم تخمين هذه البطاقة مسبقاً ✅');
          return;
        }
        const sets = WK.ensureChoiceSets(game, player);
        const cIdx = parseInt(token, 10);
        const chosen = !Number.isNaN(cIdx) ? sets[qIdx]?.[cIdx] || '' : '';
        if (!chosen) {
          await this.answerCallbackQuery(cb.id, '');
          return;
        }
        await this.answerCallbackQuery(cb.id, `🃏 اخترت: ${chosen}`);
        await this.advanceWhoKnowsStep(game, uid, chosen, cb.message?.message_id);
        return;
      }
      return;
    }

    // أزرار لوحة القناة: wkj:<chatId> / wks:<chatId> / wkn:<chatId>
    const tailId = data.split(':').slice(-1)[0] || '';
    const gChatId = /^-?\d{4,}$/.test(tailId) ? tailId : String(cb.message?.chat.id || '');
    let game = this.wkGames.get(gChatId);

    if (!game) {
      if (!gChatId) {
        await this.answerCallbackQuery(cb.id, 'لوحة قديمة — انشر اللعبة مجدداً', true);
        return;
      }
      game = WK.createWKGame(gChatId, cb.message?.chat.title || 'المحادثة');
      if (cb.message?.message_id) game.messageId = cb.message.message_id;
      if (cb.inline_message_id) game.inlineMessageId = cb.inline_message_id;
      this.wkGames.set(gChatId, game);
    }

    if (cb.inline_message_id && !game.inlineMessageId) {
      game.inlineMessageId = cb.inline_message_id;
    }

    if (data.startsWith('wkj:')) {
      const r = WK.wkJoin(game, uid, uname);
      this.wkGames.set(gChatId, game);
      await this.answerCallbackQuery(cb.id, r.msg, !r.ok);
      if (r.ok) await this.paintWKBoard(game);
      return;
    }

    if (data.startsWith('wks:')) {
      if (game.status !== 'lobby') {
        await this.answerCallbackQuery(cb.id, 'التحدي جارٍ بالفعل');
        return;
      }
      if (game.players.length < 2) {
        await this.answerCallbackQuery(cb.id, 'يجب انضمام لاعبين اثنين أولاً', true);
        return;
      }
      const res = await this.startWhoKnowsGame(game);
      if (!res.started) {
        await this.paintWKBoard(
          game,
          `يجب على (${res.missingNames.join('، ')}) الضغط على «افتح الخاص مع البوت» أولاً`
        );
        await this.answerCallbackQuery(
          cb.id,
          `لازم ${res.missingNames.join(' و ')} يفتحون الخاص مع البوت أولاً 💬`,
          true
        );
        return;
      }
      await this.answerCallbackQuery(cb.id, '🚀 بدأ التحدي! تفقدوا الخاص الآن 💬');
      return;
    }

    if (data.startsWith('wkn:')) {
      const fresh = WK.createWKGame(game.chatId, game.chatTitle || 'المحادثة');
      WK.wkJoin(fresh, uid, uname);
      this.wkGames.set(game.chatId, fresh);
      const botUser = await this.getBotUsername();
      const sent = game.chatId
        ? await this.sendMessage(
            game.chatId,
            await this.withBotFooter(WK.renderWKBoard(fresh), true),
            WK.wkBoardKeyboard(fresh, botUser),
            'MarkdownV2'
          )
        : null;
      if (sent?.ok && sent.result?.message_id) {
        fresh.messageId = sent.result.message_id;
        this.wkGames.set(game.chatId, fresh);
      } else {
        fresh.messageId = game.messageId;
        fresh.inlineMessageId = game.inlineMessageId;
        this.wkGames.set(game.chatId, fresh);
        await this.paintWKBoard(fresh);
      }
      await this.answerCallbackQuery(cb.id, '🔄 تحدٍّ جديد — بانتظار اللاعب الثاني!');
      return;
    }
  }

  // ---------------------------------------------------------------------
  // ✊✋✌️ حجرة ورقة مقص
  // ---------------------------------------------------------------------

  /** تحديث رسالة لوحة RPS بالقناة */
  private async paintRPSBoard(game: RPS.RPSGame) {
    const text = await this.withBotFooter(RPS.renderGame(game), true);
    const keyboard = RPS.boardKeyboard(game);
    if (game.messageId) {
      await this.editMessageText(game.chatId, game.messageId, text, keyboard, 'MarkdownV2');
    } else {
      const sent = await this.sendMessage(game.chatId, text, keyboard, 'MarkdownV2');
      const msgId = sent?.result?.message_id;
      if (msgId) game.messageId = msgId;
      this.rpsGames.set(game.chatId, game);
    }
  }

  /** أزرار لوحة حجرة ورقة مقص (انضم/ابدأ/حركة/جديدة) */
  private async handleRPSBoard(cb: TelegramCallbackQuery, body: string) {
    const parts = body.split(':');
    const action = parts[0];
    const chatId = parts.slice(1).join(':');
    const game = this.rpsGames.get(chatId);
    const userId = String(cb.from.id);
    const userName = cb.from.first_name || 'لاعب';

    if (!game) {
      await this.answerCallbackQuery(cb.id, 'خلصت هاي المباراة — ابدأ وحدة جديدة.', true);
      return;
    }

    if (action === 'join') {
      const before = game.players.length;
      const next = RPS.join(game, userId, userName);
      this.rpsGames.set(chatId, next);
      if (next.players.length === before) {
        await this.answerCallbackQuery(cb.id, 'ما گدرت تنضم (اللعبة فل أو بدأت)', true);
      } else {
        await this.answerCallbackQuery(cb.id, '✅ انضميت!');
      }
      await this.paintRPSBoard(next);
      return;
    }

    if (action === 'start') {
      if (game.status !== 'lobby') {
        await this.answerCallbackQuery(cb.id, 'المباراة شغّالة بالفعل', true);
        return;
      }
      if (game.players.length < 2) {
        await this.answerCallbackQuery(cb.id, 'يحتاج لاعبين اثنين', true);
        return;
      }
      const started = RPS.start(game);
      this.rpsGames.set(chatId, started);
      await this.answerCallbackQuery(cb.id, '🚀 بدت المباراة!');
      await this.paintRPSBoard(started);
      return;
    }

    if (action === 'pick') {
      // نرسل أزرار الحركة بالخاص للاعب
      const player = game.players.find(p => p.id === userId);
      if (!player) {
        await this.answerCallbackQuery(cb.id, 'إنت مو منضم للمباراة', true);
        return;
      }
      await this.sendMessage(userId, '✊✋✌️ اختر حركتك:', RPS.moveKeyboard(chatId));
      await this.answerCallbackQuery(cb.id, '📩 شيك الخاص');
      return;
    }

    if (action === 'again') {
      const fresh = RPS.createGame(chatId, game.chatTitle, game.totalRounds);
      this.rpsGames.set(chatId, fresh);
      await this.answerCallbackQuery(cb.id, '🔄 مباراة جديدة');
      await this.paintRPSBoard(fresh);
      return;
    }

    await this.answerCallbackQuery(cb.id, '');
  }

  /** اختيار حجرة/ورقة/مقص مباشرة من أزرار لوحة القناة (بلا رسالة خاصة) */
  private async handleRPSMove(cb: TelegramCallbackQuery, body: string) {
    const parts = body.split(':');
    const move = parts[0] as RPS.RPSMove;
    const chatId = parts.slice(1).join(':');
    const game = this.rpsGames.get(chatId);
    const userId = String(cb.from.id);

    if (!game || game.status !== 'playing') {
      await this.answerCallbackQuery(cb.id, 'المباراة مو شغّالة', true);
      return;
    }

    const player = game.players.find(p => p.id === userId);
    if (!player) {
      await this.answerCallbackQuery(cb.id, 'إنت مو منضم للمباراة', true);
      return;
    }

    // اللاعب مختار بالفعل هالجولة؟ نمنع التبديل بعد الكشف اللحظي
    if (player.move) {
      await this.answerCallbackQuery(cb.id, `✅ اخترت ${RPS.MOVE_LABEL[player.move]} — انتظر الخصم`, true);
      return;
    }

    let next = RPS.setMove(game, userId, move);
    let reveal = false;
    if (RPS.allMoved(next)) {
      next = RPS.resolveRound(next);
      reveal = true;
    }
    this.rpsGames.set(chatId, next);

    // التوست يطلع للضاغط بس — الحركة تبقى سرية لحد ما يختار الثاني
    await this.answerCallbackQuery(cb.id, `✅ اخترت ${RPS.MOVE_LABEL[move]}`);
    // حدّث لوحة القناة: يبين من اختار (بدون كشف حركته) أو تكشف نتيجة الجولة
    await this.paintRPSBoard(next);

    // خلصت المباراة؟ نوزع الجوائز
    if (reveal && next.status === 'game_over') {
      await this.awardRPS(next);
    }
  }

  /** توزيع الفلوس/XP والإحصائيات على لاعبي حجرة ورقة مقص */
  private async awardRPS(game: RPS.RPSGame) {
    const winner = game.players.find(p => p.id === game.winnerId);
    for (const p of game.players) {
      const rec = this.ensureUser(p.id, p.name);
      const won = p.id === game.winnerId;
      rec.rpsGames = (rec.rpsGames || 0) + 1;
      if (won) rec.rpsWins = (rec.rpsWins || 0) + 1;
      rec.points = (rec.points || 0) + (won ? 2 : 0);
      rec.onlineGames = (rec.onlineGames || 0) + 1;
      if (won) rec.onlineWins = (rec.onlineWins || 0) + 1;

      const xp = Economy.xpForResult('rps', won, 1);
      rec.xp = (rec.xp || 0) + xp;
      if (won) {
        // فلوس RPS ضئيلة جداً وبس ضمن سقف يومي صغير خاص فيها
        const today = Economy.earnedToday(rec);
        const room = Math.max(0, Economy.RPS_DAILY_CAP - today);
        const gain = Math.min(Economy.RPS_REWARD, room);
        if (gain > 0) {
          rec.money = Economy.roundMoney((rec.money || 0) + gain);
          Economy.addEarned(rec, gain);
        }
      }
      this.users.set(rec.id, rec);
    }

    if (winner) {
      const rec = this.users.get(winner.id);
      const capped = Boolean(rec) && Economy.earnedToday(rec!) >= Economy.RPS_DAILY_CAP;
      const moneyLine = capped
        ? `🔒 وصلت السقف اليومي لفلوس حجرة ورقة`
        : `+${Economy.formatMoney(Economy.RPS_REWARD)} 💵`;
      await this.sendMessage(
        winner.id,
        `🏆 *فزت بمباراة حجرة ورقة مقص!*\n${moneyLine}\n+${Economy.xpForResult('rps', true, 1)} XP`
      );
    }
    const loser = game.players.find(p => p.id !== game.winnerId);
    if (loser) {
      await this.sendMessage(
        loser.id,
        `😅 *خسرت مباراة حجرة ورقة مقص.*\n+${Economy.xpForResult('rps', false, 1)} XP\nجرّب مرة ثانية!`
      );
    }
  }

  /**
   * Private /start welcome, with a button that lets the user pick a channel to play in.
   */
  private async sendPrivateWelcome(chatId: string, userName: string) {
    // بالخاص: نعرض للاعب حالته (مستواه + فلوسه + تعليق قصير) تحت عنوان الألعاب
    const rec = this.users.get(String(chatId));
    const view = await this.buildGamesMenu('main', rec);
    const welcome = `👋 *أهلاً بك*\n${this.quoteRow('', userName)}\n\n${view.text}`;
    await this.sendMessage(
      chatId,
      GG.toV2(await this.withBotFooter(welcome, true)),
      view.keyboard,
      'MarkdownV2'
    );
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

    // شنو اللعبة اللي اختارها المستخدم؟
    const pending = byUser ? this.pendingChannelGame.get(byUser) : undefined;
    if (byUser) this.pendingChannelGame.delete(byUser);
    // نتجاهل الاختيار القديم (أكثر من 15 دقيقة) حتى ما ينشر لعبة غلط
    const fresh = pending && Date.now() - pending.at < 15 * 60 * 1000 ? pending : undefined;

    const res = await this.deployGameToChannel(channelId, title, message.from?.id, fresh?.gameId, fresh?.rounds);

    if (!byUser) return;
    await this.sendMessage(byUser, res.text);

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
    // لا ننشئ لوحة كودنيمز إذا أكو مباراة حجرة ورقة مقص شغّالة بهذي القناة
    const rps = this.rpsGames.get(chatId);
    if (rps && rps.status !== 'game_over') return;

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
      `${CodenamesEngine.nameTag(userName)} (${teamName}) قال: «${this.mdSafe(pending.word)}» × ${count}`
    );
  }

  /**
   * Update or Edit existing Telegram Game Board message.
   * Single-message mode: we always try to EDIT the same board message.
   * A new message is only sent if the old one was deleted from the chat.
   */
  private async updateTelegramGameBoard(chatId: string, game: CodenamesGame, messageId?: number, lastEvent?: string) {
    const msgId = messageId || game.messageId;
    const text = GG.toV2(await this.withBotFooter(CodenamesEngine.getTelegramMessageText(game, lastEvent), true));
    const keyboard = await this.buildKeyboard(game);

    // لوحة أصلها إنلاين وما عدنا رقم الرسالة بالمحادثة؟ نعدّلها بمعرّف الإنلاين
    if (!msgId && (game as any).inlineMessageId) {
      const res = await this.editInlineMessageText((game as any).inlineMessageId, text, keyboard, 'MarkdownV2');
      if (res?.ok || String(res?.description || '').includes('not modified')) return;
    }

    if (msgId) {
      const res = await this.editMessageText(chatId, msgId, text, keyboard, 'MarkdownV2');

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

    const sent = await this.sendMessage(chatId, text, keyboard, 'MarkdownV2');
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
    await this.sendMessage(String(game.createdBy), GG.toV2(text), undefined, 'MarkdownV2');
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
      [{ text: '🖼️ تثبيت وإرسال لوغو البوت (1024×1024)', callback_data: 'admin:avatar' }],
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
  public async sendMessage(chatId: string, text: string, inlineKeyboard?: any[][], parseMode: string = 'Markdown'): Promise<any> {
    if (!this.token) return null;

    try {
      const body: any = {
        chat_id: chatId,
        text,
        parse_mode: parseMode
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
  public async editMessageText(chatId: string, messageId: number, text: string, inlineKeyboard?: any[][], parseMode: string = 'Markdown'): Promise<any> {
    if (!this.token) return null;

    try {
      const body: any = {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: parseMode
      };

      if (inlineKeyboard) {
        body.reply_markup = { inline_keyboard: inlineKeyboard };
      }

      let res = await fetch(`https://api.telegram.org/bot${this.token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      let data: any = await res.json();
      if (!data?.ok && data?.error_code === 429) {
        const waitSec = Number(data?.parameters?.retry_after || 0);
        if (waitSec > 0 && waitSec <= 5) {
          await this.sleep(waitSec * 1000 + 150);
          res = await fetch(`https://api.telegram.org/bot${this.token}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          data = await res.json();
        }
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  /** تعديل رسالة أصلها إنلاين (بدون chat_id — بمعرّف الإنلاين فقط) */
  public async editInlineMessageText(inlineMessageId: string, text: string, inlineKeyboard?: any[][], parseMode: string = 'Markdown'): Promise<any> {
    if (!this.token) return null;

    try {
      const body: any = {
        inline_message_id: inlineMessageId,
        text,
        parse_mode: parseMode
      };

      if (inlineKeyboard) {
        body.reply_markup = { inline_keyboard: inlineKeyboard };
      }

      let res = await fetch(`https://api.telegram.org/bot${this.token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      let data: any = await res.json();
      if (!data?.ok && data?.error_code === 429) {
        const waitSec = Number(data?.parameters?.retry_after || 0);
        if (waitSec > 0 && waitSec <= 5) {
          await this.sleep(waitSec * 1000 + 150);
          res = await fetch(`https://api.telegram.org/bot${this.token}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          data = await res.json();
        }
      }
      return data;
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
      if (text) {
        body.text = text.length > 195 ? text.slice(0, 194) + '…' : text;
      }

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
   * Telegram API: answerInlineQuery (بطاقات «العب بالقناة» بالإنلاين)
   */
  public async answerInlineQuery(queryId: string, results: any[]): Promise<any> {
    if (!this.token) return null;

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/answerInlineQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inline_query_id: queryId, results, cache_time: 0 })
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
