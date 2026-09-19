import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionToken, getSessionToken, REFRESH_WINDOW_MS } from './client';

/** An unsigned JWT-shaped string whose payload carries `exp` (seconds). */
function jwt(expSeconds: number, tag: string): string {
  const payload = btoa(JSON.stringify({ exp: expSeconds, tag }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `header.${payload}.signature`;
}

const NOW = Date.UTC(2026, 8, 18, 12, 0, 0);
const nowSeconds = NOW / 1000;
const fetchMock = vi.fn();

function answer(token: string): Response {
  return new Response(JSON.stringify({ token, userId: 'user-1' }), { status: 200 });
}

describe('getSessionToken', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    clearSessionToken();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks the same-origin token route, without a cache', async () => {
    fetchMock.mockResolvedValue(answer(jwt(nowSeconds + 900, 'a')));

    await getSessionToken();

    expect(fetchMock).toHaveBeenCalledWith('/api/session/token', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
  });

  it('serves a token with time left from memory, one request for many calls', async () => {
    const token = jwt(nowSeconds + 900, 'a');
    fetchMock.mockResolvedValue(answer(token));

    const results = await Promise.all([getSessionToken(), getSessionToken(), getSessionToken()]);
    await vi.advanceTimersByTimeAsync(5 * 60_000);

    expect(results).toEqual([token, token, token]);
    await expect(getSessionToken()).resolves.toBe(token);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches once the token is within a minute of expiring', async () => {
    const first = jwt(nowSeconds + 900, 'first');
    const second = jwt(nowSeconds + 1800, 'second');
    fetchMock.mockResolvedValueOnce(answer(first)).mockResolvedValueOnce(answer(second));

    await expect(getSessionToken()).resolves.toBe(first);

    // 900s life, so 841s in leaves 59s: inside the 60s window.
    await vi.advanceTimersByTimeAsync(900_000 - REFRESH_WINDOW_MS + 1_000);

    await expect(getSessionToken()).resolves.toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not refetch while more than a minute is left', async () => {
    fetchMock.mockResolvedValue(answer(jwt(nowSeconds + 900, 'a')));

    await getSessionToken();
    await vi.advanceTimersByTimeAsync(900_000 - REFRESH_WINDOW_MS - 1_000);
    await getSessionToken();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is signed out on a 401, and forgets the token it held', async () => {
    fetchMock.mockResolvedValueOnce(answer(jwt(nowSeconds + 900, 'a')));
    await getSessionToken();
    clearSessionToken();
    fetchMock.mockResolvedValueOnce(new Response('{"token":null}', { status: 401 }));

    await expect(getSessionToken()).resolves.toBeNull();

    fetchMock.mockResolvedValueOnce(new Response('{"token":null}', { status: 401 }));
    await expect(getSessionToken()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('never caches a token it cannot read an expiry from', async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ token: 'opaque' }), { status: 200 }),
    );

    await expect(getSessionToken()).resolves.toBe('opaque');
    await getSessionToken();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects on a server failure so the caller can retry, rather than reading it as signed out', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 502 }));

    await expect(getSessionToken()).rejects.toThrow('502');
  });
});
