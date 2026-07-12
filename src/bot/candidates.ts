// Pure candidate-shot enumeration. For each legal target ball crossed with each
// pocket we compute the ghost-ball aim point and an estimated power; when the
// shooter has ball-in-hand we instead generate cue-placement shots (cue placed
// behind the ball, in line with the pocket). A fallback candidate is always
// appended so the enumeration is never empty and a ball-in-hand result always
// carries a legal placement. This module is pure: table-space math only, seeded
// PRNG nowhere (there is no randomness here), no DOM/clock/network.

import type {
  Ball,
  Pocket,
  PhysicsConfig,
  TableGeometry,
  Vec2,
} from '../types/physics';
import type { BallGroup, GameState } from '../types/rules';
import type { BotCandidate } from '../types/bot';
import { sub, scale, normalize, distance, dot, length } from '../engine/vec2';

const EIGHT = 8;
// The cue racks on the head spot at 1/4 of the table length; the kitchen (the
// legal region for a break-scratch ball-in-hand) is everything behind it.
const HEAD_STRING_FRACTION = 0.25;
// How far behind the object ball (in ball radii) a ball-in-hand cue is placed.
const STANDOFF_RADII = 8;
// Below this cut efficiency the object ball can barely be driven pocket-ward, so
// the shot is discarded as geometrically impossible.
const MIN_CUT_EFFICIENCY = 0.05;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const groupOf = (id: number): BallGroup => (id < EIGHT ? 'solids' : 'stripes');

const availableBalls = (
  balls: readonly Ball[],
  game: GameState,
  cueId: number,
): Ball[] =>
  balls.filter(
    (b) => b.id !== cueId && !b.pocketed && !game.pocketed.includes(b.id),
  );

const nearest = (balls: readonly Ball[], from: Vec2): Ball =>
  balls.reduce((best, b) =>
    distance(b.position, from) < distance(best.position, from) ? b : best,
  );

// The balls that are a legal first contact for the seat to shoot, given the
// phase and group assignment. Break and finished states are handled by the
// caller, so this only covers open / assigned / on-8.
const legalTargets = (
  game: GameState,
  balls: readonly Ball[],
  cueId: number,
): Ball[] => {
  const avail = availableBalls(balls, game, cueId);
  if (game.phase === 'on-8') return avail.filter((b) => b.id === EIGHT);
  const group = game.groups[game.turn];
  if (group !== null) {
    return avail.filter((b) => b.id !== EIGHT && groupOf(b.id) === group);
  }
  return avail.filter((b) => b.id !== EIGHT); // open table
};

interface Aim {
  readonly angle: number;
  readonly cutEff: number;
  readonly d1: number; // cue travel to contact
  readonly d2: number; // object travel to pocket
}

// Ghost-ball aim from `from` to pot `ball` into `pocket`. Returns null when the
// cut is impossible (object would have to be driven backward) or degenerate.
const aimToPot = (
  from: Vec2,
  ball: Ball,
  pocket: Pocket,
  cueRadius: number,
): Aim | null => {
  const potDir = normalize(sub(pocket.position, ball.position));
  const sumR = cueRadius + ball.radius;
  const ghost = sub(ball.position, scale(potDir, sumR));
  const aimVec = sub(ghost, from);
  const d1 = length(aimVec);
  if (d1 < 1e-6) return null;
  const aimDir = normalize(aimVec);
  const cutEff = dot(aimDir, potDir);
  if (cutEff <= MIN_CUT_EFFICIENCY) return null;
  return {
    angle: Math.atan2(aimDir.y, aimDir.x),
    cutEff,
    d1,
    d2: distance(ball.position, pocket.position),
  };
};

// Rough normalized power to carry the cue to contact and the object to the
// pocket. Thin cuts bleed energy, so the object travel is inflated by 1/cutEff.
const estimatePower = (aim: Aim, geo: TableGeometry): number => {
  const diag = Math.hypot(geo.width, geo.height);
  const reach = aim.d1 + aim.d2 / Math.max(aim.cutEff, 0.25);
  return clamp01(0.4 + 0.55 * (reach / diag));
};

