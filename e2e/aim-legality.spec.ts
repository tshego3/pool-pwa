// The aim is the answer to "which balls are mine": it predicts a shot only when
// the cue would first strike a ball the shooter may legally hit. Aiming at an
// opponent ball leaves a faint approach line and no prediction at all.

import { test, expect } from '@playwright/test';
import { openMenu, enableAngleControls } from './app';
import type { Page } from '@playwright/test';

// Both frames show the same resting balls, so comparing one against the other
// cancels the balls out and leaves only the guide. The prediction is drawn in
// near-white; the blocked approach is a faint dash that never reaches it.
const BRIGHT = 200;

const rememberFrame = (page: Page): Promise<void> =>
  page.getByLabel('Pool table').evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('no canvas context');
    const store = window as unknown as { __frame?: ImageData };
    store.__frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  });

// Bright pixels each frame has that the other does not: the ink of its guide.
const guideInkAgainstRemembered = (
  page: Page,
): Promise<{ readonly now: number; readonly remembered: number }> =>
  page.getByLabel('Pool table').evaluate((el, bright) => {
    const canvas = el as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    const before = (window as unknown as { __frame?: ImageData }).__frame;
    if (ctx === null || before === undefined) throw new Error('no frame to compare');
    const after = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const isBright = (d: Uint8ClampedArray, i: number): boolean =>
      (d[i] ?? 0) >= bright && (d[i + 1] ?? 0) >= bright && (d[i + 2] ?? 0) >= bright;
    let now = 0;
    let remembered = 0;
    for (let i = 0; i < after.data.length; i += 4) {
      const a = isBright(after.data, i);
      const b = isBright(before.data, i);
      if (a && !b) now++;
      if (b && !a) remembered++;
    }
    return { now, remembered };
  }, BRIGHT);

const nudge = async (
  page: Page,
  direction: 'clockwise' | 'counter-clockwise',
  times: number,
): Promise<void> => {
  const button = page.getByRole('button', { name: `Nudge aim ${direction}` });
  for (let i = 0; i < times; i++) await button.click();
};

// Write a mid-game save straight into IndexedDB, so the spec can reach an
// assigned-groups table without depending on how the balls happen to fall.
const seedAssignedGame = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const RADIUS = 0.028575;
    const down = [1, 3];
    const layout: readonly (readonly [number, number, number])[] = [
      [0, 0.495, 0.495],
      [2, 0.9, 0.35], [4, 1.05, 0.35], [5, 1.2, 0.35], [6, 1.35, 0.35], [7, 1.5, 0.35],
      [8, 1.65, 0.5],
      [9, 0.9, 0.65], [10, 1.05, 0.65], [11, 1.2, 0.65], [12, 1.35, 0.65],
      [13, 1.5, 0.65], [14, 1.65, 0.8], [15, 1.8, 0.8],
      [1, 0.3, 0.3], [3, 0.3, 0.7],
    ];
    const balls = layout.map(([id, x, y]) => ({
      id,
      position: { x, y },
      velocity: { x: 0, y: 0 },
      spin: { x: 0, y: 0 },
      radius: RADIUS,
      pocketed: down.includes(id),
    }));
    const snapshot = {
      version: 1,
      game: {
        phase: 'assigned',
        turn: 'player',
        groups: { player: 'solids', bot: 'stripes' },
        pocketed: down,
        ballInHand: 'none',
        foul: null,
        winner: null,
      },
      balls,
      difficulty: 'medium',
      seed: 42,
    };
    return new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('pool-pwa', 1);
      open.onerror = () => reject(new Error('could not open the game database'));
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('gameSnapshot', 'readwrite');
        tx.objectStore('gameSnapshot').put(snapshot, 'current');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(new Error('could not write the saved game'));
      };
    });
  });

test('the aim predicts on the player balls and goes dead on the bot balls', async ({ page }) => {
  await openMenu(page);
  await enableAngleControls(page);
  await seedAssignedGame(page);
  await page.reload();
  await page.getByRole('button', { name: 'Resume game' }).click();
  await expect(page.getByLabel('Pool table')).toBeVisible();
  await expect(page.getByTestId('seat-player')).toContainText('Solids');

  // The seeded layout puts the player's solids above the cue ball and the bot's
  // stripes below it, so a fixed nudge picks a known group.
  await nudge(page, 'counter-clockwise', 20);
  await expect(page.getByText('340°')).toBeVisible();
  await rememberFrame(page);

  await nudge(page, 'clockwise', 41);
  await expect(page.getByText('21°')).toBeVisible();
  const ink = await guideInkAgainstRemembered(page);

  // Aiming at the player's own ball draws a full, bright prediction. Aiming at
  // the bot's draws only the faint approach, which never reaches that tone.
  expect(ink.remembered).toBeGreaterThan(200);
  expect(ink.now).toBeLessThan(ink.remembered / 5);
});
