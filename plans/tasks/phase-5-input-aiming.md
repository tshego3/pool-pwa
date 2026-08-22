# Phase 5 — Input & Aiming

**Depends on:** Phases 3, 4
**Blocks:** Phase 8

## Tasks
- [x] `src/game/aiming.ts` (pure): pointer position → shot angle/power; ghost-ball guide-line computation using a short deterministic engine prediction (cue path + first-contact deflection). Extended since: the contact also carries both post-contact paths (`cueAfter`, `objectAfter`), each traced with `step()` until the ball rests, pockets, or hits something, and `maxBounces` lets the cue path follow cushions.
- [x] `src/game/input.ts`: Pointer Events unifying mouse/touch; drag-to-aim from cue ball (or anywhere on table); pull-back power meter; cancel gesture; `touch-action: none` on canvas.
- [x] Ball-in-hand placement: drag cue ball, legality validation (pure function — no overlap, in bounds / behind head string after break scratch).
- [x] Hit targets ≥44px screen-equivalent regardless of ball pixel size. (Cue-ball grab uses `max(ballPx, 44px)` in `input.ts`; `AimControls` uses 44px targets.)
- [x] Accessibility fallback controls in HUD: angle nudge buttons (fine ±), power slider — keyboard-operable. (`src/components/AimControls.tsx`, presentational; mounted in a screen in Phase 8.)

## Acceptance criteria
- [x] Unit tests: aiming math (pointer→angle/power across quadrants), guide-line prediction matches engine first-contact, placement-legality function (overlap, out-of-bounds, kitchen rule) — all pass. (`src/game/aiming.test.ts`, 11 cases; full suite 73 passing.)
- [~] Manual on desktop: drag-to-aim, power, shoot, cancel all work with mouse. **Partial:** the Playwright suite (`e2e/`) now drives drag-to-aim, the power drag, and shoot with a real mouse against the mounted game screen, and asserts the guide redraws with the aim. The **cancel gesture is not covered** by any spec and is still unverified.
- [ ] Manual on a real touch device via `vite preview --host`: same flows work; page never scrolls/zooms during aiming; targets comfortably tappable. — Still unverified: the Playwright suite runs desktop Chrome only, so this needs either a real device or a mobile-emulation project added to `playwright.config.ts`. `touch-action: none` is set on the canvas by `input.ts`.
- [~] A shot can be fully set up and taken using only the fallback HUD controls (no drag), with keyboard. **Partial:** `e2e/guide-bounces.spec.ts` sets a shot up through the angle nudge buttons and `e2e/bot-pacing.spec.ts` takes one via the power control and Shoot button, so the fallback path works end to end. It is **not yet driven by keyboard alone** — the power control is a pointer slider with no key handling.
- [x] `src/game/aiming.ts` remains pure (no DOM imports — grep check). (Grep test in `src/game/aiming.test.ts`.)

## Verification (2026-08-23)
- Aiming guide extended to predict both post-contact paths; `src/game/aiming.test.ts` is now 18 cases (full unit suite 146 passing).
- End-to-end coverage added in `e2e/`: `aim-guide.spec.ts` (the guide redraws with the aim, and clears while balls move) and `guide-bounces.spec.ts` (the cushion-following setting reaches the canvas). `npm run test:e2e` — 9 passed.
