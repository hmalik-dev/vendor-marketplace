import { existsSync } from 'node:fs';

import { expect, expectSignedIn, storageStatePath, test } from './fixtures';
import { waitForHydration } from './hydration';
import { completeStepUp } from './step-up';

/**
 * VEN-382: a closed account stays reachable from `/admin/customers`.
 *
 * Driven through the real closure — the data-rights page's `Close account` —
 * never a row hand-set with `deleted_at`. It closes a **marketing seed**
 * customer (`@orla-demo.example`, `seed_mkt_…`): those rows have no auth
 * identity to destroy, whereas closing a seeded E2E account would delete a
 * real sign-in the seed cannot rebuild. The closure is permanent in the lane
 * database, so the spec picks whichever seed customer is still closable.
 */
const ADMIN_STATE = storageStatePath('admin');
const SEED_CUSTOMER_DOMAIN = '@orla-demo.example';

test('an operator closes an account, then reaches its data-rights page from the customers screen', async ({
  browser,
}) => {
  if (!existsSync(ADMIN_STATE)) {
    throw new Error(
      `Missing ${ADMIN_STATE}. Regenerate it inside this lane:\n` +
        `  pnpm lane:exec <ticket> -- pnpm e2e:auth admin`,
    );
  }

  const context = await browser.newContext({ storageState: ADMIN_STATE });
  const page = await context.newPage();

  await page.goto(`/admin/customers?q=${encodeURIComponent(SEED_CUSTOMER_DOMAIN)}`);
  await expectSignedIn(page);
  await expect(page).toHaveURL(/\/admin\/customers/);

  // Every row renders twice (grid + card list); dedupe by href.
  const links = page.locator('a[href^="/admin/customers/"]');
  await expect(
    links.first(),
    'no marketing seed customers — run `pnpm lane:exec <ticket> -- pnpm db:seed:marketing`',
  ).toBeVisible();
  const candidates = [
    ...new Map(
      await links.evaluateAll((anchors) =>
        anchors.map((anchor) => [anchor.getAttribute('href') ?? '', anchor.textContent ?? '']),
      ),
    ),
  ];

  let target: { href: string; name: string } | undefined;
  const closeButton = page.getByRole('button', { name: 'Close account' });

  // A row opens the customer's record; closure lives on its data-rights page (VEN-400).
  const rightsOf = (customerHref: string): string => customerHref.replace('/customers/', '/users/');

  for (const [href, name] of candidates) {
    await page.goto(rightsOf(href));
    await expect(page).toHaveURL(rightsOf(href));
    await expect(closeButton).toBeVisible();

    if (await closeButton.isEnabled()) {
      target = { href, name: name.trim() };
      break;
    }
  }

  expect(target, 'no closable marketing seed customer is left in this lane database').toBeDefined();
  const { href, name } = target!;
  // `q` matches first name, last name and email separately, never the full name.
  const search = `/admin/customers?q=${encodeURIComponent(name.split(' ').at(-1) ?? name)}`;
  const targetLink = page.locator(`a[href="${href}"]`);

  // Proves the search finds the account while it is live, so its absence below can fail.
  await page.goto(search);
  await expect(targetLink.first()).toBeVisible();

  await page.goto(rightsOf(href));
  await waitForHydration(page, 'button');
  await closeButton.click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: 'Close account' }).click();
  await completeStepUp(page, dialog);
  await expect(page.getByText(/^Closed \d{4}-\d{2}-\d{2}$/)).toBeVisible();

  // The default view is live accounts only, so the closed row is gone from it.
  await page.goto(search);
  await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  await expect(targetLink).toHaveCount(0);

  // Asked for deliberately, through the Status filter.
  await page.getByRole('button', { name: 'Status' }).click();
  await page.getByRole('option', { name: 'Closed' }).click();
  await expect(page).toHaveURL(/[?&]status=closed(&|$)/);

  const row = targetLink.first();
  await expect(row).toBeVisible();
  await expect(
    page.locator('[data-slot="status-pill"]', { hasText: 'Closed' }).first(),
  ).toBeVisible();

  // Follows the row's own href by navigation: a soft click-through does not repaint in a lane's production build (VEN-553).
  await expect(row).toHaveAttribute('href', href);
  await page.goto(href);
  const rightsLink = page.getByRole('link', { name: 'Data rights · export and closure' });
  await expect(rightsLink).toHaveAttribute('href', rightsOf(href));
  await page.goto(rightsOf(href));
  await expect(page.getByText(/^Closed \d{4}-\d{2}-\d{2}$/)).toBeVisible();

  await context.close();
});
