import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, type Page } from '@playwright/test';
import { parse } from 'dotenv';

import { resolveE2EApiUrl } from './base-url.js';
import { AUTH_DIR } from './fixtures.js';
import { E2E_VENDOR_SLUG } from './fixtures-data.js';
import { waitForHydration } from './hydration.js';

/**
 * The paid journey's plumbing: preconditions set up through the API, and the
 * two third-party surfaces a spec cannot select by role — Stripe's Payment
 * Element and its 3-D Secure challenge, both cross-origin iframes.
 *
 * Only the scenario that is *about* a step drives that step in the browser.
 * Refund and completion need a paid booking to act on; paying for it through
 * the Payment Element again would re-prove scenario 1 at thirty seconds a run
 * and make those scenarios fail for a checkout defect they do not test.
 */

/** Stripe's documented test cards: https://docs.stripe.com/testing */
export const TEST_CARDS = {
  succeeds: '4242424242424242',
  requiresThreeDs: '4000002760003184',
  declined: '4000000000000002',
} as const;

const API_URL = resolveE2EApiUrl();

/** The seeded package's occasion slug; any event type is accepted for a package request. */
const EVENT_TYPE = 'wedding';
const GUEST_COUNT = 80;

interface VendorProfile {
  id: string;
  packages: { id: string; priceCents: number }[];
}

export interface BookingRequest {
  id: string;
  status: string;
  eventDate: string;
  eventLocation: string | null;
  finalPriceCents: number | null;
}

export interface Booking {
  id: string;
  requestId: string;
  status: string;
  totalAmountCents: number;
  refundAmountCents: number | null;
}

interface CheckoutIntent {
  clientSecret: string | null;
  amountCents: number;
}

/** A venue no other run wrote, so a row on a shared screen can be found by it. */
export function uniqueVenue(scenario: string): string {
  return `E2E ${scenario} ${Date.now().toString(36)}`;
}

async function sessionToken(page: Page): Promise<string> {
  // Straight after a navigation Clerk is still loading and holds no session yet.
  await page.waitForFunction(() => window.Clerk?.loaded === true);
  const token = await page.evaluate(async () => (await window.Clerk?.session?.getToken()) ?? null);

  if (!token) {
    throw new Error(`No Clerk session token on ${page.url()} — the role fixture did not sign in`);
  }

  return token;
}

/** One API call as the page's signed-in user. Answers `null` for a 404. */
async function callApi<T>(
  page: Page,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
): Promise<T | null> {
  const response = await page.request.fetch(`${API_URL}${path}`, {
    method,
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
    ...(body === undefined ? {} : { data: body }),
  });

  if (response.status() === 404) {
    return null;
  }

  expect(
    response.ok(),
    `${method} ${path} answered ${response.status()}: ${await response.text()}`,
  ).toBe(true);

  return (await response.json()) as T;
}

async function mustCallApi<T>(
  page: Page,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
): Promise<T> {
  const result = await callApi<T>(page, method, path, body);

  if (result === null) {
    throw new Error(`${method} ${path} answered 404`);
  }

  return result;
}

/** The seeded vendor and its one package, read from the public profile. */
export async function seededPackage(page: Page): Promise<{ vendorId: string; packageId: string }> {
  const response = await page.request.get(`${API_URL}/vendors/${E2E_VENDOR_SLUG}`);
  expect(response.ok(), `GET /vendors/${E2E_VENDOR_SLUG} answered ${response.status()}`).toBe(true);

  const vendor = (await response.json()) as VendorProfile;
  const servicePackage = vendor.packages[0];

  if (!servicePackage) {
    throw new Error(`${E2E_VENDOR_SLUG} has no package — has seed:e2e run against this lane?`);
  }

  return { vendorId: vendor.id, packageId: servicePackage.id };
}

