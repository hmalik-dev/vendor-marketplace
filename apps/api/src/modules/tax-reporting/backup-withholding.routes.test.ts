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
import type Stripe from 'stripe';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { taxIdStateFrom } from '../../lib/stripe.js';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

const ADMIN = 'user_bw_admin';
const VENDOR = 'user_bw_vendor';
const CUSTOMER = 'user_bw_customer';
const NOW = new Date('2027-02-01T12:00:00Z');
const ACCOUNT = 'acct_bw_vendor';

/**
 * VEN-723 (D49): an admin switches backup withholding on and off for a vendor,
 * behind a fresh step-up and the hourly ceiling, with one audit row per change.
 */
describe('PUT /admin/vendors/:vendorId/backup-withholding', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function emailedStepUp(authUserId: string): Promise<void> {
    await harness.app.inject({
      method: 'POST',
      url: '/v1/admin/step-up/challenge',
      headers: bearer(authUserId),
    });
    const message = [...harness.email.sent]
      .reverse()
      .find((sent) => sent.to === `${authUserId}@example.com`);
    const code = /\b(\d{6})\b/.exec(message?.text ?? '')?.[1];
    const response = await harness.app.inject({
      method: 'POST',
      url: '/v1/admin/step-up/verify',
      headers: bearer(authUserId),
      payload: { code },
    });

    expect(response.statusCode).toBe(200);
  }

  async function vendorProfile(): Promise<{ id: string; userId: string }> {
    await signInAs(harness, VENDOR);
    const created = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Studio Withholding',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
      },
    });

    expect(created.statusCode).toBe(201);

    const [profile] = await harness.database.db
      .select({ id: vendorProfiles.id, userId: vendorProfiles.userId })
      .from(vendorProfiles);

    await harness.database.db
      .update(vendorProfiles)
      .set({ stripeAccountId: ACCOUNT })
      .where(eq(vendorProfiles.id, profile!.id));

    return profile!;
  }

  const put = (authUserId: string, vendorId: string, payload: Record<string, unknown>) =>
    harness.app.inject({
      method: 'PUT',
      url: `/v1/admin/vendors/${vendorId}/backup-withholding`,
      headers: bearer(authUserId),
      payload,
    });

  const SET = { withholding: true, reason: 'irs_notice', noticeDate: '2027-01-20' } as const;

  async function rowsFor(
    action: 'vendor_backup_withholding_set' | 'vendor_backup_withholding_cleared',
  ) {
    return harness.database.db.select().from(adminActions).where(eq(adminActions.action, action));
  }

  async function stored(vendorId: string) {
    const [row] = await harness.database.db
      .select({
        reason: vendorProfiles.backupWithholdingReason,
        noticeDate: vendorProfiles.backupWithholdingNoticeDate,
      })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendorId));

    return row;
  }

  beforeAll(async () => {
    harness = await createTestHarness({ enforceStepUp: true, clock: () => NOW });

    for (const [authUserId, role] of [
      [ADMIN, 'customer'],
      [VENDOR, 'vendor'],
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
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    harness.email.sent.length = 0;
    harness.stripe.taxIdStates.clear();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('switches it on with its reason and notice date, and writes one audit row', async () => {
    const vendor = await vendorProfile();
    const adminId = await signInAs(harness, ADMIN, true);
    await emailedStepUp(ADMIN);

    const response = await put(ADMIN, vendor.id, SET);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      vendorId: vendor.id,
      backupWithholding: { reason: 'irs_notice', noticeDate: '2027-01-20' },
    });
    expect(await stored(vendor.id)).toEqual({ reason: 'irs_notice', noticeDate: '2027-01-20' });

    const rows = await rowsFor('vendor_backup_withholding_set');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: adminId,
      subjectType: 'vendor_profile',
      subjectId: vendor.id,
      detail: { reason: 'irs_notice', noticeDate: '2027-01-20', rateBps: 2400 },
    });
  });

  it('asks a session with no fresh step-up for one, and changes nothing', async () => {
    const vendor = await vendorProfile();
    await signInAs(harness, ADMIN, true);

    const response = await put(ADMIN, vendor.id, SET);

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe(ERROR_CODES.STEP_UP_REQUIRED);
    expect(await stored(vendor.id)).toEqual({ reason: null, noticeDate: null });
    expect(await rowsFor('vendor_backup_withholding_set')).toHaveLength(0);
  });

  it('refuses a vendor, a customer and a signed-out caller', async () => {
    const vendor = await vendorProfile();
    await signInAs(harness, CUSTOMER);

    expect((await put(VENDOR, vendor.id, SET)).statusCode).toBe(403);
    expect((await put(CUSTOMER, vendor.id, SET)).statusCode).toBe(403);
    expect(
      (
        await harness.app.inject({
          method: 'PUT',
          url: `/v1/admin/vendors/${vendor.id}/backup-withholding`,
          payload: SET,
        })
      ).statusCode,
    ).toBe(401);
    expect(await stored(vendor.id)).toEqual({ reason: null, noticeDate: null });
  });

  it('refuses switching it on twice, and clearing it when it is off, with a 409', async () => {
    const vendor = await vendorProfile();
    await signInAs(harness, ADMIN, true);
    await emailedStepUp(ADMIN);

    expect(
      (await put(ADMIN, vendor.id, { withholding: false, receivedDate: '2027-01-25' })).statusCode,
    ).toBe(409);
    expect((await put(ADMIN, vendor.id, SET)).statusCode).toBe(200);
    expect((await put(ADMIN, vendor.id, SET)).statusCode).toBe(409);
    expect(await rowsFor('vendor_backup_withholding_set')).toHaveLength(1);
    expect(await rowsFor('vendor_backup_withholding_cleared')).toHaveLength(0);
  });

  it('refuses clearing without the date the corrected TIN was received (400), and keeps it on', async () => {
    const vendor = await vendorProfile();
    await signInAs(harness, ADMIN, true);
    await emailedStepUp(ADMIN);
    await put(ADMIN, vendor.id, SET);

    const response = await put(ADMIN, vendor.id, { withholding: false });

    expect(response.statusCode).toBe(400);
    expect(await stored(vendor.id)).toEqual({ reason: 'irs_notice', noticeDate: '2027-01-20' });
    expect(await rowsFor('vendor_backup_withholding_cleared')).toHaveLength(0);
  });

  it('clears it with the received date, recording the reason and notice it ended', async () => {
    const vendor = await vendorProfile();
    await signInAs(harness, ADMIN, true);
    await emailedStepUp(ADMIN);
    await put(ADMIN, vendor.id, SET);

    const response = await put(ADMIN, vendor.id, {
      withholding: false,
      receivedDate: '2027-01-30',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ vendorId: vendor.id, backupWithholding: null });
    expect(await stored(vendor.id)).toEqual({ reason: null, noticeDate: null });
    expect((await rowsFor('vendor_backup_withholding_cleared'))[0]).toMatchObject({
      subjectId: vendor.id,
      detail: { receivedDate: '2027-01-30', reason: 'irs_notice', noticeDate: '2027-01-20' },
    });
  });

  it('refuses a date in the future, an unknown reason and an unknown vendor', async () => {
    const vendor = await vendorProfile();
    await signInAs(harness, ADMIN, true);
    await emailedStepUp(ADMIN);

    expect((await put(ADMIN, vendor.id, { ...SET, noticeDate: '2027-02-02' })).statusCode).toBe(
      400,
    );
    expect((await put(ADMIN, vendor.id, { ...SET, reason: 'because' })).statusCode).toBe(400);
    expect((await put(ADMIN, '00000000-0000-4000-8000-000000000000', SET)).statusCode).toBe(404);
    expect(await stored(vendor.id)).toEqual({ reason: null, noticeDate: null });
  });

  it('counts against the hourly ceiling shared with the other destructive actions', async () => {
    const vendor = await vendorProfile();
    const adminId = await signInAs(harness, ADMIN, true);
    await emailedStepUp(ADMIN);
    await harness.database.db.insert(adminActions).values(
      Array.from({ length: ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR }, () => ({
        actorId: adminId,
        action: 'vendor_backup_withholding_set' as const,
        subjectType: 'vendor_profile' as const,
        subjectId: vendor.id,
        createdAt: new Date(NOW.getTime() - 60_000),
      })),
    );

    const response = await put(ADMIN, vendor.id, SET);

    expect(response.statusCode).toBe(429);
    expect(response.json().error).toBe(ERROR_CODES.ADMIN_CEILING_REACHED);
    expect(await stored(vendor.id)).toEqual({ reason: null, noticeDate: null });
  });

  describe('what the admin sees on the vendor', () => {
    it('reads the tax ID state from Stripe and the withholding from the row, and never a number', async () => {
      const vendor = await vendorProfile();
      await signInAs(harness, ADMIN, true);
      await emailedStepUp(ADMIN);
      harness.stripe.taxIdStates.set(ACCOUNT, 'mismatch');
      await put(ADMIN, vendor.id, SET);

      const detail = await harness.app.inject({
        method: 'GET',
        url: `/v1/admin/vendors/${vendor.id}`,
        headers: bearer(ADMIN),
      });

      expect(detail.statusCode).toBe(200);
      expect(detail.json().vendor).toMatchObject({
        taxIdState: 'mismatch',
        backupWithholding: { reason: 'irs_notice', noticeDate: '2027-01-20' },
      });
      expect(detail.body).not.toMatch(/\b\d{9}\b|\d{3}-\d{2}-\d{4}/);
    });

    /*
     * Fed the real reducer a v1 account payload that carries every number Stripe
     * can hold, so this fails the day someone spreads the account, or a field of
     * it, into the response.
     */
    it('carries none of the digits Stripe holds when the real account payload has them', async () => {
      const vendor = await vendorProfile();
      await signInAs(harness, ADMIN, true);
      const original = harness.stripe.readTaxIdState;
      harness.stripe.readTaxIdState = async () =>
        taxIdStateFrom({
          individual: {
            id_number_provided: true,
            ssn_last_4_provided: true,
            ssn_last_4: '6789',
            id_number: '123456789',
            address: { line1: '1600 Pennsylvania Ave', postal_code: '20500' },
          },
          company: { tax_id_provided: true, tax_id: '12-3456789' },
          capabilities: { tax_reporting_us_1099_k: 'active' },
          requirements: { currently_due: [], errors: [] },
        } as unknown as Stripe.Account);

      try {
        const detail = await harness.app.inject({
          method: 'GET',
          url: `/v1/admin/vendors/${vendor.id}`,
          headers: bearer(ADMIN),
        });

        expect(detail.json().vendor.taxIdState).toBe('verified');
        expect(detail.body).not.toMatch(/6789|123456789|12-3456789|20500|Pennsylvania/);
      } finally {
        harness.stripe.readTaxIdState = original;
      }
    });

    it('reads no tax ID state for a vendor with no connected account', async () => {
      const vendor = await vendorProfile();
      await signInAs(harness, ADMIN, true);
      const read = async () =>
        (
          await harness.app.inject({
            method: 'GET',
            url: `/v1/admin/vendors/${vendor.id}`,
            headers: bearer(ADMIN),
          })
        ).json().vendor.taxIdState;

      harness.stripe.taxIdStates.set(ACCOUNT, 'verified');
      expect(await read()).toBe('verified');

      await harness.database.db
        .update(vendorProfiles)
        .set({ stripeAccountId: null })
        .where(eq(vendorProfiles.id, vendor.id));
      expect(await read()).toBeNull();
    });
  });
});
