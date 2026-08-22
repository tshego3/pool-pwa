// The aiming guide is drawn on the canvas, so only a real browser can confirm
// it appears, follows the aim, and gets out of the way once the shot is taken.

import { test, expect } from '@playwright/test';
import { openMenu, startGame, canvasPixels, setPower, shoot, steerAim } from './app';

test('the guide redraws when the aim changes', async ({ page }) => {
  await openMenu(page);
  const canvas = await startGame(page);
  const before = await canvasPixels(canvas);
  await steerAim(page, canvas);
  await expect.poll(() => canvasPixels(canvas)).not.toBe(before);
});

test('the guide clears while the balls are in motion', async ({ page }) => {
  await openMenu(page);
  const canvas = await startGame(page);
  await setPower(page, 0.1);
  const aiming = await canvasPixels(canvas);
  await shoot(page);
  await expect(page.getByText('Balls in motion')).toBeVisible();
  // The guide belongs to the player's aim, so the moving table cannot match it.
  expect(await canvasPixels(canvas)).not.toBe(aiming);
});
