import { describe, it, expect } from 'vitest';
import {
  resolveBallCollision,
  reflect,
  sweptCircles,
  sweptCircleSegment,
} from './collision';
import type { Vec2 } from '../types/physics';

const momentum = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

describe('resolveBallCollision', () => {
  it('exchanges velocities in a head-on equal-mass elastic hit', () => {
    const [a, b] = resolveBallCollision(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      1,
    );
    expect(a.x).toBeCloseTo(0, 9);
    expect(a.y).toBeCloseTo(0, 9);
    expect(b.x).toBeCloseTo(1, 9);
    expect(b.y).toBeCloseTo(0, 9);
  });

  it('conserves momentum in a glancing collision', () => {
    const before = momentum({ x: 2, y: 1 }, { x: -1, y: 0.5 });
    const [a, b] = resolveBallCollision(
      { x: 0, y: 0 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: -1, y: 0.5 },
      1,
    );
    const after = momentum(a, b);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it('does not resolve balls that are separating', () => {
    const [a, b] = resolveBallCollision(
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      1,
    );
    expect(a).toEqual({ x: -1, y: 0 });
    expect(b).toEqual({ x: 1, y: 0 });
  });

  it('loses normal speed with restitution below one', () => {
    const [a, b] = resolveBallCollision(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      0.5,
    );
    // Approach speed 1 becomes separation speed 0.5.
    expect(b.x - a.x).toBeCloseTo(0.5, 9);
  });
});

describe('reflect', () => {
  it('reflects angle of incidence to angle of reflection', () => {
    // Wall along x-axis, outward normal +y; incoming down-right.
    const r = reflect({ x: 1, y: -1 }, { x: 0, y: 1 }, 1);
    expect(r.x).toBeCloseTo(1, 9);
    expect(r.y).toBeCloseTo(1, 9);
  });

  it('applies restitution to the normal component only', () => {
    const r = reflect({ x: 2, y: -3 }, { x: 0, y: 1 }, 0.8);
    expect(r.x).toBeCloseTo(2, 9); // tangential preserved
    expect(r.y).toBeCloseTo(2.4, 9); // 3 * 0.8
  });
});

describe('sweptCircles', () => {
  it('finds the time of impact for two approaching circles', () => {
    // Radii sum 1, closing at 1 m/s from 3 m apart -> contact at t = 2.
    const t = sweptCircles({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 0 }, 1, 10);
    expect(t).toBeCloseTo(2, 9);
  });

  it('returns null when circles separate', () => {
    const t = sweptCircles({ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 0 }, 1, 10);
    expect(t).toBeNull();
  });

  it('returns null when contact is beyond the window', () => {
    const t = sweptCircles({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, 1, 1);
    expect(t).toBeNull();
  });
});

describe('sweptCircleSegment', () => {
  it('detects a ball crossing a horizontal cushion', () => {
    // Cushion along y=0, ball above moving down, radius 0.5.
    const hit = sweptCircleSegment(
      { x: 1, y: 2 },
      { x: 0, y: -1 },
      0.5,
      { a: { x: 0, y: 0 }, b: { x: 2, y: 0 } },
      10,
    );
    expect(hit).not.toBeNull();
    expect(hit?.toi).toBeCloseTo(1.5, 9);
    expect(hit?.normal.y).toBeCloseTo(1, 9);
  });

  it('returns null when the contact falls outside the segment span', () => {
    const hit = sweptCircleSegment(
      { x: 5, y: 2 },
      { x: 0, y: -1 },
      0.5,
      { a: { x: 0, y: 0 }, b: { x: 2, y: 0 } },
      10,
    );
    expect(hit).toBeNull();
  });
});
