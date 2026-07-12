// Game controller: the glue between the pure engine, the pure rules reducer, and
// the outside world. It owns the two pieces of authoritative state - the ball
// field (PhysicsState) and the rules snapshot (GameState) - and runs one shot
// through the pipeline:
//
//   ShotInput -> simulate() -> deriveOutcome() -> reduce() -> {balls, game}
//
// It lives in src/game (the facade), so unlike src/engine|rules|bot it may touch
// side effects - but those arrive only through injected callbacks (onChange for
// persistence/notify, plan for the Phase 7 bot), keeping this module itself
// deterministic and testable. It decides whose turn it is and, when that turn is
// the bot's, asks the injected planner for the shot.

import type {
  Ball,
  PhysicsConfig,
  PhysicsEvent,
  PhysicsState,
  ShotInput,
  TableGeometry,
} from '../types/physics';
import type { GameState, Seat, ShotOutcome } from '../types/rules';
import { simulate } from '../engine/simulate';
import { rackEightBall } from '../engine/tables/eightBall';
import { deriveOutcome } from '../rules/outcome';
import { createInitialState, reduce } from '../rules/eightBall';

// A bot planner (Phase 7). Given the rules and ball state it returns the shot to
// play. Injected so the controller has no dependency on the bot package.
export type ShotPlanner = (
  game: GameState,
  balls: readonly Ball[],
  geometry: TableGeometry,
  config: PhysicsConfig,
) => ShotInput;

export interface ControllerOptions {
  readonly geometry: TableGeometry;
  readonly config: PhysicsConfig;
  // Which seat breaks. Defaults to the human player.
  readonly breaker?: Seat;
  // Restore a saved game instead of starting a fresh rack (resume flow). When
  // present it supplies both the rules snapshot and the at-rest ball field.
  readonly initial?: ControllerSnapshot;
  // Called after every applied shot with the new immutable state, for
  // persistence/UI notification. The controller performs no I/O itself.
  readonly onChange?: (snapshot: ControllerSnapshot) => void;
  // Optional bot planner used to resolve bot turns (see playBotTurn).
  readonly plan?: ShotPlanner;
}

// The result of applying one shot: the derived outcome, the engine event log,
// and the new authoritative state.
export interface ShotResolution {
  readonly outcome: ShotOutcome;
  readonly events: readonly PhysicsEvent[];
  readonly game: GameState;
  readonly balls: readonly Ball[];
}

// A read-only view of the controller's authoritative state.
export interface ControllerSnapshot {
  readonly game: GameState;
  readonly balls: readonly Ball[];
}

export interface Controller {
  // Current rules snapshot.
  game(): GameState;
  // Current ball field (positions/pocketed flags).
  balls(): readonly Ball[];
  // True while it is the bot's turn and the game is unfinished.
  isBotTurn(): boolean;
  // Apply a shot for the seat whose turn it is and advance all state.
  applyShot(shot: ShotInput): ShotResolution;
  // Resolve the current bot turn via the injected planner. Throws if it is not
  // the bot's turn or no planner was provided.
  playBotTurn(): ShotResolution;
}

// A fresh rack keyed off the rules snapshot. Used at start and whenever the
// reducer signals a re-rack (8 on the break) by returning to the break phase.
const freshRack = (): PhysicsState => ({ tick: 0, balls: rackEightBall() });

// Deep-copy a restored ball field into the mutable buffer the engine steps.
const cloneBalls = (balls: readonly Ball[]): Ball[] =>
  balls.map((b) => ({
    id: b.id,
    position: { x: b.position.x, y: b.position.y },
    velocity: { x: b.velocity.x, y: b.velocity.y },
    spin: { x: b.spin.x, y: b.spin.y },
    radius: b.radius,
    pocketed: b.pocketed,
  }));

export const createController = (options: ControllerOptions): Controller => {
  const { geometry, config } = options;
  let game = options.initial?.game ?? createInitialState(options.breaker ?? 'player');
  let physics =
    options.initial !== undefined
      ? { tick: 0, balls: cloneBalls(options.initial.balls) }
      : freshRack();

  const notify = (): void => options.onChange?.({ game, balls: physics.balls });

  const applyShot = (shot: ShotInput): ShotResolution => {
    const { finalState, events } = simulate(physics, shot, geometry, config);
    const outcome = deriveOutcome(events);
    const next = reduce(game, outcome);

    // A reducer result back in the break phase means re-rack (8 on the break);
    // otherwise carry the settled ball field forward.
    physics = next.phase === 'break' ? freshRack() : finalState;
    game = next;

    notify();
    return { outcome, events, game, balls: physics.balls };
  };

  const isBotTurn = (): boolean => game.winner === null && game.turn === 'bot';

  const playBotTurn = (): ShotResolution => {
    if (!isBotTurn()) throw new Error('playBotTurn called when it is not the bot turn');
    if (options.plan === undefined) throw new Error('no shot planner was provided');
    return applyShot(options.plan(game, physics.balls, geometry, config));
  };

  return {
    game: () => game,
    balls: () => physics.balls,
    isBotTurn,
    applyShot,
    playBotTurn,
  };
};
