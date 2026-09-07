import { eq } from 'drizzle-orm';
import { legalAcceptances, users } from '@vendor-marketplace/db/schema';
import {
  CURRENT_TERMS_VERSION,
  legalDocumentSha256,
  type LegalAcceptanceMethod,
} from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * The Terms of Service acceptance gate — the first-sign-in interstitial's two
 * routes, and the refusal every other route gives until it is cleared.
 *
 * **This suite runs with `acceptTerms: false`**, unlike every other route
 * suite. The harness normally gives a registered identity an ordinary account —
 * one that exists and holds the current Terms — because that is what every
 * other suite means by "signed in". Here the un-accepted state *is* the
 * subject, so the harness must not clear it on the way in.
 */
describe('the Terms of Service acceptance gate', () => {
  let harness: TestHarness;

  const CUSTOMER = 'terms_customer';
  const VENDOR = 'terms_vendor';

  function status(user?: string) {
    return harness.app.inject({
      method: 'GET',
      url: '/legal/terms',
      ...(user ? { headers: bearer(user) } : {}),
    });
  }

  function accept(
    user: string | undefined,
    payload: Record<string, unknown> = { version: CURRENT_TERMS_VERSION, accepted: true },
    headers: Record<string, string> = {},
  ) {
    return harness.app.inject({
      method: 'POST',
      url: '/legal/terms/accept',
      headers: { ...(user ? bearer(user) : {}), ...headers },
      payload,
    });
  }

  function termsRows() {
    return harness.database.db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.document, 'terms_of_service'));
  }

  beforeAll(async () => {
    harness = await createTestHarness({ acceptTerms: false });

    for (const [id, role] of [
      [CUSTOMER, 'customer'],
      [VENDOR, 'vendor'],
    ] as const) {
      harness.clerkUsers.set(id, {
        clerkUserId: id,
        email: `${id}@example.com`,
        firstName: 'Ada',
        lastName: 'Reyes',
        roleHint: role,
        avatarUrl: null,
      });
    }
  });

  afterEach(async () => {
    // The acceptances go with the account: the table refuses a direct delete.
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('before the box is ticked', () => {
    /**
     * Acceptance 10, from the outside: the account does not exist yet. Nothing
     * in the product creates a `users` row except the acceptance itself, so
     * there is no window in which an account exists without one.
     */
    it('leaves no account row for a session that has not accepted', async () => {
      await status(CUSTOMER);

      expect(await harness.database.db.select().from(users)).toHaveLength(0);
    });

    it('reports the version and hash to accept, and that nothing is accepted', async () => {
      const response = await status(CUSTOMER);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        current: CURRENT_TERMS_VERSION,
        documentSha256: legalDocumentSha256('terms_of_service'),
        accepted: false,
        acceptedAt: null,
      });
    });

    it('refuses a caller with no session', async () => {
      expect((await status()).statusCode).toBe(401);
      expect((await accept(undefined)).statusCode).toBe(401);
    });

    /**
     * Acceptance 8, the half that matters: a gate that records nothing but
     * still lets you through is worse than no gate. Every other route refuses
     * the session, in both roles and at every layer of guard.
     */
    it('refuses every other route with TERMS_REQUIRED until it is accepted', async () => {
      for (const [method, url, user] of [
        ['GET', '/users/me', CUSTOMER],
        ['GET', '/vendor/agreement', VENDOR],
        ['GET', '/vendor/dashboard', VENDOR],
        ['GET', '/booking-requests', CUSTOMER],
      ] as const) {
        const response = await harness.app.inject({ method, url, headers: bearer(user) });

        /*
         * `TERMS_REQUIRED` and not `FORBIDDEN`: the two are both 403 and are
         * opposite instructions to the frontend — a `FORBIDDEN` sends the
         * reader to `/suspended`, which is terminal, while this is a gate they
         * clear in one click. Answering the gate with the plain code put every
         * new account on the suspended screen.
         */
        expect(
          { url, status: response.statusCode, error: response.json().error },
          `${method} ${url}`,
        ).toEqual({ url, status: 403, error: 'TERMS_REQUIRED' });
      }
    });
  });

  /**
   * `/support` is deliberately outside the gate — the person most likely to
   * need it is the one who cannot get through — so a gated caller reaches it
   * and meets the one refusal that surface can still give them.
   *
   * It must say which refusal. `request.auth` is null for two reasons now, and
   * `Sign in to report a problem with a booking` is the wrong one to show
   * somebody who is demonstrably signed in and stuck one tick away.
   */
  it('tells a gated caller reporting a booking which refusal it is', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/support/messages',
      headers: bearer(CUSTOMER),
      payload: {
        topic: 'booking-or-payment',
        message: 'The payout on my booking looks wrong and I cannot get past the Terms screen.',
        email: 'ada@example.com',
        bookingId: '33333333-3333-4333-8333-333333333333',
      },
    });

    expect({ status: response.statusCode, error: response.json().error }).toEqual({
      status: 403,
      error: 'TERMS_REQUIRED',
    });
  });

  /**
   * **The path production actually takes**, and the one every other test here
   * misses.
   *
   * Clerk fires `user.created` at sign-up, long before anybody ticks a box, so
   * by the time the accept arrives the `users` row usually already exists and
   * the request takes the "account is already there" branch rather than the
   * transaction. Nothing else in the suite reaches it: the first accept finds no
   * row, and the second returns early because the version is already held.
   *
   * Deleting that branch's insert leaves all 62 API suites green while every
   * real sign-up whose webhook landed first accepts, is told `accepted: false`,
   * and is returned to the gate for ever.
   */
  describe('when the webhook created the account first', () => {
    const WEBHOOK_USER = '99999999-9999-4999-8999-999999999999';

    beforeEach(async () => {
      await harness.database.db.insert(users).values({
        id: WEBHOOK_USER,
        clerkUserId: CUSTOMER,
        email: `${CUSTOMER}@example.com`,
        role: 'customer',
        firstName: 'Ada',
        lastName: 'Reyes',
      });
    });

    it('records the acceptance against the existing account, without a second one', async () => {
      const response = await accept(CUSTOMER);

      expect(response.statusCode).toBe(200);
      expect(response.json().accepted).toBe(true);

      const rows = await termsRows();

      expect(rows).toHaveLength(1);
      expect(rows[0]?.acceptedByUserId).toBe(WEBHOOK_USER);
      expect(await harness.database.db.select().from(users)).toHaveLength(1);
    });

    it('opens the rest of the product for that account', async () => {
      await accept(CUSTOMER);

      const response = await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer(CUSTOMER),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().id).toBe(WEBHOOK_USER);
    });

    /**
     * The gate's other untested branch: an account that exists **and holds an
     * acceptance**, just not of the version in force. That is the state every
     * account is in the moment `CURRENT_TERMS_VERSION` is raised, and it is what
     * makes acceptances 5 and 6 mean anything — without it the gate only ever
     * fires on "no row at all" and a version bump would re-gate nobody.
     */
    it('still gates an account whose only acceptance is a superseded version', async () => {
      await harness.database.db.insert(legalAcceptances).values({
        vendorId: null,
        document: 'terms_of_service',
        version: 'v0.9',
        documentSha256: 'b'.repeat(64),
        acceptanceMethod: 'clickwrap_checkbox',
        acceptedByUserId: WEBHOOK_USER,
        acceptedByName: 'Ada Reyes',
        businessName: null,
        ip: null,
        userAgent: null,
      });

      const refused = await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer(CUSTOMER),
      });

      expect({ status: refused.statusCode, error: refused.json().error }).toEqual({
        status: 403,
        error: 'TERMS_REQUIRED',
      });

      // And accepting the current version adds a row beside the old one.
      await accept(CUSTOMER);

      expect((await termsRows()).map((row) => row.version).sort()).toEqual(['v0.9', 'v1.0']);
    });
  });

  describe('POST /legal/terms/accept', () => {
    /**
     * Acceptances 1, 2, 10 and 11 in one row: the document, the version, the
     * hash, the method, no vendor and no business name, and the account that
     * did not exist a moment ago.
     */
    it('writes the account and one immutable row, in one act', async () => {
      const response = await accept(CUSTOMER);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        current: CURRENT_TERMS_VERSION,
        accepted: true,
      });
      expect(response.json().acceptedAt).not.toBeNull();

      const rows = await termsRows();
      const [row] = rows;

      expect(rows).toHaveLength(1);
      expect({
        document: row?.document,
        version: row?.version,
        sha: row?.documentSha256,
        method: row?.acceptanceMethod satisfies LegalAcceptanceMethod | undefined,
        vendorId: row?.vendorId,
        businessName: row?.businessName,
        acceptedByName: row?.acceptedByName,
      }).toEqual({
        document: 'terms_of_service',
        version: CURRENT_TERMS_VERSION,
        sha: legalDocumentSha256('terms_of_service'),
        method: 'clickwrap_checkbox',
        vendorId: null,
        businessName: null,
        acceptedByName: 'Ada Reyes',
      });
      expect(row?.acceptedAt).toBeInstanceOf(Date);

      const accounts = await harness.database.db.select().from(users);
      expect(accounts).toHaveLength(1);
      expect(accounts[0]?.id).toBe(row?.acceptedByUserId);
    });

    it('opens every other route once it is accepted', async () => {
      await accept(CUSTOMER);

      const response = await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer(CUSTOMER),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().email).toBe(`${CUSTOMER}@example.com`);
    });

    /**
     * Acceptance 8's other half, and the one a checkbox is worth nothing
     * without: an unticked box writes no row **and** opens no route. Asserted
     * on both, because either alone is a gate that only looks like one.
     */
    it('refuses a submission that does not carry the tick, and stays closed', async () => {
      const response = await accept(CUSTOMER, {
        version: CURRENT_TERMS_VERSION,
        accepted: false,
      });

      expect(response.statusCode).toBe(400);
      expect(await termsRows()).toHaveLength(0);
      expect(await harness.database.db.select().from(users)).toHaveLength(0);

      const after = await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer(CUSTOMER),
      });
      expect(after.statusCode).toBe(403);
    });

    /** A tab left open across a release must not record a version nobody read. */
    it('refuses a version that is not the one in force', async () => {
      const response = await accept(CUSTOMER, { version: 'v0.9', accepted: true });

      expect(response.statusCode).toBe(409);
      expect(await termsRows()).toHaveLength(0);
    });

    /**
     * Acceptance 5. Signing in again is not accepting again — the second visit
     * finds the row already there and answers instead of writing, which matters
     * because nothing can ever delete what it would have written.
     */
    it('writes one row however many times the account signs in', async () => {
      await accept(CUSTOMER);
      const second = await accept(CUSTOMER);

      expect(second.statusCode).toBe(200);
      expect(await termsRows()).toHaveLength(1);
    });

    /**
     * Acceptance 9. The address and the agent recorded are the ones on the
     * request that carried the tick, not on an earlier request in the same
     * flow — the whole reason those two columns exist, and quietly easy to lose
     * when the write moves to a different handler from the one submitted to.
     */
    it('records the address and agent from the submitting request, not an earlier one', async () => {
      await status(CUSTOMER);
      await harness.app.inject({
        method: 'GET',
        url: '/legal/terms',
        headers: { ...bearer(CUSTOMER), 'user-agent': 'EarlierBrowser/1.0' },
      });

      await accept(
        CUSTOMER,
        { version: CURRENT_TERMS_VERSION, accepted: true },
        {
          'user-agent': 'SubmittingBrowser/2.0',
        },
      );

      const [row] = await termsRows();

      expect(row?.userAgent).toBe('SubmittingBrowser/2.0');
    });

    /**
     * Acceptance 6. Raising the version adds a row rather than replacing one,
     * and the earlier row still answers "what did I agree to" — the question
     * the whole table exists for.
     */
    it('adds a row for a new version and leaves the earlier one standing', async () => {
      await accept(CUSTOMER);
      const [first] = await termsRows();

      await harness.database.db.insert(legalAcceptances).values({
        vendorId: null,
        document: 'terms_of_service',
        version: 'v2.0',
        documentSha256: 'a'.repeat(64),
        acceptanceMethod: 'clickwrap_checkbox',
        acceptedByUserId: first!.acceptedByUserId,
        acceptedByName: first!.acceptedByName,
        businessName: null,
        ip: null,
        userAgent: null,
      });

      const rows = await termsRows();

      expect(rows.map((row) => row.version).sort()).toEqual(['v1.0', 'v2.0']);
      expect(rows.find((row) => row.version === CURRENT_TERMS_VERSION)?.documentSha256).toBe(
        legalDocumentSha256('terms_of_service'),
      );
    });
  });
});
