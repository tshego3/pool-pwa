// Pure aiming math, guide-line prediction, and ball-in-hand legality. This
// module is DOM-free (grep-checked): it works entirely in table-space and only
// imports the pure engine and types. The DOM/pointer wiring lives in
// src/game/input.ts; the screen converts pixels to table units via
// src/render/transform.ts before calling in here.

import type {
  PhysicsState,
  PhysicsConfig,
  PhysicsEvent,
  TableGeometry,
  Vec2,
  Ball,
} from '../types/physics';
import type {
  AimResult,
  AimConfig,
  GuideLine,
  GuideOptions,
  PlacementResult,
  PlacementOptions,
} from '../types/aiming';
import { step } from '../engine/step';
import { isMoving } from '../engine/friction';
import { normalize, distance } from '../engine/vec2';

// Interaction defaults. Half-speed steering gives roughly two finger-swings for
// a full turn of the cue; the radius guard is about two ball widths.
export const DEFAULT_AIM: AimConfig = {
  steerSensitivity: 0.5,
  minSteerRadius: 0.1,
};

export const DEFAULT_GUIDE: Required<GuideOptions> = {
  maxBounces: 0,
};

const MIN_GUIDE_POWER = 0.1;
const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

const findBall = (balls: readonly Ball[], id: number): Ball | undefined =>
  balls.find((b) => b.id === id);

// Wrap an angle into (-pi, pi] so the aim never drifts into large multiples of
// a turn as corrections accumulate.
const wrapAngle = (a: number): number => {
  const t = (a + Math.PI) % (2 * Math.PI);
  return (t < 0 ? t + 2 * Math.PI : t) - Math.PI;
};

// Steer an existing aim by a drag, relative. `from` is the pointer where the
// drag started and `to` where it is now; the aim turns by the angle those two
// sweep around the cue ball, scaled down by the sensitivity. The pointer is a
// steering wheel, not a target: pressing somewhere new never re-points the cue,
// it only decides where the correction is measured from.
export const steerAngle = (
  cue: Vec2,
  from: Vec2,
  to: Vec2,
  startAngle: number,
  cfg: AimConfig = DEFAULT_AIM,
): number => {
  const ax = from.x - cue.x;
  const ay = from.y - cue.y;
  const bx = to.x - cue.x;
  const by = to.y - cue.y;
  if (Math.hypot(ax, ay) < cfg.minSteerRadius) return wrapAngle(startAngle);
  if (Math.hypot(bx, by) < cfg.minSteerRadius) return wrapAngle(startAngle);
  const sweep = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
  return wrapAngle(startAngle + sweep * cfg.steerSensitivity);
};

// Clone just enough of the state to run a throwaway prediction without touching
// the caller's buffers. Mirrors the private clones in step.ts / simulate.ts.
const cloneState = (state: PhysicsState): PhysicsState => ({
  tick: state.tick,
  balls: state.balls.map((b) => ({
    id: b.id,
    position: { x: b.position.x, y: b.position.y },
    velocity: { x: b.velocity.x, y: b.velocity.y },
    spin: { x: b.spin.x, y: b.spin.y },
    radius: b.radius,
    pocketed: b.pocketed,
  })),
});

const cueEventThisTick = (
  events: readonly PhysicsEvent[],
  cueId: number,
): PhysicsEvent | undefined =>
  events.find(
    (e) =>
      (e.type === 'ball-ball' && (e.a === cueId || e.b === cueId)) ||
      (e.type === 'rail' && e.ball === cueId) ||
      (e.type === 'pocket' && e.ball === cueId),
  );

// Ghost-ball position: where the cue center sits when it just touches the object
// ball. Along the approach ray from P (cue center entering the contact tick) in
// direction d, it is the nearer intersection with the circle of radius (sum of
// radii) around the object center O. This is exact for a straight approach and
// so is correct for cut shots, not just full hits.
const ghostBall = (p: Vec2, d: Vec2, o: Vec2, sumR: number): Vec2 => {
  const mx = p.x - o.x;
  const my = p.y - o.y;
  const b = mx * d.x + my * d.y;
  const c = mx * mx + my * my - sumR * sumR;
  const disc = b * b - c;
  const t = disc >= 0 ? -b - Math.sqrt(disc) : -b;
  const tt = t > 0 ? t : 0;
  return { x: p.x + d.x * tt, y: p.y + d.y * tt };
};

