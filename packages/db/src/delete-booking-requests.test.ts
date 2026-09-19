import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteBookingRequests } from './delete-booking-requests.js';
import { bookingRequests, conversations } from './schema/index.js';
import { seedBookingActors } from './testing/booking-actors.js';
import { createTestDatabase, type TestDatabase } from './testing/test-db.js';

let testDb: TestDatabase;
let customerId: string;
let vendorId: string;
let packageId: string;

/** Two unpaid requests from one customer to one vendor, each with its own thread. */
async function twoRequestsWithThreads(): Promise<string[]> {
  const requests = await testDb.db
    .insert(bookingRequests)
    .values(
      ['2027-03-14', '2027-03-21'].map((eventDate) => ({
        customerId,
        vendorId,
        packageId,
        eventDate,
        status: 'pending' as const,
      })),
    )
    .returning({ id: bookingRequests.id });

  await testDb.db
    .insert(conversations)
    .values(requests.map((request) => ({ customerId, vendorId, bookingRequestId: request.id })));

  return requests.map((request) => request.id);
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();

  ({ customerId, vendorId, packageId } = await seedBookingActors(testDb.db, 'delete-requests'));
});

beforeEach(async () => {
  await testDb.db.delete(conversations);
  await testDb.db.delete(bookingRequests);
});

afterAll(async () => {
  await testDb.close();
});

describe('deleteBookingRequests', () => {
  /** The failure this helper exists for, so the fix is not a green over nothing. */
  it('is needed: a plain delete of both requests trips the one-open-thread key', async () => {
    await twoRequestsWithThreads();

    await expect(testDb.db.delete(bookingRequests)).rejects.toThrow();
  });

  it('deletes both requests and their threads without a unique violation', async () => {
    const ids = await twoRequestsWithThreads();

    await deleteBookingRequests(testDb.db, eq(bookingRequests.customerId, customerId));

    expect(await testDb.db.select().from(bookingRequests)).toEqual([]);
    expect(await testDb.db.select().from(conversations)).toEqual([]);
    expect(ids).toHaveLength(2);
  });

  it('leaves the threads of requests it was not asked to delete', async () => {
    const [first, second] = await twoRequestsWithThreads();

    await deleteBookingRequests(testDb.db, eq(bookingRequests.id, first!));

    expect((await testDb.db.select().from(bookingRequests)).map((row) => row.id)).toEqual([second]);
    expect(
      (await testDb.db.select().from(conversations)).map((row) => row.bookingRequestId),
    ).toEqual([second]);
  });
});
