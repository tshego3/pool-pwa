// Types for the IndexedDB persistence layer (src/db): the single in-progress
// game snapshot and the per-game result rolled into the stored stats. These are
// pure interfaces; the idb reads/writes that fill them live in src/db.

import type { Ball } from './physics';
import type { GameState } from './rules';
import type { Difficulty } from './bot';

// Bumped whenever the persisted shapes below change incompatibly. On load a
// snapshot whose `version` does not match is discarded (see src/db). Documented
// in the pool-pwa-physics-rules skill.
export const SCHEMA_VERSION = 1;

// The single in-progress game, saved between shots only (never mid-simulation).
// It is everything needed to rebuild the controller and keep the bot
// deterministic: the rules snapshot, the at-rest ball field, the difficulty, and
// the base PRNG seed.
export interface GameSnapshot {
  readonly version: number;
  readonly game: GameState;
  readonly balls: readonly Ball[];
  readonly difficulty: Difficulty;
  readonly seed: number;
}

// One finished game's contribution to the player's record, merged into the
// stored per-difficulty stats when a game ends.
export interface GameResult {
  readonly difficulty: Difficulty;
  readonly won: boolean;
  // Object balls the player potted across the whole game.
  readonly potted: number;
  // Fouls the player committed across the whole game.
  readonly fouls: number;
  // The player's longest run of consecutive potting shots this game.
  readonly streak: number;
}
