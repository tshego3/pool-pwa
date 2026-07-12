// Ball-ball elastic collision and cushion reflection, plus swept-circle
// continuous detection (time-of-impact) to prevent tunneling. All motion here
// is treated as linear over the query interval; the step loop keeps velocity
// constant within a substep and applies friction between substeps.

import type { Vec2, CushionSegment } from '../types/physics';
import { dot, sub, normalize, perp } from './vec2';

const EPSILON = 1e-9;

// Equal-mass elastic collision with restitution `e`, resolved along the line of
// centers. Tangential components are preserved. Returns the two new velocities.
// Assumes the balls are in contact and `na -> nb` is meaningful (non-coincident).
export const resolveBallCollision = (
  posA: Vec2,
  velA: Vec2,
  posB: Vec2,
  velB: Vec2,
  e: number,
): readonly [Vec2, Vec2] => {
  const n = normalize(sub(posB, posA));
  const vaN = dot(velA, n);
  const vbN = dot(velB, n);
  // Only resolve when the balls are approaching along the normal.
  if (vaN - vbN <= 0) {
    return [{ x: velA.x, y: velA.y }, { x: velB.x, y: velB.y }];
  }
  // Closed form for equal masses: swap the normal components, damped by e.
  const newAN = ((1 - e) / 2) * vaN + ((1 + e) / 2) * vbN;
  const newBN = ((1 + e) / 2) * vaN + ((1 - e) / 2) * vbN;
  const dA = newAN - vaN;
  const dB = newBN - vbN;
  return [
    { x: velA.x + n.x * dA, y: velA.y + n.y * dA },
    { x: velB.x + n.x * dB, y: velB.y + n.y * dB },
  ];
};

// Reflect an incoming velocity about a unit normal `n` (pointing away from the
// wall, toward the ball), damped by restitution `e`.
export const reflect = (vel: Vec2, n: Vec2, e: number): Vec2 => {
  const vn = dot(vel, n);
  return { x: vel.x - (1 + e) * vn * n.x, y: vel.y - (1 + e) * vn * n.y };
};

// Time of impact of two circles moving at constant velocity, sum of radii `r`,
// within [0, maxT]. Returns the earliest contact time or null. Returns 0 if
// they already overlap and are approaching.
export const sweptCircles = (
  posA: Vec2,
  velA: Vec2,
  posB: Vec2,
  velB: Vec2,
  r: number,
  maxT: number,
): number | null => {
  const rpx = posA.x - posB.x;
  const rpy = posA.y - posB.y;
  const rvx = velA.x - velB.x;
  const rvy = velA.y - velB.y;
  const a = rvx * rvx + rvy * rvy;
  const b = 2 * (rpx * rvx + rpy * rvy);
  const c = rpx * rpx + rpy * rpy - r * r;
  if (b >= 0) return null; // separating or parallel: no future contact
  if (c <= 0) return 0; // already overlapping and approaching
  if (a < EPSILON) return null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= maxT ? t : null;
};

export interface SegmentHit {
  readonly toi: number;
  // Unit normal pointing from the wall toward the ball at impact.
  readonly normal: Vec2;
}

// Time of impact of a moving circle (center `p`, velocity `v`, radius `radius`)
// against a static cushion segment, within [0, maxT]. Solves against the
// infinite line then validates the contact projects onto the segment span.
// Endpoint (pocket-jaw) contacts are intentionally left to the pocket capture
// logic. Returns the hit with its outward normal, or null.
export const sweptCircleSegment = (
  p: Vec2,
  v: Vec2,
  radius: number,
  seg: CushionSegment,
  maxT: number,
): SegmentHit | null => {
  const edge = sub(seg.b, seg.a);
  const len = Math.hypot(edge.x, edge.y);
  if (len < EPSILON) return null;
  const dir = { x: edge.x / len, y: edge.y / len };
  const nrm = normalize(perp(dir));
  const sd0 = (p.x - seg.a.x) * nrm.x + (p.y - seg.a.y) * nrm.y;
  const vn = v.x * nrm.x + v.y * nrm.y;
  if (Math.abs(vn) < EPSILON) return null;
  const side = sd0 >= 0 ? 1 : -1;
  // Ball must be closing on the wall from its current side.
  if (vn * side >= 0) return null;
  const t = (side * radius - sd0) / vn;
  if (t < 0 || t > maxT) return null;
  const cx = p.x + v.x * t;
  const cy = p.y + v.y * t;
  const proj = (cx - seg.a.x) * dir.x + (cy - seg.a.y) * dir.y;
  if (proj < 0 || proj > len) return null;
  return { toi: t, normal: { x: nrm.x * side, y: nrm.y * side } };
};
