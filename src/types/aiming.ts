// Pure aiming and ball-in-hand types. Like src/types/physics.ts these are pure
// interfaces in table-space (meters); no pixels, no DOM. Screen-space lives only
// in src/render/transform.ts.

import type { Vec2 } from './physics';

// A resolved shot direction and strength derived from a pointer drag.
export interface AimResult {
  // Aim direction in radians, table-space, standard math convention.
  readonly angle: number;
  // Normalized strength in [0, 1]; scaled to a launch speed by PhysicsConfig.
  readonly power: number;
}

// How a pointer drag steers the aim. A drag never points the cue at the pointer;
// it corrects the existing angle by the amount the pointer swings around the cue
// ball, so a stray tap cannot throw the aim across the table.
export interface AimConfig {
  // Multiplier on the swept angle. Below 1 the aim turns slower than the finger,
  // which is what makes fine left/right correction possible.
  readonly steerSensitivity: number;
  // Drags inside this radius of the cue ball (table units) are ignored: that
  // close, a pixel of movement sweeps a huge angle.
  readonly minSteerRadius: number;
}

// The predicted deflection at the cue ball's first ball-to-ball contact.
export interface GuideContact {
  // Object ball struck first.
  readonly ball: number;
  // Cue-ball center at the moment of contact (the ghost-ball position).
  readonly ghost: Vec2;
  // Unit direction the cue ball deflects after contact.
  readonly cueDir: Vec2;
  // Unit direction the struck object ball travels after contact.
  readonly objectDir: Vec2;
  // Where the cue ball goes after contact: the ghost position followed by the
  // point it stops, pockets, or first hits something. Empty when it stays put
  // (a full hit kills the cue ball's speed).
  readonly cueAfter: readonly Vec2[];
  // Where the struck object ball goes, from its center at contact to the same
  // kind of terminal point.
  readonly objectAfter: readonly Vec2[];
}

// Guide-line prediction: the cue ball's path up to its first contact (or the
// first rail / rest), plus the deflection at that contact when there is one.
export interface GuideLine {
  // Cue-ball center positions: the launch point followed by each vertex where
  // the path changes (a rail bounce) and the terminal point (ghost / rail /
  // stop). A straight run between vertices is implied.
  readonly cuePath: readonly Vec2[];
  readonly contact: GuideContact | null;
}

// Options controlling how far the guide line is predicted.
export interface GuideOptions {
  // Number of cushion bounces the cue path may follow before stopping. Default 0
  // (the line stops at the first rail or ball).
  readonly maxBounces?: number;
  // Tick cap on how far the post-contact prediction follows the cue and object
  // balls. Each ball stops earlier if it rests, pockets, or hits something.
  readonly afterContactSteps?: number;
}

// Why a ball-in-hand placement was rejected.
export type PlacementRejection = 'out-of-bounds' | 'overlap' | 'outside-kitchen';

export interface PlacementResult {
  readonly legal: boolean;
  readonly reason: PlacementRejection | null;
}

// Constraints applied to a ball-in-hand placement.
export interface PlacementOptions {
  // Ball id being placed (skipped in the overlap check). Defaults to the cue.
  readonly cueBallId?: number;
  // When set, the placement must lie behind the head string (kitchen rule after
  // a break scratch): position.x must not exceed this value.
  readonly kitchenMaxX?: number;
}
