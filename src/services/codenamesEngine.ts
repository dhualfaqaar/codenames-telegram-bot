import { 
  CodenamesGame, 
  Card, 
  CardType, 
  Player, 
  Team, 
  GameStatus, 
  Clue, 
  GameLogEntry,
  PlayerRole 
} from '../types/codenames';
import { getWordPackList } from '../data/words';

export class CodenamesEngine {
  /**
   * Helper to shuffle array in-place
   */
  private static shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Create a new Codenames lobby
   */
  public static createLobby(
    id: string,
    chatTitle: string = 'مجموعة اللعب',
    wordPack: CodenamesGame['wordPack'] = 'arabic_standard',
    customWords: string[] = []
  ): CodenamesGame {
    return {
      id,
      chatTitle,
      status: 'lobby',
      startingTeam: Math.random() < 0.5 ? 'blue' : 'red',
      currentTurn: 'blue',
      cards: [],
      players: [],
      clueHistory: [],
      wordPack,
      logs: [
        {
          id: Math.random().toString(36).substring(7),
          timestamp: Date.now(),
          type: 'lobby',
          message: 'تم فتح غرفة كود نيمز جديدة! انضموا إلى الفرق لاختيار القادة والعملاء.'
        }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * Add or update a player in the lobby
   */
  public static joinGame(
    game: CodenamesGame,
    player: { id: number | string; name: string; username?: string; team: Team; role: PlayerRole }
  ): { success: boolean; message: string; game: CodenamesGame } {
    if (game.status !== 'lobby') {
      return { success: false, message: 'اللعبة قيد التشغيل بالفعل، لا يمكن تغيير الفرق الآن.', game };
    }

    // Check if player already registered as spymaster in this team or role
    const existingIndex = game.players.findIndex(p => String(p.id) === String(player.id));
    
    // Check if role is spymaster, ensure there is only 1 spymaster per team
    if (player.role === 'spymaster') {
      const existingSpymaster = game.players.find(p => p.team === player.team && p.role === 'spymaster' && String(p.id) !== String(player.id));
      if (existingSpymaster) {
        return {
          success: false,
          message: `الفريق ال${player.team === 'blue' ? 'أزرق' : 'أحمر'} لديه قائد بالفعل (${existingSpymaster.name}). يمكنك الانضمام كعميل.`,
          game
        };
      }
    }

    const updatedPlayers = [...game.players];
    if (existingIndex >= 0) {
      updatedPlayers[existingIndex] = { ...updatedPlayers[existingIndex], ...player };
    } else {
      updatedPlayers.push(player);
    }

    const roleText = player.role === 'spymaster' ? 'قائد جاسوس 🕵️' : 'عميل ميداني 👤';
    const teamColor = player.team === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';

    const logEntry: GameLogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      type: 'lobby',
      team: player.team,
      message: `انضم ${player.name} إلى الفريق ${teamColor} بصفة ${roleText}`
    };

    return {
      success: true,
      message: `تم انضمامك إلى الفريق ${teamColor} كـ ${roleText}!`,
      game: {
        ...game,
        players: updatedPlayers,
        logs: [...game.logs, logEntry],
        updatedAt: Date.now()
      }
    };
  }

  /**
   * Start the match and generate 25 random cards
   */
  public static startGame(game: CodenamesGame, customWords: string[] = []): { success: boolean; message: string; game: CodenamesGame } {
    let wordPool = getWordPackList(game.wordPack);
    if (game.wordPack === 'custom' && customWords.length >= 25) {
      wordPool = customWords;
    }

    if (wordPool.length < 25) {
      wordPool = getWordPackList('arabic_standard');
    }

    const shuffledWords = this.shuffle(wordPool).slice(0, 25);
    const startingTeam: Team = Math.random() < 0.5 ? 'blue' : 'red';
    const secondTeam: Team = startingTeam === 'blue' ? 'red' : 'blue';

    // 25 cards distribution:
    // 9 starting team
    // 8 second team
    // 7 bystanders
    // 1 assassin
    const cardTypes: CardType[] = [
      ...Array(9).fill(startingTeam),
      ...Array(8).fill(secondTeam),
      ...Array(7).fill('bystander'),
      'assassin'
    ];

    const shuffledTypes = this.shuffle(cardTypes);

    const cards: Card[] = shuffledWords.map((word, index) => ({
      id: index,
      word,
      type: shuffledTypes[index],
      revealed: false
    }));

    const startLog: GameLogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      type: 'system',
      team: startingTeam,
      message: `بدأت اللعبة! الفريق البادئ هو ${startingTeam === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴'} (لديه 9 كلمات). بانتظار تلميح القائد!`
    };

    return {
      success: true,
      message: 'بدأت اللعبة بنجاح!',
      game: {
        ...game,
        status: 'spymaster_turn',
        startingTeam,
        currentTurn: startingTeam,
        cards,
        currentClue: undefined,
        winner: undefined,
        winReason: undefined,
        logs: [...game.logs, startLog],
        updatedAt: Date.now()
      }
    };
  }

  /**
   * Submit a clue from the current spymaster
   */
  public static giveClue(
    game: CodenamesGame,
    clueWord: string,
    clueCount: number,
    spymasterName: string = 'القائد'
  ): { success: boolean; message: string; game: CodenamesGame } {
    if (game.status !== 'spymaster_turn') {
      return { success: false, message: 'ليس وقت تقديم التلميح حالياً.', game };
    }

    const cleanWord = clueWord.trim();
    if (!cleanWord || cleanWord.includes(' ')) {
      return { success: false, message: 'يجب أن يتكون التلميح من كلمة واحدة فقط دون مسافات!', game };
    }

    // Verify word is not already on the board as an unrevealed card
    const cardMatch = game.cards.find(c => !c.revealed && c.word.toLowerCase() === cleanWord.toLowerCase());
    if (cardMatch) {
      return { success: false, message: `قانون كود نيمز: لا يجوز استخدام كلمة موجودة على اللوحة كـ تلميح ("${cleanWord}")!`, game };
    }

    const count = Math.max(1, Math.min(9, Number(clueCount) || 1));
    const newClue: Clue = {
      word: cleanWord,
      count,
      remainingGuesses: count + 1, // Rule: count + 1 bonus guess
      givenBy: spymasterName,
      team: game.currentTurn,
      timestamp: Date.now()
    };

    const teamText = game.currentTurn === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
    const logEntry: GameLogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      type: 'clue',
      team: game.currentTurn,
      message: `تلميح ${teamText} (${spymasterName}): "${cleanWord}" مع العدد (${count})`
    };

    return {
      success: true,
      message: `تم إرسال التلميح: ${cleanWord} (${count})`,
      game: {
        ...game,
        status: 'operative_turn',
        currentClue: newClue,
        clueHistory: [...game.clueHistory, newClue],
        logs: [...game.logs, logEntry],
        updatedAt: Date.now()
      }
    };
  }

