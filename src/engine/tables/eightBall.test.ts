import { describe, it, expect } from 'vitest';
import { createEightBallTable, rackEightBall } from './eightBall';

describe('createEightBallTable', () => {
  it('describes a 2:1 table with six pockets and six cushions', () => {
    const t = createEightBallTable();
    expect(t.width / t.height).toBeCloseTo(2, 9);
    expect(t.pockets).toHaveLength(6);
    expect(t.cushions).toHaveLength(6);
    expect(t.ballRadius).toBeGreaterThan(0);
  });
});

describe('rackEightBall', () => {
  const balls = rackEightBall();
  const table = createEightBallTable();

  it('racks the cue ball plus fifteen object balls', () => {
    expect(balls).toHaveLength(16);
    expect(balls[0]?.id).toBe(0);
    const ids = balls.map((b) => b.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it('places the 8-ball at the centre of the rack', () => {
    const eight = balls.find((b) => b.id === 8);
    expect(eight?.position.y).toBeCloseTo(table.height / 2, 9);
    expect(eight?.position.x).toBeGreaterThan(table.width / 2);
  });

  it('keeps every ball inside the cushions and at rest', () => {
    for (const b of balls) {
      expect(b.position.x).toBeGreaterThan(b.radius);
      expect(b.position.x).toBeLessThan(table.width - b.radius);
      expect(b.position.y).toBeGreaterThan(b.radius);
      expect(b.position.y).toBeLessThan(table.height - b.radius);
      expect(b.velocity).toEqual({ x: 0, y: 0 });
      expect(b.pocketed).toBe(false);
    }
  });

  it('does not overlap any two balls', () => {
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i];
        const b = balls[j];
        if (a === undefined || b === undefined) continue;
        const d = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
        expect(d).toBeGreaterThanOrEqual(a.radius + b.radius - 1e-9);
      }
    }
  });
});
