// Default tunable constants for the physics engine. These are data, not logic:
// step/simulate accept a PhysicsConfig so behavior stays deterministic and
// testable. Values are in SI-ish table units (meters, seconds, m/s).

import type { PhysicsConfig } from '../types/physics';

export const DEFAULT_PHYSICS: PhysicsConfig = {
  dt: 1 / 120,
  ballRestitution: 0.95,
  cushionRestitution: 0.85,
  slidingDecel: 1.2,
  rollingDecel: 0.35,
  slidingThreshold: 1.0,
  stopVelocity: 0.02,
  maxLaunchSpeed: 6.0,
  // 90 s of simulated time at 120 Hz: ample for any real shot to settle.
  maxSteps: 10800,
  maxSubsteps: 64,
  cueBallId: 0,
};
