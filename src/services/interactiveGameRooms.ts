import { Chess } from 'chess.js';
import { chooseChessBotMove } from './chessBot';
import { getChessTrainer } from '../data/chessTrainers';

export type InteractiveGameId = 'chess' | 'uno' | 'gartic' | 'poker' | 'sudoku';

type RoomPlayer = { token: string; name: string; chips?: number; elo?: number; trainerId?: string; countryCode?: string; photoUrl?: string; isBotCreator?: boolean; bot?: boolean; joinedAt: number; lastSeenAt?: number };
type MatchTicket = { id: string; secret: string; game: 'chess' | 'sudoku'; status: 'waiting' | 'matched' | 'cancelled'; roomId: string; roomToken: string; name: string; elo: number; countryCode?: string; photoUrl?: string; difficulty: 'easy' | 'medium' | 'hard'; clockMinutes: number; createdAt: number; opponentName?: string; opponentElo?: number; opponentPhotoUrl?: string; opponentCountryCode?: string; opponentIsBotCreator?: boolean; isBotCreator?: boolean };
type Card = { id: string; color: string | null; value: string };
type PlayingCard = { rank: number; suit: string };
type Room = {
  id: string;
  game: InteractiveGameId;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: number;
  updatedAt: number;
  host: string;
  players: RoomPlayer[];
  capacity?: number;
  gameState: any;
};

export interface RoomStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
}

const ROOM_KEY = (id: string) => `interactive-room:${id}`;
const TICKET_KEY = (id: string) => `interactive-match:${id}`;
const QUEUE_KEY = (game: string) => `interactive-queue:${game}`;
const CHESS_HEARTBEAT_TIMEOUT_MS = 30_000;
const GAME_NAMES: Record<InteractiveGameId, string> = { chess: 'شطرنج', uno: 'أونو', gartic: 'ارسم وخمّن', poker: 'بوكر تكساس', sudoku: 'سودوكو' };
const DRAW_WORDS = ['نخلة','قمر','دراجة','مفتاح','سمكة','بيت','شمس','كتاب','تفاحة','قطة','سفينة','ساعة','مطر','طائرة','كرسي','باب','فنجان','جسر','حذاء','مظلة','فيل','وردة','قطار','خبز','نظارة','مصباح','كرة','شجرة','هاتف','ثلاجة','سلحفاة','نهر','جبل','منطاد','مرآة','حقيبة','مروحة','جزيرة','عصفور','ساعة رملية'];
const DRAW_COLORS = ['#202635','#ef4444','#f97316','#eab308','#84cc16','#10b981','#06b6d4','#3b82f6','#6366f1','#a855f7','#ec4899','#ffffff'];
const UNO_COLORS = ['أحمر','أصفر','أخضر','أزرق'];
const COLOR_KEYS: Record<string, string> = { 'أحمر':'red', 'أصفر':'yellow', 'أخضر':'green', 'أزرق':'blue' };
const SUITS = ['♠','♥','♦','♣'];
const RANK_LABELS: Record<number, string> = { 11:'J', 12:'Q', 13:'K', 14:'A' };

function randomString(length: number): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}
function cleanName(value: unknown): string {
  const name = String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 24);
  return name || 'لاعب';
}
function cleanCountryCode(value: unknown): string {
  const code = String(value || 'IQ').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : 'IQ';
}
function cleanPhotoUrl(value: unknown): string | undefined {
  try {
    const url = new URL(String(value || ''));
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || !(host === 't.me' || host === 'telegram.org' || host.endsWith('.telegram.org') || host === 'telegram-cdn.org' || host.endsWith('.telegram-cdn.org'))) return undefined;
    const normalized = url.toString();
    return normalized.length <= 512 ? normalized : undefined;
  } catch {
    return undefined;
  }
}
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
function nextIndex(index: number, count: number, direction = 1): number {
  return (index + direction + count) % count;
}
function cardCode(card: PlayingCard): string { return `${RANK_LABELS[card.rank] || card.rank}${card.suit}`; }
function shuffledDeck(): PlayingCard[] { return shuffle(SUITS.flatMap(suit => Array.from({ length: 13 }, (_, i) => ({ rank: i + 2, suit })))); }
function countSudokuSolutions(source: number[], limit: number): number {
  const grid = source.slice(), rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
  for (let i = 0; i < 81; i++) { const v = grid[i]; if (!v) continue; const r = Math.floor(i / 9), c = i % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3), bit = 1 << (v - 1); if ((rows[r] & bit) || (cols[c] & bit) || (boxes[b] & bit)) return 0; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit; }
  let total = 0;
  const visit = (): void => {
    if (total >= limit) return;
    let best = -1, maskBest = 0, lenBest = 10;
    for (let q = 0; q < 81; q++) { if (grid[q]) continue; const r = Math.floor(q / 9), c = q % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3), mask = 511 & ~(rows[r] | cols[c] | boxes[b]); let len = 0; for (let m = mask; m; m &= m - 1) len++; if (!len) return; if (len < lenBest) { best = q; maskBest = mask; lenBest = len; if (len === 1) break; } }
    if (best < 0) { total++; return; }
    const r = Math.floor(best / 9), c = best % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    for (let n = 1; n <= 9; n++) { const bit = 1 << (n - 1); if (!(maskBest & bit)) continue; grid[best] = n; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit; visit(); grid[best] = 0; rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit; if (total >= limit) return; }
  };
  visit(); return total;
}
function generateSudoku(level: 'easy' | 'medium' | 'hard'): { puzzle: number[]; solution: number[] } {
  const solution = Array(81).fill(0), rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
  const fill = (): boolean => {
    let best = -1, choices: number[] = [], bestLen = 10;
    for (let q = 0; q < 81; q++) { if (solution[q]) continue; const r = Math.floor(q / 9), c = q % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3), mask = 511 & ~(rows[r] | cols[c] | boxes[b]), options: number[] = []; for (let n = 1; n <= 9; n++) if (mask & (1 << (n - 1))) options.push(n); if (options.length < bestLen) { best = q; choices = options; bestLen = options.length; if (bestLen <= 1) break; } }
    if (best < 0) return true; if (!bestLen) return false; shuffle(choices); const r = Math.floor(best / 9), c = best % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    for (const n of choices) { const bit = 1 << (n - 1); solution[best] = n; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit; if (fill()) return true; solution[best] = 0; rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit; } return false;
  };
  fill(); const puzzle = solution.slice(), target = 81 - ({ easy: 39, medium: 33, hard: 28 }[level]);
  for (const pos of shuffle(Array.from({ length: 81 }, (_, i) => i))) { if (puzzle.filter(Boolean).length <= 81 - target) break; const value = puzzle[pos]; puzzle[pos] = 0; if (countSudokuSolutions(puzzle, 2) !== 1) puzzle[pos] = value; }
  return { puzzle, solution };
}

export class InteractiveGameRooms {
  private tail: Promise<void> = Promise.resolve();
  constructor(private readonly storage: RoomStorage) {}

  async handle(request: Request): Promise<Response> {
    const run = this.tail.then(() => this.handleSerial(request));
    this.tail = run.then(() => undefined, () => undefined);
    return run;
  }

