import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Users, 
  Eye, 
  RotateCcw, 
  Sparkles, 
  ShieldAlert, 
  HelpCircle, 
  Award, 
  Zap, 
  Check, 
  Compass, 
  Smile, 
  Paperclip,
  MoreVertical,
  ChevronDown,
  Info
} from 'lucide-react';
import { CodenamesGame, Card, CardType, Team, Player, PlayerRole } from '../types/codenames';
import { CodenamesEngine } from '../services/codenamesEngine';
import { useTheme } from '../context/ThemeContext';

interface TelegramChatSimulatorProps {
  onOpenSettings: () => void;
}

interface ChatMessage {
  id: string;
  senderName: string;
  senderColor?: string;
  isBot?: boolean;
  text?: string;
  timestamp: string;
  isBoardMessage?: boolean;
}

export const TelegramChatSimulator: React.FC<TelegramChatSimulatorProps> = ({ onOpenSettings }) => {
  const { theme } = useTheme();

  // Current game state for the simulator
  const [game, setGame] = useState<CodenamesGame>(() => {
    const newLobby = CodenamesEngine.createLobby('sim_group_01', 'كروب الأصدقاء 🎮', 'arabic_standard');
    // Pre-seed with mock players so user can jump right into testing!
    const p1 = CodenamesEngine.joinGame(newLobby, { id: 'user_1', name: 'أحمد', team: 'blue', role: 'spymaster' });
    const p2 = CodenamesEngine.joinGame(p1.game, { id: 'user_2', name: 'سارة', team: 'blue', role: 'operative' });
    const p3 = CodenamesEngine.joinGame(p2.game, { id: 'user_3', name: 'عمر', team: 'red', role: 'spymaster' });
    const p4 = CodenamesEngine.joinGame(p3.game, { id: 'user_4', name: 'نور', team: 'red', role: 'operative' });
    return p4.game;
  });

  // Simulator Player Persona switcher
  const [activePlayerId, setActivePlayerId] = useState<string>('user_1');

  // Input text in Telegram chat bar
  const [inputText, setInputText] = useState('');

  // Clue modal / quick drawer
  const [clueWord, setClueWord] = useState('');
  const [clueCount, setClueCount] = useState<number>(2);

  // Secret map dialog visibility
  const [showSecretMap, setShowSecretMap] = useState(false);

  // Messages log in chat
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      senderName: 'أحمد',
      senderColor: '#2481cc',
      text: '/newgame',
      timestamp: '10:02 م',
    },
    {
      id: 'm2',
      senderName: 'بوت كود نيمز',
      isBot: true,
      isBoardMessage: true,
      timestamp: '10:02 م',
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activePlayer = game.players.find(p => p.id === activePlayerId) || {
    id: 'user_1',
    name: 'أحمد',
    team: 'blue' as Team,
    role: 'spymaster' as PlayerRole,
  };

  const isCurrentSpymaster = 
    game.status === 'spymaster_turn' && 
    activePlayer.role === 'spymaster' && 
    activePlayer.team === game.currentTurn;

  const isCurrentOperative = 
    game.status === 'operative_turn' && 
    activePlayer.role === 'operative' && 
    activePlayer.team === game.currentTurn;

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, game.status, game.currentClue]);

  // Helper to add chat message
  const pushMessage = (senderName: string, text: string, isBot = false, color?: string) => {
    const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        senderName,
        senderColor: color || (isBot ? theme.colors.accentPrimary : '#2481cc'),
        isBot,
        text,
        timestamp: time,
      }
    ]);
  };

  // Handle Command Submission
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const txt = inputText.trim();
    if (!txt) return;

    setInputText('');
    pushMessage(activePlayer.name, txt, false, activePlayer.team === 'blue' ? '#2481cc' : '#ef5350');

    const lower = txt.toLowerCase();

    if (lower === '/newgame' || lower === '/start') {
      const newLobby = CodenamesEngine.createLobby('sim_group_01', 'كروب الأصدقاء 🎮', game.wordPack);
      setGame(newLobby);
      pushMessage('بوت كود نيمز', 'تم فتح غرفة جديدة! انضموا إلى الفرق لاختيار القادة والعملاء ثم اضغطوا (ابدأ اللعبة 🚀).', true);
      return;
    }

    if (lower === '/rules' || lower === '/قوانين') {
      pushMessage('بوت كود نيمز', '📜 قوانين كود نيمز:\nلوحة 25 كلمة. كل قائد يرسل تلميحاً مع عدد الكلمات، والعملاء يضغطون على الأزرار لتخمينها. تجنبوا القاتل 💣!', true);
      return;
    }

    if (lower.startsWith('/clue') || lower.startsWith('/تلميح')) {
      const parts = txt.split(/\s+/);
      if (parts.length < 3) {
        pushMessage('بوت كود نيمز', '❌ صيغة خاطئة! استخدم: /clue <الكلمة> <العدد>\nمثال: /clue سماء 2', true);
        return;
      }
      executeClue(parts[1], parseInt(parts[2], 10));
      return;
    }

    if (lower === '/pass' || lower === '/تخطي' || lower === '/إنهاء') {
      executePass();
      return;
    }

    if (lower === '/map' || lower === '/خريطة') {
      setShowSecretMap(true);
      pushMessage('بوت كود نيمز', '🗺️ تم فتح الخريطة السرية للقائد في نافذة خاصة.', true);
      return;
    }
  };

  // Start match
  const handleStartGame = () => {
    const res = CodenamesEngine.startGame(game);
    setGame(res.game);
    const startTeamText = res.game.startingTeam === 'blue' ? 'الأزرق 🔵 (9 كلمات)' : 'الأحمر 🔴 (9 كلمات)';
    pushMessage('بوت كود نيمز', `🚀 بدأت اللعبة بنجاح! الفريق البادئ هو ${startTeamText}.\nالدور الآن لقائد الفريق لإرسال التلميح عبر الزر أو كتابة \`/clue <كلمة> <عدد>\``, true);
  };

  // Submit Clue
  const executeClue = (word: string, count: number) => {
    const res = CodenamesEngine.giveClue(game, word, count, activePlayer.name);
    if (!res.success) {
      pushMessage('بوت كود نيمز', `⚠️ ${res.message}`, true);
      return;
    }

    setGame(res.game);
    const teamEmoji = res.game.currentTurn === 'blue' ? '🔵' : '🔴';
    const teamName = res.game.currentTurn === 'blue' ? 'الأزرق' : 'الأحمر';
    pushMessage(
      'بوت كود نيمز', 
      `📢 تلميح قائد ${teamName} ${teamEmoji} (${activePlayer.name}):\n"${word}" (${count} كلمات)\n👇 يا عملاء ${teamName}، اضغطوا على البطاقات لتخمينها!`,
      true
    );
    setClueWord('');
  };

  // Guess Card
  const handleGuess = (cardId: number) => {
    if (game.status !== 'operative_turn') {
      pushMessage('بوت كود نيمز', '⚠️ ليس دور التخمين الآن! بانتظار تلميح القائد.', true);
      return;
    }

    const card = game.cards.find(c => c.id === cardId);
    if (!card || card.revealed) return;

    pushMessage(activePlayer.name, `[اختار البطاقة: "${card.word}"]`, false, activePlayer.team === 'blue' ? '#2481cc' : '#ef5350');

    const res = CodenamesEngine.guessCard(game, cardId, activePlayer.name);
    setGame(res.game);

    if (res.cardType === 'assassin') {
      pushMessage('بوت كود نيمز', `💣 كااااارثة! اختار ${activePlayer.name} كلمة القاتل "${card.word}"! فاز الفريق الآخر فوراً وانهارت المهمة!`, true);
      fetch('/api/bot/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: game.id,
          action: 'record_finish',
          payload: { game: res.game }
        })
      }).catch(() => {});
      return;
    }

    if (res.gameOver) {
      pushMessage('بوت كود نيمز', `🏆 مبرووووك! فاز الفريق ${res.game.winner === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴'} بعد كشف جميع عملائه بنجاح!`, true);
      fetch('/api/bot/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: game.id,
          action: 'record_finish',
          payload: { game: res.game }
        })
      }).catch(() => {});
      return;
    }

    if (res.isCorrect) {
      if (res.game.status === 'spymaster_turn') {
        pushMessage('بوت كود نيمز', `✅ تخمين رائع! "${card.word}" صحيحة! انتهت المحاولات المتاحة، ينتقل الدور للفريق الآخر.`, true);
      } else {
        pushMessage('بوت كود نيمز', `✅ تخمين صحيح! "${card.word}" تابعة لفريقكم! متبقي لديكم ${res.game.currentClue?.remainingGuesses} محاولة.`, true);
      }
    } else {
      const typeLabel = card.type === 'bystander' ? 'شخص مدني بريء ⚪' : 'عميل للفريق المنافس!';
      pushMessage('بوت كود نيمز', `❌ أوبس! "${card.word}" كانت (${typeLabel}). ينتهي دور فريقكم فوراً!`, true);
    }
  };

  // Pass Turn
  const executePass = () => {
    if (game.status !== 'operative_turn') return;
    const res = CodenamesEngine.passTurn(game, activePlayer.name);
    setGame(res.game);
    pushMessage('بوت كود نيمز', `⏭️ قرر ${activePlayer.name} إنهاء الدور. ينتقل الدور لقائد الفريق المنافس!`, true);
  };

  // Change Word Pack
  const handleWordPackChange = (pack: CodenamesGame['wordPack']) => {
    const newLobby = CodenamesEngine.createLobby(game.id, game.chatTitle, pack);
    newLobby.players = game.players;
    setGame(newLobby);
    pushMessage('بوت كود نيمز', `تم تغيير حزمة الكلمات إلى: ${
      pack === 'arabic_iraqi' ? 'عراقي وعامي 🇮🇶' : 
      pack === 'pop_culture' ? 'ثقافة بوب وألعاب 🎮' : 
      pack === 'english' ? 'English 🇬🇧' : 'عربي فصحى 📚'
    }`, true);
  };

  const { blueRemaining, redRemaining } = CodenamesEngine.getScores(game);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner explaining how it works */}
      <div 
        className="mb-6 p-4 rounded-2xl border shadow-md flex flex-col md:flex-row items-center justify-between gap-4 transition-colors"
        style={{
          backgroundColor: theme.colors.bgSurface,
          borderColor: theme.colors.borderColor
        }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
            style={{
              backgroundColor: theme.colors.accentSubtle,
              color: theme.colors.accentPrimary
            }}
          >
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold" style={{ color: theme.colors.textPrimary }}>
              محاكي محادثة تلجرام التفاعلي (Interactive Telegram Simulator)
            </h2>
            <p className="text-xs mt-0.5" style={{ color: theme.colors.textSecondary }}>
              جرب لعبة كود نيمز مباشرة كما تظهر وتعمل بالكامل داخل مجموعات تلجرام بأزرار اللوحة والخريطة السرية!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={() => setShowSecretMap(true)}
            className="px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            style={{
              backgroundColor: theme.colors.bgInput,
              borderColor: theme.colors.borderColor,
              color: theme.colors.accentPrimary
            }}
          >
            <Eye className="w-4 h-4" />
            <span>خريطة القائد السرية 🗺️</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="px-4 py-2 rounded-xl bg-[#00c853] hover:bg-[#00b047] text-black text-xs font-bold flex items-center gap-1.5 transition shadow"
          >
            <Zap className="w-4 h-4 fill-black" />
            <span>ربط وتفعيل البوت الحقيقي</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Control Bar + Center Telegram Chat Frame */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Persona Switcher & Fast Controls */}
        <div className="lg:col-span-4 space-y-5 order-2 lg:order-1">
          {/* Persona Switcher Card */}
          <div 
            className="border rounded-2xl p-5 shadow-sm space-y-4 transition-colors"
            style={{
              backgroundColor: theme.colors.bgSurface,
              borderColor: theme.colors.borderColor
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: theme.colors.borderColor }}>
              <h3 className="text-xs font-bold flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
                <Users className="w-4 h-4" style={{ color: theme.colors.accentPrimary }} />
                <span>اختر اللاعب الذي تتحكم به الآن:</span>
              </h3>
              <span className="text-[11px] font-semibold" style={{ color: theme.colors.textMuted }}>تبديل الأدوار</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {game.players.map((p) => {
                const isSelected = p.id === activePlayerId;
                const isBlue = p.team === 'blue';
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePlayerId(String(p.id))}
                    className={`flex items-center justify-between p-3 rounded-xl border text-right transition ${
                      isSelected
                        ? isBlue
                          ? 'border-[#2481cc] shadow-md ring-1 ring-[#2481cc]'
                          : 'border-[#ef5350] shadow-md ring-1 ring-[#ef5350]'
                        : 'hover:opacity-90'
                    }`}
                    style={{
                      backgroundColor: isSelected 
                        ? (isBlue ? (theme.isDark ? '#1a3857' : '#e6f2fc') : (theme.isDark ? '#4a1c1d' : '#fdeeed'))
                        : theme.colors.bgInput,
                      borderColor: isSelected ? (isBlue ? '#2481cc' : '#ef5350') : theme.colors.borderColor
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        isBlue ? 'bg-[#2481cc] text-white' : 'bg-[#e53935] text-white'
                      }`}>
                        {p.name.slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: theme.colors.textPrimary }}>
                          <span>{p.name}</span>
                          {isSelected && <span className="text-[10px] text-[#00c853]">● (أنت الآن)</span>}
                        </div>
                        <div className="text-[11px]" style={{ color: theme.colors.textMuted }}>
                          {p.team === 'blue' ? 'الفريق الأزرق 🔵' : 'الفريق الأحمر 🔴'} • {p.role === 'spymaster' ? 'قائد (Spymaster) 🕵️' : 'عميل ميداني 👤'}
                        </div>
                      </div>
                    </div>

                    <div className="text-left font-mono text-xs">
                      {p.role === 'spymaster' ? '🗺️' : '🎯'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions & Word Pack */}
          <div 
            className="border rounded-2xl p-5 shadow-sm space-y-4 transition-colors"
            style={{
              backgroundColor: theme.colors.bgSurface,
              borderColor: theme.colors.borderColor
            }}
          >
            <h3 className="text-xs font-bold flex items-center gap-2 border-b pb-3" style={{ color: theme.colors.textPrimary, borderColor: theme.colors.borderColor }}>
              <Compass className="w-4 h-4" style={{ color: theme.colors.accentPrimary }} />
              <span>إعدادات الجولة وحزم الكلمات:</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold block mb-1.5" style={{ color: theme.colors.textMuted }}>
                  حزمة الكلمات المستخدمة:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleWordPackChange('arabic_standard')}
                    className="px-3 py-2 rounded-xl text-xs font-bold border transition"
                    style={{
                      backgroundColor: game.wordPack === 'arabic_standard' ? theme.colors.accentPrimary : theme.colors.bgInput,
                      borderColor: game.wordPack === 'arabic_standard' ? theme.colors.accentPrimary : theme.colors.borderColor,
                      color: game.wordPack === 'arabic_standard' ? '#ffffff' : theme.colors.textSecondary
                    }}
                  >
                    عربي فصحى 📚
                  </button>
                  <button
                    onClick={() => handleWordPackChange('arabic_iraqi')}
                    className="px-3 py-2 rounded-xl text-xs font-bold border transition"
                    style={{
                      backgroundColor: game.wordPack === 'arabic_iraqi' ? theme.colors.accentPrimary : theme.colors.bgInput,
                      borderColor: game.wordPack === 'arabic_iraqi' ? theme.colors.accentPrimary : theme.colors.borderColor,
                      color: game.wordPack === 'arabic_iraqi' ? '#ffffff' : theme.colors.textSecondary
                    }}
                  >
                    عراقي وعامي 🇮🇶
                  </button>
                  <button
                    onClick={() => handleWordPackChange('pop_culture')}
                    className="px-3 py-2 rounded-xl text-xs font-bold border transition"
                    style={{
                      backgroundColor: game.wordPack === 'pop_culture' ? theme.colors.accentPrimary : theme.colors.bgInput,
                      borderColor: game.wordPack === 'pop_culture' ? theme.colors.accentPrimary : theme.colors.borderColor,
                      color: game.wordPack === 'pop_culture' ? '#ffffff' : theme.colors.textSecondary
                    }}
                  >
                    ثقافة بوب وألعاب 🎮
                  </button>
                  <button
                    onClick={() => handleWordPackChange('english')}
                    className="px-3 py-2 rounded-xl text-xs font-bold border transition"
                    style={{
                      backgroundColor: game.wordPack === 'english' ? theme.colors.accentPrimary : theme.colors.bgInput,
                      borderColor: game.wordPack === 'english' ? theme.colors.accentPrimary : theme.colors.borderColor,
                      color: game.wordPack === 'english' ? '#ffffff' : theme.colors.textSecondary
                    }}
                  >
                    English 🇬🇧
                  </button>
                </div>
              </div>

              {/* Reset Game button */}
              <button
                onClick={() => {
                  const newLobby = CodenamesEngine.createLobby('sim_group_01', 'كروب الأصدقاء 🎮', game.wordPack);
                  newLobby.players = game.players;
                  setGame(newLobby);
                  pushMessage('بوت كود نيمز', '🔄 تم إعادة تشغيل الغرفة! انضموا مجدداً أو اضغطوا (ابدأ اللعبة 🚀)', true);
                }}
                className="w-full py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition"
                style={{
                  backgroundColor: theme.colors.bgInput,
                  borderColor: theme.colors.borderColor,
                  color: theme.colors.textPrimary
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط الجولة (Reset Game)</span>
              </button>
            </div>
          </div>

          {/* Spymaster Helper Clue box */}
          {game.status === 'spymaster_turn' && (
            <div 
              className="p-4 rounded-2xl border transition-all"
              style={{
                backgroundColor: game.currentTurn === 'blue' 
                  ? (theme.isDark ? '#132c45' : '#e6f2fc') 
                  : (theme.isDark ? '#3b1718' : '#fdeeed'),
                borderColor: game.currentTurn === 'blue' ? '#2481cc' : '#ef5350'
              }}
            >
              <div className="flex items-center gap-2 mb-2 font-bold text-xs" style={{ color: theme.colors.textPrimary }}>
                <Sparkles className="w-4 h-4 text-[#ffca28]" />
                <span>
                  دور قائد الفريق {game.currentTurn === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴'} لتقديم التلميح
                </span>
              </div>
              <p className="text-[11px] mb-3" style={{ color: theme.colors.textSecondary }}>
                اكتب كلمة واحدة ورقم يشير لعدد البطاقات المرتبطة بها، ثم اضغط إرسال التلميح.
              </p>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={clueWord}
                    onChange={(e) => setClueWord(e.target.value)}
                    placeholder="التلميح (كلمة واحدة فقط)"
                    className="flex-1 border rounded-xl px-3 py-2 text-xs outline-none transition"
                    style={{
                      backgroundColor: theme.colors.bgSurface,
                      borderColor: theme.colors.borderColor,
                      color: theme.colors.textPrimary
                    }}
                  />
                  <select
                    value={clueCount}
                    onChange={(e) => setClueCount(Number(e.target.value))}
                    className="w-20 border rounded-xl px-2 py-2 text-xs outline-none transition"
                    style={{
                      backgroundColor: theme.colors.bgSurface,
                      borderColor: theme.colors.borderColor,
                      color: theme.colors.textPrimary
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>{n} كلمات</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    if (!clueWord.trim()) return;
                    executeClue(clueWord.trim(), clueCount);
                  }}
                  disabled={!clueWord.trim()}
                  className="w-full py-2 rounded-xl text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
                  style={{
                    backgroundColor: theme.colors.accentPrimary
                  }}
                >
                  إرسال التلميح في الشات 📢
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center / Right: The Realistic Telegram Chat Window */}
        <div className="lg:col-span-8 order-1 lg:order-2">
          <div 
            className="border rounded-2xl shadow-xl overflow-hidden flex flex-col h-[760px] transition-colors"
            style={{
              backgroundColor: theme.colors.chatBg,
              borderColor: theme.colors.borderColor
            }}
          >
            {/* Telegram Header */}
            <div 
              className="px-4 py-3 border-b flex items-center justify-between transition-colors"
              style={{
                backgroundColor: theme.colors.bgSurface,
                borderColor: theme.colors.borderColor
              }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow"
                  style={{ backgroundColor: theme.colors.accentPrimary }}
                >
                  👥
                </div>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
                    <span>كروب الأصدقاء 🎮</span>
                    <span className="text-[10px] text-[#00c853] font-normal">● البوت متصل</span>
                  </h3>
                  <p className="text-[11px]" style={{ color: theme.colors.textMuted }}>
                    4 أعضاء • بوت كود نيمز جاهز للأوامر
                  </p>
                </div>
              </div>

              {/* Score pill in header */}
              {game.cards.length === 25 && (
                <div 
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold"
                  style={{
                    backgroundColor: theme.colors.bgInput,
                    borderColor: theme.colors.borderColor
                  }}
                >
                  <span className="text-[#2481cc] flex items-center gap-1 font-mono">
                    🔵 {blueRemaining}
                  </span>
                  <span style={{ color: theme.colors.textMuted }}>|</span>
                  <span className="text-[#ef5350] flex items-center gap-1 font-mono">
                    🔴 {redRemaining}
                  </span>
                </div>
              )}
            </div>

            {/* Telegram Messages Scroll Area with Telegram Wallpaper Pattern */}
            <div 
              className="flex-1 p-4 overflow-y-auto space-y-4 text-right relative transition-colors"
              style={{
                backgroundColor: theme.colors.chatBg,
                backgroundImage: theme.isDark 
                  ? 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)' 
                  : 'radial-gradient(rgba(0, 0, 0, 0.06) 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            >
              {/* Chat bubbles */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${
                    msg.isBot ? 'mr-0 ml-auto' : 'mr-auto ml-0'
                  }`}
                >
                  <div 
                    className="p-3.5 rounded-2xl shadow-sm text-xs border transition-colors"
                    style={{
                      backgroundColor: msg.isBot ? theme.colors.chatBubbleBot : theme.colors.chatBubbleUser,
                      borderColor: msg.isBot ? theme.colors.chatBubbleBotBorder : 'transparent',
                      color: msg.isBot ? theme.colors.chatBubbleBotText : theme.colors.chatBubbleUserText,
                      borderTopRightRadius: msg.isBot ? 0 : undefined,
                      borderTopLeftRadius: !msg.isBot ? 0 : undefined,
                    }}
                  >
                    {/* Sender name */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span 
                        className="font-bold text-[11px]" 
                        style={{ color: msg.senderColor || theme.colors.accentPrimary }}
                      >
                        {msg.senderName}
                      </span>
                      <span 
                        className="text-[10px] font-mono opacity-65"
                      >
                        {msg.timestamp}
                      </span>
                    </div>

                    {/* Text content */}
                    {msg.text && (
                      <div className="whitespace-pre-line leading-relaxed text-xs">
                        {msg.text}
                      </div>
                    )}

                    {/* If this is the main Board Message, embed the 5x5 interactive buttons! */}
                    {msg.isBoardMessage && (
                      <div className="mt-3 pt-3 border-t space-y-3" style={{ borderColor: theme.colors.borderColor }}>
                        {/* Board Text Status */}
                        <div 
                          className="whitespace-pre-line text-xs font-medium leading-relaxed p-3 rounded-xl border"
                          style={{
                            backgroundColor: theme.colors.bgInput,
                            borderColor: theme.colors.borderColor,
                            color: theme.colors.textPrimary
                          }}
                        >
                          {CodenamesEngine.getTelegramMessageText(game)}
                        </div>

                        {/* Lobby State buttons */}
                        {game.status === 'lobby' && (
                          <div className="space-y-2 pt-1">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => {
                                  const res = CodenamesEngine.joinGame(game, {
                                    id: activePlayer.id,
                                    name: activePlayer.name,
                                    team: 'blue',
                                    role: 'operative'
                                  });
                                  if (res.success) setGame(res.game);
                                }}
                                className="py-2.5 px-3 rounded-xl bg-[#1b334c] hover:bg-[#254668] text-[#64b5f6] border border-[#2b5278] text-xs font-bold transition flex items-center justify-center gap-1.5"
                              >
                                <span>انضم كـ عميل أزرق 🔵</span>
                              </button>
                              <button
                                onClick={() => {
                                  const res = CodenamesEngine.joinGame(game, {
                                    id: activePlayer.id,
                                    name: activePlayer.name,
                                    team: 'red',
                                    role: 'operative'
                                  });
                                  if (res.success) setGame(res.game);
                                }}
                                className="py-2.5 px-3 rounded-xl bg-[#441d20] hover:bg-[#5a272b] text-[#ef5350] border border-[#7f2628] text-xs font-bold transition flex items-center justify-center gap-1.5"
                              >
                                <span>انضم كـ عميل أحمر 🔴</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => {
                                  const res = CodenamesEngine.joinGame(game, {
                                    id: activePlayer.id,
                                    name: activePlayer.name,
                                    team: 'blue',
                                    role: 'spymaster'
                                  });
                                  if (res.success) setGame(res.game);
                                }}
                                className="py-2 px-3 rounded-xl bg-[#132537] hover:bg-[#1a324b] text-[#90caf9] border border-[#2b5278]/60 text-xs font-bold transition"
                              >
                                قائد أزرق 🕵️‍♂️
                              </button>
                              <button
                                onClick={() => {
                                  const res = CodenamesEngine.joinGame(game, {
                                    id: activePlayer.id,
                                    name: activePlayer.name,
                                    team: 'red',
                                    role: 'spymaster'
                                  });
                                  if (res.success) setGame(res.game);
                                }}
                                className="py-2 px-3 rounded-xl bg-[#341618] hover:bg-[#461e20] text-[#ef9a9a] border border-[#7f2628]/60 text-xs font-bold transition"
                              >
                                قائد أحمر 🕵️‍♀️
                              </button>
                            </div>

                            <button
                              onClick={handleStartGame}
                              className="w-full py-2.5 rounded-xl bg-[#00c853] hover:bg-[#00b047] text-black text-xs font-extrabold transition shadow flex items-center justify-center gap-2"
                            >
                              <Zap className="w-4 h-4 fill-black" />
                              <span>ابدأ اللعبة وتوزيع الكلمات 🚀</span>
                            </button>
                          </div>
                        )}

                        {/* Active Game State: The 5x5 Telegram Grid Buttons */}
                        {game.status !== 'lobby' && (
                          <div className="space-y-1.5 pt-1">
                            {/* 5 rows of 5 cards */}
                            {Array.from({ length: 5 }).map((_, rowIndex) => (
                              <div key={rowIndex} className="grid grid-cols-5 gap-1.5">
                                {game.cards.slice(rowIndex * 5, rowIndex * 5 + 5).map((card) => {
                                  const isRevealed = card.revealed;
                                  
                                  let bg = theme.colors.chatCardDefault;
                                  let textColor = theme.colors.chatCardDefaultText;
                                  let borderColor = theme.colors.chatCardDefaultBorder;
                                  let icon = null;

                                  if (isRevealed) {
                                    if (card.type === 'blue') {
                                      bg = "#1976d2";
                                      textColor = "#ffffff";
                                      borderColor = "#1565c0";
                                      icon = "🔵 ";
                                    } else if (card.type === 'red') {
                                      bg = "#d32f2f";
                                      textColor = "#ffffff";
                                      borderColor = "#c62828";
                                      icon = "🔴 ";
                                    } else if (card.type === 'assassin') {
                                      bg = "#111111";
                                      textColor = "#ff5252";
                                      borderColor = "#b71c1c";
                                      icon = "💣 ";
                                    } else {
                                      bg = "#607d8b";
                                      textColor = "#ffffff";
                                      borderColor = "#455a64";
                                      icon = "⚪ ";
                                    }
                                  }

                                  return (
                                    <button
                                      key={card.id}
                                      onClick={() => handleGuess(card.id)}
                                      disabled={isRevealed || game.status !== 'operative_turn'}
                                      title={isRevealed ? `${card.word} (مكشوفة)` : `تخمين: ${card.word}`}
                                      className="h-11 sm:h-12 px-1 rounded-xl border text-[11px] sm:text-xs font-bold transition flex items-center justify-center text-center shadow-xs active:scale-95 disabled:active:scale-100"
                                      style={{
                                        backgroundColor: bg,
                                        color: textColor,
                                        borderColor: borderColor,
                                        cursor: !isRevealed && game.status === 'operative_turn' ? 'pointer' : 'default'
                                      }}
                                    >
                                      <span className="truncate">
                                        {icon}
                                        {card.word}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ))}

                            {/* Bottom Telegram Action Bar (Pass & Secret Map) */}
                            <div className="flex items-center gap-2 pt-2">
                              {game.status === 'operative_turn' && (
                                <button
                                  onClick={executePass}
                                  className="flex-1 py-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5"
                                  style={{
                                    backgroundColor: theme.colors.bgSurface,
                                    borderColor: theme.colors.borderColor,
                                    color: theme.colors.textPrimary
                                  }}
                                >
                                  <span>⏭️ إنهاء التخمين (Pass)</span>
                                </button>
                              )}

                              <button
                                onClick={() => setShowSecretMap(true)}
                                className="flex-1 py-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5"
                                style={{
                                  backgroundColor: theme.colors.accentSubtle,
                                  borderColor: theme.colors.borderColor,
                                  color: theme.colors.accentPrimary
                                }}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>🗺️ خريطة القائد السرية</span>
                              </button>

                              {game.status === 'game_over' && (
                                <button
                                  onClick={() => {
                                    const newLobby = CodenamesEngine.createLobby(game.id, game.chatTitle, game.wordPack);
                                    newLobby.players = game.players;
                                    setGame(newLobby);
                                    pushMessage('بوت كود نيمز', '🔄 بدأت جولة جديدة! اختاروا الفرق واضغطوا بدء اللعبة.', true);
                                  }}
                                  className="flex-1 py-2 rounded-xl bg-[#00c853] hover:bg-[#00b047] text-black text-xs font-extrabold transition flex items-center justify-center gap-1.5"
                                >
                                  <span>🔄 جولة جديدة</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Telegram Shortcuts Bar */}
            <div 
              className="px-4 py-2 border-t flex items-center gap-1.5 overflow-x-auto text-[11px] transition-colors"
              style={{
                backgroundColor: theme.colors.bgSurface,
                borderColor: theme.colors.borderColor,
                color: theme.colors.textMuted
              }}
            >
              <span className="font-semibold shrink-0">أوامر سريعة:</span>
              <button
                onClick={() => setInputText('/newgame')}
                className="px-2.5 py-1 rounded-lg border font-mono transition"
                style={{
                  backgroundColor: theme.colors.bgInput,
                  borderColor: theme.colors.borderColor,
                  color: theme.colors.accentPrimary
                }}
              >
                /newgame
              </button>
              <button
                onClick={() => setInputText('/rules')}
                className="px-2.5 py-1 rounded-lg border font-mono transition"
                style={{
                  backgroundColor: theme.colors.bgInput,
                  borderColor: theme.colors.borderColor,
                  color: theme.colors.accentPrimary
                }}
              >
                /rules
              </button>
              {game.status === 'spymaster_turn' && (
                <button
                  onClick={() => setInputText('/clue سماء 2')}
                  className="px-2.5 py-1 rounded-lg border font-mono transition text-[#ffb74d]"
                  style={{
                    backgroundColor: theme.colors.bgInput,
                    borderColor: theme.colors.borderColor
                  }}
                >
                  /clue سماء 2
                </button>
              )}
              {game.status === 'operative_turn' && (
                <button
                  onClick={() => setInputText('/pass')}
                  className="px-2.5 py-1 rounded-lg border font-mono transition"
                  style={{
                    backgroundColor: theme.colors.bgInput,
                    borderColor: theme.colors.borderColor,
                    color: theme.colors.textPrimary
                  }}
                >
                  /pass
                </button>
              )}
            </div>

            {/* Telegram Message Input Form */}
            <form 
              onSubmit={handleSendMessage} 
              className="p-3 border-t flex items-center gap-2 transition-colors"
              style={{
                backgroundColor: theme.colors.bgSurface,
                borderColor: theme.colors.borderColor
              }}
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`اكتب رسالة أو أمراً كـ (${activePlayer.name})...`}
                  className="w-full border rounded-2xl px-4 py-2.5 text-xs outline-none transition"
                  style={{
                    backgroundColor: theme.colors.bgInput,
                    borderColor: theme.colors.borderColor,
                    color: theme.colors.textPrimary
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-10 h-10 rounded-full text-white flex items-center justify-center transition disabled:opacity-40 shadow"
                style={{ backgroundColor: theme.colors.accentPrimary }}
              >
                <Send className="w-4 h-4 rotate-[-45deg]" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Secret Map Modal (For Spymasters) */}
      {showSecretMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            className="w-full max-w-lg border rounded-2xl shadow-2xl p-6 text-right space-y-4 transition-colors"
            style={{
              backgroundColor: theme.colors.bgSurface,
              borderColor: theme.colors.borderColor
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: theme.colors.borderColor }}>
              <div className="flex items-center gap-2 font-bold text-sm" style={{ color: theme.colors.textPrimary }}>
                <Eye className="w-5 h-5" style={{ color: theme.colors.accentPrimary }} />
                <span>خريطة القائد السرية (Secret Spymaster Key)</span>
              </div>
              <button
                onClick={() => setShowSecretMap(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                style={{ color: theme.colors.textMuted }}
              >
                ✕
              </button>
            </div>

            <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
              هذه الخريطة يراها قادة الفريقين فقط في محادثة خاصة مع البوت (DM) لمعرفة ألوان جميع البطاقات الـ 25:
            </p>

            {/* Visual 5x5 Matrix of the cards */}
            <div 
              className="grid grid-cols-5 gap-2 p-3 rounded-xl border"
              style={{
                backgroundColor: theme.colors.bgInput,
                borderColor: theme.colors.borderColor
              }}
            >
              {game.cards.map((card) => {
                let colorClass = "bg-[#546e7a] text-white"; // bystander
                let badge = "⚪";

                if (card.type === 'blue') {
                  colorClass = "bg-[#1565c0] text-white font-bold";
                  badge = "🔵";
                } else if (card.type === 'red') {
                  colorClass = "bg-[#c62828] text-white font-bold";
                  badge = "🔴";
                } else if (card.type === 'assassin') {
                  colorClass = "bg-[#111111] text-[#ff5252] border border-[#ff5252] font-black";
                  badge = "💣";
                }

                return (
                  <div
                    key={card.id}
                    className={`h-12 p-1 rounded-lg text-[10px] sm:text-xs flex flex-col items-center justify-center text-center shadow-xs ${colorClass} ${
                      card.revealed ? 'opacity-40 line-through' : ''
                    }`}
                  >
                    <span>{badge}</span>
                    <span className="truncate max-w-full">{card.word}</span>
                  </div>
                );
              })}
            </div>

            {/* Legend & Guide */}
            <div className="grid grid-cols-4 gap-2 text-[11px] text-center font-bold">
              <div className="bg-[#1565c0]/25 text-[#2481cc] p-2 rounded-lg border border-[#1565c0]/50">
                🔵 أزرق ({game.cards.filter(c => c.type === 'blue').length})
              </div>
              <div className="bg-[#c62828]/25 text-[#ef5350] p-2 rounded-lg border border-[#c62828]/50">
                🔴 أحمر ({game.cards.filter(c => c.type === 'red').length})
              </div>
              <div className="bg-[#546e7a]/25 text-[#78909c] p-2 rounded-lg border border-[#546e7a]/50">
                ⚪ مدني (7)
              </div>
              <div className="bg-black text-[#ff5252] p-2 rounded-lg border border-[#ff5252]/50">
                💣 القاتل (1)
              </div>
            </div>

            <div 
              className="p-3 rounded-xl border text-xs flex items-center justify-between"
              style={{
                backgroundColor: theme.colors.bgInput,
                borderColor: theme.colors.borderColor,
                color: theme.colors.textPrimary
              }}
            >
              <span>الفريق البادئ بالجولة:</span>
              <span className="font-bold text-[#2481cc]">
                {game.startingTeam === 'blue' ? 'الفريق الأزرق 🔵 (9 بطاقات)' : 'الفريق الأحمر 🔴 (9 بطاقات)'}
              </span>
            </div>

            <button
              onClick={() => setShowSecretMap(false)}
              className="w-full py-2.5 rounded-xl text-white text-xs font-bold transition shadow-xs"
              style={{ backgroundColor: theme.colors.accentPrimary }}
            >
              الرجوع إلى محادثة اللعبة
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
