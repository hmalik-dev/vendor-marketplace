import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { freshEventDate, shiftBookingIntoPast } from './e2e-booking-dates.js';
import { availability, bookingRequests, bookings } from './schema/index.js';
import { seedReferenceData } from './seed.js';
import { E2E_VENDOR_SLUG, seedE2eFixtures, type E2eSeedResult } from './seed-e2e.js';
import { createTestDatabase, type TestDatabase } from './testing/test-db.js';

const NOW = new Date('2026-09-14T15:00:00.000Z');

const INPUT = {
  vendor: {
    authUserId: 'user_e2e_vendor',
    email: 'vendor+clerk_test@example.com',
    firstName: 'Evie',
    lastName: 'Vendor',
  },
  customer: {
    authUserId: 'user_e2e_customer',
    email: 'customer+clerk_test@example.com',
    firstName: 'Cal',
    lastName: 'Customer',
  },
  stripeAccountId: 'acct_1Fixture0000000000',
  now: NOW,
};

/** Always the first candidate, so the chosen date is a fact the test can state. */
const FIRST = (dates: readonly string[]): string => dates[0]!;

describe('e2e booking dates', () => {
  let database: TestDatabase;
  let seeded: E2eSeedResult;

  beforeEach(async () => {
    database = await createTestDatabase();
    await database.runMigrations();
    await seedReferenceData(database.db);
    seeded = await seedE2eFixtures(database.db, INPUT);
  });

  afterAll(async () => {
    await database?.close();
  });

  describe('freshEventDate', () => {
    it('starts the window 120 days out, far past the 48-hour refund cutoff', async () => {
      const date = await freshEventDate(database.db, {
        vendorSlug: E2E_VENDOR_SLUG,
        now: NOW,
        pick: FIRST,
      });

      expect(date).toBe('2027-01-12');
    });

    it('skips a date the vendor holds, and one a request already names', async () => {
      await database.db.insert(availability).values([
        { vendorId: seeded.vendorProfileId, date: '2027-01-12', status: 'booked' },
        { vendorId: seeded.vendorProfileId, date: '2027-01-13', status: 'blocked' },
      ]);
      await database.db
        .update(bookingRequests)
        .set({ eventDate: '2027-01-14' })
        .where(eq(bookingRequests.id, seeded.bookingRequestId!));

      const date = await freshEventDate(database.db, {
        vendorSlug: E2E_VENDOR_SLUG,
        now: NOW,
        pick: FIRST,
      });

      expect(date).toBe('2027-01-15');
    });

    it('treats an explicitly available day as free', async () => {
      await database.db
        .insert(availability)
        .values({ vendorId: seeded.vendorProfileId, date: '2027-01-12', status: 'available' });

      const date = await freshEventDate(database.db, {
        vendorSlug: E2E_VENDOR_SLUG,
        now: NOW,
        pick: FIRST,
      });

      expect(date).toBe('2027-01-12');
    });

    it('names the slug when there is no such vendor', async () => {
      await expect(
        freshEventDate(database.db, { vendorSlug: 'nobody-here', now: NOW, pick: FIRST }),
      ).rejects.toThrow('No live vendor profile has the slug nobody-here');
    });
  });

  describe('shiftBookingIntoPast', () => {
    async function insertBooking(eventDate: string): Promise<string> {
      await database.db
        .update(bookingRequests)
        .set({ eventDate, status: 'accepted' })
        .where(eq(bookingRequests.id, seeded.bookingRequestId!));
      await database.db
        .insert(availability)
        .values({ vendorId: seeded.vendorProfileId, date: eventDate, status: 'booked' });

      const [row] = await database.db
        .insert(bookings)
        .values({
          requestId: seeded.bookingRequestId!,
          customerId: seeded.customerUserId,
          vendorId: seeded.vendorProfileId,
          eventDate,
          totalAmountCents: 145_000,
          platformFeeCents: 14_500,
          vendorPayoutCents: 130_500,
          payoutModel: 'separate',
          stripePaymentIntentId: 'pi_fixture',
        })
        .returning({ id: bookings.id });

      return row!.id;
    }

    it('moves the booking, its request and its held date to yesterday in UTC', async () => {
      const bookingId = await insertBooking('2027-01-20');

      const result = await shiftBookingIntoPast(database.db, { bookingId, now: NOW });

      expect(result).toEqual({ eventDate: '2026-09-13' });

      const [booking] = await database.db
        .select({ eventDate: bookings.eventDate })
        .from(bookings)
        .where(eq(bookings.id, bookingId));
      expect(booking?.eventDate).toBe('2026-09-13');

      const [request] = await database.db
        .select({ eventDate: bookingRequests.eventDate })
        .from(bookingRequests)
        .where(eq(bookingRequests.id, seeded.bookingRequestId!));
      expect(request?.eventDate).toBe('2026-09-13');

      const held = await database.db
        .select({ date: availability.date, status: availability.status })
        .from(availability)
        .where(eq(availability.vendorId, seeded.vendorProfileId));
      expect(held).toEqual([{ date: '2026-09-13', status: 'booked' }]);
    });

    /*
     * Reruns on one day all shift onto the same yesterday, so the held row for
     * it may already exist — the second shift must not die on
     * `availability_vendor_date_key`.
     */
    it('survives yesterday already being held by an earlier run', async () => {
      await database.db
        .insert(availability)
        .values({ vendorId: seeded.vendorProfileId, date: '2026-09-13', status: 'booked' });
      const bookingId = await insertBooking('2027-01-20');

      await shiftBookingIntoPast(database.db, { bookingId, now: NOW });

      const future = await database.db
        .select()
        .from(availability)
        .where(
          and(
            eq(availability.vendorId, seeded.vendorProfileId),
            eq(availability.date, '2027-01-20'),
          ),
        );
      expect(future).toEqual([]);
    });

    it('refuses a booking id that does not exist', async () => {
      await expect(
        shiftBookingIntoPast(database.db, {
          bookingId: '00000000-0000-4000-8000-000000000000',
          now: NOW,
        }),
      ).rejects.toThrow('No booking 00000000-0000-4000-8000-000000000000');
    });
  });
});
