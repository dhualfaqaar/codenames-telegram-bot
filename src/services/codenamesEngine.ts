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

export const CODENAMES_TURN_MS = 2 * 60 * 1000;

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
    customWords: string[] = [],
    createdBy?: number | string
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
      createdBy,
      logs: [
        {
          id: Math.random().toString(36).substring(7),
          timestamp: Date.now(),
          type: 'lobby',
          message: 'تم فتح غرفة كود نيمز جديدة! انضموا إلى الفرق لاختيار الجواسيس والعملاء.'
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

    const teamColor = player.team === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
    const existingIndex = game.players.findIndex(p => String(p.id) === String(player.id));
    const alreadyIn = existingIndex >= 0;

    let targetTeam: Team = player.team;
    let targetRole: PlayerRole = player.role;

    const allSeats: Array<[Team, PlayerRole]> = [
      ['blue', 'operative'],
      ['red', 'operative'],
      ['blue', 'spymaster'],
      ['red', 'spymaster']
    ];
    const freeSeats = allSeats.filter(
      ([t, r]) => !game.players.some(p => p.team === t && p.role === r && String(p.id) !== String(player.id))
    );

    // إذا اللاعب الجديد ضغط زر «انضم» العام أو ضغط بالغلط مقعد محجوز واكو مقعد فاضي → نجلسه تلقائياً بالمقعد الفاضي!
    const seatTaken = game.players.find(
      p => p.team === targetTeam && p.role === targetRole && String(p.id) !== String(player.id)
    );
    const wantsAuto = (player.team as string) === 'auto' || (player.role as string) === 'auto';

    if (wantsAuto || (!alreadyIn && seatTaken)) {
      const openSeats = allSeats.filter(([t, r]) => !game.players.some(p => p.team === t && p.role === r));
      if (!openSeats.length) {
        return {
          success: false,
          message: '⚠️ اكتملت المقاعد الأربعة (4/4)! المشرف يقدر يضغط «ابدأ اللعبة 🚀».',
          game
        };
      }
      [targetTeam, targetRole] = openSeats[0];
    } else if (seatTaken) {
      const seatName = targetRole === 'spymaster' ? 'الجاسوس 🕵️' : 'العميل 👤';
      return {
        success: false,
        message: `⚠️ مقعد ${seatName} (${teamColor}) محجوز — اختار مقعد فاضي ⬜.`,
        game
      };
    }

    const finalTeamColor = targetTeam === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
    const finalPlayer = { ...player, team: targetTeam, role: targetRole };

    const updatedPlayers = [...game.players];
    if (existingIndex >= 0) {
      updatedPlayers[existingIndex] = { ...updatedPlayers[existingIndex], ...finalPlayer };
    } else {
      updatedPlayers.push(finalPlayer);
    }

    const roleText = targetRole === 'spymaster' ? 'جاسوس 🕵️' : 'عميل 👤';

    const logEntry: GameLogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      type: 'lobby',
      team: targetTeam,
      message: `انضم ${this.nameTag(player.name)} إلى الفريق ${finalTeamColor} بصفة ${roleText}`
    };

    const autoRedirectNote = !wantsAuto && !alreadyIn && seatTaken
      ? `✅ المقعد المختار محجوز — سجّلناك تلقائياً (${roleText} — ${finalTeamColor})!`
      : `✅ سُجّلت بالفريق ${finalTeamColor} كـ ${roleText}!`;

    return {
      success: true,
      message: autoRedirectNote,
      game: {
        ...game,
        players: updatedPlayers,
        logs: [...game.logs, logEntry],
        updatedAt: Date.now()
      }
    };
  }

  /**
   * A player leaves the lobby. His seat becomes free again for anybody else.
   */
  public static leaveGame(
    game: CodenamesGame,
    playerId: number | string
  ): { success: boolean; message: string; game: CodenamesGame } {
    if (game.status !== 'lobby') {
      return {
        success: false,
        message: 'اللعبة انطلقت بالفعل — ما ينفع الانسحاب هسه.',
        game
      };
    }

    const index = game.players.findIndex(p => String(p.id) === String(playerId));
    if (index < 0) {
      return { success: false, message: 'إنت مو مسجّل بهذه اللعبة.', game };
    }

    const leaving = game.players[index];
    const teamColor = leaving.team === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
    const roleText = leaving.role === 'spymaster' ? 'الجاسوس 🕵️' : 'العميل 👤';

    const logEntry: GameLogEntry = {
      id: `leave_${Date.now()}_${index}`,
      timestamp: Date.now(),
      type: 'lobby',
      team: leaving.team,
      message: `🚪 ${this.nameTag(leaving.name)} انسحب من اللعبة (${roleText} — ${teamColor})`
    };

    return {
      success: true,
      message: `🚪 انسحبت — مقعدك (${roleText} ${teamColor}) صار فاضي.`,
      game: {
        ...game,
        players: game.players.filter((_, i) => i !== index),
        logs: [...game.logs, logEntry],
        updatedAt: Date.now()
      }
    };
  }

  /**
   * Start the match and generate 25 random cards
   */
  public static startGame(game: CodenamesGame, customWords: string[] = []): { success: boolean; message: string; game: CodenamesGame } {
    if (game.status !== 'lobby') {
      return { success: false, message: 'اللعبة بدأت بالفعل — ما راح نرسل إشعارات مكررة.', game };
    }

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
      message: `بدأت اللعبة! الفريق البادئ هو ${startingTeam === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴'} (لديه 9 كلمات). بانتظار تلميح الجاسوس!`
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
        turnDeadline: Date.now() + CODENAMES_TURN_MS,
        lastCountdownAt: Date.now(),
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
    spymasterName: string = 'الجاسوس'
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
        turnDeadline: Date.now() + CODENAMES_TURN_MS,
        lastCountdownAt: Date.now(),
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
    operativeName: string = 'العميل',
    operativeTeam?: Team
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
    if (operativeTeam && operativeTeam !== game.currentTurn) {
      const teamName = game.currentTurn === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
      return { success: false, message: `مو دور فريقك — التخمين هسه لفريق ${teamName}.`, game };
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
          turnDeadline: undefined,
          lastCountdownAt: undefined,
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
          turnDeadline: undefined,
          lastCountdownAt: undefined,
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
          turnDeadline: undefined,
          lastCountdownAt: undefined,
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
          message: `انتهت محاولات التخمين لهذا الدور. ينتقل الدور إلى جاسوس الفريق ${oppositeTeam === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴'}.`
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
            turnDeadline: Date.now() + CODENAMES_TURN_MS,
            lastCountdownAt: Date.now(),
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
        turnDeadline: Date.now() + CODENAMES_TURN_MS,
        lastCountdownAt: Date.now(),
        logs: [...game.logs, failLog],
        updatedAt: Date.now()
      }
    };
  }

  /**
   * Ends the current spy or operative turn after its two-minute deadline.
   * A partial turn is still forfeited; the other team's spymaster starts fresh.
   */
  public static timeoutTurn(game: CodenamesGame, now = Date.now()): { success: boolean; message: string; game: CodenamesGame } {
    if (
      (game.status !== 'spymaster_turn' && game.status !== 'operative_turn') ||
      game.turnDeadline === undefined ||
      now < game.turnDeadline
    ) {
      return { success: false, message: 'لم تنتهِ مهلة الدور بعد.', game };
    }

    const timedOutTeam = game.currentTurn;
    const nextTeam: Team = timedOutTeam === 'blue' ? 'red' : 'blue';
    const timedOutRole = game.status === 'spymaster_turn' ? 'الجاسوس' : 'العملاء';
    const teamName = timedOutTeam === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
    const nextName = nextTeam === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
    const message = `⏰ انتهت دقيقتا ${timedOutRole} للفريق ${teamName} من دون إكمال الدور؛ ينتقل الدور إلى جاسوس الفريق ${nextName}.`;
    const logEntry: GameLogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: now,
      type: 'system',
      team: timedOutTeam,
      message
    };

    return {
      success: true,
      message,
      game: {
        ...game,
        status: 'spymaster_turn',
        currentTurn: nextTeam,
        currentClue: undefined,
        turnDeadline: now + CODENAMES_TURN_MS,
        lastCountdownAt: now,
        logs: [...game.logs, logEntry],
        updatedAt: now
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
        turnDeadline: Date.now() + CODENAMES_TURN_MS,
        lastCountdownAt: Date.now(),
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
   * Full secret map: the color grid plus the exact words of every color,
   * with a short explanation of what each color means.
   * Pass the recipient's team to get "كلمات فريقك" wording; omit it for a neutral view.
   */
  public static getSecretKeyVisual(game: CodenamesGame, team?: Team): string {
    if (game.cards.length !== 25) return 'لا توجد لعبة نشطة حالياً.';

    const wordsOf = (type: CardType) =>
      game.cards
        .filter(c => c.type === type)
        .map(c => (c.revealed ? `~${c.word}~` : c.word))
        .join('، ') || '_ما بقى ولا كلمة_';

    const countOf = (type: CardType) => game.cards.filter(c => c.type === type).length;

    // Wording depends on which team the reader captains.
    const blueTitle =
      team === 'red' ? '🔴 *كلمات الخصم*' : team === 'blue' ? '🔵 *كلمات فريقك*' : '🔵 *الفريق الأزرق*';
    const redTitle =
      team === 'blue' ? '🔴 *كلمات الخصم*' : team === 'red' ? '🔴 *كلمات فريقك*' : '🔴 *الفريق الأحمر*';

    return (
      `🗺️ *خريطتك السرية* 🕵️ — إنت وحدك تشوفها!\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `*شنو معنى الألوان؟*\n` +
      `🔵 أزرق  |  🔴 أحمر  |  ⚪ محايد  |  💣 القاتل\n\n` +
      `*موقع البطاقات على اللوحة* (نفس ترتيب الأزرار):\n\n` +
      `${this.getSecretKeyGrid(game)}\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `${blueTitle} (${countOf('blue')}) — صاحبها هو اللي لازم يخمّنها:\n` +
      `${wordsOf('blue')}\n\n\n` +
      `${redTitle} (${countOf('red')}) — لا تلمسونها، إذا لمستوها تربحون للخصم:\n` +
      `${wordsOf('red')}\n\n\n` +
      `⚪ *المحايد* (${countOf('bystander')}) — إذا اختار فريقك وحدة من هذي، ما تربحون ولا تخسرون، بس *يضيع دوركم* وينتقل للخصم:\n` +
      `${wordsOf('bystander')}\n\n\n` +
      `💣 *القاتل (الأسود)* — إذا اختار صديقك هذي الكلمة *تخسرون اللعبة فوراً!* ⚠️\n` +
      `${wordsOf('assassin')}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `💡 *نصيحة:* خلي تلميحك واضح لفريقك، وبعيد كلش عن الكلمة المحايدة والكلمة السوداء.`
    );
  }

  /**
   * Compact 5x5 color grid (no Markdown) — fits inside a Telegram callback popup.
   * Positions match the buttons on the board exactly.
   */
  public static getSecretKeyGrid(game: CodenamesGame): string {
    const icons: Record<CardType, string> = {
      blue: '🔵',
      red: '🔴',
      bystander: '⚪',
      assassin: '💣'
    };
    const rows: string[] = [];
    for (let r = 0; r < 5; r++) {
      const cells: string[] = [];
      for (let c = 0; c < 5; c++) {
        const card = game.cards[r * 5 + c];
        cells.push(card ? icons[card.type] : '⬛');
      }
      rows.push(cells.join(' '));
    }
    return rows.join('\n');
  }

  /**
   * Player list, one team per block, and every player with their role in brackets.
   */
  public static rosterLine(game: CodenamesGame): string {
    return `${this.teamRoster(game, 'blue')}\n\n${this.teamRoster(game, 'red')}`;
  }

  /**
   * A player name, bolded so it stands out from the rest of the text.
   * (Markdown-breaking characters are stripped first.)
   */
  public static nameTag(name: string): string {
    const clean = String(name || '').replace(/[*_`\[\]\\|]/g, '').trim();
    return `| *${clean}* |`;
  }

  /**
   * One team's roster: each joined player sits inside a colored blockquote
   */
  public static teamRoster(game: CodenamesGame, team: Team): string {
    const list = game.players.filter(p => p.team === team);
    const title =
      team === 'blue'
        ? `🔵 *الفريق الأزرق* (${list.length}/2)`
        : `🔴 *الفريق الأحمر* (${list.length}/2)`;

    const spy = list.find(p => p.role === 'spymaster');
    const op = list.find(p => p.role === 'operative');
    const joined: string[] = [];
    const empty: string[] = [];

    if (spy) joined.push(`> ${joined.length + 1} - ${this.nameTag(spy.name)} (جاسوس 🕵️)`);
    else empty.push(`⬜ جاسوس 🕵️`);

    if (op) joined.push(`> ${joined.length + 1} - ${this.nameTag(op.name)} (عميل 👤)`);
    else empty.push(`⬜ عميل 👤`);

    return [title, ...joined, ...empty].join('\n');
  }

  /**
   * Formats the Telegram Chat message text for the group
   */
  public static getTelegramMessageText(game: CodenamesGame, lastEvent?: string): string {
    const { blueRemaining, redRemaining } = this.getScores(game);

    if (game.status === 'lobby') {
      const full =
        game.players.filter(p => p.team === 'blue').length >= 2 &&
        game.players.filter(p => p.team === 'red').length >= 2;

      return `🕵️‍♂️ *لعبة كود نيمز (Codenames)* 🕵️‍♀️\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `👥 *المنضمون:* ${game.players.length} من 4\n\n` +
        `${this.teamRoster(game, 'blue')}\n\n` +
        `${this.teamRoster(game, 'red')}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        (full
          ? `🔒 *اكتمل العدد!* — المشرف يضغط (ابدأ اللعبة 🚀)\n`
          : `_⏳ قيد الانتظار: باقي ${Math.max(0, 4 - game.players.length)} لاعب — كل فريق يحتاج (جاسوس 🕵️ + عميل 👤)._\n`) +
        `⚠️ ملاحظة: الجاسوس لازم يفتح الخاص ويا البوت حتى توصله خريطة فريقه! 🗺️`;
    }

    if (game.status === 'game_over') {
      const winnerEmoji = game.winner === 'blue' ? '🔵' : '🔴';
      const winnerName = game.winner === 'blue' ? 'الفريق الأزرق' : 'الفريق الأحمر';
      const reasonText = game.winReason === 'assassin_triggered'
        ? 'فريق الخصم لمس بطاقة القاتل 💣'
        : 'الفريق كشف كل كلماته 🎯';

      return `🎉 *انتهت اللعبة! فاز ${winnerName}* ${winnerEmoji}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🏁 *السبب:* ${reasonText}\n\n` +
        `📊 *النتيجة النهائية:*\n` +
        `🔵 الأزرق: متبقي *${blueRemaining}*\n` +
        `🔴 الأحمر: متبقي *${redRemaining}*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🔄 اضغط «بدء جولة جديدة» بالأسفل للعب مرة ثانية`;
    }

    const currentTurnEmoji = game.currentTurn === 'blue' ? '🔵' : '🔴';
    const currentTurnName = game.currentTurn === 'blue' ? 'الأزرق' : 'الأحمر';

    let header =
      `🎮 *لعبة كود نيمز | لوحة اللعب*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📊 *النتيجة:*\n` +
      `🔵 الأزرق: متبقي *${blueRemaining}*\n` +
      `🔴 الأحمر: متبقي *${redRemaining}*\n`;

    const roster = this.rosterLine(game);
    if (roster) {
      header += `\n👥 *اللاعبون:*\n${roster}\n`;
    }

    header += `━━━━━━━━━━━━━━━━━━━\n`;

    if (game.status === 'spymaster_turn') {
      header += `🎯 *الدور الآن:* ⏳ جاسوس الفريق ${currentTurnName} ${currentTurnEmoji}\n` +
        `✍️ الجاسوس يطلب مربع التلميح بالخاص من زر اللوحة (كلمة وحدة + رقم).\n` +
        `💡 الخريطة السرية بطلب الجاسوس من زر «🎨 بطاقاتي الملوّنة» بالأسفل.`;
    } else {
      const clue = game.currentClue;
      header += `🎯 *الدور الآن:* عملاء الفريق ${currentTurnName} ${currentTurnEmoji}\n` +
        `📢 *التلميح:* "${clue?.word}" — عدد البطاقات *${clue?.count}*\n` +
        `🔢 المحاولات المتبقية: *${clue?.remainingGuesses}*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `👇 اضغط على الكلمة من اللوحة بالأسفل لتخمينها:`;
    }

    const remainingSeconds = Math.max(0, Math.ceil(((game.turnDeadline || Date.now()) - Date.now()) / 1000));
    const remainingClock = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;
    header += `\n⏱️ *المهلة:* دقيقتان — المتبقي \`${remainingClock}\``;

    if (lastEvent) {
      header += `\n━━━━━━━━━━━━━━━━━━━\n📢 *آخر حدث:*\n> ${lastEvent}`;
    }

    return header;
  }

  /**
   * Generates Telegram Inline Keyboard buttons matrix (5x5 + action buttons)
   */
  public static getTelegramInlineKeyboard(game: CodenamesGame): any[][] {
    if (game.status === 'lobby') {
      const hasSeat = (team: Team, role: PlayerRole) =>
        game.players.some(p => p.team === team && p.role === role);
      const seatMark = (team: Team, role: PlayerRole) => (hasSeat(team, role) ? '✅' : '⬜');
      const rows: any[][] = [];
      rows.push([
        { text: `${seatMark('blue', 'operative')} عميل أزرق 🔵`, callback_data: `join:blue:operative:${game.id}` },
        { text: `${seatMark('red', 'operative')} عميل أحمر 🔴`, callback_data: `join:red:operative:${game.id}` }
      ]);
      rows.push([
        { text: `${seatMark('blue', 'spymaster')} جاسوس أزرق 🕵️`, callback_data: `join:blue:spymaster:${game.id}` },
        { text: `${seatMark('red', 'spymaster')} جاسوس أحمر 🕵️`, callback_data: `join:red:spymaster:${game.id}` }
      ]);
      if (game.players.length < 4) {
        rows.push([{ text: '➕ انضم تلقائياً', callback_data: `join:auto:auto:${game.id}` }]);
      }
      rows.push([{ text: 'ابدأ اللعبة 🚀', callback_data: `game:start:${game.id}` }]);
      return rows;
    }

    if (game.status === 'game_over') {
      return [
        [
          { text: '🔄 بدء جولة جديدة (Rematch)', callback_data: `game:new:${game.id}` },
          { text: '🗺️ كشف الخريطة كاملة', callback_data: `game:show_all:${game.id}` }
        ]
      ];
    }

    // Keep buttons compact in pairs, but give long words a full-width row so Telegram
    // doesn't squeeze or visually cut their labels on mobile clients.
    const keyboard: any[][] = [];
    let compactRow: any[] = [];
    const flushCompactRow = () => {
      if (compactRow.length) keyboard.push(compactRow);
      compactRow = [];
    };

    for (const card of game.cards) {
      let button: any;
      if (card.revealed) {
        let prefix = '⚪';
        if (card.type === 'blue') prefix = '🔵';
        if (card.type === 'red') prefix = '🔴';
        if (card.type === 'assassin') prefix = '💣';
        button = {
          text: `${prefix} ${card.word}`,
          callback_data: `info:revealed:${card.id}:${game.id}`
        };
      } else {
        button = {
          text: card.word,
          callback_data: `guess:${card.id}:${game.id}`
        };
      }

      if (Array.from(card.word).length > 8) {
        flushCompactRow();
        keyboard.push([button]);
      } else {
        compactRow.push(button);
        if (compactRow.length === 2) flushCompactRow();
      }
    }
    flushCompactRow();

    // Action row
    const actionRow = [];
    if (game.status === 'operative_turn') {
      actionRow.push({ text: '⏭️ إنهاء التخمين (Pass)', callback_data: `action:pass:${game.id}` });
    }
    if (game.status === 'spymaster_turn') {
      actionRow.push({ text: '✍️ اطلب مربع التلميح بالخاص', callback_data: `action:prompt_clue:${game.id}` });
    }
    actionRow.push({ text: '🎨 بطاقاتي الملوّنة (للجاسوس 🕵️)', callback_data: `action:secret_map:${game.id}` });
    keyboard.push(actionRow);

    return keyboard;
  }
}
