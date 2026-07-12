import { describe, it, expect } from 'vitest';
import {
  add,
  sub,
  scale,
  dot,
  cross,
  length,
  lengthSq,
  distance,
  normalize,
  perp,
  scaleAndAddMut,
  create,
} from './vec2';

describe('vec2 pure ops', () => {
  it('adds and subtracts componentwise', () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
    expect(sub({ x: 3, y: 4 }, { x: 1, y: 2 })).toEqual({ x: 2, y: 2 });
  });

  it('scales, dots and crosses', () => {
    expect(scale({ x: 2, y: -3 }, 2)).toEqual({ x: 4, y: -6 });
    expect(dot({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
    expect(cross({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1);
  });

  it('measures length and distance', () => {
    expect(length({ x: 3, y: 4 })).toBe(5);
    expect(lengthSq({ x: 3, y: 4 })).toBe(25);
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('normalizes to unit length and returns zero for the zero vector', () => {
    const n = normalize({ x: 0, y: 5 });
    expect(n.x).toBeCloseTo(0, 10);
    expect(n.y).toBeCloseTo(1, 10);
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('perp rotates 90 degrees', () => {
    const r = perp({ x: 1, y: 0 });
    expect(r.x).toBeCloseTo(0, 10);
    expect(r.y).toBeCloseTo(1, 10);
  });
});

describe('vec2 mutating ops', () => {
  it('scaleAndAddMut computes a + b*s into out', () => {
    const out = create();
    scaleAndAddMut(out, { x: 1, y: 1 }, { x: 2, y: 0 }, 3);
    expect(out).toEqual({ x: 7, y: 1 });
  });

  it('scaleAndAddMut may alias its first input', () => {
    const a = create(1, 1);
    scaleAndAddMut(a, a, { x: 0, y: 2 }, 0.5);
    expect(a).toEqual({ x: 1, y: 2 });
  });
});
