# Phase 3 — Physics Engine Core (pure TS, no DOM)

**Depends on:** Phase 1 (Phase 2 for conventions)
**Blocks:** Phases 4, 5, 6, 7

## Tasks
- [x] `src/types/physics.ts`: `Vec2`, `Ball` (id, position, velocity, spin placeholder, pocketed flag), `TableGeometry` (cushion segments, pocket positions/radii, dimensions), `ShotInput` (angle, power, cue placement), `PhysicsEvent` union (`first-contact`, `rail`, `pocket`, `rest`). Also added `ball-ball` event, `PhysicsState`, and `PhysicsConfig`.
- [x] `src/engine/vec2.ts`: add/sub/scale/dot/length/normalize — mutating variants for hot path + pure variants for tests.
- [x] `src/engine/prng.ts`: seeded PRNG (e.g. mulberry32); no `Math.random` anywhere in engine/rules/bot.
- [x] `src/engine/collision.ts`: ball–ball elastic collision with restitution; cushion segment reflection; **swept-circle continuous detection** (time-of-impact) for both, to prevent tunneling.
- [x] `src/engine/friction.ts`: sliding→rolling transition, rolling resistance, stop-velocity threshold.
- [x] `src/engine/pockets.ts`: capture radius + mouth geometry test.
- [x] `src/engine/step.ts`: pure `step(state, dt) → { state, events }` at fixed dt (1/120s); adaptive substep when displacement > ¼ ball radius. (Signature: `step(state, geo, cfg)`; `dt` lives in `cfg`.)
- [x] `src/engine/simulate.ts`: `simulate(state, shot) → { finalState, events }` — run to rest, capped max steps (spiral guard). (Signature: `simulate(state, shot, geo, cfg)`.)
- [x] `src/engine/tables/eightBall.ts`: data-driven table geometry + rack layout (snooker later = new file).
- [x] `src/engine/config.ts`: `DEFAULT_PHYSICS` tunable constants (supporting module; keeps `step`/`simulate` pure by passing config in).

## Acceptance criteria (Vitest, co-located)
- [x] Head-on equal-mass collision: velocities exchange within tolerance; momentum conserved in glancing collisions. — `collision.test.ts`
- [x] Cushion: angle of incidence = angle of reflection (× restitution) for several angles. — `collision.test.ts` (`reflect`), `step.test.ts` (rail event + reflection)
- [x] Determinism: same state + same ShotInput run twice → identical event logs and final positions (exact equality). — `simulate.test.ts` + replay fixture in `__fixtures__/`
- [x] Tunneling regression: cue ball at extreme velocity aimed at a ball/cushion never passes through (events always fire). — `simulate.test.ts`
- [x] Every simulation reaches `rest` within the step cap for randomized (seeded) shots. — `simulate.test.ts`
- [x] No DOM/React/`Math.random`/`Date.now` imports anywhere under `src/engine/` (grep check). — `purity.test.ts`
- [x] `npm run lint` + `npm test` pass. — verified: lint clean, 47/47 tests pass, `npm run build` (tsc + vite) succeeds.
