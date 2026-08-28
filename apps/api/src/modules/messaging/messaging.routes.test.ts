import {
  availability,
  bookingRequests,
  bookings,
  categories,
  conversations,
  messages,
  notifications,
  servicePackages,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { MESSAGE_MAX_LENGTH, addDays, toDateString } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const VENDOR = 'user_vendor';
const CUSTOMER = 'user_customer';
const OUTSIDER = 'user_customer_two';

const EVENT_DATE = toDateString(addDays(new Date(), 30));

describe('messaging', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function idOf(clerkUserId: string): Promise<string> {
    const me = await harness.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: bearer(clerkUserId),
    });
    expect(me.statusCode).toBe(200);

    return me.json().id;
  }

  /** A published vendor, a package, and one request — which opens the thread. */
  async function openConversation(): Promise<string> {
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
    expect(profile.statusCode).toBe(201);
    const vendorId: string = profile.json().id;

    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/packages',
      headers: bearer(VENDOR),
      payload: {
        name: 'Full day coverage',
        description: 'Six hours of coverage with two photographers on site.',
        priceCents: 145_000,
        priceType: 'fixed',
        inclusions: ['6 hours'],
      },
    });

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true })
      .where(eq(vendorProfiles.id, vendorId));

    const request = await harness.app.inject({
      method: 'POST',
      url: '/booking-requests',
      headers: bearer(CUSTOMER),
      payload: {
        vendorId,
        packageId: created.json().id,
        eventDate: EVENT_DATE,
        eventType: 'wedding',
      },
    });
    expect(request.statusCode).toBe(201);

    const threads = await harness.database.db.select().from(conversations);
    return threads[0]!.id;
  }

  async function send(
    actor: string,
    conversationId: string,
    content: string,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness.app.inject({
      method: 'POST',
      url: `/conversations/${conversationId}/messages`,
      headers: bearer(actor),
      payload: { content },
    });
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
      [OUTSIDER, 'customer', 'edsger@example.com'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email,
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
    await harness.database.db.delete(messages);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(availability);
    await harness.database.db.delete(servicePackages);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('access', () => {
    it('rejects an unauthenticated conversation list', async () => {
      const response = await harness.app.inject({ method: 'GET', url: '/conversations' });

      expect(response.statusCode).toBe(401);
    });

    it('refuses a non-participant on every conversation route', async () => {
      const conversationId = await openConversation();

      for (const [method, url] of [
        ['GET', `/conversations/${conversationId}/messages`],
        ['PUT', `/conversations/${conversationId}/read`],
      ] as const) {
        const response = await harness.app.inject({
          method,
          url,
          headers: bearer(OUTSIDER),
        });

        expect(response.statusCode).toBe(403);
      }

      expect((await send(OUTSIDER, conversationId, 'Let me in')).statusCode).toBe(403);
    });

    it('does not list a conversation the caller is not in', async () => {
      await openConversation();

      const response = await harness.app.inject({
        method: 'GET',
        url: '/conversations',
        headers: bearer(OUTSIDER),
      });

      expect(response.json()).toEqual([]);
    });
  });

  describe('conversations', () => {
    /*
     * The thread is opened by the booking request, so it exists before anyone
     * has said anything — the list has to render that rather than hide it.
     */
    it('lists a thread with no messages yet', async () => {
      await openConversation();

      const response = await harness.app.inject({
        method: 'GET',
        url: '/conversations',
        headers: bearer(CUSTOMER),
      });

      expect(response.statusCode).toBe(200);
      const [thread] = response.json();
      expect(thread.lastMessagePreview).toBeNull();
      expect(thread.unreadCount).toBe(0);
    });

    it('shows each party the other one', async () => {
      const conversationId = await openConversation();
      await send(CUSTOMER, conversationId, 'Are you free that weekend?');

      const asCustomer = await harness.app.inject({
        method: 'GET',
        url: '/conversations',
        headers: bearer(CUSTOMER),
      });
      const asVendor = await harness.app.inject({
        method: 'GET',
        url: '/conversations',
        headers: bearer(VENDOR),
      });

      expect(asCustomer.json()[0].otherPartyName).toBe('Sunlit Studio');
      // First name and one initial — never the full name before acceptance.
      expect(asVendor.json()[0].otherPartyName).toBe('Test U');
    });

    /* The line that makes a list of names navigable. */
    it('carries the booking context line from the linked request', async () => {
      await openConversation();

      const response = await harness.app.inject({
        method: 'GET',
        url: '/conversations',
        headers: bearer(CUSTOMER),
      });

      expect(response.json()[0].bookingContext).toMatch(/^[A-Z][a-z]{2} \d{1,2} wedding$/);
    });

    it('counts only what the other party sent as unread', async () => {
      const conversationId = await openConversation();
      await send(CUSTOMER, conversationId, 'Are you free that weekend?');

      const own = await harness.app.inject({
        method: 'GET',
        url: '/conversations',
        headers: bearer(CUSTOMER),
      });
      const theirs = await harness.app.inject({
        method: 'GET',
        url: '/conversations',
        headers: bearer(VENDOR),
      });

      // The sender's own message is not unread to them.
      expect(own.json()[0].unreadCount).toBe(0);
      expect(theirs.json()[0].unreadCount).toBe(1);
    });

    it('clears the unread count when the thread is opened', async () => {
      const conversationId = await openConversation();
      await send(CUSTOMER, conversationId, 'Are you free that weekend?');

      const read = await harness.app.inject({
        method: 'PUT',
        url: `/conversations/${conversationId}/read`,
        headers: bearer(VENDOR),
      });
      expect(read.statusCode).toBe(204);

      const after = await harness.app.inject({
        method: 'GET',
        url: '/conversations',
        headers: bearer(VENDOR),
      });
      expect(after.json()[0].unreadCount).toBe(0);
    });
  });

  describe('messages', () => {
    it('returns a thread oldest first — a thread is read downwards', async () => {
      const conversationId = await openConversation();
      await send(CUSTOMER, conversationId, 'First');
      await send(VENDOR, conversationId, 'Second');

      const response = await harness.app.inject({
        method: 'GET',
        url: `/conversations/${conversationId}/messages`,
        headers: bearer(CUSTOMER),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().items.map((row: { content: string }) => row.content)).toEqual([
        'First',
        'Second',
      ]);
      expect(response.json().total).toBe(2);
    });

    it('refuses a message past the length ceiling', async () => {
      const conversationId = await openConversation();

      const response = await send(CUSTOMER, conversationId, 'x'.repeat(MESSAGE_MAX_LENGTH + 1));

      expect(response.statusCode).toBe(400);
    });

    it('refuses a whitespace-only message', async () => {
      const conversationId = await openConversation();

      expect((await send(CUSTOMER, conversationId, '   \n ')).statusCode).toBe(400);
    });

    it('stores the text exactly, leaving escaping to the renderer', async () => {
      const conversationId = await openConversation();
      const xss = '<script>alert(1)</script>';

      const response = await send(CUSTOMER, conversationId, xss);

      expect(response.statusCode).toBe(201);
      expect(response.json().content).toBe(xss);
    });

    it('moves the thread to the top of the list when a message lands', async () => {
      const conversationId = await openConversation();

      const before = await harness.app.inject({
        method: 'GET',
        url: '/conversations',
        headers: bearer(CUSTOMER),
      });
      expect(before.json()[0].lastMessageAt).toBeNull();

      await send(CUSTOMER, conversationId, 'Are you free that weekend?');

      const after = await harness.app.inject({
        method: 'GET',
        url: '/conversations',
        headers: bearer(CUSTOMER),
      });
      expect(after.json()[0].lastMessageAt).not.toBeNull();
      expect(after.json()[0].lastMessagePreview).toBe('Are you free that weekend?');
    });
  });

  describe('notifications', () => {
    it('lists the caller own notifications, newest first', async () => {
      await openConversation();

      const response = await harness.app.inject({
        method: 'GET',
        url: '/notifications',
        headers: bearer(VENDOR),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().items[0].title).toBe('New booking request');
      // A person reads this, so the date is written out rather than stored form.
      expect(response.json().items[0].body).toMatch(/asked about [A-Z][a-z]+ \d{1,2}\./);
      expect(response.json().items[0].body).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      // Resolved here rather than in the client, which should not have to know
      // how an id becomes a route.
      expect(response.json().items[0].href).toBe('/vendor/dashboard');
    });

    it('does not leak another user notifications', async () => {
      await openConversation();

      const response = await harness.app.inject({
        method: 'GET',
        url: '/notifications',
        headers: bearer(OUTSIDER),
      });

      expect(response.json().items).toEqual([]);
    });

    it('marks one read, and leaves the rest alone', async () => {
      await openConversation();
      const list = await harness.app.inject({
        method: 'GET',
        url: '/notifications',
        headers: bearer(VENDOR),
      });
      const first = list.json().items[0];

      const marked = await harness.app.inject({
        method: 'PUT',
        url: `/notifications/${first.id}/read`,
        headers: bearer(VENDOR),
      });
      expect(marked.statusCode).toBe(204);

      const after = await harness.app.inject({
        method: 'GET',
        url: '/notifications',
        headers: bearer(VENDOR),
      });
      expect(after.json().items[0].readAt).not.toBeNull();
    });

    /* Scoped in the query, so somebody else's id marks nothing. */
    it('cannot mark a notification belonging to another user', async () => {
      await openConversation();
      const list = await harness.app.inject({
        method: 'GET',
        url: '/notifications',
        headers: bearer(VENDOR),
      });
      const first = list.json().items[0];

      await harness.app.inject({
        method: 'PUT',
        url: `/notifications/${first.id}/read`,
        headers: bearer(OUTSIDER),
      });

      const after = await harness.app.inject({
        method: 'GET',
        url: '/notifications',
        headers: bearer(VENDOR),
      });
      expect(after.json().items[0].readAt).toBeNull();
    });

    it('marks everything read at once', async () => {
      await openConversation();

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/notifications/read-all',
        headers: bearer(VENDOR),
      });
      expect(response.statusCode).toBe(204);

      const after = await harness.app.inject({
        method: 'GET',
        url: '/notifications',
        headers: bearer(VENDOR),
      });
      expect(after.json().items.every((row: { readAt: string | null }) => row.readAt)).toBe(true);
    });
  });

  describe('the event hub', () => {
    /*
     * Both parties, not just the recipient: the sender may have the thread open
     * in another tab, and a message appearing in one tab but not the other is
     * what makes people stop trusting a live surface.
     */
    it('publishes a new message to both participants', async () => {
      const conversationId = await openConversation();
      const delivered: { userId: string; type: string }[] = [];

      const original = harness.app.events.publish.bind(harness.app.events);
      harness.app.events.publish = (userId, event) => {
        delivered.push({ userId, type: event.type });
        original(userId, event);
      };

      await send(CUSTOMER, conversationId, 'Are you free that weekend?');

      const customerId = await idOf(CUSTOMER);
      const vendorUserId = await idOf(VENDOR);

      expect(
        delivered
          .filter((entry) => entry.type === 'new_message')
          .map((e) => e.userId)
          .sort(),
      ).toEqual([customerId, vendorUserId].sort());

      harness.app.events.publish = original;
    });

    it('holds one entry per open connection, and drops it on unsubscribe', () => {
      const fake = { write: () => true, end: () => undefined } as never;

      const stop = harness.app.events.subscribe('user-1', fake);
      expect(harness.app.events.countFor('user-1')).toBe(1);

      stop();
      expect(harness.app.events.countFor('user-1')).toBe(0);
    });
  });
});