/** The customer's own request that names this venue. */
export async function requestAt(customerPage: Page, venue: string): Promise<BookingRequest> {
  const requests = await mustCallApi<BookingRequest[]>(customerPage, 'GET', '/booking-requests');
  const request = requests.find((row) => row.eventLocation === venue);

  if (!request) {
    throw new Error(`The customer has no request at "${venue}" — the send did not persist`);
  }

  return request;
}

export async function readRequest(customerPage: Page, requestId: string): Promise<BookingRequest> {
  return mustCallApi<BookingRequest>(customerPage, 'GET', `/booking-requests/${requestId}`);
}

/**
 * An accepted package request, created and accepted through the API.
 *
 * The request's `finalPriceCents` is returned from the API's own read rather
 * than assumed from the package, because it is the figure every money
 * assertion names.
 */
export async function acceptedRequest(
  customerPage: Page,
  vendorPage: Page,
  input: { eventDate: string; venue: string },
): Promise<BookingRequest & { finalPriceCents: number }> {
  const { vendorId, packageId } = await seededPackage(customerPage);

  const created = await mustCallApi<BookingRequest>(customerPage, 'POST', '/booking-requests', {
    vendorId,
    packageId,
    eventDate: input.eventDate,
    eventType: EVENT_TYPE,
    eventLocation: input.venue,
    guestCount: GUEST_COUNT,
  });

  await mustCallApi(vendorPage, 'POST', `/booking-requests/${created.id}/accept`);

  const accepted = await readRequest(customerPage, created.id);
  expect(accepted.status).toBe('accepted');

  if (accepted.finalPriceCents === null) {
    throw new Error('An accepted package request carries no finalPriceCents');
  }

  return { ...accepted, finalPriceCents: accepted.finalPriceCents };
}

/**
 * The booking a request produced, or `null` while it is unpaid.
 *
 * This read is the API's reconciliation path — it books from Stripe when no
 * webhook has landed — so it must never be what proves the webhook arrived.
 */
export async function bookingFor(customerPage: Page, requestId: string): Promise<Booking | null> {
  return callApi<Booking>(customerPage, 'GET', `/customer/booking-requests/${requestId}/booking`);
}

export async function readBooking(customerPage: Page, bookingId: string): Promise<Booking> {
  return mustCallApi<Booking>(customerPage, 'GET', `/customer/bookings/${bookingId}`);
}

/** Opens (or reopens) checkout, and names the PaymentIntent behind it. */
export async function checkoutIntent(
  customerPage: Page,
  requestId: string,
): Promise<{ paymentIntentId: string; amountCents: number }> {
  const intent = await mustCallApi<CheckoutIntent>(
    customerPage,
    'POST',
    `/customer/booking-requests/${requestId}/checkout`,
  );
  const paymentIntentId = intent.clientSecret?.split('_secret_')[0];

  if (!paymentIntentId?.startsWith('pi_')) {
    throw new Error(`Checkout for ${requestId} returned no PaymentIntent client secret`);
  }

  return { paymentIntentId, amountCents: intent.amountCents };
}

/**
 * The Stripe secret key, test mode only.
 *
 * Read from the environment, or the root `.env` the lane's API loads, and never
 * written anywhere. A live key is refused outright: this module confirms
 * charges and reads refunds, and neither may ever touch real money.
 */
function stripeSecretKey(): string {
  const rootEnv = resolve(AUTH_DIR, '..', '.env');
  const key =
    process.env.STRIPE_SECRET_KEY?.trim() ||
    (existsSync(rootEnv) ? parse(readFileSync(rootEnv, 'utf8')).STRIPE_SECRET_KEY?.trim() : '');

  if (!key?.startsWith('sk_test_')) {
    throw new Error('STRIPE_SECRET_KEY is missing or not a test-mode key; refusing to call Stripe');
  }

  return key;
}

