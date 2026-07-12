import { describe, it, expect } from 'vitest';
import { simulate } from './simulate';
import { DEFAULT_PHYSICS } from './config';
import { createEightBallTable, rackEightBall } from './tables/eightBall';
import { createPrng } from './prng';
import { runScenario } from './__fixtures__/runScenario';
import { breakShotScenario } from './__fixtures__/breakShot';
import type { Ball, PhysicsState, ShotInput } from '../types/physics';

const table = createEightBallTable();

const freshRack = (): PhysicsState => ({ tick: 0, balls: rackEightBall() });

const anyMoving = (balls: readonly Ball[]): boolean =>
  balls.some(
    (b) =>
      !b.pocketed &&
      Math.hypot(b.velocity.x, b.velocity.y) > DEFAULT_PHYSICS.stopVelocity,
  );

describe('simulate determinism', () => {
  it('produces identical event logs and final positions for the same input', () => {
    const shot: ShotInput = { angle: 0.02, power: 0.9 };
    const a = simulate(freshRack(), shot, table, DEFAULT_PHYSICS);
    const b = simulate(freshRack(), shot, table, DEFAULT_PHYSICS);
    expect(a.events).toEqual(b.events);
    expect(a.finalState.balls).toEqual(b.finalState.balls);
  });

  it('replays a fixture scenario identically twice', () => {
    const run1 = runScenario(breakShotScenario);
    const run2 = runScenario(breakShotScenario);
    expect(run1.events).toEqual(run2.events);
    expect(run1.finalState).toEqual(run2.finalState);
  });
});

describe('simulate termination', () => {
  it('reaches rest and ends with a rest event for seeded random shots', () => {
    const prng = createPrng(2026);
    for (let i = 0; i < 12; i++) {
      const shot: ShotInput = {
        angle: prng.range(0, Math.PI * 2),
        power: prng.range(0.2, 1),
      };
      const result = simulate(freshRack(), shot, table, DEFAULT_PHYSICS);
      const last = result.events[result.events.length - 1];
      expect(last?.type).toBe('rest');
      expect(anyMoving(result.finalState.balls)).toBe(false);
    }
  });
});

describe('simulate contact events', () => {
  it('emits a first-contact for the cue ball before its first ball-ball hit', () => {
    const result = simulate(freshRack(), { angle: 0, power: 1 }, table, DEFAULT_PHYSICS);
    const firstBallBall = result.events.findIndex((e) => e.type === 'ball-ball');
    const firstContact = result.events.findIndex((e) => e.type === 'first-contact');
    expect(firstContact).toBeGreaterThanOrEqual(0);
    expect(firstContact).toBeLessThan(firstBallBall);
    const ev = result.events[firstContact];
    expect(ev?.type === 'first-contact' && ev.ball).toBe(DEFAULT_PHYSICS.cueBallId);
  });
});

describe('tunneling regression', () => {
  const fastConfig = { ...DEFAULT_PHYSICS, maxLaunchSpeed: 1500 };

  it('never passes a cue ball through a target ball at extreme velocity', () => {
    const target: Ball = {
      id: 1,
      position: { x: 1.2, y: 0.495 },
      velocity: { x: 0, y: 0 },
      spin: { x: 0, y: 0 },
      radius: table.ballRadius,
      pocketed: false,
    };
    const cue: Ball = {
      id: 0,
      position: { x: 0.3, y: 0.495 },
      velocity: { x: 0, y: 0 },
      spin: { x: 0, y: 0 },
      radius: table.ballRadius,
      pocketed: false,
    };
    const state: PhysicsState = { tick: 0, balls: [cue, target] };
    const result = simulate(state, { angle: 0, power: 1 }, table, fastConfig);
    const contacted = result.events.some(
      (e) => e.type === 'ball-ball' || e.type === 'first-contact',
    );
    expect(contacted).toBe(true);
    // The target must have been driven forward, not skipped over.
    const finalTarget = result.finalState.balls.find((b) => b.id === 1);
    const movedOrPocketed =
      finalTarget !== undefined && (finalTarget.pocketed || finalTarget.position.x > 1.2 + 1e-6);
    expect(movedOrPocketed).toBe(true);
  });

  it('never passes a ball through a cushion at extreme velocity', () => {
    const cue: Ball = {
      id: 0,
      position: { x: 0.3, y: 0.495 },
      velocity: { x: 0, y: 0 },
      spin: { x: 0, y: 0 },
      radius: table.ballRadius,
      pocketed: false,
    };
    const state: PhysicsState = { tick: 0, balls: [cue] };
    const result = simulate(state, { angle: 0, power: 1 }, table, fastConfig);
    const cushionHit = result.events.some((e) => e.type === 'rail' || e.type === 'pocket');
    expect(cushionHit).toBe(true);
    const finalCue = result.finalState.balls.find((b) => b.id === 0);
    // Cue stays within the table bounds (or was pocketed), never beyond a rail.
    const contained =
      finalCue !== undefined &&
      (finalCue.pocketed ||
        (finalCue.position.x >= -1e-6 && finalCue.position.x <= table.width + 1e-6));
    expect(contained).toBe(true);
  });
});
