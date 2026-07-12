// Per-difficulty play statistics shown on the Stats screen. Pure model type;
// filled from the IndexedDB `stats` store (src/db).

import type { Difficulty } from './bot';

export interface DifficultyStats {
  readonly difficulty: Difficulty;
  readonly played: number;
  readonly won: number;
  readonly potted: number;
  readonly fouls: number;
  readonly bestStreak: number;
}