// Build the guide contact from the tick that produced the cue's first ball-ball
// collision. The ghost position is geometric (exact contact point); the
// deflection directions are read straight from the engine's post-collision
// velocities so the guide matches what simulate() will actually do.
const contactFromHit = (
  before: PhysicsState,
  after: PhysicsState,
  cueId: number,
  otherId: number,
): GuideLine['contact'] => {
  const preCue = findBall(before.balls, cueId);
  const preObj = findBall(before.balls, otherId);
  const postCue = findBall(after.balls, cueId);
  const postObj = findBall(after.balls, otherId);
  if (!preCue || !preObj || !postCue || !postObj) return null;
  const approach = normalize(preCue.velocity);
  const ghost = ghostBall(preCue.position, approach, preObj.position, preCue.radius + preObj.radius);
  const impact = normalize({ x: preObj.position.x - ghost.x, y: preObj.position.y - ghost.y });
  const objVel = normalize(postObj.velocity);
  const objectDir = objVel.x === 0 && objVel.y === 0 ? impact : objVel;
  return { ball: otherId, ghost, cueDir: normalize(postCue.velocity), objectDir };
};

// Predict the cue ball's guide line for an aim using the real engine step, so it
// is deterministic and consistent with simulate(). The path stops at the cue's
// first ball contact (returning the ghost ball and deflection), or at the first
// rail / rest when it hits nothing. maxBounces lets the line follow cushions.
export const predictGuide = (
  state: PhysicsState,
  aim: AimResult,
  geo: TableGeometry,
  cfg: PhysicsConfig,
  opts: GuideOptions = {},
): GuideLine => {
  const maxBounces = opts.maxBounces ?? DEFAULT_GUIDE.maxBounces;
  let sim = cloneState(state);
  const cue = findBall(sim.balls, cfg.cueBallId);
  if (cue === undefined || cue.pocketed) return { cuePath: [], contact: null };

  const speed = clamp(Math.max(aim.power, MIN_GUIDE_POWER), 0, 1) * cfg.maxLaunchSpeed;
  cue.velocity.x = Math.cos(aim.angle) * speed;
  cue.velocity.y = Math.sin(aim.angle) * speed;

  const path: Vec2[] = [{ x: cue.position.x, y: cue.position.y }];
  let bounces = 0;
  for (let i = 0; i < cfg.maxSteps; i++) {
    const before = sim;
    const result = step(before, geo, cfg);
    sim = result.state;
    const ev = cueEventThisTick(result.events, cfg.cueBallId);
    const after = findBall(sim.balls, cfg.cueBallId);
    if (ev?.type === 'ball-ball') {
      const otherId = ev.a === cfg.cueBallId ? ev.b : ev.a;
      const contact = contactFromHit(before, sim, cfg.cueBallId, otherId);
      if (contact) path.push(contact.ghost);
      return { cuePath: path, contact };
    }
    if (after === undefined || ev?.type === 'pocket' || !isMoving(after, cfg)) {
      if (after !== undefined) path.push({ x: after.position.x, y: after.position.y });
      return { cuePath: path, contact: null };
    }
    if (ev?.type === 'rail') {
      path.push({ x: after.position.x, y: after.position.y });
      bounces += 1;
      if (bounces > maxBounces) return { cuePath: path, contact: null };
    }
  }
  return { cuePath: path, contact: null };
};

// Ball-in-hand legality: the placed ball must sit fully on the playing surface,
// clear of every other ball, and (when the kitchen rule applies) behind the head
// string. Pure over the state; the rules layer decides when each rule is active.
export const validateCuePlacement = (
  pos: Vec2,
  state: PhysicsState,
  geo: TableGeometry,
  opts: PlacementOptions = {},
): PlacementResult => {
  const r = geo.ballRadius;
  if (
    pos.x < r ||
    pos.y < r ||
    pos.x > geo.width - r ||
    pos.y > geo.height - r
  ) {
    return { legal: false, reason: 'out-of-bounds' };
  }
  if (opts.kitchenMaxX !== undefined && pos.x > opts.kitchenMaxX) {
    return { legal: false, reason: 'outside-kitchen' };
  }
  const selfId = opts.cueBallId ?? 0;
  for (const b of state.balls) {
    if (b.id === selfId || b.pocketed) continue;
    if (distance(pos, b.position) < b.radius + r) {
      return { legal: false, reason: 'overlap' };
    }
  }
  return { legal: true, reason: null };
};
