// Pure 8-ball rules state machine: reduce(gameState, shotOutcome) -> gameState.
// No physics, no I/O, no clock, no random. Every decision is made from the
// ShotOutcome (derived from the engine event log) plus the prior GameState, so
// the same inputs always yield the identical output object.
//
// House rules encoded here (documented in the pool-pwa-physics-rules skill):
//  - The table is always open immediately after the break; a group is claimed
//    on the first legal pot AFTER the break, never on the break itself.
//  - 8-ball pocketed on the break -> re-rack, the same player breaks again.
//  - Break scratch -> opponent gets ball-in-hand behind the head string
//    (kitchen); other fouls -> ball-in-hand anywhere.
//  - When balls of both groups drop on the open table, the group of the first
//    ball in pocket order is claimed by the shooter (no call-shot model).

import type {
  BallGroup,
  FoulReason,
  GamePhase,
  GameState,
  Seat,
  ShotOutcome,
} from '../types/rules';

const CUE = 0;
const EIGHT = 8;
const SOLIDS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];
const STRIPES: readonly number[] = [9, 10, 11, 12, 13, 14, 15];

const other = (seat: Seat): Seat => (seat === 'player' ? 'bot' : 'player');
const otherGroup = (group: BallGroup): BallGroup =>
  group === 'solids' ? 'stripes' : 'solids';
const groupOf = (id: number): BallGroup => (id < EIGHT ? 'solids' : 'stripes');
const groupIds = (group: BallGroup): readonly number[] =>
  group === 'solids' ? SOLIDS : STRIPES;

const emptyGroups = (): Record<Seat, BallGroup | null> => ({ player: null, bot: null });

// Complementary group assignment: giving one seat a group hands the other to the
// opponent, so both seats can never own the same group (a property invariant).
const assign = (shooter: Seat, group: BallGroup): Record<Seat, BallGroup | null> =>
  shooter === 'player'
    ? { player: group, bot: otherGroup(group) }
    : { player: otherGroup(group), bot: group };

const union = (base: readonly number[], added: readonly number[]): number[] => {
  const out = [...base];
  for (const id of added) if (!out.includes(id)) out.push(id);
  return out;
};

// A seat is "on the 8" once every ball of its assigned group is pocketed.
const seatOnEight = (
  groups: Readonly<Record<Seat, BallGroup | null>>,
  pocketed: readonly number[],
  seat: Seat,
): boolean => {
  const group = groups[seat];
  if (group === null) return false;
  return groupIds(group).every((id) => pocketed.includes(id));
};

// The starting rack: player breaks by default. Kept here so the rules layer owns
// the initial GameState (the engine owns the ball positions via rackEightBall).
export const createInitialState = (breaker: Seat = 'player'): GameState => ({
  phase: 'break',
  turn: breaker,
  groups: emptyGroups(),
  pocketed: [],
  ballInHand: 'none',
  foul: null,
  winner: null,
});

// All fields of the next state except `phase`, which is always derived.
type Transition = Omit<GameState, 'phase'>;

// The only sticky phases are 'break' (initial rack / re-rack) and 'finished';
// every other phase follows from the assignment + pocketed set for the seat to
// shoot, so it cannot drift out of sync with the substantive state.
const derivePhase = (t: Transition): GamePhase => {
  if (t.winner !== null) return 'finished';
  if (t.groups[t.turn] === null) return 'open';
  return seatOnEight(t.groups, t.pocketed, t.turn) ? 'on-8' : 'assigned';
};

const finalize = (t: Transition): GameState => ({ ...t, phase: derivePhase(t) });

