import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { expect, type Page } from '@playwright/test';

import {
  API_VERSION_PREFIX,
  type SignUpRole,
  WEB_TIER_KEY_HEADER,
} from '@vendor-marketplace/shared';

import { resolveE2EApiUrl } from './base-url.js';
import { AUTH_DIR } from './fixtures.js';
import { waitForHydration } from './hydration.js';

/**
 * An identity with **no `users` row** — the state a person is in between
 * verifying a brand-new account and ticking the Terms box (VEN-379).
 *
 * No fixture represents it, because the acceptance gate is the only writer of
 * the row and every seeded account has been through it. On Neon Auth (VEN-447)
 * it is a **persistent** third account, `E2E_NEWCOMER_EMAIL` /
 * `E2E_NEWCOMER_PASSWORD` in the gitignored `.env.e2e.local`, that nothing ever
 * accepts the Terms for: minting one per run would need an inbox, because sign-in
 * refuses an unverified address, and deleting it afterwards would be the run
 * destroying the fixture the next one needs. The suites only *look* at what it
 * is shown; the moment anything ticks the box the state is gone and the account
 * has to be replaced — `noRowStillHasNoRow` says so before it is used.
 *
 */

const REPO_ROOT = dirname(AUTH_DIR);

/**
 * The same refusal `scripts/e2e-roles.mjs` makes: the deployed site shares this
 * Neon Auth branch, so aiming `E2E_BASE_URL` at it must not be enough
 * to create an account there. Exact hostnames, never a substring test.
 */
export function assertLoopbackOrigin(baseUrl: string): void {
  const { hostname } = new URL(baseUrl);

  if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)) {
    throw new Error(
      `The no-row persona signs in as a real identity, so it runs against loopback only — not ${hostname}.`,
    );
  }
}

export interface NoRowAccount {
  email: string;
  secret: string;
}

/** The persistent newcomer account, from the gitignored `.env.e2e.local`. */
export async function mintNoRowAccount(): Promise<NoRowAccount> {
  const file = resolve(REPO_ROOT, '.env.e2e.local');
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const read = (key: string): string | undefined =>
    text
      .match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]
      ?.trim()
      .replace(/^["']|["']$/g, '');
  const email = process.env.E2E_NEWCOMER_EMAIL ?? read('E2E_NEWCOMER_EMAIL');
  const secret = process.env.E2E_NEWCOMER_PASSWORD ?? read('E2E_NEWCOMER_PASSWORD');

  if (!email || !secret) {
    throw new Error(
      'E2E_NEWCOMER_EMAIL and E2E_NEWCOMER_PASSWORD are not in .env.e2e.local — the no-row persona needs them.',
    );
  }

  return { email, secret };
}

/** Nothing to remove: the persona is persistent by design. See the header. */
export async function deleteNoRowAccount(account: NoRowAccount): Promise<void> {
  void account;
}

/**
 * Signs in through the real `/sign-in` screen and returns where the product
 * put the session — which is the first assertion the no-row persona makes.
 */
export async function signInThroughTheForm(page: Page, account: NoRowAccount): Promise<URL> {
  await page.goto('/sign-in');
  /*
   * A value filled before React owns the field lands in the DOM but not in the
   * form's state, so the submit stays disabled and the click never navigates
   * anywhere (VEN-570 found it in `e2e-auth.mjs`; this is the same form).
   */
  await waitForHydration(page, 'input[type="password"]');
  // One step on Neon Auth: the submit stays disabled until both fields are filled.
  await page.getByLabel(/email/i).first().fill(account.email);
  await page
    .getByLabel(/password/i)
    .first()
    .fill(account.secret);
  await page
    .getByRole('button', { name: /continue|sign in/i })
    .first()
    .click();

  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'));
  await expect(page.locator('#main')).toBeVisible();

  return new URL(page.url());
}

/**
 * Records the role this signed-in persona "chose at sign-up", the way the auth
 * proxy does for a real sign-up (VEN-662). The persona was created once and
 * never passes through `/sign-up`, so without this `/accept-terms` has no role
 * to state. Keyed by the session's own id, read from the proxy; first write
 * wins, so a lane that already holds a record keeps it.
 */
export async function recordSignUpRoleFor(page: Page, role: SignUpRole): Promise<void> {
  const key = process.env.WEB_TIER_KEY;

  if (!key) {
    throw new Error('WEB_TIER_KEY is not set — run this spec through `pnpm lane:exec`.');
  }

  const session = (await (await page.request.get('/api/auth/get-session')).json()) as {
    user?: { id?: string };
  } | null;
  const authUserId = session?.user?.id;

  if (!authUserId) {
    throw new Error('The signed-in persona has no session id to record a role against.');
  }

  const recorded = await page.request.post(
    `${resolveE2EApiUrl()}${API_VERSION_PREFIX}/internal/sign-up-role`,
    { headers: { [WEB_TIER_KEY_HEADER]: key }, data: { authUserId, role } },
  );

  expect(recorded.status(), 'the sign-up role was not recorded').toBe(200);
}
