# Plan: `pool-pwa` — Solo 8-Ball Pool PWA Browser Game

## Phase Task Files

Actionable per-phase tasks, dependencies, and acceptance criteria live under [plans/tasks/](tasks/); this document is the overview. Execute in dependency order:

| Phase | Task file | Depends on |
|---|---|---|
| 1 Scaffold & tooling | [phase-1-scaffold.md](tasks/phase-1-scaffold.md) | — |
| 2 `.claude` skills | [phase-2-claude-skills.md](tasks/phase-2-claude-skills.md) | 1 |
| 3 Physics engine | [phase-3-physics-engine.md](tasks/phase-3-physics-engine.md) | 1 (2 soft) |
| 4 Rendering | [phase-4-rendering.md](tasks/phase-4-rendering.md) | 3 |
| 5 Input & aiming | [phase-5-input-aiming.md](tasks/phase-5-input-aiming.md) | 3, 4 |
| 6 8-ball rules | [phase-6-rules-engine.md](tasks/phase-6-rules-engine.md) | 3 |
| 7 Bot opponent | [phase-7-bot-opponent.md](tasks/phase-7-bot-opponent.md) | 3, 6 |
| 8 Screens & UI | [phase-8-screens-ui.md](tasks/phase-8-screens-ui.md) | 4, 5, 6, 7 |
| 9 Persistence, PWA, deploy | [phase-9-persistence-pwa-deploy.md](tasks/phase-9-persistence-pwa-deploy.md) | 6, 7, 8 |

Parallelizable: Phase 6 can run alongside 4–5; Phase 2 alongside 3. Each task file's **Acceptance criteria** section is the authoritative verification list for that phase (superseding the brief "Verify" lines below).

## Context

Create a new repo `/Users/netuser/Projects/pool-pwa`, a sibling of `feeds-pwa`, mirroring its verified stack exactly: TypeScript strict + React 19.2.7 + Vite 8 + vite-plugin-pwa (injectManifest, workbox-precaching) + Mantine 9.2.2 + @tabler/icons-react + idb 8.0.3, all deps pinned (`.npmrc save-exact`), eslint flat config (typescript-eslint strict), Vitest 4. User decisions: **8-ball pool first** (snooker later on the same engine — physics/table/render layers must be game-agnostic), **custom 2D physics + Canvas 2D**, zero new runtime deps, and the game is **player vs a local bot opponent** — the AI runs entirely in the browser (pure TS, optionally in a Web Worker), no network calls ever. The app must be **fully installable and playable with zero internet access** after first load: everything (code, fonts, icons, sounds) is precached by the service worker; there are no runtime fetches. GitHub Pages deploy (`base: '/pool-pwa/'`), no server — feeds-pwa's proxy/push Workers are **not needed**. Tests are first-class (feeds-pwa's zero-test gap must not be repeated). Planning only in this session per the user; this plan is the deliverable for later execution.

Architecture mirrors feeds-pwa's layering: `src/types` → `src/db` → domain services (`src/engine`, `src/rules`, `src/game`) → `src/hooks` → `src/components` + `src/screens`. React never touches the game loop; the engine is imperative, driven via canvas ref.

## Phase 1 — Scaffold & Tooling
**Scope:** Repo init. Copy from feeds-pwa (adapting names/base path): `package.json` deps minus feed-specific bits, `tsconfig.json`, `eslint.config.js`, `postcss.config.cjs`, `.npmrc`, `vite.config.ts` (injectManifest, base `/pool-pwa/`), `index.html`, `public/manifest.webmanifest` (standalone, `#131313`, pool icons), `src/main.tsx`, `src/App.tsx` shell, `src/hooks/useRouter.ts` (copy of feeds-pwa hash router), `src/theme/`, `src/global.css`, minimal `src/sw.ts`. Scripts: `test`, `test:watch`, `deploy` (`npx gh-pages -d dist`). Vitest node environment for logic tests.
**Deps:** none. **Risks:** version drift — copy exact pinned versions.
**Verify:** `npm run build`, `npm run lint`, `npm test` (smoke test), `vite dev` shows shell.

## Phase 2 — `.claude` Skills Authoring
**Scope:** Four skills in `pool-pwa/.claude/skills/`, adapted from feeds-pwa's four:
- `pool-pwa-engineering` — same TS strictness, ≤40-line functions, module pattern (no classes); new boundaries: `src/engine`/`src/rules` are pure/deterministic (no DOM/React imports); React accesses engine only via `src/game` facade; no per-frame allocation in hot paths.
- `pool-pwa-physics-rules` (replaces `feeds-pwa-data-feeds`) — fixed-timestep contract (120 Hz), determinism rules (no `Math.random`/`Date.now` in engine; seeded PRNG only), units/coordinate conventions (table-space vs screen-space), substepping policy, rules event vocabulary.
- `pool-pwa-state-testing` — keep 4-branch loading/error/data/empty pattern for DB-backed screens; mandate: every physics function and rules transition gets a co-located Vitest test; shot-replay scenario fixture format.
- `pool-pwa-design-system` — "Monolithic Clarity" dark theme carried over (Mantine tokens only, 4px grid, WCAG AA, 44px targets, no CSS modules), extended with canvas rules: felt/ball palette in one `src/render/palette.ts`; canvas is the only non-Mantine surface; HUD is Mantine chrome.
**Deps:** Phase 1. **Verify:** skills load in a session; parity review against feeds-pwa originals.

