// The only vector-math module. Pure variants allocate a fresh Vec2 (used in
// tests and cold paths); mutating variants write into an `out` target and
// return it (used in the 120 Hz hot path to avoid per-tick allocation).

import type { Vec2 } from '../types/physics';

export const create = (x = 0, y = 0): Vec2 => ({ x, y });

export const clone = (v: Vec2): Vec2 => ({ x: v.x, y: v.y });

// Pure variants.

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

// 2D scalar cross product (z component of the 3D cross).
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

export const lengthSq = (v: Vec2): number => v.x * v.x + v.y * v.y;

export const length = (v: Vec2): number => Math.sqrt(v.x * v.x + v.y * v.y);

export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export const normalize = (v: Vec2): Vec2 => {
  const len = length(v);
  return len > 0 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
};

// Left-hand perpendicular (rotate +90 degrees).
export const perp = (v: Vec2): Vec2 => ({ x: -v.y, y: v.x });

// Mutating variants: `out` may alias any input.

export const setMut = (out: Vec2, x: number, y: number): Vec2 => {
  out.x = x;
  out.y = y;
  return out;
};

export const copyMut = (out: Vec2, a: Vec2): Vec2 => {
  out.x = a.x;
  out.y = a.y;
  return out;
};

export const scaleMut = (out: Vec2, a: Vec2, s: number): Vec2 => {
  out.x = a.x * s;
  out.y = a.y * s;
  return out;
};

// out = a + b * s (fused scale-add, the integrator's workhorse).
export const scaleAndAddMut = (out: Vec2, a: Vec2, b: Vec2, s: number): Vec2 => {
  out.x = a.x + b.x * s;
  out.y = a.y + b.y * s;
  return out;
};
