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
 * These cover the paths that need no database.
 *
 * **The SQL itself is deliberately not covered here.** `packages/preflight` is a
 * leaf — nothing depends on it and it depends only on `packages/shared` — so it
 * cannot reach `@vendor-marketplace/db/testing` for a real engine without
 * inverting that. What stands in for a test is the shape of the failure: an
 * unknown column throws, the `catch` turns it into a `fail`, and every
 * `pnpm preflight` run before every ticket exercises it against a real
 * database. A schema drift therefore breaks loudly for the next person rather
 * than passing silently, which is the property that actually matters here.
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
});
