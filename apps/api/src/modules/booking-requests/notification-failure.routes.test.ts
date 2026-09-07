import {
  availability,
  bookingRequests,
  categories,
  conversations,
  notifications,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { addDays, toDateString } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import type * as MessagingDao from '../messaging/messaging.dao.js';

/**
 * **A notification that cannot be written must not undo the thing it announces.**
 *
 * `applyTransition` and `syncHeldDate` are one transaction and it has already
 * committed when `announce` runs. A throw there used to surface as an opaque
 * 500 on a request that was already `quoted`: the vendor saw a failure, the
 * customer got neither the in-app row nor the email, and the retry answered 409
 * `INVALID_STATE_TRANSITION` because the state really had moved — an
 * unrecoverable position reachable from one long business name (#408).
 *
 * The overflow that caused it is fixed by a wider column, and
 * `wire-bounds.routes.test.ts` pins that. This pins the general rule, by making
 * the write fail for a reason no column width can rule out.
 */
vi.mock('../messaging/messaging.dao.js', async () => {
  const actual = await vi.importActual<typeof MessagingDao>('../messaging/messaging.dao.js');

  return {
    ...actual,
    insertNotification: async (...args: Parameters<typeof actual.insertNotification>) =>
      failNotificationWrites
        ? Promise.reject(new Error('value too long for type character varying'))
        : actual.insertNotification(...args),
  };
});

/** Flipped per test; the mock above reads it on every call. */
let failNotificationWrites = false;

describe('a notification that cannot be written', () => {
  let harness: TestHarness;
  let photographyId: string;

  const VENDOR = 'user_notify_vendor';
  const CUSTOMER = 'user_notify_customer';
  const EVENT_DATE = toDateString(addDays(new Date(), 30));

  async function createVendorProfile(): Promise<string> {
    const profile = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography for people who hate posing.',
      },
    });
    expect(profile.statusCode, profile.body).toBe(201);
    const vendorId = profile.json().id as string;

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
      .where(eq(vendorProfiles.id, vendorId));

    return vendorId;
  }

  async function createRequest(vendorId: string): Promise<string> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/booking-requests',
      headers: bearer(CUSTOMER),
      payload: {
        vendorId,
        eventDate: EVENT_DATE,
        eventType: 'wedding',
        eventLocation: 'Barr Mansion, Austin, TX',
        customDetails: 'Full-day documentary coverage for about a hundred guests.',
      },
    });
    expect(created.statusCode, created.body).toBe(201);

    return created.json().id as string;
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role] of [
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email: `${clerkUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    const rows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = rows[0]!.id;
  });

  afterEach(async () => {
    failNotificationWrites = false;
    harness.email.sent.length = 0;
    harness.email.messageIdsByKey.clear();
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(availability);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('does not fail the quote it was announcing', async () => {
    const vendorId = await createVendorProfile();
    const requestId = await createRequest(vendorId);

    failNotificationWrites = true;

    const quoted = await harness.app.inject({
      method: 'POST',
      url: `/booking-requests/${requestId}/quote`,
      headers: bearer(VENDOR),
      payload: { quotedPriceCents: 145_000 },
    });

    expect(quoted.statusCode, quoted.body).toBe(200);
    expect(quoted.json().status).toBe('quoted');
    expect(quoted.json().quotedPriceCents).toBe(145_000);

    // And the transition it announced really did commit, once.
    const rows = await harness.database.db
      .select({ status: bookingRequests.status, quoted: bookingRequests.quotedPriceCents })
      .from(bookingRequests)
      .where(eq(bookingRequests.id, requestId));
    expect(rows).toEqual([{ status: 'quoted', quoted: 145_000 }]);
  });

  it('does not fail the message it was announcing, and does not lose the message', async () => {
    const vendorId = await createVendorProfile();
    const requestId = await createRequest(vendorId);

    const conversation = await harness.database.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.bookingRequestId, requestId));

    failNotificationWrites = true;

    const sent = await harness.app.inject({
      method: 'POST',
      url: `/conversations/${conversation[0]!.id}/messages`,
      headers: bearer(CUSTOMER),
      payload: { content: 'Are you free for a walkthrough the week before?' },
    });

    expect(sent.statusCode, sent.body).toBe(201);
    expect(sent.json().content).toBe('Are you free for a walkthrough the week before?');
  });

  /*
   * The other half of the contract: the email runs off the request path, so
   * nothing is sent by the time the route answers and everything is sent once
   * the queue drains. This is what stops a stalled Resend from holding the
   * customer's "Sending…" or the vendor's Accept button for minutes.
   */
  it('answers while its email is still in flight, and sends it afterwards', async () => {
    const vendorId = await createVendorProfile();

    /*
     * A send that never settles on its own is the only honest probe. Asserting
     * that `sent` is empty the instant `inject` resolves proves nothing — a
     * fast fake finishes inside the same microtask queue whether it was awaited
     * on the request path or not. Holding the gate open makes the difference
     * observable: before #408 this response could not arrive at all.
     */
    let openGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const realSend = harness.email.send;
    harness.email.send = async (message) => {
      await gate;
      return realSend(message);
    };

    const created = await harness.app.inject({
      method: 'POST',
      url: '/booking-requests',
      headers: bearer(CUSTOMER),
      payload: {
        vendorId,
        eventDate: EVENT_DATE,
        eventType: 'wedding',
        eventLocation: 'Barr Mansion, Austin, TX',
        customDetails: 'Full-day documentary coverage for about a hundred guests.',
      },
    });

    expect(created.statusCode, created.body).toBe(201);
    expect(harness.email.sent).toEqual([]);

    openGate();
    await harness.flushEmail();
    harness.email.send = realSend;

    expect(harness.email.sent).toHaveLength(1);
    expect(harness.email.sent[0]?.subject).toBe('New booking request');
  });
});
