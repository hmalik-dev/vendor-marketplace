import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { expect, type Page } from '@playwright/test';

import { AUTH_DIR } from './fixtures.js';

/**
 * A Clerk identity with **no `users` row** — the state a person is in between
 * verifying a brand-new account and ticking the Terms box (VEN-379).
 *
 * No fixture represents it, because the acceptance gate is the only writer of
 * the row and every seeded account has been through it. It is minted here
 * through Clerk's Backend API rather than by driving `/sign-up`: the sign-up
 * card waits on a Cloudflare challenge that a headless browser does not pass,
 * and the state under test is the identity-without-a-row, not the form. The
 * identity is signed in through `/sign-in` exactly as a person signs in, and
 * deleted afterwards so nothing accumulates in the development instance.
 */
const CLERK_API = 'https://api.clerk.com/v1';

/** Clerk's documented test mode: `+clerk_test` addresses always take this code. */
const CLERK_TEST_CODE = '424242';

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

  return value;
}

async function clerk(path: string, init: { method: string; body?: unknown }): Promise<Response> {
  return fetch(`${CLERK_API}${path}`, {
    method: init.method,
    headers: { authorization: `Bearer ${clerkSecretKey()}`, 'content-type': 'application/json' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

export interface NoRowAccount {
  clerkUserId: string;
  email: string;
  secret: string;
}

export async function mintNoRowAccount(): Promise<NoRowAccount> {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `ven379-no-row-${stamp}+clerk_test@example.com`;
  const secret = `No-Row-${stamp}-Qx!`;

  const response = await clerk('/users', {
    method: 'POST',
    body: {
      email_address: [email],
      password: secret,
      skip_password_checks: true,
      // What the sign-up form sends; the gate narrows it when it writes the row.
      unsafe_metadata: { role: 'customer' },
    },
  });

  if (!response.ok) {
    throw new Error(`Clerk refused to mint the no-row identity: HTTP ${response.status}`);
  }

  const { id } = (await response.json()) as { id: string };

  return { clerkUserId: id, email, secret };
}

export async function deleteNoRowAccount(account: NoRowAccount): Promise<void> {
  const response = await clerk(`/users/${account.clerkUserId}`, { method: 'DELETE' });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Clerk refused to delete ${account.clerkUserId}: HTTP ${response.status}`);
  }
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

  const leftSignIn = (url: URL): boolean =>
    !url.pathname.startsWith('/sign-in') || url.pathname.includes('client-trust');
  await page.waitForURL(leftSignIn);

  // Clerk challenges every new browser; the OTP is segmented and submits itself.
  if (page.url().includes('client-trust')) {
    const code = page.getByLabel(/verification code/i).first();
    await code.click();
    await code.pressSequentially(CLERK_TEST_CODE, { delay: 80 });
  }

  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'));
  await expect(page.locator('#main')).toBeVisible();

  return new URL(page.url());
}
