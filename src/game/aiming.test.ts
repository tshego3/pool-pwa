import { describe, it, expect } from 'vitest';
import aimingSource from './aiming.ts?raw';
import { steerAngle, predictGuide, validateCuePlacement, DEFAULT_AIM } from './aiming';
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

describe('steerAngle', () => {
  const cue: Vec2 = { x: 1, y: 0.5 };
  const sens = DEFAULT_AIM.steerSensitivity;

  it('leaves the aim alone when the pointer has not moved (a tap never re-aims)', () => {
    const press: Vec2 = { x: 1.5, y: 0.9 };
    expect(steerAngle(cue, press, press, 0)).toBeCloseTo(0, 6);
    // Pressing on the opposite side of the table is still a no-op.
    expect(steerAngle(cue, { x: 0.2, y: 0.1 }, { x: 0.2, y: 0.1 }, Math.PI / 3)).toBeCloseTo(
      Math.PI / 3,
      6,
    );
  });

  it('corrects the current angle by the swept angle, scaled by sensitivity', () => {
    // Swing a quarter turn counter-clockwise about the cue (+y is a right-handed
    // rotation from +x here), starting from an aim of 0.
    const swept = steerAngle(cue, { x: 1.4, y: 0.5 }, { x: 1, y: 0.9 }, 0);
    expect(swept).toBeCloseTo((Math.PI / 2) * sens, 6);
    // The same swing the other way turns the aim the other way.
    expect(steerAngle(cue, { x: 1, y: 0.9 }, { x: 1.4, y: 0.5 }, 0)).toBeCloseTo(
      (-Math.PI / 2) * sens,
      6,
    );
    // The correction is added to wherever the aim already was.
    expect(steerAngle(cue, { x: 1.4, y: 0.5 }, { x: 1, y: 0.9 }, 1)).toBeCloseTo(
      1 + (Math.PI / 2) * sens,
      6,
    );
  });

  it('is relative, not absolute: the same drag steers the same way anywhere', () => {
    // Both drags sweep 0.4 rad about the cue, one 0.3 away and one 0.8 away.
    const near = steerAngle(cue, { x: 1.3, y: 0.5 }, { x: 1.3, y: 0.5 + 0.3 * Math.tan(0.4) }, 0);
    const far = steerAngle(cue, { x: 1.8, y: 0.5 }, { x: 1.8, y: 0.5 + 0.8 * Math.tan(0.4) }, 0);
    expect(near).toBeCloseTo(0.4 * sens, 6);
    expect(far).toBeCloseTo(near, 6);
  });

  it('ignores drags too close to the cue ball, where a pixel sweeps a huge angle', () => {
    const r = DEFAULT_AIM.minSteerRadius / 2;
    expect(steerAngle(cue, { x: cue.x + r, y: cue.y }, { x: cue.x, y: cue.y + r }, 0.7)).toBeCloseTo(
      0.7,
      12,
    );
    // Guarded at both ends of the drag.
    expect(steerAngle(cue, { x: 2, y: 0.5 }, { x: cue.x, y: cue.y + r }, 0.7)).toBeCloseTo(0.7, 12);
    // Exactly on the cue ball is a no-op.
    expect(steerAngle(cue, cue, cue, 0.7)).toBeCloseTo(0.7, 12);
  });

  it('wraps the result into (-pi, pi] so repeated corrections cannot drift', () => {
    const wrapped = steerAngle(cue, { x: 1.4, y: 0.5 }, { x: 0.6, y: 0.5 }, Math.PI - 0.1);
    expect(wrapped).toBeGreaterThan(-Math.PI);
    expect(wrapped).toBeLessThanOrEqual(Math.PI);
    expect(wrapped).toBeCloseTo(Math.PI - 0.1 + Math.PI * sens - 2 * Math.PI, 6);
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

  it('predicts where each ball travels after the hit, matching the real shot', () => {
    // Straight-on hit down the table with room for the object ball to run.
    const objStart = { x: 0.9, y: 0.5 };
    const state: PhysicsState = { tick: 0, balls: [ball(0, 0.3, 0.5), ball(1, objStart.x, objStart.y)] };
    const aim = { angle: 0, power: 0.2 };
    const contact = predictGuide(state, aim, table, DEFAULT_PHYSICS).contact;
    expect(contact).not.toBeNull();
    if (contact === null) return;
    // The object path starts at the object ball and runs along the impact line.
    expect(contact.objectAfter.length).toBe(2);
    const start = contact.objectAfter[0];
    const end = contact.objectAfter[1];
    expect(start).toEqual(objStart);
    if (start === undefined || end === undefined) return;
    const travel = Math.hypot(end.x - start.x, end.y - start.y);
    expect(travel).toBeGreaterThan(r);
    const dir = { x: (end.x - start.x) / travel, y: (end.y - start.y) / travel };
    expect(dir.x).toBeCloseTo(contact.objectDir.x, 2);
    expect(dir.y).toBeCloseTo(contact.objectDir.y, 2);
    // The engine puts the real object ball where the guide said it would go.
    const run = simulate(state, aim, table, DEFAULT_PHYSICS);
    const obj = run.finalState.balls.find((b) => b.id === 1);
    expect(obj?.position.x).toBeCloseTo(end.x, 2);
    expect(obj?.position.y).toBeCloseTo(end.y, 2);
    // The cue path starts at the ghost ball, wherever the stun leaves it.
    expect(contact.cueAfter[0]).toEqual(contact.ghost);
  });

  it('sends the cue ball down its own line on a cut, away from the object ball', () => {
    // Cut to one side: the cue deflects along the tangent, the object along the
    // impact line, so the two predicted paths must diverge.
    const state: PhysicsState = { tick: 0, balls: [ball(0, 0.3, 0.46), ball(1, 0.9, 0.5)] };
    const contact = predictGuide(state, { angle: 0, power: 0.5 }, table, DEFAULT_PHYSICS).contact;
    expect(contact).not.toBeNull();
    if (contact === null) return;
    expect(contact.cueAfter.length).toBe(2);
    const from = contact.cueAfter[0];
    const to = contact.cueAfter[1];
    if (from === undefined || to === undefined) return;
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    expect(len).toBeGreaterThan(r);
    const dir = { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
    expect(dir.x).toBeCloseTo(contact.cueDir.x, 1);
    expect(dir.y).toBeCloseTo(contact.cueDir.y, 1);
    // Tangent and impact lines are perpendicular for an equal-mass elastic hit.
    const alignment = contact.cueDir.x * contact.objectDir.x + contact.cueDir.y * contact.objectDir.y;
    expect(Math.abs(alignment)).toBeLessThan(0.15);
  });

  it('stops the predicted paths where the balls stop, never off the table', () => {
    const state: PhysicsState = { tick: 0, balls: [ball(0, 0.3, 0.5), ball(1, 0.9, 0.5)] };
    const contact = predictGuide(state, { angle: 0, power: 1 }, table, DEFAULT_PHYSICS).contact;
    expect(contact).not.toBeNull();
    if (contact === null) return;
    for (const p of [...contact.cueAfter, ...contact.objectAfter]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(table.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(table.height);
    }
  });

  it('follows cushions when maxBounces allows it, and stops at the first rail otherwise', () => {
    // Up-table at 60 degrees from the head spot: clear of the rack and of the
    // side pocket, so the line reaches a cushion and nothing else.
    const state: PhysicsState = { tick: 0, balls: rackEightBall() };
    const aim = { angle: -Math.PI / 3, power: 0.35 };
    const straight = predictGuide(state, aim, table, DEFAULT_PHYSICS, { maxBounces: 0 });
    expect(straight.cuePath).toHaveLength(2);
    expect(straight.contact).toBeNull();
    const bounced = predictGuide(state, aim, table, DEFAULT_PHYSICS, { maxBounces: 3 });
    expect(bounced.cuePath.length).toBeGreaterThan(2);
    // The line up to the first cushion is the same either way.
    expect(bounced.cuePath.slice(0, 2)).toEqual(straight.cuePath);
    for (const p of bounced.cuePath) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(table.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(table.height);
    }
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