## Phase 3 — Physics Engine Core (pure TS, no DOM)
**Scope:** `src/types/physics.ts` (Vec2, Ball, TableGeometry, ShotInput, PhysicsEvent); `src/engine/vec2.ts`; `src/engine/collision.ts` (ball–ball elastic w/ restitution, cushion reflection, swept-circle continuous detection); `src/engine/friction.ts` (sliding→rolling, stop threshold); `src/engine/pockets.ts`; `src/engine/step.ts` (pure fixed-timestep `step(state, dt) → {state, events}` emitting first-contact/rail/pocket events for the rules layer); `src/engine/simulate.ts` (run to rest, capped steps). Table geometry data-driven (`src/engine/tables/eightBall.ts`) so snooker is just a new geometry file later.
**Deps:** Phase 1 (Phase 2 for conventions). **Risks:** tunneling at high velocity (swept collision + substep when displacement > ~¼ radius); float determinism (plain f64 math, tolerance in snapshot tests).
**Verify (test-heavy):** momentum conservation (head-on/glancing); cushion angle in = angle out; determinism — identical shot twice yields identical event log; high-velocity tunneling regression; balls always come to rest.

## Phase 4 — Table Rendering (Canvas 2D)
**Scope:** `src/render/renderer.ts` (imperative `createRenderer(canvas)` → `draw(state, alpha)`), `src/render/palette.ts`, `src/render/transform.ts` (table→pixel, DPR scaling, ResizeObserver, responsive letterboxing, portrait rotation option); balls/numbers/stripes, cushions, pockets, guide-line layer. `src/game/loop.ts`: rAF loop with fixed-timestep accumulator + interpolated render, fully outside React.
**Deps:** Phase 3. **Risks:** mobile perf (static table pre-rendered to offscreen canvas, dynamic layer only; no per-frame gradients/allocations); DPR blurriness.
**Verify:** transform-math unit tests; visual check at multiple sizes/DPRs; frame-time logging during a 16-ball break.

## Phase 5 — Input & Aiming
**Scope:** `src/game/aiming.ts` (pure: pointer → angle/power, ghost-ball guide line via short engine prediction); `src/game/input.ts` (Pointer Events for mouse+touch, drag-to-aim, pull-back power, cancel gesture, ball-in-hand placement with legality validation); ≥44px-equivalent hit targets; HUD fine-tune/power fallback controls for accessibility; `touch-action: none` on canvas.
**Deps:** Phases 3–4. **Risks:** touch precision on small screens (aim-from-anywhere + angle nudge buttons); scroll/gesture conflicts.
**Verify:** unit tests for aiming math and placement legality; manual mobile test via `vite preview` on device.

## Phase 6 — 8-Ball Rules Engine (pure state machine)
**Scope:** `src/types/rules.ts`; `src/rules/eightBall.ts`: pure `reduce(gameState, shotOutcome) → gameState` consuming the engine event log. Covers rack layout, break legality (4 balls to rails or a pocket), open table, solids/stripes assignment, legal-shot determination, fouls → ball-in-hand, 8-ball win/loss (early/wrong pocket = loss), and two-seat turn alternation (`player` vs `bot`). `src/game/controller.ts` glues input → simulate → rules → next state.
**Deps:** Phase 3 (event vocabulary). **Risks:** rules edge cases (simultaneous pockets, cue + 8 together) — exhaustive scenario test table.
**Verify:** table-driven Vitest per rule (break foul, open-table assignment, scratch → ball-in-hand, early 8-ball loss, win); property test: reducer never reaches an invalid state from valid outcomes.

