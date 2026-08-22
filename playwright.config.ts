// End-to-end config. The specs drive the real app in a browser, which is the
// only place the canvas renderer, the rAF loop, the bot Web Worker, and
// IndexedDB run together. Unit-level physics/rules coverage stays in Vitest.

import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
// Vite serves under the GitHub Pages base path, in dev as well as in production.
export const BASE_URL = `http://localhost:${PORT}/pool-pwa/`;

export default defineConfig({
  testDir: './e2e',
  // A shot animates in real time, so a spec that plays one needs room.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: process.env.CI === 'true',
  retries: process.env.CI === 'true' ? 1 : 0,
  workers: 1,
  reporter: process.env.CI === 'true' ? 'list' : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    // A phone-sized viewport is the primary target (mobile-first).
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: process.env.CI !== 'true',
    timeout: 60_000,
  },
});
