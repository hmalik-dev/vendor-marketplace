import { ERROR_CODES } from '@vendor-marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from './api-client';

/**
 * #76 — the protected server reads used to send a signed-out visitor to a bare
 * `/sign-in`, so the screen they were on was lost. These are the four modules
 * that hold those reads; none of them had a test covering the redirect, so the
 * destination could be dropped again without anything going red.
 *
 * Each read is exercised through its real module rather than a stand-in, which
 * is what makes this pin the actual behaviour.
 */

let token: string | null = null;
let requestPath: string | null = null;
const apiRequest = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ getToken: async () => token }) }));

vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => requestPath }),
}));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    const signal = new Error(`NEXT_REDIRECT:${path}`) as Error & { digest: string };
    signal.digest = `NEXT_REDIRECT;replace;${path};307;`;
    throw signal;
  },
}));

vi.mock('./api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api-client')>()),
  apiRequest: (path: string, options: unknown) => apiRequest(path, options),
}));

const { getOwnVendorProfile, getOwnPackages, getOwnPortfolio, getOwnAvailability } =
  await import('./vendor-data');
const { getOwnBookingRequests, getOwnBookings } = await import('./customer-data');
const { getOwnConversations } = await import('./messaging-data');
const vendorRequests = await import('./vendor-requests');

/** Every protected read, with the surface it backs. */
const PROTECTED_READS: ReadonlyArray<[string, () => Promise<unknown>]> = [
  ['vendor profile', getOwnVendorProfile],
  ['vendor packages', getOwnPackages],
  ['vendor portfolio', getOwnPortfolio],
  ['vendor availability', getOwnAvailability],
  ['customer booking requests', getOwnBookingRequests],
  ['customer bookings', getOwnBookings],
  ['conversations', getOwnConversations],
  ['vendor request queue', vendorRequests.getOwnBookingRequests],
];

beforeEach(() => {
  apiRequest.mockReset();
  token = null;
  requestPath = '/vendor/packages?filter=active';
});

/** The path a read redirected to, or `null` if it returned instead. */
async function redirectTargetOf(read: () => Promise<unknown>): Promise<string | null> {
  try {
    await read();
    return null;
  } catch (error) {
    const message = (error as Error).message;
    return message.startsWith('NEXT_REDIRECT:') ? message.slice('NEXT_REDIRECT:'.length) : null;
  }
}

describe('a protected read with no session', () => {
  it.each(PROTECTED_READS)('sends %s to sign-in carrying the destination', async (_name, read) => {
    expect(await redirectTargetOf(read)).toBe(
      `/sign-in?returnTo=${encodeURIComponent('/vendor/packages?filter=active')}`,
    );
  });

  it.each(PROTECTED_READS)('refuses an off-origin destination for %s', async (_name, read) => {
    requestPath = 'https://evil.example';

    expect(await redirectTargetOf(read)).toBe('/sign-in');
  });
});

describe('a protected read whose session has expired', () => {
  beforeEach(() => {
    token = 'stale-token';
    apiRequest.mockRejectedValue(
      new ApiClientError(401, ERROR_CODES.UNAUTHORIZED, 'Session expired'),
    );
  });

  /** The reads that turn a 401 into a redirect rather than an empty screen. */
  const REDIRECTS_ON_401: ReadonlyArray<[string, () => Promise<unknown>]> = [
    ['vendor profile', getOwnVendorProfile],
    ['vendor packages', getOwnPackages],
    ['vendor portfolio', getOwnPortfolio],
    ['vendor availability', getOwnAvailability],
    ['customer booking requests', getOwnBookingRequests],
    ['customer bookings', getOwnBookings],
  ];

  it.each(REDIRECTS_ON_401)('sends %s back to where it was', async (_name, read) => {
    expect(await redirectTargetOf(read)).toBe(
      `/sign-in?returnTo=${encodeURIComponent('/vendor/packages?filter=active')}`,
    );
  });

  /*
   * These two used to be the exception, and this block pinned it: `/messages`
   * and the vendor request queue degraded *any* read failure to their designed
   * empty state, and that swallowed a 401 too — an expired session was shown
   * "No conversations yet" rather than being sent to sign in.
   *
   * #76 pinned it deliberately rather than fixing it, because changing a
   * designed empty state is a different question from carrying a destination.
   * #310 is where that question was answered: an empty state may stand in for
   * an absence, never for a failure, so the 401 is separated out and everything
   * else still degrades exactly as it did.
   */
  it.each([
    ['conversations', getOwnConversations],
    ['vendor request queue', vendorRequests.getOwnBookingRequests],
  ])('sends %s to sign in rather than showing an empty state', async (_name, read) => {
    expect(await redirectTargetOf(read)).toBe(
      `/sign-in?returnTo=${encodeURIComponent('/vendor/packages?filter=active')}`,
    );
  });

  /*
   * The other half of the same rule, and the reason this is not simply "throw
   * on everything": a 500 or an unreachable API still degrades. The empty state
   * is a real surface for a real absence, and the live stream refills it.
   */
  it.each([
    ['conversations', getOwnConversations],
    ['vendor request queue', vendorRequests.getOwnBookingRequests],
  ])('still degrades %s to its empty state on a server failure', async (_name, read) => {
    token = 'session-token';
    apiRequest.mockRejectedValue(
      new ApiClientError(500, ERROR_CODES.INTERNAL_ERROR, 'Internal server error'),
    );

    expect(await redirectTargetOf(read)).toBeNull();
    await expect(read()).resolves.toEqual([]);
  });
});

/*
 * A suspended account is a different answer from a signed-out one, and it must
 * not acquire a destination — signing in again does not unsuspend anyone.
 */
describe('a suspended account', () => {
  it('goes to the suspended surface with no destination attached', async () => {
    token = 'session-token';
    apiRequest.mockRejectedValue(new ApiClientError(403, ERROR_CODES.FORBIDDEN, 'Suspended'));

    expect(await redirectTargetOf(getOwnPackages)).toBe('/suspended');
  });
});

/*
 * The 404-means-empty branches are the onboarding case, not a failure, and the
 * session rework must not have turned them into redirects.
 */
describe('a read whose resource does not exist yet', () => {
  beforeEach(() => {
    token = 'session-token';
    apiRequest.mockRejectedValue(new ApiClientError(404, ERROR_CODES.NOT_FOUND, 'No profile'));
  });

  it('returns null for a vendor with no profile rather than redirecting', async () => {
    await expect(getOwnVendorProfile()).resolves.toBeNull();
  });

  it.each([
    ['packages', getOwnPackages],
    ['portfolio', getOwnPortfolio],
    ['availability', getOwnAvailability],
  ])('returns an empty %s list rather than redirecting', async (_name, read) => {
    await expect(read()).resolves.toEqual([]);
  });
});
