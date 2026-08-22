// The "guide line bounces" setting must reach the canvas, not just IndexedDB.
// The two runs below are identical apart from that setting - same rack, same
// aim - so a difference in the drawn frame is the setting taking effect.

import { test, expect } from '@playwright/test';
import { openMenu, startGame, canvasPixels } from './app';
import type { Page } from '@playwright/test';

// Aim up-table at 60 degrees: the line reaches the top cushion with no ball in
// the way and clear of the side pocket, which is the only case where following
// bounces changes the picture.
const NUDGES = 60;

const applySettings = async (page: Page, bounces: number): Promise<void> => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  const slider = page.getByRole('slider');
  await slider.focus();
  for (let i = 0; i < bounces; i++) await slider.press('ArrowRight');
  await expect(page.getByText(`Guide line bounces: ${bounces}`)).toBeVisible();
  const angleToggle = page.getByLabel('Show angle controls');
  if (!(await angleToggle.isChecked())) await angleToggle.check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Settings saved!')).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
};

const aimedFrame = async (page: Page, bounces: number): Promise<string> => {
  await applySettings(page, bounces);
  const canvas = await startGame(page);
  const nudge = page.getByRole('button', { name: 'Nudge aim counter-clockwise' });
  for (let i = 0; i < NUDGES; i++) await nudge.click();
  await expect(page.getByText(`${360 - NUDGES}°`)).toBeVisible();
  const frame = await canvasPixels(canvas);
  await page.getByRole('button', { name: 'Back to menu' }).click();
  return frame;
};

test('following cushions changes the drawn guide', async ({ page }) => {
  await openMenu(page);
  const straight = await aimedFrame(page, 0);
  const bounced = await aimedFrame(page, 3);
  expect(bounced).not.toBe(straight);
});
