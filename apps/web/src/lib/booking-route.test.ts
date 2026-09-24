import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const REQUEST_ID = '1af86d43-0000-4000-8000-000000000000';

const requireRole = vi.fn();
const getOwnBookingRequest = vi.fn();
const getBookingForRequest = vi.fn();
const openCheckout = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw Object.assign(new Error('NEXT_NOT_FOUND'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });
  },
  redirect: (path: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), {
      digest: `NEXT_REDIRECT;replace;${path};307;`,
    });
  },
}));
vi.mock('./current-user', () => ({ requireRole: (role: string) => requireRole(role) }));
vi.mock('./customer-data', () => ({
  getOwnBookingRequest: (id: string) => getOwnBookingRequest(id),
  getBookingForRequest: (id: string) => getBookingForRequest(id),
  openCheckout: (id: string) => openCheckout(id),
}));

const { gateBookingRequest, gateConfirmedBooking, gateCheckout } = await import('./booking-route');

function route(requestId: string): { params: Promise<{ requestId: string }> } {
  return { params: Promise.resolve({ requestId }) };
}

async function outcome(promise: Promise<unknown>): Promise<string> {
  return promise.then(
    () => 'ok',
    (error: { digest?: string }) => error.digest ?? 'unexpected',
  );
}

const NOT_FOUND = 'NEXT_HTTP_ERROR_FALLBACK;404';

/*
 * VEN-715: every status these routes answer is decided here, in a layout, above
 * `loading.tsx` — a page beneath the boundary streams under HTTP 200.
 */
describe('the /bookings/[requestId] gates', () => {
  beforeEach(() => {
    requireRole.mockResolvedValue({ id: 'user-1', role: 'customer' });
    getOwnBookingRequest.mockResolvedValue({ id: REQUEST_ID, status: 'accepted' });
    getBookingForRequest.mockResolvedValue(null);
    openCheckout.mockResolvedValue({ state: 'ready' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('gateBookingRequest', () => {
    it('lets the customer’s own request through and returns its id', async () => {
      await expect(gateBookingRequest(route(REQUEST_ID))).resolves.toMatchObject({
        requestId: REQUEST_ID,
        request: { id: REQUEST_ID },
      });
      expect(requireRole).toHaveBeenCalledWith('customer');
    });

    it('is a 404 for an id that is not a uuid, before any read', async () => {
      expect(await outcome(gateBookingRequest(route('not-a-uuid')))).toBe(NOT_FOUND);
      expect(getOwnBookingRequest).not.toHaveBeenCalled();
    });

    it('is a 404 for a request that is missing or not theirs', async () => {
      getOwnBookingRequest.mockResolvedValue(null);

      expect(await outcome(gateBookingRequest(route(REQUEST_ID)))).toBe(NOT_FOUND);
    });

    it('sends a visitor the session gate refuses away before reading anything', async () => {
      requireRole.mockRejectedValue(
        Object.assign(new Error('NEXT_REDIRECT'), {
          digest: 'NEXT_REDIRECT;replace;/sign-in;307;',
        }),
      );

      expect(await outcome(gateBookingRequest(route(REQUEST_ID)))).toBe(
        'NEXT_REDIRECT;replace;/sign-in;307;',
      );
      expect(getOwnBookingRequest).not.toHaveBeenCalled();
    });
  });

  describe('gateConfirmedBooking', () => {
    it('lets a paid request through', async () => {
      getBookingForRequest.mockResolvedValue({ id: 'booking-1' });

      await expect(gateConfirmedBooking(route(REQUEST_ID))).resolves.toMatchObject({
        requestId: REQUEST_ID,
        booking: { id: 'booking-1' },
      });
    });

    it('sends an unpaid request back to checkout', async () => {
      expect(await outcome(gateConfirmedBooking(route(REQUEST_ID)))).toBe(
        `NEXT_REDIRECT;replace;/bookings/${REQUEST_ID}/checkout;307;`,
      );
    });

    it('is a 404 for a missing request, ahead of the payment read', async () => {
      getOwnBookingRequest.mockResolvedValue(null);

      expect(await outcome(gateConfirmedBooking(route(REQUEST_ID)))).toBe(NOT_FOUND);
      expect(getBookingForRequest).not.toHaveBeenCalled();
    });
  });

  describe('gateCheckout', () => {
    it('lets an unpaid request through, and opens nothing itself', async () => {
      await expect(gateCheckout(route(REQUEST_ID))).resolves.toBe(REQUEST_ID);
      expect(openCheckout).not.toHaveBeenCalled();
    });

    it('sends an already-paid request to its confirmation', async () => {
      getBookingForRequest.mockResolvedValue({ id: 'booking-1' });

      expect(await outcome(gateCheckout(route(REQUEST_ID)))).toBe(
        `NEXT_REDIRECT;replace;/bookings/${REQUEST_ID}/confirmed;307;`,
      );
      expect(getOwnBookingRequest).not.toHaveBeenCalled();
    });

    it('is a 404 for a request that does not exist', async () => {
      getOwnBookingRequest.mockResolvedValue(null);

      expect(await outcome(gateCheckout(route(REQUEST_ID)))).toBe(NOT_FOUND);
    });

    it('is a 404 for a malformed id, before any read', async () => {
      expect(await outcome(gateCheckout(route('nope')))).toBe(NOT_FOUND);
      expect(getBookingForRequest).not.toHaveBeenCalled();
    });

    it('sends a visitor the session gate refuses away before reading anything', async () => {
      requireRole.mockRejectedValue(
        Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/admin;307;' }),
      );

      expect(await outcome(gateCheckout(route(REQUEST_ID)))).toBe(
        'NEXT_REDIRECT;replace;/admin;307;',
      );
      expect(getBookingForRequest).not.toHaveBeenCalled();
    });
  });
});