// Legality check for a non-break, non-8-deciding shot. Returns the foul reason
// or null. `onEight` is the shooter's derived on-8 status this shot.
const detectFoul = (
  groups: Readonly<Record<Seat, BallGroup | null>>,
  shooter: Seat,
  onEight: boolean,
  outcome: ShotOutcome,
  objectPots: number,
): FoulReason | null => {
  if (outcome.cueScratch) return 'cue-scratch';
  if (outcome.firstContact === -1) return 'no-contact';

  const first = outcome.firstContact;
  const shooterGroup = groups[shooter];
  if (shooterGroup === null) {
    // Open table: any ball is a legal first contact except the 8.
    if (first === EIGHT) return 'wrong-ball-first';
  } else if (onEight) {
    // Group cleared: the 8 must be struck first.
    if (first !== EIGHT) return 'wrong-ball-first';
  } else if (groupOf(first) !== shooterGroup) {
    // Group assigned: must contact one's own group first.
    return 'wrong-ball-first';
  }

  // After a legal contact, a ball must be pocketed or some ball must reach a rail.
  if (!outcome.railAfterContact && objectPots === 0) return 'no-rail';
  return null;
};

export const reduce = (state: GameState, outcome: ShotOutcome): GameState => {
  // Once finished the game is inert: no outcome can revive play.
  if (state.phase === 'finished') return state;

  const shooter = state.turn;
  const opponent = other(shooter);
  const objectPots = outcome.pocketed.filter((id) => id !== CUE && id !== EIGHT);
  const eightPotted = outcome.pocketed.includes(EIGHT);
  const nextPocketed = union(state.pocketed, objectPots);

  // --- Break shot ------------------------------------------------------------
  if (state.phase === 'break') {
    // 8 on the break re-racks; the same player breaks again (house rule).
    if (eightPotted) return createInitialState(shooter);

    const legalBreak = outcome.railedBallCount >= 4 || objectPots.length > 0;
    if (outcome.cueScratch || !legalBreak) {
      return finalize({
        turn: opponent,
        groups: emptyGroups(),
        pocketed: nextPocketed,
        ballInHand: outcome.cueScratch ? 'kitchen' : 'none',
        foul: outcome.cueScratch ? 'cue-scratch' : 'illegal-break',
        winner: null,
      });
    }
    // Legal break: the table stays open and the breaker continues iff a ball
    // dropped (groups are still claimed only on a later pot).
    return finalize({
      turn: objectPots.length > 0 ? shooter : opponent,
      groups: emptyGroups(),
      pocketed: nextPocketed,
      ballInHand: 'none',
      foul: null,
      winner: null,
    });
  }

  const onEight = seatOnEight(state.groups, state.pocketed, shooter);

  // --- 8-ball pocketed (win or loss) -----------------------------------------
  if (eightPotted) {
    // A win requires the shooter to have been legally on the 8, striking it
    // first, without scratching. Anything else pockets the 8 illegally -> loss.
    const win = onEight && outcome.firstContact === EIGHT && !outcome.cueScratch;
    return finalize({
      turn: opponent,
      groups: state.groups,
      pocketed: nextPocketed,
      ballInHand: 'none',
      foul: null,
      winner: win ? shooter : opponent,
    });
  }

  // --- Foul ------------------------------------------------------------------
  const foul = detectFoul(state.groups, shooter, onEight, outcome, objectPots.length);
  if (foul !== null) {
    return finalize({
      turn: opponent,
      groups: state.groups,
      pocketed: nextPocketed, // balls potted on a foul stay down
      ballInHand: 'anywhere',
      foul,
      winner: null,
    });
  }

  // --- Legal shot, open table: claim a group on the first pot -----------------
  if (state.groups[shooter] === null) {
    if (objectPots.length > 0) {
      return finalize({
        turn: shooter, // a legal pot always continues the turn
        groups: assign(shooter, groupOf(objectPots[0] as number)),
        pocketed: nextPocketed,
        ballInHand: 'none',
        foul: null,
        winner: null,
      });
    }
    // Legal but dry: the table stays open and the turn passes.
    return finalize({
      turn: opponent,
      groups: state.groups,
      pocketed: nextPocketed,
      ballInHand: 'none',
      foul: null,
      winner: null,
    });
  }

  // --- Legal shot, group assigned: continue only on potting one's own ---------
  const shooterGroup = state.groups[shooter];
  const pottedOwn = objectPots.some((id) => groupOf(id) === shooterGroup);
  return finalize({
    turn: pottedOwn ? shooter : opponent,
    groups: state.groups,
    pocketed: nextPocketed,
    ballInHand: 'none',
    foul: null,
    winner: null,
  });
};
