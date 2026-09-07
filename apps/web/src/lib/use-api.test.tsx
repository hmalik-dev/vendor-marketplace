import { ERROR_CODES, TERMS_ACCEPTANCE_PATH } from '@vendor-marketplace/shared';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiClientError } from './api-client';

const push = vi.fn();
const apiRequest = vi.fn();

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'token' }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
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
    window.history.replaceState({}, '', '/vendors/june-harlow?package=1');
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
      `${TERMS_ACCEPTANCE_PATH}?returnTo=%2Fvendors%2Fjune-harlow%3Fpackage%3D1`,
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
  it.each(['/terms', '/privacy', '/cookies', '/support', '/accept-terms'])(
    'does not navigate away from %s',
    async (pathname) => {
      window.history.replaceState({}, '', pathname);
      apiRequest.mockRejectedValue(
        new ApiClientError(403, ERROR_CODES.TERMS_REQUIRED, 'Accept the Terms'),
      );

      const { result } = renderHook(() => useApi());

      await expect(result.current('/notifications', { schema: z.unknown() })).rejects.toThrow();

      expect(push).not.toHaveBeenCalled();
    },
  );

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
