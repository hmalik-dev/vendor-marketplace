import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { settledBookings, taxYearsWithSettledBookings } from './tax-reporting.dao.js';

/**
 * The year bounds are compared against `settledAtExpr`, a raw `sql` template
 * with no column behind it, so Drizzle has no encoder for the value bound next
 * to it. PGlite accepts a bare `Date` there; the postgres-js driver the API
 * runs on refuses it ("The "string" argument must be of type string or an
 * instance of Buffer or ArrayBuffer. Received an instance of Date") and every
 * statement download and the admin 1099-K export answered 500.
 *
 * Parameters are encoded when the statement is bound, so an empty table is
 * enough to prove the query runs on the real driver; the row values and the
 * year boundaries are pinned by the route suite.
 */
describe('the settled-booking queries on the postgres-js driver', () => {
  let database: PostgresTestDatabase | undefined;

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 2 });
  });

  afterAll(async () => {
    await database?.close();
  });

  it('runs the year window for one vendor and for every vendor', async () => {
    await expect(settledBookings(database!.db, 2026)).resolves.toEqual([]);
    await expect(
      settledBookings(database!.db, 2026, '00000000-0000-4000-8000-000000000001'),
    ).resolves.toEqual([]);
  });

  it('lists no years for an empty table', async () => {
    await expect(taxYearsWithSettledBookings(database!.db)).resolves.toEqual([]);
  });
});
