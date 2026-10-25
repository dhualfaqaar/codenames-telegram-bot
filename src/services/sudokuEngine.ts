export type SudokuDifficulty = 'easy' | 'medium' | 'hard';

export interface SudokuPuzzle {
  puzzle: number[];
  solution: number[];
  difficulty: SudokuDifficulty;
}

export interface SudokuPlayerState {
  userId: string;
  name: string;
  board: number[];
  mistakes: number;
  hintsUsed: number;
  startedAt: number;
  messageId?: number;
}

export interface SudokuGame {
  id: string;
  mode: 'solo' | 'random';
  status: 'playing' | 'finished';
  difficulty: SudokuDifficulty;
  puzzle: number[];
  solution: number[];
  players: SudokuPlayerState[];
  createdAt: number;
  winnerId?: string;
}

const FULL_MASK = 0x3fe; // bits 1..9
const TARGET_CLUES: Record<SudokuDifficulty, number> = {
  easy: 42,
  medium: 36,
  hard: 30
};

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function shuffledGroups(): number[] {
  const groups = shuffle([0, 1, 2]);
  return groups.flatMap(group => shuffle([0, 1, 2]).map(offset => group * 3 + offset));
}

function makeSolvedGrid(): number[] {
  const rows = shuffledGroups();
  const cols = shuffledGroups();
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const solution = new Array<number>(81);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const pattern = (rows[r] * 3 + Math.floor(rows[r] / 3) + cols[c]) % 9;
      solution[r * 9 + c] = digits[pattern];
    }
  }
  return solution;
}

/** Count solutions up to `limit`; the MRV heuristic keeps uniqueness checks inexpensive. */
export function countSudokuSolutions(input: number[], limit = 2): number {
  if (input.length !== 81 || limit < 1) return 0;
  const board = input.slice();
  const rowMasks = new Array<number>(9).fill(0);
  const colMasks = new Array<number>(9).fill(0);
  const boxMasks = new Array<number>(9).fill(0);

  for (let i = 0; i < 81; i++) {
    const value = board[i];
    if (!value) continue;
    if (!Number.isInteger(value) || value < 1 || value > 9) return 0;
    const r = Math.floor(i / 9);
    const c = i % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    const bit = 1 << value;
    if ((rowMasks[r] & bit) || (colMasks[c] & bit) || (boxMasks[b] & bit)) return 0;
    rowMasks[r] |= bit;
    colMasks[c] |= bit;
    boxMasks[b] |= bit;
  }

  let count = 0;
  const search = (): void => {
    if (count >= limit) return;
    let bestCell = -1;
    let bestMask = 0;
    let bestCount = 10;

    for (let i = 0; i < 81; i++) {
      if (board[i] !== 0) continue;
      const r = Math.floor(i / 9);
      const c = i % 9;
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const mask = FULL_MASK & ~(rowMasks[r] | colMasks[c] | boxMasks[b]);
      let options = 0;
      for (let bits = mask; bits; bits &= bits - 1) options++;
      if (options === 0) return;
      if (options < bestCount) {
        bestCell = i;
        bestMask = mask;
        bestCount = options;
        if (options === 1) break;
      }
    }

    if (bestCell < 0) {
      count++;
      return;
    }

    const r = Math.floor(bestCell / 9);
    const c = bestCell % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    for (let value = 1; value <= 9 && count < limit; value++) {
      const bit = 1 << value;
      if (!(bestMask & bit)) continue;
      board[bestCell] = value;
      rowMasks[r] |= bit;
      colMasks[c] |= bit;
      boxMasks[b] |= bit;
      search();
      board[bestCell] = 0;
      rowMasks[r] &= ~bit;
      colMasks[c] &= ~bit;
      boxMasks[b] &= ~bit;
    }
  };

  search();
  return count;
}

export function generateSudoku(difficulty: SudokuDifficulty = 'medium'): SudokuPuzzle {
  const safeDifficulty: SudokuDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
  const solution = makeSolvedGrid();
  const puzzle = solution.slice();
  const target = TARGET_CLUES[safeDifficulty];
  let clues = 81;

  for (const cell of shuffle(Array.from({ length: 81 }, (_, i) => i))) {
    if (clues <= target) break;
    const value = puzzle[cell];
    puzzle[cell] = 0;
    if (countSudokuSolutions(puzzle, 2) === 1) clues--;
    else puzzle[cell] = value;
  }

  return { puzzle, solution, difficulty: safeDifficulty };
}

export function isLegalSudokuMove(board: number[], cell: number, value: number): boolean {
  if (board.length !== 81 || !Number.isInteger(cell) || cell < 0 || cell >= 81 || !Number.isInteger(value) || value < 1 || value > 9) return false;
  const row = Math.floor(cell / 9);
  const col = cell % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let i = 0; i < 9; i++) {
    if (i !== col && board[row * 9 + i] === value) return false;
    if (i !== row && board[i * 9 + col] === value) return false;
  }
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      const i = r * 9 + c;
      if (i !== cell && board[i] === value) return false;
    }
  }
  return true;
}

export function isSudokuSolved(board: number[], solution: number[]): boolean {
  return board.length === 81 && solution.length === 81 && board.every((value, i) => value === solution[i]);
}

export function sudokuDifficultyLabel(difficulty: SudokuDifficulty): string {
  switch (difficulty) {
    case 'easy': return 'سهل';
    case 'medium': return 'متوسط';
    case 'hard': return 'صعب';
  }
}
