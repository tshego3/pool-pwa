import { describe, it, expect } from 'vitest';
import { createInitialState, legalTargets, reduce } from './eightBall';
import type { BallGroup, GameState, Seat, ShotOutcome } from '../types/rules';

// Build a ShotOutcome with legal-shot defaults, overriding only what a case cares
// about. Defaults describe a shot that touched nothing (which is itself a foul);
// every case sets firstContact where a legal contact is intended.
const outcome = (o: Partial<ShotOutcome> = {}): ShotOutcome => ({
  firstContact: -1,
  pocketed: [],
  cueScratch: false,
  railAfterContact: false,
  railedBallCount: 0,
  ...o,
});

const groupsFor = (playerGroup: BallGroup): Record<Seat, BallGroup | null> => ({
  player: playerGroup,
  bot: playerGroup === 'solids' ? 'stripes' : 'solids',
});

// A group-assigned state with the given seat to shoot.
const assigned = (
  turn: Seat,
  playerGroup: BallGroup,
  pocketed: readonly number[] = [],
): GameState => ({
  phase: 'assigned',
  turn,
  groups: groupsFor(playerGroup),
  pocketed,
  ballInHand: 'none',
  foul: null,
  winner: null,
});

const ALL_SOLIDS = [1, 2, 3, 4, 5, 6, 7];

describe('reduce - break shot', () => {
  it('is an illegal break when <4 balls reach a rail and nothing is potted', () => {
    const next = reduce(createInitialState('player'), outcome({ firstContact: 1, railedBallCount: 2 }));
    expect(next.foul).toBe('illegal-break');
    expect(next.turn).toBe('bot');
    expect(next.phase).toBe('open');
    expect(next.ballInHand).toBe('none');
  });

  it('is a legal break at exactly 4 balls to a rail and passes the dry turn', () => {
    const next = reduce(createInitialState('player'), outcome({ firstContact: 1, railedBallCount: 4 }));
    expect(next.foul).toBeNull();
    expect(next.turn).toBe('bot');
    expect(next.phase).toBe('open');
  });

  it('gives the opponent kitchen ball-in-hand on a break scratch', () => {
    const next = reduce(
      createInitialState('player'),
      outcome({ firstContact: 1, railedBallCount: 6, cueScratch: true }),
    );
    expect(next.foul).toBe('cue-scratch');
    expect(next.ballInHand).toBe('kitchen');
    expect(next.turn).toBe('bot');
    expect(next.groups).toEqual({ player: null, bot: null });
  });

  it('keeps the table open and continues the breaker after a legal pot on the break', () => {
    const next = reduce(createInitialState('player'), outcome({ firstContact: 1, pocketed: [3], railedBallCount: 5 }));
    expect(next.phase).toBe('open');
    expect(next.groups).toEqual({ player: null, bot: null });
    expect(next.turn).toBe('player');
    expect(next.pocketed).toEqual([3]);
  });

  it('re-racks when the 8-ball is potted on the break, same player breaking again', () => {
    const next = reduce(createInitialState('bot'), outcome({ firstContact: 1, pocketed: [8, 2], railedBallCount: 5 }));
    expect(next).toEqual(createInitialState('bot'));
    expect(next.phase).toBe('break');
    expect(next.pocketed).toEqual([]);
  });
});

describe('reduce - open table', () => {
  const openState: GameState = {
    phase: 'open',
    turn: 'player',
    groups: { player: null, bot: null },
    pocketed: [],
    ballInHand: 'none',
    foul: null,
    winner: null,
  };

  it('assigns the shooter the group of the first ball potted and continues', () => {
    const next = reduce(openState, outcome({ firstContact: 3, pocketed: [3] }));
    expect(next.groups).toEqual({ player: 'solids', bot: 'stripes' });
    expect(next.phase).toBe('assigned');
    expect(next.turn).toBe('player');
  });

  it('assigns stripes when the first potted ball is a stripe', () => {
    const next = reduce(openState, outcome({ firstContact: 11, pocketed: [11] }));
    expect(next.groups).toEqual({ player: 'stripes', bot: 'solids' });
  });

  it('fouls when the 8-ball is contacted first on the open table', () => {
    const next = reduce(openState, outcome({ firstContact: 8, railAfterContact: true }));
    expect(next.foul).toBe('wrong-ball-first');
    expect(next.ballInHand).toBe('anywhere');
    expect(next.turn).toBe('bot');
    expect(next.groups).toEqual({ player: null, bot: null });
  });

  it('passes the turn on a legal dry shot, leaving the table open', () => {
    const next = reduce(openState, outcome({ firstContact: 3, railAfterContact: true }));
    expect(next.foul).toBeNull();
    expect(next.groups).toEqual({ player: null, bot: null });
    expect(next.turn).toBe('bot');
  });
});

