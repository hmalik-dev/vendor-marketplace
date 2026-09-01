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
/** A second occasion with the same vendor, for the per-request thread checks. */
const SECOND_EVENT_DATE = toDateString(addDays(new Date(), 60));

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
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
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

  /**
   * A second request to the vendor `openConversation` already published, so the
   * customer has two live bookings with one vendor — the shape #346 is about.
   */
  async function requestAgain(): Promise<string> {
    const vendor = await harness.database.db.select().from(vendorProfiles);
    const pkg = await harness.database.db.select().from(servicePackages);

    const request = await harness.app.inject({
      method: 'POST',
      url: '/booking-requests',
      headers: bearer(CUSTOMER),
      payload: {
        vendorId: vendor[0]!.id,
        packageId: pkg[0]!.id,
        eventDate: SECOND_EVENT_DATE,
        eventType: 'fundraiser',
      },
    });
    expect(request.statusCode).toBe(201);

    const threads = await harness.database.db.select().from(conversations);
    const opened = threads.find((row) => row.bookingRequestId === request.json().id);
    expect(opened).toBeDefined();

    return opened!.id;
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

    /*
     * `ensureConversation` opens a thread with every booking request and leaves
     * `last_message_at` null until someone writes, and Postgres sorts nulls
     * **first** under `DESC`. So the plain `desc(lastMessageAt)` ordering led
     * with every unused thread and pushed the live ones down.
     *
     * On this endpoint that was cosmetic, because the whole list renders. Frame
     * `07`'s bookings rail draws the first three, so it became lost data: three
     * rows reading "No messages yet." above a reply that arrived an hour ago.
     */
    it('leads with the thread that actually has a message, not the empty ones', async () => {
      const conversationId = await openConversation();
      await send(CUSTOMER, conversationId, 'Are you free that weekend?');

      // A second, never-used thread between the same pair — the shape
      // `Send a message` leaves behind, and the row that used to sort first.
      const [pair] = await harness.database.db
        .select({ customerId: conversations.customerId, vendorId: conversations.vendorId })
        .from(conversations);
      expect(pair).toBeDefined();
      await harness.database.db.insert(conversations).values({
        customerId: pair!.customerId,
        vendorId: pair!.vendorId,
        bookingRequestId: null,
        lastMessageAt: null,
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/conversations',
        headers: bearer(CUSTOMER),
      });

      const threads = response.json() as { id: string; lastMessagePreview: string | null }[];
      expect(threads).toHaveLength(2);
      expect(threads[0]?.id).toBe(conversationId);
      expect(threads[0]?.lastMessagePreview).toBe('Are you free that weekend?');
      expect(threads[1]?.lastMessagePreview).toBeNull();
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

    /*
     * #346. The model was one thread per *vendor*, subtitled with whichever
     * request happened to come first, so a question about the fundraiser was
     * read by the vendor under the wedding's heading. Two requests to one
     * vendor are two threads, and the context line is what tells them apart —
     * the vendor's business name is identical on both rows.
     */
    it('gives a second request to the same vendor its own thread and context line', async () => {
      const wedding = await openConversation();
      const fundraiser = await requestAgain();

      expect(fundraiser).not.toBe(wedding);

      for (const actor of [CUSTOMER, VENDOR]) {
        const list = await harness.app.inject({
          method: 'GET',
          url: '/conversations',
          headers: bearer(actor),
        });

        expect(list.statusCode).toBe(200);
        expect(list.json()).toHaveLength(2);

        const contexts = list
          .json()
          .map((row: { bookingContext: string | null }) => row.bookingContext);

        expect(new Set(contexts).size).toBe(2);
        expect(contexts).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/wedding$/),
            expect.stringMatching(/fundraiser$/),
          ]),
        );
      }
    });

    /*
     * The half of #346 that actually loses information: a message has to be
     * readable against the booking it was sent from, from both sides.
     */
    it('keeps a message in the thread of the booking it was sent from', async () => {
      const wedding = await openConversation();
      const fundraiser = await requestAgain();

      expect((await send(CUSTOMER, fundraiser, 'Is the raffle table extra?')).statusCode).toBe(201);

      for (const actor of [CUSTOMER, VENDOR]) {
        const inFundraiser = await harness.app.inject({
          method: 'GET',
          url: `/conversations/${fundraiser}/messages`,
          headers: bearer(actor),
        });
        const inWedding = await harness.app.inject({
          method: 'GET',
          url: `/conversations/${wedding}/messages`,
          headers: bearer(actor),
        });

        expect(inFundraiser.json().items.map((item: { content: string }) => item.content)).toEqual([
          'Is the raffle table extra?',
        ]);
        expect(inWedding.json().items).toEqual([]);
      }
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

  /*
   * #219: `Send a message` on a vendor's profile was permanently disabled,
   * because `/messages` could only open a thread that already existed. This is
   * the endpoint that gave it one to open.
   */
  describe('opening a thread from a profile', () => {
    /** Publishes a vendor and returns the slug a customer would be reading. */
    async function publishedVendor(): Promise<string> {
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

      await harness.database.db
        .update(vendorProfiles)
        .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
        .where(eq(vendorProfiles.id, profile.json().id));

      return profile.json().slug;
    }

    async function open(
      actor: string,
      vendorSlug: string,
    ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
      return harness.app.inject({
        method: 'POST',
        url: '/conversations',
        headers: bearer(actor),
        payload: { vendorSlug },
      });
    }

    it('opens a thread the customer can then read', async () => {
      const slug = await publishedVendor();

      const opened = await open(CUSTOMER, slug);

      expect(opened.statusCode).toBe(201);
      expect(opened.headers.location).toBe(`/conversations/${opened.json().id}`);

      const thread = await harness.app.inject({
        method: 'GET',
        url: `/conversations/${opened.json().id}/messages`,
        headers: bearer(CUSTOMER),
      });

      expect(thread.statusCode).toBe(200);
      expect(thread.json().items).toEqual([]);
    });

    /*
     * The button is safe to press twice. Without the partial unique index a
     * `NULL` booking request is distinct from every other `NULL`, so each click
     * would open another empty thread with the same vendor.
     */
    it('returns the same thread on a second press, and answers 200', async () => {
      const slug = await publishedVendor();

      const first = await open(CUSTOMER, slug);
      const again = await open(CUSTOMER, slug);

      expect(first.statusCode).toBe(201);
      expect(again.statusCode).toBe(200);
      expect(again.json().id).toBe(first.json().id);

      const threads = await harness.database.db.select().from(conversations);
      expect(threads).toHaveLength(1);
      expect(threads[0]!.bookingRequestId).toBeNull();
    });

    /*
     * The unattached thread and a request's own thread are different threads:
     * the rail is headed **This request**, and the one opened from the profile
     * has no request to show.
     */
    it('leaves a later request its own thread beside the unattached one', async () => {
      const conversationId = await openConversation();
      const vendor = await harness.database.db.select().from(vendorProfiles);

      const opened = await open(CUSTOMER, vendor[0]!.slug);

      expect(opened.statusCode).toBe(201);
      expect(opened.json().id).not.toBe(conversationId);

      const list = await harness.app.inject({
        method: 'GET',
        url: '/conversations',
        headers: bearer(CUSTOMER),
      });

      expect(list.json()).toHaveLength(2);
      expect(
        list.json().map((row: { bookingContext: string | null }) => row.bookingContext),
      ).toEqual(expect.arrayContaining([null, expect.stringMatching(/wedding$/)]));
    });

    it('refuses a vendor messaging their own listing', async () => {
      const slug = await publishedVendor();

      expect((await open(VENDOR, slug)).statusCode).toBe(403);
    });

    it('will not open a thread with an unpublished vendor', async () => {
      const slug = await publishedVendor();
      await harness.database.db.update(vendorProfiles).set({ isPublished: false });

      expect((await open(CUSTOMER, slug)).statusCode).toBe(404);
    });

    it('rejects an unauthenticated open', async () => {
      const slug = await publishedVendor();

      const response = await harness.app.inject({
        method: 'POST',
        url: '/conversations',
        payload: { vendorSlug: slug },
      });

      expect(response.statusCode).toBe(401);
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

    /*
     * #229: a message pushed live to an open stream and nothing else, so a
     * reply that arrived while the tab was closed left no trace at all. The row
     * is what is asserted here, not the push — the push is best-effort and the
     * row is the source of truth.
     */
    it('raises a notification for the recipient, in both directions', async () => {
      const conversationId = await openConversation();
      const vendorId = await idOf(VENDOR);
      const customerId = await idOf(CUSTOMER);

      await send(CUSTOMER, conversationId, 'Are you free that weekend?');
      await harness.app.inject({
        method: 'PUT',
        url: `/conversations/${conversationId}/read`,
        headers: bearer(VENDOR),
      });
      await send(VENDOR, conversationId, 'I am — let me put a quote together.');

      const rows = await harness.database.db
        .select()
        .from(notifications)
        .where(eq(notifications.type, 'new_message'));

      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.userId).sort()).toEqual([vendorId, customerId].sort());
      // Each party is named to the other the way the thread list names them.
      expect(rows.find((row) => row.userId === vendorId)?.body).toBe(
        'Test U sent you a message. Open the thread to reply.',
      );
      expect(rows.find((row) => row.userId === customerId)?.body).toBe(
        'Sunlit Studio sent you a message. Open the thread to reply.',
      );
    });

    it('points the notification straight at the thread', async () => {
      const conversationId = await openConversation();
      await send(CUSTOMER, conversationId, 'Are you free that weekend?');

      const response = await harness.app.inject({
        method: 'GET',
        url: '/notifications',
        headers: bearer(VENDOR),
      });

      const message = response
        .json()
        .items.find((item: { type: string }) => item.type === 'new_message');

      expect(message.title).toBe('New message');
      expect(message.href).toBe(`/messages?conversation=${conversationId}`);
    });

    /*
     * One row per unread run. Thirty messages in a back-and-forth are one thing
     * to be told about, and thirty rows would bury every other notification in
     * the panel under a conversation the reader can already see.
     */
    it('raises one notification per unread run, not one per message', async () => {
      const conversationId = await openConversation();

      await send(CUSTOMER, conversationId, 'Are you free that weekend?');
      await send(CUSTOMER, conversationId, 'Also, do you travel?');
      await send(CUSTOMER, conversationId, 'Sorry — one more.');

      const unread = await harness.database.db
        .select()
        .from(notifications)
        .where(eq(notifications.type, 'new_message'));
      expect(unread).toHaveLength(1);

      // Once they have read the thread, the next message is news again.
      await harness.app.inject({
        method: 'PUT',
        url: `/conversations/${conversationId}/read`,
        headers: bearer(VENDOR),
      });
      await send(CUSTOMER, conversationId, 'Thought of something else.');

      const after = await harness.database.db
        .select()
        .from(notifications)
        .where(eq(notifications.type, 'new_message'));
      expect(after).toHaveLength(2);
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
