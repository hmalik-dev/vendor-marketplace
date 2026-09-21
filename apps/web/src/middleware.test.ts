import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, type NextResponse } from 'next/server';
import { CSP_NONCE_PLACEHOLDER } from '@/config/security-headers';
import { REQUEST_PATH_HEADER } from '@/lib/return-path';

import middleware from './middleware';

function stampedPathFor(url: string, incoming: Record<string, string> = {}): string | null {
  const response = middleware(new NextRequest(new URL(url), { headers: incoming }));

  return response.headers.get(`x-middleware-request-${REQUEST_PATH_HEADER}`);
}

beforeEach(() => {
  vi.stubEnv('CSP_TEMPLATE', `script-src 'self' 'nonce-${CSP_NONCE_PLACEHOLDER}' 'strict-dynamic'`);
  vi.stubEnv('CSP_HEADER_NAME', 'Content-Security-Policy');
});

afterEach(() => vi.unstubAllEnvs());

describe('middleware CSP nonce', () => {
  function respond(incoming: Record<string, string> = {}): NextResponse {
    return middleware(new NextRequest(new URL('https://orla.test/'), { headers: incoming }));
  }

  it('sends the policy with a fresh nonce on the response and on the request', () => {
    const response = respond();
    const policy = response.headers.get('Content-Security-Policy') ?? '';
    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];

    expect(nonce).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
    expect(policy).not.toContain(CSP_NONCE_PLACEHOLDER);
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(policy);
  });

  it('hands Next the enforcing header on the request even when the response only reports', () => {
    vi.stubEnv('CSP_HEADER_NAME', 'Content-Security-Policy-Report-Only');
    const response = respond();

    expect(response.headers.get('Content-Security-Policy-Report-Only')).toContain('nonce-');
    expect(response.headers.get('Content-Security-Policy')).toBeNull();
    expect(response.headers.get('x-middleware-request-content-security-policy')).toContain(
      'nonce-',
    );
  });

  it('never repeats a nonce across requests', () => {
    const nonces = new Set(
      Array.from({ length: 20 }, () => respond().headers.get('x-middleware-request-x-nonce')),
    );

    expect(nonces.size).toBe(20);
  });

  it('ignores a nonce the client supplies', () => {
    const response = respond({ 'x-nonce': 'attacker' });

    expect(response.headers.get('x-middleware-request-x-nonce')).not.toBe('attacker');
    expect(response.headers.get('Content-Security-Policy')).not.toContain('attacker');
  });

  it('throws rather than serve pages with no policy when the build did not inline one', () => {
    vi.stubEnv('CSP_TEMPLATE', '');

    expect(() => respond()).toThrow(/CSP_TEMPLATE/);
  });
});

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
