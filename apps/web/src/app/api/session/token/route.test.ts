import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServerSession = vi.fn();
const authConfigured = vi.fn<() => boolean>();

vi.mock('@/lib/auth/server', () => ({
  authConfigured: () => authConfigured(),
  getServerSession: () => getServerSession(),
}));

const { GET } = await import('./route');

describe('GET /api/session/token', () => {
  beforeEach(() => {
    getServerSession.mockReset();
    authConfigured.mockReset().mockReturnValue(true);
  });

  it('answers 503 AUTH_UNAVAILABLE, uncached, when auth is not configured (VEN-635)', async () => {
    authConfigured.mockReturnValue(false);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ code: 'AUTH_UNAVAILABLE' });
    expect(getServerSession).not.toHaveBeenCalled();
  });

  it('answers 401 with no token, uncached, when nobody is signed in', async () => {
    getServerSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ token: null });
  });

  it('answers 200 with the bearer token and the user id, uncached, when signed in', async () => {
    getServerSession.mockResolvedValue({ userId: 'user-1', token: 'jwt.payload.sig' });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ token: 'jwt.payload.sig', userId: 'user-1' });
  });
});