  /**
   * Operative guesses a card
   */
  public static guessCard(
    game: CodenamesGame,
    cardId: number,
    operativeName: string = 'العميل'
  ): { 
    success: boolean; 
    message: string; 
    cardType?: CardType;
    isCorrect?: boolean;
    gameOver?: boolean;
    game: CodenamesGame 
  } {
    if (game.status !== 'operative_turn') {
      return { success: false, message: 'ليس دور التخمين حالياً.', game };
    }

    const card = game.cards.find(c => c.id === cardId);
    if (!card) {
      return { success: false, message: 'بطاقة غير موجودة.', game };
    }

    if (card.revealed) {
      return { success: false, message: `الكلمة "${card.word}" تم كشفها مسبقاً!`, game };
    }

    // Reveal card
    const currentTeam = game.currentTurn;
    const oppositeTeam: Team = currentTeam === 'blue' ? 'red' : 'blue';

    const updatedCards = game.cards.map(c => 
      c.id === cardId 
        ? { ...c, revealed: true, revealedBy: { team: currentTeam, playerName: operativeName } }
        : c
    );

    // Calculate remaining cards per team
    const blueRemaining = updatedCards.filter(c => c.type === 'blue' && !c.revealed).length;
    const redRemaining = updatedCards.filter(c => c.type === 'red' && !c.revealed).length;

    // Check ASSASSIN
    if (card.type === 'assassin') {
      const winLog: GameLogEntry = {
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        type: 'winner',
        team: oppositeTeam,
        message: `💣 فُجّرت القنبلة! العميل ${operativeName} اختار كلمة القاتل "${card.word}". فاز الفريق ${oppositeTeam === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴'} فوراً!`
      };

      return {
        success: true,
        message: `💣 بطاقة القاتل (${card.word})! خسارة فورية!`,
        cardType: 'assassin',
        gameOver: true,
        game: {
          ...game,
          cards: updatedCards,
          status: 'game_over',
          winner: oppositeTeam,
          winReason: 'assassin_triggered',
          logs: [...game.logs, winLog],
          updatedAt: Date.now()
        }
      };
    }

    // Check Win by finding all team cards
    if (card.type === 'blue' && blueRemaining === 0) {
      const winLog: GameLogEntry = {
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        type: 'winner',
        team: 'blue',
        message: `🏆 فاز الفريق الأزرق 🔵 بعد كشف جميع عملائه!`
      };
      return {
        success: true,
        message: `🔵 تم كشف جميع عملاء الأزرق! فوز مستحق!`,
        cardType: 'blue',
        isCorrect: currentTeam === 'blue',
        gameOver: true,
        game: {
          ...game,
          cards: updatedCards,
          status: 'game_over',
          winner: 'blue',
          winReason: 'all_cards_found',
          logs: [...game.logs, winLog],
          updatedAt: Date.now()
        }
      };
    }

    if (card.type === 'red' && redRemaining === 0) {
      const winLog: GameLogEntry = {
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        type: 'winner',
        team: 'red',
        message: `🏆 فاز الفريق الأحمر 🔴 بعد كشف جميع عملائه!`
      };
      return {
        success: true,
        message: `🔴 تم كشف جميع عملاء الأحمر! فوز مستحق!`,
        cardType: 'red',
        isCorrect: currentTeam === 'red',
        gameOver: true,
        game: {
          ...game,
          cards: updatedCards,
          status: 'game_over',
          winner: 'red',
          winReason: 'all_cards_found',
          logs: [...game.logs, winLog],
          updatedAt: Date.now()
        }
      };
    }

    // Card was team's own color
    if (card.type === currentTeam) {
      const currentClue = game.currentClue;
      const remainingGuesses = currentClue ? currentClue.remainingGuesses - 1 : 0;

      const guessLog: GameLogEntry = {
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        type: 'guess',
        team: currentTeam,
        message: `✅ تخمين صحيح! كشف ${operativeName} بطاقة فريقه: "${card.word}" (${currentTeam === 'blue' ? 'أزرق 🔵' : 'أحمر 🔴'})`
      };

      // If guesses run out, switch turn
      if (remainingGuesses <= 0) {
        const turnSwitchLog: GameLogEntry = {
          id: Math.random().toString(36).substring(7),
          timestamp: Date.now(),
          type: 'system',
          message: `انتهت محاولات التخمين لهذا الدور. ينتقل الدور إلى قائد الفريق ${oppositeTeam === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴'}.`
        };

        return {
          success: true,
          message: `✅ تخمين صحيح ("${card.word}")! انتهت محاولاتكم لهذا الدور.`,
          cardType: currentTeam,
          isCorrect: true,
          gameOver: false,
          game: {
            ...game,
            cards: updatedCards,
            status: 'spymaster_turn',
            currentTurn: oppositeTeam,
            currentClue: undefined,
            logs: [...game.logs, guessLog, turnSwitchLog],
            updatedAt: Date.now()
          }
        };
      }

      // Can keep guessing
      return {
        success: true,
        message: `✅ تخمين صحيح ("${card.word}")! متبقي لديكم ${remainingGuesses} تخمين(ات).`,
        cardType: currentTeam,
        isCorrect: true,
        gameOver: false,
        game: {
          ...game,
          cards: updatedCards,
          currentClue: currentClue ? { ...currentClue, remainingGuesses } : undefined,
          logs: [...game.logs, guessLog],
          updatedAt: Date.now()
        }
      };
    }

    // Card was Bystander or Opponent card -> Turn ends immediately!
    const isOpponent = card.type === oppositeTeam;
    const cardLabel = isOpponent 
      ? (oppositeTeam === 'blue' ? 'عميل أزرق 🔵' : 'عميل أحمر 🔴')
      : 'شخص بريء / مدني ⚪';

    const failLog: GameLogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      type: 'guess',
      team: currentTeam,
      message: `❌ تخمين خاطئ! كشف ${operativeName} كلمة "${card.word}" وهي (${cardLabel}). ينتهي دور ${currentTeam === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴'}.`
    };

