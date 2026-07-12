// A single playable game session: the facade the GameScreen drives. It composes
// the pure controller (rules/authority), the engine step() for frame-by-frame
// animation, and the bot Web Worker client, and publishes shot-boundary
// snapshots for the HUD. Living in src/game (the I/O boundary) it may spawn the
// worker and read a clock; the pure layers it glues never do.
//
// Authority vs animation: the controller resolves each shot with simulate() from
// the resting pre-shot state, so it is the single source of truth. This session
// re-plays that same shot tick-by-tick through step() purely to animate; because
// the engine is deterministic the animated final state matches the controller's,
// then we snap the render buffers to the authoritative rest positions.

import type {
  Ball,
  PhysicsConfig,
  PhysicsState,
  ShotInput,
  TableGeometry,
  Vec2,
} from '../types/physics';
import type { GameState, Seat } from '../types/rules';
import type { AimResult, PlacementResult } from '../types/aiming';
import type { Difficulty } from '../types/bot';
import type { GameResult } from '../types/persistence';
import { step } from '../engine/step';
import { isMoving } from '../engine/friction';
import { createEightBallTable } from '../engine/tables/eightBall';
import { DEFAULT_PHYSICS } from '../engine/config';
import {
  createController,
  type Controller,
  type ControllerSnapshot,
  type ShotResolution,
} from './controller';
import { createBotClient, type BotClient } from './botClient';
import { predictGuide, validateCuePlacement } from './aiming';

// Straight cue -> target aiming aid the renderer draws (structurally matches the
// renderer's GuideOverlay so the game layer needs no render import).
export interface GuideAid {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly impact?: Vec2;
}

// The shot-boundary snapshot the HUD subscribes to. `thinking`/`animating` are
// discrete transitions (never per-frame), so subscribers re-render at most a
// handful of times per turn and never during ball motion.
export interface GameView {
  readonly game: GameState;
  readonly balls: readonly Ball[];
  readonly thinking: boolean;
  readonly animating: boolean;
}

export interface GameSessionOptions {
  readonly difficulty: Difficulty;
  // Base PRNG seed for bot planning. A wall-clock seed keeps each game varied
  // while every individual plan stays deterministic for its snapshot.
  readonly seed: number;
  readonly breaker?: Seat;
  // Restore a saved game (resume flow): the at-rest ball field and rules state.
  readonly restore?: ControllerSnapshot;
  // Persist the resume slot at a shot boundary (unfinished game). Fired only
  // between shots, never mid-simulation. The session adds no version/seed here;
  // the caller wraps this into a full snapshot for src/db.
  readonly onPersist?: (snapshot: ControllerSnapshot) => void;
  // Fired once when the game ends, with the player's accumulated result.
  readonly onGameEnd?: (result: GameResult) => void;
}

export interface GameSession {
  readonly geometry: TableGeometry;
  readonly config: PhysicsConfig;
  // Render buffers: the two states the renderer interpolates between.
  prevState(): PhysicsState;
  currState(): PhysicsState;
  // Advance one fixed tick (called from the loop). No-op unless animating.
  step(): void;
  // Kick off the opening turn (drives the bot if it breaks).
  start(): void;
  // Begin animating a player shot for the current aim.
  shoot(aim: AimResult): void;
  // Cue position to aim from, or null when the shot is not aimable.
  cuePosition(): Vec2 | null;
  // Ball-in-hand placement (facade-side legality + preview).
  placementActive(): boolean;
  validatePlacement(pos: Vec2): PlacementResult;
  previewPlacement(pos: Vec2): void;
  commitPlacement(pos: Vec2): void;
  // Guide-line aid for an aim, or null when there is nothing to draw.
  computeGuide(aim: AimResult): GuideAid | null;
  subscribe(listener: () => void): () => void;
  getView(): GameView;
  dispose(): void;
}

type Listener = () => void;

const cloneBall = (b: Ball): Ball => ({
  id: b.id,
  position: { x: b.position.x, y: b.position.y },
  velocity: { x: b.velocity.x, y: b.velocity.y },
  spin: { x: b.spin.x, y: b.spin.y },
  radius: b.radius,
  pocketed: b.pocketed,
});

