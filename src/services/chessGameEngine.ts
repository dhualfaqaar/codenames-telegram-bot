import { Chess, type Square, type Move } from 'chess.js';

export interface ChessPlayer {
  id: string;
  name: string;
  color: 'w' | 'b';
  isBot?: boolean;
}
export interface ChessGame {
  chatId: string;
  chatTitle: string;
  messageId?: number;
  inlineMessageId?: string;
  status: 'lobby' | 'playing' | 'finished';
  players: ChessPlayer[];
  fen: string;
  moves: { from: string; to: string; promotion?: string }[];
  selectedFrom?: string;
  winnerId?: string;
  finishReason?: 'checkmate' | 'draw' | 'resignation';
  lastMoveSan?: string;
  botOpponent?: boolean;
  /** Chosen approximate rating for bot-opponent matches. */
  botElo?: number;
}

export const CHESS_BOT_ELO_LEVELS = [
  { elo: 250, label: 'مبتدئ جداً' },
  { elo: 400, label: 'مبتدئ' },
  { elo: 600, label: 'سهل جداً' },
  { elo: 800, label: 'سهل' },
  { elo: 1000, label: 'متوسط' },
  { elo: 1200, label: 'متوسط+' },
  { elo: 1400, label: 'جيد' },
  { elo: 1600, label: 'متقدم' },
  { elo: 1800, label: 'قوي' },
  { elo: 2000, label: 'خبير' },
  { elo: 2200, label: 'خبير+' },
  { elo: 2400, label: 'محترف' },
  { elo: 2600, label: 'ماستر' },
  { elo: 2800, label: 'أستاذ' },
  { elo: 3000, label: 'عالمي' },
  { elo: 3200, label: 'نخبوي' }
] as const;
export const DEFAULT_CHESS_BOT_ELO = 1200;

export function normalizeChessBotElo(elo?: number): number {
  return CHESS_BOT_ELO_LEVELS.some(level => level.elo === elo)
    ? Number(elo)
    : DEFAULT_CHESS_BOT_ELO;
}

const INITIAL_FEN = new Chess().fen();
export function createChessLobby(chatId: string, chatTitle: string): ChessGame {
  return { chatId, chatTitle, status: 'lobby', players: [], fen: INITIAL_FEN, moves: [] };
}

export function createChessBotGame(chatId: string, playerId: string, playerName: string, requestedElo = DEFAULT_CHESS_BOT_ELO): ChessGame {
  const botElo = normalizeChessBotElo(requestedElo);
  return {
    chatId,
    chatTitle: 'مباراة خاصة ضد البوت',
    status: 'playing',
    players: [
      { id: playerId, name: playerName || 'لاعب', color: 'w' },
      { id: 'chess_bot', name: `البوت Elo ${botElo} 🤖`, color: 'b', isBot: true }
    ],
    fen: INITIAL_FEN,
    moves: [],
    botOpponent: true,
    botElo
  };
}

export function chessJoin(game: ChessGame, id: string, name: string): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: 'بدأت المباراة بالفعل.' };
  if (game.players.some(p => p.id === id)) return { ok: false, msg: 'أنت منضم بالفعل.' };
  if (game.players.length >= 2) return { ok: false, msg: 'المباراة مكتملة؛ لاعبان فقط.' };
  game.players.push({ id, name: name || 'لاعب', color: game.players.length === 0 ? 'w' : 'b' });
  return { ok: true, msg: 'انضممت لمباراة الشطرنج.' };
}

export function chessStart(game: ChessGame): { ok: boolean; msg: string } {
  if (game.status !== 'lobby') return { ok: false, msg: 'المباراة بدأت بالفعل.' };
  if (game.players.length !== 2) return { ok: false, msg: 'لازم ينضم لاعبان اثنان قبل البداية.' };
  game.status = 'playing';
  return { ok: true, msg: 'بدأت مباراة الشطرنج! الأبيض يبدأ.' };
}

function loadPosition(game: ChessGame): Chess {
  const chess = new Chess();
  for (const move of game.moves) chess.move(move);
  return chess;
}

