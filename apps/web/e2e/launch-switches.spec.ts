import { test as base, type Browser, type Page } from '@playwright/test';

import {
  TEST_CARDS,
  acceptedRequest,
  fillCard,
  payButton,
  uniqueVenue,
} from './booking-journey.js';
import {
  expect,
  expectSignedIn,
  freshEventDate,
  storageStatePath,
  test as roles,
} from './fixtures.js';
import { formatWholeDollars } from './fixtures-data.js';
import { waitForHydration } from './hydration.js';

/**
 * The checkout launch switch (VEN-404), acceptance 7: an operator pauses
 * checkout from `/admin/settings`, a customer's pay control lands on the paused
 * notice instead of a card form, and once the switch is off again the same
 * booking pays.
 *
 * Runs against the lane's real stack and Stripe test mode. The confirmed screen
 * reconciles with Stripe directly, so this does not need `stripe listen`.
 */

const JOURNEY_TIMEOUT_MS = 180_000;
const SETTINGS = '/admin/settings';
const PAUSED_NOTICE = 'Bookings are paused for a short while. Nothing has been charged.';

/** The admin pages are built here, as `admin-filters.spec.ts` does, not in `fixtures.ts`. */
async function adminContextPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: storageStatePath('admin') });
  const page = await context.newPage();
  await page.goto('/admin');
  await expectSignedIn(page);

  return page;
}

const test = roles.extend<{ adminPage: Page }>({
  // `provide` is Playwright's `use`, renamed — same reason as `fixtures.ts`.
  adminPage: async ({ browser }, provide) => {
    const page = await adminContextPage(browser);
    await provide(page);
    await setCheckoutPaused(page, false);
    await page.context().close();
  },
});

/** Sets the `Pause checkout` switch through the screen, and waits for the saved state. */
async function setCheckoutPaused(adminPage: Page, paused: boolean): Promise<void> {
  await adminPage.goto(SETTINGS);
  await waitForHydration(adminPage, 'button[role="switch"]');
  const toggle = adminPage.getByRole('switch', { name: 'Pause checkout' });
  const wanted = String(paused);

  if ((await toggle.getAttribute('aria-checked')) !== wanted) {
    await toggle.click();
  }

  await expect(toggle).toHaveAttribute('aria-checked', wanted);
}

test.describe.configure({ timeout: JOURNEY_TIMEOUT_MS });

test.describe('checkout launch switch', () => {
  test('a paused checkout shows the notice, and pays once the operator lifts it', async ({
    adminPage,
    customerPage,
    vendorPage,
  }) => {
    const request = await acceptedRequest(customerPage, vendorPage, {
      eventDate: await freshEventDate(),
      venue: uniqueVenue('launch-switch'),
    });
    const priceLabel = formatWholeDollars(request.finalPriceCents);

    await setCheckoutPaused(adminPage, true);
    await expect(adminPage.getByText(/^Last changed by /)).toBeVisible();

    // The pay control, where a customer actually starts checkout.
    await customerPage.goto(`/bookings/${request.id}`);
    await waitForHydration(customerPage, 'a[href$="/checkout"]');
    await customerPage.getByRole('link', { name: `Pay ${priceLabel}` }).click();

    await expect(customerPage).toHaveURL(new RegExp(`/bookings/${request.id}/checkout$`));
    await expect(
      customerPage.getByRole('heading', { level: 1, name: 'Payments are paused for a moment' }),
    ).toBeVisible();
    await expect(customerPage.getByText(PAUSED_NOTICE, { exact: true })).toBeVisible();
    await expect(customerPage.locator('iframe[title="Secure payment input frame"]')).toHaveCount(0);

    await setCheckoutPaused(adminPage, false);

    await customerPage.getByRole('link', { name: 'Try this payment again' }).click();
    await expect(
      customerPage
        .frameLocator('iframe[title="Secure payment input frame"]')
        .first()
        .locator('input[name="number"]'),
      'the Payment Element never mounted once checkout was unpaused',
    ).toBeVisible();

    await fillCard(customerPage, TEST_CARDS.succeeds);
    await payButton(customerPage, priceLabel).click();

    await expect(customerPage).toHaveURL(new RegExp(`/bookings/${request.id}/confirmed$`), {
      timeout: 60_000,
    });
    await expect(
      customerPage.getByRole('heading', { level: 1, name: / is yours\.$/ }),
    ).toBeVisible();
  });
});
