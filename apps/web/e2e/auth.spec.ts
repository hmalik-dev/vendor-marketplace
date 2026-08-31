import { expect, test } from './fixtures.js';

/**
 * Route protection, in both directions.
 *
 * The direction usually skipped is the one that matters: a hidden nav link is
 * not denial. Every assertion below drives the **direct URL**, because that is
 * what an attacker and a stale bookmark both do.
 *
 * Sign-up is deliberately absent. #340 lists it, but the same ticket requires
 * that sign-in use the stored `.auth/` state and never a typed password, and a
 * sign-up journey cannot honour that — it would also mint real users in the
 * shared Clerk development instance on every run. Recorded rather than dropped:
 * see the ticket's notes.
 */

const CUSTOMER_ONLY = ['/bookings', '/customer/profile'];
const VENDOR_ONLY = ['/vendor/dashboard', '/vendor/bookings', '/vendor/packages'];

test.describe('route protection', () => {
  for (const path of [...CUSTOMER_ONLY, ...VENDOR_ONLY]) {
    test(`sends a signed-out visitor from ${path} to sign-in`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/sign-in/);
    });
  }

  test('lets a signed-in customer reach their bookings', async ({ customerPage }) => {
    // The fixture already proved the session and landed on /bookings.
    await expect(customerPage).toHaveURL(/\/bookings/);
  });

  test('lets a signed-in vendor reach their dashboard', async ({ vendorPage }) => {
    await expect(vendorPage).toHaveURL(/\/vendor\/dashboard/);
  });

  /*
   * The cross-role direction. A customer holding a valid session must still be
   * refused a vendor surface — this is the check that catches an authorisation
   * gap that authentication alone hides.
   */
  for (const path of VENDOR_ONLY) {
    test(`refuses a signed-in customer at ${path}`, async ({ customerPage }) => {
      await customerPage.goto(path);

      await expect(
        customerPage,
        `a customer reached ${path} — role gating is missing on this route`,
      ).not.toHaveURL(new RegExp(path.replace(/\//g, '\\/') + '$'));
    });
  }
});
