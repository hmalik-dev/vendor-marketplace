import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REQUEST_PATH_HEADER } from './return-path';

let headerValue: string | null = null;
let headersThrows = false;

vi.mock('next/headers', () => ({
  headers: async () => {
    if (headersThrows) {
      throw new Error('`headers` was called outside a request scope');
    }

    return { get: (name: string) => (name === REQUEST_PATH_HEADER ? headerValue : null) };
  },
}));

const { requestedPath, signInPathReturningHere } = await import('./requested-path');

beforeEach(() => {
  headerValue = null;
  headersThrows = false;
});

describe('requestedPath', () => {
  it('returns the path and its query exactly as the middleware stamped it', async () => {
    headerValue = '/bookings?tab=past';

    await expect(requestedPath()).resolves.toBe('/bookings?tab=past');
  });

  it('returns null when the header is absent', async () => {
    await expect(requestedPath()).resolves.toBeNull();
  });

  /*
   * The header is set by our own middleware, but a value that arrives at a
   * redirect is still untrusted input — the whole point of routing it through
   * `safeReturnPath`. These are the shapes that would otherwise leave the app.
   */
  it.each([
    ['an absolute URL', 'https://evil.example/x'],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash-smuggled host', '/\\evil.example'],
    ['a dot-segment walk to a foreign origin', '/x/..//evil.example'],
    ['a header-splitting newline', '/bookings\nLocation: https://evil.example'],
  ])('rejects %s', async (_label, value) => {
    headerValue = value;

    await expect(requestedPath()).resolves.toBeNull();
  });

  it('rejects a destination that would loop back into sign-in', async () => {
    headerValue = '/sign-in?returnTo=%2Fbookings';

    await expect(requestedPath()).resolves.toBeNull();
  });

  /*
   * A read that runs without a request scope must still be able to redirect.
   * Losing the return trip is a smaller failure than replacing the auth
   * redirect with a 500.
   */
  it('degrades to no destination when there is no request scope', async () => {
    headersThrows = true;

    await expect(requestedPath()).resolves.toBeNull();
  });
});

describe('signInPathReturningHere', () => {
  it('carries the current path and query through sign-in', async () => {
    headerValue = '/messages?conversation=c1';

    await expect(signInPathReturningHere()).resolves.toBe(
      '/sign-in?returnTo=%2Fmessages%3Fconversation%3Dc1',
    );
  });

  it('falls back to a bare sign-in when there is nothing safe to carry', async () => {
    headerValue = '//evil.example';

    await expect(signInPathReturningHere()).resolves.toBe('/sign-in');
  });
});
