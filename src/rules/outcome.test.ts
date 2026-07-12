import { describe, it, expect } from 'vitest';
import { deriveOutcome } from './outcome';
import type { PhysicsEvent } from '../types/physics';

describe('deriveOutcome', () => {
  it('reads the cue ball first contact from the first-contact event', () => {
    const log: PhysicsEvent[] = [
      { type: 'first-contact', tick: 5, ball: 0, other: 3 },
      { type: 'ball-ball', tick: 5, a: 0, b: 3 },
      { type: 'rest', tick: 40 },
    ];
    expect(deriveOutcome(log).firstContact).toBe(3);
  });

  it('reports -1 first contact when the cue ball hits nothing', () => {
    const log: PhysicsEvent[] = [
      { type: 'rail', tick: 8, ball: 0, cushion: 1 },
      { type: 'rest', tick: 60 },
    ];
    expect(deriveOutcome(log).firstContact).toBe(-1);
  });

  it('separates the cue scratch from object-ball pockets, preserving pocket order', () => {
    const log: PhysicsEvent[] = [
      { type: 'first-contact', tick: 3, ball: 0, other: 2 },
      { type: 'pocket', tick: 20, ball: 5, pocket: 0 },
      { type: 'pocket', tick: 22, ball: 2, pocket: 1 },
      { type: 'pocket', tick: 30, ball: 0, pocket: 3 },
      { type: 'rest', tick: 50 },
    ];
    const outcome = deriveOutcome(log);
    expect(outcome.pocketed).toEqual([5, 2]);
    expect(outcome.cueScratch).toBe(true);
  });

  it('flags a rail contact that happens after the first contact', () => {
    const log: PhysicsEvent[] = [
      { type: 'first-contact', tick: 4, ball: 0, other: 1 },
      { type: 'rail', tick: 12, ball: 1, cushion: 2 },
      { type: 'rest', tick: 40 },
    ];
    expect(deriveOutcome(log).railAfterContact).toBe(true);
  });

  it('does not count a rail contact that precedes the first contact', () => {
    const log: PhysicsEvent[] = [
      { type: 'rail', tick: 2, ball: 0, cushion: 0 },
      { type: 'first-contact', tick: 10, ball: 0, other: 1 },
      { type: 'ball-ball', tick: 10, a: 0, b: 1 },
      { type: 'rest', tick: 30 },
    ];
    expect(deriveOutcome(log).railAfterContact).toBe(false);
  });

  it('counts distinct balls driven to a rail for break legality', () => {
    const log: PhysicsEvent[] = [
      { type: 'first-contact', tick: 3, ball: 0, other: 1 },
      { type: 'rail', tick: 15, ball: 1, cushion: 0 },
      { type: 'rail', tick: 16, ball: 4, cushion: 1 },
      { type: 'rail', tick: 18, ball: 4, cushion: 2 }, // same ball again
      { type: 'rail', tick: 20, ball: 7, cushion: 3 },
      { type: 'rail', tick: 22, ball: 9, cushion: 4 },
      { type: 'rest', tick: 60 },
    ];
    expect(deriveOutcome(log).railedBallCount).toBe(4);
  });
});
