import { ERROR_CODES, MAX_PAGE_SIZE } from '@vendor-marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_REQUEST_TIMEOUT_MS, ApiClientError, ApiTimeoutError } from './api-client';

const SIGN_IN_PATH = '/sign-in?next=/bookings';
const TERMS_PATH = '/accept-terms?next=/bookings';

vi.mock('./auth/server', () => ({
  getServerSession: async () => ({ userId: 'user-1', token: 'session-token' }),
}));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirected to ${path}`);
  },
}));

vi.mock('./requested-path', () => ({
  requestedPath: async () => '/bookings',
  signInPathReturningHere: async () => SIGN_IN_PATH,
}));

vi.mock('./terms-gate-paths', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./terms-gate-paths')>()),
  termsAcceptancePath: () => TERMS_PATH,
}));

const apiRequest = vi.fn();

vi.mock('./api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api-client')>()),
  apiRequest: (path: string, options: unknown) => apiRequest(path, options),
}));

const { getOwnBookingRequests, getOwnBookings } = await import('./customer-data');

const upstream500 = new ApiClientError(500, ERROR_CODES.INTERNAL_ERROR, 'Request failed');
const upstream429 = new ApiClientError(429, ERROR_CODES.RATE_LIMITED, 'Too many requests');
const timeout = new ApiTimeoutError('/bookings', API_REQUEST_TIMEOUT_MS);
const unauthorized = new ApiClientError(401, ERROR_CODES.UNAUTHORIZED, 'Unauthorized');
const termsRequired = new ApiClientError(403, ERROR_CODES.TERMS_REQUIRED, 'Accept the terms');

const failures = [
  ['a 500', upstream500],
  ['an ApiTimeoutError', timeout],
  ['a 429', upstream429],
  ['an unreachable API', new TypeError('fetch failed')],
] as const;

const reads = [
  ['getOwnBookingRequests', getOwnBookingRequests],
  ['getOwnBookings', getOwnBookings],
] as const;

/** A full page, so `readEveryPage` asks for the next one. */
const fullPage = Array.from({ length: MAX_PAGE_SIZE }, (_, index) => ({ id: `row-${index}` }));

describe.each(reads)('%s', (_name, read) => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it.each(failures)('throws on %s in required mode', async (_label, failure) => {
    apiRequest.mockRejectedValue(failure);

    await expect(read({ required: true })).rejects.toBe(failure);
  });

  it.each(failures)('returns [] on %s without required mode', async (_label, failure) => {
    apiRequest.mockRejectedValue(failure);

    await expect(read()).resolves.toEqual([]);
  });

  it('throws when page 2 fails in required mode, rather than returning page 1', async () => {
    apiRequest.mockResolvedValueOnce(fullPage).mockRejectedValueOnce(upstream500);

    await expect(read({ required: true })).rejects.toBe(upstream500);
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it('returns [] when page 2 fails without required mode', async () => {
    apiRequest.mockResolvedValueOnce(fullPage).mockRejectedValueOnce(upstream500);

    await expect(read()).resolves.toEqual([]);
  });

  it.each([
    ['required', { required: true }],
    ['default', {}],
  ])('still redirects a 401 to sign-in in %s mode', async (_mode, options) => {
    apiRequest.mockRejectedValue(unauthorized);

    await expect(read(options)).rejects.toThrow(`redirected to ${SIGN_IN_PATH}`);
  });

  it.each([
    ['required', { required: true }],
    ['default', {}],
  ])('still redirects TERMS_REQUIRED to the terms gate in %s mode', async (_mode, options) => {
    apiRequest.mockRejectedValue(termsRequired);

    await expect(read(options)).rejects.toThrow(`redirected to ${TERMS_PATH}`);
  });
});
