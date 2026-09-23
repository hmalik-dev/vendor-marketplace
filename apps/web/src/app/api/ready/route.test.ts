import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

const RUNTIME_VARS = [
  'NEON_AUTH_BASE_URL',
  'NEON_AUTH_COOKIE_SECRET',
  'WEB_TIER_KEY',
  'DEPLOY_ENV',
  'WEB_URL',
];
const ALL_FALSE = Object.fromEntries(RUNTIME_VARS.map((name) => [name, false]));

describe('GET /api/ready', () => {
  // CI's own env sets NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET (ci.yml)
  // so the web build can validate the `auth` capability; without clearing all
  // five here first, a test asserting "unset" would be green locally and red
  // in CI, or the reverse.
  beforeEach(() => {
    for (const name of RUNTIME_VARS) {
      vi.stubEnv(name, '');
    }
  });

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
    expect(body).toEqual({ commit: SHA, runtimeEnv: ALL_FALSE });
    expect(Object.keys(body)).toEqual(['commit', 'runtimeEnv']);
  });

  it('answers a null commit rather than an empty string when the build carries no release', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_RELEASE', '');

    await expect(GET().json()).resolves.toEqual({ commit: null, runtimeEnv: ALL_FALSE });
  });

  it('reports false for each runtime variable that is unset, and never the value of one that is', async () => {
    vi.stubEnv('NEON_AUTH_BASE_URL', 'https://auth.orla.test');
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'top-secret-cookie-value');
    vi.stubEnv('WEB_TIER_KEY', 'top-secret-tier-key');

    const response = GET();
    const body = await response.json();
    const raw = JSON.stringify(body);

    expect(body.runtimeEnv).toEqual({
      NEON_AUTH_BASE_URL: true,
      NEON_AUTH_COOKIE_SECRET: true,
      WEB_TIER_KEY: true,
      DEPLOY_ENV: false,
      WEB_URL: false,
    });
    expect(raw).not.toContain('auth.orla.test');
    expect(raw).not.toContain('top-secret-cookie-value');
    expect(raw).not.toContain('top-secret-tier-key');
  });
});
