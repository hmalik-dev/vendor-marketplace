import {
  bookingRequests,
  bookings,
  categories,
  notifications,
  reviews,
  users,
  vendorCategories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

const ADMIN = 'user_admin_customer_detail';
const VENDOR = 'user_vendor_customer_detail';
const CUSTOMER = 'user_customer_customer_detail';
const OTHER = 'user_other_customer_detail';

const NOW = new Date('2026-10-01T12:00:00.000Z');
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

/** `GET /admin/customers/:userId` (VEN-400). */
describe('admin customer detail', () => {
  let harness: TestHarness;
  let photographyId: string;

  interface Parties {
    customerId: string;
    otherId: string;
    vendorId: string;
    vendorUserId: string;
  }

  async function seedParties(): Promise<Parties> {
    await signInAs(harness, ADMIN, true);
    const customerId = await signInAs(harness, CUSTOMER);
    const otherId = await signInAs(harness, OTHER);
    await signInAs(harness, VENDOR);

    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Fernbank Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Fernbank Studio photographs weddings across central Texas.',
      },
    });
    expect(created.statusCode).toBe(201);

    return {
      customerId,
      otherId,
      vendorId: created.json().id as string,
      vendorUserId: created.json().userId as string,
    };
  }

  async function seedBooking(
    parties: Parties,
    customerId: string,
    eventDate: string,
    status: 'confirmed' | 'completed' | 'cancelled',
  ): Promise<string> {
    const db = harness.database.db;
    const [request] = await db
      .insert(bookingRequests)
      .values({ customerId, vendorId: parties.vendorId, eventDate, status: 'accepted' })
      .returning({ id: bookingRequests.id });
    const [booking] = await db
      .insert(bookings)
      .values({
        requestId: request!.id,
        customerId,
        vendorId: parties.vendorId,
        eventDate,
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status,
      })
      .returning({ id: bookings.id });

    return booking!.id;
  }

  function get(userId: string, authUserId: string | null = ADMIN) {
    return harness.app.inject({
      method: 'GET',
      url: `/admin/customers/${userId}`,
      headers: authUserId ? bearer(authUserId) : {},
    });
  }

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => NOW });

    for (const [authUserId, role, firstName] of [
      [ADMIN, 'customer', 'Ops'],
      [VENDOR, 'vendor', 'Dana'],
      [CUSTOMER, 'customer', 'Rosa'],
      [OTHER, 'customer', 'Ada'],
    ] as const) {
      harness.clerkUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName,
        lastName: 'Rivera',
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
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(reviews);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('refuses everyone but an admin, before validating, and 404s a non-customer', async () => {
    const { customerId, vendorUserId } = await seedParties();

    expect((await get(customerId, null)).statusCode).toBe(401);
    expect((await get(customerId, CUSTOMER)).statusCode).toBe(403);
    expect((await get(customerId, VENDOR)).statusCode).toBe(403);
    expect((await get('not-a-uuid', VENDOR)).statusCode).toBe(403);

    expect((await get('not-a-uuid')).statusCode).toBe(400);
    for (const id of [MISSING_ID, vendorUserId]) {
      const missing = await get(id);
      expect(missing.statusCode).toBe(404);
      expect(missing.json().message).toBe('No customer with that id');
    }
  });

  it("reads one customer's whole record, every count a query result", async () => {
    const parties = await seedParties();
    const { customerId, otherId, vendorId, vendorUserId } = parties;
    const db = harness.database.db;

    const older = await seedBooking(parties, customerId, '2026-08-01', 'completed');
    const newer = await seedBooking(parties, customerId, '2026-11-01', 'confirmed');
    const othersBooking = await seedBooking(parties, otherId, '2026-09-01', 'completed');

    /*
     * The derived counter says 9 and the ban instant is set: the response must
     * count the two real bookings and carry the stored instants, not the column.
     */
    await db
      .update(users)
      .set({
        totalBookingsCount: 9,
        isBanned: true,
        bannedAt: new Date('2026-09-10T08:00:00.000Z'),
        deletedAt: new Date('2026-09-11T09:00:00.000Z'),
        phone: '+15125550100',
        city: 'Austin',
        state: 'TX',
      })
      .where(eq(users.id, customerId));

    const [written] = await db
      .insert(reviews)
      .values({
        bookingId: older,
        reviewerId: customerId,
        vendorId,
        type: 'customer_to_vendor',
        rating: 5,
        title: 'Wonderful',
        content: 'Every photo was a keeper.',
        isPublic: false,
        createdAt: new Date('2026-08-05T10:00:00.000Z'),
      })
      .returning({ id: reviews.id });
    const [received] = await db
      .insert(reviews)
      .values({
        bookingId: older,
        reviewerId: vendorUserId,
        vendorId,
        type: 'vendor_to_customer',
        rating: 4,
        content: 'Clear brief and on time.',
        createdAt: new Date('2026-08-06T10:00:00.000Z'),
      })
      .returning({ id: reviews.id });
    // Both directions of another customer's booking: neither is this customer's.
    await db.insert(reviews).values([
      {
        bookingId: othersBooking,
        reviewerId: otherId,
        vendorId,
        type: 'customer_to_vendor' as const,
        rating: 2,
        content: 'Late.',
      },
      {
        bookingId: othersBooking,
        reviewerId: vendorUserId,
        vendorId,
        type: 'vendor_to_customer' as const,
        rating: 3,
        content: 'Changed the plan twice.',
      },
    ]);

    const [readOne, unreadOne] = await db
      .insert(notifications)
      .values([
        {
          userId: customerId,
          type: 'booking_confirmed',
          title: 'Your booking is confirmed',
          readAt: new Date('2026-09-02T11:00:00.000Z'),
          createdAt: new Date('2026-09-02T10:00:00.000Z'),
        },
        {
          userId: customerId,
          type: 'quote_received',
          title: 'Fernbank Studio sent a quote',
          createdAt: new Date('2026-09-03T10:00:00.000Z'),
        },
        { userId: otherId, type: 'quote_received', title: 'Not this customer' },
      ])
      .returning({ id: notifications.id });

    const response = await get(customerId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      customer: {
        id: customerId,
        email: `${CUSTOMER}@example.com`,
        name: 'Rosa Rivera',
        phone: '+15125550100',
        city: 'Austin',
        state: 'TX',
        isBanned: true,
        bannedAt: '2026-09-10T08:00:00.000Z',
        deletedAt: '2026-09-11T09:00:00.000Z',
        pendingEmail: null,
        createdAt: expect.any(String),
      },
      bookings: {
        total: 2,
        items: [
          {
            id: newer,
            status: 'confirmed',
            eventDate: '2026-11-01',
            vendorId,
            vendorName: 'Fernbank Studio',
            totalAmountCents: 120_000,
          },
          expect.objectContaining({ id: older, status: 'completed', eventDate: '2026-08-01' }),
        ],
      },
      reviews: {
        written: {
          total: 1,
          items: [
            {
              id: written!.id,
              bookingId: older,
              vendorId,
              vendorName: 'Fernbank Studio',
              rating: 5,
              title: 'Wonderful',
              content: 'Every photo was a keeper.',
              isPublic: false,
              createdAt: '2026-08-05T10:00:00.000Z',
            },
          ],
        },
        received: {
          total: 1,
          items: [
            expect.objectContaining({
              id: received!.id,
              bookingId: older,
              rating: 4,
              title: null,
              content: 'Clear brief and on time.',
            }),
          ],
        },
      },
      notifications: {
        total: 2,
        unread: 1,
        items: [
          {
            id: unreadOne!.id,
            type: 'quote_received',
            title: 'Fernbank Studio sent a quote',
            createdAt: '2026-09-03T10:00:00.000Z',
            readAt: null,
          },
          {
            id: readOne!.id,
            type: 'booking_confirmed',
            title: 'Your booking is confirmed',
            createdAt: '2026-09-02T10:00:00.000Z',
            readAt: '2026-09-02T11:00:00.000Z',
          },
        ],
      },
    });
  });

  it('counts every booking while listing only the most recent slice', async () => {
    const parties = await seedParties();
    for (let day = 1; day <= 21; day += 1) {
      await seedBooking(
        parties,
        parties.customerId,
        `2026-12-${String(day).padStart(2, '0')}`,
        'confirmed',
      );
    }

    const body = (await get(parties.customerId)).json();

    expect(body.bookings.total).toBe(21);
    expect(body.bookings.items).toHaveLength(20);
    expect(body.bookings.items[0].eventDate).toBe('2026-12-21');
    expect(body.bookings.items[19].eventDate).toBe('2026-12-02');
  });

  it('reads an account with nothing yet as empty cards, not a 404', async () => {
    const { otherId } = await seedParties();

    const body = (await get(otherId)).json();

    expect(body).toMatchObject({
      customer: { id: otherId, isBanned: false, bannedAt: null, deletedAt: null },
      bookings: { total: 0, items: [] },
      reviews: { written: { total: 0, items: [] }, received: { total: 0, items: [] } },
      notifications: { total: 0, unread: 0, items: [] },
    });
  });
});
