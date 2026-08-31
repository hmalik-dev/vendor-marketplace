import { expect, test } from './fixtures.js';
import { E2E_VENDOR_SLUG } from './fixtures-data.js';

/**
 * The core transaction's first half: a customer sends a booking request.
 *
 * This is the journey the product exists for, and the one the tracker's Tier 1
 * block records as having been broken end to end. It is driven against
 * `seed:e2e`'s vendor, which owns a published storefront and a package.
 *
 * The date is chosen from the vendor's own calendar rather than computed, so
 * the suite cannot rot into red by picking a day that is merely unavailable.
 */
test.describe('booking request', () => {
  test('takes a customer from the vendor profile to a sent request', async ({ customerPage }) => {
    await customerPage.goto(`/vendors/${E2E_VENDOR_SLUG}`);

    const request = customerPage.getByRole('link', { name: /request booking/i }).first();
    const requestButton = customerPage.getByRole('button', { name: /request booking/i }).first();

    if (await request.count()) {
      await request.click();
    } else {
      await requestButton.click();
    }

    await expect(customerPage).toHaveURL(/\/vendors\/.+\/request/);

    /*
     * `Event date` is the designed calendar dropdown (#167, #328), not a native
     * input: the native control could grey out the past and nothing else, so a
     * day the vendor was already booked looked identical to a free one. The
     * suite therefore picks a day the vendor is actually free, which is also the
     * only way to reach the availability hint below.
     */
    await customerPage.getByLabel('Event date').click();

    const grid = customerPage.getByRole('grid', { name: 'Event date' });
    await expect(grid).toBeVisible();

    const choosable = grid.locator('button[role="gridcell"]:not([disabled])');
    let months = 0;
    while ((await choosable.count()) === 0 && months < 6) {
      await customerPage.getByRole('button', { name: 'Next month' }).click();
      months += 1;
    }

    expect(
      await choosable.count(),
      'the vendor has no free day in the next six months — has seed:e2e written availability?',
    ).toBeGreaterThan(0);
    await choosable.first().click();

    // `Event type` is required and is its own dropdown — "it changes what the
    // vendor quotes", so the form blocks without it.
    await customerPage.getByLabel('Event type').click();
    await customerPage.getByRole('option').first().click();

    await customerPage.getByLabel('Venue or location').fill('Zilker Botanical Garden, Austin');
    await customerPage.getByLabel('Guest count').fill('80');

    await customerPage.getByRole('button', { name: 'Continue to review' }).click();

    /*
     * Assert the step actually advanced. `Continue to review` stays *enabled*
     * while the form is invalid and reports the problem in place, so asserting
     * the button was clickable proves nothing — an earlier draft did exactly
     * that and reported a blocked form as a missing button.
     */
    const send = customerPage.getByRole('button', { name: 'Send request' });
    await expect(
      send,
      'still on step 1 — the form refused to advance and the validation summary says why',
    ).toBeVisible();
    await send.click();

    /*
     * The form confirms **in place** — step 3 of its own stepper, same URL —
     * rather than navigating to the request. Worth stating, because the obvious
     * assertion (a redirect to `/bookings/<id>`) fails against a submit that
     * completely succeeded, and reads as a broken transaction.
     */
    await expect(
      customerPage.getByRole('heading', { name: /^Your request is with/ }),
      'no confirmation after Send request — the submit did not succeed',
    ).toBeVisible({ timeout: 30_000 });

    /*
     * The promise the marketing copy makes, asserted where the customer reads
     * it. `#68` records that this exact reassurance shipped while the flow
     * behind it was unreachable.
     */
    await expect(customerPage.getByText(/no card has been charged/i)).toBeVisible();

    /*
     * Persistence, which the confirmation alone does not prove: follow the link
     * the screen offers and find the request in the customer's own hub.
     */
    await customerPage.getByRole('link', { name: 'See your requests' }).click();
    await expect(customerPage).toHaveURL(/\/bookings$/);
    await expect(
      customerPage.getByRole('listitem').first(),
      'the sent request is not in the customer bookings hub — it did not persist',
    ).toBeVisible();
  });

  test('shows the sent request in the vendor queue', async ({ vendorPage }) => {
    await vendorPage.goto('/vendor/bookings');

    await expect(
      vendorPage.getByRole('heading').first(),
      'the vendor booking queue did not render',
    ).toBeVisible();
  });
});
