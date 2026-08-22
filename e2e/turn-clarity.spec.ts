// Whose turn it is has to be obvious without reading carefully. The two seat
// chips carry it, so these assert the chips actually change state, not just the
// wording, and that the controls recede with them.

import { test, expect } from '@playwright/test';
import { openMenu, startGame, setPower, shoot } from './app';
import type { Page } from '@playwright/test';

const seatActive = (page: Page, seat: 'player' | 'bot'): Promise<string | null> =>
  page.getByTestId(`seat-${seat}`).getAttribute('data-active');

const seatEdge = (page: Page, seat: 'player' | 'bot'): Promise<string> =>
  page.getByTestId(`seat-${seat}`).evaluate((el) => getComputedStyle(el).borderLeftColor);

const panelOpacity = (page: Page): Promise<number> =>
  page
    .locator('section[aria-label="Aim controls"]')
    .evaluate((el) => Number(getComputedStyle(el).opacity));

test('the accent moves between the seat chips as the turn passes', async ({ page }) => {
  await openMenu(page);
  await startGame(page);

  expect(await seatActive(page, 'player')).toBe('true');
  expect(await seatActive(page, 'bot')).toBe('false');
  // The lit chip and the waiting chip must not share an edge colour.
  const playerLit = await seatEdge(page, 'player');
  const botIdle = await seatEdge(page, 'bot');
  expect(playerLit).not.toBe(botIdle);
  await expect.poll(() => panelOpacity(page)).toBe(1);

  await setPower(page, 0.1);
  await shoot(page);
  await expect(page.getByText('Bot is planning its shot')).toBeVisible({ timeout: 30_000 });

  // The accent has swapped sides, and the controls recede with it.
  expect(await seatActive(page, 'player')).toBe('false');
  expect(await seatActive(page, 'bot')).toBe('true');
  expect(await seatEdge(page, 'bot')).toBe(playerLit);
  expect(await seatEdge(page, 'player')).toBe(botIdle);
  expect(await panelOpacity(page)).toBeLessThan(1);
});