## Phase 7 — Bot Opponent (local, offline AI)
**Scope:** `src/bot/` — a pure-TS shot planner that plays the bot's turns, reusing the deterministic engine as its simulator (no network, no ML runtime, no new deps):
- `src/bot/candidates.ts` — enumerate candidate shots: for each legal target ball × pocket, compute the ghost-ball aim point and required power; add safety shots and ball-in-hand placement search.
- `src/bot/evaluate.ts` — simulate each candidate with `simulate()` and score the outcome via the rules reducer (pot legal ball > safety > foul avoidance; positional bonus for next-shot ease).
- `src/bot/index.ts` — `planShot(state, difficulty, seed) → ShotInput`. Difficulty tiers (easy/medium/hard) implemented as seeded aim/power noise (larger error at lower tiers) and fewer candidates evaluated — noise comes from the seeded PRNG so bot play stays deterministic and testable.
- Run planning in a **Web Worker** (`src/bot/worker.ts`) so candidate simulation never blocks the render loop; the controller shows a "bot thinking" HUD state and animates the bot's cue/aim before executing the shot.
**Deps:** Phases 3 & 6 (engine + rules as simulator/scorer). **Risks:** planning latency on low-end mobile (cap candidates + time-box search, fall back to best-so-far); Worker bundling under Vite (use `new Worker(new URL(...), { type: 'module' })`, precached by injectManifest).
**Verify:** Vitest — given a fixed seed and a trivial layout (straight shot to pocket), bot pots it; bot never returns an illegal shot (property test over random legal states); difficulty ordering test (hard pots ≥ easy over a seeded scenario set); manual: full game vs bot at each difficulty.

## Phase 8 — Screens & UI Chrome
**Scope:** Hash routes via `useRouter`: `#/` menu, `#/game`, `#/stats`, `#/settings`. `src/screens/{Menu,Game,Stats,Settings}Screen.tsx`; Mantine HUD components (turn indicator player/bot, "bot thinking" state, group indicator, foul banner, power meter, pocketed-ball tray, pause button — 44px targets); difficulty picker on the menu. GameScreen mounts canvas by ref; engine/loop instantiated in `useEffect`; React receives only shot-boundary snapshots via a small pub/sub hook `src/hooks/useGameState.ts` — never per-frame state.
**Deps:** Phases 4–7. **Risks:** React re-renders leaking into the loop — enforced by engineering skill; no `setState` in rAF callback.
**Verify:** HUD component tests; manual full-game playthrough; lint/boundary review.

## Phase 9 — Persistence, PWA/Offline & Deployment
**Scope:** `src/db/index.ts` (idb schema v1: `gameSnapshot` — serialized rules state + at-rest ball positions + bot difficulty + PRNG seed, saved between shots only, with a `version` field; `stats` — games/wins vs bot per difficulty/potted/fouls/streaks; `settings` — sound, guide length, table color, handedness, default difficulty). Hooks (`useStats`, etc.) follow the 4-branch pattern; resume-game flow on menu. Finalize `src/sw.ts`: **precache everything** via injectManifest (app shell, JS incl. bot worker chunk, fonts, icons, sounds) — after install the app makes zero network requests; navigations fall back to precached `index.html`. Manifest icons/screenshots, install affordance. Deploy via `gh-pages -d dist`.
**Deps:** Phases 6–8. **Risks:** snapshot schema versioning (migrate-or-discard policy); SW staleness (workbox revisioning handles); worker chunk missed by precache manifest (verify it's listed in `__WB_MANIFEST`).
**Verify:** DB round-trip tests; Lighthouse PWA pass; **airplane-mode test: install PWA, go fully offline, play a complete game vs the bot at each difficulty and resume a saved game**; DevTools network tab shows zero requests during play; deploy to Pages and repeat at the live URL.

## Cross-Cutting Risks
- **Tunneling:** swept-circle collision + adaptive substepping; regression tests at extreme velocity (Phase 3).
- **Fixed timestep + interpolation:** accumulator loop at 1/120s with clamp (spiral-of-death guard on tab restore); render interpolates between physics states.
- **Mobile canvas perf:** two-layer rendering (static offscreen table bitmap + dynamic ball layer), DPR cap at 2 if needed.
- **Game loop vs React:** engine in plain modules; React gets shot-boundary snapshots only.
- **Determinism:** seeded PRNG (seed in snapshot) — enables replay fixtures, exact-match tests, deterministic bot behavior, and future shot-replay features.
- **Offline guarantee:** no runtime `fetch` anywhere in the codebase (lint-enforceable); all assets self-hosted and precached; bot is pure local computation.

## Adapt vs Drop from feeds-pwa
- **Keep:** toolchain, hash router hook, theme + Monolithic Clarity design language, layered module (no-class) architecture, idb `src/db` pattern, sw/manifest/Pages deployment, four-skill `.claude` structure.
- **Adapt:** data-feeds skill → physics/rules skill (security shrinks to "no external input, no innerHTML"); state-testing skill upgraded to test-first for engine/rules; design system extended with canvas rules.
- **Drop:** CORS proxy Worker, push Worker, `src/feed`, `src/notifications`, `@mantine/spotlight`, all network layers — game is 100% offline; SW only precaches the app shell.

## Reference Files (to mirror/copy)
- [feeds-pwa/vite.config.ts](feeds-pwa/vite.config.ts) — PWA injectManifest config
- [feeds-pwa/src/hooks/useRouter.ts](feeds-pwa/src/hooks/useRouter.ts) — hash router to copy
- [feeds-pwa/src/theme/index.ts](feeds-pwa/src/theme/index.ts) — theme/tokens pattern
- feeds-pwa/.claude/skills/*/SKILL.md — four skill templates to adapt
