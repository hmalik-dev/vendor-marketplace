import { existsSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'dotenv';
import { type Check, type CheckResult, fail, pass } from '../types.js';

export const E2E_ENV_FILE = '.env.e2e.local';
export const E2E_KEYS = ['E2E_TEST_EMAIL', 'E2E_TEST_PASSWORD'] as const;

/** Where Playwright caches its browser builds, per platform. */
export function browsersPath(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.PLAYWRIGHT_BROWSERS_PATH;

  if (override && override !== '0') {
    return override;
  }

  const home = os.homedir();

  switch (process.platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Caches', 'ms-playwright');
    case 'win32':
      return path.join(env.LOCALAPPDATA ?? home, 'ms-playwright');
    default:
      return path.join(home, '.cache', 'ms-playwright');
  }
}

export function evaluateBrowsers(env: NodeJS.ProcessEnv): CheckResult {
  const name = 'Playwright browsers installed';
  const cache = browsersPath(env);

  const installed = existsSync(cache)
    ? readdirSync(cache).filter((entry) => entry.startsWith('chromium-'))
    : [];

  if (installed.length === 0) {
    return fail('e2e', name, `no chromium build under ${cache}`, 'npx playwright install chromium');
  }

  return pass('e2e', name, installed.sort().join(', '));
}

export function evaluateE2eCredentials(repoRoot: string): CheckResult {
  const name = 'End-to-end test account configured';
  const file = path.join(repoRoot, E2E_ENV_FILE);

  if (!existsSync(file)) {
    return fail(
      'e2e',
      name,
      `${E2E_ENV_FILE} is absent`,
      `Create ${E2E_ENV_FILE} with ${E2E_KEYS.join(' and ')} — it is gitignored and must stay so`,
    );
  }

  const values = parse(readFileSync(file, 'utf8'));
  const missing = E2E_KEYS.filter((key) => !values[key]);

  if (missing.length > 0) {
    return fail(
      'e2e',
      name,
      `${E2E_ENV_FILE} is missing ${missing.join(', ')}`,
      `Set ${missing.join(' and ')} in ${E2E_ENV_FILE}`,
    );
  }

  return pass('e2e', name, `${E2E_ENV_FILE} supplies ${E2E_KEYS.join(' and ')}`);
}

export const browserCheck: Check = {
  id: 9,
  title: 'Browser verification',
  async run(context) {
    // Browser verification is a local gate; a production value set has no
    // Playwright cache and no test account to check.
    if (context.target === 'production' || !context.capabilities.has('e2e')) {
      return [];
    }

    return [evaluateBrowsers(context.env), evaluateE2eCredentials(context.repoRoot)];
  },
};
