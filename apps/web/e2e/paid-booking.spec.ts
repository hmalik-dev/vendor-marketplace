import { type Page } from '@playwright/test';

import {
  TEST_CARDS,
  acceptedRequest,
  bookingFor,
  checkoutIntent,
  completeThreeDsChallenge,
  fillCard,
  openCheckout,
  payButton,
  payThroughStripe,
  readBooking,
  refundsFor,
  requestAt,
  seededPackage,
  uniqueVenue,
} from './booking-journey.js';
import {
  expect,
  expectSignedIn,
  freshEventDate,
  shiftBookingIntoPast,
  storageStatePath,
  test,
} from './fixtures.js';
import { E2E_VENDOR_SLUG, formatWholeDollars } from './fixtures-data.js';
import { waitForHydration } from './hydration.js';

/**
 * The path real money takes: accept, pay, complete, review — and a refund.
 *
 * Runs against the lane's real stack and Stripe test mode, with webhooks
 * forwarded to the lane API by `stripe listen` (see `e2e/README.md`). Every
 * scenario books its own fresh date, because `seed:e2e` tops up and never
 * resets: the bookings from every earlier run are still in the database.
 */

/*
 * A journey spans two signed-in browsers, Stripe's iframes and a webhook round
 * trip, so it outgrows the suite's 90s default. This is wall clock for real
 * work, not a retry budget — `retries` stays 0.
 */
const JOURNEY_TIMEOUT_MS = 180_000;

/** How long Stripe may take to deliver `payment_intent.succeeded` to the lane. */
const WEBHOOK_WAIT_MS = 60_000;

test.describe.configure({ timeout: JOURNEY_TIMEOUT_MS });

