// Pure candidate evaluation. Each candidate is run through the same deterministic
// pipeline the controller uses for a real shot - simulate() -> deriveOutcome() ->
// reduce() - and scored from the resulting rules state: a legal win dominates, a
// legal pot beats a safety, and any foul is penalized below a dry legal shot. A
// small positional term rewards leaving the cue near the next target. This module
// re-runs the real engine as its look-ahead simulator; it is never a separate
// approximation, and it stays pure (no DOM/clock/network, randomness comes only
// from the seeded shot the caller built).

import type {
  Ball,
  PhysicsConfig,
  PhysicsState,
  TableGeometry,
} from '../types/physics';
import type { BallGroup, GameState, Seat } from '../types/rules';
import type { BotCandidate } from '../types/bot';
import { simulate } from '../engine/simulate';
import { deriveOutcome } from '../rules/outcome';
import { reduce } from '../rules/eightBall';
import { distance } from '../engine/vec2';

const EIGHT = 8;
const WIN_SCORE = 1e6;
const LOSS_SCORE = -1e6;
const FOUL_PENALTY = 1e4;
const POT_REWARD = 1e3;
const CONTINUE_BONUS = 300;
const POSITION_WEIGHT = 100;

const groupOf = (id: number): BallGroup => (id < EIGHT ? 'solids' : 'stripes');
const otherSeat = (s: Seat): Seat => (s === 'player' ? 'bot' : 'player');

// A throwaway deep copy so the candidate simulation never touches the caller's
// ball field. Mirrors the private clones in simulate.ts / aiming.ts.
const cloneBalls = (balls: readonly Ball[]): Ball[] =>
  balls.map((b) => ({
    id: b.id,
    position: { x: b.position.x, y: b.position.y },
    velocity: { x: b.velocity.x, y: b.velocity.y },
    spin: { x: b.spin.x, y: b.spin.y },
    radius: b.radius,
    pocketed: b.pocketed,
  }));

// Reward leaving the cue close to a ball the shooter may next target, but only
// when the shot legally continues the turn. Scaled to at most POSITION_WEIGHT so
// it breaks ties between pots without ever outweighing a pot.
const positionalBonus = (
  finalState: PhysicsState,
  next: GameState,
  shooter: Seat,
  geo: TableGeometry,
  config: PhysicsConfig,
): number => {
  if (next.winner !== null || next.foul !== null || next.turn !== shooter) return 0;
  const cue = finalState.balls.find((b) => b.id === config.cueBallId);
  if (cue === undefined || cue.pocketed) return 0;
  const avail = finalState.balls.filter(
    (b) => b.id !== config.cueBallId && !b.pocketed,
  );
  const group = next.groups[shooter];
  const targets =
    next.phase === 'on-8'
      ? avail.filter((b) => b.id === EIGHT)
      : group !== null
        ? avail.filter((b) => b.id !== EIGHT && groupOf(b.id) === group)
        : avail.filter((b) => b.id !== EIGHT);
  const pool = targets.length > 0 ? targets : avail;
  if (pool.length === 0) return 0;
  const diag = Math.hypot(geo.width, geo.height);
  const nearestDist = pool.reduce(
    (m, b) => Math.min(m, distance(cue.position, b.position)),
    Infinity,
  );
  return POSITION_WEIGHT * (1 - Math.min(nearestDist / diag, 1));
};

export const scoreCandidate = (
  candidate: BotCandidate,
  game: GameState,
  balls: readonly Ball[],
  geometry: TableGeometry,
  config: PhysicsConfig,
): number => {
  const state: PhysicsState = { tick: 0, balls: cloneBalls(balls) };
  const { finalState, events } = simulate(state, candidate.shot, geometry, config);
  const outcome = deriveOutcome(events);
  const next = reduce(game, outcome);
  const shooter = game.turn;

  if (next.winner === shooter) return WIN_SCORE;
  if (next.winner === otherSeat(shooter)) return LOSS_SCORE;

  let score = 0;
  if (next.foul !== null) score -= FOUL_PENALTY;

  const group = game.groups[shooter];
  const objectPots = outcome.pocketed.filter((id) => id !== EIGHT);
  const ownPots =
    group === null
      ? objectPots.length
      : objectPots.filter((id) => groupOf(id) === group).length;
  score += ownPots * POT_REWARD;

  if (next.foul === null && next.turn === shooter) score += CONTINUE_BONUS;
  score += positionalBonus(finalState, next, shooter, geometry, config);
  return score;
};
