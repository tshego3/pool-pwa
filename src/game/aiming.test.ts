import { describe, it, expect } from 'vitest';
import aimingSource from './aiming.ts?raw';
import { aimFromPointer, predictGuide, validateCuePlacement, DEFAULT_AIM } from './aiming';
import { simulate } from '../engine/simulate';
import { DEFAULT_PHYSICS } from '../engine/config';
import { createEightBallTable, rackEightBall } from '../engine/tables/eightBall';
import type { Ball, PhysicsState, Vec2 } from '../types/physics';

const table = createEightBallTable();
const r = table.ballRadius;

const ball = (id: number, x: number, y: number): Ball => ({
  id,
  position: { x, y },
  velocity: { x: 0, y: 0 },
  spin: { x: 0, y: 0 },
  radius: r,
  pocketed: false,
});

describe('aiming purity', () => {
  it('has no DOM, React, or render imports (stays a pure table-space module)', () => {
    const forbidden = [/from ['"]react['"]/, /\bwindow\b/, /\bdocument\b/, /\.\.\/render/];
    const offenders = forbidden.filter((p) => p.test(aimingSource));
    expect(offenders).toEqual([]);
  });
});

describe('aimFromPointer', () => {
  const cue: Vec2 = { x: 1, y: 0.5 };

  it('shoots toward the pointer across all four quadrants', () => {
    // Point right -> shoot right (angle 0).
    expect(aimFromPointer(cue, { x: 1.5, y: 0.5 }).angle).toBeCloseTo(0, 6);
    // Point left -> shoot left (angle pi).
    expect(Math.abs(aimFromPointer(cue, { x: 0.5, y: 0.5 }).angle)).toBeCloseTo(Math.PI, 6);
    // Point toward +y -> shoot toward +y.
    expect(aimFromPointer(cue, { x: 1, y: 1 }).angle).toBeCloseTo(Math.PI / 2, 6);
    // Point toward -y -> shoot toward -y.
    expect(aimFromPointer(cue, { x: 1, y: 0 }).angle).toBeCloseTo(-Math.PI / 2, 6);
    // Diagonal.
    expect(aimFromPointer(cue, { x: 1.1, y: 0.6 }).angle).toBeCloseTo(Math.PI / 4, 6);
  });

  it('scales power with pull length and clamps to [0, 1]', () => {
    // A pull equal to maxPullback is full power.
    const full = aimFromPointer(cue, { x: cue.x - DEFAULT_AIM.maxPullback, y: cue.y });
    expect(full.power).toBeCloseTo(1, 6);
    // Beyond maxPullback stays clamped at 1.
    expect(aimFromPointer(cue, { x: 0, y: 0.5 }).power).toBe(1);
    // Inside the dead zone is zero power.
    expect(aimFromPointer(cue, { x: cue.x - DEFAULT_AIM.minPullback / 2, y: cue.y }).power).toBe(0);
    // Exactly on the cue ball is a no-op.
    expect(aimFromPointer(cue, cue)).toEqual({ angle: 0, power: 0 });
  });
});

describe('predictGuide', () => {
  it('predicts the object ball hit first and its travel direction (matches engine)', () => {
    // Slight cut: cue below the object so the contact is off-center. Low power so
    // the object travels straight to rest without reaching a rail.
    const objStart = { x: 0.9, y: 0.5 };
    const state: PhysicsState = { tick: 0, balls: [ball(0, 0.3, 0.47), ball(1, objStart.x, objStart.y)] };
    const aim = { angle: 0, power: 0.15 };
    const guide = predictGuide(state, aim, table, DEFAULT_PHYSICS);
    expect(guide.contact).not.toBeNull();
    const contact = guide.contact;
    if (contact === null) return;
    expect(contact.ball).toBe(1);
    // Ghost sits one ball-gap from the object center, along the impact line the
    // object then travels: equal-mass elastic transfer sends it down that line.
    const gap = Math.hypot(objStart.x - contact.ghost.x, objStart.y - contact.ghost.y);
    expect(gap).toBeCloseTo(2 * r, 4);
    const impact = {
      x: (objStart.x - contact.ghost.x) / gap,
      y: (objStart.y - contact.ghost.y) / gap,
    };
    expect(contact.objectDir.x).toBeCloseTo(impact.x, 3);
    expect(contact.objectDir.y).toBeCloseTo(impact.y, 3);
    // The engine drives the real object ball the same way the guide predicted.
    const run = simulate(state, aim, table, DEFAULT_PHYSICS);
    const obj = run.finalState.balls.find((b) => b.id === 1);
    expect(obj).toBeDefined();
    if (obj === undefined) return;
    const moved = Math.hypot(obj.position.x - objStart.x, obj.position.y - objStart.y);
    expect(moved).toBeGreaterThan(0);
    const movedDir = { x: (obj.position.x - objStart.x) / moved, y: (obj.position.y - objStart.y) / moved };
    expect(movedDir.x).toBeCloseTo(contact.objectDir.x, 2);
    expect(movedDir.y).toBeCloseTo(contact.objectDir.y, 2);
    // The path ends at the ghost ball.
    const end = guide.cuePath[guide.cuePath.length - 1];
    expect(end).toEqual(contact.ghost);
  });

  it('stops at the first rail with no contact when the cue hits nothing', () => {
    const state: PhysicsState = { tick: 0, balls: [ball(0, 0.3, 0.5)] };
    const guide = predictGuide(state, { angle: Math.PI, power: 0.8 }, table, DEFAULT_PHYSICS);
    expect(guide.contact).toBeNull();
    // Terminal point rests against the left cushion (x ~ ballRadius).
    const end = guide.cuePath[guide.cuePath.length - 1];
    expect(end?.x).toBeLessThan(0.3);
  });

  it('is deterministic and consistent with simulate for a rack break', () => {
    const state: PhysicsState = { tick: 0, balls: rackEightBall() };
    const aim = { angle: 0, power: 1 };
    const a = predictGuide(state, aim, table, DEFAULT_PHYSICS);
    const b = predictGuide(state, aim, table, DEFAULT_PHYSICS);
    expect(a).toEqual(b);
    const run = simulate(state, aim, table, DEFAULT_PHYSICS);
    const firstContact = run.events.find((e) => e.type === 'first-contact');
    expect(a.contact?.ball).toBe(firstContact?.type === 'first-contact' ? firstContact.other : -1);
  });
});

describe('validateCuePlacement', () => {
  const state: PhysicsState = { tick: 0, balls: [ball(0, 0.5, 0.5), ball(1, 1.2, 0.5)] };

  it('accepts a clear, in-bounds position', () => {
    expect(validateCuePlacement({ x: 0.4, y: 0.5 }, state, table)).toEqual({
      legal: true,
      reason: null,
    });
  });

  it('rejects a position off the playing surface', () => {
    expect(validateCuePlacement({ x: r / 2, y: 0.5 }, state, table).reason).toBe('out-of-bounds');
    expect(validateCuePlacement({ x: table.width, y: 0.5 }, state, table).reason).toBe('out-of-bounds');
  });

  it('rejects a position overlapping another ball', () => {
    const res = validateCuePlacement({ x: 1.2 + r, y: 0.5 }, state, table);
    expect(res.legal).toBe(false);
    expect(res.reason).toBe('overlap');
  });

  it('ignores the ball being placed and pocketed balls in the overlap check', () => {
    const withPocketed: PhysicsState = {
      tick: 0,
      balls: [ball(0, 0.5, 0.5), { ...ball(1, 0.41, 0.5), pocketed: true }],
    };
    // Placing the cue exactly where it already sits is legal (self is skipped).
    expect(validateCuePlacement({ x: 0.5, y: 0.5 }, withPocketed, table).legal).toBe(true);
    // Overlapping only a pocketed ball is legal.
    expect(validateCuePlacement({ x: 0.4, y: 0.5 }, withPocketed, table).legal).toBe(true);
  });

  it('enforces the kitchen rule when a head-string limit is given', () => {
    const kitchenMaxX = table.width / 4;
    expect(validateCuePlacement({ x: kitchenMaxX + 0.1, y: 0.5 }, state, table, { kitchenMaxX }).reason).toBe(
      'outside-kitchen',
    );
    expect(validateCuePlacement({ x: kitchenMaxX - 0.05, y: 0.5 }, state, table, { kitchenMaxX }).legal).toBe(true);
  });
});
