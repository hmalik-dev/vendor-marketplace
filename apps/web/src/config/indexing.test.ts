import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchIndexed } from './indexing';

/*
 * VEN-606: only production may be indexed, and a tier nobody named is not
 * production — a missing value must mean noindex, never index.
 */
describe('searchIndexed', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('indexes production', () => {
    expect(searchIndexed('production')).toBe(true);
  });

  it.each([['staging'], ['local'], [''], ['Production'], [' production'], [undefined]])(
    'does not index %j',
    (tier) => {
      expect(searchIndexed(tier)).toBe(false);
    },
  );

  it('reads the tier next.config.ts inlined when called with no argument', () => {
    vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', 'production');
    expect(searchIndexed()).toBe(true);

    vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', 'staging');
    expect(searchIndexed()).toBe(false);
  });
});
