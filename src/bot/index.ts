// The bot's public planning API. planShot enumerates candidate shots, scores
// each with the real engine as its simulator, takes the best, then applies
// seeded difficulty noise. It is pure and deterministic: the same
// (game, balls, geometry, config, difficulty, seed) always yields the identical
// ShotInput. The Web Worker wrapper (worker.ts) reuses these same building blocks
// with a wall-clock time-box; this module never reads a clock.

import type {
  Ball,
  PhysicsConfig,
  ShotInput,
  TableGeometry,
} from '../types/physics';
import type { GameState } from '../types/rules';
import type { BotCandidate, Difficulty, DifficultyParams } from '../types/bot';
import { createPrng, type Prng } from '../engine/prng';
import { enumerateCandidates } from './candidates';
import { scoreCandidate } from './evaluate';

export { enumerateCandidates } from './candidates';
export { scoreCandidate } from './evaluate';

// Lower tiers add larger aim/power jitter and search fewer candidates, so they
// both pick worse shots and execute them less accurately. Hard has zero noise:
// it plays the best candidate exactly.
export const DIFFICULTY_PARAMS: Record<Difficulty, DifficultyParams> = {
  easy: { candidateCap: 8, angleNoise: 0.06, powerNoise: 0.18 },
  medium: { candidateCap: 20, angleNoise: 0.025, powerNoise: 0.09 },
  hard: { candidateCap: 48, angleNoise: 0, powerNoise: 0 },
};

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
// Keep noised shots from collapsing to a zero-power (no-op) shot.
const MIN_POWER = 0.05;

// Perturb a chosen shot by the difficulty's seeded aim/power jitter. The
// cue-placement (when present) is never perturbed, so a legal ball-in-hand
// placement stays legal.
export const applyDifficultyNoise = (
  shot: ShotInput,
  params: DifficultyParams,
  prng: Prng,
): ShotInput => {
  const angle = shot.angle + prng.range(-params.angleNoise, params.angleNoise);
  const power = Math.max(
    MIN_POWER,
    clamp01(shot.power + prng.range(-params.powerNoise, params.powerNoise)),
  );
  return shot.cuePlacement !== undefined
    ? { angle, power, cuePlacement: shot.cuePlacement }
    : { angle, power };
};

// Played when there is nothing to enumerate, so the bot always has a legal move.
const FALLBACK_SHOT: ShotInput = { angle: 0, power: 0.3 };

// Score candidates in order and keep the best. `trail` is every shot that was
// the best-so-far at some point, in the order the search found them: the
// deliberation the HUD replays. `shouldStop` lets the Worker time-box the search
// without this module ever reading a clock, which keeps the core pure.
export const searchBestShot = (
  candidates: readonly BotCandidate[],
  game: GameState,
  balls: readonly Ball[],
  geometry: TableGeometry,
  config: PhysicsConfig,
  shouldStop: () => boolean = () => false,
): { readonly shot: ShotInput; readonly considered: readonly ShotInput[] } => {
  let bestShot: ShotInput = candidates[0]?.shot ?? FALLBACK_SHOT;
  let bestScore = -Infinity;
  const considered: ShotInput[] = [];
  for (const candidate of candidates) {
    const score = scoreCandidate(candidate, game, balls, geometry, config);
    if (score > bestScore) {
      bestScore = score;
      bestShot = candidate.shot;
      considered.push(candidate.shot);
    }
    if (shouldStop()) break;
  }
  return { shot: bestShot, considered };
};

export const planShot = (
  game: GameState,
  balls: readonly Ball[],
  geometry: TableGeometry,
  config: PhysicsConfig,
  difficulty: Difficulty,
  seed: number,
): ShotInput => {
  const params = DIFFICULTY_PARAMS[difficulty];
  const candidates = enumerateCandidates(game, balls, geometry, config, params.candidateCap);
  const best = searchBestShot(candidates, game, balls, geometry, config).shot;
  return applyDifficultyNoise(best, params, createPrng(seed));
};

// Adapt planShot to the controller's ShotPlanner shape (structurally typed, so
// the bot never imports the game facade). The per-shot seed is derived from the
// base seed and the game's progress so the bot varies as the rack empties while
// staying fully deterministic for a given snapshot.
export const createBotPlanner = (
  difficulty: Difficulty,
  seed: number,
): ((
  game: GameState,
  balls: readonly Ball[],
  geometry: TableGeometry,
  config: PhysicsConfig,
) => ShotInput) => {
  return (game, balls, geometry, config) =>
    planShot(game, balls, geometry, config, difficulty, seed + game.pocketed.length);
};