export function chessCurrentPlayer(game: ChessGame): ChessPlayer | undefined {
  const turn = loadPosition(game).turn();
  return game.players.find(p => p.color === turn);
}

export function chessSelect(game: ChessGame, playerId: string, square: string): { ok: boolean; msg: string; moved?: boolean } {
  if (game.status !== 'playing') return { ok: false, msg: 'المباراة ليست جارية.' };
  const player = game.players.find(p => p.id === playerId);
  if (!player) return { ok: false, msg: 'هذه المباراة للاعبين المسجلين فقط.' };
  const chess = loadPosition(game);
  if (chess.turn() !== player.color) return { ok: false, msg: 'مو دورك هسه.' };
  if (!/^[a-h][1-8]$/.test(square)) return { ok: false, msg: 'المربع غير صالح.' };

  let from = game.selectedFrom;
  if (from) {
    const selectedPiece = chess.get(from as Square);
    const legal = selectedPiece?.color === player.color
      ? chess.moves({ square: from as Square, verbose: true }) as Move[]
      : [];
    // أصلح أي تحديد قديم/غير صالح، ولا نتركه يسبب رسالة مربكة عند الضغط التالي.
    if (!selectedPiece || selectedPiece.color !== player.color || !legal.length) {
      game.selectedFrom = undefined;
      from = undefined;
    } else if (legal.some(m => m.to === square)) {
      const move = chess.move({ from: from as Square, to: square as Square, promotion: 'q' });
      if (!move) return { ok: false, msg: 'حركة غير قانونية.' };
      game.moves.push({ from: move.from, to: move.to, promotion: move.promotion });
      game.fen = chess.fen();
      game.lastMoveSan = move.san;
      game.selectedFrom = undefined;
      if (chess.isCheckmate()) {
        game.status = 'finished';
        game.finishReason = 'checkmate';
        game.winnerId = playerId;
        return { ok: true, msg: `كش مات! ${player.name} فاز 🎉`, moved: true };
      }
      if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
        game.status = 'finished';
        game.finishReason = 'draw';
        return { ok: true, msg: 'انتهت المباراة بالتعادل.' , moved: true };
      }
      return { ok: true, msg: move.san, moved: true };
    }
  }

  const piece = chess.get(square as Square);
  if (!piece || piece.color !== player.color) {
    return {
      ok: false,
      msg: from
        ? 'هذا مو مربع وصول قانوني. اختار مربعاً أخضر أو قطعة من قطعك.'
        : 'ما مختار قطعة بعد؛ اختار قطعة عليها 🟡 أولاً، وبعدها مربعاً أخضر 🟢.'
    };
  }
  const destinations = chess.moves({ square: square as Square, verbose: true }) as Move[];
  if (!destinations.length) {
    if (from) game.selectedFrom = undefined;
    return { ok: false, msg: 'هاي القطعة محاصرة هسه وما عدها حركة قانونية؛ اختار قطعة عليها 🟡.' };
  }
  game.selectedFrom = square;
  return { ok: true, msg: `اختيرت ${piece.type.toUpperCase()} في ${square}. اختار مربع الوصول.` };
}

/** Search configuration makes the selected Elo tier change the bot's playing strength. */
function botSearchSettings(elo: number): { depth: number; randomMoveChance: number } {
  const normalized = normalizeChessBotElo(elo);
  const depth = normalized < 900 ? 1 : normalized < 1900 ? 2 : 3;
  const progress = (3200 - normalized) / (3200 - 250);
  return {
    depth,
    randomMoveChance: Math.max(0.005, 0.78 * progress * progress * progress)
  };
}

function chessTerminalScore(position: Chess, botColor: 'w' | 'b'): number | undefined {
  if (position.isCheckmate()) return position.turn() === botColor ? -100_000 : 100_000;
  if (position.isDraw() || position.isStalemate() || position.isThreefoldRepetition() || position.isInsufficientMaterial()) return 0;
  return undefined;
}

