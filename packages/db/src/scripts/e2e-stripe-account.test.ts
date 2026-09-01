import { describe, expect, it, vi } from 'vitest';
import {
  createStripeFixtureGateway,
  ensureE2eConnectedAccount,
  type E2eAccountStatus,
  type StripeFixtureGateway,
} from './e2e-stripe-account.js';

const ACTIVE: E2eAccountStatus = { transfersActive: true, payoutsActive: true };
const RESTRICTED: E2eAccountStatus = { transfersActive: false, payoutsActive: false };

const INPUT = {
  existingAccountId: null,
  contactEmail: 'vendor+clerk_test@example.com',
  displayName: 'E2E Test Studio',
  businessUrl: 'https://web-gules-eta-41.vercel.app',
};

/** The id the fake gateway mints, so a create is visible in an assertion. */
const PROVISIONED = 'acct_1Provisioned00000';

/**
 * A gateway that answers from a script, so no network and no key are needed.
 *
 * `readStatus` shifts one entry per call, which is what lets a test say "second
 * read is when Stripe finished activating it".
 */
function fakeGateway(statuses: (E2eAccountStatus | null)[]): {
  readStatus: ReturnType<typeof vi.fn>;
  createRecipientAccount: ReturnType<typeof vi.fn>;
  attachVerifiedBankAccount: ReturnType<typeof vi.fn>;
} & StripeFixtureGateway {
  const queue = [...statuses];

  return {
    readStatus: vi.fn(() => Promise.resolve(queue.shift() ?? null)),
    createRecipientAccount: vi.fn(() => Promise.resolve(PROVISIONED)),
    attachVerifiedBankAccount: vi.fn(() => Promise.resolve()),
  };
}

/** Never actually waits — the poll interval is 3s and this suite is not. */
const noWait = async (): Promise<void> => {};

describe('ensureE2eConnectedAccount', () => {
  it('reuses an account Stripe still reports as able to receive transfers', async () => {
    const gateway = fakeGateway([ACTIVE]);

    const result = await ensureE2eConnectedAccount(
      gateway,
      { ...INPUT, existingAccountId: 'acct_1UAgirFAZlrXdcC8' },
      noWait,
    );

    expect(result).toEqual({
      accountId: 'acct_1UAgirFAZlrXdcC8',
      onboarded: true,
      created: false,
    });
    expect(gateway.createRecipientAccount).not.toHaveBeenCalled();
  });

  /*
   * The reuse decision is made against Stripe, not against the column. A key
   * pointing at another instance, or an account someone deleted, has to fall
   * through to a fresh one rather than writing an id nothing can resolve.
   */
  it('provisions a new account when Stripe no longer has the stored one', async () => {
    const gateway = fakeGateway([null, ACTIVE]);

    const result = await ensureE2eConnectedAccount(
      gateway,
      { ...INPUT, existingAccountId: 'acct_1Gone000000000000' },
      noWait,
    );

    expect(result).toEqual({ accountId: PROVISIONED, onboarded: true, created: true });
    expect(gateway.attachVerifiedBankAccount).toHaveBeenCalledWith(PROVISIONED);
  });

  /*
   * Stripe decides, not a regex. An earlier cut skipped the lookup unless the
   * id matched `^acct_[A-Za-z0-9]+$`, which made a read-side heuristic decide a
   * *write*: an id Stripe would have recognised but the pattern did not — and
   * Stripe does not publish its charset as a contract (D29) — fell through to
   * provisioning and orphaned the account it named.
   */
  it('asks Stripe about a stored id rather than judging its shape', async () => {
    const gateway = fakeGateway([null, ACTIVE]);

    await ensureE2eConnectedAccount(
      gateway,
      { ...INPUT, existingAccountId: 'acct_e2e_fixture_not_a_real_account' },
      noWait,
    );

    expect(gateway.readStatus).toHaveBeenCalledWith('acct_e2e_fixture_not_a_real_account');
    // Stripe said no, so it is replaced — the decision Stripe made, not the regex.
    expect(gateway.createRecipientAccount).toHaveBeenCalledTimes(1);
  });

  /* An id Stripe *does* recognise is kept, whatever its shape. */
  it('keeps an unusually shaped id that Stripe still resolves', async () => {
    const gateway = fakeGateway([ACTIVE]);

    const result = await ensureE2eConnectedAccount(
      gateway,
      { ...INPUT, existingAccountId: 'acct_1Odd_Shape' },
      noWait,
    );

    expect(result).toEqual({ accountId: 'acct_1Odd_Shape', onboarded: true, created: false });
    expect(gateway.createRecipientAccount).not.toHaveBeenCalled();
  });

  /*
   * Stripe grants payouts a few seconds after the bank account lands, so a
   * single read would report a usable account as un-onboarded.
   */
  it('waits for the capabilities to come up before calling the account onboarded', async () => {
    const gateway = fakeGateway([
      RESTRICTED,
      { transfersActive: true, payoutsActive: false },
      ACTIVE,
    ]);

    const result = await ensureE2eConnectedAccount(gateway, INPUT, noWait);

    expect(result.onboarded).toBe(true);
    expect(gateway.readStatus).toHaveBeenCalledTimes(3);
  });

  /*
   * Giving up says so rather than guessing. The caller still writes the id — it
   * is what makes the next run converge — but not `stripe_onboarded`.
   */
  it('reports an account that never activates as not onboarded', async () => {
    const gateway = fakeGateway([]);

    const result = await ensureE2eConnectedAccount(gateway, INPUT, noWait);

    expect(result).toEqual({
      accountId: PROVISIONED,
      onboarded: false,
      created: true,
    });
  });

  /*
   * A stored account caught mid-activation. Without the wait it would be
   * reported un-onboarded on this run *and every run after it*, because reuse
   * short-circuits and nothing ever re-polls the account.
   */
  it('waits out a reused account whose payouts have not landed yet', async () => {
    const gateway = fakeGateway([{ transfersActive: true, payoutsActive: false }, ACTIVE]);

    const result = await ensureE2eConnectedAccount(
      gateway,
      { ...INPUT, existingAccountId: 'acct_1UAgirFAZlrXdcC8' },
      noWait,
    );

    expect(result).toEqual({
      accountId: 'acct_1UAgirFAZlrXdcC8',
      onboarded: true,
      created: false,
    });
    expect(gateway.createRecipientAccount).not.toHaveBeenCalled();
  });
});

describe('createStripeFixtureGateway', () => {
  /*
   * The only control on this path, and what it prevents is a script creating a
   * real connected account under a fabricated identity and accepting Stripe's
   * terms of service on that person's behalf. `assertSafeTarget` does not help:
   * it reads the database target, which says nothing about which Stripe
   * organisation the key belongs to.
   *
   * The keys here are truncated past their prefix on purpose, so neither the
   * repo's secret scan nor the credential hook has to carry an exemption for a
   * test fixture.
   */
  it.each(['sk_live_x', 'rk_live_x', 'not-a-key'])('refuses %s before reaching Stripe', (key) => {
    expect(() => createStripeFixtureGateway(key)).toThrow(/not a test-mode key/);
  });

  it('accepts a test-mode key', () => {
    expect(() => createStripeFixtureGateway('sk_test_x')).not.toThrow();
  });
});