/** A `YYYY-MM-DD` calendar date moved by whole days, in UTC so no zone can shift it. */
function addDaysToDate(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/** The vendor's card for one booking on `/vendor/bookings`, found by its unique venue. */
function vendorBookingCard(vendorPage: Page, venue: string): ReturnType<Page['locator']> {
  return vendorPage.locator('li').filter({ hasText: venue });
}

/**
 * Reloads the vendor's bookings until the card reads `Booked`.
 *
 * `/vendor/bookings` reads the vendor's bookings list, which never reconciles
 * with Stripe — only the webhook can put a row there. That is what makes this
 * the assertion that fails when the webhook does not arrive.
 */
async function expectVendorSeesBooked(vendorPage: Page, venue: string): Promise<void> {
  await expect(async () => {
    await vendorPage.goto('/vendor/bookings');
    await expect(
      vendorBookingCard(vendorPage, venue).getByText('Booked', { exact: true }),
    ).toBeVisible({
      timeout: 2_000,
    });
  }, 'the vendor never saw the booking paid — did the Stripe webhook reach the lane API?').toPass({
    timeout: WEBHOOK_WAIT_MS,
  });
}

/** The customer's request page, once paid: the amount under `Paid`. */
async function expectCustomerSeesPaid(
  customerPage: Page,
  requestId: string,
  priceLabel: string,
): Promise<void> {
  await customerPage.goto(`/bookings/${requestId}`);
  await expect(customerPage.getByRole('heading', { level: 1, name: / is booked$/ })).toBeVisible();
  await expect(customerPage.getByText('Paid', { exact: true })).toBeVisible();
  await expect(customerPage.getByText(priceLabel, { exact: true })).toBeVisible();
}

test.describe('paid booking', () => {
  test('a customer requests, the vendor accepts, and a 4242 card pays through the webhook', async ({
    customerPage,
    vendorPage,
  }) => {
    const eventDate = await freshEventDate();
    const venue = uniqueVenue('paid');
    const { packageId } = await seededPackage(customerPage);

    // The request, as the customer sends it: package and date carried in the URL
    // exactly as the profile rail and search hand them over.
    await customerPage.goto(
      `/vendors/${E2E_VENDOR_SLUG}/request?package=${packageId}&date=${eventDate}`,
    );
    await waitForHydration(customerPage, 'textarea');
    await customerPage.getByLabel('Event type').click();
    await customerPage.getByRole('option').first().click();
    await customerPage.getByLabel('Venue or location').fill(venue);
    await customerPage.getByLabel('Guest count').fill('80');
    await customerPage.getByRole('button', { name: 'Continue to review' }).click();
    await customerPage.getByRole('button', { name: 'Send request' }).click();
    await expect(
      customerPage.getByRole('heading', { name: /^Your request is with/ }),
      'no confirmation after Send request',
    ).toBeVisible();

    const sent = await requestAt(customerPage, venue);
    expect(sent.eventDate).toBe(eventDate);
    expect(sent.status).toBe('pending');
    const finalPriceCents = sent.finalPriceCents!;
    expect(finalPriceCents, 'a package request is priced when it is sent').toBeGreaterThan(0);
    const priceLabel = formatWholeDollars(finalPriceCents);

    // The vendor accepts from their dashboard, in their own browser.
    await vendorPage.goto('/vendor/dashboard');
    const row = vendorPage.locator('li').filter({ hasText: venue });
    await waitForHydration(vendorPage, 'li button');
    await row.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(row, 'the accepted request is still waiting on the dashboard').toHaveCount(0);

    await vendorPage.goto('/vendor/bookings');
    /*
     * Every `li` in the document, not only `main`'s (`e2e/hydration.ts`). Mid-swap
     * the streamed list's second copy sits in React's hidden boundary outside
     * `#main`, so a wait scoped to `main li` let the read below resolve both
     * copies — observed once in eight full runs after VEN-414 first landed.
     */
    await waitForHydration(vendorPage, 'li');
    await expect(
      vendorBookingCard(vendorPage, venue).getByText('Awaiting payment', { exact: true }),
    ).toBeVisible();

    await openCheckout(customerPage, sent.id, priceLabel);
    const { amountCents } = await checkoutIntent(customerPage, sent.id);
    expect(amountCents).toBe(finalPriceCents);

    /*
     * Hold the customer's arrival on the confirmed screen until the vendor has
     * seen the booking. That screen's read reconciles with Stripe directly, so
     * letting it through first would book the date without any webhook — and
     * this scenario would pass with the webhook route switched off.
     */
    let releaseConfirmed: () => void = () => undefined;
    const vendorSawPaid = new Promise<void>((resolveHold) => {
      releaseConfirmed = resolveHold;
    });
    await customerPage.route(`**/bookings/${sent.id}/confirmed**`, async (route) => {
      await vendorSawPaid;
      await route.continue();
    });

    await fillCard(customerPage, TEST_CARDS.succeeds);
    await payButton(customerPage, priceLabel).click();

    await expectVendorSeesBooked(vendorPage, venue);
    releaseConfirmed();

    await expect(customerPage).toHaveURL(new RegExp(`/bookings/${sent.id}/confirmed$`));
    await expect(
      customerPage.getByRole('heading', { level: 1, name: / is yours\.$/ }),
    ).toBeVisible();
    await customerPage.unrouteAll({ behavior: 'ignoreErrors' });

    await expectCustomerSeesPaid(customerPage, sent.id, priceLabel);

    const booking = await bookingFor(customerPage, sent.id);
    expect(booking?.status).toBe('confirmed');
    expect(booking?.totalAmountCents).toBe(finalPriceCents);
  });

  test('a 3-D Secure card pays once the challenge is completed', async ({
    customerPage,
    vendorPage,
  }) => {
    const venue = uniqueVenue('3ds');
    const request = await acceptedRequest(customerPage, vendorPage, {
      eventDate: await freshEventDate(),
      venue,
    });
    const priceLabel = formatWholeDollars(request.finalPriceCents);

    await openCheckout(customerPage, request.id, priceLabel);
    await fillCard(customerPage, TEST_CARDS.requiresThreeDs);
    await payButton(customerPage, priceLabel).click();
    await completeThreeDsChallenge(customerPage);

    await expectVendorSeesBooked(vendorPage, venue);
    await expect(customerPage).toHaveURL(new RegExp(`/bookings/${request.id}/confirmed$`));
    await expectCustomerSeesPaid(customerPage, request.id, priceLabel);

    const booking = await bookingFor(customerPage, request.id);
    expect(booking?.totalAmountCents).toBe(request.finalPriceCents);
  });

  test('a declined card says so and leaves the booking unpaid', async ({
    customerPage,
    vendorPage,
  }) => {
    const request = await acceptedRequest(customerPage, vendorPage, {
      eventDate: await freshEventDate(),
      venue: uniqueVenue('declined'),
    });
    const priceLabel = formatWholeDollars(request.finalPriceCents);

    await openCheckout(customerPage, request.id, priceLabel);
    await fillCard(customerPage, TEST_CARDS.declined);
    await payButton(customerPage, priceLabel).click();

    const decline = customerPage.getByRole('alert').filter({ hasText: 'Your card was declined' });
    await expect(decline).toContainText("Your card was declined — you haven't been charged");
    // `4000 0000 0000 0002` is Stripe's generic decline, and the screen prints its code verbatim.
    await expect(
      customerPage.getByText('Declined by your bank · code generic_decline'),
    ).toBeVisible();
    await expect(customerPage).toHaveURL(new RegExp(`/bookings/${request.id}/checkout$`));

    expect(
      await bookingFor(customerPage, request.id),
      'a declined card produced a booking',
    ).toBeNull();

    await customerPage.goto(`/bookings/${request.id}`);
    await expect(customerPage.getByRole('link', { name: `Pay ${priceLabel}` })).toBeVisible();
    await expect(customerPage.getByText('Paid', { exact: true })).toHaveCount(0);
  });

  test('cancelling a paid booking more than 48 hours out refunds all of it', async ({
    customerPage,
    vendorPage,
    baseURL,
  }) => {
    const request = await acceptedRequest(customerPage, vendorPage, {
      eventDate: await freshEventDate(),
      venue: uniqueVenue('refund'),
    });
    const { paymentIntentId } = await checkoutIntent(customerPage, request.id);
    const booking = await payThroughStripe(customerPage, request.id, `${baseURL}/bookings`);
    const priceLabel = formatWholeDollars(request.finalPriceCents);

    await customerPage.goto(`/bookings/${request.id}`);
    await expect(
      customerPage.getByText(`you're refunded in full — ${priceLabel}.`, { exact: false }),
    ).toBeVisible();

    await waitForHydration(customerPage, 'section button');
    await customerPage.getByRole('button', { name: 'Cancel booking' }).click();
    await customerPage
      .getByRole('button', { name: `Yes, cancel and refund ${priceLabel}` })
      .click();

    await expect(
      customerPage.getByText(
        `You paid ${priceLabel}, and all of it was refunded to your original payment method.`,
      ),
    ).toBeVisible();

    const cancelled = await readBooking(customerPage, booking.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.refundAmountCents).toBe(request.finalPriceCents);

    const refunds = await refundsFor(paymentIntentId);
    expect(refunds.map((refund) => refund.amount)).toEqual([request.finalPriceCents]);
    expect(['succeeded', 'pending']).toContain(refunds[0]?.status);
  });

  test('after the event the vendor completes it and the customer’s review reaches the storefront', async ({
    browser,
    customerPage,
    vendorPage,
    baseURL,
  }) => {
    const venue = uniqueVenue('review');
    const request = await acceptedRequest(customerPage, vendorPage, {
      eventDate: await freshEventDate(),
      venue,
    });
    const booking = await payThroughStripe(customerPage, request.id, `${baseURL}/bookings`);
    const eventDate = await shiftBookingIntoPast(booking.id);

    /*
     * The tightest day there is (VEN-414): the vendor's own evening of the event
     * day, when UTC — the API's clock, and the day `shiftBookingIntoPast` counted
     * back from — is already on the next one. A pinned zone and a pinned clock,
     * so this runs the edge at any hour instead of only between 00:00 UTC and
     * local midnight. UTC-12 keeps the pinned instant within twelve hours of the
     * real one, where the auth session the vendor holds is still honoured.
     */
    const vendorContext = await browser.newContext({
      storageState: storageStatePath('vendor'),
      timezoneId: 'Etc/GMT+12',
    });
    try {
      const vendorAtEdge = await vendorContext.newPage();
      await vendorAtEdge.clock.setSystemTime(new Date(`${eventDate}T23:30:00-12:00`));
      await vendorAtEdge.goto('/vendor/bookings');
      await expectSignedIn(vendorAtEdge);
      expect(
        await vendorAtEdge.evaluate(() => [
          new Date().toLocaleDateString('en-CA'),
          new Date().toISOString().slice(0, 10),
        ]),
        'the vendor’s day is the event day while UTC is already past it',
      ).toEqual([eventDate, addDaysToDate(eventDate, 1)]);

      const card = vendorBookingCard(vendorAtEdge, venue);
      await waitForHydration(vendorAtEdge, 'li button');
      await card.getByRole('button', { name: 'Mark complete' }).click();
      await expect(card.getByText('Complete', { exact: true })).toBeVisible();
    } finally {
      await vendorContext.close();
    }
    expect((await readBooking(customerPage, booking.id)).status).toBe('completed');

    const review = `Paid journey review ${venue}`;
    await customerPage.goto(`/vendors/${E2E_VENDOR_SLUG}?tab=reviews`);
    await waitForHydration(customerPage, 'main button');
    await customerPage.getByRole('button', { name: 'Write a review' }).click();
    // The radio is visually hidden and its star label takes the press, as for a person.
    const fiveStars = customerPage.getByRole('radio', { name: /^5 stars/ });
    await customerPage.locator('label').filter({ has: fiveStars }).click();
    await expect(fiveStars).toBeChecked();
    await customerPage.getByLabel('Review', { exact: true }).fill(review);
    await customerPage.getByRole('button', { name: 'Post review' }).click();
    await expect(customerPage.getByText(review)).toBeVisible();

    // Public, not merely echoed back to its author: a signed-out visitor reads it.
    const visitor = await browser.newContext();
    try {
      const page = await visitor.newPage();
      await page.goto(`/vendors/${E2E_VENDOR_SLUG}?tab=reviews`);
      await expect(page.getByText(review)).toBeVisible();
    } finally {
      await visitor.close();
    }
  });
});
