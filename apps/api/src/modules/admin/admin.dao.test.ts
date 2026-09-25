import {
  availability,
  bookingRequests,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { addDays, toDateString } from '@vendor-marketplace/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { declineOpenRequests, setBanned } from './admin.dao.js';

/**
 * VEN-621 — an unwind's `declineOpenRequests` must give the vendor's calendar
 * cell back when the accepted request that held it is declined, through the
 * same `syncHeldDate` every other transition uses. Before this it updated
 * `booking_requests` alone: the date stayed `booked` forever, with no route
 * able to clear it (`setOwnAvailability` refuses a booked cell, and a customer
 * request on the freed date answered 409).
 */
describe('declineOpenRequests releasing the date behind an accepted request', () => {
  let harness: TestHarness;
  const DATE_A = toDateString(addDays(new Date(), 45));
  const DATE_B = toDateString(addDays(new Date(), 46));

  async function newUser(authUserId: string): Promise<string> {
    const [row] = await harness.database.db
      .insert(users)
      .values({
        authUserId,
        email: `${authUserId}@example.com`,
        role: 'customer',
        firstName: 'Test',
        lastName: 'User',
      })
      .returning({ id: users.id });
    return row!.id;
  }

  async function newVendor(ownerId: string, slug: string): Promise<string> {
    const [row] = await harness.database.db
      .insert(vendorProfiles)
      .values({ userId: ownerId, businessName: 'Sunlit Studio', slug })
      .returning({ id: vendorProfiles.id });
    return row!.id;
  }

  async function acceptedRequest(
    customerId: string,
    vendorId: string,
    date: string,
  ): Promise<string> {
    const [row] = await harness.database.db
      .insert(bookingRequests)
      .values({ customerId, vendorId, eventDate: date, status: 'accepted' })
      .returning({ id: bookingRequests.id });
    return row!.id;
  }

  async function heldDateStatus(vendorId: string, date: string): Promise<string | null> {
    const rows = await harness.database.db
      .select({ status: availability.status })
      .from(availability)
      .where(and(eq(availability.vendorId, vendorId), eq(availability.date, date)));
    return rows[0]?.status ?? null;
  }

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterEach(async () => {
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(availability);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('frees the declined request date and leaves another customer’s accepted date untouched', async () => {
    const vendorOwnerId = await newUser('user_vendor_owner');
    const vendorId = await newVendor(vendorOwnerId, 'sunlit-studio');
    const customerA = await newUser('user_customer_a');
    const customerB = await newUser('user_customer_b');

    const requestA = await acceptedRequest(customerA, vendorId, DATE_A);
    await acceptedRequest(customerB, vendorId, DATE_B);
    await harness.database.db.insert(availability).values([
      { vendorId, date: DATE_A, status: 'booked' },
      { vendorId, date: DATE_B, status: 'booked' },
    ]);

    const declinedCount = await declineOpenRequests(
      harness.database.db,
      customerA,
      null,
      new Date(),
    );

    expect(declinedCount).toBe(1);

    const [requestARow] = await harness.database.db
      .select({ status: bookingRequests.status })
      .from(bookingRequests)
      .where(eq(bookingRequests.id, requestA));
    expect(requestARow?.status).toBe('declined');

    expect(await heldDateStatus(vendorId, DATE_A)).toBeNull();
    expect(await heldDateStatus(vendorId, DATE_B)).toBe('booked');
  });
});

/** VEN-636 — a ban or unban only claims an account that is not already in the target state. */
describe('setBanned on an account already in the target state', () => {
  let harness: TestHarness;
  let userId: string;
  const BANNED_AT = new Date('2026-09-15T12:00:00Z');

  async function row() {
    const [found] = await harness.database.db
      .select({ isBanned: users.isBanned, bannedAt: users.bannedAt, updatedAt: users.updatedAt })
      .from(users)
      .where(eq(users.id, userId));
    return found!;
  }

  beforeAll(async () => {
    harness = await createTestHarness();
    const [created] = await harness.database.db
      .insert(users)
      .values({
        authUserId: 'user_set_banned_target',
        email: 'set-banned-target@example.com',
        role: 'customer',
        firstName: 'Test',
        lastName: 'User',
      })
      .returning({ id: users.id });
    userId = created!.id;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('returns null for an unban of an account that is not banned', async () => {
    const before = await row();

    expect(await setBanned(harness.database.db, userId, null, false, new Date())).toBeNull();
    expect(await row()).toEqual(before);
  });

  it('bans once, then returns null and keeps the first bannedAt', async () => {
    expect(await setBanned(harness.database.db, userId, null, true, BANNED_AT)).toEqual({
      profileUnpublished: false,
    });

    const banned = await row();

    expect(banned.isBanned).toBe(true);
    expect(banned.bannedAt).toEqual(BANNED_AT);
    expect(
      await setBanned(harness.database.db, userId, null, true, new Date('2026-09-16T00:00:00Z')),
    ).toBeNull();
    expect(await row()).toEqual(banned);
  });
});
