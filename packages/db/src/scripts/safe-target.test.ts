import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertSafeTarget } from './safe-target.js';

/**
 * The guard that stands between a fabricating seed and a database holding real
 * accounts.
 *
 * It matters more for the end-to-end fixture than for the marketing one: that
 * fixture forces a `users.role` to `vendor` and marks a vendor able to take
 * payment without Stripe ever saying so. Both are privilege grants, and neither
 * belongs anywhere near production.
 */
describe('assertSafeTarget', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('refuses when DATABASE_URL is not set at all', () => {
    vi.stubEnv('DATABASE_URL', '');

    expect(() => assertSafeTarget('end-to-end fixtures')).toThrow(/DATABASE_URL is not set/);
  });

  /*
   * No escape hatch, deliberately — unlike preflight's branch check, which
   * permits the production branch when `NODE_ENV=production` because a
   * production process legitimately runs there. No seed does.
   */
  it('refuses under NODE_ENV=production even against a local host', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/vendor_marketplace');
    vi.stubEnv('NODE_ENV', 'production');

    expect(() => assertSafeTarget('end-to-end fixtures')).toThrow(
      /Refusing to seed end-to-end fixtures with NODE_ENV=production/,
    );
  });

  it('allows a local database, which is the only place these rows belong', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/vendor_marketplace_lane_317');
    vi.stubEnv('NODE_ENV', 'development');

    expect(() => assertSafeTarget('end-to-end fixtures')).not.toThrow();
  });

  it('refuses a Neon host whose branch cannot be identified', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://ep-x.us-east-2.aws.neon.tech/db');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEON_BRANCH', '');

    expect(() => assertSafeTarget('end-to-end fixtures')).toThrow(/unidentified branch/);
  });

  it.each(['production', 'main', 'master', 'Production'])(
    'refuses the %s branch on Neon',
    (branch) => {
      vi.stubEnv('DATABASE_URL', 'postgresql://ep-x.us-east-2.aws.neon.tech/db');
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEON_BRANCH', branch);

      expect(() => assertSafeTarget('end-to-end fixtures')).toThrow(
        new RegExp(`Refusing to seed end-to-end fixtures into the ${branch} branch`),
      );
    },
  );

  it('allows a named development branch on Neon', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://ep-x.us-east-2.aws.neon.tech/db');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEON_BRANCH', 'dev');

    expect(() => assertSafeTarget('end-to-end fixtures')).not.toThrow();
  });

  it('names the data it stopped, so the refusal says what was refused', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/vendor_marketplace');
    vi.stubEnv('NODE_ENV', 'production');

    expect(() => assertSafeTarget('demo marketing data')).toThrow(/demo marketing data/);
  });
});
