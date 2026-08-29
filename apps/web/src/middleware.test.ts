import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { REQUEST_PATH_HEADER } from '@/lib/return-path';

/*
 * `clerkMiddleware` is the session attachment, which is not what is under test
 * here. Running the handler it is given directly keeps this a test of the one
 * thing this module adds: the request path a layout has no other way to learn.
 */
vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler: unknown) => handler,
}));

const middleware = (await import('./middleware')).default as unknown as (
  auth: unknown,
  request: NextRequest,
) => Response;

function stampedPathFor(url: string, incoming: Record<string, string> = {}): string | null {
  const response = middleware(null, new NextRequest(new URL(url), { headers: incoming }));

  return response.headers.get(`x-middleware-request-${REQUEST_PATH_HEADER}`);
}

describe('middleware', () => {
  it('stamps the requested path on the request', () => {
    expect(stampedPathFor('https://orla.test/customer/profile')).toBe('/customer/profile');
  });

  /*
   * The query is half the destination: `/bookings` and `/bookings?tab=past`
   * are different screens, and a booking request carries its chosen package in
   * the query alone.
   */
  it('keeps the query string, which is where the destination often lives', () => {
    expect(stampedPathFor('https://orla.test/bookings?tab=past')).toBe('/bookings?tab=past');
  });

  /*
   * The header is app-owned. A visitor who sends one under the same name must
   * not be able to seed the value a redirect is later built from — this is the
   * reason the middleware sets rather than merges.
   */
  it('overwrites a header the client supplied under the same name', () => {
    expect(
      stampedPathFor('https://orla.test/messages', {
        [REQUEST_PATH_HEADER]: 'https://evil.example',
      }),
    ).toBe('/messages');
  });
  /*
   * `_rsc` is Next's own client-navigation cache-buster, not part of the
   * destination. Carrying it through sign-in landed the visitor on
   * `/vendor/dashboard?_rsc=abc123` — a URL they never asked for.
   */
  it("strips Next's internal _rsc param from the destination", () => {
    expect(stampedPathFor('https://orla.test/vendor/dashboard?_rsc=abc123')).toBe(
      '/vendor/dashboard',
    );
  });

  it('keeps the real query when _rsc rides alongside it', () => {
    expect(stampedPathFor('https://orla.test/bookings?tab=history&_rsc=abc123')).toBe(
      '/bookings?tab=history',
    );
  });
});
