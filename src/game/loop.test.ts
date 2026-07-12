import { describe, it, expect } from 'vitest';
import { createLoop, planSteps, FIXED_DT } from './loop';

describe('planSteps accumulator', () => {
  it('runs whole steps and keeps a sub-dt remainder', () => {
    const plan = planSteps(FIXED_DT * 2.5, FIXED_DT, 8);
    expect(plan.steps).toBe(2);
    expect(plan.accumulator).toBeCloseTo(FIXED_DT * 0.5, 12);
  });

  it('runs nothing when under one step of time', () => {
    const plan = planSteps(FIXED_DT * 0.3, FIXED_DT, 8);
    expect(plan.steps).toBe(0);
    expect(plan.accumulator).toBeCloseTo(FIXED_DT * 0.3, 12);
  });

  it('caps steps and discards backlog on a huge delta (spiral guard)', () => {
    // 10 seconds of backlog at 120 Hz would be 1200 steps without a cap.
    const plan = planSteps(10, FIXED_DT, 8);
    expect(plan.steps).toBe(8);
    // Leftover must be a valid interpolation remainder, not a fast-forward.
    expect(plan.accumulator).toBeGreaterThanOrEqual(0);
    expect(plan.accumulator).toBeLessThan(FIXED_DT);
  });
});

describe('createLoop timing', () => {
  it('advances the right number of fixed steps for elapsed time', () => {
    const ref: { cb: ((t: number) => void) | null } = { cb: null };
    let steps = 0;
    let lastAlpha = -1;
    const loop = createLoop({
      onStep: () => {
        steps += 1;
      },
      onRender: (alpha) => {
        lastAlpha = alpha;
      },
      requestFrame: (cb) => {
        ref.cb = cb;
        return 1;
      },
      cancelFrame: () => {},
    });

    loop.start();
    expect(loop.isRunning()).toBe(true);
    // First frame establishes the baseline clock (no elapsed time yet).
    ref.cb?.(0);
    expect(steps).toBe(0);
    // 25 ms later: 3 fixed steps of 1/120 s (~8.33 ms each).
    ref.cb?.(25);
    expect(steps).toBe(3);
    expect(lastAlpha).toBeGreaterThanOrEqual(0);
    expect(lastAlpha).toBeLessThan(1);

    loop.stop();
    expect(loop.isRunning()).toBe(false);
  });

  it('does not fast-forward physics after a long stall', () => {
    const ref: { cb: ((t: number) => void) | null } = { cb: null };
    let steps = 0;
    const loop = createLoop({
      onStep: () => {
        steps += 1;
      },
      onRender: () => {},
      requestFrame: (cb) => {
        ref.cb = cb;
        return 1;
      },
      cancelFrame: () => {},
      maxStepsPerFrame: 8,
    });
    loop.start();
    ref.cb?.(0);
    // Tab was backgrounded for 30 s, then one frame fires.
    ref.cb?.(30_000);
    expect(steps).toBe(8);
  });
});