async function stripeApi<T>(path: string, form?: Record<string, string>): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: form ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${stripeSecretKey()}` },
    ...(form ? { body: new URLSearchParams(form) } : {}),
  });
  const payload = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(`Stripe ${path} answered ${response.status}: ${payload.error?.message}`);
  }

  return payload;
}

/**
 * Pays an accepted request server-side with Stripe's `pm_card_visa`, then waits
 * for the booking row. For scenarios that need a paid booking, not a checkout.
 */
export async function payThroughStripe(
  customerPage: Page,
  requestId: string,
  returnUrl: string,
): Promise<Booking> {
  const { paymentIntentId } = await checkoutIntent(customerPage, requestId);

  await stripeApi(`/payment_intents/${paymentIntentId}/confirm`, {
    payment_method: 'pm_card_visa',
    return_url: returnUrl,
  });

  let booking: Booking | null = null;
  await expect
    .poll(async () => (booking = await bookingFor(customerPage, requestId)), {
      message: `no booking appeared for ${requestId} after Stripe confirmed its payment`,
    })
    .not.toBeNull();

  return booking!;
}

export async function refundsFor(
  paymentIntentId: string,
): Promise<{ amount: number; status: string }[]> {
  const list = await stripeApi<{ data: { amount: number; status: string }[] }>(
    `/refunds?payment_intent=${encodeURIComponent(paymentIntentId)}`,
  );

  return list.data;
}

/**
 * Types a card into the Payment Element.
 *
 * Every field lives in Stripe's iframe, so none of them is reachable by label
 * from this document; the `name` attributes are Stripe's own stable hooks.
 */
export async function fillCard(page: Page, cardNumber: string): Promise<void> {
  const element = page.frameLocator('iframe[title="Secure payment input frame"]').first();

  await element.locator('input[name="number"]').fill(cardNumber);
  await element.locator('input[name="expiry"]').fill('12 / 34');
  await element.locator('input[name="cvc"]').fill('123');

  const postalCode = element.locator('input[name="postalCode"]');
  if (await postalCode.count()) {
    await postalCode.fill('78701');
  }
}

/** Opens checkout from the request page, where a customer actually starts it. */
export async function openCheckout(
  customerPage: Page,
  requestId: string,
  priceLabel: string,
): Promise<void> {
  await customerPage.goto(`/bookings/${requestId}`);
  await waitForHydration(customerPage, 'a[href$="/checkout"]');
  await customerPage.getByRole('link', { name: `Pay ${priceLabel}` }).click();

  await expect(customerPage).toHaveURL(new RegExp(`/bookings/${requestId}/checkout$`));
  await expect(
    customerPage
      .frameLocator('iframe[title="Secure payment input frame"]')
      .first()
      .locator('input[name="number"]'),
    'the Payment Element never mounted a card field',
  ).toBeVisible();
}

/** The pay button, whose name states the amount being charged. */
export function payButton(customerPage: Page, priceLabel: string): ReturnType<Page['getByRole']> {
  return customerPage.getByRole('button', {
    name: new RegExp(`^Pay ${escapeRegExp(priceLabel)} — confirm`),
  });
}

/**
 * Presses `Complete` in Stripe's 3-D Secure test challenge until it closes.
 *
 * The button renders before Stripe's own script is listening to it, so a press
 * that lands first is silently dropped and the modal stays up — observed on the
 * first run. Pressing is idempotent until the challenge resolves, so it is
 * repeated against the visible outcome rather than timed.
 */
export async function completeThreeDsChallenge(page: Page): Promise<void> {
  const modal = page.locator('iframe[src*="three-ds-2-challenge"]');
  const complete = modal
    .contentFrame()
    .locator('iframe[name="stripe-challenge-frame"]')
    .contentFrame()
    .getByRole('button', { name: /^complete$/i });

  await expect(complete, 'Stripe never showed its 3-D Secure challenge').toBeVisible();
  await expect(async () => {
    if (await complete.isVisible()) {
      await complete.click({ timeout: 2_000 });
    }
    await expect(modal).toHaveCount(0, { timeout: 3_000 });
  }, 'the 3-D Secure challenge did not close after Complete').toPass({ timeout: 30_000 });
}

/** Named `escapeRegExp` rather than `escape` so it cannot be read as the deprecated global. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
