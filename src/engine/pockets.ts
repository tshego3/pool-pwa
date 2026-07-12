// Pocket capture: a ball whose center falls within a pocket's capture radius is
// pocketed. The capture radius encodes the mouth geometry (it is larger than a
// ball radius, so a ball approaching the mouth is drawn in).

import type { Ball, Pocket } from '../types/physics';

// Index of the pocket capturing this ball, or -1 if none. Ties resolve to the
// lowest pocket index for determinism.
export const capturingPocket = (ball: Ball, pockets: readonly Pocket[]): number => {
  for (let i = 0; i < pockets.length; i++) {
    const p = pockets[i];
    if (p === undefined) continue;
    const dx = ball.position.x - p.position.x;
    const dy = ball.position.y - p.position.y;
    if (dx * dx + dy * dy <= p.radius * p.radius) return i;
  }
  return -1;
};
