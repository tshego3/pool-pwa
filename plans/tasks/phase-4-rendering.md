# Phase 4 — Table Rendering (Canvas 2D)

**Depends on:** Phase 3
**Blocks:** Phases 5, 8

## Tasks
- [x] `src/render/palette.ts`: all felt/ball/cushion/guide colors (single source, per design-system skill).
- [x] `src/render/transform.ts`: table-space → pixel transform; DPR scaling (`devicePixelRatio`, cap at 2); ResizeObserver-driven resize; responsive letterboxing; optional portrait rotation.
- [x] `src/render/table.ts`: static layer (felt, cushions, pockets, markings) pre-rendered to an offscreen canvas, redrawn only on resize.
- [x] `src/render/balls.ts`: solids/stripes/numbers/cue/8-ball drawing without per-frame gradients or allocations.
- [x] `src/render/renderer.ts`: `createRenderer(canvas) → { draw(prev, curr, alpha), resize() }` — composites static layer + dynamic balls + guide-line overlay, interpolating positions by `alpha`.
- [x] `src/game/loop.ts`: rAF loop with fixed-timestep accumulator (1/120s), accumulator clamp (spiral-of-death guard on tab restore), interpolated render; plain module, zero React imports.

## Acceptance criteria
- Unit tests for `transform.ts` (round-trip table↔pixel, DPR scaling, letterbox math) pass.
- Visual check: table + racked balls render crisply at phone/tablet/desktop sizes and DPR 1/2/3 (no blur, no distortion).
- Simulated full break (16 balls moving): frame time stays under 16ms on a mid-range device; no per-frame allocations visible in DevTools performance recording (no GC sawtooth).
- Backgrounding the tab and returning does not cause a physics fast-forward burst (accumulator clamp verified manually).
- No React imports under `src/render/` or in `src/game/loop.ts` (grep check).
