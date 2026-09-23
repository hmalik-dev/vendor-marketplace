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
import { declineOpenRequests } from './admin.dao.js';

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
