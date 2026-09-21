import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, refusalOf, type TestDatabase } from './testing/test-db.js';

/**
 * VEN-550: no money or count column can hold an impossible amount, proved by
 * inserting the violating row directly and reading the constraint the engine
 * names.
 */
const CUSTOMER = '33333333-3333-4333-8333-333333333333';
const VENDOR_USER = '11111111-1111-4111-8111-111111111111';
const VENDOR = '22222222-2222-4222-8222-222222222222';

interface BookingAmounts {
  total?: number;
  fee?: number;
  payout?: number;
  refund?: number | null;
  external?: number;
}

interface RequestColumns {
  quoted?: number;
  final?: number;
  guests?: number;
}

let testDb: TestDatabase;
let seq = 0;

function nextDate(): string {
  seq += 1;

  return new Date(Date.UTC(2040, 0, 1 + seq)).toISOString().slice(0, 10);
}

function insertRequest(columns: RequestColumns, id = crypto.randomUUID()): string {
  const value = (v: number | undefined): string => (v === undefined ? 'NULL' : String(v));

  return `INSERT INTO booking_requests (id, customer_id, vendor_id, event_date, quoted_price_cents, final_price_cents, guest_count)
          VALUES ('${id}', '${CUSTOMER}', '${VENDOR}', '${nextDate()}', ${value(columns.quoted)}, ${value(columns.final)}, ${value(columns.guests)})`;
}

async function insertBooking(amounts: BookingAmounts): Promise<string> {
  const requestId = crypto.randomUUID();
  await testDb.db.execute(sql.raw(insertRequest({}, requestId)));

  return `INSERT INTO bookings (request_id, customer_id, vendor_id, event_date, total_amount_cents, platform_fee_cents, vendor_payout_cents, refund_amount_cents, external_refund_cents)
          VALUES ('${requestId}', '${CUSTOMER}', '${VENDOR}', '${nextDate()}', ${amounts.total ?? 10000}, ${amounts.fee ?? 1000}, ${amounts.payout ?? 9000}, ${amounts.refund ?? 'NULL'}, ${amounts.external ?? 0})`;
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();
  await testDb.db.execute(
    sql.raw(`INSERT INTO users (id, auth_user_id, email, role, first_name, last_name) VALUES
      ('${VENDOR_USER}', 'auth_vendor', 'vendor@example.com', 'vendor', 'June', 'Harlow'),
      ('${CUSTOMER}', 'auth_customer', 'customer@example.com', 'customer', 'Ada', 'Reyes')`),
  );
  await testDb.db.execute(
    sql.raw(`INSERT INTO vendor_profiles (id, user_id, business_name, slug)
             VALUES ('${VENDOR}', '${VENDOR_USER}', 'June Harlow Photography', 'june-harlow')`),
  );
});

afterAll(async () => {
  await testDb.close();
});

describe('bookings money columns', () => {
  it.each<[string, string, BookingAmounts]>([
    ['bookings_total_amount_cents_positive', 'a zero total', { total: 0, fee: 0, payout: 0 }],
    ['bookings_total_amount_cents_positive', 'a negative total', { total: -1, fee: 0, payout: 0 }],
    ['bookings_platform_fee_cents_non_negative', 'a negative fee', { fee: -1 }],
    ['bookings_vendor_payout_cents_non_negative', 'a negative payout', { payout: -450 }],
    ['bookings_refund_amount_cents_range', 'a negative refund', { refund: -1 }],
    ['bookings_refund_amount_cents_range', 'a refund above the total', { refund: 10001 }],
    ['bookings_external_refund_cents_non_negative', 'a negative external refund', { external: -1 }],
  ])('names %s for %s', async (constraint, _label, amounts) => {
    expect(await refusalOf(testDb.db, await insertBooking(amounts))).toContain(constraint);
  });

  it.each<[string, BookingAmounts]>([
    ['a refund equal to the total', { refund: 10000 }],
    ['a zero refund', { refund: 0 }],
    ['no refund', { refund: null }],
    ['a zero payout after a full refund', { payout: 0, refund: 10000 }],
    ['a zero fee', { fee: 0, payout: 10000 }],
    ['a payout rewritten below total minus fee, as a cancellation leaves it', { payout: 450 }],
    ['an external refund with a retained payout', { payout: 450, external: 2500 }],
  ])('accepts %s', async (_label, amounts) => {
    await testDb.db.execute(sql.raw(await insertBooking(amounts)));
  });
});

describe('booking_requests money and count columns', () => {
  it.each<[string, RequestColumns]>([
    ['booking_requests_quoted_price_cents_non_negative', { quoted: -1 }],
    ['booking_requests_final_price_cents_non_negative', { final: -1 }],
    ['booking_requests_guest_count_non_negative', { guests: -1 }],
  ])('names %s', async (constraint, columns) => {
    expect(await refusalOf(testDb.db, insertRequest(columns))).toContain(constraint);
  });

  it.each<[string, RequestColumns]>([
    ['all null', {}],
    ['zeros', { quoted: 0, final: 0, guests: 0 }],
    ['ordinary values', { quoted: 250000, final: 250000, guests: 120 }],
  ])('accepts %s', async (_label, columns) => {
    await testDb.db.execute(sql.raw(insertRequest(columns)));
  });
});
