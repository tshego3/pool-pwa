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
- [ ] Full manual playthrough: menu → pick difficulty → play vs bot to a win/loss → rematch, all via UI only. **Not verified here** (requires a running browser). Architecture supports it end-to-end; not driven live.
- [ ] React DevTools profiler during ball motion shows zero HUD re-renders between shot boundaries. **Not verified here** (requires browser profiler). By construction the loop never calls `setState`; the HUD updates only on session publishes (shot boundaries + thinking/animating transitions), so no publish occurs during ball motion.
- [~] All interactive elements ≥44px; axe-core/WCAG AA check passes on each screen; only Mantine tokens used (no hardcoded colors outside `src/render/palette.ts`). **Partial:** 44px targets and token-only colors are done and grep-verified (no hardcoded hex in `src/components`/`src/screens`). The automated **axe-core/WCAG pass is blocked** (no `axe-core` dev dep; needs install).
- [x] `npm run lint` boundary check: screens/components import from `src/game`/hooks (and `src/render` for canvas mounting) only, never `src/engine`/`src/rules`/`src/bot` internals. Enforced via `no-restricted-imports` in `eslint.config.js`; verified it rejects an `../engine/step` import.

## Verification status (2026-07-12)
- `npm run build` (tsc + vite): passes, zero TypeScript errors.
- `npm run lint`: passes, zero errors/warnings.
- `npm test`: 127 tests pass (22 files), including 5 new `hudLabels` tests.

### Remaining blockers
1. Render/DOM component tests and axe-core WCAG checks need dev deps added (`jsdom`, `@testing-library/react`, `axe-core`) — an `npm install`.
2. Manual playthrough + profiler runs require a live browser session.
3. Bot ball-in-hand after a cue-scratch depends on the Phase 7 planner emitting a `cuePlacement` (a bot-planning concern, out of Phase 8 scope).
