import { eq } from 'drizzle-orm';
import { supportCases, users } from '@vendor-marketplace/db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * The counted ways out of a filtered-empty case queue (#454).
 *
 * Pattern A of the admin delta: a filtered-empty list offers one widening per
 * filter, each carrying the rows it would reveal, **and never offers a route
 * that would reveal zero**. That last clause is what this file exists for.
 *
 * **The fixture is chosen so that one widening reveals zero**, which is the
 * only shape that can fail the requirement. A fixture where every route reveals
 * rows passes whatever the code does — the
 * `verify-with-a-differently-shaped-check` trap, and this is the acceptance
 * most likely to be faked by a happy one.
 *
 * The rows are inserted directly rather than driven through `/support/messages`
 * and the chargeback webhook: what is under test is a `count(*) filter (where
 * …)` aggregate over `support_cases`, and the shape of the fixture — how many
 * rows sit on each side of each filter — is the whole experiment.
 *
 * **References are real ones.** `adminCaseRowSchema` validates the shape
 * `ORL-XXXX-XX` over an alphabet with no `I`, `L`, `O`, `U`, `0` or `1`, and it
 * is the *response* schema — so a fixture reference of a convenient shape
 * serialises to a 500 rather than to a failed assertion, which is a confusing
 * way to spend twenty minutes.
 */

const ADMIN = 'user_admin_widenings';

describe('the counted filtered-empty routes on /admin/cases', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();

    harness.clerkUsers.set(ADMIN, {
      clerkUserId: ADMIN,
      email: `${ADMIN}@example.com`,
      firstName: 'Ops',
      lastName: 'Operator',
      roleHint: 'admin',
      avatarUrl: null,
    });

    await harness.app.inject({ method: 'GET', url: '/users/me', headers: bearer(ADMIN) });
    await harness.database.db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.clerkUserId, ADMIN));
  });

  afterAll(async () => {
    await harness.close();
  });

  /** A general question — no booking, which is what both filters turn on. */
  async function insertCase(reference: string, status: 'open' | 'resolved'): Promise<void> {
    await harness.database.db.insert(supportCases).values({
      reference,
      origin: 'support_message',
      status,
      topic: 'something-else',
      senderEmail: 'someone@example.com',
      message: 'A thing went wrong.',
      bookingId: null,
    });
  }

  async function readCases(query: string) {
    const response = await harness.app.inject({
      method: 'GET',
      url: `/admin/cases${query}`,
      headers: bearer(ADMIN),
    });
    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);

    return response.json() as { items: unknown[]; widenings: { key: string; count: number }[] };
  }

  /**
   * The empty platform: no rows at all, so **no widening exists**.
   *
   * This is the true-empty state the delta says carries no button — nothing an
   * operator does creates a case, so a control there would offer an action that
   * cannot help. The API is what lets the surface tell the two states apart.
   */
  it('offers no route at all when the queue is genuinely empty', async () => {
    const page = await readCases('');

    expect(page.items).toHaveLength(0);
    expect(page.widenings).toEqual([]);
  });

  /**
   * The asymmetric fixture, and the reason it is shaped this way.
   *
   * Four resolved cases, no open ones, **none linked to a booking**. From
   * `?status=resolved&booking=with`:
   *
   * - dropping `booking` reveals **4** — every resolved case, no longer
   *   required to have a booking;
   * - dropping `status` reveals **0** — the `booking=with` half is still held,
   *   and no case in the fixture has a booking at all.
   *
   * So exactly one route pays and the other must not be offered. With a fixture
   * where both paid, this assertion could not fail however the code behaved.
   */
  it('offers the route that pays and not the one that reveals nothing', async () => {
    for (const suffix of ['A2', 'A3', 'A4', 'A5']) {
      await insertCase(`ORL-WXYZ-${suffix}`, 'resolved');
    }

    const page = await readCases('?status=resolved&booking=with');

    expect(page.items).toHaveLength(0);
    expect(page.widenings).toEqual([{ key: 'booking', count: 4 }]);
  });

  /**
   * The other half, which the assertion above cannot reach: `status` is a real
   * route too.
   *
   * Without this, a `countCaseWidenings` that never counted `status` at all
   * would pass everything above. `?status=open` narrows by status alone — the
   * `booking` filter is not set, so it is not an active filter and must not be
   * offered as a way out of one.
   */
  it('counts the status route, and only the filters actually applied', async () => {
    const page = await readCases('?status=open');

    expect(page.items).toHaveLength(0);
    expect(page.widenings).toEqual([{ key: 'status', count: 4 }]);
  });

  /**
   * A page that has rows pays nothing for this.
   *
   * The scan is unfiltered by construction, so it is the one query on this
   * route that cannot use the filter's index — and it buys nothing at all on
   * the overwhelming majority of requests, which return rows.
   */
  it('counts nothing when the page has rows to show', async () => {
    const page = await readCases('?status=resolved');

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.widenings).toEqual([]);
  });
});
