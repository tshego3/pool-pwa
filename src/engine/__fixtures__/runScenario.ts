// Shot-replay scenario harness. A scenario feeds initialState + ordered shots
// through the deterministic simulate() and returns the concatenated event log
// and final state. Because the engine is deterministic these double as the
// future shot-replay feature's data. The rules-layer GameState arrives in a
// later phase; physics scenarios describe the ball field only.

import type {
  PhysicsState,
  PhysicsEvent,
  ShotInput,
  TableGeometry,
  PhysicsConfig,
} from '../../types/physics';
import { simulate } from '../simulate';

export interface PhysicsScenario {
  readonly name: string;
  readonly initialState: PhysicsState;
  readonly shots: readonly ShotInput[];
  readonly geometry: TableGeometry;
  readonly config: PhysicsConfig;
  // Optional exact event log to assert. Omitted where hand-authoring the full
  // log is impractical; determinism is then asserted by replaying twice.
  readonly expectedEvents?: readonly PhysicsEvent[];
}

export interface ScenarioRun {
  readonly finalState: PhysicsState;
  readonly events: readonly PhysicsEvent[];
}

export const runScenario = (scenario: PhysicsScenario): ScenarioRun => {
  let state = scenario.initialState;
  const events: PhysicsEvent[] = [];
  for (const shot of scenario.shots) {
    const result = simulate(state, shot, scenario.geometry, scenario.config);
    state = result.finalState;
    for (const ev of result.events) events.push(ev);
  }
  return { finalState: state, events };
};
