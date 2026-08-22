// The app boots, the menu works, and a new game actually renders a table. This
// is the one spec that fails loudly if the bundle, the service worker
// registration, or the canvas transform breaks.

import { test, expect } from '@playwright/test';
import { openMenu, startGame, canvasIsBlank } from './app';

test('menu offers a new game and no resume slot on a clean device', async ({ page }) => {
  await openMenu(page);
  await expect(page.getByRole('button', { name: 'New game' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Resume game' })).toBeDisabled();
});

test('a new game renders the table and hands the first turn to the player', async ({ page }) => {
  await openMenu(page);
  const canvas = await startGame(page);
  expect(await canvasIsBlank(canvas)).toBe(false);
  await expect(page.getByText('Your turn')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shoot' })).toBeDisabled();
});