  private async handleSerial(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/interactive/matchmaking')) return this.handleMatchmaking(request, url);
    const match = url.pathname.match(/^\/api\/interactive\/rooms(?:\/([A-Z0-9]+))?\/?$/i);
    if (!match) return Response.json({ error: 'المسار غير موجود' }, { status: 404 });
    if (request.method === 'POST' && !match[1]) {
      const body = await request.json().catch(() => null) as any;
      const game = String(body?.game || '') as InteractiveGameId;
      if (!Object.hasOwn(GAME_NAMES, game)) return Response.json({ error: 'اللعبة غير معروفة' }, { status: 400 });
      const elo = Math.max(100, Math.min(3000, Math.round(Number(body?.elo) || 200)));
      const defaultCapacity = game === 'chess' || game === 'sudoku' ? 2 : game === 'uno' ? 4 : game === 'gartic' ? 16 : 6;
      const capacity = Math.max(2, Math.min(defaultCapacity, Math.round(Number(body?.capacity) || defaultCapacity)));
      const startingChips = game === 'poker' ? [500, 1000, 2000].includes(Number(body?.startingChips)) ? Number(body.startingChips) : 1000 : 0;
      const roundDurationMs = game === 'gartic' ? Math.max(30, Math.min(120, Number(body?.roundSeconds) || 75)) * 1000 : 0;
      const player: RoomPlayer = { token: randomString(30), name: cleanName(body?.name), photoUrl: cleanPhotoUrl(body?.photoUrl), countryCode: cleanCountryCode(body?.countryCode), joinedAt: Date.now(), ...(body?.isBotCreator === true ? { isBotCreator: true } : {}), ...(game === 'chess' ? { elo } : {}), ...(game === 'poker' ? { chips: startingChips } : {}) };
      const botTrainer = game === 'chess' && body?.mode === 'bot' ? getChessTrainer(body?.trainerId, Number(body?.botElo) || 200) : undefined;
      const botElo = botTrainer?.elo || 0;
      const players = [player];
      if (botTrainer) players.push({ token: randomString(30), name: botTrainer.name, trainerId: botTrainer.id, elo: botElo, bot: true, joinedAt: Date.now() });
      const room: Room = {
        id: randomString(12), game, status: 'waiting', createdAt: Date.now(), updatedAt: Date.now(), host: player.token,
        players, capacity, gameState: this.initialState(game)
      };
      if (game === 'sudoku') { room.gameState.difficulty = this.cleanDifficulty(body?.difficulty); if (body?.mode === 'friend') room.gameState.mode = 'friend'; }
      if (game === 'chess') {
        const clockMinutes = Math.max(1, Math.min(30, Math.round(Number(body?.clockMinutes) || 5)));
        room.gameState.mode = body?.mode === 'bot' ? 'bot' : 'friend';
        room.gameState.clockMinutes = clockMinutes;
        room.gameState.clockInitialMs = clockMinutes * 60_000;
        room.gameState.clocks = { w: room.gameState.clockInitialMs, b: room.gameState.clockInitialMs };
      }
      if (game === 'poker') room.gameState.startingChips = startingChips;
      if (game === 'gartic') room.gameState.roundDurationMs = roundDurationMs;
      if (botTrainer) { room.gameState.botElo = botElo; room.gameState.botTrainerId = botTrainer.id; room.gameState.botStyle = botTrainer.style; room.gameState.mode = 'bot'; this.startGame(room); }
      await this.save(room);
      return this.jsonFor(room, player.token, 201);
    }

    const id = match[1]?.toUpperCase();
    if (!id) return Response.json({ error: 'معرّف الغرفة مطلوب' }, { status: 400 });
    const room = await this.load(id);
    if (!room || Date.now() - room.updatedAt > 24 * 60 * 60 * 1000) return Response.json({ error: 'الغرفة غير موجودة أو انتهت صلاحيتها' }, { status: 404 });

    if (request.method === 'GET') {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (token && !room.players.some(player => player.token === token)) return Response.json({ error: 'رمز اللاعب غير صالح' }, { status: 403 });
      const now = Date.now();
      let changed = false;
      if (token && room.game === 'chess' && room.status === 'playing') {
        const player = room.players.find(item => item.token === token);
        const opponent = room.players.find(item => item.token !== token && !item.bot);
        if (player) { player.lastSeenAt = now; changed = true; }
        if (player && opponent && opponent.lastSeenAt && now - opponent.lastSeenAt > CHESS_HEARTBEAT_TIMEOUT_MS) {
          room.gameState.clocks = this.chessClockValues(room);
          room.gameState.clockStartedAt = 0;
          room.gameState.matchIntroUntil = 0;
          room.status = 'finished';
          room.gameState.result = `${player.name} فاز لانقطاع خصمه`;
          room.gameState.winnerSeat = room.players.indexOf(player);
          this.updateChessElo(room, room.gameState.winnerSeat);
          changed = true;
        }
      }
      const started = this.startChessClockAfterIntro(room, now);
      if (changed || started || this.expireChessClock(room, now)) { room.updatedAt = now; await this.save(room); }
      return this.jsonFor(room, token);
    }
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });

    const body = await request.json().catch(() => null) as any;
    const action = String(body?.action || '');
    if (action === 'join') {
      const prior = typeof body.token === 'string' ? room.players.find(player => player.token === body.token) : undefined;
      if (prior) return this.jsonFor(room, prior.token);
      if (room.status !== 'waiting') return Response.json({ error: 'اللعبة بدأت، ما نكدر نضيف لاعبين هسه' }, { status: 409 });
      const max = room.capacity || (room.game === 'chess' || room.game === 'sudoku' ? 2 : room.game === 'uno' ? 4 : room.game === 'gartic' ? 16 : 6);
      if (room.players.length >= max) return Response.json({ error: 'الغرفة مكتملة' }, { status: 409 });
      const player: RoomPlayer = { token: randomString(30), name: cleanName(body.name), photoUrl: cleanPhotoUrl(body.photoUrl), countryCode: cleanCountryCode(body.countryCode), joinedAt: Date.now(), ...(body.isBotCreator === true ? { isBotCreator: true } : {}), ...(room.game === 'poker' ? { chips: Number(room.gameState.startingChips) || 1000 } : {}), ...(room.game === 'chess' ? { elo: Math.max(100, Math.min(3000, Math.round(Number(body.elo) || 200))) } : {}) };
      room.players.push(player);
      room.updatedAt = Date.now();
      if ((room.game === 'chess' || room.game === 'sudoku') && room.players.length >= 2) this.startGame(room);
      await this.save(room);
      return this.jsonFor(room, player.token);
    }

    const player = room.players.find(item => item.token === body?.token);
    if (!player) return Response.json({ error: 'انضم للغرفة أولاً' }, { status: 403 });
    this.startChessClockAfterIntro(room);
    if (this.expireChessClock(room)) { room.updatedAt = Date.now(); await this.save(room); return this.jsonFor(room, player.token); }
    const result = this.act(room, player, action, body || {});
    if (result) return Response.json({ error: result }, { status: 400 });
    room.updatedAt = Date.now();
    await this.save(room);
    return this.jsonFor(room, player.token);
  }

  private initialState(game: InteractiveGameId): any {
    switch (game) {
      case 'chess': return { fen: new Chess().fen(), turn: 'w', lastMove: '', result: '', clockMinutes: 5, clockInitialMs: 300_000, clocks: { w: 300_000, b: 300_000 }, clockStartedAt: 0, chat: [] };
      case 'uno': return { deck: [], discard: [], currentColor: '', turn: 0, direction: 1, hands: {}, drawn: {}, pendingUno: '', saidUno: {}, result: '' };
      case 'gartic': return { round: 0, drawer: 0, word: '', strokes: [], guesses: [], scores: {}, roundStartedAt: 0, deadline: 0, roundResult: '' };
      case 'poker': return { phase: 'waiting', deck: [], community: [], holes: {}, dealer: 0, turn: 0, pot: 0, currentBet: 0, bets: {}, pending: [], folded: [], lastAction: '', result: '', winners: [], revealed: false, hand: 0, startingChips: 1000 };
      case 'sudoku': return { difficulty: 'easy', puzzle: [], solution: [], boards: {}, startedAt: 0, winner: '', result: '' };
    }
  }

  private cleanDifficulty(value: unknown): 'easy' | 'medium' | 'hard' { return value === 'hard' || value === 'medium' ? value : 'easy'; }
  private startSudokuRace(room: Room): void {
    const s = room.gameState, generated = generateSudoku(this.cleanDifficulty(s.difficulty));
    s.puzzle = generated.puzzle; s.solution = generated.solution; s.startedAt = Date.now(); s.winner = ''; s.result = '';
    s.boards = Object.fromEntries(room.players.map(player => [player.token, { values: generated.puzzle.slice(), mistakes: 0, lastCorrect: null, finished: false, history: [] }]));
    room.status = 'playing';
  }
  private startGame(room: Room): void {
    if (room.status !== 'waiting' || room.players.length < 2) return;
    room.status = 'playing';
    if (room.game === 'chess') {
      const chess = new Chess();
      room.gameState.fen = chess.fen(); room.gameState.turn = 'w';
      room.gameState.clocks ||= { w: room.gameState.clockInitialMs || 300_000, b: room.gameState.clockInitialMs || 300_000 };
      const now = Date.now();
      for (const player of room.players) if (!player.bot) player.lastSeenAt = now;
      if (room.gameState.mode === 'friend') {
        room.gameState.matchIntroUntil = now + 2_800;
        room.gameState.clockStartedAt = 0;
      } else {
        room.gameState.matchIntroUntil = 0;
        room.gameState.clockStartedAt = Date.now();
      }
    }
    else if (room.game === 'uno') this.dealUno(room);
    else if (room.game === 'sudoku') this.startSudokuRace(room);
  }

  private act(room: Room, player: RoomPlayer, action: string, body: any): string | null {
    if (action === 'leave') {
      const index = room.players.findIndex(item => item.token === player.token);
      if (index < 0) return 'اللاعب مو موجود بالغرفة';
      if (room.game === 'chess') {
        if (room.status === 'playing') {
          room.gameState.clocks = this.chessClockValues(room);
          room.gameState.clockStartedAt = 0;
          room.gameState.matchIntroUntil = 0;
          room.status = 'finished';
          room.gameState.result = `${room.players[1 - index]?.name || 'الخصم'} فاز بالانسحاب`;
          room.gameState.winnerSeat = 1 - index;
          this.updateChessElo(room, 1 - index);
        } else if (room.status === 'waiting') {
          room.status = 'finished';
          room.gameState.result = `${player.name} غادر قبل بدء المباراة`;
          room.gameState.winnerSeat = -1;
        }
        return null;
      }
      if (room.status === 'playing' && room.game === 'poker') {
        const res = this.pokerAction(room, player, 'fold', 0);
        if (res) return res;
      }
      room.players.splice(index, 1);
      if (!room.players.length) room.status = 'finished';
      return null;
    }
    if (action === 'start') {
      if (room.status !== 'waiting') return 'اللعبة بدأت بالفعل';
      if (room.players.length < 2) return 'نحتاج لاعبين على الأقل';
      if (room.game === 'gartic') this.startDrawRound(room, 0);
      else if (room.game === 'poker') this.startPokerHand(room, false);
      else if (room.game === 'chess') this.startGame(room);
      else if (room.game === 'uno') this.startGame(room);
      return null;
    }
    if (room.status === 'finished') return 'انتهت اللعبة';
    if (room.game === 'chess') return this.chessAction(room, player, action, body);
    if (room.game === 'uno') return this.unoAction(room, player, action, body);
    if (room.game === 'gartic') return this.drawAction(room, player, action, body);
    if (room.game === 'poker') return this.pokerAction(room, player, action, Number(body.amount) || 0);
    if (room.game === 'sudoku') return this.sudokuAction(room, player, action, body);
    return 'إجراء غير مدعوم';
  }

  private chessClockValues(room: Room, now = Date.now()): { w: number; b: number } {
    const state = room.gameState;
    const initial = Math.max(60_000, Number(state.clockInitialMs) || 300_000);
    const clocks = { w: Math.max(0, Number(state.clocks?.w ?? initial)), b: Math.max(0, Number(state.clocks?.b ?? initial)) };
    if (room.status === 'playing' && state.clockStartedAt && (state.turn === 'w' || state.turn === 'b')) {
      const side: 'w' | 'b' = state.turn;
      clocks[side] = Math.max(0, clocks[side] - Math.max(0, now - Number(state.clockStartedAt)));
    }
    return clocks;
  }

  private startChessClockAfterIntro(room: Room, now = Date.now()): boolean {
    const state = room.gameState;
    if (room.game !== 'chess' || room.status !== 'playing' || state.clockStartedAt || !state.matchIntroUntil || now < Number(state.matchIntroUntil)) return false;
    state.clockStartedAt = now;
    state.matchIntroUntil = 0;
    room.updatedAt = now;
    return true;
  }

  private expireChessClock(room: Room, now = Date.now()): boolean {
    const state = room.gameState;
    if (room.game !== 'chess' || room.status !== 'playing' || !state.clockStartedAt || (state.turn !== 'w' && state.turn !== 'b')) return false;
    const side: 'w' | 'b' = state.turn;
    const clocks = this.chessClockValues(room, now);
    if (clocks[side] > 0) return false;
    state.clocks = clocks; state.clockStartedAt = 0; state.winnerSeat = side === 'w' ? 1 : 0;
    state.result = `انتهى وقت ${room.players[state.turn === 'w' ? 0 : 1]?.name || 'اللاعب'} — فاز الخصم بالوقت`;
    room.status = 'finished';
    this.updateChessElo(room, state.winnerSeat);
    return true;
  }

  private chessAction(room: Room, player: RoomPlayer, action: string, body: any): string | null {
    const state = room.gameState;
    const seat = room.players.findIndex(item => item.token === player.token);
    if (action === 'chat') {
      if (room.status === 'finished') return 'انتهت المباراة';
      const text = String(body.text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
      if (!text) return 'اكتب رسالة قبل الإرسال';
      const messages = Array.isArray(state.chat) ? state.chat : [];
      const last = messages.at(-1);
      if (last?.seat === seat && Date.now() - Number(last.at) < 350) return 'تمهّل شوي قبل الرسالة التالية';
      state.chat = [...messages, { id: randomString(8), seat, name: player.name, text, at: Date.now() }].slice(-80);
      return null;
    }
    if (room.status !== 'playing') return 'ننتظر انضمام اللاعب الثاني';
    if (state.matchIntroUntil && Date.now() < Number(state.matchIntroUntil)) return 'المباراة راح تبدي بعد لحظات';
    if (action === 'resign') {
      state.clocks = this.chessClockValues(room); state.clockStartedAt = 0;
      room.status = 'finished'; state.result = `${room.players[1 - seat].name} فاز بالانسحاب`; state.winnerSeat = 1 - seat; this.updateChessElo(room, state.winnerSeat);
      return null;
    }
    if (action === 'bot-fallback') {
      if (seat !== 0 || !room.players[1]?.bot || state.turn !== 'b') return 'مو دور البوت';
      this.makeBotMove(room);
      return null;
    }
    const botMove = action === 'bot-move';
    if (action !== 'move' && !botMove) return 'حركة غير معروفة';
    if (botMove) {
      if (seat !== 0 || !room.players[1]?.bot || state.turn !== 'b') return 'مو دور البوت';
    } else {
      const side = seat === 0 ? 'w' : 'b';
      if (state.turn !== side) return 'مو دورك هسه';
    }
    const movingSeat = botMove ? 1 : seat;
    const mover = room.players[movingSeat];
    try {
      const movedAt = Date.now();
      const clocks = this.chessClockValues(room, movedAt);
      const side = state.turn as 'w' | 'b';
      if (clocks[side] <= 0) { this.expireChessClock(room, movedAt); return null; }
      state.clocks = clocks;
      const chess = new Chess(state.fen);
      const move = chess.move({ from: String(body.from), to: String(body.to), promotion: body.promotion || 'q' });
      if (!move) return 'الحركة غير قانونية';
      state.fen = chess.fen(); state.turn = chess.turn(); state.lastMove = move.san; state.lastMoveSquares = [move.from, move.to]; state.clockStartedAt = movedAt;
      if (chess.isCheckmate()) { room.status = 'finished'; state.clockStartedAt = 0; state.winnerSeat = movingSeat; state.result = `${mover.name} فاز بالكش مات`; this.updateChessElo(room, movingSeat); }
      else if (chess.isDraw() || chess.isStalemate()) { room.status = 'finished'; state.clockStartedAt = 0; state.winnerSeat = -1; state.result = 'تعادل'; this.updateChessElo(room, -1); }
      return null;
    } catch { return 'الحركة غير قانونية'; }
  }

  private updateChessElo(room: Room, winnerSeat: number): void {
    const humans = room.players.filter(player => !player.bot);
    if (humans.length !== 2 || room.players.length !== 2 || room.gameState.eloUpdated) return;
    const scoreFor = (player: RoomPlayer) => winnerSeat < 0 ? 0.5 : room.players[winnerSeat]?.token === player.token ? 1 : 0;
    const ratingDelta = (score: number, expected: number) => {
      const raw = 24 * (score - expected);
      return raw === 0 ? 0 : Math.sign(raw) * Math.max(1, Math.round(Math.abs(raw)));
    };
    const [a, b] = humans;
    const ratingA = Number(a.elo) || 200, ratingB = Number(b.elo) || 200;
    const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const changeA = ratingDelta(scoreFor(a), expectedA);
    a.elo = Math.max(100, Math.min(3_000, ratingA + changeA));
    b.elo = Math.max(100, Math.min(3_000, ratingB - changeA));
    room.gameState.eloChanges = { [a.token]: a.elo - ratingA, [b.token]: b.elo - ratingB };
    room.gameState.eloUpdated = true;
  }

  private makeBotMove(room: Room): void {
    const state = room.gameState;
    const trainer = getChessTrainer(state.botTrainerId, Number(state.botElo) || 200);
    const chess = new Chess(state.fen);
    if (chess.turn() !== 'b') return;
    const chosen = chooseChessBotMove(chess.fen(), trainer.elo, trainer.style);
    if (!chosen) return;
    const movedAt = Date.now();
    state.clocks = this.chessClockValues(room, movedAt);
    if (state.clocks.b <= 0) { this.expireChessClock(room, movedAt); return; }
    const moved = chess.move({ from: chosen.from, to: chosen.to, promotion: chosen.promotion || 'q' });
    if (!moved) return;
    state.fen = chess.fen(); state.turn = chess.turn(); state.lastMove = moved.san; state.lastMoveSquares = [moved.from, moved.to]; state.clockStartedAt = movedAt;
    if (chess.isCheckmate()) { room.status = 'finished'; state.clockStartedAt = 0; state.winnerSeat = 1; state.result = `${room.players[1].name} فاز بالكش مات`; this.updateChessElo(room, state.winnerSeat); }
    else if (chess.isDraw() || chess.isStalemate()) { room.status = 'finished'; state.clockStartedAt = 0; state.winnerSeat = -1; state.result = 'تعادل'; this.updateChessElo(room, -1); }
  }

  private sudokuAction(room: Room, player: RoomPlayer, action: string, body: any): string | null {
    if (room.status !== 'playing') return 'المباراة ما بدت بعد';
    const s = room.gameState, board = s.boards[player.token];
    if (!board || board.finished) return 'انتهت محاولتك';
    if (action === 'place') {
      const index = Number(body.index), value = Number(body.value);
      if (!Number.isInteger(index) || index < 0 || index >= 81 || !Number.isInteger(value) || value < 1 || value > 9) return 'اختار خانة ورقم صحيح';
      if (s.puzzle[index]) return 'هذا الرقم ثابت باللغز';
      if (value !== s.solution[index]) { board.mistakes++; board.lastCorrect = false; return null; }
      board.history ||= []; board.history.push({ index, previous: board.values[index] || 0 }); if (board.history.length > 100) board.history.shift();
      board.values[index] = value; board.lastCorrect = true;
      if (board.values.every((v: number, i: number) => v === s.solution[i])) { board.finished = true; s.winner = player.token; s.result = `${player.name} حلّ السودوكو أولاً!`; s.finishedAt = Date.now(); room.status = 'finished'; }
      return null;
    }
    if (action === 'clear') { const index = Number(body.index); if (Number.isInteger(index) && index >= 0 && index < 81 && !s.puzzle[index]) { if (board.values[index]) { board.history ||= []; board.history.push({ index, previous: board.values[index] }); if (board.history.length > 100) board.history.shift(); } board.values[index] = 0; } board.lastCorrect = null; return null; }
    if (action === 'undo') { const previous = board.history?.pop(); if (previous && Number.isInteger(previous.index) && !s.puzzle[previous.index]) { board.values[previous.index] = previous.previous || 0; board.finished = false; s.winner = ''; s.result = ''; room.status = 'playing'; } board.lastCorrect = null; return null; }
    return 'إجراء غير معروف';
  }

  private dealUno(room: Room): void {
    const cards: Card[] = [];
    let id = 0;
    for (const color of UNO_COLORS) {
      cards.push({ id: String(id++), color, value: '0' });
      for (let n = 1; n <= 9; n++) for (let copy = 0; copy < 2; copy++) cards.push({ id: String(id++), color, value: String(n) });
      for (const value of ['تخطي','عكس','+2']) for (let copy = 0; copy < 2; copy++) cards.push({ id: String(id++), color, value });
    }
    for (let i = 0; i < 4; i++) { cards.push({ id: String(id++), color: null, value: 'تغيير' }); cards.push({ id: String(id++), color: null, value: '+4' }); }
    room.gameState.deck = shuffle(cards);
    room.gameState.hands = Object.fromEntries(room.players.map(player => [player.token, room.gameState.deck.splice(0, 7)]));
    let top = room.gameState.deck.pop();
    while (top && !top.color) { room.gameState.deck.unshift(top); top = room.gameState.deck.pop(); }
    room.gameState.discard = top ? [top] : [];
    room.gameState.currentColor = top?.color || UNO_COLORS[0];
    room.gameState.turn = 0; room.gameState.direction = 1; room.gameState.drawn = {}; room.gameState.pendingUno = ''; room.gameState.saidUno = {}; room.gameState.result = '';
    room.status = 'playing';
  }

  private unoAction(room: Room, player: RoomPlayer, action: string, body: any): string | null {
    const s = room.gameState;
    if (room.status !== 'playing') return 'ننتظر لاعباً آخر';
    const seat = room.players.findIndex(item => item.token === player.token);
    if (action === 'call-uno') { if ((s.hands[player.token] || []).length !== 1) return 'تستخدم «أونو» لما يبقى بيدك كارت واحد'; s.saidUno[player.token] = true; s.pendingUno = ''; return null; }
    if (seat !== s.turn) return 'مو دورك هسه';
    if (s.pendingUno && s.pendingUno !== player.token) {
      const offender = s.pendingUno; if (!s.saidUno[offender] && (s.hands[offender] || []).length === 1) { this.drawUno(room, offender, 2); }
      s.pendingUno = '';
    }
    if (action === 'draw') {
      const card = this.drawUno(room, player.token, 1)[0];
      if (card && (card.color === s.currentColor || card.value === s.discard.at(-1)?.value || !card.color)) s.drawn[player.token] = card.id;
      else this.advanceUno(room, 1);
      return null;
    }
    if (action === 'pass') { if (!s.drawn[player.token]) return 'اسحب كارت أولاً'; delete s.drawn[player.token]; this.advanceUno(room, 1); return null; }
    if (action !== 'play') return 'إجراء غير معروف';
    const hand: Card[] = s.hands[player.token] || [];
    const index = hand.findIndex(card => card.id === String(body.cardId));
    if (index < 0) return 'هذا الكارت مو بيدك';
    const card = hand[index];
    if (hand.length === 1 && s.pendingUno === player.token && !s.saidUno[player.token]) return 'نادِ أونو قبل لعب الكارت الأخير';
    const isDrawn = s.drawn[player.token] === card.id;
    if (s.drawn[player.token] && !isDrawn) return 'لازم تلعب الكارت المسحوب أو تمرر';
    if (!card.color && !UNO_COLORS.includes(body.color)) return 'اختار لون بعد الكارت الجامح';
    const top: Card | undefined = s.discard.at(-1);
    if (card.color && card.color !== s.currentColor && card.value !== top?.value) return 'الكارت لازم يطابق اللون أو الرمز';
    hand.splice(index, 1); s.discard.push({ ...card }); delete s.drawn[player.token];
    s.currentColor = card.color || body.color;
    if (hand.length === 1) { s.saidUno[player.token] = Boolean(body.sayUno); s.pendingUno = s.saidUno[player.token] ? '' : player.token; }
    else { s.pendingUno = ''; s.saidUno[player.token] = false; }
    if (!hand.length) { room.status = 'finished'; s.winnerSeat = room.players.findIndex(item => item.token === player.token); s.result = `${player.name} فاز بأونو!`; return null; }
    let skip = 1;
    if (card.value === 'تخطي') skip = 2;
    if (card.value === 'عكس') { s.direction *= -1; if (room.players.length === 2) skip = 2; }
    if (card.value === '+2' || card.value === '+4') { const victim = room.players[nextIndex(seat, room.players.length, s.direction)]; this.drawUno(room, victim.token, card.value === '+2' ? 2 : 4); skip = 2; }
    this.advanceUno(room, skip);
    return null;
  }

  private drawUno(room: Room, token: string, count: number): Card[] {
    const s = room.gameState;
    const drawn: Card[] = [];
    for (let i = 0; i < count; i++) {
      if (!s.deck.length && s.discard.length > 1) {
        const top = s.discard.pop(); s.deck = shuffle(s.discard.splice(0)); if (top) s.discard.push(top);
      }
      const card = s.deck.pop(); if (card) { s.hands[token].push(card); drawn.push(card); }
    }
    return drawn;
  }
  private advanceUno(room: Room, steps: number): void { room.gameState.turn = nextIndex(room.gameState.turn, room.players.length, room.gameState.direction * steps); }

  private startDrawRound(room: Room, index: number): void {
    const s = room.gameState; s.round = index + 1; s.drawer = index % room.players.length; s.word = DRAW_WORDS[Math.floor(Math.random() * DRAW_WORDS.length)]; s.strokes = []; s.guesses = []; s.roundStartedAt = Date.now(); s.deadline = Date.now() + (Number(s.roundDurationMs) || 75_000); s.roundResult = ''; room.status = 'playing';
  }
  private drawAction(room: Room, player: RoomPlayer, action: string, body: any): string | null {
    const s = room.gameState; const seat = room.players.findIndex(item => item.token === player.token);
    if (action === 'start-round') { if (!s.round) this.startDrawRound(room, 0); else if (s.roundResult || Date.now() > s.deadline) { if (s.round >= room.players.length) { room.status = 'finished'; s.roundResult = 'انتهت الجولات — شوفوا ترتيب النقاط'; } else this.startDrawRound(room, s.round); } else return 'الجولة الحالية بعدها شغالة'; return null; }
    if (room.status !== 'playing') return 'ابدأوا الجولة أولاً';
    if (action === 'stroke') {
      if (seat !== s.drawer) return 'الرسم للرسام وحده'; if (Date.now() > s.deadline || s.roundResult) return 'انتهى وقت الرسم';
      const points = Array.isArray(body.points) ? body.points.slice(0, 90).map((p: any) => [Math.max(0,Math.min(1,Number(p?.[0])||0)),Math.max(0,Math.min(1,Number(p?.[1])||0))]) : [];
      if (points.length < 2) return 'الخط يحتاج نقطتين'; if (s.strokes.length >= 100) s.strokes.shift();
      s.strokes.push({ points, color: DRAW_COLORS.includes(body.color) ? body.color : '#202635', size: Math.max(2,Math.min(20,Number(body.size)||5)) }); return null;
    }
    if (action === 'undo-stroke') { if (seat !== s.drawer) return 'الرسام وحده يرجّع آخر خط'; if (s.roundResult || Date.now() > s.deadline) return 'انتهى وقت الرسم'; s.strokes.pop(); return null; }
    if (action === 'clear') { if (seat !== s.drawer) return 'الرسام وحده يمسح اللوحة'; if (s.roundResult || Date.now() > s.deadline) return 'انتهى وقت الرسم'; s.strokes = []; return null; }
    if (action === 'guess') {
      if (seat === s.drawer) return 'الرسام ما يخمّن'; if (s.roundResult || Date.now() > s.deadline) return 'انتهت الجولة';
      const guess = String(body.text || '').trim().slice(0, 60); if (!guess) return 'اكتب تخمينك';
      const normalized = (x: string) => x.replace(/[\u064b-\u065f\u0670\u0640\s]/g, '').toLowerCase();
      const correct = normalized(guess) === normalized(s.word);
      s.guesses.push({ name: player.name, text: guess, correct, at: Date.now() }); if (s.guesses.length > 30) s.guesses.shift();
      if (correct) { s.scores[player.token] = (s.scores[player.token] || 0) + Math.max(10, Math.round(100 * (1 - (Date.now() - s.roundStartedAt) / 100_000))); const artist = room.players[s.drawer]; s.scores[artist.token] = (s.scores[artist.token] || 0) + 25; s.roundResult = `${player.name} خمّنها صح: ${s.word}`; }
      return null;
    }
    return 'إجراء غير معروف';
  }

  private startPokerHand(room: Room, next = true): void {
    const s = room.gameState; const players = room.players;
    s.hand = (s.hand || 0) + 1; s.deck = shuffledDeck(); s.community = []; s.holes = {}; s.folded = []; s.result = ''; s.winners = []; s.revealed = false; s.phase = 'preflop'; s.pot = 0; s.currentBet = 20; s.bets = {};
    if (next) s.dealer = (s.dealer + 1) % players.length; else s.dealer = Math.floor(Math.random() * players.length);
    for (const p of players) { if (typeof p.chips !== 'number') p.chips = 1000; s.holes[p.token] = [s.deck.pop(), s.deck.pop()]; s.bets[p.token] = 0; }
    const sb = players.length === 2 ? s.dealer : nextIndex(s.dealer, players.length); const bb = nextIndex(sb, players.length);
    for (const [seat, blind] of [[sb,10],[bb,20]] as number[][]) { const p = players[seat]; const paid = Math.min(p.chips || 0, blind); p.chips = (p.chips || 0) - paid; s.bets[p.token] = paid; s.pot += paid; }
    s.turn = nextIndex(bb, players.length);
    s.pending = this.clockwiseTokens(room, s.turn, p => (p.chips || 0) > 0);
    s.lastAction = `${players[sb].name} دفع الرهان الصغير و${players[bb].name} الرهان الكبير`;
    room.status = 'playing';
  }
  private pokerAction(room: Room, player: RoomPlayer, action: string, amount: number): string | null {
    const s = room.gameState; const players = room.players; const token = player.token;
    if (action === 'next-hand') { if (s.phase !== 'showdown') return 'اليد الحالية بعدها شغالة'; if (players.filter(p => (p.chips || 0) >= 30).length < 2) { room.status = 'finished'; s.result = 'انتهت الطاولة — ما بقت رقائق كافية ليد جديدة. اللعبة ودّية وما بيها أموال حقيقية.'; return null; } this.startPokerHand(room, true); return null; }
    if (s.phase === 'showdown' || s.phase === 'waiting') return 'اليد مو شغالة';
    if (s.pending[0] !== token) return 'مو دورك هسه';
    const idx = players.findIndex(p => p.token === token); const paid = s.bets[token] || 0; const owed = s.currentBet - paid;
    if (action === 'fold') { s.folded.push(token); s.pending.shift(); s.lastAction = `${player.name} انسحب`; }
    else if (action === 'check') { if (owed !== 0) return 'عندك رهان لازم تساويه أو تنسحب'; s.pending.shift(); s.lastAction = `${player.name} مرّر`; }
    else if (action === 'call') { if (owed <= 0) return 'ماكو رهان حتى تساويه'; if ((player.chips || 0) <= owed) return 'ما تگدر تساوي الرهان بهالرقائق؛ انسحب أو انتظر يد جديدة'; player.chips = (player.chips || 0) - owed; s.bets[token] = paid + owed; s.pot += owed; s.pending.shift(); s.lastAction = `${player.name} ساوى الرهان`; }
    else if (action === 'raise') { const target = Number(amount); if (!Number.isFinite(target) || target <= s.currentBet || target >= (player.chips || 0) + paid) return 'قيمة الزيادة مو صالحة'; const contribution = target - paid; player.chips = (player.chips || 0) - contribution; s.pot += contribution; s.bets[token] = target; s.currentBet = target; s.pending = this.clockwiseTokens(room, nextIndex(idx, players.length), p => !s.folded.includes(p.token) && p.token !== token && (p.chips || 0) > 0); s.lastAction = `${player.name} رفع الرهان إلى ${target}`; }
    else return 'إجراء غير معروف';
    const active = players.filter(p => !s.folded.includes(p.token));
    if (active.length === 1) {
      const rankedBets = players.map(p => ({ player:p, amount:s.bets[p.token]||0 })).sort((a,b)=>b.amount-a.amount);
      const unmatched = Math.max(0,(rankedBets[0]?.amount||0)-(rankedBets[1]?.amount||0));
      if (unmatched && rankedBets[0]) { rankedBets[0].player.chips=(rankedBets[0].player.chips||0)+unmatched; s.pot-=unmatched; }
      active[0].chips = (active[0].chips || 0) + s.pot; s.result = `${active[0].name} أخذ الرهان بعد انسحاب البقية`; s.winners = [active[0].token]; s.phase = 'showdown'; s.revealed = true; s.pending = []; return null;
    }
    if (!s.pending.length) this.advancePokerStreet(room);
    else this.advancePokerTurn(room);
    return null;
  }
  private clockwiseTokens(room: Room, start: number, include: (player: RoomPlayer) => boolean): string[] {
    const ordered: string[] = [];
    for (let offset = 0; offset < room.players.length; offset++) {
      const player = room.players[(start + offset) % room.players.length];
      if (player && include(player)) ordered.push(player.token);
    }
    return ordered;
  }

  private advancePokerTurn(room: Room): void {
    const s = room.gameState; if (!s.pending.length) return;
    const current = room.players.findIndex(p => p.token === s.pending[0]);
    s.turn = current;
  }
  private advancePokerStreet(room: Room): void {
    const s = room.gameState; const players = room.players.filter(p => !s.folded.includes(p.token) && (p.chips || 0) > 0);
    if (s.phase === 'preflop') { s.community.push(s.deck.pop(), s.deck.pop(), s.deck.pop()); s.phase = 'flop'; }
    else if (s.phase === 'flop') { s.community.push(s.deck.pop()); s.phase = 'turn'; }
    else if (s.phase === 'turn') { s.community.push(s.deck.pop()); s.phase = 'river'; }
    else { this.showdown(room); return; }
    s.currentBet = 0; s.bets = Object.fromEntries(room.players.map(p => [p.token, 0])); s.turn = nextIndex(s.dealer, room.players.length); s.pending = this.clockwiseTokens(room, s.turn, p => !s.folded.includes(p.token) && (p.chips || 0) > 0);
    this.advancePokerTurn(room);
  }
  private showdown(room: Room): void {
    const s = room.gameState; const active = room.players.filter(p => !s.folded.includes(p.token));
    const ranks = active.map(player => ({ player, rank: this.bestPokerRank([...(s.holes[player.token] || []), ...s.community]) }));
    ranks.sort((a,b) => this.compareRank(b.rank,a.rank)); const best = ranks[0]?.rank;
    const winners = ranks.filter(item => this.compareRank(item.rank,best) === 0).map(item => item.player);
    const share = Math.floor(s.pot / Math.max(1,winners.length)); winners.forEach(p => p.chips = (p.chips || 0) + share);
    if (s.pot % winners.length) winners[0].chips = (winners[0].chips || 0) + s.pot % winners.length;
    s.winners = winners.map(p => p.token); s.result = `${winners.map(p => p.name).join('، ')} فاز${winners.length > 1 ? 'وا' : ''} بـ ${this.rankName(best[0])}`; s.phase = 'showdown'; s.revealed = true; s.pending = [];
  }
  private bestPokerRank(cards: PlayingCard[]): number[] {
    const combos: PlayingCard[][] = [];
    const choose = (start: number, selected: PlayingCard[]) => { if (selected.length === 5) { combos.push(selected); return; } for (let i = start; i <= cards.length - (5-selected.length); i++) choose(i+1,[...selected,cards[i]]); };
    choose(0,[]);
    return combos.map(hand => this.rankFive(hand)).sort((a,b) => this.compareRank(b,a))[0] || [0,0];
  }
  private rankFive(cards: PlayingCard[]): number[] {
    const sorted = cards.map(c=>c.rank).sort((a,b)=>b-a); const counts = new Map<number,number>(); sorted.forEach(r=>counts.set(r,(counts.get(r)||0)+1));
    const groups = Array.from(counts,([rank,count])=>({rank,count})).sort((a,b)=>b.count-a.count||b.rank-a.rank);
    const flush = cards.every(c=>c.suit===cards[0].suit); const unique = [...new Set(sorted)];
    let straightHigh = 0; if (unique.length===5 && unique[0]-unique[4]===4) straightHigh=unique[0]; else if (unique.join(',')==='14,5,4,3,2') straightHigh=5;
    if (flush&&straightHigh) return [8,straightHigh]; if(groups[0].count===4)return [7,groups[0].rank,groups[1].rank]; if(groups[0].count===3&&groups[1].count===2)return [6,groups[0].rank,groups[1].rank];
    if(flush)return [5,...sorted]; if(straightHigh)return [4,straightHigh]; if(groups[0].count===3)return [3,groups[0].rank,...groups.slice(1).map(g=>g.rank).sort((a,b)=>b-a)];
    if(groups[0].count===2&&groups[1].count===2)return [2,Math.max(groups[0].rank,groups[1].rank),Math.min(groups[0].rank,groups[1].rank),groups[2].rank];
    if(groups[0].count===2)return [1,groups[0].rank,...groups.slice(1).map(g=>g.rank).sort((a,b)=>b-a)]; return [0,...sorted];
  }
  private compareRank(a: number[], b: number[]): number { for(let i=0;i<Math.max(a.length,b.length);i++){const diff=(a[i]||0)-(b[i]||0);if(diff)return diff;}return 0; }
  private rankName(category: number): string { return ['كارت عالي','زوج','زوجين','ثلاثة متشابهة','ستريت','فلاش','فول هاوس','أربع متشابهة','ستريت فلاش'][category] || 'يد قوية'; }

  private async handleMatchmaking(request: Request, url: URL): Promise<Response> {
    const match = url.pathname.match(/^\/api\/interactive\/matchmaking(?:\/([A-Z0-9]+))?\/?$/i);
    if (!match) return Response.json({ error: 'المسار غير موجود' }, { status: 404 });
    const id = match[1]?.toUpperCase();
    if (request.method === 'POST' && !id) {
      const body = await request.json().catch(() => null) as any;
      const game = body?.game === 'sudoku' ? 'sudoku' : body?.game === 'chess' ? 'chess' : null;
      if (!game) return Response.json({ error: 'اللعبة غير مدعومة للمطابقة' }, { status: 400 });
      const elo = Math.max(100, Math.min(3000, Math.round(Number(body?.elo) || 200)));
      const difficulty = this.cleanDifficulty(body?.difficulty);
      const clockMinutes = game === 'chess' ? Math.max(1, Math.min(30, Math.round(Number(body?.clockMinutes) || 5))) : 5;
      const playerToken = randomString(30), ticket: MatchTicket = {
        id: randomString(12), secret: randomString(30), game, status: 'waiting', roomId: randomString(12), roomToken: playerToken,
        name: cleanName(body?.name), elo, countryCode: cleanCountryCode(body?.countryCode), photoUrl: cleanPhotoUrl(body?.photoUrl), difficulty, clockMinutes, createdAt: Date.now(), isBotCreator: body?.isBotCreator === true
      };
      const player: RoomPlayer = { token: playerToken, name: ticket.name, photoUrl: ticket.photoUrl, joinedAt: Date.now(), ...(ticket.isBotCreator ? { isBotCreator: true } : {}), ...(game === 'chess' ? { elo, countryCode: ticket.countryCode || 'IQ' } : {}), ...(game === 'sudoku' ? { countryCode: ticket.countryCode } : {}) };
      const room: Room = { id: ticket.roomId, game, status: 'waiting', createdAt: Date.now(), updatedAt: Date.now(), host: playerToken, players: [player], capacity: 2, gameState: this.initialState(game) };
      if (game === 'sudoku') { room.gameState.difficulty = 'easy'; room.gameState.mode = 'random'; } else {
        room.gameState.mode = 'random'; room.gameState.clockMinutes = clockMinutes; room.gameState.clockInitialMs = clockMinutes * 60_000;
        room.gameState.clocks = { w: room.gameState.clockInitialMs, b: room.gameState.clockInitialMs };
      }
      const queue = (await this.storage.get<string[]>(QUEUE_KEY(game))) || [];
      const fresh: string[] = [];
      let opponent: MatchTicket | undefined;
      for (const ticketId of queue) {
        const waiting = await this.storage.get<MatchTicket>(TICKET_KEY(ticketId));
        if (!waiting || waiting.status !== 'waiting' || Date.now() - waiting.createdAt > 120_000) continue;
        fresh.push(ticketId);
        if (!opponent && waiting.id !== ticket.id && (game === 'chess' ? Math.abs(waiting.elo - elo) <= 350 && waiting.clockMinutes === clockMinutes : true)) opponent = waiting;
      }
      if (opponent) {
        const opponentRoom = await this.load(opponent.roomId);
        if (opponentRoom?.status === 'waiting' && opponentRoom.players.length === 1) {
          const rival: RoomPlayer = { token: ticket.roomToken, name: ticket.name, photoUrl: ticket.photoUrl, joinedAt: Date.now(), ...(ticket.isBotCreator ? { isBotCreator: true } : {}), ...(game === 'chess' ? { elo, countryCode: ticket.countryCode || 'IQ' } : {}), ...(game === 'sudoku' ? { countryCode: ticket.countryCode || 'IQ' } : {}) };
          opponentRoom.players.push(rival); opponentRoom.updatedAt = Date.now();
          this.startGame(opponentRoom); await this.save(opponentRoom);
          opponent.status = 'matched'; opponent.opponentName = ticket.name; opponent.opponentElo = elo; opponent.opponentPhotoUrl = ticket.photoUrl; opponent.opponentCountryCode = ticket.countryCode || 'IQ'; opponent.opponentIsBotCreator = ticket.isBotCreator === true;
          ticket.status = 'matched'; ticket.roomId = opponentRoom.id; ticket.opponentName = opponent.name; ticket.opponentElo = opponent.elo; ticket.opponentPhotoUrl = opponent.photoUrl; ticket.opponentCountryCode = opponent.countryCode || 'IQ'; ticket.opponentIsBotCreator = opponent.isBotCreator === true;
          await this.storage.put(TICKET_KEY(opponent.id), opponent);
          await this.storage.put(TICKET_KEY(ticket.id), ticket);
          await this.storage.put(QUEUE_KEY(game), fresh.filter(q => q !== opponent!.id));
          return this.ticketJson(ticket, 201);
        }
      }
      await this.save(room); await this.storage.put(TICKET_KEY(ticket.id), ticket);
      fresh.push(ticket.id); await this.storage.put(QUEUE_KEY(game), fresh);
      return this.ticketJson(ticket, 201);
    }
    if (!id) return Response.json({ error: 'معرّف المطابقة مطلوب' }, { status: 400 });
    const ticket = await this.storage.get<MatchTicket>(TICKET_KEY(id));
    if (!ticket) return Response.json({ error: 'طلب المطابقة غير موجود' }, { status: 404 });
    const secret = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!secret || secret !== ticket.secret) return Response.json({ error: 'رمز المطابقة غير صالح' }, { status: 403 });
    if (request.method === 'GET') return this.ticketJson(ticket);
    if (request.method === 'POST') {
      const body = await request.json().catch(() => null) as any;
      if (body?.action === 'cancel' && ticket.status === 'waiting') {
        ticket.status = 'cancelled'; await this.storage.put(TICKET_KEY(id), ticket);
        const queue = (await this.storage.get<string[]>(QUEUE_KEY(ticket.game))) || [];
        await this.storage.put(QUEUE_KEY(ticket.game), queue.filter(q => q !== id));
        const room = await this.load(ticket.roomId); if (room) { room.status = 'finished'; room.updatedAt = Date.now(); await this.save(room); }
      }
      return this.ticketJson(ticket);
    }
    return new Response('method not allowed', { status: 405 });
  }

  private ticketJson(ticket: MatchTicket, status = 200): Response {
    return Response.json({ ticket: { id: ticket.id, game: ticket.game, status: ticket.status, roomId: ticket.roomId, roomToken: ticket.status === 'matched' ? ticket.roomToken : '', name: ticket.name, elo: ticket.elo, countryCode: ticket.countryCode || 'IQ', photoUrl: ticket.photoUrl || '', difficulty: ticket.difficulty, opponentName: ticket.opponentName || '', opponentElo: ticket.opponentElo || 0, opponentPhotoUrl: ticket.opponentPhotoUrl || '', opponentCountryCode: ticket.opponentCountryCode || 'IQ', opponentIsBotCreator: Boolean(ticket.opponentIsBotCreator), createdAt: ticket.createdAt }, secret: status === 201 ? ticket.secret : undefined }, { status, headers: { 'Cache-Control': 'no-store' } });
  }

  private async load(id: string): Promise<Room | undefined> { return await this.storage.get<Room>(ROOM_KEY(id)); }
  private async save(room: Room): Promise<void> { await this.storage.put(ROOM_KEY(room.id), room); }
  private jsonFor(room: Room, token: string, status = 200): Response {
    const own = room.players.find(player => player.token === token); const seat = room.players.findIndex(player => player.token === token); const s = room.gameState;
    const state: any = { ...s };
    delete state.deck; delete state.word; delete state.hands; delete state.holes;
    delete state.host; delete state.drawn; delete state.saidUno; delete state.pendingUno; delete state.pending; delete state.turnToken;
    delete state.bets; delete state.folded; delete state.solution; delete state.boards; delete state.eloChanges; delete state.eloUpdated;
    if (room.game === 'chess') {
      state.turnName = room.players[s.turn === 'w' ? 0 : 1]?.name || '';
      state.seat = seat; state.side = seat === 0 ? 'w' : seat === 1 ? 'b' : '';
      state.clocks = this.chessClockValues(room); state.clockMinutes = Number(s.clockMinutes) || 5; state.clockRunning = room.status === 'playing' && Boolean(s.clockStartedAt);
      state.chat = own ? (Array.isArray(s.chat) ? s.chat.slice(-80) : []) : [];
      delete state.clockInitialMs; delete state.clockStartedAt;
      state.legalMoves = own && s.turn === state.side ? (new Chess(s.fen).moves({ verbose: true }) as any[]).map(move => ({ from: move.from, to: move.to })) : [];
      state.lastMoveSquares = s.lastMoveSquares || [];
      state.botElo = Number(s.botElo) || 0;
      state.botTrainerId = String(s.botTrainerId || '');
    } else if (room.game === 'sudoku') {
      const ownBoard = s.boards?.[token]; state.values = ownBoard?.values || []; state.mistakes = ownBoard?.mistakes || 0; state.lastCorrect = ownBoard?.lastCorrect ?? null; state.canUndo = Boolean(ownBoard?.history?.length); state.winner = s.winner === token;
      state.opponentProgress = room.players.filter(p => p.token !== token).map(p => ({ name: p.name, countryCode: p.countryCode || 'IQ', progress: (s.boards?.[p.token]?.values || []).filter((v: number, i: number) => !s.puzzle[i] && v === s.solution[i]).length, bot: p.bot || false }));
    } else if (room.game === 'uno') {
      state.hand = own ? s.hands[token] || [] : [];
      state.handsCount = room.players.map((player,i) => ({ seat:i, name:player.name, count:(s.hands[player.token]||[]).length, isTurn:i===s.turn }));
      state.turnSeat = s.turn;
      state.top = s.discard.at(-1) || null; state.discard = undefined; state.drawnCardId = own ? s.drawn[token] || '' : '';
      state.pendingUnoSeat = room.players.findIndex(p => p.token === s.pendingUno); state.saidUno = own ? Boolean(s.saidUno[token]) : false;
      state.players = room.players.map((p,i)=>({name:p.name,seat:i,isTurn:i===s.turn,score:(s.hands[p.token]||[]).length}));
    } else if (room.game === 'gartic') {
      state.word = seat === s.drawer ? s.word : '';
      state.drawerName = room.players[s.drawer]?.name || '';
      state.isDrawer = seat === s.drawer;
      state.scores = room.players.map(p=>({name:p.name,score:s.scores[p.token]||0}));
      state.guesses = s.guesses.map((g:any)=>({name:g.name,text:g.correct?'✅ خمّنها صح':g.text,correct:g.correct}));
      state.roundLeft = Math.max(0,Math.ceil((s.deadline-Date.now())/1000));
    } else if (room.game === 'poker') {
      state.hand = s.revealed ? s.holes[token] || [] : own ? s.holes[token] || [] : [];
      state.hands = room.players.map(p=>({name:p.name,chips:p.chips||0,folded:s.folded.includes(p.token),cards:s.revealed?s.holes[p.token]||[]:p.token===token?s.holes[p.token]||[]:[]}));
      state.turnSeat = room.players.findIndex(p => p.token === s.pending[0]);
      state.foldedSeats = room.players.map((p,i)=>s.folded.includes(p.token)?i:-1).filter(i=>i>=0);
      state.winners = (s.winners || []).map((token:string)=>room.players.findIndex(p=>p.token===token)).filter((i:number)=>i>=0);
      state.betAmounts = room.players.map(p=>s.bets[p.token]||0);
    }
    return Response.json({ room: { id:room.id,game:room.game,gameName:GAME_NAMES[room.game],status:room.status,isHost:token===room.host,playerSeat:seat,players:room.players.map((p,i)=>({name:p.name,seat:i,host:p.token===room.host,chips:p.chips,elo:p.elo,countryCode:p.countryCode||'IQ',photoUrl:p.photoUrl||'',trainerId:p.trainerId||'',eloChange:room.gameState.eloChanges?.[p.token] ?? 0,isBotCreator:Boolean(p.isBotCreator),bot:Boolean(p.bot)})),capacity:room.capacity || room.players.length,createdAt:room.createdAt }, token:own?.token || '', state }, { status, headers: { 'Cache-Control':'no-store' } });
  }
}

export class MemoryRoomStorage implements RoomStorage {
  private rooms = new Map<string, unknown>();
  async get<T = unknown>(key: string): Promise<T | undefined> { return this.rooms.get(key) as T | undefined; }
  async put(key: string, value: unknown): Promise<void> { this.rooms.set(key, value); }
}
