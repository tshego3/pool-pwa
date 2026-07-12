// Persisted user preferences (saved to IndexedDB via src/db). `tableColor` is a
// key into src/render/palette.ts TABLE_PALETTES; it is kept as a string here so
// the pure types layer takes no dependency on the render layer.

import type { Difficulty } from './bot';

export interface GameSettings {
  readonly soundEnabled: boolean;
  // Number of cushion bounces the aiming guide line follows.
  readonly guideBounces: number;
  readonly tableColor: string;
  readonly handedness: 'left' | 'right';
  readonly defaultDifficulty: Difficulty;
  readonly showAngleControls: boolean;
}
