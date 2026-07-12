# Phase 5 — Input & Aiming

**Depends on:** Phases 3, 4
**Blocks:** Phase 8

## Tasks
- [x] `src/game/aiming.ts` (pure): pointer position → shot angle/power; ghost-ball guide-line computation using a short deterministic engine prediction (cue path + first-contact deflection).
- [x] `src/game/input.ts`: Pointer Events unifying mouse/touch; drag-to-aim from cue ball (or anywhere on table); pull-back power meter; cancel gesture; `touch-action: none` on canvas.
- [x] Ball-in-hand placement: drag cue ball, legality validation (pure function — no overlap, in bounds / behind head string after break scratch).
- [x] Hit targets ≥44px screen-equivalent regardless of ball pixel size. (Cue-ball grab uses `max(ballPx, 44px)` in `input.ts`; `AimControls` uses 44px targets.)
- [x] Accessibility fallback controls in HUD: angle nudge buttons (fine ±), power slider — keyboard-operable. (`src/components/AimControls.tsx`, presentational; mounted in a screen in Phase 8.)

## Acceptance criteria
- [x] Unit tests: aiming math (pointer→angle/power across quadrants), guide-line prediction matches engine first-contact, placement-legality function (overlap, out-of-bounds, kitchen rule) — all pass. (`src/game/aiming.test.ts`, 11 cases; full suite 73 passing.)
- [ ] Manual on desktop: drag-to-aim, power, shoot, cancel all work with mouse. — Blocked on Phase 8: needs a game screen mounting the canvas + facade. `input.ts` is a node-tested-exempt DOM facade; verify once wired.
- [ ] Manual on a real touch device via `vite preview --host`: same flows work; page never scrolls/zooms during aiming; targets comfortably tappable. — Blocked on Phase 8 (same reason). `touch-action: none` is set on the canvas by `input.ts`.
- [ ] A shot can be fully set up and taken using only the fallback HUD controls (no drag), with keyboard. — Blocked on Phase 8: `AimControls` is built and keyboard-operable but not yet mounted in a screen.
- [x] `src/game/aiming.ts` remains pure (no DOM imports — grep check). (Grep test in `src/game/aiming.test.ts`.)
