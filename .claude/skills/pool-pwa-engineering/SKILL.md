---
name: pool-pwa-engineering
description: Core engineering rules for pool-pwa (TypeScript + Vite + Mantine + Canvas 2D PWA). Use before ANY feature work, bug fix, or refactor in this repository - covers architecture boundaries, the pure/deterministic engine-rules-bot layers, the src/game facade, project structure, TypeScript strictness, change management, build/tooling, and deployment rules.
---

# Engineering Rules (TypeScript + Vite + Mantine + Canvas 2D PWA)

These rules are mandatory for all feature work, bug fixes, and refactors.

## Platform Identity

1. Stack is TypeScript + React + Vite (pure client-side PWA - no SSR, no framework router, no server runtime).
2. UI library is [Mantine](https://mantine.dev/) (Core, Hooks). No `@mantine/spotlight`.
3. This is **pool-pwa** - a solo 8-ball pool browser game: player vs a local bot opponent. Snooker may follow later on the same engine, so the physics/table/render layers must stay game-agnostic (table geometry is data-driven, not hardcoded to 8-ball).
4. **Zero new runtime deps** and **no network calls ever.** The game is 100% offline: custom 2D physics + Canvas 2D, a local pure-TS bot (no ML runtime), everything precached by the service worker. There is no proxy, no push, no `fetch` anywhere in the codebase.
5. PWA features via Workbox Service Worker (injectManifest). Deployment target is GitHub Pages.

## Non-Negotiable Architecture Rules

1. No app server - no Express, no Node server, no SSR runtime, no Cloudflare Workers. The PWA is fully static (GitHub Pages) and self-contained.
2. No remote database and no authentication. IndexedDB (`idb` wrapper) is the sole data layer for game snapshots, stats, and settings.
3. **Purity boundary (the core rule):** `src/engine`, `src/rules`, and `src/bot` are pure and deterministic. They must NOT import from React, the DOM, `src/render`, `src/components`, `src/screens`, `src/db`, or anything with I/O. No `Math.random`, `Date.now`, `performance.now`, `fetch`, or timers in these layers - randomness comes only from a seeded PRNG passed in. See the `pool-pwa-physics-rules` skill for the determinism contract.
4. **React accesses the game only via the `src/game` facade.** Components and screens never import `src/engine`, `src/rules`, or `src/bot` directly; they go through `src/game` (loop, controller, aiming, input). React never touches the physics loop and never calls `setState` inside a rAF callback.
5. Keep modules small and focused - one concern per file.
6. Shared types and interfaces live in `src/types/`. Never create model types outside it; no inline duplication.
7. Routing is the client-side hash router (`src/hooks/useRouter.ts`). No framework router libraries.

## Architecture Layers

```
Components/Screens (React/Mantine)
  --reads shot-boundary snapshots via--> Hooks (src/hooks/, e.g. useGameState)
  --drive/read the game via--> Facade (src/game/: loop, controller, input, aiming)
  --composes--> Pure domain: src/engine/ + src/rules/ + src/bot/  (deterministic, no DOM)
  --renders with--> src/render/ (Canvas 2D, the only non-Mantine surface)
  --persists via--> src/db/ (IndexedDB, snapshots only)
  --all built on--> Types (src/types/)
```

| Layer | Responsibility | Location | Purity |
|-------|---------------|----------|--------|
| Types | Pure interfaces, zero runtime deps | `src/types/` | pure |
| Engine | Fixed-timestep physics: collision, friction, pockets, step/simulate | `src/engine/` | **pure, deterministic** |
| Rules | 8-ball state machine: `reduce(gameState, outcome)` | `src/rules/` | **pure, deterministic** |
| Bot | Local shot planner (candidates, evaluate, planShot) | `src/bot/` | **pure, deterministic** |
| Game (facade) | rAF loop, controller, input, aiming - glues engine/rules/bot to the DOM | `src/game/` | I/O boundary |
| Render | Canvas 2D drawing, palette, table<->pixel transform | `src/render/` | DOM |
| DB | IndexedDB CRUD via `idb`. Pure I/O | `src/db/` | I/O |
| Theme | Centralized Mantine theme override (Monolithic Clarity) | `src/theme/` | - |
| Components | Presentational Mantine HUD, props-driven, no direct game calls | `src/components/` | React |
| Screens | Page-level composition; mount canvas, wire the facade | `src/screens/` | React |
| Service Worker | Workbox injectManifest precaching of the whole app shell | `src/sw.ts` | - |

**Golden rule:** Components never call the engine/rules/bot directly. Screens mount the canvas and orchestrate the game through the `src/game` facade; React receives only shot-boundary snapshots, never per-frame state.

## Project Structure

1. Entry point is `index.html` at root; app entry is `src/main.tsx` with MantineProvider and SW registration.
2. Vite config at root with `base: '/pool-pwa/'` for GitHub Pages.
3. Static assets in `public/` (manifest.webmanifest, icons, fonts, sounds). No runtime-fetched assets - everything is precached.
4. `src/theme/` is the single source of design tokens. `src/render/palette.ts` is the single source of felt/ball canvas colors (see the design-system skill).

## TypeScript Rules

1. `strict: true` - no exceptions. Treat all compiler and linter warnings as errors.
2. Strictly **no `any` types**. Explicit interfaces and types for all components, props, and data models.
3. Never use `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
4. `interface` for object shapes; `type` for unions, intersections, computed types.
5. Prefer `const` over `let`; never `var`. Template literals over concatenation. `readonly` where mutation is not required.
6. Functional TypeScript with the module pattern. No class-based patterns unless justified.
7. No non-null assertions (`!`) in production code - use optional chaining, nullish coalescing, or explicit checks.

## Robust Coding Principles

1. Simple control flow - avoid complex recursion; all loops must have a deterministic upper bound (the engine's `simulate()` caps steps; the bot time-boxes/caps candidates).
2. Functions <=40 lines; extract sub-functions if longer.
3. Guard clauses: validate inputs at the top, exit early on invalid state.
4. Module-private (unexported) functions by default; expose only the public API.
5. Never ignore a Promise - always `await` or explicitly `.catch()`.
6. Immutability first: `readonly` properties, new objects over mutation - EXCEPT in per-frame engine hot paths (see next rule).
7. **No allocation in per-frame hot paths.** The engine step and renderer draw loop must avoid allocating in the inner loop (no array/object literals, closures, or `map`/`filter` per frame). Reuse buffers/scratch vectors. Immutability applies at the shot/state-snapshot boundary, not inside the 120 Hz step.
8. No global mutable state for shared app state - use React state, hooks, or the game facade's owned instances. (The engine/loop own mutable simulation buffers internally; that is not shared global state.)

## Production Stability

1. Context-rich errors - never `throw new Error('failed')`. Use typed error objects.
2. No empty catch blocks - at minimum, log why it is safe to ignore.
3. There are no network calls to time out. Instead, cap all simulation and planning work (step count, candidate count, time-box the bot) so nothing hangs the loop.
4. Keep pure logic (engine/rules/bot) strictly separate from I/O (db, render, input).
5. User-safe error messages - never expose raw errors, stack traces, or file paths.

## Change Management

1. Prefer minimal, scoped changes over broad rewrites. Do not refactor unrelated areas.
2. Keep naming, formatting, and style aligned with surrounding code.
3. Code must pass ESLint with zero errors before merge.
4. No nested ternaries or deeply nested conditionals - prefer early returns and flat logic. Prefer ternary, nullish coalescing (`??`), optional chaining (`?.`).
5. Direct, descriptive naming. Apply DRY - reuse existing utilities (`src/engine/vec2.ts`, the seeded PRNG) before creating parallel implementations.
6. If code cannot be understood quickly without comments, simplify it first.
7. Clean code. No em dashes or emojis in comments.
8. Replace any hardcoded mock/placeholder data before completion - use real state or clearly marked `// TODO:` stubs.
9. **Code is liability, not an asset.** Every line must justify its existence. Pursue the smallest diff; prefer deleting or simplifying over adding.
10. Compliance pass before finalizing: verify alignment with these project skills, and confirm no new runtime deps, no `fetch`/network, no `Math.random`/`Date.now` in engine/rules/bot, and no engine/rules/bot import of DOM/React.

## Build and Tooling

1. Use `npm` only; commit `package-lock.json`.
2. All dependency versions pinned exactly (no `^`/`~`) - `.npmrc` has `save-exact=true`.
3. **Zero new runtime dependencies.** The whole game is custom TS. Do not add a physics, math, ECS, or state library. Justify and vet any dev-only tooling dep before adoption.
4. Core deps: `@mantine/core`, `@mantine/hooks`, `idb`, `workbox-precaching`, `@tabler/icons-react`.
5. Run `npm run build` after changes to verify zero TypeScript errors; `npm test` for logic; `vite preview` to verify the production build.

## Deployment (GitHub Pages)

1. `base: '/pool-pwa/'` in `vite.config.ts`; build to `dist/`; deploy with `npx gh-pages -d dist` (source: `gh-pages` branch).
2. Verify PWA install on the deployed HTTPS URL and confirm the DevTools network tab shows **zero requests during play** (full offline guarantee). Verify the bot Worker chunk is present in the precache manifest.

## Adding a New Feature (Checklist)

1. **Types** - interfaces in `src/types/` with `readonly` properties.
2. **Engine/Rules/Bot** - pure, deterministic functions; seeded PRNG only; co-located Vitest tests (mandatory - see the state-testing skill).
3. **Game facade** - wire engine/rules/bot to the loop/controller; keep React out of the loop.
4. **State** - hook exposing shot-boundary snapshots (4-branch pattern for DB-backed screens).
5. **Components/Screens** - Mantine HUD, props-driven; mount canvas by ref.
6. **Tests** - Vitest for every physics function, every rules transition, and bot planning.
7. **Build** - `npm run build` and `npm test` with zero errors.
