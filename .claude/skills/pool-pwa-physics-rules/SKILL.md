---
name: pool-pwa-physics-rules
description: Physics engine, determinism, coordinate, and 8-ball rules-event rules for pool-pwa. Use when touching the pure engine (src/engine/ - collision, friction, pockets, step, simulate, table geometry), the rules reducer (src/rules/), the bot planner (src/bot/), the PhysicsEvent vocabulary, the seeded PRNG, coordinate/units conventions, or the fixed-timestep loop contract.
---

# Physics, Determinism, Coordinates, and Rules-Event Rules

`src/engine`, `src/rules`, and `src/bot` are the pure, deterministic core of the game. These rules govern how they behave and how they talk to each other. See `pool-pwa-engineering` for the purity boundary and `pool-pwa-state-testing` for how each function must be tested.

## Fixed-Timestep Contract

1. Physics runs at a **fixed timestep of 120 Hz** (`dt = 1/120 s`). This value is the single source of truth; never scale it by frame rate.
2. The engine step is pure: `step(state, dt) -> { state, events }`. It advances one fixed tick and returns the new state plus any `PhysicsEvent`s produced this tick. It never reads a clock and never renders.
3. The rAF loop lives in `src/game/loop.ts` (outside the engine and outside React). It uses a fixed-timestep accumulator: accumulate real elapsed time, run whole `1/120 s` steps until the accumulator is drained, and **render with interpolation** between the previous and current physics state using the leftover `alpha`.
4. **Spiral-of-death guard:** clamp the accumulator (cap steps per frame, e.g. on tab restore / long stalls) so a huge elapsed delta cannot lock the loop.
5. `src/engine/simulate.ts` runs a whole shot to rest by repeatedly calling `step`, capped at a maximum step count. It is the same deterministic engine the bot uses as its simulator - never a separate approximation.

## Determinism Rules (Absolute)

1. **No `Math.random`, `Date.now`, `performance.now`, `fetch`, timers, or any DOM/global read** inside `src/engine`, `src/rules`, or `src/bot`. These are lint-enforceable boundaries.
2. All randomness (bot aim/power noise, any jitter) comes from a **single seeded PRNG**. The seed is part of the persisted game snapshot. Pass PRNG/seed in explicitly; never construct one from a clock.
3. Use plain `f64` math. Do not depend on transcendental exactness across engines; assert with tolerances in snapshot tests rather than bit-exact equality where platform math differs.
4. **Determinism invariant:** the same `(state, seed, ShotInput)` must always produce the identical event log and identical at-rest state. This is what enables replay fixtures, exact-match tests, deterministic bot behavior, and future shot-replay features. Any change that breaks it is a bug.

## Snapshot Persistence and Versioning

1. **What is saved.** The single in-progress game (`GameSnapshot` in `src/types/persistence.ts`, persisted by `src/db`) holds the serialized rules `GameState`, the at-rest ball field, the bot difficulty, the base PRNG `seed`, and a schema `version`. Restoring these rebuilds the controller and keeps the bot deterministic (the seed and `pocketed` count drive bot planning), so a resumed game plays identically to one that never quit.
2. **Saved between shots only.** A snapshot is written at a shot boundary (all balls at rest), never mid-simulation. Mid-flight state is transient render data and is never persisted.
3. **Version policy (discard, never migrate).** `SCHEMA_VERSION` is bumped whenever the persisted shapes change incompatibly. On load, a snapshot whose `version` does not equal the current `SCHEMA_VERSION` is **discarded** (deleted and treated as absent), not migrated. This keeps the resume path simple and guarantees a restored game is always structurally valid for the running build.

## Units and Coordinate Conventions

1. The engine works entirely in **table-space**: a right-handed 2D coordinate system in physical-ish units (meters or table units - pick one and document it in `src/types/physics.ts`). Positions, velocities, and radii are all table-space. The engine knows nothing about pixels, DPR, or the screen.
2. **Screen-space** (pixels, DPR, letterboxing, portrait rotation) exists only in `src/render/transform.ts`. Conversion table<->pixel happens there and nowhere else. Never mix pixels into engine or rules code.
3. Table geometry is **data-driven**: `src/engine/tables/eightBall.ts` describes cushions, pockets, and dimensions as data. Snooker later is just a new geometry file - the engine code stays unchanged. Do not hardcode 8-ball dimensions into engine algorithms.
4. `src/engine/vec2.ts` is the only vector math module. Reuse it; do not inline vector math or add a vector dependency.

