import { defineConfig, devices } from '@playwright/test';

import { resolveE2EBaseUrl } from './e2e/base-url.js';

/**
 * The committed E2E suites.
 *
 * Distinct from the MCP-driven Playwright the `browser-verifier` and
 * `parity-checker` agents use: that is an agent steering a browser during a
 * ticket, this is a runner defending the critical journeys afterwards. They
 * share only the `.auth/` storage state, deliberately — an agent never types a
 * password and neither do these.
 *
 * Run through the lane so the port resolves:
 *   pnpm lane:exec <ticket> -- pnpm --filter @vendor-marketplace/web test:e2e
 */
const baseURL = resolveE2EBaseUrl();

/**
 * The reference viewport is the design contract's: `design/Orla - Screens.dc.html`
 * draws every frame at 1440x900 and that is the parity goal, so it is where the
 * whole suite runs. The narrower widths run only the specs that assert
 * responsive behaviour — running every journey four times would quadruple the
 * wall clock to re-prove the same server behaviour at a different width.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts$/,
  // A journey drives several pages; the default 30s is tight once a cold Next
  // route compiles on first hit.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  /*
   * No retry budget, on CI or locally. `.claude/rules/testing.md`: "a flaky test
   * is a defect with a root cause, not a retry budget." A retry on CI would hide
   * exactly the races an end-to-end suite exists to find, and would do it
   * silently — the second attempt is the one that gets reported.
   */
  retries: 0,
  // Serial by default: the suites share one lane database, and two journeys
  // mutating the same vendor's bookings interleave into failures that look like
  // product defects.
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL,
    /*
     * Playwright's 30s navigation default is too tight for a cold dev server:
     * the first hit on a route compiles it, and a heavy route plus Clerk exceeds
     * that with the server perfectly healthy. A `page.goto` timeout then reads
     * as a broken route, which is the most expensive kind of wrong answer — it
     * points the next person at the feature instead of at the compile.
     */
    navigationTimeout: 60_000,
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /.*\.responsive\.spec\.ts$/,
    },
    {
      name: 'responsive-1024',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } },
      testMatch: /.*\.responsive\.spec\.ts$/,
    },
    {
      name: 'responsive-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
      testMatch: /.*\.responsive\.spec\.ts$/,
    },
    {
      name: 'responsive-390',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
      testMatch: /.*\.responsive\.spec\.ts$/,
    },
  ],
});
