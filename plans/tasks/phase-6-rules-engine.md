# Phase 6 — 8-Ball Rules Engine (pure state machine)

**Depends on:** Phase 3 (PhysicsEvent vocabulary)
**Blocks:** Phases 7, 8, 9

## Tasks
- [x] `src/types/rules.ts`: `GameState` (phase: break/open/assigned/on-8/finished; seats `player`/`bot`; groups; ball-in-hand flag; foul reason; winner), `ShotOutcome` derived from the engine event log (first contact, rails after contact, pocketed balls, cue scratch).
- [x] `src/rules/outcome.ts`: pure `deriveOutcome(events) → ShotOutcome`.
- [x] `src/rules/eightBall.ts`: pure `reduce(gameState, outcome) → GameState` covering: rack layout constant; break legality (≥4 balls to rail or a ball pocketed); open table + solids/stripes assignment (on legal pocket only); legal-shot determination (correct first contact, rail-after-contact requirement); fouls → ball-in-hand (kitchen rule on break scratch); turn continuation on legal pot; 8-ball win, and loss on early/scratch-with-8 pocketing; two-seat alternation player↔bot.
- [x] Edge cases explicitly handled + tested: simultaneous pockets, cue + 8 pocketed together, 8 pocketed on break (**re-rack — same player breaks again**; documented in the pool-pwa-physics-rules skill).
- [x] `src/game/controller.ts`: glue — input → `simulate()` → `deriveOutcome()` → `reduce()` → persist/notify (via injected `onChange`); owns whose turn it is and hands bot turns to Phase 7's planner (injected `ShotPlanner`).

## Acceptance criteria
- [x] Table-driven Vitest suite: one case per rule above (break foul, open-table assignment, scratch → ball-in-hand, wrong-group first contact foul, early 8-ball loss, legal win, turn continuation) — all pass.
- [x] Property test: reducer applied to any valid outcome from any valid state never yields an invalid state (both groups assigned to one seat, invalid/duplicate ball ids, play continuing after `finished`) — 200 seeded random shot sequences.
- [x] Determinism: reducer is pure — same inputs give identical output objects (no Date/random).
- [x] No DOM/React imports under `src/rules/` (grep check via `src/rules/purity.test.ts`); `npm test` green.

## Verification (2026-07-12)
- `npx tsc --noEmit` — clean.
- `npx vitest run` — 17 files, **109 tests passing**.
- `npx eslint` on new files — clean.
