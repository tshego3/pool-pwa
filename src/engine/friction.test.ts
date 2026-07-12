import { describe, it, expect } from 'vitest';
import { applyFriction, isMoving } from './friction';
import { DEFAULT_PHYSICS } from './config';
import type { Ball } from '../types/physics';

const makeBall = (vx: number, vy: number): Ball => ({
  id: 0,
  position: { x: 0, y: 0 },
  velocity: { x: vx, y: vy },
  spin: { x: 0, y: 0 },
  radius: 0.028,
  pocketed: false,
});

describe('applyFriction', () => {
  it('decelerates a moving ball without reversing its direction', () => {
    const ball = makeBall(2, 0);
    const moving = applyFriction(ball, DEFAULT_PHYSICS.dt, DEFAULT_PHYSICS);
    expect(moving).toBe(true);
    expect(ball.velocity.x).toBeLessThan(2);
    expect(ball.velocity.x).toBeGreaterThan(0);
    expect(ball.velocity.y).toBe(0);
  });

  it('preserves the direction of travel', () => {
    const ball = makeBall(1, 1);
    applyFriction(ball, DEFAULT_PHYSICS.dt, DEFAULT_PHYSICS);
    expect(ball.velocity.x).toBeCloseTo(ball.velocity.y, 9);
  });

  it('snaps a near-stationary ball to rest', () => {
    const ball = makeBall(DEFAULT_PHYSICS.stopVelocity / 2, 0);
    const moving = applyFriction(ball, DEFAULT_PHYSICS.dt, DEFAULT_PHYSICS);
    expect(moving).toBe(false);
    expect(ball.velocity).toEqual({ x: 0, y: 0 });
  });

  it('always brings a ball to rest within a bounded number of ticks', () => {
    const ball = makeBall(6, 0);
    let ticks = 0;
    while (applyFriction(ball, DEFAULT_PHYSICS.dt, DEFAULT_PHYSICS)) {
      ticks++;
      expect(ticks).toBeLessThan(DEFAULT_PHYSICS.maxSteps);
    }
    expect(isMoving(ball, DEFAULT_PHYSICS)).toBe(false);
  });
});
