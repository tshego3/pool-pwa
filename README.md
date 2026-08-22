# 8-Ball Pool PWA

Offline, installable solo **8-ball pool** against a local bot opponent. Everything — the physics, the rules, and the AI — runs entirely in your browser. After the first load the app makes **zero network requests**: install it, go into airplane mode, and play a full game.

The game is built on a custom 2D physics engine and Canvas 2D rendering, with no game-specific runtime dependencies. The engine, rules, and render layers are kept game-agnostic so a snooker variant can be added later on the same core.

## Features

- **Solo play vs a local bot** — the opponent is a pure-TypeScript shot planner that reuses the deterministic physics engine as its simulator (no network, no ML runtime). Easy / medium / hard difficulty tiers.
- **Full 8-ball ruleset** — break legality, open table, solids/stripes assignment, fouls → ball-in-hand, and 8-ball win/loss handling.
- **Fully offline PWA** — installable, with the entire app shell (code, icons, fonts, sounds) precached by the service worker.
- **Drag-to-aim with shot prediction** — pointer/touch aiming with a ghost-ball guide line that also shows where both balls travel after contact: the struck object ball's path and the cue ball's deflection, each traced with the real engine until the ball rests, pockets, or hits something. Optional cushion-following is a setting. HUD fine-tune and power controls cover accessibility.
- **A bot that plays like an opponent** — the bot's turn is paced rather than instant, and while it thinks the aim controls and guide line step through the shots its search actually weighed before settling on the one it plays. The controls stay disabled throughout, so the display is a read-out and never a handover.
- **Persistence** — resume a saved game, and track games/wins, pots, fouls, and streaks per difficulty (stored in IndexedDB).
- **Deterministic engine** — seeded PRNG throughout, enabling replay fixtures, exact-match tests, and reproducible bot behavior.

## Tech Stack

- **TypeScript** (strict) + **React 19** + **Vite 8**
- **Custom 2D physics** with **Canvas 2D** rendering (fixed 120 Hz timestep, interpolated render, outside React)
- **Mantine 9** for the HUD/UI chrome
- **vite-plugin-pwa** (injectManifest + workbox-precaching) for the offline service worker
- **idb** for IndexedDB persistence
- **Vitest** for unit tests (physics, rules, and bot logic are test-first)
- **Playwright** for end-to-end tests that drive the real app in a browser

## Getting Started

Requires Node.js and npm.

```bash
npm install      # install pinned dependencies
npm run dev      # start the Vite dev server
```

Then open the URL Vite prints (the app is served under the `/pool-pwa/` base path).

To run the end-to-end suite you also need the browser Playwright drives, which is a one-time download:

```bash
npx playwright install chromium
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Lint `src/` with ESLint |
| `npm test` | Run the unit suite once (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:e2e` | Run the end-to-end suite (Playwright; starts the dev server itself) |
| `npm run deploy` | Publish `dist/` to GitHub Pages |

## Architecture

The code is layered so that React never touches the game loop. Data flows one way, from pure/deterministic core modules up to the UI:

```
src/types  →  src/db  →  src/engine / src/rules / src/bot  →  src/game  →  src/hooks  →  src/components + src/screens
```

- **`src/engine`** — pure, deterministic physics: vectors, collision (swept-circle, continuous), friction, pockets, and a fixed-timestep `step(state, dt)` that emits an event log. Table geometry is data-driven (`src/engine/tables/`) so new games are just new geometry files.
- **`src/rules`** — a pure state machine that reduces engine events into 8-ball game state (`reduce(gameState, shotOutcome)`).
- **`src/bot`** — a shot planner that enumerates candidate shots, simulates each with the engine, and scores outcomes via the rules reducer. Runs in a **Web Worker** so planning never blocks the render loop.
- **`src/game`** — the imperative facade (loop, input, aiming, controller) that glues input → simulate → rules; the only bridge between React and the engine.
- **`src/render`** — Canvas 2D rendering (table, balls, guide line) and the table↔pixel transform.
- **`src/hooks` / `src/screens` / `src/components`** — Mantine-based UI. React receives only shot-boundary snapshots, never per-frame state.
- **`e2e/`** — Playwright specs plus the shared helpers that drive the app the way a player does (visible controls only).

The engine and rules layers are pure: no DOM, React, or network imports, and no `Math.random`/`Date.now` (seeded PRNG only). See the design docs and per-phase task breakdown in [plans/](plans/).

## Testing

The two suites cover different things and neither replaces the other.

**Vitest (`npm test`)** owns everything pure and deterministic: physics functions, rules transitions, bot planning, aiming math, and the HUD copy helpers. Tests live beside the code they cover. Purity is itself tested — `src/engine`, `src/rules`, and `src/bot` are grep-checked for DOM, React, clock, and network references.

**Playwright (`npm run test:e2e`)** owns what only a real browser can show: the canvas renderer, the rAF loop, the bot Web Worker, and IndexedDB running together. The specs assert on rendered frames and on real elapsed time, so they catch things a unit test cannot — that a setting reaches the canvas rather than only IndexedDB, and that the bot's turn is actually paced. Playwright starts the dev server itself; each spec gets a clean browser context, so there is never a stale saved game or settings record.

## Offline Guarantee

There is no runtime `fetch` anywhere in the codebase. All assets are self-hosted and precached by the service worker via injectManifest, and the bot is pure local computation. Once installed, the app is fully playable with no internet access.

## Deployment

The app deploys to GitHub Pages under the `/pool-pwa/` base path:

```bash
npm run build
npm run deploy
```
