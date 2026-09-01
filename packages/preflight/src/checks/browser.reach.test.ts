import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { describePayoutRoute, evaluateE2eReach } from './browser.js';

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

/**
 * #387 — the gate certified the one capability that did not work.
 *
 * `stripe_onboarded` was true beside `acct_e2e_fixture_not_a_real_account`, so
 * every run reported "and payouts" while `POST .../checkout` answered 400 and
 * the customer got a 404. A column is a claim; these are the evidence.
 */
describe('describePayoutRoute', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Stripe's v1 account read, stubbed — this suite makes no network call. */
  function stripeAnswers(status: number, body: unknown): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
    );
  }

  it('refuses an id Stripe could never resolve, without asking Stripe', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const route = await describePayoutRoute('acct_e2e_fixture_not_a_real_account', 'sk_test_key');

    expect(route).toEqual({
      ok: false,
      reason: expect.stringContaining('not an id Stripe can resolve'),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses a payout-ready vendor with no account id at all', async () => {
    const route = await describePayoutRoute(null, 'sk_test_key');

    expect(route).toEqual({
      ok: false,
      reason: expect.stringContaining('no connected account id'),
    });
  });

  it('fails when Stripe does not recognise the account', async () => {
    stripeAnswers(403, { error: { message: 'No such account' } });

    const route = await describePayoutRoute('acct_1Gone000000000000', 'sk_test_key');

    expect(route).toEqual({
      ok: false,
      reason: expect.stringContaining('checkout will answer 400'),
    });
  });

  /*
   * `transfers` is the exact capability `transfer_data.destination` requires,
   * so an account that exists but has not been activated still fails.
   */
  it('fails when Stripe has the account but transfers are inactive', async () => {
    stripeAnswers(200, { capabilities: { transfers: 'inactive' } });

    const route = await describePayoutRoute('acct_1Restricted00000', 'sk_test_key');

    expect(route).toEqual({
      ok: false,
      reason: expect.stringContaining('has not activated transfers'),
    });
  });

  it('passes and says so when Stripe accepts the account', async () => {
    stripeAnswers(200, { capabilities: { transfers: 'active' } });

    const route = await describePayoutRoute('acct_1Works00000000000', 'sk_test_key');

    expect(route).toEqual({
      ok: true,
      summary: 'payouts Stripe accepts through acct_1Works00000000000',
    });
  });
});
