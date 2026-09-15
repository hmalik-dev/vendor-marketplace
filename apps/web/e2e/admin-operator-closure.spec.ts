import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { promisify } from 'node:util';

import { resolveE2EBaseUrl } from './base-url';
import { AUTH_DIR, expect, expectSignedIn, storageStatePath, test } from './fixtures';
import { assertLoopbackOrigin, clerk } from './no-row-account';

/**
 * VEN-391: an operator closes **another operator's** account, past a typed
 * confirmation on the target's address.
 *
 * The target is a disposable operator minted by this spec — a `+clerk_test`
 * identity created through Clerk's Backend API and given an operator row by
 * `e2e:operator` — never the persistent E2E admin, whose identity the seed
 * resolves and cannot rebuild. The persistent admin is the **actor**; the two of
 * them are the two live operators that let the closure through. Whatever
 * happens, the identity and the row are removed afterwards.
 */
const ADMIN_STATE = storageStatePath('admin');
const run = promisify(execFile);

async function e2eOperator(command: 'mint' | 'remove', clerkUserId: string, email: string) {
  const { stdout } = await run(
    'pnpm',
    ['--silent', '--filter', '@vendor-marketplace/db', 'e2e:operator', command, clerkUserId, email],
    { cwd: dirname(AUTH_DIR) },
  );

  return JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as { userId?: string };
}

test('an operator closes another operator only after typing their address exactly', async ({
  browser,
}) => {
  if (!existsSync(ADMIN_STATE)) {
    throw new Error(
      `Missing ${ADMIN_STATE}. Regenerate it inside this lane:\n` +
        `  pnpm lane:exec <ticket> -- pnpm e2e:auth admin`,
    );
  }

  assertLoopbackOrigin(resolveE2EBaseUrl());

  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `e2e-operator-${stamp}+clerk_test@example.com`;
  const minted = await clerk('/users', {
    method: 'POST',
    body: {
      email_address: [email],
      password: `Operator-${stamp}-Qx!`,
      skip_password_checks: true,
    },
  });
  expect(minted.ok, `Clerk refused to mint the disposable operator: ${minted.status}`).toBe(true);
  const { id: clerkUserId } = (await minted.json()) as { id: string };
  const context = await browser.newContext({ storageState: ADMIN_STATE });

  try {
    const { userId } = await e2eOperator('mint', clerkUserId, email);
    const page = await context.newPage();

    await page.goto(`/admin/users/${userId}`);
    await expectSignedIn(page);

    await page.getByRole('button', { name: 'Close account' }).click();
    const dialog = page.getByRole('alertdialog');
    const confirm = dialog.getByRole('button', { name: 'Close account' });
    const typed = dialog.getByLabel(`Type ${email} to confirm`);

    await expect(dialog.getByRole('heading')).toHaveText(
      "Close Disposable Operator's operator account?",
    );
    await expect(dialog).toContainText(
      "Only someone with access to Clerk's dashboard can give them a sign-in again",
    );
    await expect(confirm).toBeDisabled();

    // A near miss: one letter's case. It stays disabled and says why.
    await typed.fill(email.replace('e2e', 'E2E'));
    await expect(confirm).toBeDisabled();
    await expect(dialog).toContainText(`Doesn't match ${email} exactly.`);

    await typed.fill(email);
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByText(/^Closed \d{4}-\d{2}-\d{2}$/)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    // The closure deleted the sign-in itself, not just the row.
    expect((await clerk(`/users/${clerkUserId}`, { method: 'GET' })).status).toBe(404);
  } finally {
    await context.close();
    // The row first, so a Clerk failure below cannot leave it behind.
    await e2eOperator('remove', clerkUserId, email);
    const deleted = await clerk(`/users/${clerkUserId}`, { method: 'DELETE' });
    expect([200, 404]).toContain(deleted.status);
  }
});
