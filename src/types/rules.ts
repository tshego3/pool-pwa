// Pure 8-ball rules domain types. This layer knows nothing about physics math,
// pixels, the DOM, or a clock: it consumes a ShotOutcome (derived from the
// engine's PhysicsEvent log) and advances a GameState. See src/rules/ for the
// pure reducer and outcome derivation.

// The two seats in a one-on-one game. Turns strictly alternate player <-> bot
// except when the shooter earns a continuation with a legal pot.
export type Seat = 'player' | 'bot';

// The two object-ball groups. Solids are ids 1-7, stripes are ids 9-15; the
// 8-ball (id 8) belongs to neither and is pocketed last.
export type BallGroup = 'solids' | 'stripes';

// Coarse game phase, used by the UI and to gate legality:
//  - break:    the opening shot from the full rack (groups unassigned).
//  - open:     the break is done but no group is assigned yet.
//  - assigned: each seat owns a group and still has group balls on the table.
//  - on-8:     the seat to shoot has cleared its group and is on the 8-ball.
//  - finished: a winner has been decided; the reducer is a no-op afterwards.
export type GamePhase = 'break' | 'open' | 'assigned' | 'on-8' | 'finished';

// Why the last shot was a foul, or null when it was legal. Surfaced to the UI
// and drives ball-in-hand.
export type FoulReason =
  | 'cue-scratch' // the cue ball was pocketed
  | 'no-contact' // the cue ball hit nothing
  | 'wrong-ball-first' // first contact was not a legal target for the phase
  | 'no-rail' // after contact no ball hit a rail and none was pocketed
  | 'illegal-break'; // the break drove <4 balls to a rail and potted nothing

// Ball-in-hand grant for the incoming shooter:
//  - none:     place is fixed; shoot from where the cue ball rests.
//  - anywhere: free placement anywhere on the table (standard foul).
//  - kitchen:  placement restricted to behind the head string (break scratch).
export type BallInHand = 'none' | 'anywhere' | 'kitchen';

// Immutable rules snapshot for one game. `pocketed` lists every object ball
// (never the cue) sent down so far, so per-seat progress and the on-8 condition
// are derivable rather than duplicated. `groups` maps each seat to its assigned
// group (null until the table is claimed) and the reducer keeps the two seats'
// groups complementary.
export interface GameState {
  readonly phase: GamePhase;
  readonly turn: Seat;
  readonly groups: Readonly<Record<Seat, BallGroup | null>>;
  readonly pocketed: readonly number[];
  readonly ballInHand: BallInHand;
  readonly foul: FoulReason | null;
  readonly winner: Seat | null;
}

// Everything the reducer needs from one shot, distilled from the engine event
// log by deriveOutcome(). Pure data: no ticks or geometry leak through.
export interface ShotOutcome {
  // The first object ball the cue ball touched, or -1 if it hit nothing.
  readonly firstContact: number;
  // Object balls pocketed this shot, in the order they dropped. Excludes the
  // cue ball (see cueScratch); may include the 8-ball.
  readonly pocketed: readonly number[];
  // The cue ball was pocketed (a scratch).
  readonly cueScratch: boolean;
  // Some ball reached a rail after the cue ball's first contact. Combined with
  // `pocketed` this settles the no-rail foul.
  readonly railAfterContact: boolean;
  // How many distinct balls contacted a rail over the whole shot. Used only for
  // break legality (>= 4 balls driven to a rail).
  readonly railedBallCount: number;
}
