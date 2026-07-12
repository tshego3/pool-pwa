// Run a whole shot to rest by repeatedly calling the pure step(). This is the
// single deterministic simulator the bot also uses to look ahead; it is never a
// separate approximation. The step count is hard-capped as a spiral-of-death
// guard.

import type {
  Ball,
  PhysicsState,
  PhysicsConfig,
  PhysicsEvent,
  ShotInput,
  TableGeometry,
} from '../types/physics';
import { step } from './step';
import { isMoving } from './friction';

export interface SimulateResult {
  readonly finalState: PhysicsState;
  readonly events: readonly PhysicsEvent[];
}

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

const findBall = (balls: readonly Ball[], id: number): Ball | undefined =>
  balls.find((b) => b.id === id);

// Set the cue ball in motion from the shot, honoring an optional ball-in-hand
// reposition. Mutates the provided (already cloned) state.
const applyShot = (state: PhysicsState, shot: ShotInput, cfg: PhysicsConfig): void => {
  const cue = findBall(state.balls, cfg.cueBallId);
  if (cue === undefined) return;
  if (shot.cuePlacement !== undefined) {
    cue.position.x = shot.cuePlacement.x;
    cue.position.y = shot.cuePlacement.y;
    cue.pocketed = false;
  }
  const speed = Math.max(0, Math.min(1, shot.power)) * cfg.maxLaunchSpeed;
  cue.velocity.x = Math.cos(shot.angle) * speed;
  cue.velocity.y = Math.sin(shot.angle) * speed;
};

const anyMoving = (state: PhysicsState, cfg: PhysicsConfig): boolean =>
  state.balls.some((b) => isMoving(b, cfg));

// Insert a first-contact event immediately before the cue ball's first
// ball-to-ball collision, mirroring its tick. Pure over the collected log.
const withFirstContact = (
  events: readonly PhysicsEvent[],
  cueBallId: number,
): PhysicsEvent[] => {
  const out: PhysicsEvent[] = [];
  let inserted = false;
  for (const ev of events) {
    if (!inserted && ev.type === 'ball-ball' && (ev.a === cueBallId || ev.b === cueBallId)) {
      const other = ev.a === cueBallId ? ev.b : ev.a;
      out.push({ type: 'first-contact', tick: ev.tick, ball: cueBallId, other });
      inserted = true;
    }
    out.push(ev);
  }
  return out;
};

export const simulate = (
  initial: PhysicsState,
  shot: ShotInput,
  geo: TableGeometry,
  cfg: PhysicsConfig,
): SimulateResult => {
  let state = cloneState(initial);
  applyShot(state, shot, cfg);
  const events: PhysicsEvent[] = [];
  let steps = 0;
  while (anyMoving(state, cfg) && steps < cfg.maxSteps) {
    const result = step(state, geo, cfg);
    state = result.state;
    for (const ev of result.events) events.push(ev);
    steps++;
  }
  const log = withFirstContact(events, cfg.cueBallId);
  log.push({ type: 'rest', tick: state.tick });
  return { finalState: state, events: log };
};
