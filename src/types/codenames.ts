export type Team = 'blue' | 'red';
export type PlayerRole = 'spymaster' | 'operative';
export type CardType = 'blue' | 'red' | 'bystander' | 'assassin';

export interface Card {
  id: number;
  word: string;
  type: CardType;
  revealed: boolean;
  revealedBy?: {
    team: Team;
    playerName: string;
  };
}

export interface Player {
  id: number | string;
  name: string;
  username?: string;
  team: Team;
  role: PlayerRole;
  isBot?: boolean;
}

export type GameStatus = 
  | 'lobby'             // Players joining teams and roles
  | 'spymaster_turn'    // Spymaster needs to provide clue
  | 'operative_turn'    // Operatives guessing words
  | 'game_over';        // Game ended with a winner

export interface Clue {
  word: string;
  count: number;
  remainingGuesses: number;
  givenBy: string;
  team: Team;
  timestamp: number;
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  type: 'lobby' | 'clue' | 'guess' | 'pass' | 'winner' | 'system';
  message: string;
  team?: Team;
}

export interface CodenamesGame {
  id: string; // Chat ID or simulated room ID
  chatTitle?: string;
  status: GameStatus;
  startingTeam: Team;
  currentTurn: Team;
  cards: Card[]; // 25 cards
  players: Player[];
  currentClue?: Clue;
  /** نهاية مهلة الدور الحالية (دقيقتان للجاسوس أو العملاء). */
  turnDeadline?: number;
  /** آخر وقت حدّثنا به العدّ التنازلي في لوحة تيليغرام. */
  lastCountdownAt?: number;
  /** آخر نشاط يُبقى ظاهراً أثناء تحديث العدّ التنازلي. */
  lastEvent?: string;
  clueHistory: Clue[];
  winner?: Team;
  winReason?: 'all_cards_found' | 'assassin_triggered';
  messageId?: number; // Telegram message ID of the game board
  /** The admin who opened the lobby — only this person may press "start". */
  createdBy?: number | string;
  wordPack: 'arabic_standard' | 'arabic_iraqi' | 'pop_culture' | 'english' | 'custom';
  logs: GameLogEntry[];
  createdAt: number;
  updatedAt: number;
  /** 💵 هل انصرفت جوائز هاي المباراة؟ (حتى ما تنصرف مرتين) */
  rewarded?: boolean;
}

export interface BotConfig {
  token: string;
  hasToken?: boolean;
  tokenPreview?: string | null;
  isActive: boolean;
  botInfo?: {
    id: number;
    first_name: string;
    username: string;
    can_join_groups: boolean;
    can_read_all_group_messages: boolean;
    supports_inline_queries: boolean;
  };
  mode: 'polling' | 'webhook';
  webhookUrl?: string;
  activeRoomsCount: number;
  lastError?: string;
  lastPollTime?: number;
}

export interface PlayerStat {
  name: string;
  team: Team;
  wordsGuessed: number;
  correctGuesses: number;
  wrongGuesses: number;
  gamesPlayed: number;
  winCount: number;
}

export interface GameStats {
  totalGamesPlayed: number;
  blueWins: number;
  redWins: number;
  blueWinPercentage: number;
  redWinPercentage: number;
  assassinTriggers: number;
  allCardsFoundWins: number;
  totalWordsGuessed: number;
  playerStats: PlayerStat[];
  recentMatches: CodenamesGame[];
}
