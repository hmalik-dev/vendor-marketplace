import {
  adminActions,
  bookingRequests,
  bookings,
  categories,
  users,
  vendorCategories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { STEP_UP_MAX_ATTEMPTS } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';
import { OPERATOR_SELF_CLOSURE_REFUSAL, closeOwnAccount } from '../admin/data-rights.service.js';
import { bookingContextFor } from '../payments/payments.service.js';

const ADMIN = 'user_own_close_admin';
const CUSTOMER = 'user_own_close_customer';
const OPERATOR_CLOSED = 'user_own_close_by_operator';
const VENDOR = 'user_own_close_vendor';
const ADDRESS = (authUserId: string): string => `${authUserId}@example.com`;
const WEB_ORIGIN = 'https://orla.test';

/**
 * VEN-680: a customer or vendor closes their own account, after typing their
 * address back and spending an emailed code. The closure core is the
 * operator's, so most of what is asserted here is what differs: who may call
 * it, what proves them, and what a wrong proof costs.
 */
describe('a person closes their own account', () => {
  let harness: TestHarness;
  let photographyId: string;

  const signIn = (authUserId: string, admin = false): Promise<string> =>
    signInAs(harness, authUserId, admin);

  function register(authUserId: string, role: 'customer' | 'vendor'): void {
    harness.authUsers.set(authUserId, {
      authUserId,
      email: ADDRESS(authUserId),
      firstName: 'Test',
      lastName: 'User',
      roleHint: role,
      avatarUrl: null,
    });
  }

  function emailedCode(authUserId: string): string {
    const message = [...harness.email.sent].reverse().find((m) => m.to === ADDRESS(authUserId));
    const code = /\b(\d{6})\b/.exec(message?.text ?? '')?.[1];
    if (!code) {
      throw new Error(`No code was emailed to ${authUserId}`);
    }
    return code;
  }

  async function requestCode(authUserId: string): Promise<void> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/v1/users/me/close/challenge',
      headers: bearer(authUserId),
    });
    expect(response.statusCode).toBe(200);
  }

  function close(authUserId: string, email: string, code: string) {
    return harness.app.inject({
      method: 'POST',
      url: '/v1/users/me/close',
      headers: bearer(authUserId),
      payload: { email, code },
    });
  }

  async function row(userId: string) {
    const [found] = await harness.database.db.select().from(users).where(eq(users.id, userId));
    return found!;
  }

  async function createVendorProfile(): Promise<{
    profileId: string;
    userId: string;
    slug: string;
  }> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
      },
    });
    expect(created.statusCode).toBe(201);

    const [profile] = await harness.database.db
      .select({ id: vendorProfiles.id, userId: vendorProfiles.userId, slug: vendorProfiles.slug })
      .from(vendorProfiles)
      .limit(1);
    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_own_close' })
      .where(eq(vendorProfiles.id, profile!.id));

    return { profileId: profile!.id, userId: profile!.userId, slug: profile!.slug };
  }

  async function createBooking(
    customerId: string,
    vendorProfileId: string,
    eventDate: string,
    paymentIntentId?: string,
  ): Promise<string> {
    const [request] = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId: vendorProfileId,
        eventDate,
        eventLocation: '4 Nueces St, Austin',
        status: 'accepted',
        finalPriceCents: 120_000,
      })
      .returning({ id: bookingRequests.id });
    const [booking] = await harness.database.db
      .insert(bookings)
      .values({
        requestId: request!.id,
        customerId,
        vendorId: vendorProfileId,
        eventDate,
        eventLocation: '4 Nueces St, Austin',
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'confirmed',
        stripePaymentIntentId: paymentIntentId ?? null,
        paidAt: paymentIntentId ? new Date() : null,
      })
      .returning({ id: bookings.id });

    return booking!.id;
  }

  beforeAll(async () => {
    harness = await createTestHarness();
    const [photography] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = photography!.id;
  });

  beforeEach(() => {
    register(ADMIN, 'customer');
    register(CUSTOMER, 'customer');
    register(OPERATOR_CLOSED, 'customer');
    register(VENDOR, 'vendor');
    harness.deletedAuthUsers.length = 0;
    harness.setAuthDeletionFails(false);
    harness.stripe.refundsToRefuse.clear();
    harness.stripe.failedRefundKeys.clear();
  });

  afterEach(async () => {
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('anonymises the row exactly as an operator closure does, and ends sign-in', async () => {
    await signIn(ADMIN, true);
    const customerId = await signIn(CUSTOMER);
    const byOperatorId = await signIn(OPERATOR_CLOSED);

    await requestCode(CUSTOMER);
    const closed = await close(CUSTOMER, ADDRESS(CUSTOMER).toUpperCase(), emailedCode(CUSTOMER));
    expect(closed.statusCode).toBe(200);
    expect(new Date(closed.json().closedAt).getTime()).not.toBeNaN();

    const operator = await harness.app.inject({
      method: 'POST',
      url: `/v1/admin/users/${byOperatorId}/close`,
      headers: bearer(ADMIN),
    });
    expect(operator.statusCode).toBe(200);

    const byOperator = await row(byOperatorId);
    const own = await row(customerId);
    const shape = (r: typeof own) => ({
      ...r,
      id: null,
      email: r.email.replace(r.id, '<id>'),
      authUserId: null,
      deletedAt: r.deletedAt === null ? null : 'closed',
      createdAt: null,
      updatedAt: null,
    });
    expect(shape(own)).toEqual(shape(byOperator));
    expect(own).toMatchObject({
      email: `closed+${customerId}@invalid`,
      firstName: 'Former customer',
      lastName: '',
      phone: null,
      avatarUrl: null,
      pendingEmail: null,
      authUserId: CUSTOMER,
    });
    expect(own.deletedAt).not.toBeNull();
    expect(harness.deletedAuthUsers).toContain(CUSTOMER);

    const again = await harness.app.inject({
      method: 'GET',
      url: '/v1/users/me',
      headers: bearer(CUSTOMER),
    });
    expect(again.statusCode).toBe(401);
  });

  it("emails the code as ordinary mail, never taking the headroom kept for an admin's", async () => {
    await signIn(CUSTOMER);

    await requestCode(CUSTOMER);

    const sent = harness.email.sent.filter((m) => m.to === ADDRESS(CUSTOMER));
    expect(sent).toHaveLength(1);
    expect(sent[0]!.essential).toBe(false);
  });

  it('writes user_closed with the person as its actor', async () => {
    const customerId = await signIn(CUSTOMER);

    await requestCode(CUSTOMER);
    expect((await close(CUSTOMER, ADDRESS(CUSTOMER), emailedCode(CUSTOMER))).statusCode).toBe(200);

    const rows = await harness.database.db.select().from(adminActions);
    expect(rows.filter((r) => r.action === 'user_closed')).toEqual([
      expect.objectContaining({ actorId: customerId, subjectId: customerId, subjectType: 'user' }),
    ]);
  });

  it('refuses with the bookings to cancel, spends no code and changes nothing', async () => {
    const customerId = await signIn(CUSTOMER);
    await signIn(VENDOR);
    const vendor = await createVendorProfile();
    const bookingId = await createBooking(customerId, vendor.profileId, '2099-06-01');

    const readiness = await harness.app.inject({
      method: 'GET',
      url: '/v1/users/me/close',
      headers: bearer(CUSTOMER),
    });
    expect(readiness.json().blockers).toEqual([
      { bookingId, eventDate: '2099-06-01', counterpartyName: 'Sunlit Studio' },
    ]);

    await requestCode(CUSTOMER);
    const code = emailedCode(CUSTOMER);
    const refused = await close(CUSTOMER, ADDRESS(CUSTOMER), code);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().details.bookings).toEqual([
      { bookingId, eventDate: '2099-06-01', counterpartyName: 'Sunlit Studio' },
    ]);
    expect((await row(customerId)).deletedAt).toBeNull();
    expect(harness.deletedAuthUsers).toEqual([]);

    // The code was not spent: once the booking is gone it still closes the account.
    await harness.database.db.delete(bookings);
    expect((await close(CUSTOMER, ADDRESS(CUSTOMER), code)).statusCode).toBe(200);
  });

  it('closes a vendor and their storefront stops being public at once', async () => {
    await signIn(VENDOR);
    const vendor = await createVendorProfile();
    expect(
      (await harness.app.inject({ method: 'GET', url: `/v1/vendors/${vendor.slug}` })).statusCode,
    ).toBe(200);

    await requestCode(VENDOR);
    const closed = await close(VENDOR, ADDRESS(VENDOR), emailedCode(VENDOR));
    expect(closed.statusCode).toBe(200);

    expect(
      (await harness.app.inject({ method: 'GET', url: `/v1/vendors/${vendor.slug}` })).statusCode,
    ).toBe(404);
    expect((await row(vendor.userId)).deletedAt).not.toBeNull();
  });

  it('refuses an operator on all three routes, and writes nothing', async () => {
    const adminId = await signIn(ADMIN, true);

    for (const [method, url] of [
      ['GET', '/v1/users/me/close'],
      ['POST', '/v1/users/me/close/challenge'],
    ] as const) {
      const response = await harness.app.inject({ method, url, headers: bearer(ADMIN) });
      expect(response.statusCode).toBe(403);
      expect(response.json().message).toBe(OPERATOR_SELF_CLOSURE_REFUSAL);
    }

    const closed = await close(ADMIN, ADDRESS(ADMIN), '123456');
    expect(closed.statusCode).toBe(403);
    expect(closed.json().message).toBe(OPERATOR_SELF_CLOSURE_REFUSAL);
    expect((await row(adminId)).deletedAt).toBeNull();
    expect(harness.email.sent.filter((m) => m.to === ADDRESS(ADMIN))).toEqual([]);
  });

  it('closes nothing for a mistyped address, a wrong code or a missing code', async () => {
    const customerId = await signIn(CUSTOMER);
    await requestCode(CUSTOMER);
    const code = emailedCode(CUSTOMER);
    const wrong = code === '000000' ? '111111' : '000000';

    const mistyped = await close(CUSTOMER, 'someone.else@example.com', code);
    expect(mistyped.statusCode).toBe(400);

    const badCode = await close(CUSTOMER, ADDRESS(CUSTOMER), wrong);
    expect(badCode.statusCode).toBe(403);

    const noCode = await harness.app.inject({
      method: 'POST',
      url: '/v1/users/me/close',
      headers: bearer(CUSTOMER),
      payload: { email: ADDRESS(CUSTOMER) },
    });
    expect(noCode.statusCode).toBe(400);

    const signedOut = await harness.app.inject({
      method: 'POST',
      url: '/v1/users/me/close',
      payload: { email: ADDRESS(CUSTOMER), code },
    });
    expect(signedOut.statusCode).toBe(401);

    expect((await row(customerId)).deletedAt).toBeNull();
    expect(harness.deletedAuthUsers).toEqual([]);
  });

  it('voids the code after too many wrong guesses, even for the right one', async () => {
    const customerId = await signIn(CUSTOMER);
    await requestCode(CUSTOMER);
    const code = emailedCode(CUSTOMER);
    const wrong = code === '000000' ? '111111' : '000000';

    for (let attempt = 0; attempt < STEP_UP_MAX_ATTEMPTS; attempt += 1) {
      expect((await close(CUSTOMER, ADDRESS(CUSTOMER), wrong)).statusCode).toBe(403);
    }

    expect((await close(CUSTOMER, ADDRESS(CUSTOMER), code)).statusCode).toBe(403);
    expect((await row(customerId)).deletedAt).toBeNull();
  });

  it('answers 409 to a second closure, and finishes one interrupted part-way', async () => {
    const customerId = await signIn(CUSTOMER);
    await signIn(VENDOR);
    const vendor = await createVendorProfile();
    // A vendor's closure refunds the customer in full — unless Stripe refuses, which leaves it unfinished.
    const bookingId = await createBooking(
      customerId,
      vendor.profileId,
      '2099-07-01',
      'pi_own_close_resume',
    );
    harness.stripe.refundsToRefuse.add('pi_own_close_resume');

    await requestCode(VENDOR);
    expect((await close(VENDOR, ADDRESS(VENDOR), emailedCode(VENDOR))).statusCode).toBe(200);
    const statusOf = async (): Promise<string> =>
      (await harness.database.db.select().from(bookings).where(eq(bookings.id, bookingId)))[0]!
        .status;
    expect(await statusOf()).toBe('confirmed');

    harness.stripe.refundsToRefuse.clear();
    harness.stripe.failedRefundKeys.clear();

    // The closed vendor's session no longer resolves, so the finishing call is the service's own.
    const call = (): Promise<{ closedAt: Date }> =>
      closeOwnAccount(
        bookingContextFor(harness.app, harness.app.log, WEB_ORIGIN),
        vendor.userId,
        { email: ADDRESS(VENDOR), code: '000000' },
        new Date(),
        null,
        harness.app.storage,
        harness.app.stepUp,
      );

    await expect(call()).resolves.toEqual({ closedAt: expect.any(Date) });
    expect(await statusOf()).toBe('cancelled');
    await expect(call()).rejects.toMatchObject({ statusCode: 409 });
  });
});
