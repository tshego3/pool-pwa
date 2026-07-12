# Phase 2 — `.claude` Skills Authoring

**Depends on:** Phase 1
**Blocks:** conventions for Phases 3–9 (soft dependency — author before engine work starts)

## Tasks
- [x] Create `.claude/skills/pool-pwa-engineering/SKILL.md` adapted from `feeds-pwa/.claude/skills/feeds-pwa-engineering/SKILL.md`: TS strict, no `any`, no non-null assertions, ≤40-line functions, module pattern (no classes), npm-only pinned deps, GitHub Pages deploy. Add game-specific boundaries: `src/engine` + `src/rules` + `src/bot` are pure (no DOM/React/network imports); React accesses the game only via the `src/game` facade; no allocation in per-frame hot paths.
- [x] Create `.claude/skills/pool-pwa-physics-rules/SKILL.md` (replaces data-feeds skill): fixed timestep 120 Hz contract; determinism rules (no `Math.random`/`Date.now`/`fetch` in engine/rules/bot — seeded PRNG only); units + table-space vs screen-space conventions; substepping/swept-collision policy; PhysicsEvent vocabulary consumed by the rules reducer; security section reduced to "no external input, no innerHTML, no runtime fetch".
- [x] Create `.claude/skills/pool-pwa-state-testing/SKILL.md`: 4-branch loading/error/data/empty pattern for DB-backed screens; mandate co-located Vitest tests for every physics function, every rules transition, and bot planning; define shot-replay scenario fixture format (seed + ShotInput[] + expected event log).
- [x] Create `.claude/skills/pool-pwa-design-system/SKILL.md`: Monolithic Clarity dark theme (Mantine tokens only, 4px grid, WCAG AA, 44px targets, no CSS modules, Inter, no shadows/tonal layering), extended: felt/ball palette lives only in `src/render/palette.ts`; canvas is the only non-Mantine surface; HUD is Mantine chrome.
- [x] Each SKILL.md gets correct frontmatter (name, description with trigger conditions) mirroring feeds-pwa's format.

## Acceptance criteria
- [x] Four SKILL.md files exist with valid frontmatter (opening `---`, `name`, trigger-bearing `description`, closing `---` at line 4, verified) and load in-session — the harness now lists all four (`pool-pwa-engineering`, `pool-pwa-physics-rules`, `pool-pwa-state-testing`, `pool-pwa-design-system`) in the available-skills set for files under `pool-pwa/`.
- [x] Side-by-side review against feeds-pwa originals: all still-applicable rules carried over; all feed/network/proxy/push/CORS content removed (grep-verified — the only `innerHTML` hit is the intentional "no innerHTML" security rule); game rules added.
- [x] No contradictions between skills: purity boundary (engine/rules/bot pure & deterministic, React via `src/game`), determinism/seed contract, PhysicsEvent vocabulary, and the theme-vs-`render/palette.ts` color split are stated consistently across the four files.

## Verification status
- Verified 2026-07-11. All four files created and validated; the harness now surfaces all four in the available-skills list, confirming they load. No acceptance items outstanding.
- Note: skills reference planned Phase 3–9 paths (`src/engine`, `src/render/palette.ts`, `src/game`, …) that do not exist yet — expected, since Phase 2 authors conventions ahead of engine work (soft dependency).