## Collision and Substepping Policy

1. Ball-ball collisions are elastic with a restitution coefficient; cushions reflect (angle in = angle out, with restitution). Friction (`src/engine/friction.ts`) models sliding -> rolling transition and a stop threshold so balls always come to rest.
2. **Swept-circle continuous collision detection** prevents tunneling. When a ball's displacement in a tick exceeds ~1/4 of its radius, **substep** that tick (subdivide `dt`) so fast balls cannot pass through balls or cushions. High-velocity tunneling has a dedicated regression test.
3. Collision resolution order within a tick must be deterministic (stable ordering of pairs/contacts) - never dependent on iteration over a hashed/unordered structure.
4. No allocation in the collision inner loop (see engineering skill hot-path rule) - reuse scratch vectors.

## PhysicsEvent Vocabulary

The engine emits an ordered event log during a shot; the rules reducer consumes it. Keep this vocabulary the shared contract between `src/engine` (producer) and `src/rules` (consumer) - define it in `src/types/physics.ts`.

Events include, at minimum:
- **first-contact** - the cue ball's first ball-to-ball contact of the shot (which ball), used for legal-shot / wrong-ball-first fouls.
- **ball-ball** - any ball-to-ball collision (ordered).
- **rail** / **cushion** - a ball contacts a cushion (which ball, which rail), used for break legality (4 balls to rails or a pocket) and no-rail fouls.
- **pocket** - a ball is pocketed (which ball, which pocket, tick index) - includes the cue ball (scratch) and the 8-ball.
- **rest** - the shot has come to rest (terminal event).

Events carry enough data (ball id, tick/order index, target) for the rules reducer to decide legality, fouls, and win/loss purely from the log. The reducer must never re-run physics; it reads the log only.

## Rules Reducer (src/rules/eightBall.ts)

1. Pure `reduce(gameState, shotOutcome) -> gameState`, where `shotOutcome` is derived from the engine event log for one shot. No physics, no I/O, no clock.
2. Covers: rack layout, break legality, open table, solids/stripes assignment, legal-shot determination, fouls -> ball-in-hand, 8-ball win/loss (early or wrong-pocket 8-ball = loss), and two-seat turn alternation (`player` vs `bot`).
3. From any valid state and valid outcome it must never reach an invalid state (property-tested). Handle edge cases explicitly: simultaneous pockets, cue + 8 pocketed together, wrong-ball-first.

### House rules encoded in the reducer

These resolve the ambiguous cases the plan left to implementer choice. Keep them consistent with `src/rules/eightBall.ts`:

- **Open table after the break.** The table is always open immediately after the break; a group is claimed on the first legal pot **after** the break, never on the break itself.
- **8-ball on the break -> re-rack.** Pocketing the 8 on the break re-racks and the **same player breaks again** (chosen over spotting the 8). The reducer signals this by returning a fresh `break`-phase state; the controller re-racks the balls whenever the phase is `break`.
- **Break scratch -> kitchen ball-in-hand.** A cue scratch on the break gives the opponent ball-in-hand behind the head string (`kitchen`); every other foul gives ball-in-hand `anywhere`. Pocketed object balls stay down on a foul.
- **Both groups potted on the open table.** The shooter is assigned the group of the **first ball in pocket order** (there is no call-shot model).
- **8-ball loss.** Pocketing the 8 while not on the 8, or while scratching, or after a wrong first contact, is a loss; a win requires being on the 8, striking it first, and not scratching.

## Security (Reduced Surface)

The game takes **no external input**, makes **no runtime `fetch`**, and renders to Canvas (no HTML injection). So client-side security shrinks to three rules:
1. **No external input** - all state is locally generated/persisted; there is nothing untrusted to validate at a network boundary because there is no network.
2. **No `innerHTML`** (and no `eval`/`Function`/`document.write`). The game surface is Canvas; HUD is Mantine components - never build markup from strings.
3. **No runtime fetch** - nothing is loaded from the network after install; assets are precached. A `fetch` appearing anywhere is a regression against the offline guarantee.
