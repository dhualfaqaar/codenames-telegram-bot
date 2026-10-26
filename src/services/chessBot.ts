import { Chess, type Move } from 'chess.js';
import type { ChessTrainerStyle } from '../data/chessTrainers';

const PIECE_VALUE: Record<string, number> = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20_000 };
const MATE_SCORE = 100_000;

type ScoredMove = { move: Move; score: number };
export type ChessBotMove = Pick<Move, 'from' | 'to' | 'promotion' | 'san'>;

type SearchSettings = { depth: number; width: number; nodes: number; rootCandidates: number; noise: number; blunderChance: number; blunderWindow: number };

function searchSettings(elo: number): SearchSettings {
  if (elo < 400) return { depth: 1, width: 8, nodes: 0, rootCandidates: 40, noise: 120, blunderChance: 0.10, blunderWindow: 360 };
  if (elo < 700) return { depth: 1, width: 9, nodes: 0, rootCandidates: 40, noise: 90, blunderChance: 0.075, blunderWindow: 270 };
  if (elo < 1_100) return { depth: 2, width: 6, nodes: 24, rootCandidates: 7, noise: 60, blunderChance: 0.05, blunderWindow: 190 };
  if (elo < 1_500) return { depth: 2, width: 8, nodes: 52, rootCandidates: 9, noise: 38, blunderChance: 0.035, blunderWindow: 135 };
  if (elo < 2_000) return { depth: 3, width: 5, nodes: 40, rootCandidates: 6, noise: 23, blunderChance: 0.02, blunderWindow: 85 };
  if (elo < 2_500) return { depth: 3, width: 6, nodes: 48, rootCandidates: 6, noise: 13, blunderChance: 0.01, blunderWindow: 48 };
  return { depth: 4, width: 5, nodes: 55, rootCandidates: 5, noise: 7, blunderChance: 0.003, blunderWindow: 22 };
}

function centerValue(file: number, rank: number): number {
  return 7 - (Math.abs(3.5 - file) + Math.abs(3.5 - rank));
}

/** Positive scores favor White; includes material, development, center, pawn structure and king safety. */
function evaluatePosition(chess: Chess, style: ChessTrainerStyle): number {
  const board = chess.board();
  const totalMaterial = board.flat().reduce((sum, piece) => sum + (piece && piece.type !== 'k' ? PIECE_VALUE[piece.type] : 0), 0);
  let score = 0;
  let whiteBishops = 0;
  let blackBishops = 0;
  const pawnsByFile: Record<'w' | 'b', number[]> = { w: Array(8).fill(0), b: Array(8).fill(0) };

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (!piece) continue;
      const sign = piece.color === 'w' ? 1 : -1;
      const value = PIECE_VALUE[piece.type];
      const center = centerValue(file, rank);
      let positional = 0;
      if (piece.type === 'p') {
        const advance = piece.color === 'w' ? rank : 7 - rank;
        positional += advance * 7 + center * (advance > 1 ? 2.5 : 1);
        pawnsByFile[piece.color][file]++;
      } else if (piece.type === 'n') positional += center * (style === 'tactical' ? 7 : 5);
      else if (piece.type === 'b') {
        positional += center * 3;
        if (piece.color === 'w') whiteBishops++; else blackBishops++;
      } else if (piece.type === 'r') {
        const ownPawns = pawnsByFile[piece.color][file];
        const opponent = piece.color === 'w' ? 'b' : 'w';
        const opponentPawns = pawnsByFile[opponent][file];
        if (!ownPawns) positional += opponentPawns ? 10 : 20;
      } else if (piece.type === 'q') positional += center * (style === 'aggressive' ? 2.5 : 1);
      else {
        if (totalMaterial < 2_700) positional += center * 8;
        else positional -= center * (style === 'defensive' ? 6 : 3);
        if ((piece.color === 'w' && rank === 0 && (file === 1 || file === 6)) || (piece.color === 'b' && rank === 7 && (file === 1 || file === 6))) positional += 24;
      }
      score += sign * (value + positional);
    }
  }
  if (whiteBishops >= 2) score += 28;
  if (blackBishops >= 2) score -= 28;
  for (const color of ['w', 'b'] as const) {
    const files = pawnsByFile[color];
    const doubled = files.reduce((sum, count) => sum + Math.max(0, count - 1), 0);
    score += (color === 'w' ? -1 : 1) * doubled * 13;
  }
  return score + (chess.isCheck() ? (chess.turn() === 'w' ? -18 : 18) : 0);
}

function orderMoves(moves: Move[]): Move[] {
  return moves.slice().sort((a, b) => {
    const priority = (move: Move) => (move.captured ? 10 * (PIECE_VALUE[move.captured] || 0) - (PIECE_VALUE[move.piece] || 0) : 0)
      + (move.promotion ? 8_000 + (PIECE_VALUE[move.promotion] || 0) : 0)
      + (move.san.includes('#') ? 100_000 : move.san.includes('+') ? 80 : 0)
      + (move.flags.includes('k') || move.flags.includes('q') ? 24 : 0);
    return priority(b) - priority(a);
  });
}

