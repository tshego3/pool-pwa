// Pure distillation of one shot's PhysicsEvent log into a ShotOutcome. This is
// the only place that reads the raw event vocabulary on behalf of the rules
// reducer; the reducer itself never sees ticks or event ordering. No physics is
// re-run here - the log is read once, in order.

import type { PhysicsEvent } from '../types/physics';
import type { ShotOutcome } from '../types/rules';

// The cue ball's id in table geometry. Kept local to avoid importing the engine
// config into the rules layer; it matches DEFAULT_PHYSICS.cueBallId.
const CUE_BALL_ID = 0;

export const deriveOutcome = (events: readonly PhysicsEvent[]): ShotOutcome => {
  let firstContact = -1;
  let firstContactTick = Infinity;
  const pocketed: number[] = [];
  let cueScratch = false;
  const railedBalls = new Set<number>();

  // Pass 1: the cue's first ball contact and its tick, plus pockets and the set
  // of balls that reached a rail.
  for (const ev of events) {
    switch (ev.type) {
      case 'first-contact':
        if (firstContact === -1) {
          firstContact = ev.other;
          firstContactTick = ev.tick;
        }
        break;
      case 'pocket':
        if (ev.ball === CUE_BALL_ID) cueScratch = true;
        else pocketed.push(ev.ball);
        break;
      case 'rail':
        railedBalls.add(ev.ball);
        break;
      default:
        break;
    }
  }

  // Pass 2: was any rail contacted at or after the first-contact tick? Separated
  // so log ordering within a single tick cannot hide a same-tick rail.
  const railAfterContact = events.some(
    (ev) => ev.type === 'rail' && ev.tick >= firstContactTick,
  );

  return {
    firstContact,
    pocketed,
    cueScratch,
    railAfterContact,
    railedBallCount: railedBalls.size,
  };
};
