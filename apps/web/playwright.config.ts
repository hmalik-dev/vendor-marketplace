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
 * A project's own `testIgnore` replaces the top-level one rather than
 * merging with it, so every project below that sets its own `testIgnore`
 * spreads this in too — see the comment on the top-level `testIgnore`.
 */
const STAGING_SPEC_IGNORE = /.*\.staging\.spec\.ts$/;

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
  /*
   * `staging-messages-rls.staging.spec.ts` (VEN-562) signs up real accounts
   * against a live deployment and must never run here, in the lane or in CI —
   * `playwright.staging.config.ts` is its own entry point, matched by the same
   * `.staging.spec.ts` suffix this excludes.
   *
   * This alone is not enough: a project's own `testIgnore` **replaces** this
   * top-level one rather than adding to it, so `STAGING_SPEC_IGNORE` below is
   * also spread into every project that sets its own `testIgnore` — confirmed
   * by driving `playwright test --list` under the `desktop-1440` project
   * before that project also carried the pattern, which loaded (and ran) this
   * spec's module-level `assertStagingEnvironment()`.
   */
  // VEN-779 DIAGNOSTIC: touching this file selects the full suite in CI. Removed before merge.
  testIgnore: STAGING_SPEC_IGNORE,
  // Fills `next start`'s image cache before a journey can wedge it (VEN-655).
  globalSetup: './e2e/global-setup.ts',
  // A journey drives several pages; the default 30s is tight once a cold Next
  // route compiles on first hit.
  timeout: 90_000,
  /*
   * 30s, for the same reason `navigationTimeout` below is 60: the first hit on
   * a route compiles it. The assertion that most often straddles that compile
   * is the `toHaveURL` right after a click — the click starts a navigation
   * into a route no earlier test has touched, and at 10s that reported a
   * working `Request booking` as a broken one, twice, on the run where it
   * happened to go first. A real failure now takes 30s to report instead of
   * 10, which is cheap against a 90s per-test budget and much cheaper than a
   * red suite that points at the product.
   */
  expect: { timeout: 30_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  /*
   * No retry budget locally. `.claude/rules/testing.md`: "a flaky test is a
   * defect with a root cause, not a retry budget."
   *
   * One on CI, where the suite is a merge gate (VEN-411): a flake there would
   * otherwise block a correct pull request. The retry is **reported, never
   * silent** — the JSON report marks such a test `flaky`, and
   * `scripts/e2e-ci.mjs summary` names it in the job summary and as a warning,
   * so the second attempt is not the only one anyone sees.
   */
  retries: process.env.CI ? 1 : 0,
  // Serial by default: the suites share one lane database, and two journeys
  // mutating the same vendor's bookings interleave into failures that look like
  // product defects.
  workers: 1,
  reporter: process.env.CI
    ? [
        ['github'],
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'playwright-results.json' }],
      ]
    : [['list']],

  use: {
    baseURL,
    /*
     * Playwright's 30s navigation default is too tight for a cold dev server:
     * the first hit on a route compiles it, and a heavy route plus the auth provider exceeds
     * that with the server perfectly healthy. A `page.goto` timeout then reads
     * as a broken route, which is the most expensive kind of wrong answer — it
     * points the next person at the feature instead of at the compile.
     */
    navigationTimeout: 60_000,
    actionTimeout: 15_000,
    /*
     * Off on CI (VEN-411): a trace records the context's cookies and every
     * request's headers — the E2E accounts' live auth sessions — and CI uploads
     * the report from a public repository. Reproduce a CI failure on a lane.
     */
    trace: process.env.CI ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: [/.*\.responsive\.spec\.ts$/, STAGING_SPEC_IGNORE],
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
