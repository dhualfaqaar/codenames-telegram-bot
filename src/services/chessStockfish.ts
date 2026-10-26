export const STOCKFISH_ASSET_VERSION = '10.0.2';

/** Keep the UCI strength ladder monotonic across the trainer catalogue. */
export function stockfishSkillForElo(elo: number): number {
  return Math.max(0, Math.min(20, Math.round((Math.max(200, Math.min(2_800, elo)) - 200) / 130)));
}

/** Bounded mobile-friendly thinking budget, increasing with the selected trainer rating. */
export function stockfishThinkTimeForElo(elo: number): number {
  const bounded = Math.max(200, Math.min(2_800, elo));
  return Math.round(350 + ((bounded - 200) / 2_600) * 2_650);
}
