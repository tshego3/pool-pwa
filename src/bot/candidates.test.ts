import { describe, it, expect } from 'vitest';
import { enumerateCandidates } from './candidates';
import { createEightBallTable, rackEightBall } from '../engine/tables/eightBall';
import { DEFAULT_PHYSICS } from '../engine/config';
import { validateCuePlacement } from '../game/aiming';
import type { Ball } from '../types/physics';
import type { GameState } from '../types/rules';

const geometry = createEightBallTable();
const config = DEFAULT_PHYSICS;

const makeBall = (id: number, x: number, y: number): Ball => ({
  id,
  position: { x, y },
  velocity: { x: 0, y: 0 },
  spin: { x: 0, y: 0 },
  radius: geometry.ballRadius,
  pocketed: false,
});

const baseState = (over: Partial<GameState>): GameState => ({
  phase: 'open',
  turn: 'bot',
  groups: { player: null, bot: null },
  pocketed: [],
  ballInHand: 'none',
  foul: null,
  winner: null,
  ...over,
});

describe('enumerateCandidates', () => {
  it('returns non-empty, well-formed candidates on the break', () => {
    const balls = rackEightBall();
    const cands = enumerateCandidates(baseState({ phase: 'break' }), balls, geometry, config, 48);
    expect(cands.length).toBeGreaterThan(0);
    for (const c of cands) {
      expect(Number.isFinite(c.shot.angle)).toBe(true);
      expect(c.shot.power).toBeGreaterThanOrEqual(0);
      expect(c.shot.power).toBeLessThanOrEqual(1);
    }
  });

  it('caps the number of candidates it returns', () => {
    const balls = rackEightBall();
    const cands = enumerateCandidates(baseState({}), balls, geometry, config, 5);
    expect(cands.length).toBeLessThanOrEqual(5);
    expect(cands.length).toBeGreaterThan(0);
  });

  it('targets only the shooter group balls once a group is assigned', () => {
    // Bot is solids; only solid ids should be aimed at.
    const balls = [
      makeBall(0, 0.4, 0.5),
      makeBall(1, 1.0, 0.4), // solid (bot)
      makeBall(3, 1.2, 0.6), // solid (bot)
      makeBall(9, 1.4, 0.3), // stripe (player)
      makeBall(8, 1.5, 0.5),
    ];
    const state = baseState({
      phase: 'assigned',
      groups: { player: 'stripes', bot: 'solids' },
    });
    const cands = enumerateCandidates(state, balls, geometry, config, 48);
    const aimed = new Set(cands.map((c) => c.targetBall));
    expect(aimed.has(1) || aimed.has(3)).toBe(true);
    expect(aimed.has(9)).toBe(false);
    expect(aimed.has(8)).toBe(false);
  });

  it('produces legal cue-placement candidates under ball-in-hand', () => {
    const balls = [makeBall(0, 0.4, 0.5), makeBall(1, 1.2, 0.5), makeBall(8, 1.5, 0.5)];
    const state = baseState({ ballInHand: 'anywhere' });
    const cands = enumerateCandidates(state, balls, geometry, config, 48);
    expect(cands.length).toBeGreaterThan(0);
    for (const c of cands) {
      const placement = c.shot.cuePlacement;
      expect(placement).toBeDefined();
      if (placement !== undefined) {
        const check = validateCuePlacement(placement, { tick: 0, balls }, geometry);
        expect(check.legal).toBe(true);
      }
    }
  });

  it('keeps kitchen ball-in-hand placements behind the head string', () => {
    const balls = [makeBall(0, 0.4, 0.5), makeBall(1, 1.2, 0.5), makeBall(8, 1.5, 0.5)];
    const state = baseState({ ballInHand: 'kitchen' });
    const cands = enumerateCandidates(state, balls, geometry, config, 48);
    const headStringX = geometry.width * 0.25;
    for (const c of cands) {
      const placement = c.shot.cuePlacement;
      expect(placement).toBeDefined();
      if (placement !== undefined) expect(placement.x).toBeLessThanOrEqual(headStringX + 1e-9);
    }
  });
});
