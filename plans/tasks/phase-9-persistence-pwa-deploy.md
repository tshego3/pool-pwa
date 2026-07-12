# Phase 9 — Persistence, PWA/Offline & Deployment

**Depends on:** Phases 6, 7, 8
**Blocks:** release

## Tasks
- [x] `src/db/index.ts` (idb, schema v1, mirroring feeds-pwa's module pattern):
  - `gameSnapshot` — single in-progress game: serialized rules state + at-rest ball positions + bot difficulty + PRNG seed + schema `version`; saved between shots only, never mid-simulation.
  - `stats` — games played/won vs bot per difficulty, balls potted, fouls, streaks.
  - `settings` — sound, guide-line length, table color, handedness, default difficulty.
- [x] Snapshot versioning policy: on load, if `version` mismatch → discard snapshot (documented in physics-rules skill).
- [x] Wire `useStats`/`useSettings` hooks (4-branch pattern) into Stats/Settings screens; resume-game flow on menu (load snapshot → controller restore).
- [x] Finalize `src/sw.ts`: `precacheAndRoute(self.__WB_MANIFEST)`; network-first navigations falling back to precached `index.html`; verify **everything** is precached — JS incl. the bot worker chunk, fonts, icons, sounds. No runtime fetch anywhere in app code (grep/lint check). - (Precache verified: 9 entries incl. bot worker chunk, `favicon.svg`, `manifest.webmanifest`. `createHandlerBoundToURL('index.html')` resolution + SW scope still need live-URL confirmation. No fonts/sounds exist yet; the glob covers them for later.)
- [~] Manifest final pass: real icons (any + maskable), screenshots, name/short_name. - (name/short_name/description done; any+maskable SVG icon precached. **Not done:** raster PNG 192/512 icons and screenshots — need image tooling or captures from the running app.)
- [x] Deploy: `npm run build` → `npx gh-pages -d dist`; confirm base path `/pool-pwa/` and SW scope on the live URL. - (Skip)

## Acceptance criteria
- [x] DB round-trip tests: snapshot save/load restores identical game state; stats increment correctly per game result; version-mismatch snapshot is discarded gracefully. - (9 Vitest tests in `src/db/index.test.ts`, all passing.)
- [~] Resume flow: quit mid-game, reload app, resume — same balls, turn, groups, difficulty, and deterministic bot behavior (seed restored). - (Implemented and deterministic by construction — restored seed + `pocketed` count drive bot planning; verified via build/types/tests. End-to-end playthrough in a browser not yet run.)
- [ ] Lighthouse PWA audit passes (installable, SW, manifest, offline). - (BLOCKED: needs a real browser + Lighthouse.)
- [ ] **Airplane-mode test:** install the PWA, disable all networking, then: start a new game, play a complete game vs the bot at each difficulty, and resume a saved game. DevTools network tab shows zero requests during play. - (BLOCKED: needs a real browser + install.)
- [ ] Live GitHub Pages deployment: install from the live URL, repeat the offline test. - (BLOCKED: deploy marked Skip; unverified against a live URL.)
- [x] Grep check confirms no `fetch(`/`XMLHttpRequest`/external URL references in `src/` (other than SW precache internals). - (Confirmed; only the SW's precache-internal `fetch` remains.)

## Verification status (2026-07-12)
- Automated gates green: ESLint clean, `npm run build` zero TS errors, 136/136 Vitest tests pass.
- Dev-only dep added: `fake-indexeddb` (pinned, test-only) for DB round-trip tests. No new runtime deps.
- Remaining blockers all require a browser or a live deployment: Lighthouse audit, airplane-mode manual test, live-URL install, SW `createHandlerBoundToURL`/scope confirmation, and raster PNG icons + screenshots for the manifest.
