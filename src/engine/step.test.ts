import { describe, it, expect } from 'vitest';
import { step } from './step';
import { DEFAULT_PHYSICS } from './config';
import type { Ball, PhysicsState, TableGeometry } from '../types/physics';

const R = 0.028575;

// A bare 1 x 1 table with four rails and no pockets, for controlled tests.
const plainTable: TableGeometry = {
  width: 1,
  height: 1,
  ballRadius: R,
  cushions: [
    { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
    { a: { x: 0, y: 1 }, b: { x: 1, y: 1 } },
    { a: { x: 0, y: 0 }, b: { x: 0, y: 1 } },
    { a: { x: 1, y: 0 }, b: { x: 1, y: 1 } },
  ],
  pockets: [],
};

const ball = (id: number, x: number, y: number, vx: number, vy: number): Ball => ({
  id,
  position: { x, y },
  velocity: { x: vx, y: vy },
  spin: { x: 0, y: 0 },
  radius: R,
  pocketed: false,
});

describe('step', () => {
  it('is pure: it does not mutate the input state', () => {
    const state: PhysicsState = { tick: 5, balls: [ball(0, 0.5, 0.5, 1, 0)] };
    step(state, plainTable, DEFAULT_PHYSICS);
    expect(state.tick).toBe(5);
    expect(state.balls[0]?.position).toEqual({ x: 0.5, y: 0.5 });
    expect(state.balls[0]?.velocity).toEqual({ x: 1, y: 0 });
  });

  it('advances a moving ball and increments the tick', () => {
    const state: PhysicsState = { tick: 0, balls: [ball(0, 0.5, 0.5, 1, 0)] };
    const { state: next } = step(state, plainTable, DEFAULT_PHYSICS);
    expect(next.tick).toBe(1);
    expect(next.balls[0]?.position.x).toBeGreaterThan(0.5);
  });

  it('emits a rail event and reflects a ball hitting a cushion in one tick', () => {
    // Ball a hair from the right wall, moving fast into it.
    const state: PhysicsState = { tick: 0, balls: [ball(0, 1 - R - 0.001, 0.5, 5, 0)] };
    const { state: next, events } = step(state, plainTable, DEFAULT_PHYSICS);
    expect(events.some((e) => e.type === 'rail')).toBe(true);
    expect(next.balls[0]?.velocity.x).toBeLessThan(0);
  });
});