    return {
      success: true,
      message: `❌ كلمة غير صحيحة ("${card.word}" - ${cardLabel}). انتهى دور فريقكم!`,
      cardType: card.type,
      isCorrect: false,
      gameOver: false,
      game: {
        ...game,
        cards: updatedCards,
        status: 'spymaster_turn',
        currentTurn: oppositeTeam,
        currentClue: undefined,
        logs: [...game.logs, failLog],
        updatedAt: Date.now()
      }
    };
  }

  /**
   * Operative passes the turn voluntarily
   */
  public static passTurn(game: CodenamesGame, operativeName: string = 'العميل'): { success: boolean; message: string; game: CodenamesGame } {
    if (game.status !== 'operative_turn') {
      return { success: false, message: 'لا يمكن إنهاء الدور الآن.', game };
    }

    const oppositeTeam: Team = game.currentTurn === 'blue' ? 'red' : 'blue';
    const logEntry: GameLogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      type: 'pass',
      team: game.currentTurn,
      message: `⏭️ قرر ${operativeName} إنهاء دور الفريق ${game.currentTurn === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴'}. الدور الآن للفريق ${oppositeTeam === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴'}.`
    };

    return {
      success: true,
      message: 'تم إنهاء الدور والانتقال للفريق الآخر.',
      game: {
        ...game,
        status: 'spymaster_turn',
        currentTurn: oppositeTeam,
        currentClue: undefined,
        logs: [...game.logs, logEntry],
        updatedAt: Date.now()
      }
    };
  }

  /**
   * Get scores (remaining unrevealed cards)
   */
  public static getScores(game: CodenamesGame): { blueRemaining: number; redRemaining: number } {
    const blueRemaining = game.cards.filter(c => c.type === 'blue' && !c.revealed).length;
    const redRemaining = game.cards.filter(c => c.type === 'red' && !c.revealed).length;
    return { blueRemaining, redRemaining };
  }

  /**
   * Generates the secret 5x5 color map for Spymasters with emoji grid
   */
  public static getSecretKeyVisual(game: CodenamesGame): string {
    if (game.cards.length !== 25) return 'لا توجد لعبة نشطة حالياً.';

    const typeToEmoji: Record<CardType, string> = {
      blue: '🟦',
      red: '🟥',
      bystander: '⬜',
      assassin: '💣'
    };

    let text = `🗺️ *خريطة القائد السرية (لعبة #${game.id.slice(-4)})*\n`;
    text += `الفريق البادئ: ${game.startingTeam === 'blue' ? 'الأزرق 🟦 (9)' : 'الأحمر 🟥 (9)'}\n\n`;

    // 5x5 grid
    for (let row = 0; row < 5; row++) {
      const rowEmojis = [];
      for (let col = 0; col < 5; col++) {
        const card = game.cards[row * 5 + col];
        rowEmojis.push(typeToEmoji[card.type]);
      }
      text += rowEmojis.join(' ') + '\n';
    }

    text += '\n*قائمة الكلمات المصنفة:*\n';
    const blueWords = game.cards.filter(c => c.type === 'blue').map(c => c.revealed ? `~${c.word}~` : c.word).join(', ');
    const redWords = game.cards.filter(c => c.type === 'red').map(c => c.revealed ? `~${c.word}~` : c.word).join(', ');
    const assassinWord = game.cards.find(c => c.type === 'assassin')?.word || '';

    text += `🟦 *الأزرق:* ${blueWords}\n`;
    text += `🟥 *الأحمر:* ${redWords}\n`;
    text += `💣 *القاتل (ممنوع الاقتراب!):* ${assassinWord}\n`;

    return text;
  }

  /**
   * Formats the Telegram Chat message text for the group
   */
  public static getTelegramMessageText(game: CodenamesGame, lastEvent?: string): string {
    const { blueRemaining, redRemaining } = this.getScores(game);

    if (game.status === 'lobby') {
      const bluePlayers = game.players.filter(p => p.team === 'blue');
      const redPlayers = game.players.filter(p => p.team === 'red');
      const blueSpy = bluePlayers.find(p => p.role === 'spymaster');
      const redSpy = redPlayers.find(p => p.role === 'spymaster');

      return `🕵️‍♂️ *لعبة كود نيمز (Codenames) في تلجرام* 🕵️‍♀️\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `انضموا للفريقين واختاروا القائد والعملاء!\n\n` +
        `🔵 *الفريق الأزرق:*\n` +
        `• القائد: ${blueSpy ? blueSpy.name : '_لم يُحدد بعد_'}\n` +
        `• العملاء: ${bluePlayers.filter(p => p.role !== 'spymaster').map(p => p.name).join(', ') || '_لا يوجد_'}\n\n` +
        `🔴 *الفريق الأحمر:*\n` +
        `• القائد: ${redSpy ? redSpy.name : '_لم يُحدد بعد_'}\n` +
        `• العملاء: ${redPlayers.filter(p => p.role !== 'spymaster').map(p => p.name).join(', ') || '_لا يوجد_'}\n\n` +
        `اضغطوا على الأزرار أدناه للانضمام ثم اضغطوا (ابدأ اللعبة 🚀)`;
    }

    if (game.status === 'game_over') {
      const winnerEmoji = game.winner === 'blue' ? '🔵' : '🔴';
      const winnerName = game.winner === 'blue' ? 'الفريق الأزرق' : 'الفريق الأحمر';
      const reasonText = game.winReason === 'assassin_triggered' 
        ? 'بسبب لمس بطاقة القاتل (القنبلة) 💣'
        : 'بسبب كشف جميع الكلمات التابعة للفريق! 🎯';

      return `🎉 *انتهت اللعبة! فاز ${winnerName} ${winnerEmoji}*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `${reasonText}\n\n` +
        `📊 *النتيجة النهائية:*\n` +
        `🔵 متبقي للأزرق: ${blueRemaining}\n` +
        `🔴 متبقي للأحمر: ${redRemaining}\n\n` +
        `شكراً للعب! اضغط أدناه لبدء جولة جديدة 🔄`;
    }

    const currentTurnEmoji = game.currentTurn === 'blue' ? '🔵' : '🔴';
    const currentTurnName = game.currentTurn === 'blue' ? 'الفريق الأزرق' : 'الفريق الأحمر';

    let header = `🎮 *كود نيمز | لوحة اللعب*\n` +
      `🔵 الأزرق: متبقي *${blueRemaining}* | 🔴 الأحمر: متبقي *${redRemaining}*\n` +
      `━━━━━━━━━━━━━━━━━━━\n`;

    if (game.status === 'spymaster_turn') {
      header += `⏳ *الدور الآن:* قائد ${currentTurnName} ${currentTurnEmoji}\n` +
        `✍️ القائد يكتب تلميحه بالخاص عند البوت (كلمة + رقم) — بلا أي أوامر.\n` +
        `💡 الخريطة السرية للقادة عبر زر 🗺️ بالأسفل.`;
    } else {
      const clue = game.currentClue;
      header += `🎯 *الدور الآن:* عملاء ${currentTurnName} ${currentTurnEmoji}\n` +
        `📢 *التلميح الحالي:* "${clue?.word}" (${clue?.count})\n` +
        `🔢 المحاولات المتبقية: *${clue?.remainingGuesses}*\n` +
        `👇 اضغط على الكلمة لتخمينها من اللوحة:`;
    }

    if (lastEvent) {
      header += `\n\n━━━━━━━━━━━━━━━━━━━\n📢 *آخر حدث:* ${lastEvent}`;
    }

    return header;
  }

  /**
   * Generates Telegram Inline Keyboard buttons matrix (5x5 + action buttons)
   */
  public static getTelegramInlineKeyboard(game: CodenamesGame): any[][] {
    if (game.status === 'lobby') {
      return [
        [
          { text: 'انضم كـ عميل أزرق 🔵', callback_data: 'join:blue:operative' },
          { text: 'انضم كـ عميل أحمر 🔴', callback_data: 'join:red:operative' }
        ],
        [
          { text: 'قائد أزرق 🕵️‍♂️', callback_data: 'join:blue:spymaster' },
          { text: 'قائد أحمر 🕵️‍♀️', callback_data: 'join:red:spymaster' }
        ],
        [
          { text: 'ابدأ اللعبة 🚀', callback_data: 'game:start' }
        ]
      ];
    }

    if (game.status === 'game_over') {
      return [
        [
          { text: '🔄 بدء جولة جديدة (Rematch)', callback_data: 'game:new' },
          { text: '🗺️ كشف الخريطة كاملة', callback_data: 'game:show_all' }
        ]
      ];
    }

    // 5x5 cards
    const keyboard: any[][] = [];

    for (let r = 0; r < 5; r++) {
      const rowButtons = [];
      for (let c = 0; c < 5; c++) {
        const card = game.cards[r * 5 + c];
        if (!card) continue;

        if (card.revealed) {
          let prefix = '⚪';
          if (card.type === 'blue') prefix = '🔵';
          if (card.type === 'red') prefix = '🔴';
          if (card.type === 'assassin') prefix = '💣';

          rowButtons.push({
            text: `${prefix} ${card.word}`,
            callback_data: `info:revealed:${card.id}`
          });
        } else {
          rowButtons.push({
            text: card.word,
            callback_data: `guess:${card.id}`
          });
        }
      }
      keyboard.push(rowButtons);
    }

    // Action row
    const actionRow = [];
    if (game.status === 'operative_turn') {
      actionRow.push({ text: '⏭️ إنهاء التخمين (Pass)', callback_data: 'action:pass' });
    }
    actionRow.push({ text: '🗺️ خريطة القائد (خاص)', callback_data: 'action:secret_map' });
    keyboard.push(actionRow);

    return keyboard;
  }
}
