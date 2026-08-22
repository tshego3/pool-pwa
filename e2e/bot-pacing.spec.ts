// The bot plans in a Web Worker in a few milliseconds. Without pacing it fires
// the instant the player's balls stop, which reads as a machine. This spec
// measures the real elapsed time the "thinking" state stays on screen.

import { test, expect } from '@playwright/test';
import { openMenu, startGame, setPower, shoot, enableAngleControls } from './app';

// Deliberately below the 2200 ms the session holds, to absorb polling lag.
const MIN_VISIBLE_MS = 1800;

test('the bot pauses before taking its shot', async ({ page }) => {
  await openMenu(page);
  await startGame(page);
  // A soft shot that reaches nothing: no contact is a foul, so the turn passes
  // to the bot without depending on what the break happens to pot.
  await setPower(page, 0.1);
  await shoot(page);

  const thinking = page.getByText('Bot is planning its shot');
  await expect(thinking).toBeVisible({ timeout: 30_000 });
  const startedAt = Date.now();
  // The foul that handed the turn over is on screen during the pause. A break
  // that reaches nothing is an illegal break, not a plain no-contact foul.
  await expect(page.getByRole('alert')).toContainText('Illegal break');
  await expect(thinking).toBeHidden({ timeout: 20_000 });
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(MIN_VISIBLE_MS);
});

test('the controls work through the bot search while it thinks', async ({ page }) => {
  await openMenu(page);
  await enableAngleControls(page);
  await startGame(page);
  await setPower(page, 0.1);
  await shoot(page);

  // One read of the aim readout plus whether the bot is still thinking, so the
  // sampling never spills past the thinking beat into the final settled shot.
  const sample = () =>
    page.evaluate(() => {
      const panel = document.querySelector('section[aria-label="Aim controls"]');
      return {
        thinking: document.body.textContent?.includes('Bot is planning its shot') === true,
        readout: panel?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      };
    });

  await expect(page.getByText('Bot is planning its shot')).toBeVisible({ timeout: 30_000 });
  const seen = new Set<string>();
  const deadline = Date.now() + 10_000;
  for (;;) {
    const s = await sample();
    if (!s.thinking || Date.now() > deadline) break;
    seen.add(s.readout);
  }
  // Several distinct aims within the thinking beat: the search is being
  // replayed, not a single final shot snapped into place at the end.
  expect(seen.size).toBeGreaterThan(1);
  // And none of it was ever playable by hand.
  await expect(page.getByRole('button', { name: 'Shoot' })).toBeDisabled();
});

test('the controls mirror the bot shot without letting the player take it', async ({ page }) => {
  await openMenu(page);
  await startGame(page);
  await setPower(page, 0.1);
  await shoot(page);

  // One read of everything that matters, sampled fast enough to land inside the
  // beat where the bot is addressing the ball.
  const hud = () =>
    page.evaluate(() => {
      const shootButton = document.querySelector('button[aria-label="Shoot"]');
      const panel = document.querySelector('section[aria-label="Aim controls"]');
      const percent = panel?.textContent?.match(/(\d+)%/);
      const botSeat = document.querySelector('[data-testid="seat-bot"]');
      return {
        botTurn: botSeat?.getAttribute('data-active') === 'true',
        shootDisabled: shootButton?.hasAttribute('disabled') === true,
        power: percent === null || percent === undefined ? 0 : Number(percent[1]),
      };
    });

  await expect
    .poll(async () => {
      const s = await hud();
      return s.botTurn && s.shootDisabled && s.power > 0;
    }, { timeout: 30_000, intervals: [50] })
    .toBe(true);
});
