// The table color setting must reach the canvas, not just IndexedDB. The felt
// is drawn on the static layer, so only a real frame proves it changed.

import { test, expect } from '@playwright/test';
import { openMenu, startGame, canvasPixels } from './app';
import type { Page } from '@playwright/test';

const chooseColor = async (page: Page, label: string): Promise<void> => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Table color' }).click();
  await page.getByRole('option', { name: label }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Settings saved!')).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
};

const feltFrame = async (page: Page, label: string): Promise<string> => {
  await chooseColor(page, label);
  const canvas = await startGame(page);
  const frame = await canvasPixels(canvas);
  await page.getByRole('button', { name: 'Back to menu' }).click();
  return frame;
};

test('the chosen felt is the felt that gets drawn', async ({ page }) => {
  await openMenu(page);
  // Same rack, same aim, same everything but the finish.
  const green = await feltFrame(page, 'classic green');
  const burgundy = await feltFrame(page, 'burgundy');
  expect(burgundy).not.toBe(green);
});
