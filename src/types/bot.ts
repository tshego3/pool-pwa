// Pure bot-planning domain types. Like the other src/types modules these are
// zero-runtime interfaces; the planner in src/bot/ is pure and deterministic and
// its only side-effecting wrapper is the Web Worker (src/bot/worker.ts).

import type { Ball, PhysicsConfig, ShotInput, TableGeometry } from './physics';
import type { GameState } from './rules';

// The three opponent skill tiers. Difficulty is expressed as seeded aim/power
// noise (larger at lower tiers) plus a cap on how many candidate shots the search
// evaluates; all randomness flows from the seeded PRNG.
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyParams {
  // Upper bound on candidate shots evaluated (a deterministic search bound).
  readonly candidateCap: number;
  // Half-width of the uniform aim-angle jitter, in radians.
  readonly angleNoise: number;
  // Half-width of the uniform normalized-power jitter, in [0, 1] units.
  readonly powerNoise: number;
}

// One enumerated shot the planner may play, plus cheap pre-simulation metadata.
export interface BotCandidate {
  readonly shot: ShotInput;
  // Object ball this shot aims to pot, or -1 for a break / fallback shot.
  readonly targetBall: number;
  // Pre-simulation ranking used only to order candidates before the cap is
  // applied; higher is evaluated first. Not the final (simulated) score.
  readonly heuristic: number;
}

// Worker messaging contract. Every field is structured-cloneable so the request
// can cross the Worker boundary; the worker touches no network or DOM beyond
// message passing, and all randomness derives from `seed`.
export interface BotPlanRequest {
  readonly id: number;
  readonly game: GameState;
  readonly balls: readonly Ball[];
  readonly geometry: TableGeometry;
  readonly config: PhysicsConfig;
  readonly difficulty: Difficulty;
  readonly seed: number;
}

export interface BotPlanResponse {
  readonly id: number;
  readonly shot: ShotInput;
}
