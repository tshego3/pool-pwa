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
import type { AimResult, GuideOptions, PlacementResult } from '../types/aiming';
import type { BotPlan, Difficulty } from '../types/bot';
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
import { legalTargets } from '../rules/eightBall';
import { createBotClient, type BotClient } from './botClient';
import { predictGuide, validateCuePlacement } from './aiming';

// The aiming aid the renderer draws: the cue's approach, the ghost ball at
// impact, and where each ball is predicted to travel from there. Structurally
// matches the renderer's GuideOverlay so the game layer needs no render import.
export interface GuideAid {
  // Cue-ball approach, including a vertex at every cushion the line follows.
  readonly path: readonly Vec2[];
  readonly impact?: Vec2;
  readonly cueAfter?: readonly Vec2[];
  readonly objectAfter?: readonly Vec2[];
  readonly blocked?: boolean;
}

// The shot-boundary snapshot the HUD subscribes to. `thinking`/`animating` are
// discrete transitions (never per-frame), so subscribers re-render at most a
// handful of times per turn and never during ball motion.
export interface GameView {
  readonly game: GameState;
  readonly balls: readonly Ball[];
  readonly thinking: boolean;
  readonly animating: boolean;
  // The bot's planned shot while it addresses the ball, else null. The HUD
  // mirrors it so the player can watch what the bot is about to do; it is
  // display only, and aiming stays locked for the whole bot turn.
  readonly botAim: AimResult | null;
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
  // Guide-line aid for an aim, or null when there is nothing to draw. `opts`
  // carries the user's guide settings (how many cushions the line follows).
  computeGuide(aim: AimResult, opts?: GuideOptions): GuideAid | null;
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

// The worker plans in a few milliseconds, so without pacing the bot fires the
// instant the player's balls stop, which reads as a machine rather than an
// opponent. The turn is spread over two beats: the visible "thinking" state is
// held for at least BOT_MIN_THINK_MS, then the bot settles over the shot for
// BOT_ADDRESS_MS before the cue strikes.
const BOT_MIN_THINK_MS = 2200;
const BOT_ADDRESS_MS = 900;
// How many of the shots the search weighed are replayed across the thinking
// beat. These are discrete steps a few hundred ms apart, not a per-frame
// animation, so the HUD still re-renders only a handful of times per turn.
const BOT_DELIBERATION_STEPS = 5;

// Floor power used only for the guide prediction, so the aim line stays on the
// table the whole time the player lines up a shot (a zero-power aim would
// otherwise predict a cue ball that never moves). Real shot power is untouched.
const GUIDE_PREVIEW_POWER = 0.35;

export const createGameSession = (options: GameSessionOptions): GameSession => {
  const geometry = createEightBallTable();
  const config = DEFAULT_PHYSICS;
  const cueId = config.cueBallId;
  // Behind the head string: the cue's rack position marks the kitchen boundary.
  const kitchenMaxX = geometry.width * 0.25;
  const headSpot: Vec2 = { x: geometry.width * 0.25, y: geometry.height / 2 };

  const bot: BotClient = createBotClient();
  const listeners = new Set<Listener>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let disposed = false;

  // Deferred work that must not fire after the screen unmounts.
  const later = (ms: number, fn: () => void): void => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!disposed) fn();
    }, ms);
    timers.add(id);
  };

  let animating = false;
  let thinking = false;
  let botAim: AimResult | null = null;
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
    view = { game: controller.game(), balls: controller.balls(), thinking, animating, botAim };
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
    botAim = null;
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

  // Replay the tail of the bot's search through the HUD while it "thinks": the
  // aim controls and the guide line step through the shots it actually weighed,
  // ending on the one it will play. Display only - every control stays disabled
  // for the whole bot turn and the player's own aim is never written.
  function showDeliberation(plan: BotPlan, holdMs: number, done: () => void): void {
    const trail = plan.considered.slice(-BOT_DELIBERATION_STEPS);
    const gap = trail.length > 0 ? holdMs / trail.length : 0;
    trail.forEach((shot, i) => {
      later(Math.round(gap * i), () => {
        botAim = { angle: shot.angle, power: shot.power };
        publish();
      });
    });
    later(holdMs, done);
  }

  function maybeStartBotTurn(): void {
    const game = controller.game();
    if (disposed || game.winner !== null || game.turn !== 'bot') return;
    thinking = true;
    publish();
    const seed = options.seed + game.pocketed.length;
    const startedAt = Date.now();
    bot
      .plan({ game, balls: controller.balls(), geometry, config, difficulty: options.difficulty, seed })
      .then((plan) => {
        if (disposed) return;
        const elapsed = Date.now() - startedAt;
        showDeliberation(plan, Math.max(BOT_MIN_THINK_MS - elapsed, 0), () => {
          // Deliberation is over. The HUD drops back to a plain "Bot's turn" and
          // settles on the shot it will play. When the bot has ball in hand,
          // show the cue where it will actually play from.
          const shot = plan.shot;
          thinking = false;
          botAim = { angle: shot.angle, power: shot.power };
          if (shot.cuePlacement !== undefined) setLiveCue(shot.cuePlacement);
          publish();
          later(BOT_ADDRESS_MS, () => beginShot(shot));
        });
      })
      .catch(() => {
        // Planning failed: leave the turn idle rather than crash. Logged so the
        // stall is diagnosable; the player can restart from the menu.
        thinking = false;
        botAim = null;
        publish();
        console.error('bot planning failed; the game cannot continue this turn');
      });
  }

  // Whether the shooter may legally strike this ball first. On an open table
  // every ball but the 8 is fair game; once groups are assigned it is the
  // seat's own remaining balls, or the 8 after those are cleared.
  const isLegalFirstContact = (ballId: number): boolean => {
    const game = controller.game();
    const targets = legalTargets(game, game.turn);
    return targets === null ? ballId !== 8 : targets.includes(ballId);
  };

  const canAim = (): boolean => {
    const game = controller.game();
    return !animating && !thinking && game.winner === null && game.turn === 'player';
  };

  syncRenderToController();
  view = { game: controller.game(), balls: controller.balls(), thinking, animating, botAim };

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
    computeGuide: (aim, opts) => {
      // While the bot addresses the ball the line belongs to its planned shot,
      // not to the player's stored aim.
      const source = botAim ?? (canAim() ? aim : null);
      if (source === null) return null;
      const preview = { angle: source.angle, power: Math.max(source.power, GUIDE_PREVIEW_POWER) };
      const guide = predictGuide(curr, preview, geometry, config, opts);
      const path = guide.cuePath;
      if (path.length < 2) return null;
      const contact = guide.contact;
      if (contact === null) return { path };
      // Aiming at a ball the shooter may not hit gets no help: the line goes
      // faint and the prediction is withheld, so an illegal shot looks wrong
      // before it is taken.
      if (!isLegalFirstContact(contact.ball)) return { path, blocked: true };
      return {
        path,
        impact: contact.ghost,
        cueAfter: contact.cueAfter,
        objectAfter: contact.objectAfter,
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getView: () => view,
    dispose: () => {
      disposed = true;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      listeners.clear();
      bot.terminate();
    },
  };
};