describe('reduce - fouls with a group assigned', () => {
  it('grants ball-in-hand anywhere on a scratch', () => {
    const next = reduce(assigned('player', 'solids'), outcome({ firstContact: 1, cueScratch: true }));
    expect(next.foul).toBe('cue-scratch');
    expect(next.ballInHand).toBe('anywhere');
    expect(next.turn).toBe('bot');
  });

  it('fouls when the first contact is the opponent group', () => {
    const next = reduce(assigned('player', 'solids'), outcome({ firstContact: 9, railAfterContact: true }));
    expect(next.foul).toBe('wrong-ball-first');
    expect(next.turn).toBe('bot');
  });

  it('fouls when the cue ball hits nothing', () => {
    const next = reduce(assigned('player', 'solids'), outcome({ firstContact: -1 }));
    expect(next.foul).toBe('no-contact');
  });

  it('fouls when no ball reaches a rail and nothing is potted after contact', () => {
    const next = reduce(assigned('player', 'solids'), outcome({ firstContact: 1, railAfterContact: false }));
    expect(next.foul).toBe('no-rail');
  });
});

describe('reduce - turn continuation and alternation', () => {
  it('continues the turn when the shooter pots one of their own group', () => {
    const next = reduce(assigned('player', 'solids'), outcome({ firstContact: 1, pocketed: [1] }));
    expect(next.foul).toBeNull();
    expect(next.turn).toBe('player');
    expect(next.pocketed).toEqual([1]);
  });

  it('passes the turn on a legal shot that pots nothing', () => {
    const next = reduce(assigned('player', 'solids'), outcome({ firstContact: 1, railAfterContact: true }));
    expect(next.turn).toBe('bot');
  });

  it('passes the turn when only an opponent ball is potted legally', () => {
    const next = reduce(assigned('player', 'solids'), outcome({ firstContact: 1, pocketed: [11] }));
    expect(next.foul).toBeNull();
    expect(next.turn).toBe('bot');
    expect(next.pocketed).toEqual([11]);
  });
});

describe('reduce - 8-ball win and loss', () => {
  it('loses when the 8-ball is potted early (group not cleared)', () => {
    const next = reduce(assigned('player', 'solids', [1, 2]), outcome({ firstContact: 1, pocketed: [8] }));
    expect(next.winner).toBe('bot');
    expect(next.phase).toBe('finished');
  });

  it('wins when the shooter, on the 8, pots it cleanly', () => {
    const onEight = assigned('player', 'solids', ALL_SOLIDS);
    expect(onEight.phase).toBe('assigned'); // input phase is ignored; on-8 is derived
    const next = reduce({ ...onEight, phase: 'on-8' }, outcome({ firstContact: 8, pocketed: [8] }));
    expect(next.winner).toBe('player');
    expect(next.phase).toBe('finished');
  });

  it('loses when the 8 is potted but the cue ball scratches (cue + 8 together)', () => {
    const onEight = assigned('player', 'solids', ALL_SOLIDS);
    const next = reduce(onEight, outcome({ firstContact: 8, pocketed: [8], cueScratch: true }));
    expect(next.winner).toBe('bot');
  });

  it('loses when the 8 is potted but the wrong ball was struck first', () => {
    const onEight = assigned('player', 'solids', ALL_SOLIDS);
    const next = reduce(onEight, outcome({ firstContact: 9, pocketed: [8] }));
    expect(next.winner).toBe('bot');
  });
});