function evaluateChessPosition(position: Chess, botColor: 'w' | 'b'): number {
  const terminal = chessTerminalScore(position, botColor);
  if (terminal !== undefined) return terminal;

  const value: Record<string, number> = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
  let score = 0;
  const board = position.board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (!piece) continue;
      const sign = piece.color === botColor ? 1 : -1;
      score += sign * value[piece.type];
      const center = 3.5 - (Math.abs(file - 3.5) + Math.abs(rank - 3.5)) / 2;
      if (piece.type === 'n' || piece.type === 'b') score += sign * center * 7;
      if (piece.type === 'p') {
        const advance = piece.color === 'w' ? 6 - rank : rank - 1;
        score += sign * (Math.max(0, advance) * 4 + center * 2);
      }
    }
  }
  if (position.isCheck()) score += position.turn() === botColor ? -25 : 25;
  return score;
}

function minimaxChess(
  position: Chess,
  depth: number,
  alpha: number,
  beta: number,
  botColor: 'w' | 'b'
): number {
  const terminal = chessTerminalScore(position, botColor);
  if (terminal !== undefined) return terminal;
  if (depth <= 0) return evaluateChessPosition(position, botColor);

  const moves = position.moves({ verbose: true }) as Move[];
  if (!moves.length) return evaluateChessPosition(position, botColor);
  // Capture/check moves first improves alpha-beta pruning while preserving legality.
  moves.sort((a, b) => Number(Boolean(b.captured)) - Number(Boolean(a.captured)));
  const maximizing = position.turn() === botColor;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    position.move({ from: move.from, to: move.to, promotion: move.promotion });
    const score = minimaxChess(position, depth - 1, alpha, beta, botColor);
    position.undo();
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

/** Elo-tiered legal chess bot: weaker tiers blunder more often and search less deeply. */
export function chessBotMove(game: ChessGame): { ok: boolean; msg: string; moved?: boolean } {
  if (!game.botOpponent || game.status !== 'playing') return { ok: false, msg: 'ماكو دور بوت هسه.' };
  const bot = game.players.find(p => p.isBot);
  const chess = loadPosition(game);
  if (!bot || chess.turn() !== bot.color) return { ok: false, msg: 'مو دور البوت.' };

  const botColor = bot.color;
  const elo = normalizeChessBotElo(game.botElo);
  game.botElo = elo;
  const settings = botSearchSettings(elo);
  const candidates = chess.moves({ verbose: true }) as Move[];
  if (!candidates.length) return { ok: false, msg: 'ما لكيت حركة قانونية للبوت.' };

  let bestMove = candidates[Math.floor(Math.random() * candidates.length)];
  if (Math.random() >= settings.randomMoveChance) {
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      chess.move({ from: candidate.from, to: candidate.to, promotion: candidate.promotion });
      const score = minimaxChess(chess, settings.depth - 1, -Infinity, Infinity, botColor);
      chess.undo();
      // Tiny rating-dependent noise makes equal moves less predictable.
      const noise = Math.random() * ((3200 - elo) / 120);
      if (score + noise > bestScore) {
        bestScore = score + noise;
        bestMove = candidate;
      }
    }
  }

  const moved = chess.move({ from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion });
  if (!moved) return { ok: false, msg: 'تعذر تنفيذ حركة البوت.' };
  game.moves.push({ from: moved.from, to: moved.to, promotion: moved.promotion });
  game.fen = chess.fen();
  game.lastMoveSan = moved.san;
  game.selectedFrom = undefined;

  if (chess.isCheckmate()) {
    game.status = 'finished';
    game.finishReason = 'checkmate';
    game.winnerId = bot.id;
    return { ok: true, msg: `كش مات! ${bot.name} فاز.`, moved: true };
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
    game.status = 'finished';
    game.finishReason = 'draw';
    return { ok: true, msg: 'انتهت المباراة بالتعادل.', moved: true };
  }
  return { ok: true, msg: `حركة البوت Elo ${elo}: ${moved.san}`, moved: true };
}

