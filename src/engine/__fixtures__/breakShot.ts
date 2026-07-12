// A straight break: the cue ball driven from the head spot into the rack apex.
// Used to assert determinism (identical log across replays) and that a real
// shot settles within the step cap.

import type { PhysicsScenario } from './runScenario';
import { createEightBallTable, rackEightBall } from '../tables/eightBall';
import { DEFAULT_PHYSICS } from '../config';

export const breakShotScenario: PhysicsScenario = {
  name: 'straight-break-into-rack-apex',
  initialState: { tick: 0, balls: rackEightBall() },
  shots: [{ angle: 0, power: 1 }],
  geometry: createEightBallTable(),
  config: DEFAULT_PHYSICS,
};
