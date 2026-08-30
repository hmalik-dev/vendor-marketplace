import { existsSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'dotenv';
import postgres from 'postgres';
import { type Check, type CheckResult, fail, pass } from '../types.js';

const CONNECT_TIMEOUT_SECONDS = 10;

export const E2E_ENV_FILE = '.env.e2e.local';

/**
 * One reusable account per role, so a Playwright pass can sign in as either
 * side of the marketplace without inventing a throwaway account per run. The
 * two sides see genuinely different surfaces — a vendor is redirected off `/`,
 * a customer is not — so one shared account cannot cover a ticket's flows.
 */
export const E2E_ACCOUNTS = [
  { role: 'customer', emailKey: 'E2E_CUSTOMER_EMAIL', passwordKey: 'E2E_CUSTOMER_PASSWORD' },
  { role: 'vendor', emailKey: 'E2E_VENDOR_EMAIL', passwordKey: 'E2E_VENDOR_PASSWORD' },
] as const;

export const E2E_KEYS = E2E_ACCOUNTS.flatMap((account) => [account.emailKey, account.passwordKey]);

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
  const name = 'End-to-end test accounts configured';
  const file = path.join(repoRoot, E2E_ENV_FILE);

  if (!existsSync(file)) {
    return fail(
      'e2e',
      name,
      `${E2E_ENV_FILE} is absent`,
      `Create ${E2E_ENV_FILE} with ${E2E_KEYS.join(', ')} — it is gitignored and must stay so`,
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

  const roles = E2E_ACCOUNTS.map((account) => account.role).join(' and ');

  return pass('e2e', name, `${E2E_ENV_FILE} supplies a ${roles} account`);
}

/**
 * Whether the end-to-end vendor account can actually reach a vendor surface.
 *
 * Configured credentials are not the same thing as a usable account, and the
 * gap between them is expensive: signing in creates a `users` row and nothing
 * else — `vendor_profiles` is only ever written by `POST /vendor/profile` — so
 * the vendor account lands on an empty profile form and **every** `/vendor`
 * route redirects there. A browser pass then reports the feature under test as
 * broken when the fixture is, which is exactly what happened twice on
 * 2026-08-30 before this check existed.
 *
 * It fails rather than warns, for the same reason `Demo data present` does: an
 * unattended run must stop here instead of spending an hour describing a
 * database that cannot answer the question.
 */
export async function evaluateE2eReach(
  repoRoot: string,
  connectionString: string | undefined,
): Promise<CheckResult> {
  const name = 'End-to-end accounts can reach their surfaces';

  if (!connectionString) {
    return fail('e2e', name, 'DATABASE_URL is not set', 'Set DATABASE_URL in .env');
  }

  const values = parse(readFileSync(path.join(repoRoot, E2E_ENV_FILE), 'utf8'));
  const vendorEmail = values.E2E_VENDOR_EMAIL;

  if (!vendorEmail) {
    return fail('e2e', name, `${E2E_ENV_FILE} has no E2E_VENDOR_EMAIL`, 'pnpm db:seed:e2e');
  }

  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    onnotice: () => {},
  });

  try {
    const [row] = await sql<{ role: string | null; profiles: number }[]>`
      select
        u.role::text as role,
        count(v.id)::int as profiles
      from users u
      left join vendor_profiles v on v.user_id = u.id and v.is_deleted = false
      where u.email = ${vendorEmail} and u.deleted_at is null
      group by u.role
    `;

    if (!row) {
      return fail(
        'e2e',
        name,
        'the vendor account has no user row — it has never signed in, and nothing has seeded it',
        'pnpm db:seed:e2e',
      );
    }

    if (row.role !== 'vendor') {
      return fail(
        'e2e',
        name,
        `the vendor account holds the "${row.role ?? 'unknown'}" role, so every vendor guard refuses it`,
        'pnpm db:seed:e2e',
      );
    }

    if (row.profiles === 0) {
      return fail(
        'e2e',
        name,
        'the vendor account owns no storefront, so every /vendor route redirects to profile creation',
        'pnpm db:seed:e2e',
      );
    }

    return pass('e2e', name, 'the vendor account owns a storefront and holds the vendor role');
  } catch (error: unknown) {
    return fail(
      'e2e',
      name,
      error instanceof Error ? error.message : 'the database is unreadable',
      'pnpm db:migrate && pnpm db:seed && pnpm db:seed:e2e',
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
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

    const credentials = evaluateE2eCredentials(context.repoRoot);
    const results = [evaluateBrowsers(context.env), credentials];

    // Nothing to reach the surfaces *with* until the accounts are configured,
    // so a second failure here would only repeat the first.
    if (!credentials.ok) {
      return results;
    }

    results.push(await evaluateE2eReach(context.repoRoot, context.env.DATABASE_URL));

    return results;
  },
};
