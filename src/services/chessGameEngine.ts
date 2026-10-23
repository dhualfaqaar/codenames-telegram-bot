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
}

const INITIAL_FEN = new Chess().fen();
export function createChessLobby(chatId: string, chatTitle: string): ChessGame {
  return { chatId, chatTitle, status: 'lobby', players: [], fen: INITIAL_FEN, moves: [] };
}

export function createChessBotGame(chatId: string, playerId: string, playerName: string): ChessGame {
  return {
    chatId,
    chatTitle: 'مباراة خاصة ضد البوت',
    status: 'playing',
    players: [
      { id: playerId, name: playerName || 'لاعب', color: 'w' },
      { id: 'chess_bot', name: 'البوت 🤖', color: 'b', isBot: true }
    ],
    fen: INITIAL_FEN,
    moves: [],
    botOpponent: true
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

  const from = game.selectedFrom;
  if (from) {
    const legal = chess.moves({ square: from as Square, verbose: true }) as Move[];
    if (legal.some(m => m.to === square)) {
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
    return { ok: false, msg: from ? 'هذا المربع مو وجهة قانونية؛ اختار مربعاً مميزاً أو قطعة من قطعك.' : 'اختار قطعة من قطعك أولاً.' };
  }
  const destinations = chess.moves({ square: square as Square, verbose: true }) as Move[];
  if (!destinations.length) return { ok: false, msg: 'هاي القطعة ما عدها حركة قانونية.' };
  game.selectedFrom = square;
  return { ok: true, msg: `اختيرت ${piece.type.toUpperCase()} في ${square}. اختار مربع الوصول.` };
}

/** حركة بوت بسيطة وآمنة: تكتيك مادي، كش/كش مات، وتمركز مركزي، وكل الحركات من chess.js القانونية. */
export function chessBotMove(game: ChessGame): { ok: boolean; msg: string; moved?: boolean } {
  if (!game.botOpponent || game.status !== 'playing') return { ok: false, msg: 'ماكو دور بوت هسه.' };
  const bot = game.players.find(p => p.isBot);
  const chess = loadPosition(game);
  if (!bot || chess.turn() !== bot.color) return { ok: false, msg: 'مو دور البوت.' };

  const pieceValue: Record<string, number> = { p: 1, n: 3.2, b: 3.3, r: 5, q: 9, k: 0 };
  const material = (position: Chess) => {
    let score = 0;
    for (const row of position.board()) {
      for (const piece of row) {
        if (piece) score += (piece.color === 'b' ? 1 : -1) * pieceValue[piece.type];
      }
    }
    return score;
  };

  const candidates = chess.moves({ verbose: true }) as Move[];
  if (!candidates.length) return { ok: false, msg: 'ما لكيت حركة قانونية للبوت.' };
  let bestMove = candidates[0];
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    chess.move({ from: candidate.from, to: candidate.to, promotion: candidate.promotion });
    const centerBonus = ['d4', 'e4', 'd5', 'e5'].includes(candidate.to) ? 0.12 : 0;
    const score =
      (chess.isCheckmate() ? 10000 : material(chess) + (chess.isCheck() ? 0.35 : 0) + centerBonus) +
      Math.random() * 0.02;
    chess.undo();
    if (score > bestScore) {
      bestScore = score;
      bestMove = candidate;
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
  return { ok: true, msg: `حركة البوت: ${moved.san}`, moved: true };
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
  if (game.status === 'playing' && game.selectedFrom) {
    for (const move of chess.moves({ square: game.selectedFrom as Square, verbose: true }) as Move[]) legalTargets.add(move.to);
  }
  const rows: any[][] = [];
  for (let rank = 8; rank >= 1; rank--) {
    const row: any[] = [];
    for (const file of 'abcdefgh') {
      const square = `${file}${rank}`;
      const piece = chess.get(square as Square);
      let text = piece ? PIECES[`${piece.color}${piece.type}`] : '·';
      if (game.selectedFrom === square) text = `🔸${text}`;
      else if (legalTargets.has(square)) text = `🟢${text}`;
      row.push({ text, callback_data: `ch:sq:${game.chatId}:${square}` });
    }
    rows.push(row);
  }
  if (game.status === 'playing') {
    rows.push([{ text: '🏳️ استسلام', callback_data: `ch:resign:${game.chatId}` }]);
  } else if (game.status === 'finished') {
    rows.push([{ text: '🔄 مباراة جديدة', callback_data: `ch:new:${game.chatId}` }]);
  }
  return rows;
}

export function renderChess(game: ChessGame): string {
  const lines = [`♟️ *شطرنج${game.botOpponent ? ' ضد البوت 🤖' : ' 1 ضد 1'}*`, '━━━━━━━━━━━━━━━━━━━'];
  if (game.status === 'lobby') {
    lines.push(`👥 اللاعبون: ${game.players.length}/2`);
    game.players.forEach((p, i) => lines.push(`${p.color === 'w' ? '⚪' : '⚫'} ${i + 1}\. ${escapeV2(p.name)}`));
    lines.push('', '⚪ الأبيض يبدأ؛ اضغط انضم، ثم ابدأ المباراة');
  } else {
    const current = game.status === 'playing' ? chessCurrentPlayer(game) : undefined;
    const check = game.status === 'playing' && loadPosition(game).isCheck() ? ' — ♟️ كش' : '';
    if (game.status === 'playing') lines.push(`🎯 الدور: ${current?.name || '—'} ${current?.color === 'w' ? '⚪' : '⚫'}${check}`);
    if (game.lastMoveSan) lines.push(`آخر حركة: ${escapeV2(game.lastMoveSan)}`);
    if (game.status === 'finished') {
      const winner = game.players.find(p => p.id === game.winnerId);
      lines.push(game.finishReason === 'draw' ? '🤝 انتهت المباراة بالتعادل' : winner ? `🏆 الفائز: ${escapeV2(winner.name)}` : 'انتهت المباراة');
    }
    lines.push('', 'اضغط قطعة من قطعك، ثم اضغط المربع المميز للحركة؛ الترقية تتم تلقائياً إلى وزير');
  }
  return lines.join('\n');
}

function escapeV2(text: string): string {
  return String(text || '').replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
