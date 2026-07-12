# Phase 1 — Scaffold & Tooling

**Depends on:** none
**Blocks:** all other phases

## Tasks
- [x] `git init` pool-pwa; copy `.npmrc` (save-exact) from feeds-pwa.
- [x] Create `package.json` with exact pinned versions from feeds-pwa: react 19.2.7, react-dom 19.2.7, @mantine/core 9.2.2, @mantine/hooks 9.2.2, @tabler/icons-react, idb 8.0.3, workbox-precaching 7.4.1; dev: vite 8, @vitejs/plugin-react, vite-plugin-pwa 1.3.0, typescript, typescript-eslint (strict flat config), vitest 4.1.8, postcss + postcss-preset-mantine, gh-pages. Omit @mantine/spotlight and all feed deps.
- [x] Copy/adapt `tsconfig.json`, `eslint.config.js`, `postcss.config.cjs` from feeds-pwa unchanged except paths.
- [x] Create `vite.config.ts`: base `/pool-pwa/`, vite-plugin-pwa `strategies: 'injectManifest'`, `filename: 'sw.ts'`, `injectRegister: false`.
- [x] Create `index.html`, `public/manifest.webmanifest` (name "pool", `display: standalone`, theme/background `#131313`, scope/start_url `/pool-pwa/`, placeholder SVG icon any+maskable).
- [x] Create `src/main.tsx` (createRoot + MantineProvider dark + SW registration), `src/App.tsx` shell, `src/theme/index.ts` (theme + tokens), `src/global.css`, minimal `src/sw.ts` (precacheAndRoute only).
- [x] Copy `src/hooks/useRouter.ts` from feeds-pwa; routes: `home | game | stats | settings`.
- [x] Scripts: `dev`, `build` (`tsc -b && vite build`), `lint`, `test` (`vitest run`), `test:watch`, `deploy` (`npx gh-pages -d dist`).
- [x] Add one smoke test (`src/App.test.ts` or a trivial pure-fn test) so `npm test` passes non-empty.

## Acceptance criteria
- [x] `npm run build` completes with zero TS errors.
- [x] `npm run lint` passes with zero warnings.
- [x] `npm test` runs ≥1 test and passes — 3 tests pass (`src/App.test.ts`).
- [x] `npm run dev` serves the Mantine dark shell with working hash routes (empty screens) — served at `http://localhost:5173/pool-pwa/`.
- [x] All dependency versions match feeds-pwa's pinned versions exactly (diff package.json) — only intended deltas: `@mantine/spotlight` omitted, `gh-pages` added.

## Status
Phase 1 complete and verified on 2026-07-11. All tasks and acceptance criteria met. No outstanding blockers.

Notes:
- `global.css` omits feeds-pwa's `@font-face` Inter declarations (pool-pwa ships no font files); relies on system-font fallbacks.
- `gh-pages` pinned to 6.3.0 (feeds-pwa has no version to copy from).
- No git commit created yet — repo initialized but nothing committed.
