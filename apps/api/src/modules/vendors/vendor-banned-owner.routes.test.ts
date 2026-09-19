import { categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { addDays, toDateString } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterEach, afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { updateVendorProfileById } from './vendors.dao.js';
import { updateVendorProfile } from './vendors.service.js';

const VENDOR = 'user_vendor_banned';
const CUSTOMER = 'user_customer_banned';
const EVENT_DATE = toDateString(addDays(new Date(), 30));
const BOOKING_DATES = [
  toDateString(addDays(new Date(), 40)),
  toDateString(addDays(new Date(), 41)),
];

/**
 * A suspended owner's storefront is refused by the row, not by the one
 * unpublish the ban wrote (VEN-431). The ban is set directly in the fixture, so
 * nothing here depends on the admin path having run in the right order.
 */
describe('a vendor whose owner is banned', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function seedPublished(): Promise<{ vendorId: string; packageId: string }> {
    const profile = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
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
    expect(profile.statusCode).toBe(201);
    const vendorId = profile.json().id as string;

    const servicePackage = await harness.app.inject({
      method: 'POST',
      url: '/vendor/packages',
      headers: bearer(VENDOR),
      payload: {
        name: 'Full day coverage',
        description: 'Six hours of coverage with two photographers on site.',
        priceCents: 145_000,
      },
    });
    expect(servicePackage.statusCode).toBe(201);

    // Nearby availability offers a vendor only as an alternative to a day they lack.
    const blocked = await harness.app.inject({
      method: 'PUT',
      url: '/vendor/availability',
      headers: bearer(VENDOR),
      payload: { entries: [{ date: EVENT_DATE, status: 'blocked' }] },
    });
    expect(blocked.statusCode).toBe(200);

    const published = await harness.app.inject({
      method: 'PUT',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: { isPublished: true },
    });
    expect(published.statusCode).toBe(200);

    // Bookable means onboarded: the pair travels together (#381).
    await harness.database.db
      .update(vendorProfiles)
      .set({ stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
      .where(eq(vendorProfiles.id, vendorId));

    return { vendorId, packageId: servicePackage.json().id as string };
  }

  function requestBooking(vendorId: string, packageId: string, eventDate: string) {
    return harness.app.inject({
      method: 'POST',
      url: '/booking-requests',
      headers: bearer(CUSTOMER),
      payload: {
        vendorId,
        packageId,
        eventDate,
        eventType: 'wedding',
        eventLocation: 'Barr Mansion, Austin, TX',
        eventStartTime: '14:00',
        guestCount: 120,
      },
    });
  }

  async function ban(authUserId: string, isBanned: boolean): Promise<void> {
    await harness.database.db
      .update(users)
      .set({ isBanned, bannedAt: isBanned ? new Date() : null })
      .where(eq(users.authUserId, authUserId));
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [authUserId, role] of [
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    const [photography] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = photography!.id;
  });

  afterEach(async () => {
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('is absent from search, the storefront, availability and booking', async () => {
    const { vendorId, packageId } = await seedPublished();

    const before = await harness.app.inject({ method: 'GET', url: '/vendors' });
    expect(before.json().total).toBe(1);

    const nearbyUrl = `/vendors/availability/nearby?date=${EVENT_DATE}`;
    const nearbyBefore = await harness.app.inject({ method: 'GET', url: nearbyUrl });
    expect(nearbyBefore.json().items).toHaveLength(1);

    expect((await requestBooking(vendorId, packageId, BOOKING_DATES[0]!)).statusCode).toBe(201);

    await ban(VENDOR, true);

    const search = await harness.app.inject({ method: 'GET', url: '/vendors' });
    expect(search.statusCode).toBe(200);
    expect(search.json().total).toBe(0);
    expect(search.json().items).toEqual([]);

    const slug = before.json().items[0].slug as string;
    const storefront = await harness.app.inject({ method: 'GET', url: `/vendors/${slug}` });
    expect(storefront.statusCode).toBe(404);

    const nearby = await harness.app.inject({ method: 'GET', url: nearbyUrl });
    expect(nearby.statusCode).toBe(200);
    expect(nearby.json().items).toEqual([]);

    const request = await requestBooking(vendorId, packageId, BOOKING_DATES[1]!);
    expect(request.statusCode).toBe(404);

    await ban(VENDOR, false);

    const restored = await harness.app.inject({ method: 'GET', url: `/vendors/${slug}` });
    expect(restored.statusCode).toBe(200);
  });

  it('cannot be republished by a write that read the profile before the ban', async () => {
    const { vendorId } = await seedPublished();
    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: false })
      .where(eq(vendorProfiles.id, vendorId));

    // The ban commits after the editor's read and before its write.
    await ban(VENDOR, true);

    const updated = await updateVendorProfileById(
      harness.database.db,
      vendorId,
      { isPublished: true },
      { requireUnheld: true },
    );

    expect(updated).toBeNull();
    const [row] = await harness.database.db
      .select({ isPublished: vendorProfiles.isPublished })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendorId));
    expect(row!.isPublished).toBe(false);
  });

  it('answers 403, not "no profile", when the publish loses to the ban', async () => {
    const { vendorId } = await seedPublished();
    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: false })
      .where(eq(vendorProfiles.id, vendorId));
    const [owner] = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, VENDOR));
    await ban(VENDOR, true);

    // Straight to the service: the auth hook would refuse a banned caller first.
    await expect(
      updateVendorProfile(harness.database.db, harness.app.storage, owner!.id, {
        isPublished: true,
      }),
    ).rejects.toMatchObject({ statusCode: 403, message: 'This account has been suspended' });

    const [row] = await harness.database.db
      .select({ isPublished: vendorProfiles.isPublished })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendorId));
    expect(row!.isPublished).toBe(false);
  });
});
