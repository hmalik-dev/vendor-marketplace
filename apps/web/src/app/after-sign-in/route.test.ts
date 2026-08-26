import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';

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

  it('starts an admin on the marketplace home too', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u3', firstName: 'Root', role: 'admin' });

    expect(locationOf(await GET(REQUEST))).toBe('/');
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
});
