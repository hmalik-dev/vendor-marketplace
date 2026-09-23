import {
  ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR,
  ERROR_CODES,
  STEP_UP_GRANT_TTL_MS,
  STEP_UP_MAX_ATTEMPTS,
} from '@vendor-marketplace/shared';
import {
  adminActions,
  bookingRequests,
  bookings,
  categories,
  users,
  vendorCategories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

const ADMIN = 'user_step_admin';
const OTHER_ADMIN = 'user_step_admin_two';
const VENDOR = 'user_step_vendor';
const CUSTOMER = 'user_step_customer';
const NIL = '00000000-0000-4000-8000-000000000000';
const START = new Date('2030-01-01T12:00:00Z');
const HOUR_MS = 60 * 60_000;

/**
 * VEN-500: an irreversible admin route asks for a step-up the session token
 * cannot mint alone, and one operator can end only so many accounts an hour.
 */
describe('admin step-up and destructive ceiling', () => {
  let harness: TestHarness;
  let now = START;
  let photographyId: string;

  const signIn = (authUserId: string, admin = false): Promise<string> =>
    signInAs(harness, authUserId, admin);

  /** The six digits in the newest email sent to the address. */
  function emailedCode(to: string): string {
    const message = [...harness.email.sent].reverse().find((m) => m.to === to);
    const code = /\b(\d{6})\b/.exec(message?.text ?? '')?.[1];
    if (!code) {
      throw new Error(`No step-up code was emailed to ${to}`);
    }
    return code;
  }

  async function challenge(authUserId: string): Promise<void> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/v1/admin/step-up/challenge',
      headers: bearer(authUserId),
    });
    expect(response.statusCode).toBe(200);
  }

  async function stepUp(authUserId: string): Promise<void> {
    await challenge(authUserId);
    const response = await harness.app.inject({
      method: 'POST',
      url: '/v1/admin/step-up/verify',
      headers: bearer(authUserId),
      payload: { code: emailedCode(`${authUserId}@example.com`) },
    });
    expect(response.statusCode).toBe(200);
  }

  async function vendorWithBooking(): Promise<{ userId: string; bookingId: string }> {
    const customerId = await signIn(CUSTOMER);
    await signIn(VENDOR);
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
      .select({ id: vendorProfiles.id, userId: vendorProfiles.userId })
      .from(vendorProfiles)
      .limit(1);
    const [request] = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId: profile!.id,
        eventDate: '2099-06-01',
        status: 'accepted',
        finalPriceCents: 120_000,
      })
      .returning({ id: bookingRequests.id });
    const [booking] = await harness.database.db
      .insert(bookings)
      .values({
        requestId: request!.id,
        customerId,
        vendorId: profile!.id,
        eventDate: '2099-06-01',
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'confirmed',
        stripePaymentIntentId: 'pi_step_up',
      })
      .returning({ id: bookings.id });

    return { userId: profile!.userId, bookingId: booking!.id };
  }

  const ban = (authUserId: string, userId: string) =>
    harness.app.inject({
      method: 'PUT',
      url: `/v1/admin/users/${userId}/ban`,
      headers: bearer(authUserId),
    });

  async function isBanned(userId: string): Promise<boolean> {
    const [row] = await harness.database.db
      .select({ isBanned: users.isBanned })
      .from(users)
      .where(eq(users.id, userId));
    return row!.isBanned;
  }

  /** Completed bans by an operator, as the audit log records them. */
  async function seedBans(actorId: string, count: number, at: Date): Promise<void> {
    await harness.database.db.insert(adminActions).values(
      Array.from({ length: count }, () => ({
        actorId,
        action: 'user_banned' as const,
        subjectType: 'user' as const,
        subjectId: NIL,
        createdAt: at,
      })),
    );
  }

  beforeAll(async () => {
    harness = await createTestHarness({ enforceStepUp: true, clock: () => now });

    for (const [authUserId, role] of [
      [ADMIN, 'customer'],
      [OTHER_ADMIN, 'customer'],
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
    now = START;
    // The audit log is append-only; deleting the operators below cascades their rows.
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    harness.stripe.refunds.length = 0;
    harness.email.sent.length = 0;
    // Grants and pending codes went with the operators' rows, by cascade.
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('the step-up itself', () => {
    it('refuses a ban without a fresh step-up: 403, no state change, no refund', async () => {
      await signIn(ADMIN, true);
      const target = await vendorWithBooking();

      const response = await ban(ADMIN, target.userId);

      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe(ERROR_CODES.STEP_UP_REQUIRED);
      expect(await isBanned(target.userId)).toBe(false);
      expect(harness.stripe.refunds).toHaveLength(0);
    });

    it.each([
      ['POST', `/v1/admin/users/${NIL}/close`],
      ['PUT', `/v1/admin/bookings/${NIL}/dispute`],
      ['DELETE', `/v1/admin/reviews/${NIL}`],
      ['DELETE', `/v1/admin/portfolio-items/${NIL}`],
    ] as const)('%s %s asks for a step-up before anything else', async (method, url) => {
      await signIn(ADMIN, true);

      const response = await harness.app.inject({
        method,
        url,
        headers: bearer(ADMIN),
        payload: method === 'PUT' ? { outcome: 'refund' } : undefined,
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe(ERROR_CODES.STEP_UP_REQUIRED);
    });

    it('does not tell a non-admin the route asks for more', async () => {
      await signIn(CUSTOMER);

      const response = await ban(CUSTOMER, NIL);

      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('emails the code to the operator and never returns it', async () => {
      await signIn(ADMIN, true);

      const response = await harness.app.inject({
        method: 'POST',
        url: '/v1/admin/step-up/challenge',
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      const code = emailedCode(`${ADMIN}@example.com`);
      expect(code).toMatch(/^\d{6}$/);
      expect(response.body).not.toContain(code);
      expect(harness.email.sent).toHaveLength(1);
    });

    it('keeps a live grant when a later code cannot be sent', async () => {
      const adminId = await signIn(ADMIN, true);
      await stepUp(ADMIN);
      harness.email.failNext = true;

      const response = await harness.app.inject({
        method: 'POST',
        url: '/v1/admin/step-up/challenge',
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(503);
      expect(await harness.app.stepUp.isFresh(adminId, now)).toBe(true);
    });

    it('lets a ban through once the emailed code is entered, and stops after the grant lapses', async () => {
      await signIn(ADMIN, true);
      const target = await vendorWithBooking();
      await stepUp(ADMIN);

      const response = await ban(ADMIN, target.userId);

      expect(response.statusCode).toBe(200);
      expect(await isBanned(target.userId)).toBe(true);
      expect(harness.stripe.refunds).toHaveLength(1);

      now = new Date(START.getTime() + STEP_UP_GRANT_TTL_MS + 1);
      const later = await harness.app.inject({
        method: 'PUT',
        url: `/v1/admin/users/${target.userId}/unban`,
        headers: bearer(ADMIN),
      });
      expect(later.statusCode).toBe(200);

      const again = await ban(ADMIN, target.userId);
      expect(again.statusCode).toBe(403);
      expect(again.json().error).toBe(ERROR_CODES.STEP_UP_REQUIRED);
    });

    it('does not carry one operator’s step-up to another', async () => {
      await signIn(ADMIN, true);
      await signIn(OTHER_ADMIN, true);
      const target = await vendorWithBooking();
      await stepUp(ADMIN);

      const response = await ban(OTHER_ADMIN, target.userId);

      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe(ERROR_CODES.STEP_UP_REQUIRED);
    });

    it('refuses a wrong code, and voids the challenge after the allowed attempts', async () => {
      const adminId = await signIn(ADMIN, true);
      await challenge(ADMIN);
      const right = emailedCode(`${ADMIN}@example.com`);
      const wrong = right === '000000' ? '000001' : '000000';

      for (let attempt = 0; attempt < STEP_UP_MAX_ATTEMPTS; attempt += 1) {
        const response = await harness.app.inject({
          method: 'POST',
          url: '/v1/admin/step-up/verify',
          headers: bearer(ADMIN),
          payload: { code: wrong },
        });
        expect(response.statusCode).toBe(403);
      }

      const late = await harness.app.inject({
        method: 'POST',
        url: '/v1/admin/step-up/verify',
        headers: bearer(ADMIN),
        payload: { code: right },
      });
      expect(late.statusCode).toBe(403);
      expect(await harness.app.stepUp.isFresh(adminId, now)).toBe(false);
    });

    it('refuses an expired code', async () => {
      await signIn(ADMIN, true);
      await challenge(ADMIN);
      const code = emailedCode(`${ADMIN}@example.com`);
      now = new Date(START.getTime() + HOUR_MS);

      const response = await harness.app.inject({
        method: 'POST',
        url: '/v1/admin/step-up/verify',
        headers: bearer(ADMIN),
        payload: { code },
      });

      expect(response.statusCode).toBe(403);
    });

    it('answers a signed-out caller 401 and a malformed body from a non-admin 403, not 400', async () => {
      await signIn(CUSTOMER);

      const anonymous = await harness.app.inject({
        method: 'POST',
        url: '/v1/admin/step-up/verify',
        payload: [],
      });
      const customer = await harness.app.inject({
        method: 'POST',
        url: '/v1/admin/step-up/verify',
        headers: bearer(CUSTOMER),
        payload: [],
      });

      expect(anonymous.statusCode).toBe(401);
      expect(customer.statusCode).toBe(403);
    });
  });

  describe('the hourly ceiling', () => {
    it('refuses the N+1th ban with no refund, no state change and an operator alert', async () => {
      const adminId = await signIn(ADMIN, true);
      const target = await vendorWithBooking();
      await stepUp(ADMIN);
      await seedBans(adminId, ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR, now);

      const response = await ban(ADMIN, target.userId);

      expect(response.statusCode).toBe(429);
      expect(response.json().error).toBe(ERROR_CODES.ADMIN_CEILING_REACHED);
      expect(await isBanned(target.userId)).toBe(false);
      expect(harness.stripe.refunds).toHaveLength(0);

      await harness.flushEmail();
      const alert = harness.email.sent.find((m) => m.to === 'operator@test.invalid');
      expect(alert?.subject).toContain('ban');
      expect(alert?.text).toContain(adminId);
    });

    it('allows the Nth ban', async () => {
      const adminId = await signIn(ADMIN, true);
      const target = await vendorWithBooking();
      await stepUp(ADMIN);
      await seedBans(adminId, ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR - 1, now);

      const response = await ban(ADMIN, target.userId);

      expect(response.statusCode).toBe(200);
      expect(harness.stripe.refunds).toHaveLength(1);
    });

    it('counts closures with bans, and stops counting an hour later', async () => {
      const adminId = await signIn(ADMIN, true);
      const target = await vendorWithBooking();
      await stepUp(ADMIN);
      await harness.database.db.insert(adminActions).values(
        Array.from({ length: ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR }, () => ({
          actorId: adminId,
          action: 'user_closed' as const,
          subjectType: 'user' as const,
          subjectId: NIL,
          createdAt: now,
        })),
      );

      const refused = await ban(ADMIN, target.userId);
      expect(refused.statusCode).toBe(429);

      now = new Date(START.getTime() + HOUR_MS + 1);
      await stepUp(ADMIN);
      const allowed = await ban(ADMIN, target.userId);
      expect(allowed.statusCode).toBe(200);
    });

    it('is per operator: another admin is unaffected', async () => {
      const adminId = await signIn(ADMIN, true);
      await signIn(OTHER_ADMIN, true);
      const target = await vendorWithBooking();
      await stepUp(OTHER_ADMIN);
      await seedBans(adminId, ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR, now);

      const response = await ban(OTHER_ADMIN, target.userId);

      expect(response.statusCode).toBe(200);
    });
  });
});
