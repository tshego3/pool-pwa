// Pure physics domain types. All values are in table-space:
// a right-handed 2D system in meters. The engine knows nothing about pixels.
// Origin is the top-left corner of the playing surface; +x runs along the long
// rail, +y along the short rail.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Ball {
  readonly id: number;
  position: Vec2;
  velocity: Vec2;
  // Spin is a placeholder for a future english/swerve model. Not yet integrated.
  spin: Vec2;
  radius: number;
  pocketed: boolean;
}

// A straight cushion segment from `a` to `b`. Balls reflect off it. The outward
// face (toward the playing surface) is derived from the ball's approach side.
export interface CushionSegment {
  readonly a: Vec2;
  readonly b: Vec2;
}

export interface Pocket {
  readonly position: Vec2;
  // Capture radius: a ball whose center falls within this radius is pocketed.
  readonly radius: number;
}

export interface TableGeometry {
  readonly width: number;
  readonly height: number;
  readonly ballRadius: number;
  readonly cushions: readonly CushionSegment[];
  readonly pockets: readonly Pocket[];
}

export interface ShotInput {
  // Aim direction in radians (table-space, standard math convention).
  readonly angle: number;
  // Normalized shot strength in [0, 1]; scaled to a launch speed by config.
  readonly power: number;
  // Optional cue-ball reposition (ball-in-hand). When present the cue ball is
  // moved here before the shot is applied.
  readonly cuePlacement?: Vec2;
}

// Ordered log emitted by the engine and consumed by the rules reducer.
// `tick` is the fixed-timestep index at which the event occurred.
export type PhysicsEvent =
  | { readonly type: 'first-contact'; readonly tick: number; readonly ball: number; readonly other: number }
  | { readonly type: 'ball-ball'; readonly tick: number; readonly a: number; readonly b: number }
  | { readonly type: 'rail'; readonly tick: number; readonly ball: number; readonly cushion: number }
  | { readonly type: 'pocket'; readonly tick: number; readonly ball: number; readonly pocket: number }
  | { readonly type: 'rest'; readonly tick: number };

// Mutable simulation snapshot. `tick` counts fixed 1/120 s steps since the
// shot began.
export interface PhysicsState {
  balls: Ball[];
  tick: number;
}

// All tunable engine constants. Passed in explicitly so the engine stays pure
// and deterministic; see src/engine/config.ts for the defaults.
export interface PhysicsConfig {
  readonly dt: number;
  readonly ballRestitution: number;
  readonly cushionRestitution: number;
  // Deceleration (m/s^2) while a ball is sliding fast.
  readonly slidingDecel: number;
  // Deceleration (m/s^2) once a ball has settled into a roll.
  readonly rollingDecel: number;
  // Speed (m/s) above which the sliding deceleration applies.
  readonly slidingThreshold: number;
  // Speed (m/s) at or below which a ball is snapped to rest.
  readonly stopVelocity: number;
  // Launch speed (m/s) at power === 1.
  readonly maxLaunchSpeed: number;
  // Hard cap on fixed steps per shot (spiral-of-death guard).
  readonly maxSteps: number;
  // Hard cap on substeps per fixed step (continuous-collision guard).
  readonly maxSubsteps: number;
  readonly cueBallId: number;
}