function evaluateTerminal(chess: Chess, moves: Move[], ply: number): number | null {
  if (!moves.length) return chess.isCheck() ? (chess.turn() === 'w' ? -MATE_SCORE + ply : MATE_SCORE - ply) : 0;
  if (chess.isInsufficientMaterial()) return 0;
  const halfMoveClock = Number(chess.fen().split(' ')[4]) || 0;
  if (halfMoveClock >= 100) return 0;
  return null;
}

export function chooseChessBotMove(
  fen: string,
  requestedElo: number,
  style: ChessTrainerStyle = 'balanced',
  random: () => number = Math.random,
): ChessBotMove | null {
  const elo = Math.max(200, Math.min(2_800, Math.round(Number(requestedElo) || 200)));
  const settings = searchSettings(elo);
  const chess = new Chess(fen);
  const allMoves = orderMoves(chess.moves({ verbose: true }));
  if (!allMoves.length) return null;

  let nodes = 0;
  const evaluate = (position: Chess) => evaluatePosition(position, style);
  const quiescence = (position: Chess, alpha: number, beta: number, ply: number, remaining: number): number => {
    nodes++;
    const legalMoves = position.moves({ verbose: true });
    const terminal = evaluateTerminal(position, legalMoves, ply);
    if (terminal !== null) return terminal;
    const checked = position.isCheck();
    const maximizing = position.turn() === 'w';
    const standPat = evaluate(position);
    if (!checked) {
      if (maximizing && standPat >= beta) return beta;
      if (!maximizing && standPat <= alpha) return alpha;
      if (maximizing) alpha = Math.max(alpha, standPat); else beta = Math.min(beta, standPat);
      if (remaining <= 0 || nodes >= settings.nodes) return standPat;
    } else if (remaining <= 0 || nodes >= settings.nodes) return standPat;
    const moves = orderMoves(legalMoves).filter(move => checked || move.captured || move.promotion);
    let best = checked ? (maximizing ? -MATE_SCORE : MATE_SCORE) : standPat;
    for (const move of moves.slice(0, settings.width)) {
      position.move({ from: move.from, to: move.to, promotion: move.promotion });
      const score = quiescence(position, alpha, beta, ply + 1, remaining - 1);
      position.undo();
      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, best);
      }
      if (alpha >= beta || nodes >= settings.nodes) break;
    }
    return best;
  };

  const search = (position: Chess, depth: number, alpha: number, beta: number, ply: number): number => {
    nodes++;
    const legalMoves = position.moves({ verbose: true });
    const terminal = evaluateTerminal(position, legalMoves, ply);
    if (terminal !== null) return terminal;
    if (depth <= 0 || nodes >= settings.nodes) return quiescence(position, alpha, beta, ply, 2);
    const maximizing = position.turn() === 'w';
    const moves = orderMoves(legalMoves).slice(0, settings.width);
    let best = maximizing ? -MATE_SCORE : MATE_SCORE;
    for (const move of moves) {
      position.move({ from: move.from, to: move.to, promotion: move.promotion });
      const score = search(position, depth - 1, alpha, beta, ply + 1);
      position.undo();
      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, best);
      }
      if (alpha >= beta || nodes >= settings.nodes) break;
    }
    return best;
  };

  const rootSide = chess.turn();
  const previews: Array<ScoredMove & { rootScore: number }> = allMoves.map(move => {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    let rootScore = chess.isCheckmate() ? MATE_SCORE : chess.isDraw() ? 0 : evaluate(chess);
    chess.undo();
    if (rootSide === 'b' && Math.abs(rootScore) < MATE_SCORE) rootScore = -rootScore;
    if (style === 'tactical' && (move.captured || move.promotion)) rootScore += 9;
    if (style === 'aggressive' && move.san.includes('+')) rootScore += 12;
    if (style === 'positional' && ['d4', 'e4', 'd5', 'e5'].includes(move.to)) rootScore += 10;
    return { move, score: rootScore, rootScore };
  }).sort((a, b) => b.rootScore - a.rootScore);
  const rootMoves = settings.depth <= 1 ? previews : previews.slice(0, settings.rootCandidates);
  const scored: ScoredMove[] = [];
  for (const candidate of rootMoves) {
    const move = candidate.move;
    nodes = 0;
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    let score = settings.depth <= 1 ? candidate.rootScore : search(chess, settings.depth - 1, -MATE_SCORE, MATE_SCORE, 1);
    chess.undo();
    if (settings.depth > 1 && rootSide === 'b') score = -score;
    if (style === 'tactical' && (move.captured || move.promotion)) score += 9;
    if (style === 'aggressive' && move.san.includes('+')) score += 12;
    if (style === 'positional' && ['d4', 'e4', 'd5', 'e5'].includes(move.to)) score += 10;
    scored.push({ move, score });
  }
  if (!scored.length) return allMoves[0];
  scored.sort((a, b) => b.score - a.score);
  const bestScore = scored[0].score;
  if (random() < settings.blunderChance) {
    const weaker = scored.filter(candidate => candidate.score >= bestScore - settings.blunderWindow).slice(1, 6);
    if (weaker.length) return weaker[Math.floor(random() * weaker.length)].move;
  }
  const noise = settings.noise;
  const choice = scored.map(candidate => ({ ...candidate, noisyScore: candidate.score + (random() - 0.5) * noise }))
    .sort((a, b) => b.noisyScore - a.noisyScore)[0];
  return choice.move;
}
