import { createHash } from 'node:crypto';
import {
  adminActions,
  bookingRequests,
  bookings,
  categories,
  users,
  vendorCategories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR, ERROR_CODES } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';
import { foldTaxYearFigures, render1099kCsv, TAX_1099K_HEADER } from './tax-reporting.service.js';

const ADMIN = 'user_tax_admin';
const VENDOR = 'user_tax_vendor';
const REFUNDED_VENDOR = 'user_tax_refunded_vendor';
const CUSTOMER = 'user_tax_customer';
const NOW = new Date('2027-02-01T12:00:00Z');

/** Cents for `$x`, so a fixture reads like the ticket. */
const usd = (dollars: number): number => dollars * 100;

/**
 * VEN-722 (D49): the January 1099-K figures, from Orla's own booking records,
 * behind admin, step-up and the export ceiling, audited once per download.
 */
describe('GET /admin/tax/1099-k.csv', () => {
  let harness: TestHarness;
  let photographyId: string;
  let seq = 0;

  async function emailedStepUp(authUserId: string): Promise<void> {
    await harness.app.inject({
      method: 'POST',
      url: '/v1/admin/step-up/challenge',
      headers: bearer(authUserId),
    });
    const message = [...harness.email.sent]
      .reverse()
      .find((m) => m.to === `${authUserId}@example.com`);
    const code = /\b(\d{6})\b/.exec(message?.text ?? '')?.[1];
    const response = await harness.app.inject({
      method: 'POST',
      url: '/v1/admin/step-up/verify',
      headers: bearer(authUserId),
      payload: { code },
    });
    expect(response.statusCode).toBe(200);
  }

  async function vendorProfile(authUserId: string, stripeAccountId: string) {
    await signInAs(harness, authUserId);
    const created = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/profile',
      headers: bearer(authUserId),
      payload: {
        businessName: `Studio ${authUserId}`,
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
      },
    });
    expect(created.statusCode).toBe(201);
    const rows = await harness.database.db
      .select({ id: vendorProfiles.id, userId: vendorProfiles.userId })
      .from(vendorProfiles);
    const profile = rows.find((row) => row.userId !== undefined && !known.has(row.id))!;
    known.add(profile.id);
    await harness.database.db
      .update(vendorProfiles)
      .set({ stripeAccountId })
      .where(eq(vendorProfiles.id, profile.id));

    return profile;
  }

  const known = new Set<string>();

  async function booking(
    customerId: string,
    vendorId: string,
    values: {
      totalCents: number;
      vendorPayoutCents: number;
      paidAt: string | null;
      refundCents?: number;
      debtNettedCents?: number;
      payoutModel?: 'destination' | 'separate';
      /** Defaults to `paidAt` for `separate` rows; `null` is charged but not yet transferred. */
      releasedAt?: string | null;
    },
  ): Promise<void> {
    seq += 1;
    const eventDate = `2026-${String((seq % 12) + 1).padStart(2, '0')}-${String(10 + Math.floor(seq / 12)).padStart(2, '0')}`;
    const [request] = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId,
        eventDate,
        status: 'accepted',
        finalPriceCents: values.totalCents,
      })
      .returning({ id: bookingRequests.id });

    await harness.database.db.insert(bookings).values({
      requestId: request!.id,
      customerId,
      vendorId,
      eventDate,
      totalAmountCents: values.totalCents,
      platformFeeCents: 0,
      vendorPayoutCents: values.vendorPayoutCents,
      refundAmountCents: values.refundCents ?? null,
      debtNettedCents: values.debtNettedCents ?? 0,
      payoutModel: values.payoutModel ?? 'separate',
      status: 'confirmed',
      stripePaymentIntentId: `pi_tax_${seq}`,
      stripeTransferId: values.vendorPayoutCents > 0 ? `tr_tax_${seq}` : null,
      paidAt: values.paidAt ? new Date(values.paidAt) : null,
      // The sweep writes the release with the transfer id; `destination` rows never have one.
      payoutReleasedAt:
        values.releasedAt === undefined
          ? (values.payoutModel ?? 'separate') === 'separate' && values.paidAt
            ? new Date(values.paidAt)
            : null
          : values.releasedAt
            ? new Date(values.releasedAt)
            : null,
    });
  }

  const download = (authUserId: string, year: number | string) =>
    harness.app.inject({
      method: 'GET',
      url: `/v1/admin/tax/1099-k.csv?year=${year}`,
      headers: bearer(authUserId),
    });

  /** The ticket's fixture vendor, plus a vendor whose only booking was refunded in full. */
  async function seedFixture(): Promise<{ customerId: string; vendorId: string; userId: string }> {
    const customerId = await signInAs(harness, CUSTOMER);
    const vendor = await vendorProfile(VENDOR, 'acct_tax_main');

    // A: $1,000, March. B: $500 less a $250 partial refund, March. C: $2,000 less $300 netted, December.
    await booking(customerId, vendor.id, {
      totalCents: usd(1000),
      vendorPayoutCents: usd(880),
      paidAt: '2026-03-05T10:00:00Z',
    });
    await booking(customerId, vendor.id, {
      totalCents: usd(500),
      vendorPayoutCents: usd(440),
      refundCents: usd(250),
      paidAt: '2026-03-20T10:00:00Z',
      payoutModel: 'destination',
    });
    await booking(customerId, vendor.id, {
      totalCents: usd(2000),
      vendorPayoutCents: usd(1500),
      debtNettedCents: usd(300),
      paidAt: '2026-12-31T23:59:59Z',
    });
    // D: refunded in full, never paid. E: paid on 2027-01-02.
    await booking(customerId, vendor.id, {
      totalCents: usd(700),
      vendorPayoutCents: 0,
      refundCents: usd(700),
      paidAt: null,
    });
    await booking(customerId, vendor.id, {
      totalCents: usd(900),
      vendorPayoutCents: usd(800),
      paidAt: '2027-01-02T09:00:00Z',
    });

    // F: charged in December 2026, transferred in February 2027 (2027's figure). G: charged, not yet transferred (nobody's).
    await booking(customerId, vendor.id, {
      totalCents: usd(400),
      vendorPayoutCents: usd(350),
      paidAt: '2026-12-20T10:00:00Z',
      releasedAt: '2027-02-15T10:00:00Z',
    });
    await booking(customerId, vendor.id, {
      totalCents: usd(300),
      vendorPayoutCents: usd(260),
      paidAt: '2026-12-22T10:00:00Z',
      releasedAt: null,
    });

    const refunded = await vendorProfile(REFUNDED_VENDOR, 'acct_tax_refunded');
    await booking(customerId, refunded.id, {
      totalCents: usd(600),
      vendorPayoutCents: 0,
      refundCents: usd(600),
      paidAt: '2026-05-05T10:00:00Z',
    });

    return { customerId, vendorId: vendor.id, userId: vendor.userId };
  }

  beforeAll(async () => {
    harness = await createTestHarness({ enforceStepUp: true, clock: () => NOW });

    for (const [authUserId, role] of [
      [ADMIN, 'customer'],
      [VENDOR, 'vendor'],
      [REFUNDED_VENDOR, 'vendor'],
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

    const [row] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = row!.id;
  });

  afterEach(async () => {
    known.clear();
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    harness.email.sent.length = 0;
    // The admin's audit rows, step-up grants and codes go with the user row, by cascade.
  });

  afterAll(async () => {
    await harness.close();
  });

  it('pins the import header and the row for the ticket fixture', async () => {
    await seedFixture();
    await signInAs(harness, ADMIN, true);
    await emailedStepUp(ADMIN);

    const response = await download(ADMIN, 2026);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toBe('attachment; filename="1099-k-2026.csv"');

    const [header, ...rows] = response.body.trimEnd().split('\n');

    expect(header).toBe(
      'stripe_account_id,form_type,filing_requirement,gross_amount,payment_transaction_count,federal_income_tax_withheld,january_amount,february_amount,march_amount,april_amount,may_amount,june_amount,july_amount,august_amount,september_amount,october_amount,november_amount,december_amount',
    );
    // Gross $3,500.00 over three transactions: March $1,500.00, December $2,000.00. D, E and the fully refunded vendor are absent.
    expect(rows).toEqual([
      'acct_tax_main,k,REQUIRED_EVEN_IF_BELOW_THRESHOLD,3500.00,3,0.00,0.00,0.00,1500.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,2000.00',
    ]);
  });

  it('gives the same bytes and the same hash on a second download, one audit row each', async () => {
    await seedFixture();
    const adminId = await signInAs(harness, ADMIN, true);
    await emailedStepUp(ADMIN);

    const first = await download(ADMIN, 2026);
    const second = await download(ADMIN, 2026);

    expect(second.body).toBe(first.body);

    const rows = await harness.database.db
      .select()
      .from(adminActions)
      .where(eq(adminActions.action, 'tax_report_exported'));
    const digest = createHash('sha256').update(first.body).digest('hex');

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.detail)).toEqual([
      { taxYear: 2026, rowCount: 1, sha256: digest },
      { taxYear: 2026, rowCount: 1, sha256: digest },
    ]);
    expect(rows.every((row) => row.actorId === adminId)).toBe(true);
    expect(first.body).not.toMatch(/\d{3}-\d{2}-\d{4}|\b\d{9}\b/);
  });

  it('is empty of rows for a year with no settled bookings, and lists the years that have them', async () => {
    await seedFixture();
    await signInAs(harness, ADMIN, true);
    await emailedStepUp(ADMIN);

    const empty = await download(ADMIN, 2025);
    const years = await harness.app.inject({
      method: 'GET',
      url: '/v1/admin/tax/years',
      headers: bearer(ADMIN),
    });

    expect(empty.body).toBe(`${TAX_1099K_HEADER.join(',')}\n`);
    expect(years.json()).toEqual({ years: [2027, 2026] });
  });

  it('asks a session with no fresh step-up for one, and writes no audit row', async () => {
    await seedFixture();
    await signInAs(harness, ADMIN, true);

    const response = await download(ADMIN, 2026);

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe(ERROR_CODES.STEP_UP_REQUIRED);
    expect(
      await harness.database.db
        .select()
        .from(adminActions)
        .where(eq(adminActions.action, 'tax_report_exported')),
    ).toHaveLength(0);
  });

  it('refuses a vendor, a customer and a signed-out caller', async () => {
    await seedFixture();

    expect((await download(VENDOR, 2026)).statusCode).toBe(403);
    expect((await download(CUSTOMER, 2026)).statusCode).toBe(403);
    expect(
      (await harness.app.inject({ method: 'GET', url: '/v1/admin/tax/1099-k.csv?year=2026' }))
        .statusCode,
    ).toBe(401);
  });

  it('counts downloads against the hourly export ceiling', async () => {
    const adminId = await signInAs(harness, ADMIN, true);
    await emailedStepUp(ADMIN);
    await harness.database.db.insert(adminActions).values(
      Array.from({ length: ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR }, () => ({
        actorId: adminId,
        action: 'tax_report_exported' as const,
        subjectType: 'user' as const,
        subjectId: adminId,
        createdAt: new Date(NOW.getTime() - 60_000),
      })),
    );

    const response = await download(ADMIN, 2026);

    expect(response.statusCode).toBe(429);
    expect(response.json().error).toBe(ERROR_CODES.ADMIN_CEILING_REACHED);
  });

  it('rejects a year that is not a year', async () => {
    await signInAs(harness, ADMIN, true);
    await emailedStepUp(ADMIN);

    expect((await download(ADMIN, 'soon')).statusCode).toBe(400);
  });

  it('keeps a closed vendor in the export under the same connected account', async () => {
    const { userId } = await seedFixture();
    await signInAs(harness, ADMIN, true);
    await emailedStepUp(ADMIN);

    const before = await download(ADMIN, 2026);
    const closed = await harness.app.inject({
      method: 'POST',
      url: `/v1/admin/users/${userId}/close`,
      headers: bearer(ADMIN),
    });

    expect(closed.statusCode).toBe(200);
    expect(await harness.database.db.select().from(bookings)).toHaveLength(8);

    const [profile] = await harness.database.db
      .select({ stripeAccountId: vendorProfiles.stripeAccountId })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.userId, userId));
    const after = await download(ADMIN, 2026);

    expect(profile?.stripeAccountId).toBe('acct_tax_main');
    expect(after.body).toBe(before.body);
    expect(after.body).toContain('acct_tax_main,k,');
  });
});

describe('foldTaxYearFigures', () => {
  it('splits by UTC month, so the last second of December is December', () => {
    const [figures] = foldTaxYearFigures([
      {
        vendorId: 'v1',
        stripeAccountId: 'acct_1',
        totalAmountCents: 200_000,
        settledAt: new Date('2026-12-31T23:59:59Z'),
      },
      {
        vendorId: 'v1',
        stripeAccountId: 'acct_1',
        totalAmountCents: 100_000,
        settledAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);

    expect(figures?.monthlyGrossCents[0]).toBe(100_000);
    expect(figures?.monthlyGrossCents[11]).toBe(200_000);
    expect(figures?.grossCents).toBe(300_000);
    expect(figures?.transactionCount).toBe(2);
  });

  it('renders cents as exact dollars with no float rounding', () => {
    const csv = render1099kCsv([
      {
        vendorId: 'v1',
        stripeAccountId: 'acct_1',
        grossCents: 1_000_005,
        monthlyGrossCents: [1_000_005, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        transactionCount: 1,
      },
    ]);

    expect(csv.split('\n')[1]).toContain(',10000.05,1,0.00,10000.05,0.00,');
  });
});
