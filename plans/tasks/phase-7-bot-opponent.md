# Phase 7 — Bot Opponent (local, offline AI)

**Depends on:** Phases 3, 6 (engine as simulator, rules as scorer)
**Blocks:** Phase 8 (bot HUD states), Phase 9 (difficulty in snapshot/stats)

## Tasks
- [x] `src/bot/candidates.ts` (pure): enumerate candidate shots — for each legal target ball × pocket compute ghost-ball aim point + required power; add safety shots; ball-in-hand placement candidates when applicable.
- [x] `src/bot/evaluate.ts` (pure): run each candidate through `simulate()` + `deriveOutcome()` + rules scoring: legal pot > safety > foul avoidance; positional bonus for next-shot ease.
- [x] `src/bot/index.ts`: `planShot(gameState, ballState, difficulty, seed) → ShotInput`. Difficulty tiers easy/medium/hard = seeded aim/power noise (larger at lower tiers) + candidate-count cap; all randomness from the seeded PRNG. (Full signature also takes geometry+config; `createBotPlanner(difficulty, seed)` adapts it to the controller's `ShotPlanner`.)
- [x] `src/bot/worker.ts`: Web Worker wrapper (spawned via `new Worker(new URL('../bot/worker.ts', import.meta.url), { type: 'module' })` in `src/game/botClient.ts`) so planning never blocks the render loop; time-box the search and return best-so-far on timeout.
- [~] Controller integration: the controller already exposes the planner seam (`plan`, `playBotTurn`, `isBotTurn`), and `src/game/botClient.ts` provides the async worker client. Wiring "bot thinking" / aim animation into the game screen is Phase 8 (no game screen exists yet).
- [x] Guarantee: `src/bot/` has zero network/DOM imports (worker messaging only) — bot is fully offline (enforced by `src/bot/purity.test.ts`).

## Acceptance criteria
- [x] Vitest: with a fixed seed and a trivial layout (straight open shot), `planShot` at hard difficulty returns a shot that pots the ball. (`src/bot/index.test.ts`)
- [x] Property test over seeded random legal states: `planShot` always returns a legal, well-formed ShotInput (never a foul-by-construction like wrong ball-in-hand placement). (`src/bot/index.test.ts`, 60 organic states across all tiers; placement re-validated with `validateCuePlacement`)
- [x] Difficulty ordering: over a seeded scenario set, hard pots ≥ medium ≥ easy. (`src/bot/index.test.ts`, 6 scenarios × 10 seeds)
- [~] Planning completes within the time-box (< ~1.5s) on a mid-range phone; UI stays at 60fps while the worker plans (manual check). Time-box implemented (1.2s wall-clock backstop in `worker.ts`) and the candidate cap bounds the work; on-device 60fps/phone check is pending the Phase 8 game screen.
- [~] Worker chunk builds under Vite and is listed in the precache manifest (checked again in Phase 9). Verified the worker emits as its own Vite chunk (`worker-*.js`, ~12 kB) and joins the precache manifest when a consumer imports `createBotClient`; no consumer exists until the Phase 8 screen, so final manifest inclusion lands then / is re-checked in Phase 9.
- [ ] Full manual game vs bot at each difficulty completes without stalls or illegal bot shots. Pending the Phase 8 game screen (no manual play surface yet).

## Verification (2026-07-12)
- `npm test` — 122 passed (13 new bot tests). `npm run lint` — clean. `npm run build` — TypeScript + Vite + SW build all green.
- Worker chunk emission and precache inclusion confirmed via a temporary `createBotClient` import (reverted): `dist/assets/worker-*.js` present, precache grew from 6 to 7 entries.
