import { ERROR_CODES } from '@vendor-marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, ApiTimeoutError } from './api-client';

/**
 * #387 — the checkout was a dead end.
 *
 * `openCheckout` folded `[400, 402, 404, 409, 422]` into one `null` and the page
 * turned that into `notFound()`, so a Stripe 400 on a live accepted booking
 * answered "this page isn't here. The link may be old, or a vendor may have
 * taken their listing down" — every clause false. These pin the mapping, so a
 * future edit that widens the not-found branch has to go red first.
 */

const apiRequest = vi.fn();

vi.mock('./auth/server', () => ({
  getServerSession: async () => ({ userId: 'user-1', token: 'token' }),
}));

vi.mock('next/headers', () => ({ headers: async () => ({ get: () => '/bookings/x/checkout' }) }));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

vi.mock('./api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api-client')>()),
  apiRequest: (path: string, options: unknown) => apiRequest(path, options),
}));

const { openCheckout } = await import('./customer-data');

const REQUEST_ID = '1af86d43-0000-4000-8000-000000000000';

beforeEach(() => {
  apiRequest.mockReset();
});

function refuseWith(statusCode: number): void {
  apiRequest.mockRejectedValue(
    new ApiClientError(statusCode, ERROR_CODES.VALIDATION_ERROR, 'refused'),
  );
}

describe('openCheckout', () => {
  it('returns the intent when the API opens one', async () => {
    const checkout = {
      paymentIntentId: 'pi_1',
      clientSecret: 'pi_1_secret',
      status: 'requires_payment_method',
      amountCents: 145_000,
      customerFeeCents: 0,
      eventDate: '2026-10-15',
      eventLocation: 'Austin, TX',
      guestCount: 80,
      vendor: { businessName: 'E2E Test Studio', slug: 'e2e-test-studio', coverImageUrl: null },
      lineItems: [{ label: 'Full-day coverage', amountCents: 145_000 }],
    };
    apiRequest.mockResolvedValue(checkout);

    await expect(openCheckout(REQUEST_ID)).resolves.toEqual({ state: 'ready', checkout });
  });

  /*
   * VEN-637: the webhook can land between the page's booking pre-check and this
   * POST. The API then answers 2xx with a settled intent and no client secret,
   * and mapping that to `ready` built a Payment Element with nothing to pay.
   */
  it('reports an already-succeeded intent as paid, not ready', async () => {
    apiRequest.mockResolvedValue({
      paymentIntentId: 'pi_1',
      clientSecret: null,
      status: 'succeeded',
      amountCents: 145_000,
      customerFeeCents: 0,
      eventDate: '2026-10-15',
      eventLocation: 'Austin, TX',
      guestCount: 80,
      vendor: { businessName: 'E2E Test Studio', slug: 'e2e-test-studio', coverImageUrl: null },
      lineItems: [{ label: 'Full-day coverage', amountCents: 145_000 }],
    });

    await expect(openCheckout(REQUEST_ID)).resolves.toEqual({ state: 'paid' });
  });

  /*
   * The whole defect, as a test. A Stripe misconfiguration answers 400, and the
   * one thing this must not be is the surface for a page that does not exist.
   */
  it.each([400, 422])('reports %i as a payment that could not be started', async (statusCode) => {
    refuseWith(statusCode);

    await expect(openCheckout(REQUEST_ID)).resolves.toEqual({ state: 'failed' });
  });

  it('reports 409 as a booking that is no longer payable', async () => {
    refuseWith(409);

    await expect(openCheckout(REQUEST_ID)).resolves.toEqual({ state: 'not-payable' });
  });

  /* A request that does not exist or is not this customer's. */
  it('reports 404 as not found', async () => {
    refuseWith(404);

    await expect(openCheckout(REQUEST_ID)).resolves.toEqual({ state: 'not-found' });
  });

  /*
   * 402 is a live request on a vendor who cannot take payment right now. It
   * used to share the 404 bucket, so the customer was told the page was not
   * there and that nothing was wrong with their account, over a booking that
   * exists.
   */
  it('reports 402 as a vendor who cannot take payment, not as not found', async () => {
    refuseWith(402);

    await expect(openCheckout(REQUEST_ID)).resolves.toEqual({ state: 'vendor-unavailable' });
  });

  /*
   * VEN-479: a banned or retired vendor answers 409 with VENDOR_UNAVAILABLE. The
   * code must win over the generic 409 → not-payable branch, and it is a
   * permanent state of its own (VEN-555): folding it into the temporary 402
   * state offered a retry that can never succeed.
   */
  it('reports 409 VENDOR_UNAVAILABLE as a vendor who is closed, not as temporary or not payable', async () => {
    apiRequest.mockRejectedValue(
      new ApiClientError(409, ERROR_CODES.VENDOR_UNAVAILABLE, 'vendor unavailable'),
    );

    await expect(openCheckout(REQUEST_ID)).resolves.toEqual({ state: 'vendor-closed' });
  });

  /* VEN-559: reversible, so it must not fall into the permanent branch or the generic 409. */
  it('reports 409 VENDOR_PAUSED as a paused vendor', async () => {
    apiRequest.mockRejectedValue(
      new ApiClientError(409, ERROR_CODES.VENDOR_PAUSED, 'vendor paused'),
    );

    await expect(openCheckout(REQUEST_ID)).resolves.toEqual({ state: 'vendor-paused' });
  });

  it('sends an unauthenticated caller to sign in', async () => {
    refuseWith(401);

    await expect(openCheckout(REQUEST_ID)).rejects.toThrow(/NEXT_REDIRECT:/);
  });

  /*
   * #390 put an 8s deadline on every server-side call, and this POST is issued
   * from a Server Component, so it carries one. A timeout reaching the generic
   * 500 boundary would lose the retry and the "nothing was charged" line — the
   * two things this screen exists to say. Safe because the endpoint is
   * idempotent on `pay_<requestId>`.
   */
  it('offers the retry when the API misses its deadline', async () => {
    apiRequest.mockRejectedValue(
      new ApiTimeoutError(`/customer/booking-requests/${REQUEST_ID}/checkout`, 8000),
    );

    await expect(openCheckout(REQUEST_ID)).resolves.toEqual({ state: 'failed' });
  });

  it('lets a 500 reach the error boundary', async () => {
    refuseWith(500);

    await expect(openCheckout(REQUEST_ID)).rejects.toBeInstanceOf(ApiClientError);
  });
});
