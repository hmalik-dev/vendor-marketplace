import {
  bookingRequests,
  bookings,
  emailDeliveries,
  operatorAlerts,
  supportCases,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, TEST_ENV, type TestHarness } from '../../testing/test-server.js';
import { alertNow } from './operator-alerts.service.js';
import {
  operatorLocalTime,
  runOperatorDigest,
  type OperatorDigestDeps,
} from './operator-digest.service.js';

/** 08:00 in New York (EDT), so the digest is due. */
const NOW = new Date('2026-09-14T12:00:00Z');
const HOUR = 60 * 60_000;
const ago = (hours: number): Date => new Date(NOW.getTime() - hours * HOUR);
const LONG_AGO = new Date('2026-01-01T00:00:00Z');

const CUSTOMER_EMAIL = 'digest-customer@example.com';
const CUSTOMER_PHONE = '+15125550199';

describe('the operator digest (VEN-405)', () => {
  let harness: TestHarness;
  const logLines: string[] = [];

  function deps(overrides: Partial<OperatorDigestDeps> = {}): OperatorDigestDeps {
    return {
      db: harness.database.db,
      email: harness.email,
      log: harness.app.log,
      background: harness.app.background,
      clock: () => NOW,
      to: TEST_ENV.OPERATOR_ALERT_EMAIL,
      webOrigin: TEST_ENV.WEB_URL,
      wait: async () => undefined,
      timeZone: 'America/New_York',
      ...overrides,
    };
  }

  /** A day's activity whose figures the assertions below can name exactly. */
  async function seedActivity(): Promise<void> {
    const db = harness.database.db;

    const [customer] = await db
      .insert(users)
      .values({
        authUserId: 'user_digest_customer',
        email: CUSTOMER_EMAIL,
        phone: CUSTOMER_PHONE,
        role: 'customer',
        firstName: 'Casey',
        lastName: 'Rivera',
        createdAt: ago(2),
      })
      .returning({ id: users.id });
    const [owner] = await db
      .insert(users)
      .values({
        authUserId: 'user_digest_vendor',
        email: 'digest-vendor@example.com',
        role: 'vendor',
        firstName: 'Wren',
        lastName: 'Field',
        createdAt: ago(3),
      })
      .returning({ id: users.id });
    // Signed up before the window, so not counted.
    await db.insert(users).values({
      authUserId: 'user_digest_old',
      email: 'digest-old@example.com',
      role: 'customer',
      firstName: 'Old',
      lastName: 'Timer',
      createdAt: LONG_AGO,
    });

    const [vendor] = await db
      .insert(vendorProfiles)
      .values({ userId: owner!.id, businessName: 'Wren & Field', slug: 'wren-field-digest' })
      .returning({ id: vendorProfiles.id });

    const request = async (values: {
      eventDate: string;
      status: 'accepted' | 'pending';
      createdAt: Date;
    }): Promise<string> => {
      const [row] = await db
        .insert(bookingRequests)
        .values({ customerId: customer!.id, vendorId: vendor!.id, ...values })
        .returning({ id: bookingRequests.id });
      return row!.id;
    };

    const booking = async (
      requestId: string,
      values: Partial<typeof bookings.$inferInsert>,
    ): Promise<void> => {
      await db.insert(bookings).values({
        requestId,
        customerId: customer!.id,
        vendorId: vendor!.id,
        eventDate: '2026-10-01',
        totalAmountCents: 10_000,
        platformFeeCents: 0,
        vendorPayoutCents: 0,
        ...values,
      });
    };

    // The one request made inside the window; the rest are older.
    await request({ eventDate: '2026-11-01', status: 'pending', createdAt: ago(1) });

    await booking(
      await request({ eventDate: '2026-10-01', status: 'accepted', createdAt: LONG_AGO }),
      {
        totalAmountCents: 120_000,
        paidAt: ago(5),
      },
    );
    await booking(
      await request({ eventDate: '2026-10-02', status: 'accepted', createdAt: LONG_AGO }),
      {
        eventDate: '2026-10-02',
        totalAmountCents: 45_050,
        vendorPayoutCents: 39_644,
        paidAt: ago(6),
        payoutReleasedAt: ago(2),
      },
    );
    await booking(
      await request({ eventDate: '2026-10-03', status: 'accepted', createdAt: LONG_AGO }),
      {
        totalAmountCents: 45_050,
        paidAt: ago(48),
        status: 'cancelled',
        cancelledAt: ago(1),
        refundAmountCents: 22_525,
      },
    );

    // Accepted and unpaid: tomorrow counts, next week does not.
    const unpaidId = await request({
      eventDate: '2026-09-15',
      status: 'accepted',
      createdAt: LONG_AGO,
    });
    await request({ eventDate: '2026-09-21', status: 'accepted', createdAt: LONG_AGO });

    await db.insert(supportCases).values([
      { reference: 'ORL-DGST-01', origin: 'support_message', message: 'm', createdAt: ago(2) },
      { reference: 'ORL-DGST-02', origin: 'support_message', message: 'm', createdAt: ago(40) },
      { reference: 'ORL-DGST-03', origin: 'support_message', message: 'm', createdAt: ago(100) },
      {
        reference: 'ORL-DGST-04',
        origin: 'support_message',
        message: 'm',
        status: 'resolved',
        createdAt: ago(2),
      },
    ]);

    await db.insert(emailDeliveries).values({
      notificationId: '00000000-0000-4000-8000-000000000001',
      userId: customer!.id,
      recipientEmail: CUSTOMER_EMAIL,
      notificationType: 'booking_confirmed',
      outcome: 'bounced',
      outcomeUpdatedAt: ago(1),
    });

    expectedUnpaidId = unpaidId;
  }

  let expectedUnpaidId = '';

  beforeAll(async () => {
    harness = await createTestHarness({
      loggerStream: new Writable({
        write(chunk: Buffer, _encoding, done) {
          logLines.push(chunk.toString());
          done();
        },
      }),
      env: { LOG_LEVEL: 'warn' },
    });
  });

  afterEach(async () => {
    const db = harness.database.db;
    await db.delete(operatorAlerts);
    await db.delete(emailDeliveries);
    await db.delete(supportCases);
    await db.delete(bookings);
    await db.delete(bookingRequests);
    await db.delete(vendorProfiles);
    await db.delete(users);
    harness.email.sent.length = 0;
    logLines.length = 0;
  });

  afterAll(async () => {
    await harness.close();
  });

  it("reads the operator's date and hour in their own zone", () => {
    expect(operatorLocalTime(NOW, 'America/New_York')).toEqual({ date: '2026-09-14', hour: 8 });
    expect(operatorLocalTime(new Date('2026-09-14T02:00:00Z'), 'America/New_York')).toEqual({
      date: '2026-09-13',
      hour: 22,
    });
    expect(() => operatorLocalTime(NOW, 'Mars/Olympus_Mons')).toThrow(RangeError);
  });

  it('is not due before 07:00 local time', async () => {
    await seedActivity();

    expect(await runOperatorDigest(deps(), new Date('2026-09-14T10:59:00Z'))).toBe('not-due');
    expect(harness.email.sent).toEqual([]);
  });

  it('sends on an empty day too, so its absence means the timer stopped', async () => {
    expect(await runOperatorDigest(deps(), NOW)).toBe('sent');

    expect(harness.email.sent).toHaveLength(1);
    expect(harness.email.sent[0]!.text.split('\n')).toEqual([
      'Daily digest for 2026-09-14',
      '',
      'Nothing to report: the digest ran and the last day was quiet',
      'Last 24 hours',
      'New sign-ups: none',
      'Booking requests: 0',
      'Payments: 0 totalling $0',
      'Refunds: 0 totalling $0',
      'Payouts released: 0 totalling $0',
      'Bounced emails: 0',
      'Open cases',
      'Under 1 day: 0; 1–3 days: 0; over 3 days: 0',
      'Accepted but unpaid, event in the next 48 hours: 0',
      'Payouts overdue (due more than one sweep interval ago, still unreleased): 0',
      `Open: ${TEST_ENV.WEB_URL}/admin`,
    ]);

    // One digest a day: a second tick, or activity arriving later, sends nothing more.
    await seedActivity();
    expect(await runOperatorDigest(deps(), new Date(NOW.getTime() + 4 * HOUR))).toBe(
      'already-claimed',
    );
    expect(harness.email.sent).toHaveLength(1);
  });

  it('counts a booking whose payout came due before the last sweep interval and is still unreleased', async () => {
    await seedActivity();
    const db = harness.database.db;
    const [vendor] = await db.select({ id: vendorProfiles.id }).from(vendorProfiles);
    const [customer] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'customer'));
    const overdue = async (
      eventDate: string,
      values: Partial<typeof bookings.$inferInsert> = {},
    ) => {
      const [request] = await db
        .insert(bookingRequests)
        .values({
          customerId: customer!.id,
          vendorId: vendor!.id,
          eventDate,
          status: 'accepted',
          createdAt: LONG_AGO,
        })
        .returning({ id: bookingRequests.id });
      await db.insert(bookings).values({
        requestId: request!.id,
        customerId: customer!.id,
        vendorId: vendor!.id,
        eventDate,
        status: 'confirmed',
        payoutModel: 'separate',
        totalAmountCents: 10_000,
        platformFeeCents: 1_000,
        vendorPayoutCents: 9_000,
        paidAt: LONG_AGO,
        ...values,
      });
    };

    // Two unreleased events whose payout window closed long before the last sweep interval.
    await overdue('2026-08-01');
    await overdue('2026-08-02');
    // Not counted: already released, and an event too recent to be due.
    await overdue('2026-08-03', { payoutReleasedAt: ago(30) });
    await overdue('2026-09-13');

    expect(await runOperatorDigest(deps(), NOW)).toBe('sent');

    const lines = harness.email.sent[0]!.text.split('\n');
    expect(lines).toContain(
      'Payouts overdue (due more than one sweep interval ago, still unreleased): 2',
    );
    expect(lines).not.toContain('Nothing to report: the digest ran and the last day was quiet');
  });

  it('sends one digest whose totals equal the seeded rows', async () => {
    await seedActivity();

    expect(await runOperatorDigest(deps(), NOW)).toBe('sent');
    expect(await runOperatorDigest(deps(), new Date(NOW.getTime() + HOUR))).toBe('already-claimed');

    expect(harness.email.sent).toHaveLength(1);
    const [digest] = harness.email.sent;
    expect(digest!.to).toBe(TEST_ENV.OPERATOR_ALERT_EMAIL);
    expect(digest!.subject).toBe('[Orla ops] Daily digest for 2026-09-14');
    expect(digest!.text.split('\n')).toEqual([
      'Daily digest for 2026-09-14',
      '',
      'Last 24 hours',
      'New sign-ups: 1 customer, 1 vendor',
      'Booking requests: 1',
      'Payments: 2 totalling $1,650.50',
      'Refunds: 1 totalling $225.25',
      'Payouts released: 1 totalling $396.44',
      'Bounced emails: 1',
      'Open cases',
      'Under 1 day: 1; 1–3 days: 1; over 3 days: 1',
      'Accepted but unpaid, event in the next 48 hours: 1',
      `  Request ${expectedUnpaidId}, event 2026-09-15`,
      'Payouts overdue (due more than one sweep interval ago, still unreleased): 0',
      `Open: ${TEST_ENV.WEB_URL}/admin`,
    ]);
  });

  it('puts no customer email address or phone number in the digest', async () => {
    await seedActivity();

    expect(await runOperatorDigest(deps(), NOW)).toBe('sent');

    const [digest] = harness.email.sent;
    for (const part of [digest!.subject, digest!.text, digest!.html]) {
      expect(part).not.toContain(CUSTOMER_EMAIL);
      expect(part).not.toContain(CUSTOMER_PHONE);
    }
  });

  it('gives the claim back when the send fails, so a later tick retries', async () => {
    await seedActivity();
    harness.email.failNext = true;

    expect(await runOperatorDigest(deps(), NOW)).toBe('failed');
    expect(await harness.database.db.select().from(operatorAlerts)).toEqual([]);

    expect(await runOperatorDigest(deps(), NOW)).toBe('sent');
    expect(harness.email.sent).toHaveLength(1);
  });

  it('logs rather than sends when no operator address is configured', async () => {
    await seedActivity();

    expect(await runOperatorDigest(deps({ to: undefined }), NOW)).toBe('logged');
    expect(
      await alertNow(deps({ to: undefined }), {
        kind: 'launch_switch_flipped',
        subjectId: 'payouts',
        summary: 'Payouts paused',
        details: ['Payouts were paused.'],
        adminPath: null,
      }),
    ).toBe('logged');

    expect(harness.email.sent).toEqual([]);
    expect(logLines.join('')).toContain('Operator digest (OPERATOR_ALERT_EMAIL is not set');
    expect(logLines.join('')).toContain('Operator alert (OPERATOR_ALERT_EMAIL is not set');
    expect(logLines.join('')).not.toContain(CUSTOMER_EMAIL);
  });
});
