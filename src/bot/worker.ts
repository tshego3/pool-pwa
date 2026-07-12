// Web Worker wrapper around the pure planner, so shot planning never blocks the
// render loop. It reuses the exact same enumerate -> score -> noise building
// blocks as planShot(), but drives the scoring loop itself so it can time-box the
// search with the wall clock and return the best candidate found so far on
// timeout. This file is the bot layer's only side-effecting boundary: it talks to
// the outside solely through Worker message passing (no fetch, no DOM), keeping
// the bot fully offline. All randomness still flows from the request `seed`.

import type { BotPlanRequest, BotPlanResponse } from '../types/bot';
import type { ShotInput } from '../types/physics';
import { createPrng } from '../engine/prng';
import { enumerateCandidates } from './candidates';
import { scoreCandidate } from './evaluate';
import { DIFFICULTY_PARAMS, applyDifficultyNoise } from './index';

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
  let bestShot: ShotInput = candidates[0]?.shot ?? { angle: 0, power: 0.3 };
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const score = scoreCandidate(candidate, game, balls, geometry, config);
    if (score > bestScore) {
      bestScore = score;
      bestShot = candidate.shot;
    }
    if (performance.now() - started > PLAN_BUDGET_MS) break;
  }

  const shot = applyDifficultyNoise(bestShot, params, createPrng(seed));
  ctx.postMessage({ id, shot });
};
