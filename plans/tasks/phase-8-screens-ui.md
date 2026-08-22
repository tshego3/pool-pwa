# Phase 8 — Screens & UI Chrome

**Depends on:** Phases 4, 5, 6, 7
**Blocks:** Phase 9

## Tasks
- [x] Wire hash routes via `useRouter`: `home` (menu), `game`, `stats`, `settings`. (`src/App.tsx`)
- [x] `src/screens/MenuScreen.tsx`: new game, difficulty picker (easy/medium/hard), resume-game slot (disabled; enabled in Phase 9), links to stats/settings.
- [x] `src/screens/GameScreen.tsx`: mounts canvas by ref; session/renderer/loop/input instantiated in one `useEffect` (created + torn down imperatively); React never sets state per frame. Orchestration lives in the new `src/game/session.ts` facade so the screen imports only `src/game`/`src/render`/hooks.
- [x] `src/hooks/useGameState.ts`: pub/sub via `useSyncExternalStore` — the session publishes shot-boundary snapshots (rules state, turn, thinking/animating); hook exposes them to HUD.
- [x] HUD components (`src/components/`, all Mantine, 44px targets): turn indicator (player/bot), "bot thinking" state, group indicator (solids/stripes), foul banner with reason, power meter, pocketed-ball tray, back-to-menu button, fallback aim controls (Phase 5). Copy lives in pure, tested `hudLabels.ts`.
- [x] `src/screens/StatsScreen.tsx` + `SettingsScreen.tsx` skeletons (data wired in Phase 9) using the 4-branch async pattern (`useStats`/`useSettings`, with Phase 9 TODOs for the IndexedDB source).
- [x] Win/loss end-of-game overlay with rematch / back-to-menu. (`src/components/EndOverlay.tsx`)

## Acceptance criteria
- [~] Component tests for HUD (foul banner shows reason, turn indicator flips, end overlay renders winner) pass. **Partial:** HUD *logic* is covered by pure tests (`src/components/hudLabels.test.ts` — foul reasons, turn flip, winner). Render-level mount assertions are **blocked**: no React test infra in the repo (Vitest runs in node; needs `jsdom` + `@testing-library/react` dev deps, i.e. an `npm install`).
- [~] Full manual playthrough: menu → pick difficulty → play vs bot to a win/loss → rematch, all via UI only. **Partial:** the Playwright suite drives menu → settings → new game → aim → shoot → bot turn live in a browser, all through visible controls. **Playing to a win/loss and the rematch flow are still uncovered** — no spec runs a game to completion.
- [ ] React DevTools profiler during ball motion shows zero HUD re-renders between shot boundaries. **Not verified here** (requires browser profiler). By construction the loop never calls `setState`; the HUD updates only on session publishes (shot boundaries + thinking/animating transitions), so no publish occurs during ball motion.
- [~] All interactive elements ≥44px; axe-core/WCAG AA check passes on each screen; only Mantine tokens used (no hardcoded colors outside `src/render/palette.ts`). **Partial:** 44px targets and token-only colors are done and grep-verified (no hardcoded hex in `src/components`/`src/screens`). The automated **axe-core/WCAG pass is blocked** (no `axe-core` dev dep; needs install).
- [x] `npm run lint` boundary check: screens/components import from `src/game`/hooks (and `src/render` for canvas mounting) only, never `src/engine`/`src/rules`/`src/bot` internals. Enforced via `no-restricted-imports` in `eslint.config.js`; verified it rejects an `../engine/step` import.

## Verification status (2026-07-12)
- `npm run build` (tsc + vite): passes, zero TypeScript errors.
- `npm run lint`: passes, zero errors/warnings.
- `npm test`: 127 tests pass (22 files), including 5 new `hudLabels` tests.

### Remaining blockers
1. Render/DOM component tests and axe-core WCAG checks need dev deps added (`jsdom`, `@testing-library/react`, `axe-core`) — an `npm install`. Playwright is now installed and could host the axe-core pass instead.
2. A game played through to a win/loss, the rematch flow, and the profiler run are still unverified. Playwright now provides the live browser session these needed, so they are writable specs rather than blockers.
3. Bot ball-in-hand after a cue-scratch depends on the Phase 7 planner emitting a `cuePlacement` (a bot-planning concern, out of Phase 8 scope).

## Verification (2026-08-23)
- Two dead settings fixed: `guideBounces` reached neither the prediction nor the renderer, and `tableColor` never reached the canvas at all. Both are now wired, and `Renderer.setPalette` swaps the felt without restarting the game in progress.
- The aim controls now mirror the bot's shot during its turn while staying disabled, so the player cannot interfere or take it.
- `e2e/` covers the menu flow, both settings fixes, and the bot turn. `npm run test:e2e` — 9 passed; `npm test` — 146 passed.
