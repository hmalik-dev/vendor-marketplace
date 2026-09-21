import { eq } from 'drizzle-orm';
import { users } from '@vendor-marketplace/db/schema';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MAX_STREAMS_PER_USER } from '../../lib/event-stream.js';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const CUSTOMER = 'user_limits_customer';
const OTHER = 'user_limits_other';

/** A short beat, so "within one heartbeat" is waited for rather than assumed. */
const HEARTBEAT_MS = 40;

function register(harness: TestHarness, authUserId: string): void {
  harness.authUsers.set(authUserId, {
    authUserId,
    email: `${authUserId}@example.com`,
    firstName: 'Limits',
    lastName: 'Reader',
    roleHint: 'customer',
    avatarUrl: null,
  });
}

describe('an open event stream, across instances and abuse', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness({ streamHeartbeatMs: HEARTBEAT_MS });
    register(harness, CUSTOMER);
    register(harness, OTHER);
  });

  afterAll(async () => {
    await harness.close();
  });

  async function ticketFor(authUserId: string): Promise<string> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/events/stream-ticket',
      headers: bearer(authUserId),
    });

    expect(response.statusCode).toBe(200);

    return response.json().ticket;
  }

  async function userId(authUserId: string): Promise<string> {
    const [row] = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, authUserId));

    return row!.id;
  }

  /** Opens a stream and resolves once it is subscribed. */
  async function openStream(authUserId: string) {
    // The ticket first: the account row is provisioned by the first guarded call.
    const ticket = await ticketFor(authUserId);
    const id = await userId(authUserId);
    const before = harness.app.events.countFor(id);
    const pending = harness.app.inject({ method: 'GET', url: `/events/stream?ticket=${ticket}` });

    await vi.waitFor(() => expect(harness.app.events.countFor(id)).toBe(before + 1));

    return { id, pending };
  }

  it('refuses the stream after the cap with a 429, and only for that user', async () => {
    const opened = [];
    for (let i = 0; i < MAX_STREAMS_PER_USER; i += 1) {
      opened.push(await openStream(OTHER));
    }

    const refused = await harness.app.inject({
      method: 'GET',
      url: `/events/stream?ticket=${await ticketFor(OTHER)}`,
    });

    expect(refused.statusCode).toBe(429);
    expect(refused.json()).toMatchObject({ error: 'RATE_LIMITED' });
    expect(harness.app.events.countFor(opened[0]!.id)).toBe(MAX_STREAMS_PER_USER);

    // Somebody else is not affected, and a closed tab frees a slot.
    const other = await openStream(CUSTOMER);
    expect(harness.app.events.countFor(other.id)).toBe(1);

    harness.app.events.closeFor(opened[0]!.id);
    await Promise.all(opened.map((stream) => stream.pending));
    harness.app.events.closeFor(other.id);
    await other.pending;

    const reopened = await openStream(OTHER);
    expect(harness.app.events.countFor(reopened.id)).toBe(1);
    harness.app.events.closeFor(reopened.id);
    await reopened.pending;
  });

  /*
   * The ban lands through the database only — what another API instance does —
   * so `EventHub.closeFor` on this one never runs, and the heartbeat's re-read
   * is the only thing that can end the stream.
   */
  it.each([
    ['a ban', { isBanned: true, bannedAt: new Date() }],
    ['a deletion', { deletedAt: new Date() }],
  ])('ends an open stream within a heartbeat of %s made elsewhere', async (_label, change) => {
    const { id, pending } = await openStream(CUSTOMER);

    await harness.database.db.update(users).set(change).where(eq(users.id, id));

    const response = await pending;
    expect(response.statusCode).toBe(200);
    expect(harness.app.events.countFor(id)).toBe(0);

    // Nothing sent after the stream ended reaches the body or a new subscriber.
    harness.app.events.publish(id, { type: 'new_notification', notification: { late: true } });
    expect(response.body).not.toContain('late');

    await harness.database.db
      .update(users)
      .set({ isBanned: false, bannedAt: null, deletedAt: null })
      .where(eq(users.id, id));
  });

  it('keeps a stream open while the account is healthy', async () => {
    const { id, pending } = await openStream(CUSTOMER);

    await new Promise((resolve) => setTimeout(resolve, HEARTBEAT_MS * 4));
    expect(harness.app.events.countFor(id)).toBe(1);

    harness.app.events.closeFor(id);
    const response = await pending;
    expect(response.body).toContain(': heartbeat');
  });
});
