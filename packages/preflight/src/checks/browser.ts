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

/** Stripe's own account-id shape: `acct_` followed by base62. */
const STRIPE_ACCOUNT_ID_PATTERN = /^acct_[A-Za-z0-9]+$/;

/** Stripe's v1 account read, which needs no API-version header. */
const STRIPE_ACCOUNTS_API = 'https://api.stripe.com/v1/accounts';

/** How long to wait on Stripe before deciding the gate cannot answer. */
const STRIPE_TIMEOUT_MS = 8000;

export type PayoutRoute =
  /** `summary` is appended to the pass message, so the gate says what it checked. */
  { ok: true; summary: string } | { ok: false; reason: string };

/**
 * Whether the fixture vendor can really be paid — asked of Stripe, not of the
 * column.
 *
 * This check used to report *"a published storefront with a package, a live
 * request and payouts"* on `stripe_onboarded` alone, and the seed set that flag
 * beside `acct_e2e_fixture_not_a_real_account`. So the gate certified the one
 * capability that did not work, on every run, while `POST .../checkout` answered
 * 400 and the customer was shown a 404 (#387). A column is a claim; Stripe
 * accepting the account is the evidence.
 */
export async function describePayoutRoute(
  accountId: string | null,
  secretKey: string,
): Promise<PayoutRoute> {
  if (accountId === null || !STRIPE_ACCOUNT_ID_PATTERN.test(accountId)) {
    return {
      ok: false,
      reason:
        accountId === null
          ? 'the vendor account is marked payout-ready with no connected account id'
          : `the vendor account carries "${accountId}", which is not an id Stripe can resolve`,
    };
  }

  let response: Response;

  try {
    response = await fetch(`${STRIPE_ACCOUNTS_API}/${accountId}`, {
      headers: { authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: 'Stripe could not be reached to verify payouts' };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: `Stripe does not recognise ${accountId} (${response.status}) — checkout will answer 400`,
    };
  }

  const account = (await response.json()) as { capabilities?: { transfers?: string } };

  /*
   * `transfers` is the exact capability `transfer_data.destination` requires,
   * which is why it is the one asserted rather than `charges_enabled`.
   */
  if (account.capabilities?.transfers !== 'active') {
    return {
      ok: false,
      reason: `Stripe has not activated transfers on ${accountId}, so checkout cannot open`,
    };
  }

  return { ok: true, summary: `payouts Stripe accepts through ${accountId}` };
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
 * It checks the whole fixture, not merely that a profile exists. A stale
 * storefront left behind by an earlier pass satisfies "owns a profile" while
 * having no package, no request to act on and no payouts — so the run drives
 * the surfaces and still cannot complete a single flow it was sent to verify.
 *
 * It fails rather than warns, for the same reason `Demo data present` does: an
 * unattended run must stop here instead of spending an hour describing a
 * database that cannot answer the question.
 */
export async function evaluateE2eReach(
  repoRoot: string,
  connectionString: string | undefined,
  /**
   * The Stripe key the payout route is verified with, or `undefined` to check
   * the columns alone.
   *
   * Only supplied for a ticket that declares the `stripe` capability, because
   * every other ticket's `STRIPE_SECRET_KEY` may legitimately be a placeholder
   * and a network call on it would fail the gate for work that never touches
   * payment.
   */
  stripeSecretKey?: string,
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
    /*
     * Matched case-insensitively, because the fixture writes Clerk's canonical
     * address while `.env.e2e.local` holds whatever a human typed.
     */
    const [row] = await sql<
      {
        role: string | null;
        profile_id: string | null;
        payouts_ready: boolean | null;
        stripe_account_id: string | null;
        packages: number;
        live_requests: number;
      }[]
    >`
      select
        u.role::text as role,
        v.id::text as profile_id,
        v.stripe_onboarded as payouts_ready,
        v.stripe_account_id,
        (select count(*) from service_packages p where p.vendor_id = v.id)::int as packages,
        (
          select count(*) from booking_requests r
          where r.vendor_id = v.id and r.status in ('pending', 'quoted')
        )::int as live_requests
      from users u
      left join vendor_profiles v on v.user_id = u.id and v.is_deleted = false
      where lower(u.email) = lower(${vendorEmail}) and u.deleted_at is null
      limit 1
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

    if (!row.profile_id) {
      return fail(
        'e2e',
        name,
        'the vendor account owns no storefront, so every /vendor route redirects to profile creation',
        'pnpm db:seed:e2e',
      );
    }

    /*
     * Beyond "can it load a page". A storefront with no package and no live
     * request renders the dashboard's empty state, and an un-onboarded vendor
     * meets a 402 on accept — so a pass would drive the surfaces and still be
     * unable to complete the flows it was sent to verify. That is the state
     * this check exists to refuse, and the one a bare profile test lets through.
     */
    const missing: string[] = [];
    if (row.packages === 0) {
      missing.push('no bookable package');
    }
    if (row.live_requests === 0) {
      missing.push('no live booking request to act on');
    }
    if (!row.payouts_ready) {
      missing.push('payouts not connected, so accept answers 402');
    }

    if (missing.length > 0) {
      return fail('e2e', name, `the vendor account has ${missing.join(', ')}`, 'pnpm db:seed:e2e');
    }

    /*
     * Asked of Stripe only for a ticket that declares the capability.
     * `env-registry.md` promises that a ticket which never touches Stripe is
     * never blocked on Stripe, and that has to hold for the *fixture's* Stripe
     * state as much as for the keys: #388, #389 and #390 declare no
     * capabilities, and failing their gate on the payout route would strand
     * three lanes on a column none of them reads.
     */
    if (stripeSecretKey === undefined) {
      return pass(
        'e2e',
        name,
        'the vendor account owns a published storefront with a package, a live request and ' +
          'payouts (columns only — this ticket declares no stripe capability)',
      );
    }

    const payouts = await describePayoutRoute(row.stripe_account_id, stripeSecretKey);

    if (!payouts.ok) {
      return fail('e2e', name, payouts.reason, 'pnpm db:seed:e2e');
    }

    return pass(
      'e2e',
      name,
      'the vendor account owns a published storefront with a package, a live request and ' +
        payouts.summary,
    );
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

    results.push(
      await evaluateE2eReach(
        context.repoRoot,
        context.env.DATABASE_URL,
        context.capabilities.has('stripe') ? context.env.STRIPE_SECRET_KEY : undefined,
      ),
    );

    return results;
  },
};
