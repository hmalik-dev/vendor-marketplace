import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateE2eReach } from './browser.js';

/**
 * The check exists because configured credentials are not the same thing as a
 * usable account. Signing in creates a `users` row and nothing else, so the
 * end-to-end vendor lands on an empty profile form and every `/vendor` route
 * redirects there — and a browser pass then reports the feature under test as
 * broken when the fixture is. It happened twice on 2026-08-30.
 *
 * These cover the paths that need no database. The reachable case is exercised
 * against a real engine by the `seedE2eFixtures` suite in `packages/db`, which
 * is what actually creates the rows this reads.
 */
describe('evaluateE2eReach', () => {
  function repoWith(contents: string): string {
    const root = mkdtempSync(path.join(tmpdir(), 'preflight-reach-'));
    writeFileSync(path.join(root, '.env.e2e.local'), contents, { mode: 0o600 });
    return root;
  }

  it('fails rather than warns when there is no database to ask', async () => {
    const result = await evaluateE2eReach(
      repoWith('E2E_VENDOR_EMAIL=vendor@example.com\n'),
      undefined,
    );

    expect(result.ok).toBe(false);
    expect(result.capability).toBe('e2e');
    expect(result.detail).toContain('DATABASE_URL');
  });

  it('names the seed command when the vendor email is absent', async () => {
    const result = await evaluateE2eReach(
      repoWith('E2E_CUSTOMER_EMAIL=c@example.com\n'),
      'postgres://x',
    );

    expect(result.ok).toBe(false);
    expect(result.fix).toBe('pnpm db:seed:e2e');
  });

  /*
   * An unreachable database must not be reported as a reachable account. The
   * fix line names the whole sequence, because a database that cannot be read
   * has usually not been migrated either.
   */
  it('fails when the database cannot be read', async () => {
    const result = await evaluateE2eReach(
      repoWith('E2E_VENDOR_EMAIL=vendor@example.com\n'),
      'postgresql://127.0.0.1:1/nope',
    );

    expect(result.ok).toBe(false);
    expect(result.fix).toContain('pnpm db:seed:e2e');
  });
});
