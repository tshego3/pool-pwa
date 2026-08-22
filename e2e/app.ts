// Shared driving helpers for the end-to-end specs. Everything here talks to the
// app the way a player does - visible controls only - so a spec breaks when the
// user-facing flow breaks, not when internals move.

import { expect, type Locator, type Page } from '@playwright/test';

// Open the menu on a clean slate. Each Playwright context starts with empty
// IndexedDB, so there is never a stale saved game or settings record.
export const openMenu = async (page: Page): Promise<void> => {
  await page.goto('/pool-pwa/');
  await expect(page.getByRole('heading', { name: '8-Ball Pool' })).toBeVisible();
};

export const startGame = async (page: Page): Promise<Locator> => {
  await page.getByRole('button', { name: 'New game' }).click();
  const canvas = page.getByLabel('Pool table');
  await expect(canvas).toBeVisible();
  // The first frame is drawn from a rAF callback, so wait for real pixels.
  await expect.poll(() => canvasIsBlank(canvas), { timeout: 10_000 }).toBe(false);
  return canvas;
};

// Drag the power track to a fraction of full power. The control is a pointer
// slider (press, move, release), not a click target.
export const setPower = async (page: Page, fraction: number): Promise<void> => {
  const track = page.getByTestId('power-track');
  const box = await track.boundingBox();
  if (box === null) throw new Error('power track is not visible');
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height * (1 - fraction), { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText(`${Math.round(fraction * 100)}%`)).toBeVisible();
};

export const shoot = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Shoot' }).click();
};

// Read the canvas back as raw pixels. Used to prove the renderer actually drew
// something and that it redraws when the aim changes.
export const canvasPixels = (canvas: Locator): Promise<string> =>
  canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());

export const canvasIsBlank = async (canvas: Locator): Promise<boolean> =>
  canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (ctx === null) return true;
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return false;
    }
    return true;
  });

// Steer the aim by sweeping the pointer around the middle of the table. Aiming
// is relative (a drag corrects the angle), so a fixed sweep is repeatable.
export const steerAim = async (page: Page, canvas: Locator): Promise<void> => {
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('canvas is not visible');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx + box.width * 0.3, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + box.height * 0.35, { steps: 10 });
  await page.mouse.up();
};

// Turn on the angle readout, so a spec can see the aim itself and not just the
// power percentage. Starts and ends on the menu.
export const enableAngleControls = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByLabel('Show angle controls').check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Settings saved!')).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
};
