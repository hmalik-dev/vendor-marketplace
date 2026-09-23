import {
  adminActions,
  availability,
  bookingRequests,
  bookings,
  categories,
  notifications,
  portfolioItems,
  servicePackages,
  users,
  vendorCategories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { asc, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

const ADMIN = 'user_admin_detail';
const VENDOR = 'user_vendor_detail';
const CUSTOMER = 'user_customer_detail';

/** Every date below is relative to this, so the lock window is the same on every run. */
const NOW = new Date('2026-10-01T12:00:00.000Z');
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

/** `GET /admin/vendors/:vendorId` (VEN-380). */
describe('admin vendor detail', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function seedVendor(): Promise<{ id: string; userId: string; packageIds: string[] }> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Fernbank Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Fernbank Studio photographs weddings across central Texas.',
        responseTimeHours: 24,
      },
    });
    expect(created.statusCode).toBe(201);

    const packageIds: string[] = [];
    for (const priceCents of [90_000, 150_000]) {
      const pkg = await harness.app.inject({
        method: 'POST',
        url: '/v1/vendor/packages',
        headers: bearer(VENDOR),
        payload: {
          name: `Package ${priceCents}`,
          description: 'A package with a description long enough to pass validation.',
          priceCents,
        },
      });
      expect(pkg.statusCode).toBe(201);
      packageIds.push(pkg.json().id as string);
    }

    const body = created.json();

    return { id: body.id as string, userId: body.userId as string, packageIds };
  }

  async function actionsFor(subjectId: string): Promise<{ action: string; actorId: string }[]> {
    return harness.database.db
      .select({ action: adminActions.action, actorId: adminActions.actorId })
      .from(adminActions)
      .where(eq(adminActions.subjectId, subjectId))
      .orderBy(asc(adminActions.createdAt), asc(adminActions.id));
  }

  function readDetail(vendorId: string, authUserId: string | null = ADMIN) {
    return harness.app.inject({
      method: 'GET',
      url: `/v1/admin/vendors/${vendorId}`,
      headers: authUserId ? bearer(authUserId) : {},
    });
  }

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => NOW });

    for (const [authUserId, role, firstName] of [
      [ADMIN, 'customer', 'Ops'],
      [VENDOR, 'vendor', 'Dana'],
      [CUSTOMER, 'customer', 'Rosa'],
    ] as const) {
      harness.authUsers.set(authUserId, {
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
    // `admin_actions` is append-only; its rows go with `delete(users)` through the actor cascade.
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(availability);
    await harness.database.db.delete(portfolioItems);
    await harness.database.db.delete(servicePackages);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('refuses everyone but an admin, before validating the id', async () => {
    await signInAs(harness, ADMIN, true);
    await signInAs(harness, CUSTOMER);
    await signInAs(harness, VENDOR);
    const vendor = await seedVendor();

    expect((await readDetail(vendor.id, null)).statusCode).toBe(401);
    expect((await readDetail(vendor.id, CUSTOMER)).statusCode).toBe(403);
    expect((await readDetail(vendor.id, VENDOR)).statusCode).toBe(403);
    expect((await readDetail('not-a-uuid', CUSTOMER)).statusCode).toBe(403);

    expect((await readDetail('not-a-uuid')).statusCode).toBe(400);
    const missing = await readDetail(MISSING_ID);
    expect(missing.statusCode).toBe(404);
    expect(missing.json().message).toBe('No vendor with that id');
  });

  it('exposes the profile columns the list never showed, and the Stripe state', async () => {
    await signInAs(harness, ADMIN, true);
    await signInAs(harness, VENDOR);
    const vendor = await seedVendor();
    await harness.database.db
      .update(vendorProfiles)
      .set({
        serviceRadiusKm: 80,
        stripeAccountId: 'acct_1PqR3xKz9LmN4dTv',
        stripeDisabledReason: 'requirements.past_due',
        stripeRequirementsDue: ['company.verification.document'],
        payoutHold: true,
      })
      .where(eq(vendorProfiles.id, vendor.id));

    const response = await readDetail(vendor.id);

    expect(response.statusCode).toBe(200);
    expect(response.json().vendor).toMatchObject({
      id: vendor.id,
      userId: vendor.userId,
      businessName: 'Fernbank Studio',
      email: `${VENDOR}@example.com`,
      ownerName: 'Dana Rivera',
      categoryName: 'Photography',
      responseTimeHours: 24,
      serviceRadiusKm: 80,
      travelsBeyondRadius: false,
      stripeAccountId: 'acct_1PqR3xKz9LmN4dTv',
      stripeOnboarded: false,
      stripeDisabledReason: 'requirements.past_due',
      stripeRequirementsDue: ['company.verification.document'],
      isPublished: false,
      moderationHold: false,
      payoutHold: true,
      status: 'review',
      bookingsCount: 0,
    });
  });

  it('lists packages and portfolio, and each lever on them writes an admin action the detail reflects', async () => {
    const actorId = await signInAs(harness, ADMIN, true);
    const vendorUserId = await signInAs(harness, VENDOR);
    const vendor = await seedVendor();
    const photo = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/portfolio',
      headers: bearer(VENDOR),
      payload: {
        imageUrl: `portfolio/${vendorUserId}/4242.webp`,
        thumbnailUrl: `portfolio/${vendorUserId}/4242-thumb.webp`,
        caption: 'A wedding at dusk',
      },
    });
    expect(photo.statusCode).toBe(201);
    const photoId = photo.json().id as string;

    const before = (await readDetail(vendor.id)).json();
    expect(before.packages).toEqual([
      {
        id: vendor.packageIds[0],
        name: 'Package 90000',
        priceCents: 90_000,
        priceType: 'fixed',
        isActive: true,
        moderationHold: false,
      },
      {
        id: vendor.packageIds[1],
        name: 'Package 150000',
        priceCents: 150_000,
        priceType: 'fixed',
        isActive: true,
        moderationHold: false,
      },
    ]);
    expect(before.portfolio).toEqual([
      {
        id: photoId,
        imageUrl: `portfolio/${vendorUserId}/4242.webp`,
        thumbnailUrl: `portfolio/${vendorUserId}/4242-thumb.webp`,
        caption: 'A wedding at dusk',
        displayOrder: 0,
      },
    ]);

    const deactivated = await harness.app.inject({
      method: 'PUT',
      url: `/v1/admin/packages/${vendor.packageIds[0]}/active`,
      headers: bearer(ADMIN),
      payload: { isActive: false },
    });
    expect(deactivated.statusCode).toBe(200);

    const removed = await harness.app.inject({
      method: 'DELETE',
      url: `/v1/admin/portfolio-items/${photoId}`,
      headers: bearer(ADMIN),
    });
    expect(removed.statusCode).toBe(204);

    const after = (await readDetail(vendor.id)).json();
    expect(
      after.packages.map((row: { isActive: boolean; moderationHold: boolean }) => [
        row.isActive,
        row.moderationHold,
      ]),
    ).toEqual([
      [false, true],
      [true, false],
    ]);
    expect(after.portfolio).toEqual([]);

    expect(await actionsFor(vendor.packageIds[0]!)).toEqual([
      { action: 'package_deactivated', actorId },
    ]);
    expect(await actionsFor(photoId)).toEqual([{ action: 'portfolio_item_removed', actorId }]);
  });

  it('names what holds each locked date, and shows a booked date nothing holds', async () => {
    await signInAs(harness, ADMIN, true);
    const customerId = await signInAs(harness, CUSTOMER);
    await signInAs(harness, VENDOR);
    const vendor = await seedVendor();
    const db = harness.database.db;

    const [acceptedRequest] = await db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId: vendor.id,
        eventDate: '2026-10-10',
        status: 'accepted',
        finalPriceCents: 120_000,
      })
      .returning({ id: bookingRequests.id });
    const [booking] = await db
      .insert(bookings)
      .values({
        requestId: acceptedRequest!.id,
        customerId,
        vendorId: vendor.id,
        eventDate: '2026-10-10',
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'confirmed',
        stripePaymentIntentId: 'pi_test_detail',
      })
      .returning({ id: bookings.id });

    const liveExpiry = new Date('2026-10-02T09:00:00.000Z');
    const [liveRequest] = await db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId: vendor.id,
        eventDate: '2026-10-17',
        status: 'pending',
        expiresAt: liveExpiry,
      })
      .returning({ id: bookingRequests.id });
    // Expired but never aged: the calendar ignores it, so the console must too.
    await db.insert(bookingRequests).values({
      customerId,
      vendorId: vendor.id,
      eventDate: '2026-10-24',
      status: 'pending',
      expiresAt: new Date('2026-09-30T00:00:00.000Z'),
    });

    /*
     * A held row wins its date over the request overlay, as on the vendor's
     * calendar: a stored `pending` names the request it holds, while the
     * `available` a cancelled booking leaves does not hide the live request on
     * 10-04.
     */
    const [heldRequest] = await db
      .insert(bookingRequests)
      .values({ customerId, vendorId: vendor.id, eventDate: '2026-10-03', status: 'pending' })
      .returning({ id: bookingRequests.id });
    const [freedRequest] = await db
      .insert(bookingRequests)
      .values({ customerId, vendorId: vendor.id, eventDate: '2026-10-04', status: 'pending' })
      .returning({ id: bookingRequests.id });

    await db.insert(availability).values([
      { vendorId: vendor.id, date: '2026-10-03', status: 'pending' },
      { vendorId: vendor.id, date: '2026-10-04', status: 'available' },
      { vendorId: vendor.id, date: '2026-10-10', status: 'booked' },
      { vendorId: vendor.id, date: '2026-10-31', status: 'booked' },
      { vendorId: vendor.id, date: '2026-11-07', status: 'blocked', note: 'out of state' },
      // Before yesterday: history, not a hold.
      { vendorId: vendor.id, date: '2026-09-20', status: 'blocked', note: 'past' },
    ]);

    const response = await readDetail(vendor.id);

    expect(response.statusCode).toBe(200);
    expect(response.json().locks).toEqual([
      {
        date: '2026-10-03',
        status: 'pending',
        note: null,
        holders: [
          {
            kind: 'request',
            id: heldRequest!.id,
            customerName: 'Rosa Rivera',
            status: 'pending',
            expiresAt: null,
          },
        ],
      },
      {
        date: '2026-10-04',
        status: 'pending',
        note: null,
        holders: [
          {
            kind: 'request',
            id: freedRequest!.id,
            customerName: 'Rosa Rivera',
            status: 'pending',
            expiresAt: null,
          },
        ],
      },
      {
        date: '2026-10-10',
        status: 'booked',
        note: null,
        holders: [
          { kind: 'booking', id: booking!.id, customerName: 'Rosa Rivera', status: 'confirmed' },
        ],
      },
      {
        date: '2026-10-17',
        status: 'pending',
        note: null,
        holders: [
          {
            kind: 'request',
            id: liveRequest!.id,
            customerName: 'Rosa Rivera',
            status: 'pending',
            expiresAt: liveExpiry.toISOString(),
          },
        ],
      },
      { date: '2026-10-31', status: 'booked', note: null, holders: [] },
      { date: '2026-11-07', status: 'blocked', note: 'out of state', holders: [] },
    ]);
  });

  it('lists notifications sent to the vendor with sent-at and read state, and counts them all', async () => {
    await signInAs(harness, ADMIN, true);
    const customerId = await signInAs(harness, CUSTOMER);
    await signInAs(harness, VENDOR);
    const vendor = await seedVendor();
    const db = harness.database.db;
    await db.delete(notifications);

    const readAt = new Date('2026-09-29T08:00:00.000Z');
    await db.insert(notifications).values([
      {
        userId: vendor.userId,
        type: 'booking_request',
        title: 'New request for Oct 17',
        createdAt: new Date('2026-09-28T10:00:00.000Z'),
        readAt,
      },
      {
        userId: vendor.userId,
        type: 'message',
        title: 'Rosa sent a message',
        createdAt: new Date('2026-09-30T10:00:00.000Z'),
      },
      // Somebody else's — must not appear or count.
      { userId: customerId, type: 'message', title: 'Not the vendor’s' },
    ]);

    const body = (await readDetail(vendor.id)).json();

    expect(body.notifications).toMatchObject({ total: 2, unread: 1 });
    expect(
      body.notifications.items.map((row: Record<string, unknown>) => [
        row.title,
        row.type,
        row.createdAt,
        row.readAt,
      ]),
    ).toEqual([
      ['Rosa sent a message', 'message', '2026-09-30T10:00:00.000Z', null],
      [
        'New request for Oct 17',
        'booking_request',
        '2026-09-28T10:00:00.000Z',
        readAt.toISOString(),
      ],
    ]);
  });
});
