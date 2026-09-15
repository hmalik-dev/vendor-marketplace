import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertSafeTarget } from './safe-target.js';

/*
 * An empty root, so the Neon cases turn on `NEON_BRANCH` alone.
 * `.worktreeinclude` copies `.neon` into every worktree, so a test reading the
 * real repository root would pass or fail by accident depending on whether one
 * happened to be there.
 */
const EMPTY_ROOT = mkdtempSync(path.join(tmpdir(), 'safe-target-'));

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

    expect(() => assertSafeTarget('end-to-end fixtures', EMPTY_ROOT)).toThrow(
      /DATABASE_URL is not set/,
    );
  });

  /*
   * No escape hatch, deliberately — unlike preflight's branch check, which
   * permits the production branch when `NODE_ENV=production` because a
   * production process legitimately runs there. No seed does.
   */
  it('refuses under NODE_ENV=production even against a local host', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/vendor_marketplace');
    vi.stubEnv('NODE_ENV', 'production');

    expect(() => assertSafeTarget('end-to-end fixtures', EMPTY_ROOT)).toThrow(
      /Refusing to seed end-to-end fixtures with NODE_ENV=production/,
    );
  });

  it('allows a local database, which is the only place these rows belong', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/vendor_marketplace_lane_317');
    vi.stubEnv('NODE_ENV', 'development');

    expect(() => assertSafeTarget('end-to-end fixtures', EMPTY_ROOT)).not.toThrow();
  });

  it('refuses a Neon host whose branch cannot be identified', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://ep-x.us-east-2.aws.neon.tech/db');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEON_BRANCH', '');

    expect(() => assertSafeTarget('end-to-end fixtures', EMPTY_ROOT)).toThrow(
      /unidentified branch/,
    );
  });

  it.each(['production', 'main', 'master', 'Production'])(
    'refuses the %s branch on Neon',
    (branch) => {
      vi.stubEnv('DATABASE_URL', 'postgresql://ep-x.us-east-2.aws.neon.tech/db');
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEON_BRANCH', branch);

      expect(() => assertSafeTarget('end-to-end fixtures', EMPTY_ROOT)).toThrow(
        new RegExp(`Refusing to seed end-to-end fixtures into the ${branch} branch`),
      );
    },
  );

  it('allows a named development branch on Neon', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://ep-x.us-east-2.aws.neon.tech/db');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEON_BRANCH', 'dev');

    expect(() => assertSafeTarget('end-to-end fixtures', EMPTY_ROOT)).not.toThrow();
  });

  it.each([
    'postgresql://u@ep-x.us-east-2.aws.neon.tech/production',
    'postgresql://u@prod-db.internal:5432/app',
  ])('refuses a production-named target whatever branch is declared: %s', (url) => {
    vi.stubEnv('DATABASE_URL', url);
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEON_BRANCH', 'dev');

    expect(() => assertSafeTarget('end-to-end fixtures', EMPTY_ROOT)).toThrow(
      /Refusing to seed end-to-end fixtures into a production-named database/,
    );
  });

  it('allows a name that merely contains the letters, like "products"', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/products_catalogue');
    vi.stubEnv('NODE_ENV', 'development');

    expect(() => assertSafeTarget('end-to-end fixtures', EMPTY_ROOT)).not.toThrow();
  });

  /*
   * The restore drill writes into a server of its choosing rather than the one
   * `DATABASE_URL` names, so it hands the guard its own connection string and
   * its own branch variable — and `.neon`, which describes `DATABASE_URL`, must
   * not vouch for it.
   */
  describe('for a restore', () => {
    const restore = {
      action: 'restore',
      connectionVariable: 'RESTORE_DATABASE_URL',
      branchVariable: 'RESTORE_NEON_BRANCH',
    } as const;

    it('refuses the production branch on Neon', () => {
      vi.stubEnv('RESTORE_DATABASE_URL', 'postgresql://ep-x.us-east-2.aws.neon.tech/db');
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('RESTORE_NEON_BRANCH', 'production');

      expect(() => assertSafeTarget('a backup', EMPTY_ROOT, restore)).toThrow(
        /Refusing to restore a backup into the production branch \(from RESTORE_NEON_BRANCH\)/,
      );
    });

    it('refuses under NODE_ENV=production', () => {
      vi.stubEnv('RESTORE_DATABASE_URL', 'postgresql://localhost:5432/vendor_marketplace');
      vi.stubEnv('NODE_ENV', 'production');

      expect(() => assertSafeTarget('a backup', EMPTY_ROOT, restore)).toThrow(
        /Refusing to restore a backup with NODE_ENV=production/,
      );
    });

    it('does not read NEON_BRANCH, which describes DATABASE_URL instead', () => {
      vi.stubEnv('RESTORE_DATABASE_URL', 'postgresql://ep-x.us-east-2.aws.neon.tech/db');
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEON_BRANCH', 'dev');
      vi.stubEnv('RESTORE_NEON_BRANCH', '');

      expect(() => assertSafeTarget('a backup', EMPTY_ROOT, restore)).toThrow(
        /no branch is recorded in RESTORE_NEON_BRANCH/,
      );
    });

    it('names its own variable when the target is missing', () => {
      vi.stubEnv('RESTORE_DATABASE_URL', '');

      expect(() => assertSafeTarget('a backup', EMPTY_ROOT, restore)).toThrow(
        /RESTORE_DATABASE_URL is not set/,
      );
    });

    it('allows the local Docker server', () => {
      vi.stubEnv('RESTORE_DATABASE_URL', 'postgresql://localhost:5432/vendor_marketplace');
      vi.stubEnv('NODE_ENV', 'development');

      expect(() => assertSafeTarget('a backup', EMPTY_ROOT, restore)).not.toThrow();
    });
  });

  it('names the data it stopped, so the refusal says what was refused', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/vendor_marketplace');
    vi.stubEnv('NODE_ENV', 'production');

    expect(() => assertSafeTarget('demo marketing data', EMPTY_ROOT)).toThrow(
      /demo marketing data/,
    );
  });
});
