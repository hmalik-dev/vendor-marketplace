import {
  bookingRequests,
  bookings,
  categories,
  notifications,
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

const ADMIN = 'user_admin_booking_detail';
const VENDOR = 'user_vendor_booking_detail';
const CUSTOMER = 'user_customer_booking_detail';

const NOW = new Date('2026-10-01T12:00:00.000Z');
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

/** `GET /admin/bookings/:bookingId` and `GET /admin/requests` (VEN-399). */
describe('admin booking detail and requests', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function seedParties(): Promise<{ vendorId: string; customerId: string }> {
    await signInAs(harness, ADMIN, true);
    const customerId = await signInAs(harness, CUSTOMER);
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

    return { vendorId: created.json().id as string, customerId };
  }

  function get(url: string, clerkUserId: string | null = ADMIN) {
    return harness.app.inject({
      method: 'GET',
      url,
      headers: clerkUserId ? bearer(clerkUserId) : {},
    });
  }

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => NOW });

    for (const [clerkUserId, role, firstName] of [
      [ADMIN, 'customer', 'Ops'],
      [VENDOR, 'vendor', 'Dana'],
      [CUSTOMER, 'customer', 'Rosa'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email: `${clerkUserId}@example.com`,
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
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('refuses everyone but an admin on both routes, before validating', async () => {
    await seedParties();

    for (const url of [`/admin/bookings/${MISSING_ID}`, '/admin/requests']) {
      expect((await get(url, null)).statusCode).toBe(401);
      expect((await get(url, CUSTOMER)).statusCode).toBe(403);
      expect((await get(url, VENDOR)).statusCode).toBe(403);
    }
    expect((await get('/admin/bookings/not-a-uuid', VENDOR)).statusCode).toBe(403);
    expect((await get('/admin/requests?status=bogus', CUSTOMER)).statusCode).toBe(403);

    expect((await get('/admin/bookings/not-a-uuid')).statusCode).toBe(400);
    expect((await get('/admin/requests?status=bogus')).statusCode).toBe(400);
    const missing = await get(`/admin/bookings/${MISSING_ID}`);
    expect(missing.statusCode).toBe(404);
    expect(missing.json().message).toBe('No booking with that id');
  });

  it('reads the whole money story of one booking, columns no row schema exposed', async () => {
    const { vendorId, customerId } = await seedParties();
    const db = harness.database.db;
    await db
      .update(vendorProfiles)
      .set({ payoutHold: true })
      .where(eq(vendorProfiles.id, vendorId));

    const [request] = await db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId,
        eventDate: '2026-10-10',
        status: 'accepted',
        finalPriceCents: 120_000,
      })
      .returning({ id: bookingRequests.id });
    const [booking] = await db
      .insert(bookings)
      .values({
        requestId: request!.id,
        customerId,
        vendorId,
        eventDate: '2026-10-10',
        eventLocation: 'Barr Mansion',
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        payoutModel: 'separate',
        status: 'cancelled',
        stripePaymentIntentId: 'pi_test_money_story',
        paidAt: new Date('2026-09-02T10:00:00.000Z'),
        payoutAttempts: 2,
        payoutFailureReason: 'account_closed',
        cancelledAt: new Date('2026-09-20T15:30:00.000Z'),
        cancellationReason: 'The couple moved the wedding abroad.',
        cancelledBy: 'customer',
        refundAmountCents: 60_000,
        disputeReason: 'Deposit terms were unclear.',
      })
      .returning({ id: bookings.id });

    const response = await get(`/admin/bookings/${booking!.id}`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: booking!.id,
      requestId: request!.id,
      status: 'cancelled',
      eventDate: '2026-10-10',
      eventLocation: 'Barr Mansion',
      totalAmountCents: 120_000,
      platformFeeCents: 14_400,
      vendorPayoutCents: 105_600,
      payoutModel: 'separate',
      payoutStatus: 'pending',
      payoutFailing: true,
      payoutAttempts: 2,
      payoutFailureReason: 'account_closed',
      payoutReleasedAt: null,
      stripePaymentIntentId: 'pi_test_money_story',
      stripeTransferId: null,
      paidAt: '2026-09-02T10:00:00.000Z',
      completedAt: null,
      cancelledAt: '2026-09-20T15:30:00.000Z',
      cancellationReason: 'The couple moved the wedding abroad.',
      cancelledBy: 'customer',
      refundAmountCents: 60_000,
      disputeReason: 'Deposit terms were unclear.',
      createdAt: expect.any(String),
      vendor: { id: vendorId, businessName: 'Fernbank Studio', payoutHold: true },
      customer: { id: customerId, name: 'Rosa Rivera', email: `${CUSTOMER}@example.com` },
    });
  });

  it('reports a released, completed payout as released', async () => {
    const { vendorId, customerId } = await seedParties();
    const db = harness.database.db;
    const [request] = await db
      .insert(bookingRequests)
      .values({ customerId, vendorId, eventDate: '2026-09-12', status: 'accepted' })
      .returning({ id: bookingRequests.id });
    const [booking] = await db
      .insert(bookings)
      .values({
        requestId: request!.id,
        customerId,
        vendorId,
        eventDate: '2026-09-12',
        totalAmountCents: 80_000,
        platformFeeCents: 9_600,
        vendorPayoutCents: 70_400,
        status: 'completed',
        completedAt: new Date('2026-09-13T09:00:00.000Z'),
        payoutReleasedAt: new Date('2026-09-14T09:00:00.000Z'),
        stripeTransferId: 'tr_test_released',
      })
      .returning({ id: bookings.id });

    const body = (await get(`/admin/bookings/${booking!.id}`)).json();

    expect(body).toMatchObject({
      status: 'completed',
      payoutModel: 'destination',
      payoutStatus: 'released',
      payoutFailing: false,
      completedAt: '2026-09-13T09:00:00.000Z',
      payoutReleasedAt: '2026-09-14T09:00:00.000Z',
      stripeTransferId: 'tr_test_released',
      refundAmountCents: null,
      cancelledBy: null,
      vendor: { payoutHold: false },
    });
  });

  it('lists requests in every status, filterable by each and by group', async () => {
    const { vendorId, customerId } = await seedParties();
    const db = harness.database.db;
    const at = (iso: string): Date => new Date(iso);

    const seeded = await db
      .insert(bookingRequests)
      .values([
        {
          customerId,
          vendorId,
          eventDate: '2026-11-01',
          status: 'pending' as const,
          expiresAt: at('2026-10-05T12:00:00.000Z'),
          createdAt: at('2026-09-25T00:00:00.000Z'),
        },
        {
          customerId,
          vendorId,
          eventDate: '2026-11-02',
          status: 'quoted' as const,
          quotedPriceCents: 145_000,
          expiresAt: at('2026-10-03T12:00:00.000Z'),
          createdAt: at('2026-09-24T00:00:00.000Z'),
        },
        {
          customerId,
          vendorId,
          eventDate: '2026-11-03',
          status: 'accepted' as const,
          quotedPriceCents: 90_000,
          acceptedAt: at('2026-09-22T08:00:00.000Z'),
          createdAt: at('2026-09-23T00:00:00.000Z'),
        },
        {
          customerId,
          vendorId,
          eventDate: '2026-11-04',
          status: 'declined' as const,
          createdAt: at('2026-09-22T00:00:00.000Z'),
          updatedAt: at('2026-09-22T06:00:00.000Z'),
        },
        {
          customerId,
          vendorId,
          eventDate: '2026-11-05',
          status: 'expired' as const,
          expiresAt: at('2026-09-28T00:00:00.000Z'),
          createdAt: at('2026-09-21T00:00:00.000Z'),
        },
        {
          customerId,
          vendorId,
          eventDate: '2026-11-06',
          status: 'cancelled' as const,
          createdAt: at('2026-09-20T00:00:00.000Z'),
          updatedAt: at('2026-09-20T07:00:00.000Z'),
        },
      ])
      .returning({ id: bookingRequests.id, status: bookingRequests.status });
    const idOf = (status: string): string => seeded.find((row) => row.status === status)!.id;

    const all = await get('/admin/requests');
    expect(all.statusCode).toBe(200);
    expect(all.json()).toMatchObject({ total: 6, page: 1, widenings: [] });
    expect(all.json().items).toEqual([
      {
        id: idOf('pending'),
        status: 'pending',
        eventDate: '2026-11-01',
        vendorId,
        vendorName: 'Fernbank Studio',
        customerName: 'Rosa Rivera',
        quotedPriceCents: null,
        expiresAt: '2026-10-05T12:00:00.000Z',
        resolvedAt: null,
        createdAt: '2026-09-25T00:00:00.000Z',
      },
      expect.objectContaining({ id: idOf('quoted'), quotedPriceCents: 145_000, resolvedAt: null }),
      expect.objectContaining({ id: idOf('accepted'), resolvedAt: '2026-09-22T08:00:00.000Z' }),
      expect.objectContaining({ id: idOf('declined'), resolvedAt: '2026-09-22T06:00:00.000Z' }),
      expect.objectContaining({ id: idOf('expired'), resolvedAt: '2026-09-28T00:00:00.000Z' }),
      expect.objectContaining({ id: idOf('cancelled'), resolvedAt: '2026-09-20T07:00:00.000Z' }),
    ]);

    for (const status of ['pending', 'quoted', 'accepted', 'declined', 'expired', 'cancelled']) {
      const page = (await get(`/admin/requests?status=${status}`)).json();
      expect(page.items.map((row: { id: string }) => row.id)).toEqual([idOf(status)]);
      expect(page.total).toBe(1);
    }

    const groups: Record<string, string[]> = {
      live: [idOf('pending'), idOf('quoted')],
      closed: [idOf('accepted'), idOf('declined')],
      lapsed: [idOf('expired'), idOf('cancelled')],
    };
    for (const [group, ids] of Object.entries(groups)) {
      const page = (await get(`/admin/requests?group=${group}`)).json();
      expect(page.items.map((row: { id: string }) => row.id)).toEqual(ids);
    }

    // A status outside its group finds nothing, and the counted ways out say what does.
    const empty = (await get('/admin/requests?group=live&status=declined')).json();
    expect(empty.items).toEqual([]);
    expect(empty.total).toBe(0);
    expect(empty.widenings).toEqual([
      { key: 'group', count: 1 },
      { key: 'status', count: 2 },
    ]);
  });

  /**
   * AC3: a request past `expires_at` reads as expired here exactly as its
   * participant's own read shows it — asserted against that read's answer.
   *
   * The console reads first, while the row is still stored `quoted`, so the
   * agreement is the derivation's and not a stored value both happen to see.
   * The console must also write nothing: the row is still `quoted` after it.
   */
  it('reads a lapsed request as expired exactly as the participant read does, writing nothing', async () => {
    const { vendorId, customerId } = await seedParties();
    const db = harness.database.db;
    const [lapsed] = await db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId,
        eventDate: '2026-11-08',
        status: 'quoted',
        quotedPriceCents: 110_000,
        expiresAt: new Date('2026-10-01T11:59:59.000Z'),
      })
      .returning({ id: bookingRequests.id });

    const adminRead = (await get('/admin/requests?status=expired')).json();
    const underQuoted = (await get('/admin/requests?status=quoted')).json();
    const underLive = (await get('/admin/requests?group=live')).json();
    const stored = await db
      .select({ status: bookingRequests.status })
      .from(bookingRequests)
      .where(eq(bookingRequests.id, lapsed!.id));

    expect(adminRead.items.map((row: { id: string }) => row.id)).toEqual([lapsed!.id]);
    expect(underQuoted.items).toEqual([]);
    expect(underLive.items).toEqual([]);
    expect(stored).toEqual([{ status: 'quoted' }]);

    const participant = await get(`/booking-requests/${lapsed!.id}`, CUSTOMER);
    expect(participant.statusCode).toBe(200);
    expect(adminRead.items[0].status).toBe(participant.json().status);
    expect(participant.json().status).toBe('expired');
  });
});
