import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';
import { RETURN_PATH_PARAM } from '@/lib/return-path';

const getCurrentUser = vi.fn();

vi.mock('@/lib/current-user', async () => {
  const actual = await vi.importActual<typeof import('@/lib/current-user')>('@/lib/current-user');
  return { ...actual, getCurrentUser: () => getCurrentUser() };
});

const { GET } = await import('./route');

const REQUEST = new Request('http://localhost:3000/after-sign-in');

function locationOf(response: Response): string {
  const location = response.headers.get('location');
  expect(location).not.toBeNull();
  return new URL(location!).pathname;
}

/** The absolute `Location`, so an origin change is visible to a test. */
function absoluteLocationOf(response: Response): string {
  const location = response.headers.get('location');
  expect(location).not.toBeNull();
  return location as string;
}

/** `/after-sign-in` carrying a destination, the way sign-in hands it over. */
function requestReturningTo(value: string): Request {
  return new Request(
    `http://localhost:3000/after-sign-in?${RETURN_PATH_PARAM}=${encodeURIComponent(value)}`,
  );
}

describe('GET /after-sign-in', () => {
  it('starts a vendor on their own dashboard, not the vendor catalogue', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', firstName: 'Grace', role: 'vendor' });

    const response = await GET(REQUEST);

    expect(response.status).toBe(307);
    expect(locationOf(response)).toBe('/vendor/dashboard');
  });

  it('starts a customer on the marketplace home rather than a dashboard', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u2', firstName: 'Ada', role: 'customer' });

    expect(locationOf(await GET(REQUEST))).toBe('/');
  });

  it('starts an admin on the operations console', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u3', firstName: 'Root', role: 'admin' });

    expect(locationOf(await GET(REQUEST))).toBe('/admin');
  });

  it('sends a session with no account back to sign-in', async () => {
    getCurrentUser.mockResolvedValue(null);

    expect(locationOf(await GET(REQUEST))).toBe('/sign-in');
  });

  it('sends a suspended account to the suspended page', async () => {
    getCurrentUser.mockRejectedValue(new ApiClientError(403, 'FORBIDDEN', 'Suspended'));

    expect(locationOf(await GET(REQUEST))).toBe('/suspended');
  });

  it('lets an unexpected API failure surface instead of redirecting somewhere wrong', async () => {
    getCurrentUser.mockRejectedValue(new ApiClientError(500, 'INTERNAL_ERROR', 'boom'));

    await expect(GET(REQUEST)).rejects.toThrow(ApiClientError);
  });

  /*
   * #116. This handler performs the redirect, so it is the enforcing boundary
   * for the destination — it re-validates rather than trusting that the
   * sign-in screen looked at the value first.
   */
  describe('the carried destination', () => {
    it('returns a customer to where they were going, not the role default', async () => {
      getCurrentUser.mockResolvedValue({ id: 'u1', firstName: 'Ada', role: 'customer' });

      const response = await GET(
        requestReturningTo('/vendors/june-harlow/request?package=abc&date=2026-12-05'),
      );

      expect(response.status).toBe(307);
      expect(absoluteLocationOf(response)).toBe(
        'http://localhost:3000/vendors/june-harlow/request?package=abc&date=2026-12-05',
      );
    });

    it.each([
      ['an absolute URL', 'https://evil.test/steal'],
      ['a scheme-relative URL', '//evil.test'],
      ['a path that normalises scheme-relative', '/x/..//evil.test'],
      ['a dot-segment loop back into sign-in', '/x/../sign-in'],
    ])('ignores %s and uses the role default', async (_label, value) => {
      getCurrentUser.mockResolvedValue({ id: 'u1', firstName: 'Ada', role: 'customer' });

      const response = await GET(requestReturningTo(value));

      expect(response.status).toBe(307);
      expect(absoluteLocationOf(response)).toBe('http://localhost:3000/');
      expect(absoluteLocationOf(response)).not.toContain('evil.test');
    });

    it('sends a suspended account to /suspended even with a destination', async () => {
      getCurrentUser.mockRejectedValue(new ApiClientError(403, 'FORBIDDEN', 'Suspended'));

      const response = await GET(requestReturningTo('/bookings'));

      expect(locationOf(response)).toBe('/suspended');
    });

    it('sends a signed-out caller back to sign-in, destination or not', async () => {
      getCurrentUser.mockResolvedValue(null);

      const response = await GET(requestReturningTo('/bookings'));

      expect(locationOf(response)).toBe('/sign-in');
    });
  });
});
