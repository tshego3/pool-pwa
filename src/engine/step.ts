// Pure fixed-timestep integrator: step(state) advances the simulation by one
// 1/120 s tick and returns the new state plus any events produced this tick.
// It reads no clock and never renders. Within a tick it adaptively substeps
// (when displacement exceeds a quarter ball radius) and, within each substep,
// resolves collisions in earliest-time-of-impact order using swept-circle
// continuous detection so fast balls cannot tunnel.

import type {
  Ball,
  PhysicsState,
  PhysicsConfig,
  PhysicsEvent,
  TableGeometry,
} from '../types/physics';
import {
  resolveBallCollision,
  reflect,
  sweptCircles,
  sweptCircleSegment,
} from './collision';
import { applyFriction } from './friction';
import { capturingPocket } from './pockets';

const EPSILON = 1e-9;

export interface StepResult {
  readonly state: PhysicsState;
  readonly events: PhysicsEvent[];
}

interface BallHit {
  readonly toi: number;
  readonly kind: 'ball' | 'cushion';
  readonly i: number;
  readonly j: number;
  readonly normal: { readonly x: number; readonly y: number };
}

const cloneBall = (b: Ball): Ball => ({
  id: b.id,
  position: { x: b.position.x, y: b.position.y },
  velocity: { x: b.velocity.x, y: b.velocity.y },
  spin: { x: b.spin.x, y: b.spin.y },
  radius: b.radius,
  pocketed: b.pocketed,
});

const isActive = (b: Ball): boolean =>
  !b.pocketed && (b.velocity.x !== 0 || b.velocity.y !== 0);

// Number of substeps so no ball moves more than a quarter radius per substep.
const computeSubsteps = (balls: readonly Ball[], dt: number, cfg: PhysicsConfig): number => {
  let maxDisp = 0;
  for (const b of balls) {
    if (b.pocketed) continue;
    const disp = Math.hypot(b.velocity.x, b.velocity.y) * dt;
    if (disp > maxDisp) maxDisp = disp;
  }
  const quarter = balls[0] ? balls[0].radius / 4 : dt;
  if (maxDisp <= quarter || quarter <= 0) return 1;
  return Math.min(Math.ceil(maxDisp / quarter), cfg.maxSubsteps);
};

const integrate = (balls: readonly Ball[], t: number, geo: TableGeometry): void => {
  for (const b of balls) {
    if (b.pocketed) continue;
    b.position.x += b.velocity.x * t;
    b.position.y += b.velocity.y * t;

    // Clamp to table bounds to prevent balls from escaping
    b.position.x = Math.max(b.radius, Math.min(geo.width - b.radius, b.position.x));
    b.position.y = Math.max(b.radius, Math.min(geo.height - b.radius, b.position.y));
  }
};

// Earliest collision (ball-ball or ball-cushion) within [0, maxT], or null.
// Iteration order is fixed and ties keep the first found, so this is
// deterministic.
const findEarliestCollision = (
  balls: readonly Ball[],
  geo: TableGeometry,
  maxT: number,
): BallHit | null => {
  let best: BallHit | null = null;
  const limit = (): number => (best ? best.toi : maxT);
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (a === undefined || a.pocketed) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (b === undefined || b.pocketed) continue;
      if (!isActive(a) && !isActive(b)) continue;
      const t = sweptCircles(a.position, a.velocity, b.position, b.velocity, a.radius + b.radius, limit());
      if (t !== null && t < limit()) best = { toi: t, kind: 'ball', i, j, normal: { x: 0, y: 0 } };
    }
    if (!isActive(a)) continue;
    for (let c = 0; c < geo.cushions.length; c++) {
      const seg = geo.cushions[c];
      if (seg === undefined) continue;
      const hit = sweptCircleSegment(a.position, a.velocity, a.radius, seg, limit());
      if (hit !== null && hit.toi < limit()) best = { toi: hit.toi, kind: 'cushion', i, j: c, normal: hit.normal };
    }
  }
  return best;
};

const resolveHit = (
  balls: readonly Ball[],
  cfg: PhysicsConfig,
  hit: BallHit,
  tick: number,
  events: PhysicsEvent[],
): void => {
  const a = balls[hit.i];
  if (a === undefined) return;
  if (hit.kind === 'cushion') {
    const r = reflect(a.velocity, hit.normal, cfg.cushionRestitution);
    a.velocity.x = r.x;
    a.velocity.y = r.y;
    events.push({ type: 'rail', tick, ball: a.id, cushion: hit.j });
    return;
  }
  const b = balls[hit.j];
  if (b === undefined) return;
  const [va, vb] = resolveBallCollision(a.position, a.velocity, b.position, b.velocity, cfg.ballRestitution);
  a.velocity.x = va.x;
  a.velocity.y = va.y;
  b.velocity.x = vb.x;
  b.velocity.y = vb.y;
  events.push({ type: 'ball-ball', tick, a: a.id, b: b.id });
};

const advanceSubstep = (
  balls: readonly Ball[],
  geo: TableGeometry,
  cfg: PhysicsConfig,
  dt: number,
  tick: number,
  events: PhysicsEvent[],
): void => {
  let remaining = dt;
  const maxIters = balls.length * 4 + geo.cushions.length + 8;
  let guard = 0;
  while (remaining > EPSILON && guard < maxIters) {
    guard++;
    const hit = findEarliestCollision(balls, geo, remaining);
    if (hit === null) {
      integrate(balls, remaining, geo);
      return;
    }
    integrate(balls, hit.toi, geo);
    resolveHit(balls, cfg, hit, tick, events);
    remaining -= hit.toi;
  }
  if (remaining > EPSILON) integrate(balls, remaining, geo);
};

const capturePockets = (
  balls: readonly Ball[],
  geo: TableGeometry,
  tick: number,
  events: PhysicsEvent[],
): void => {
  for (const b of balls) {
    if (b.pocketed) continue;
    const pocket = capturingPocket(b, geo.pockets);
    if (pocket < 0) continue;
    b.pocketed = true;
    b.velocity.x = 0;
    b.velocity.y = 0;
    events.push({ type: 'pocket', tick, ball: b.id, pocket });
  }
};

export const step = (
  state: PhysicsState,
  geo: TableGeometry,
  cfg: PhysicsConfig,
): StepResult => {
  const balls = state.balls.map(cloneBall);
  const tick = state.tick + 1;
  const events: PhysicsEvent[] = [];
  const substeps = computeSubsteps(balls, cfg.dt, cfg);
  const subDt = cfg.dt / substeps;
  for (let s = 0; s < substeps; s++) {
    advanceSubstep(balls, geo, cfg, subDt, tick, events);
    for (const b of balls) {
      if (!b.pocketed) applyFriction(b, subDt, cfg);
    }
    capturePockets(balls, geo, tick, events);
  }
  return { state: { balls, tick }, events };
};
