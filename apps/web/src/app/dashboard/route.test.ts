import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';
import { RETURN_PATH_PARAM } from '@/lib/return-path';

const getCurrentUser = vi.fn();

vi.mock('@/lib/current-user', async () => {
  const actual = await vi.importActual<typeof import('@/lib/current-user')>('@/lib/current-user');
  return { ...actual, getCurrentUser: () => getCurrentUser() };
});

const { GET } = await import('./route');

const REQUEST = new Request('http://localhost:3000/dashboard');

function locationOf(response: Response): string {
  const location = response.headers.get('location');
  expect(location).not.toBeNull();
  const url = new URL(location!);
  return `${url.pathname}${url.search}`;
}

describe('GET /dashboard', () => {
  it('resolves a vendor to their own dashboard', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', firstName: 'Grace', role: 'vendor' });

    const response = await GET(REQUEST);

    expect(response.status).toBe(307);
    expect(locationOf(response)).toBe('/vendor/dashboard');
  });

  it('resolves a customer to their bookings', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u2', firstName: 'Ada', role: 'customer' });

    expect(locationOf(await GET(REQUEST))).toBe('/bookings');
  });

  /*
   * The whole job of this handler is resolving a role, and it has not been able
   * to do that yet. Coming back here after sign-in resumes that, where landing
   * on `/` would silently drop the request.
   */
  it('sends a signed-out caller to sign-in carrying /dashboard as the destination', async () => {
    getCurrentUser.mockResolvedValue(null);

    expect(locationOf(await GET(REQUEST))).toBe(
      `/sign-in?${RETURN_PATH_PARAM}=${encodeURIComponent('/dashboard')}`,
    );
  });

  it('sends a suspended account to the suspended page, with no destination', async () => {
    getCurrentUser.mockRejectedValue(new ApiClientError(403, 'FORBIDDEN', 'Suspended'));

    expect(locationOf(await GET(REQUEST))).toBe('/suspended');
  });

  it('lets an unexpected API failure surface instead of redirecting somewhere wrong', async () => {
    getCurrentUser.mockRejectedValue(new ApiClientError(500, 'INTERNAL_ERROR', 'boom'));

    await expect(GET(REQUEST)).rejects.toThrow('boom');
  });
});
