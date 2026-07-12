import { describe, it, expect } from 'vitest';
import { scoreCandidate } from './evaluate';
import { createEightBallTable } from '../engine/tables/eightBall';
import { DEFAULT_PHYSICS } from '../engine/config';
import type { Ball } from '../types/physics';
import type { BotCandidate } from '../types/bot';
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

const openState: GameState = {
  phase: 'open',
  turn: 'bot',
  groups: { player: null, bot: null },
  pocketed: [],
  ballInHand: 'none',
  foul: null,
  winner: null,
};

describe('scoreCandidate', () => {
  it('scores a legal pot above a miss, and a scratch foul below zero', () => {
    const midX = geometry.width / 2;
    // Cue and ball lined up straight into the top side pocket.
    const balls = [makeBall(0, midX, 0.7), makeBall(1, midX, 0.2)];

    const potShot: BotCandidate = {
      shot: { angle: -Math.PI / 2, power: 0.6 },
      targetBall: 1,
      heuristic: 1,
    };
    // Aim away from the object ball: a miss, which must score below a clean pot.
    const missShot: BotCandidate = {
      shot: { angle: 0, power: 0.2 },
      targetBall: 1,
      heuristic: 0,
    };
    // Fire the cue straight down into the same side pocket: a scratch.
    const scratchShot: BotCandidate = {
      shot: { angle: Math.PI / 2, power: 0.5 },
      targetBall: 1,
      heuristic: 0,
    };

    const potScore = scoreCandidate(potShot, openState, balls, geometry, config);
    const missScore = scoreCandidate(missShot, openState, balls, geometry, config);
    const scratchScore = scoreCandidate(scratchShot, openState, balls, geometry, config);

    expect(potScore).toBeGreaterThan(missScore);
    expect(scratchScore).toBeLessThan(0);
    expect(potScore).toBeGreaterThan(scratchScore);
  });
});
