import { eq } from 'drizzle-orm';
import { users } from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const CUSTOMER = 'user_recheck_customer';

const KEEPALIVE_MS = 30_000;
const MINUTE_MS = 60_000;

/*
 * VEN-611: the keepalive stays on its 30 s clock while the account is re-read
 * on a five-minute one, so an idle tab stops costing a query per beat. The
 * heartbeat is driven by a faked `setInterval` and `Date` at the harness's
 * **default** intervals — a suite that passed its own short option would stay
 * green if the default went back to 30 s.
 */
describe('an open event stream re-reads its account every five minutes', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
    harness.authUsers.set(CUSTOMER, {
      authUserId: CUSTOMER,
      email: `${CUSTOMER}@example.com`,
      firstName: 'Recheck',
      lastName: 'Reader',
      roleHint: 'customer',
      avatarUrl: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await harness.close();
  });

  /** Lets the account read a beat started, which is real I/O, finish. */
  async function settle(): Promise<void> {
    for (let turn = 0; turn < 20; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  it('keeps beating for four minutes after a ban made elsewhere, and ends at the re-read', async () => {
    const ticket = await harness.app.inject({
      method: 'POST',
      url: '/v1/events/stream-ticket',
      headers: bearer(CUSTOMER),
    });
    expect(ticket.statusCode).toBe(200);
    const [row] = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, CUSTOMER));
    const id = row!.id;

    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const pending = harness.app.inject({
      method: 'GET',
      url: `/v1/events/stream?ticket=${ticket.json().ticket}`,
    });
    await vi.waitFor(() => expect(harness.app.events.countFor(id)).toBe(1), { interval: 5 });

    // The ban lands through the database only, as another instance's would.
    await harness.database.db
      .update(users)
      .set({ isBanned: true, bannedAt: new Date() })
      .where(eq(users.id, id));

    // Nine beats: four and a half minutes, and the old every-beat re-read would have ended it.
    for (let beat = 0; beat < 9; beat += 1) {
      vi.advanceTimersByTime(KEEPALIVE_MS);
      await settle();
    }
    expect(harness.app.events.countFor(id)).toBe(1);

    // Past five minutes the next beat re-reads the account, finds the ban and ends the stream.
    vi.advanceTimersByTime(MINUTE_MS + KEEPALIVE_MS);
    await settle();
    expect(harness.app.events.countFor(id)).toBe(0);

    const response = await pending;
    expect(response.statusCode).toBe(200);
    expect(response.body.match(/: heartbeat/g)?.length).toBeGreaterThanOrEqual(10);
  });
});
