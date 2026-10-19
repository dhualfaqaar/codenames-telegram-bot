import { CodenamesEngine } from '../src/services/codenamesEngine';
import { CodenamesGame, CardType, GameStats, PlayerStat, PlayerRole, Team } from '../src/types/codenames';

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

  constructor(initialToken?: string) {
    if (initialToken) {
      this.token = initialToken.trim();
    }
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
      chatTitle: 'قروب الشباب 🎮',
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

  public recordFinishedGame(game: CodenamesGame) {
    if (game.status !== 'game_over') return;
    const exists = this.completedGames.some(g => g.id === game.id);
    if (!exists) {
      this.completedGames.unshift(game);
      if (this.completedGames.length > 50) {
        this.completedGames = this.completedGames.slice(0, 50);
      }
    }
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
      pendingClueWord: Array.from(this.pendingClueWord.entries())
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

    if (!text) return;

    const lower = text.toLowerCase();

    // Spymaster typing the clue word privately (NO command needed)
    if (message.chat.type === 'private' && sender && !text.startsWith('/')) {
      const pendingGameId = this.awaitingClueWord.get(String(sender.id));
      if (pendingGameId) {
        await this.handleClueWordInput(pendingGameId, sender, text);
        return;
      }
    }

    // /start command
    if (lower.startsWith('/start')) {
      if (message.chat.type === 'private') {
        await this.sendPrivateWelcome(chatId, senderName);
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
  }

  /**
   * Handle Callback Queries from Telegram Inline Buttons
   */
  private async handleCallbackQuery(cb: TelegramCallbackQuery) {
    const data = cb.data || '';
    const chatId = String(cb.message?.chat.id || cb.from.id);
    const userId = cb.from.id;
    const userName = cb.from.first_name + (cb.from.last_name ? ` ${cb.from.last_name}` : '');

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

    let game = this.games.get(chatId);

    // If no game in this chat, notify (game:new can create one from scratch)
    if (!game && !data.startsWith('action:secret_map') && data !== 'game:new') {
      await this.answerCallbackQuery(cb.id, 'لا توجد لعبة نشطة في هذه المحادثة! ابدأ لعبة جديدة من الخاص بأمر /start.');
      return;
    }

    // 1. Join Team or Role: join:blue:operative, join:blue:spymaster, etc.
    if (data.startsWith('join:') && game) {
      const [, team, role] = data.split(':');
      const result = CodenamesEngine.joinGame(game, {
        id: userId,
        name: userName,
        username: cb.from.username,
        team: team as any,
        role: role as PlayerRole
      });

      if (!result.success) {
        await this.answerCallbackQuery(cb.id, result.message, true);
        return;
      }

      this.games.set(chatId, result.game);
      await this.updateTelegramGameBoard(chatId, result.game, cb.message?.message_id);

      let alertText = result.message;
      let showAlert = false;
      if (role === 'spymaster') {
        // Spymasters must be reachable in private chat for the no-command clue input
        const dm = await this.sendMessage(
          String(userId),
          `🕵️ سُجّلت *قائداً* في لعبة «${this.mdSafe(result.game.chatTitle || 'المجموعة')}»!\n\n` +
            CodenamesEngine.getSpymasterGuide(team as Team)
        );
        if (!dm?.ok) {
          showAlert = true;
          alertText += `\n⚠️ مهم: افتح الخاص معي (@${this.botInfo?.username || 'البوت'}) واضغط Start عشان أقدر أرسللك التلميح.`;
        }
      }
      await this.answerCallbackQuery(cb.id, alertText, showAlert);
      return;
    }

    // 2. Start game
    if (data === 'game:start' && game) {
      // Only the owner (the admin who opened the lobby) may start the round.
      if (game.createdBy && String(game.createdBy) !== String(userId)) {
        await this.answerCallbackQuery(
          cb.id,
          '⚠️ فقط المشرف صاحب اللعبة يقدر يضغط (ابدأ اللعبة 🚀).',
          true
        );
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
          '⚠️ كل فريق لازم يختار قائد (🕵️) قبل ما تبدأ اللعبة.',
          true
        );
        return;
      }

      const result = CodenamesEngine.startGame(game, this.customWords);
      this.games.set(chatId, result.game);

      await this.answerCallbackQuery(cb.id, 'بدأت اللعبة! تم توزيع الكلمات 🚀');
      await this.updateTelegramGameBoard(chatId, result.game, cb.message?.message_id);

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
          '⚠️ هذي الخريطة للقادة (🕵️) بس! إنت عليك تنتظر تلميح قائدك.',
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
        `🕵️ *خريطتك السرية يا قائد* — إنت وحدك تشوفها:\n\n${fullMap}\n\n⚠️ _لا تشاركها مع أحد!_`
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
        await this.answerCallbackQuery(cb.id, '⏳ ليس دور التخمين الآن! بانتظار تلميح القائد.', true);
        return;
      }

      // Verify that user is not the spymaster
      const player = game.players.find(p => String(p.id) === String(userId));
      if (player && player.role === 'spymaster') {
        await this.answerCallbackQuery(cb.id, '⛔ أنت القائد! لا يجوز للقادة الضغط على بطاقات التخمين.', true);
        return;
      }

      // Guess card
      const result = CodenamesEngine.guessCard(game, cardId, userName);
      if (!result.success) {
        await this.answerCallbackQuery(cb.id, result.message, true);
        return;
      }

      this.games.set(chatId, result.game);
      if (result.game.status === 'game_over') {
        this.recordFinishedGame(result.game);
      }
      await this.answerCallbackQuery(cb.id, result.message);
      await this.updateTelegramGameBoard(chatId, result.game, cb.message?.message_id);

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
      await this.updateTelegramGameBoard(chatId, result.game, cb.message?.message_id);

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
  private async startNewGameLobby(chatId: string, chatTitle: string, createdBy?: number | string): Promise<number | null> {
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

    const text = CodenamesEngine.getTelegramMessageText(game);
    const keyboard = CodenamesEngine.getTelegramInlineKeyboard(game);

    // Reuse the previous board message (single-message mode)
    if (prevMessageId) {
      const res = await this.editMessageText(chatId, prevMessageId, text, keyboard);
      if (res?.ok) {
        game.messageId = prevMessageId;
        this.games.set(chatId, game);
        return prevMessageId;
      }
    }

    const sent = await this.sendMessage(chatId, text, keyboard);
    const msgId = sent?.result?.message_id;
    if (msgId) {
      game.messageId = msgId;
      this.games.set(chatId, game);
    }
    return msgId || null;
  }

  /**
   * Private /start welcome, with a button that lets the user pick a channel to play in.
   */
  private async sendPrivateWelcome(chatId: string, userName: string) {
    const botUser = this.botInfo?.username;
    const welcome =
      `👋 أهلاً بك يا ${userName} في *بوت كود نيمز (Codenames)*!\n\n` +
      `📣 *تلعب بقناة؟* (إنت المشرف الوحيد، والأعضاء ما يكتبون أوامر)\n` +
      `1️⃣ ضيف البوت إلى قناتك كمشرف (Admin).\n` +
      `2️⃣ ارجع لهنا واضغط زر «📣 شارك اللعبة في قناتك».\n` +
      `3️⃣ اختار قناتك — تنتزل اللعبة هناك وتكمل بالأزرار.\n\n` +
      `🕵️ *القائد:* راح أرسلله مربع بالخاص يكتب بيه كلمة التلميح (بلا أوامر)، وبعدين يختار الرقم.\n` +
      `👥 *الأعضاء:* يخمّنون بالضغط على أزرار الكلمات بالقناة.\n\n` +
      `🎮 *أو العب بمجموعة:* ضيف البوت لمجموعتك.\n` +
      `🗺️ القائد يشوف بطاقاته الملوّنة من زر «🎨 بطاقاتي الملوّنة (للقائد 🕵️)» — كل شي بالأزرار، بلا أي أوامر.`;

    const keyboard: any[][] = [];
    if (botUser) {
      keyboard.push([{
        text: '➕ ضيف البوت لقناتك (مشرف)',
        url: `https://t.me/${botUser}?startchannel=true`
      }]);
    }
    keyboard.push([{
      text: '📣 شارك اللعبة في قناتك',
      request_chat: { request_id: 1, chat_is_channel: true, bot_is_member: true }
    }]);
    if (botUser) {
      keyboard.push([{
        text: '➕ ضيف البوت لمجموعتك',
        url: `https://t.me/${botUser}?startgroup=codenames`
      }]);
    }

    await this.sendMessageRaw(chatId, welcome, {
      keyboard,
      resize_keyboard: true,
      one_time_keyboard: true
    });
  }

  /**
   * The user picked a channel from the "share game to channel" button.
   */
  private async handleChatShared(message: TelegramMessage) {
    const shared = message.chat_shared!;
    const channelId = String(shared.chat_id);
    const title = shared.title || 'القناة';
    const byUser = message.from ? String(message.from.id) : '';

    const msgId = await this.startNewGameLobby(channelId, title, message.from?.id);
    if (!byUser) return;

    if (msgId) {
      await this.sendMessage(
        byUser,
        `✅ نزّلت اللعبة بقناتك «${this.mdSafe(title)}».\n` +
        `روح للقناة — الأعضاء ينضمون للفرق 🔵🔴 وإنت (المشرف) تضغط (ابدأ اللعبة 🚀) لما ينضمون.`
      );
    } else {
      await this.sendMessage(
        byUser,
        `⚠️ ما گدرت أنزل اللعبة بقناة «${this.mdSafe(title)}».\n` +
        `تأكد إن البوت *مشرف (Admin)* بالقناة، وبعدين جرّب الزر مره ثانية.`
      );
    }
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
          `\n\n💡 إذا ضاعت منك الخريطة، اضغط زر «🎨 بطاقاتي الملوّنة (للقائد 🕵️)» بالمحادثة.`
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
      `🕵️ *دورك يا قائد الفريق ${teamName}!*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `✍️ اكتب *كلمة التلميح* بالمربع بالأسفل — كلمة *وحدة* بس، وما تكون موجودة أصلاً بالبوكسات.\n` +
      `بعدها راح أطلب منك الرقم.\n\n` +
      `💡 تبي تشوف بطاقاتك؟ اضغط زر «🎨 بطاقاتي الملوّنة» بالقناة.`,
      { force_reply: true, selective: true, input_field_placeholder: 'اكتب كلمة التلميح هنا' }
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
      await this.sendMessage(userId, '⚠️ إنت مو قائد بهذي اللعبة.');
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
      `✍️ تلميحك: *${this.mdSafe(word)}*\n\n📊 اختار عدد الكلمات اللي يقصدها 👇`,
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
      `📢 القائد ${this.mdSafe(userName)} (${teamName}) قال: «${this.mdSafe(pending.word)}» × ${count}`
    );
  }

  /**
   * Update or Edit existing Telegram Game Board message.
   * Single-message mode: we always try to EDIT the same board message.
   * A new message is only sent if the old one was deleted from the chat.
   */
  private async updateTelegramGameBoard(chatId: string, game: CodenamesGame, messageId?: number, lastEvent?: string) {
    const msgId = messageId || game.messageId;
    const text = CodenamesEngine.getTelegramMessageText(game, lastEvent);
    const keyboard = CodenamesEngine.getTelegramInlineKeyboard(game);

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

      return await res.json();
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