export function chessResign(game: ChessGame, playerId: string): { ok: boolean; msg: string } {
  if (game.status !== 'playing') return { ok: false, msg: 'ماكو مباراة جارية.' };
  const player = game.players.find(p => p.id === playerId);
  if (!player) return { ok: false, msg: 'أنت مو مشارك بهالمباراة.' };
  game.status = 'finished';
  game.finishReason = 'resignation';
  game.winnerId = game.players.find(p => p.id !== playerId)?.id;
  game.selectedFrom = undefined;
  return { ok: true, msg: `${player.name} استسلم؛ فاز خصمه.` };
}

const PIECES: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟'
};
export function chessBoardKeyboard(game: ChessGame): any[][] {
  const chess = loadPosition(game);
  const legalTargets = new Set<string>();
  if (game.botOpponent && game.status === 'playing' && game.selectedFrom) {
    for (const move of chess.moves({ square: game.selectedFrom as Square, verbose: true }) as Move[]) legalTargets.add(move.to);
  }
  const rows: any[][] = [];
  for (let rank = 8; rank >= 1; rank--) {
    const row: any[] = [];
    for (const file of 'abcdefgh') {
      const square = `${file}${rank}`;
      const piece = chess.get(square as Square);
      let text = piece ? PIECES[`${piece.color}${piece.type}`] : '·';
      if (legalTargets.has(square)) text = `🟢${text}`;
      row.push({ text, callback_data: `ch:sq:${game.chatId}:${square}` });
    }
    rows.push(row);
  }
  if (game.status === 'playing') {
    rows.push([{ text: '🏳️ استسلام', callback_data: `ch:resign:${game.chatId}` }]);
  } else if (game.status === 'finished') {
    rows.push([{ text: '🔄 مباراة جديدة', callback_data: `ch:new:${game.chatId}:${game.botOpponent ? `bot:${normalizeChessBotElo(game.botElo)}` : 'human'}` }]);
  }
  return rows;
}

export function renderChess(game: ChessGame): string {
  const lines = [`♟️ *شطرنج${game.botOpponent ? ` ضد البوت 🤖 — Elo ${normalizeChessBotElo(game.botElo)}` : ' 1 ضد 1'}*`, '━━━━━━━━━━━━━━━━━━━'];
  if (game.status === 'lobby') {
    lines.push(`👥 اللاعبون: ${game.players.length}/2`);
    game.players.forEach((p, i) => lines.push(`${p.color === 'w' ? '⚪' : '⚫'} ${i + 1}\. ${escapeV2(p.name)}`));
    lines.push('', '⚪ الأبيض يبدأ؛ اضغط انضم، ثم ابدأ المباراة');
  } else {
    const current = game.status === 'playing' ? chessCurrentPlayer(game) : undefined;
    const check = game.status === 'playing' && loadPosition(game).isCheck() ? ' — ♟️ كش' : '';
    if (game.status === 'playing') {
      if (game.botOpponent) lines.push('أنت الأبيض ⚪ والبوت الأسود ⚫\\.');
      lines.push(`🎯 الدور: ${escapeV2(current?.name || '—')} ${current?.color === 'w' ? '⚪' : '⚫'}${check}`);
    }
    if (game.lastMoveSan) lines.push(`آخر حركة: ${escapeV2(game.lastMoveSan)}`);
    if (game.status === 'finished') {
      const winner = game.players.find(p => p.id === game.winnerId);
      lines.push(game.finishReason === 'draw' ? '🤝 انتهت المباراة بالتعادل' : winner ? `🏆 الفائز: ${escapeV2(winner.name)}` : 'انتهت المباراة');
    }
    lines.push(
      '',
      escapeV2(game.botOpponent
        ? 'اضغط قطعة أولاً؛ بعدها تظهر الدوائر الخضراء على مربعات الحركة القانونية فقط. الترقية إلى وزير تلقائية.'
        : 'اضغط قطعة، ثم اضغط مربع الوصول القانوني لإتمام الحركة.')
    );
  }
  return lines.join('\n');
}

function escapeV2(text: string): string {
  return String(text || '').replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