// A short list of power levels to try for one aim: the estimate plus, unless it
// is already firm, a firmer backup so a slightly under-hit estimate can still
// reach. The simulated score picks between them.
const powerVariants = (est: number): number[] => {
  if (est >= 0.85) return [est];
  return [est, clamp01(Math.max(est + 0.2, 0.85))];
};

const heuristicOf = (aim: Aim): number => aim.cutEff / (1 + aim.d1 + aim.d2);

const cueCandidates = (
  targets: readonly Ball[],
  geo: TableGeometry,
  cue: Ball,
): BotCandidate[] => {
  const out: BotCandidate[] = [];
  for (const ball of targets) {
    for (const pocket of geo.pockets) {
      const aim = aimToPot(cue.position, ball, pocket, cue.radius);
      if (aim === null) continue;
      const heuristic = heuristicOf(aim);
      for (const power of powerVariants(estimatePower(aim, geo))) {
        out.push({ shot: { angle: aim.angle, power }, targetBall: ball.id, heuristic });
      }
    }
  }
  return out;
};

const placementLegal = (
  pos: Vec2,
  balls: readonly Ball[],
  geo: TableGeometry,
  cueId: number,
  kitchenMaxX: number | undefined,
): boolean => {
  const r = geo.ballRadius;
  if (pos.x < r || pos.y < r || pos.x > geo.width - r || pos.y > geo.height - r) {
    return false;
  }
  if (kitchenMaxX !== undefined && pos.x > kitchenMaxX) return false;
  for (const b of balls) {
    if (b.id === cueId || b.pocketed) continue;
    if (distance(pos, b.position) < b.radius + r) return false;
  }
  return true;
};

// Ball-in-hand candidates: place the cue behind the object ball, in line with
// the pocket, for a straight (cut-free) pot. Placements that fall off the table,
// overlap a ball, or (when kitchen-restricted) sit ahead of the head string are
// skipped.
const placementCandidates = (
  targets: readonly Ball[],
  balls: readonly Ball[],
  geo: TableGeometry,
  cueId: number,
  kitchenMaxX: number | undefined,
): BotCandidate[] => {
  const out: BotCandidate[] = [];
  const standoff = geo.ballRadius * STANDOFF_RADII;
  for (const ball of targets) {
    for (const pocket of geo.pockets) {
      const potDir = normalize(sub(pocket.position, ball.position));
      const place = sub(ball.position, scale(potDir, standoff));
      if (!placementLegal(place, balls, geo, cueId, kitchenMaxX)) continue;
      const aim: Aim = {
        angle: Math.atan2(potDir.y, potDir.x),
        cutEff: 1,
        d1: standoff - (geo.ballRadius + ball.radius),
        d2: distance(ball.position, pocket.position),
      };
      out.push({
        shot: { angle: aim.angle, power: estimatePower(aim, geo), cuePlacement: place },
        targetBall: ball.id,
        heuristic: heuristicOf(aim),
      });
    }
  }
  return out;
};

const breakCandidates = (
  balls: readonly Ball[],
  cueId: number,
): BotCandidate[] => {
  const cue = balls.find((b) => b.id === cueId);
  const avail = balls.filter((b) => b.id !== cueId && !b.pocketed);
  if (cue === undefined || avail.length === 0) return [];
  const target = nearest(avail, cue.position);
  const dir = normalize(sub(target.position, cue.position));
  const angle = Math.atan2(dir.y, dir.x);
  return [
    { shot: { angle, power: 0.95 }, targetBall: target.id, heuristic: 1 },
    { shot: { angle, power: 0.82 }, targetBall: target.id, heuristic: 0.9 },
  ];
};

