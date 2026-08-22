// Web Worker wrapper around the pure planner, so shot planning never blocks the
// render loop. It reuses the exact same enumerate -> score -> noise building
// blocks as planShot(), but drives the scoring loop itself so it can time-box the
// search with the wall clock and return the best candidate found so far on
// timeout. This file is the bot layer's only side-effecting boundary: it talks to
// the outside solely through Worker message passing (no fetch, no DOM), keeping
// the bot fully offline. All randomness still flows from the request `seed`.

import type { BotPlanRequest, BotPlanResponse } from '../types/bot';
import { createPrng } from '../engine/prng';
import { enumerateCandidates } from './candidates';
import { DIFFICULTY_PARAMS, applyDifficultyNoise, searchBestShot } from './index';

// Time-box for a single plan. The candidate cap already bounds the work; this is
// a wall-clock backstop so a pathological layout can never stall a caller.
const PLAN_BUDGET_MS = 1200;

// Minimal typed view of the worker global; avoids depending on the WebWorker lib.
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<BotPlanRequest>) => void) | null;
  postMessage: (message: BotPlanResponse) => void;
};

ctx.onmessage = (event: MessageEvent<BotPlanRequest>): void => {
  const { id, game, balls, geometry, config, difficulty, seed } = event.data;
  const params = DIFFICULTY_PARAMS[difficulty];
  const candidates = enumerateCandidates(game, balls, geometry, config, params.candidateCap);

  const started = performance.now();
  const search = searchBestShot(
    candidates,
    game,
    balls,
    geometry,
    config,
    () => performance.now() - started > PLAN_BUDGET_MS,
  );

  const shot = applyDifficultyNoise(search.shot, params, createPrng(seed));
  ctx.postMessage({ id, shot, considered: search.considered });
};
