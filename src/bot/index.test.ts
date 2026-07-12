import { describe, it, expect } from 'vitest';
import { planShot } from './index';
import { createEightBallTable, rackEightBall } from '../engine/tables/eightBall';
import { DEFAULT_PHYSICS } from '../engine/config';
import { simulate } from '../engine/simulate';
import { deriveOutcome } from '../rules/outcome';
import { createInitialState, reduce } from '../rules/eightBall';
import { validateCuePlacement } from '../game/aiming';
import type { Ball, PhysicsState, Vec2 } from '../types/physics';
import type { GameState } from '../types/rules';
import type { Difficulty as Tier } from '../types/bot';

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

const cloneBalls = (balls: readonly Ball[]): Ball[] =>
  balls.map((b) => makeBall(b.id, b.position.x, b.position.y));

const openState = (turn: GameState['turn'] = 'bot'): GameState => ({
  phase: 'open',
  turn,
  groups: { player: null, bot: null },
  pocketed: [],
  ballInHand: 'none',
  foul: null,
  winner: null,
});

// Cue and object ball lined up straight down onto the top side pocket at
// (width/2, 0): a trivial makeable open shot.
const straightShotLayout = (): Ball[] => {
  const midX = geometry.width / 2;
  return [makeBall(0, midX, 0.7), makeBall(1, midX, 0.2)];
};

const potsBall = (balls: readonly Ball[], shot: ReturnType<typeof planShot>, targetId: number): boolean => {
  const state: PhysicsState = { tick: 0, balls: cloneBalls(balls) };
  const { events } = simulate(state, shot, geometry, config);
  const outcome = deriveOutcome(events);
  return !outcome.cueScratch && outcome.pocketed.includes(targetId);
};

describe('planShot', () => {
  it('pots a trivial straight open shot at hard difficulty (fixed seed)', () => {
    const balls = straightShotLayout();
    const shot = planShot(openState(), balls, geometry, config, 'hard', 12345);
    expect(potsBall(balls, shot, 1)).toBe(true);
  });

  it('is deterministic: identical inputs yield the identical shot', () => {
    const balls = straightShotLayout();
    const a = planShot(openState(), balls, geometry, config, 'medium', 999);
    const b = planShot(openState(), balls, geometry, config, 'medium', 999);
    expect(a).toEqual(b);
  });

  it('always returns a legal, well-formed ShotInput over organic game states', () => {
    const tiers: Tier[] = ['easy', 'medium', 'hard'];
    let game = createInitialState('player');
    let balls: Ball[] = rackEightBall();

    for (let i = 0; i < 60; i++) {
      if (game.winner !== null) {
        game = createInitialState('player');
        balls = rackEightBall();
      }
      const tier = tiers[i % 3] as Tier;
      const shot = planShot(game, balls, geometry, config, tier, 4000 + i);

      // Well-formed: finite aim, normalized power.
      expect(Number.isFinite(shot.angle)).toBe(true);
      expect(shot.power).toBeGreaterThanOrEqual(0);
      expect(shot.power).toBeLessThanOrEqual(1);

      // Ball-in-hand: a placement must be present and legal-by-construction; when
      // there is no ball-in-hand the planner must not reposition the cue.
      if (game.ballInHand !== 'none') {
        const placement = shot.cuePlacement;
        expect(placement).toBeDefined();
        if (placement !== undefined) {
          const kitchenMaxX =
            game.ballInHand === 'kitchen' ? geometry.width * 0.25 : undefined;
          const check = validateCuePlacement(
            placement,
            { tick: 0, balls },
            geometry,
            { kitchenMaxX },
          );
          expect(check.legal).toBe(true);
        }
      } else {
        expect(shot.cuePlacement).toBeUndefined();
      }

      // Advance the game so later iterations exercise open/assigned/on-8/foul.
      const { finalState, events } = simulate(
        { tick: 0, balls: cloneBalls(balls) },
        shot,
        geometry,
        config,
      );
      game = reduce(game, deriveOutcome(events));
      balls = game.phase === 'break' ? rackEightBall() : finalState.balls;
    }
  });

  it('difficulty ordering: hard pots >= medium >= easy over a seeded scenario set', () => {
    // Makeable single-ball open pots at a range of angles/distances. Hard (no
    // noise) sinks them all; noisier tiers miss some.
    const scenarios: ReadonlyArray<{ cue: Vec2; ball: Vec2; targetId: number }> = [
      { cue: { x: 0.4, y: 0.5 }, ball: { x: 1.4, y: 0.28 }, targetId: 1 },
      { cue: { x: 0.5, y: 0.6 }, ball: { x: 1.5, y: 0.7 }, targetId: 1 },
      { cue: { x: 0.6, y: 0.5 }, ball: { x: 1.3, y: 0.5 }, targetId: 1 },
      { cue: { x: 1.5, y: 0.5 }, ball: { x: 0.6, y: 0.3 }, targetId: 1 },
      { cue: { x: 1.6, y: 0.6 }, ball: { x: 0.55, y: 0.68 }, targetId: 1 },
      { cue: { x: 0.9, y: 0.8 }, ball: { x: 0.95, y: 0.35 }, targetId: 1 },
    ];

    const countPots = (tier: Tier): number => {
      let pots = 0;
      for (let s = 0; s < scenarios.length; s++) {
        const sc = scenarios[s];
        if (sc === undefined) continue;
        const balls = [makeBall(0, sc.cue.x, sc.cue.y), makeBall(sc.targetId, sc.ball.x, sc.ball.y)];
        for (let seed = 0; seed < 10; seed++) {
          const shot = planShot(openState(), balls, geometry, config, tier, seed * 131 + s);
          if (potsBall(balls, shot, sc.targetId)) pots++;
        }
      }
      return pots;
    };

    const hard = countPots('hard');
    const medium = countPots('medium');
    const easy = countPots('easy');

    expect(hard).toBeGreaterThanOrEqual(medium);
    expect(medium).toBeGreaterThanOrEqual(easy);
    // Sanity: hard actually makes the shots, and noise actually degrades easy.
    expect(hard).toBeGreaterThan(easy);
  });
});