describe('reduce - edge cases', () => {
  it('handles simultaneous same-group pockets, banking both', () => {
    const openState: GameState = {
      phase: 'open',
      turn: 'bot',
      groups: { player: null, bot: null },
      pocketed: [],
      ballInHand: 'none',
      foul: null,
      winner: null,
    };
    const next = reduce(openState, outcome({ firstContact: 2, pocketed: [2, 5] }));
    expect(next.pocketed).toEqual([2, 5]);
    expect(next.groups).toEqual({ player: 'stripes', bot: 'solids' });
    expect(next.turn).toBe('bot');
  });

  it('clears a group and lands on the 8 in one shot', () => {
    const almost = assigned('player', 'solids', [1, 2, 3, 4, 5, 6]);
    const next = reduce(almost, outcome({ firstContact: 7, pocketed: [7] }));
    expect(next.phase).toBe('on-8');
    expect(next.turn).toBe('player');
  });

  it('is a no-op once the game is finished', () => {
    const finished: GameState = { ...assigned('player', 'solids'), phase: 'finished', winner: 'player' };
    const next = reduce(finished, outcome({ firstContact: 1, pocketed: [8] }));
    expect(next).toBe(finished);
  });
});

// Deterministic linear-congruential generator so the property test is
// reproducible; the rules layer forbids Math.random but tests may seed their own.
const makeRng = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
};

const OBJECT_IDS = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];

const randomOutcome = (rng: () => number): ShotOutcome => {
  const ids = [0, ...OBJECT_IDS, 8];
  const pocketed = ids.filter((id) => id !== 0 && rng() < 0.15);
  const firstContact = rng() < 0.1 ? -1 : (ids[Math.floor(rng() * ids.length)] as number);
  return {
    firstContact,
    pocketed,
    cueScratch: rng() < 0.15,
    railAfterContact: rng() < 0.6,
    railedBallCount: Math.floor(rng() * 8),
  };
};

const assertValid = (s: GameState): void => {
  // Turn and winner are drawn from the seat domain.
  expect(['player', 'bot']).toContain(s.turn);
  if (s.winner !== null) {
    expect(['player', 'bot']).toContain(s.winner);
    // A winner means the game is over.
    expect(s.phase).toBe('finished');
  }
  // Groups are never both assigned to the same group.
  const { player, bot } = s.groups;
  if (player !== null && bot !== null) expect(player).not.toBe(bot);
  // Pocketed balls are valid, unique object-ball ids (never the cue).
  const seen = new Set<number>();
  for (const id of s.pocketed) {
    expect(OBJECT_IDS.concat(8)).toContain(id);
    expect(seen.has(id)).toBe(false);
    seen.add(id);
  }
  expect(['none', 'anywhere', 'kitchen']).toContain(s.ballInHand);
};

describe('reduce - property: valid state in, valid state out', () => {
  it('never reaches an invalid state over random valid shot sequences', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = makeRng(seed);
      let state = createInitialState(rng() < 0.5 ? 'player' : 'bot');
      for (let shot = 0; shot < 40; shot++) {
        const before = state;
        state = reduce(state, randomOutcome(rng));
        assertValid(state);
        // Play never continues past a finish.
        if (before.phase === 'finished') expect(state).toBe(before);
      }
    }
  });
});

describe('legalTargets', () => {
  const withGroups = (over: Partial<GameState>): GameState => ({
    ...createInitialState('player'),
    ...over,
  });

  it('returns null on an open table, where any ball but the 8 is fair game', () => {
    expect(legalTargets(createInitialState('player'), 'player')).toBeNull();
    expect(legalTargets(createInitialState('player'), 'bot')).toBeNull();
  });

  it('returns the seat own group, minus what is already down', () => {
    const state = withGroups({
      groups: { player: 'solids', bot: 'stripes' },
      pocketed: [1, 3, 10],
    });
    expect(legalTargets(state, 'player')).toEqual([2, 4, 5, 6, 7]);
    expect(legalTargets(state, 'bot')).toEqual([9, 11, 12, 13, 14, 15]);
  });

  it('returns the 8 alone once a seat has cleared its group', () => {
    const state = withGroups({
      groups: { player: 'solids', bot: 'stripes' },
      pocketed: [1, 2, 3, 4, 5, 6, 7],
    });
    expect(legalTargets(state, 'player')).toEqual([8]);
    // The opponent is still on its own balls.
    expect(legalTargets(state, 'bot')).toEqual([9, 10, 11, 12, 13, 14, 15]);
  });

  it('never offers the 8 while the seat still has group balls up', () => {
    const state = withGroups({
      groups: { player: 'stripes', bot: 'solids' },
      pocketed: [9, 10, 11, 12, 13, 14],
    });
    expect(legalTargets(state, 'player')).toEqual([15]);
    expect(legalTargets(state, 'player')).not.toContain(8);
  });
});
