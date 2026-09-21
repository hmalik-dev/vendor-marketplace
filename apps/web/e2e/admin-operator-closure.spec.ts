import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { promisify } from 'node:util';

import { AUTH_DIR, expect, expectSignedIn, storageStatePath, test } from './fixtures';
import { completeStepUp } from './step-up';

/**
 * VEN-391: an operator closes **another operator's** account, past a typed
 * confirmation on the target's address.
 *
 * The target is a disposable operator row minted by this spec through
 * `e2e:operator` — never the persistent E2E admin, whose identity the seed
 * resolves and cannot rebuild. The persistent admin is the **actor**; the two of
 * them are the two live operators that let the closure through.
 *
 * The row carries a `seed_e2e_…` id rather than a Neon Auth identity, on
 * purpose: a Neon Auth identity cannot be minted without an inbox (sign-in
 * refuses an unverified address), and this spec must not spend one of the
 * persistent accounts. A closure owes a seeded id nothing at the identity
 * provider, so the console and the unwind are exercised in full; the identity
 * deletion itself is asserted in `data-rights.routes.test.ts`. Whatever
 * happens, the row is removed afterwards.
 */
const ADMIN_STATE = storageStatePath('admin');
const run = promisify(execFile);

async function e2eOperator(command: 'mint' | 'remove', authUserId: string, email: string) {
  const { stdout } = await run(
    'pnpm',
    ['--silent', '--filter', '@vendor-marketplace/db', 'e2e:operator', command, authUserId, email],
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

  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `e2e-operator-${stamp}@example.com`;
  const authUserId = `seed_e2e_operator_${stamp}`;
  const context = await browser.newContext({ storageState: ADMIN_STATE });

  try {
    const { userId } = await e2eOperator('mint', authUserId, email);
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
      'Only someone with access to the Neon Auth console can give them a sign-in again',
    );
    await expect(confirm).toBeDisabled();

    // A near miss: one letter's case. It stays disabled and says why.
    await typed.fill(email.replace('e2e', 'E2E'));
    await expect(confirm).toBeDisabled();
    await expect(dialog).toContainText(`Doesn't match ${email} exactly.`);

    await typed.fill(email);
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await completeStepUp(page, dialog);

    await expect(page.getByText(/^Closed \d{4}-\d{2}-\d{2}$/)).toBeVisible();
    // Not `getByRole('alert')`: Next's route announcer carries that role on every page.
    await expect(page.getByText(/This needs a person/)).toHaveCount(0);
  } finally {
    await context.close();
    await e2eOperator('remove', authUserId, email);
  }
});
