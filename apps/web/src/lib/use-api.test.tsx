import { ERROR_CODES, TERMS_ACCEPTANCE_PATH } from '@vendor-marketplace/shared';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiClientError } from './api-client';

const push = vi.fn();
const replace = vi.fn();
const clearSessionToken = vi.fn();
const apiRequest = vi.fn();

vi.mock('./auth/client', () => ({
  getSessionToken: async () => 'token',
  clearSessionToken: () => clearSessionToken(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
vi.mock('./api-client', async () => {
  const actual = await vi.importActual<typeof import('./api-client')>('./api-client');

  return { ...actual, apiRequest: (...args: unknown[]) => apiRequest(...args) };
});

const { useApi } = await import('./use-api');

/**
 * The acceptance gate's **client** half, handled once for every browser call.
 *
 * Before this, each `catch` decided for itself what a 403 meant — and the
 * vendor profile's message button read one as "only a customer account can
 * start a thread with a vendor", which is a wrong and unfixable answer to give
 * somebody who is one tick away from being able to. There is no sensible
 * alternative for any caller: a session that has not accepted is refused by
 * every guarded route.
 */
describe('useApi and the acceptance gate', () => {
  beforeEach(() => {
    push.mockReset();
    apiRequest.mockReset();
    // An account-only route, not a storefront: VEN-586 made `/vendors/<slug>`
    // itself gate-exempt, so this fixture has to stay off that pattern for the
    // "carries where they were" assertion below to mean anything.
    window.history.replaceState({}, '', '/bookings/abc?package=1');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends the reader to the interstitial, carrying where they were', async () => {
    apiRequest.mockRejectedValue(
      new ApiClientError(403, ERROR_CODES.TERMS_REQUIRED, 'Accept the Terms'),
    );

    const { result } = renderHook(() => useApi());

    await expect(result.current('/conversations', { schema: z.unknown() })).rejects.toThrow();

    expect(push).toHaveBeenCalledWith(
      `${TERMS_ACCEPTANCE_PATH}?returnTo=%2Fbookings%2Fabc%3Fpackage%3D1`,
    );
  });

  /**
   * The error still reaches the caller so its own `finally` runs — a button
   * left spinning under a navigation is worse than one that resets.
   */
  it('still throws, so the caller can clean up', async () => {
    const refusal = new ApiClientError(403, ERROR_CODES.TERMS_REQUIRED, 'Accept the Terms');
    apiRequest.mockRejectedValue(refusal);

    const { result } = renderHook(() => useApi());

    await expect(result.current('/conversations', { schema: z.unknown() })).rejects.toBe(refusal);
  });

  /**
   * **The pages the gate must not take away.**
   *
   * This funnel is ambient — `NotificationBell` is mounted by the root layout on
   * every non-admin route and fetches on mount — so a gated reader who opens
   * `/terms` in its own tab, from the link beside the very checkbox they are
   * being asked to tick, would be pushed back to the gate a round trip later.
   * The document the gate demands you read would be unreadable. `/support` is
   * the same case and worse: the person most likely to need it is the one who
   * cannot get through.
   */
  it.each([
    '/terms',
    '/privacy',
    '/cookies',
    '/legal/vendor-agreement',
    '/support',
    '/accept-terms',
  ])('does not navigate away from %s', async (pathname) => {
    window.history.replaceState({}, '', pathname);
    apiRequest.mockRejectedValue(
      new ApiClientError(403, ERROR_CODES.TERMS_REQUIRED, 'Accept the Terms'),
    );

    const { result } = renderHook(() => useApi());

    await expect(result.current('/notifications', { schema: z.unknown() })).rejects.toThrow();

    expect(push).not.toHaveBeenCalled();
  });

  it('leaves a real refusal alone, so the caller can say what it means', async () => {
    apiRequest.mockRejectedValue(new ApiClientError(403, ERROR_CODES.FORBIDDEN, 'wrong role'));

    const { result } = renderHook(() => useApi());

    await expect(result.current('/conversations', { schema: z.unknown() })).rejects.toThrow();

    expect(push).not.toHaveBeenCalled();
  });

  it('does not navigate when the call succeeds', async () => {
    apiRequest.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useApi());

    await expect(result.current('/conversations', { schema: z.unknown() })).resolves.toEqual({
      ok: true,
    });
    expect(push).not.toHaveBeenCalled();
  });
});

/**
 * VEN-540. A session refused mid-session — banned, expired or signed out in
 * another tab — used to surface as the API's own "Unauthorized" text on every
 * retry. `terminalRefusal` already knows the two cases; this is its client half.
 */
describe('useApi and a session refused mid-session', () => {
  const assign = vi.fn();
  const originalLocation = window.location;

  function stubLocation(pathname: string, search = ''): void {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname, search, assign },
    });
  }

  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    assign.mockReset();
    clearSessionToken.mockReset();
    apiRequest.mockReset();
    stubLocation('/vendor/profile', '?tab=hours');
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('sends a suspended account (403) to /suspended and still throws', async () => {
    const refusal = new ApiClientError(403, ERROR_CODES.ACCOUNT_SUSPENDED, 'Account suspended');
    apiRequest.mockRejectedValue(refusal);

    const { result } = renderHook(() => useApi());

    await expect(result.current('/vendor/profile', { schema: z.unknown() })).rejects.toBe(refusal);

    expect(replace).toHaveBeenCalledExactlyOnceWith('/suspended');
    expect(assign).not.toHaveBeenCalled();
  });

  it('sends a refused session (401) to sign-in with the current path, after dropping the token', async () => {
    apiRequest.mockRejectedValue(new ApiClientError(401, ERROR_CODES.UNAUTHORIZED, 'Unauthorized'));

    const { result } = renderHook(() => useApi());

    await expect(result.current('/vendor/profile', { schema: z.unknown() })).rejects.toThrow();

    expect(clearSessionToken).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledExactlyOnceWith(
      '/sign-in?returnTo=%2Fvendor%2Fprofile%3Ftab%3Dhours',
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('leaves an ordinary 403 to its caller — a stale tab or a moderation hold is not a ban', async () => {
    apiRequest.mockRejectedValue(new ApiClientError(403, ERROR_CODES.FORBIDDEN, 'Not yours'));

    const { result } = renderHook(() => useApi());

    await expect(result.current('/x', { schema: z.unknown() })).rejects.toThrow();

    expect(replace).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('leaves the vendor gate to its caller — that 403 is not a suspension', async () => {
    apiRequest.mockRejectedValue(
      new ApiClientError(403, ERROR_CODES.VENDOR_NOT_INVITED, 'Not invited'),
    );

    const { result } = renderHook(() => useApi());

    await expect(result.current('/x', { schema: z.unknown() })).rejects.toThrow();

    expect(replace).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it.each(['/support', '/terms', '/suspended', '/sign-in'])(
    'does not navigate away from %s, where it is already answered',
    async (pathname) => {
      stubLocation(pathname);
      apiRequest.mockRejectedValue(new ApiClientError(401, ERROR_CODES.UNAUTHORIZED, 'no'));

      const { result } = renderHook(() => useApi());

      await expect(result.current('/x', { schema: z.unknown() })).rejects.toThrow();

      expect(assign).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    },
  );

  /**
   * VEN-586: `/`, `/search` and a storefront joined the **Terms funnel's**
   * exemption (`isGateExemptPath`) so a waitlisted-but-uninvited vendor stays
   * on them. `useRefusalRedirect` reads a separate, narrower list
   * (`isRefusalExemptPath`) precisely so this case does not regress — these
   * three pages carry real authenticated actions (a storefront's booking
   * rail, the header's notification bell), so a session actually revoked or
   * banned there still has to be signed out or sent to `/suspended`.
   */
  it.each(['/', '/search', '/vendors/june-harlow'])(
    'still signs out a revoked session (401) on the newly public %s',
    async (pathname) => {
      stubLocation(pathname);
      apiRequest.mockRejectedValue(new ApiClientError(401, ERROR_CODES.UNAUTHORIZED, 'no'));

      const { result } = renderHook(() => useApi());

      await expect(result.current('/x', { schema: z.unknown() })).rejects.toThrow();

      expect(clearSessionToken).toHaveBeenCalledOnce();
      expect(assign).toHaveBeenCalledExactlyOnceWith(
        `/sign-in?returnTo=${encodeURIComponent(pathname)}`,
      );
    },
  );

  it.each(['/', '/search', '/vendors/june-harlow'])(
    'still sends a suspended account (403) to /suspended from the newly public %s',
    async (pathname) => {
      stubLocation(pathname);
      apiRequest.mockRejectedValue(
        new ApiClientError(403, ERROR_CODES.ACCOUNT_SUSPENDED, 'Account suspended'),
      );

      const { result } = renderHook(() => useApi());

      await expect(result.current('/x', { schema: z.unknown() })).rejects.toThrow();

      expect(replace).toHaveBeenCalledExactlyOnceWith('/suspended');
    },
  );
});

/** The name gate's client half (VEN-701): one navigation to the step, off the pages it exempts. */
describe('useApi and the name gate', () => {
  const refusal = new ApiClientError(403, ERROR_CODES.NAME_REQUIRED, 'Add your name to continue.');

  beforeEach(() => {
    push.mockReset();
    apiRequest.mockReset();
    window.history.replaceState({}, '', '/vendors/june-harlow?package=1');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends the reader to the name step once, carrying where they were', async () => {
    apiRequest.mockRejectedValue(refusal);
    const { result } = renderHook(() => useApi());

    await expect(result.current('/conversations', { schema: z.unknown() })).rejects.toBe(refusal);

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(
      '/sign-up/customer-details?returnTo=%2Fvendors%2Fjune-harlow%3Fpackage%3D1',
    );
  });

  it('does not navigate from the name step itself', async () => {
    window.history.replaceState({}, '', '/sign-up/customer-details');
    apiRequest.mockRejectedValue(refusal);
    const { result } = renderHook(() => useApi());

    await expect(result.current('/conversations', { schema: z.unknown() })).rejects.toBe(refusal);

    expect(push).not.toHaveBeenCalled();
  });

  it('does not read a name refusal as a suspension', async () => {
    apiRequest.mockRejectedValue(refusal);
    const { result } = renderHook(() => useApi());

    await expect(result.current('/conversations', { schema: z.unknown() })).rejects.toBe(refusal);

    expect(replace).not.toHaveBeenCalled();
  });
});
