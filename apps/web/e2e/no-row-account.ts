import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { expect, type Page } from '@playwright/test';

import { AUTH_DIR } from './fixtures.js';

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
 * The Clerk helpers below serve the operator-closure spec only, and go with it
 * when VEN-448 moves the operator surface.
 */
const CLERK_API = 'https://api.clerk.com/v1';

const REPO_ROOT = dirname(AUTH_DIR);

/**
 * The secret, from the environment or the repository's gitignored `.env` —
 * the file `seed:e2e` reads it from — and never from this file.
 */
function clerkSecretKey(): string {
  const name = 'CLERK_SECRET_KEY';
  const fromEnvironment = process.env[name];

  if (fromEnvironment) {
    return fromEnvironment;
  }

  const envFile = resolve(REPO_ROOT, '.env');
  const line = existsSync(envFile)
    ? readFileSync(envFile, 'utf8')
        .split('\n')
        .find((candidate) => candidate.startsWith(`${name}=`))
    : undefined;
  const value = line
    ?.slice(name.length + 1)
    .trim()
    .replace(/^["']|["']$/g, '');

  if (!value) {
    throw new Error(
      `${name} is not set and ${envFile} does not define it — the no-row persona needs it.`,
    );
  }

  // Never mint or delete people in a live instance, whatever an env file holds.
  if (!value.startsWith('sk_test_')) {
    throw new Error(`${name} is not a development-instance key; the no-row persona refuses it.`);
  }

  return value;
}

/**
 * The same refusal `scripts/e2e-roles.mjs` makes: the deployed site shares this
 * Clerk development instance, so aiming `E2E_BASE_URL` at it must not be enough
 * to create an account there. Exact hostnames, never a substring test.
 */
export function assertLoopbackOrigin(baseUrl: string): void {
  const { hostname } = new URL(baseUrl);

  if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)) {
    throw new Error(
      `The no-row persona mints a Clerk identity, so it runs against loopback only — not ${hostname}.`,
    );
  }
}

export async function clerk(
  path: string,
  init: { method: string; body?: unknown },
): Promise<Response> {
  return fetch(`${CLERK_API}${path}`, {
    method: init.method,
    headers: { authorization: `Bearer ${clerkSecretKey()}`, 'content-type': 'application/json' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
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
  await page.getByLabel(/email/i).first().fill(account.email);
  await page
    .getByRole('button', { name: /continue|sign in/i })
    .first()
    .click();
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