const anchorPoints = (geo: TableGeometry, kitchen: boolean): Vec2[] => {
  const w = geo.width;
  const h = geo.height;
  if (kitchen) {
    return [
      { x: w * 0.15, y: h * 0.5 },
      { x: w * 0.12, y: h * 0.3 },
      { x: w * 0.12, y: h * 0.7 },
      { x: w * 0.2, y: h * 0.5 },
    ];
  }
  return [
    { x: w * 0.5, y: h * 0.5 },
    { x: w * 0.5, y: h * 0.25 },
    { x: w * 0.5, y: h * 0.75 },
    { x: w * 0.25, y: h * 0.5 },
    { x: w * 0.75, y: h * 0.5 },
  ];
};

// A safe last-resort shot, guaranteed present so the enumeration is never empty.
// Under ball-in-hand it always returns a legal placement (a clear anchor) aimed
// at the nearest ball, so the planner can never emit an illegal placement.
const fallbackCandidate = (
  game: GameState,
  balls: readonly Ball[],
  geo: TableGeometry,
  config: PhysicsConfig,
): BotCandidate => {
  const cueId = config.cueBallId;
  const center: Vec2 = { x: geo.width * 0.5, y: geo.height * 0.5 };
  const avail = balls.filter((b) => b.id !== cueId && !b.pocketed);
  if (game.ballInHand !== 'none') {
    const kitchenMaxX =
      game.ballInHand === 'kitchen' ? geo.width * HEAD_STRING_FRACTION : undefined;
    const anchors = anchorPoints(geo, game.ballInHand === 'kitchen');
    const place =
      anchors.find((p) => placementLegal(p, balls, geo, cueId, kitchenMaxX)) ??
      anchors[0] ??
      center;
    const aimAt = avail.length > 0 ? nearest(avail, place).position : center;
    const dir = normalize(sub(aimAt, place));
    return {
      shot: { angle: Math.atan2(dir.y, dir.x), power: 0.5, cuePlacement: place },
      targetBall: -1,
      heuristic: -1,
    };
  }
  const cue = balls.find((b) => b.id === cueId);
  const from = cue?.position ?? center;
  const aimAt = avail.length > 0 ? nearest(avail, from).position : center;
  const dir = normalize(sub(aimAt, from));
  return {
    shot: { angle: Math.atan2(dir.y, dir.x), power: 0.5 },
    targetBall: -1,
    heuristic: -1,
  };
};

// Enumerate candidate shots for the seat to shoot, ranked by a cheap heuristic
// and capped at `cap` (the difficulty's search bound). Always returns at least
// the fallback candidate.
export const enumerateCandidates = (
  game: GameState,
  balls: readonly Ball[],
  geometry: TableGeometry,
  config: PhysicsConfig,
  cap: number,
): BotCandidate[] => {
  const cueId = config.cueBallId;
  let cands: BotCandidate[];
  if (game.phase === 'finished' || game.winner !== null) {
    cands = [];
  } else if (game.phase === 'break') {
    cands = breakCandidates(balls, cueId);
  } else {
    const targets = legalTargets(game, balls, cueId);
    if (game.ballInHand !== 'none') {
      const kitchenMaxX =
        game.ballInHand === 'kitchen'
          ? geometry.width * HEAD_STRING_FRACTION
          : undefined;
      cands = placementCandidates(targets, balls, geometry, cueId, kitchenMaxX);
    } else {
      const cue = balls.find((b) => b.id === cueId);
      cands =
        cue !== undefined && !cue.pocketed
          ? cueCandidates(targets, geometry, cue)
          : [];
    }
  }
  cands.push(fallbackCandidate(game, balls, geometry, config));
  cands.sort(
    (a, b) =>
      b.heuristic - a.heuristic ||
      a.targetBall - b.targetBall ||
      a.shot.angle - b.shot.angle,
  );
  return cands.slice(0, Math.max(1, cap));
};
