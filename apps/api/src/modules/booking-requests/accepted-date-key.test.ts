import { bookingRequests, bookings } from '@vendor-marketplace/db/schema';
import { createTestDatabase, type TestDatabase } from '@vendor-marketplace/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { violatesUniqueConstraint } from '../../lib/constraint-violation.js';
import {
  ACCEPTED_DATE_KEY,
  CONFIRMED_DATE_KEY,
  isAcceptedDateTaken,
} from './booking-requests.dao.js';

/**
 * VEN-482 — the database refuses a second commitment on one vendor date, so a
 * writer that skips `lockHeldDate` (a seed, an admin tool) cannot double-book.
 *
 * The accept path never reaches these indexes in a single-connection suite: its
 * own `hasRivalAcceptanceOn` answers first. So the rows are written straight
 * through the schema, which is exactly the writer the indexes exist for.
 */
describe('one accepted request and one confirmed booking per vendor date', () => {
  let database: TestDatabase;
  const VENDOR = '11111111-1111-4111-8111-111111111111';
  const OTHER_VENDOR = '22222222-2222-4222-8222-222222222222';
  const CUSTOMER_A = '00000000-0000-4000-8000-00000000000a';
  const CUSTOMER_B = '00000000-0000-4000-8000-00000000000b';
  const DATE = '2027-06-14';

  async function request(
    customerId: string,
    status: 'accepted' | 'declined',
    vendorId = VENDOR,
    eventDate = DATE,
  ): Promise<string> {
    const [row] = await database.db
      .insert(bookingRequests)
      .values({ customerId, vendorId, eventDate, status })
      .returning({ id: bookingRequests.id });

    return row!.id;
  }

  async function booking(
    requestId: string,
    customerId: string,
    status: 'confirmed' | 'cancelled',
  ): Promise<void> {
    await database.db.insert(bookings).values({
      requestId,
      customerId,
      vendorId: VENDOR,
      eventDate: DATE,
      totalAmountCents: 100_000,
      platformFeeCents: 10_000,
      vendorPayoutCents: 90_000,
      status,
    });
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.runMigrations();
    await database.client.exec(`
      insert into users (id, auth_user_id, email, first_name, last_name, role) values
        ('00000000-0000-4000-8000-000000000001', 'u_v1', 'v1@example.com', 'V', 'One', 'vendor'),
        ('00000000-0000-4000-8000-000000000002', 'u_v2', 'v2@example.com', 'V', 'Two', 'vendor'),
        ('${CUSTOMER_A}', 'u_ca', 'ca@example.com', 'C', 'A', 'customer'),
        ('${CUSTOMER_B}', 'u_cb', 'cb@example.com', 'C', 'B', 'customer');
      insert into vendor_profiles (id, user_id, business_name, slug) values
        ('${VENDOR}', '00000000-0000-4000-8000-000000000001', 'One Studio', 'one-studio'),
        ('${OTHER_VENDOR}', '00000000-0000-4000-8000-000000000002', 'Two Studio', 'two-studio');
    `);
  });

  afterAll(async () => {
    await database.close();
  });

  it('refuses a second accepted request for one vendor and date, by name', async () => {
    await request(CUSTOMER_A, 'accepted');

    const second = request(CUSTOMER_B, 'accepted');

    await expect(second).rejects.toSatisfy((error: unknown) =>
      violatesUniqueConstraint(error, ACCEPTED_DATE_KEY),
    );
    // The service turns exactly this failure into the date-booked 409.
    await expect(second).rejects.toSatisfy(isAcceptedDateTaken);
  });

  it('still allows a settled request, another vendor, and another date', async () => {
    await request(CUSTOMER_B, 'declined');
    await request(CUSTOMER_B, 'accepted', OTHER_VENDOR);
    await request(CUSTOMER_B, 'accepted', VENDOR, '2027-06-15');

    const rows = await database.db.select({ id: bookingRequests.id }).from(bookingRequests);

    expect(rows).toHaveLength(4);
  });

  it('refuses a second confirmed booking for one vendor and date, by name', async () => {
    const first = await request(CUSTOMER_A, 'declined');
    const second = await request(CUSTOMER_B, 'declined');

    await booking(first, CUSTOMER_A, 'confirmed');

    await expect(booking(second, CUSTOMER_B, 'confirmed')).rejects.toSatisfy((error: unknown) =>
      violatesUniqueConstraint(error, CONFIRMED_DATE_KEY),
    );
  });

  it('lets a cancelled booking stand beside a confirmed one', async () => {
    const third = await request(CUSTOMER_B, 'declined');

    await booking(third, CUSTOMER_B, 'cancelled');

    const rows = await database.db.select({ status: bookings.status }).from(bookings);

    expect(rows.map((r) => r.status).sort()).toEqual(['cancelled', 'confirmed']);
  });
});
