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
import { declineRefundedRequest } from './payments.dao.js';

/**
 * VEN-621 — a vendor-unavailable refund declining an accepted request must
 * give the date back the same way any other decline does, through
 * `syncHeldDate`. Before this the request moved to `declined` and the
 * calendar cell stayed `booked`: the vendor had no repair route, and a
 * customer's request for the freed date answered 409.
 */
describe('declineRefundedRequest releasing the date it held', () => {
  let harness: TestHarness;
  const EVENT_DATE = toDateString(addDays(new Date(), 45));

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

  async function heldDateStatus(vendorId: string): Promise<string | null> {
    const rows = await harness.database.db
      .select({ status: availability.status })
      .from(availability)
      .where(and(eq(availability.vendorId, vendorId), eq(availability.date, EVENT_DATE)));
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

  it('declines the request and frees its held date', async () => {
    const ownerId = await newUser('user_refund_vendor_owner');
    const customerId = await newUser('user_refund_customer');
    const [vendor] = await harness.database.db
      .insert(vendorProfiles)
      .values({ userId: ownerId, businessName: 'Sunlit Studio', slug: 'sunlit-studio-refund' })
      .returning({ id: vendorProfiles.id });
    const vendorId = vendor!.id;

    const [request] = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId,
        eventDate: EVENT_DATE,
        status: 'accepted',
        stripePaymentIntentId: 'pi_test_refunded',
      })
      .returning({ id: bookingRequests.id });
    await harness.database.db
      .insert(availability)
      .values({ vendorId, date: EVENT_DATE, status: 'booked' });

    await declineRefundedRequest(harness.database.db, request!.id, new Date());

    const [row] = await harness.database.db
      .select({ status: bookingRequests.status })
      .from(bookingRequests)
      .where(eq(bookingRequests.id, request!.id));
    expect(row?.status).toBe('declined');
    expect(await heldDateStatus(vendorId)).toBeNull();
  });
});
