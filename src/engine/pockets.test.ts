import { describe, it, expect } from 'vitest';
import { capturingPocket } from './pockets';
import type { Ball, Pocket } from '../types/physics';

const pockets: readonly Pocket[] = [
  { position: { x: 0, y: 0 }, radius: 0.05 },
  { position: { x: 1, y: 0 }, radius: 0.05 },
];

const ballAt = (x: number, y: number): Ball => ({
  id: 1,
  position: { x, y },
  velocity: { x: 0, y: 0 },
  spin: { x: 0, y: 0 },
  radius: 0.028,
  pocketed: false,
});

describe('capturingPocket', () => {
  it('captures a ball whose center is within the capture radius', () => {
    expect(capturingPocket(ballAt(0.02, 0), pockets)).toBe(0);
    expect(capturingPocket(ballAt(1, 0.01), pockets)).toBe(1);
  });

  it('returns -1 when the ball is clear of every pocket', () => {
    expect(capturingPocket(ballAt(0.5, 0.5), pockets)).toBe(-1);
  });

  it('does not capture a ball just outside the radius', () => {
    expect(capturingPocket(ballAt(0.06, 0), pockets)).toBe(-1);
  });
});