const snapshotPhysics = (balls: readonly Ball[]): PhysicsState => ({
  tick: 0,
  balls: balls.map(cloneBall),
});

const findCue = (balls: readonly Ball[], cueId: number): Ball | undefined =>
  balls.find((b) => b.id === cueId);

// Launch the cue ball from the shot; mirrors the engine's private applyShot so
// the animated first frame matches simulate()'s trajectory exactly.
const launchCue = (state: PhysicsState, shot: ShotInput, cfg: PhysicsConfig): void => {
  const cue = findCue(state.balls, cfg.cueBallId);
  if (cue === undefined) return;
  if (shot.cuePlacement !== undefined) {
    cue.position = { x: shot.cuePlacement.x, y: shot.cuePlacement.y };
    cue.pocketed = false;
  }
  const speed = Math.max(0, Math.min(1, shot.power)) * cfg.maxLaunchSpeed;
  cue.velocity = { x: Math.cos(shot.angle) * speed, y: Math.sin(shot.angle) * speed };
};

const anyMoving = (state: PhysicsState, cfg: PhysicsConfig): boolean =>
  state.balls.some((b) => isMoving(b, cfg));

export const createGameSession = (options: GameSessionOptions): GameSession => {
  const geometry = createEightBallTable();
  const config = DEFAULT_PHYSICS;
  const cueId = config.cueBallId;
  // Behind the head string: the cue's rack position marks the kitchen boundary.
  const kitchenMaxX = geometry.width * 0.25;
  const headSpot: Vec2 = { x: geometry.width * 0.25, y: geometry.height / 2 };

  const bot: BotClient = createBotClient();
  const listeners = new Set<Listener>();
  let disposed = false;

  let animating = false;
  let thinking = false;
  let pendingShot: ShotInput | null = null;
  let pendingPlacement: Vec2 | null = null;

  // Player-only running stats for the current game, folded into a GameResult at
  // the end. A resumed game counts only shots played after the resume.
  let playerPotted = 0;
  let playerFouls = 0;
  let curStreak = 0;
  let bestStreak = 0;
  let ended = false;

  let prev: PhysicsState;
  let curr: PhysicsState;
  let view: GameView;

  const controller: Controller = createController({
    geometry,
    config,
    breaker: options.breaker,
    initial: options.restore,
    onChange: () => publish(),
  });

  function publish(): void {
    view = { game: controller.game(), balls: controller.balls(), thinking, animating };
    for (const l of listeners) l();
  }

  // Snap the render buffers to the controller's authoritative rest state.
  function syncRenderToController(): void {
    curr = snapshotPhysics(controller.balls());
    prev = snapshotPhysics(controller.balls());
  }

  function setLiveCue(pos: Vec2): void {
    for (const state of [prev, curr]) {
      const cue = findCue(state.balls, cueId);
      if (cue !== undefined) {
        cue.position = { x: pos.x, y: pos.y };
        cue.pocketed = false;
      }
    }
  }

  // On the player's ball-in-hand, seed a legal default placement only when the
  // cue was pocketed (so the shot is playable at all). When the cue is still on
  // the table the player may shoot as it lies or drag it (placementActive), so
  // we leave it untouched.
  function offerBallInHand(): void {
    const game = controller.game();
    if (game.winner !== null || game.turn !== 'player' || game.ballInHand === 'none') return;
    const cue = findCue(curr.balls, cueId);
    if (cue !== undefined && !cue.pocketed) return;
    pendingPlacement = { ...headSpot };
    setLiveCue(headSpot);
  }

  function beginShot(shot: ShotInput): void {
    pendingShot = shot;
    const start = snapshotPhysics(controller.balls());
    launchCue(start, shot, config);
    prev = start;
    curr = snapshotPhysics(start.balls);
    animating = true;
    publish();
  }

  function finishShot(): void {
    animating = false;
    const shot = pendingShot;
    pendingShot = null;
    if (shot === null) {
      syncRenderToController();
      publish();
      return;
    }
    const shooter = controller.game().turn;
    const resolution = controller.applyShot(shot); // authoritative; fires onChange -> publish
    syncRenderToController();
    recordShot(shooter, resolution);
    offerBallInHand();
    maybeStartBotTurn();
  }

  // Fold one resolved shot into the player's running stats (player shots only).
  function accumulatePlayerStats(shooter: Seat, resolution: ShotResolution): void {
    if (shooter !== 'player') return;
    const pots = resolution.outcome.pocketed.length; // object balls (excludes the cue)
    playerPotted += pots;
    if (resolution.game.foul !== null) playerFouls += 1;
    if (pots > 0) {
      curStreak += 1;
      bestStreak = Math.max(bestStreak, curStreak);
    } else {
      curStreak = 0;
    }
  }

  // At each shot boundary: update stats, then either finish the game (emit the
  // result) or persist the resume slot. Snapshots are saved here only, between
  // shots, never mid-simulation.
  function recordShot(shooter: Seat, resolution: ShotResolution): void {
    accumulatePlayerStats(shooter, resolution);
    const game = resolution.game;
    if (game.winner !== null) {
      if (ended) return;
      ended = true;
      options.onGameEnd?.({
        difficulty: options.difficulty,
        won: game.winner === 'player',
        potted: playerPotted,
        fouls: playerFouls,
        streak: bestStreak,
      });
      return;
    }
    options.onPersist?.({ game, balls: controller.balls() });
  }

  function maybeStartBotTurn(): void {
    const game = controller.game();
    if (disposed || game.winner !== null || game.turn !== 'bot') return;
    thinking = true;
    publish();
    const seed = options.seed + game.pocketed.length;
    bot
      .plan({ game, balls: controller.balls(), geometry, config, difficulty: options.difficulty, seed })
      .then((shot) => {
        if (disposed) return;
        thinking = false;
        beginShot(shot);
      })
      .catch(() => {
        // Planning failed: leave the turn idle rather than crash. Logged so the
        // stall is diagnosable; the player can restart from the menu.
        thinking = false;
        publish();
        console.error('bot planning failed; the game cannot continue this turn');
      });
  }

  const canAim = (): boolean => {
    const game = controller.game();
    return !animating && !thinking && game.winner === null && game.turn === 'player';
  };

  syncRenderToController();
  view = { game: controller.game(), balls: controller.balls(), thinking, animating };

  return {
    geometry,
    config,
    prevState: () => prev,
    currState: () => curr,
    step: () => {
      if (!animating) return;
      prev = curr;
      curr = step(curr, geometry, config).state;
      if (!anyMoving(curr, config)) finishShot();
    },
    start: () => maybeStartBotTurn(),
    shoot: (aim) => {
      if (!canAim()) return;
      const shot: ShotInput =
        pendingPlacement !== null
          ? { angle: aim.angle, power: aim.power, cuePlacement: pendingPlacement }
          : { angle: aim.angle, power: aim.power };
      pendingPlacement = null;
      beginShot(shot);
    },
    cuePosition: () => {
      if (!canAim()) return null;
      const cue = findCue(curr.balls, cueId);
      return cue !== undefined && !cue.pocketed ? { x: cue.position.x, y: cue.position.y } : null;
    },
    placementActive: () => canAim() && controller.game().ballInHand !== 'none',
    validatePlacement: (pos) =>
      validateCuePlacement(pos, curr, geometry, {
        cueBallId: cueId,
        kitchenMaxX: controller.game().ballInHand === 'kitchen' ? kitchenMaxX : undefined,
      }),
    previewPlacement: (pos) => setLiveCue(pos),
    commitPlacement: (pos) => {
      pendingPlacement = { x: pos.x, y: pos.y };
      setLiveCue(pos);
    },
    computeGuide: (aim) => {
      if (!canAim() || aim.power <= 0) return null;
      const guide = predictGuide(curr, aim, geometry, config);
      const path = guide.cuePath;
      if (path.length < 2) return null;
      const from = path[0];
      const to = path[path.length - 1];
      if (from === undefined || to === undefined) return null;
      return guide.contact !== null
        ? { from, to, impact: guide.contact.ghost }
        : { from, to };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getView: () => view,
    dispose: () => {
      disposed = true;
      listeners.clear();
      bot.terminate();
    },
  };
};
