---
name: pool-pwa-state-testing
description: Test-first rules for pool-pwa plus the 4-branch state pattern for DB-backed screens. Use when writing or editing any physics function, rules transition, or bot planning code (all require co-located Vitest tests), when authoring shot-replay scenario fixtures, or when building a screen/hook that loads async data from IndexedDB (loading/error/data/empty states).
---

# Testing (Test-First) and State Management

Tests are first-class in pool-pwa: the pure engine/rules/bot core must be exhaustively tested. This skill defines what must be tested, the shot-replay fixture format, and the 4-branch pattern for DB-backed screens.

## Mandatory Co-located Tests

Co-locate tests with source (`engine/collision.ts` -> `engine/collision.test.ts`). The following are **not optional**:

1. **Every physics function** in `src/engine/` gets a Vitest test (vec2 ops, collision resolution, friction/stop, pocket detection, `step`, `simulate`).
2. **Every rules transition** in `src/rules/` gets a test (break foul, open-table assignment, group assignment, scratch -> ball-in-hand, wrong-ball-first foul, early/wrong-pocket 8-ball loss, legal win, turn alternation).
3. **Bot planning** in `src/bot/` gets tests (produces a legal shot; pots a trivial straight shot given a fixed seed; never returns an illegal shot over random legal states; difficulty ordering: hard pots >= easy over a seeded scenario set).

Vitest runs in a node environment for these logic tests (no DOM needed). Name tests descriptively: `describe('resolveBallCollision')` -> `it('conserves momentum in a head-on elastic collision')`.

## Key Test Properties (from the physics-rules contract)

1. **Determinism:** the same `(state, seed, ShotInput)` produces an identical event log twice. Assert the full event log, not just the end state.
2. **Momentum conservation:** head-on and glancing collisions conserve momentum within tolerance.
3. **Cushion reflection:** angle in = angle out within tolerance.
4. **No tunneling:** a high-velocity shot never passes a ball through another ball or a cushion (regression test).
5. **Always at rest:** `simulate()` terminates with all balls at rest under the step cap.
6. **Rules never invalid:** property test - from valid state + valid outcome, the reducer never yields an invalid state.

Use tolerances (not bit-exact equality) for float comparisons where platform math may differ; assert event logs and discrete outcomes exactly.

## Shot-Replay Scenario Fixture Format

Physics/rules regression scenarios are data fixtures, not ad-hoc setup. A scenario is:

```typescript
interface ShotReplayScenario {
  readonly name: string;              // 'break-4-balls-to-rail-is-legal'
  readonly seed: number;              // PRNG seed (part of determinism contract)
  readonly initialState: GameState;   // rack / at-rest ball positions + rules state
  readonly shots: readonly ShotInput[]; // one or more shots applied in order
  readonly expectedEvents: readonly PhysicsEvent[]; // ordered event log to assert
  readonly expectedState?: GameState; // optional final rules state to assert
}
```

Rules: fixtures live alongside their tests (e.g. `src/engine/__fixtures__/` or next to the test file). Each fixture is replayed by feeding `initialState` + `shots` + `seed` through `simulate()`/`reduce()` and asserting `expectedEvents` (exact, ordered) and, when present, `expectedState`. Because the engine is deterministic, these are exact-match tests and double as the future shot-replay feature's data.

## 4-Branch State Pattern (DB-backed Screens)

For screens/hooks that load async data from IndexedDB (`useStats`, resume-game, settings), use the 4-branch pattern. Game snapshots are saved between shots only.

### Required state elements

1. **Data** - collection initialized to `[]` (or a typed `null` for a single record), never `undefined`.
2. **Loading** - `isLoading: boolean`, true during the DB read.
3. **Error** - `errorMessage: string | null`, user-safe, null on success.
4. **Derived/computed** - `hasItems`, counts, filtered views - always computed fresh, never stored.

### 4-branch rendering (exact order)

```typescript
if (isLoading) {
  // BRANCH 1: Loading - skeleton/spinner
} else if (errorMessage) {
  // BRANCH 2: Error - message + retry action (always provided)
} else if (items.length > 0) {
  // BRANCH 3: Data - content (render computed views, never raw state directly)
} else {
  // BRANCH 4: Empty - guidance message (e.g. "No games played yet")
}
```

### Non-negotiable rules

1. Set `isLoading = true` at start and `false` in exactly one place: the `finally` block.
2. Always initialize collections to `[]`.
3. Keep filter/derivation logic in the hook layer as pure computed values - never in components.
4. Never skip a branch - render all 4, in order.
5. Never show raw error strings to users. No non-null assertions (`!`) on state.

## Test Patterns

```typescript
// src/engine/collision.test.ts
import { describe, it, expect } from 'vitest';
import { resolveBallCollision } from './collision';
import { add, scale } from './vec2';

describe('resolveBallCollision', () => {
  it('conserves total momentum in a head-on elastic collision', () => {
    const before = totalMomentum(ballA, ballB);
    const [a2, b2] = resolveBallCollision(ballA, ballB);
    const after = totalMomentum(a2, b2);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });
});
```

```typescript
// src/engine/simulate.test.ts - determinism via replay fixture
import { describe, it, expect } from 'vitest';
import { runScenario } from './__fixtures__/runScenario';
import { breakToRailScenario } from './__fixtures__/breakToRail';

describe('simulate (determinism)', () => {
  it('produces the identical event log for the same seed and shot', () => {
    const run1 = runScenario(breakToRailScenario);
    const run2 = runScenario(breakToRailScenario);
    expect(run1.events).toEqual(run2.events);
    expect(run1.events).toEqual(breakToRailScenario.expectedEvents);
  });
});
```

```typescript
// State flow test for a DB-backed hook
it('sets a user-safe error message when the DB read fails', async () => {
  vi.spyOn(db, 'getStats').mockRejectedValueOnce(new Error('idb blocked'));
  const state = await loadStats();
  expect(state.isLoading).toBe(false);
  expect(state.errorMessage).toBe('Could not load your stats. Please try again.');
  expect(state.items).toEqual([]);
});
```

Run `npm run build` (zero TS errors) and `npm test` before completion. Validate accessibility with automated checks on key screens.
