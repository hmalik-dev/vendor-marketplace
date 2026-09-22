import { defineConfig, devices } from '@playwright/test';
import { assertStagingEnvironment } from './e2e/staging-guard.js';

/**
 * The staging-only entry point for `staging-messages-rls.staging.spec.ts`
 * (VEN-562).
 *
 * A separate config, not a project inside `playwright.config.ts`, because that
 * file's `baseURL` is resolved by `resolveE2EBaseUrl()` at import time — the
 * lane's origin — and this one is aimed at a live deployment instead. Loading
 * this config at all is refused unless the environment names staging
 * (`assertStagingEnvironment`), so `pnpm --filter @vendor-marketplace/web
 * test:e2e:staging` fails the same way with no arguments as it would mid-run.
 *
 * Run:
 *   STAGING_WEB_URL=https://<staging-web-host> \
 *   DEPLOY_ENV=local \
 *   pnpm --filter @vendor-marketplace/web test:e2e:staging
 */
const baseURL = assertStagingEnvironment();

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.staging\.spec\.ts$/,
  // The main test onboards four real accounts serially, each waiting on a
  // real Mailosaur delivery (bounded at ~90s per address) before the browser
  // work even starts — 3 minutes is not enough headroom for that.
  timeout: 600_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Never retried: a flake against real accounts on a live deployment hides a
  // real defect behind a second attempt, and CI never loads this config.
  retries: 0,
  workers: 1,
  reporter: [['list']],

  use: {
    baseURL,
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'staging-desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
