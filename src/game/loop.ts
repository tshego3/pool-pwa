// The rAF-driven fixed-timestep loop. Plain module: no React, no engine or
// render imports (it only sequences callbacks the caller provides). Physics
// advances in whole 1/120 s steps via an accumulator; rendering interpolates by
// the leftover alpha. A per-frame step cap plus backlog discard is the
// spiral-of-death guard for long stalls (tab backgrounded, then restored).

// Fixed physics timestep in seconds. Single source of truth; never scaled by
// frame rate. Mirrors the engine's dt (see src/engine/config.ts).
export const FIXED_DT = 1 / 120;

// Max fixed steps run in one frame before the remaining backlog is dropped.
// ~66 ms of catch-up at 120 Hz; beyond that we resync rather than fast-forward.
export const DEFAULT_MAX_STEPS_PER_FRAME = 8;

export interface StepPlan {
  readonly steps: number;
  // Leftover time carried to the next frame, always in [0, dt).
  readonly accumulator: number;
}

// Pure accumulator math, extracted so the spiral-of-death guard is unit
// testable without a clock. Runs whole steps while time remains, caps the
// count, and discards any backlog past the cap so the returned accumulator is
// always sub-dt (a valid interpolation remainder).
export const planSteps = (
  accumulator: number,
  dt: number,
  maxSteps: number,
): StepPlan => {
  let acc = accumulator;
  let steps = 0;
  while (acc >= dt && steps < maxSteps) {
    acc -= dt;
    steps += 1;
  }
  // Hit the cap with time to spare: drop the backlog, keep a sub-dt remainder.
  const leftover = acc >= dt ? acc % dt : acc;
  return { steps, accumulator: leftover };
};

export interface FixedLoopOptions {
  // Advance the simulation exactly one fixed tick. The caller is expected to
  // snapshot the current state into "previous" before mutating, so onRender can
  // interpolate between them.
  readonly onStep: () => void;
  // Render one frame; alpha in [0, 1) is the interpolation factor between the
  // previous and current physics state.
  readonly onRender: (alpha: number) => void;
  readonly dt?: number;
  readonly maxStepsPerFrame?: number;
  // Injectable for tests; default requestAnimationFrame / cancelAnimationFrame.
  readonly requestFrame?: (cb: (timeMs: number) => void) => number;
  readonly cancelFrame?: (id: number) => void;
}

export interface FixedLoop {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export const createLoop = (options: FixedLoopOptions): FixedLoop => {
  const dt = options.dt ?? FIXED_DT;
  const maxSteps = options.maxStepsPerFrame ?? DEFAULT_MAX_STEPS_PER_FRAME;
  const requestFrame =
    options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
  const cancelFrame = options.cancelFrame ?? ((id) => cancelAnimationFrame(id));

  let accumulator = 0;
  let lastMs = 0;
  let hasLast = false;
  let running = false;
  let frameId = 0;

  const frame = (timeMs: number): void => {
    if (!running) return;
    const elapsedMs = hasLast ? timeMs - lastMs : 0;
    lastMs = timeMs;
    hasLast = true;
    // Guard against negative or NaN deltas from a misbehaving clock.
    accumulator += Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs / 1000 : 0;
    const plan = planSteps(accumulator, dt, maxSteps);
    for (let i = 0; i < plan.steps; i++) options.onStep();
    accumulator = plan.accumulator;
    options.onRender(accumulator / dt);
    frameId = requestFrame(frame);
  };

  const start = (): void => {
    if (running) return;
    running = true;
    hasLast = false;
    accumulator = 0;
    frameId = requestFrame(frame);
  };

  const stop = (): void => {
    if (!running) return;
    running = false;
    cancelFrame(frameId);
  };

  return { start, stop, isRunning: () => running };
};
