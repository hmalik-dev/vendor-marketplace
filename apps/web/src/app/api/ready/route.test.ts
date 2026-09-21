import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

describe('GET /api/ready', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('names the release this build was made for, and nothing else, uncached', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_RELEASE', SHA);
    vi.stubEnv('DATABASE_URL', 'postgres://must-not-leak');

    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toEqual({ commit: SHA });
    expect(Object.keys(body)).toEqual(['commit']);
  });

  it('answers a null commit rather than an empty string when the build carries no release', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_RELEASE', '');

    await expect(GET().json()).resolves.toEqual({ commit: null });
  });
});
