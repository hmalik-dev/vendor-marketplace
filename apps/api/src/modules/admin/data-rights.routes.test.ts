import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import {
  adminActions,
  bookingRequests,
  bookings,
  categories,
  conversations,
  legalAcceptances,
  messages,
  notifications,
  reviews,
  users,
  vendorCategories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import type { AdminActionRow } from '@vendor-marketplace/db/schema';
import {
  CURRENT_TERMS_VERSION,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  legalDocumentSha256,
} from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CLOSURE_UNWIND, DELETION_UNWIND, SUSPENSION_UNWIND } from './account-unwind.js';
import { LAST_OPERATOR_REFUSAL } from './data-rights.service.js';
import {
  bearer,
  createTestHarness,
  SVIX_HEADERS,
  type TestHarness,
} from '../../testing/test-server.js';

/**
 * Data rights — #438.
 *
 * Its own file rather than another block in `admin.routes.test.ts`, which is
 * already 1,500 lines and held by two other lanes.
 *
 * **The corrected fact this suite is written around.** The ticket asserted that
 * a hard `DELETE FROM users` carrying a `legal_acceptances` row is refused by
 * `0029`'s triggers. It is not, and `legal-acceptance-immutability.test.ts`
 * proves the opposite on `main`: the guard is `BEFORE DELETE FOR EACH ROW` and
 * returns `OLD` once the accepting user is gone, and `RETURN OLD` from a
 * `BEFORE DELETE` trigger means *proceed*. The evidence survives because the
 * closure path **never hard-deletes** — the account is retired with
 * `deleted_at` — not because the database would stop one. So every assertion
 * here reads the rows that survive a closure, and none of them expects a caught
 * exception.
 */
const ADMIN = 'user_rights_admin';
const VENDOR = 'user_rights_vendor';
const CUSTOMER = 'user_rights_customer';
const OUTSIDER = 'user_rights_outsider';
/** The closed customer, back later with a new identity and the same address. */
const RETURNING = 'user_rights_returning';

describe('data rights', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function signIn(authUserId: string, promoteToAdmin = false): Promise<string> {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: bearer(authUserId),
    });
    expect(response.statusCode).toBe(200);

    if (promoteToAdmin) {
      await harness.database.db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.authUserId, authUserId));
    }

    const rows = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, authUserId))
      .limit(1);

    return rows[0]!.id;
  }

  async function createVendorProfile(): Promise<{
    profileId: string;
    userId: string;
    slug: string;
  }> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
      },
    });
    expect(created.statusCode).toBe(201);

    const rows = await harness.database.db
      .select({ id: vendorProfiles.id, userId: vendorProfiles.userId, slug: vendorProfiles.slug })
      .from(vendorProfiles)
      .limit(1);
    const row = rows[0]!;

    /* `stripe_onboarded` carries a check constraint requiring the account id. */
    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_rights_vendor' })
      .where(eq(vendorProfiles.id, row.id));

    return { profileId: row.id, userId: row.userId, slug: row.slug };
  }

  /**
   * A confirmed booking, dated either side of today — and **payable** when a
   * payment intent is given.
   *
   * The unwind only refunds a booking carrying `stripe_payment_intent_id`, so
   * an unpaid fixture exercises the cancellation and silently skips the money.
   * The browser pass found exactly that gap: a vendor closure reported
   * `refundsIssued: 0` and neither the refund nor its failure branch had run.
   */
  async function createBooking(
    customerId: string,
    vendorProfileId: string,
    eventDate: string,
    status: 'confirmed' | 'completed',
    stripePaymentIntentId?: string,
  ): Promise<string> {
    const requestRows = await harness.database.db
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

    const rows = await harness.database.db
      .insert(bookings)
      .values({
        requestId: requestRows[0]!.id,
        customerId,
        vendorId: vendorProfileId,
        eventDate,
        eventLocation: '4 Nueces St, Austin',
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status,
        stripePaymentIntentId: stripePaymentIntentId ?? null,
        paidAt: stripePaymentIntentId ? new Date() : null,
      })
      .returning({ id: bookings.id });

    return rows[0]!.id;
  }

  async function actionRows(): Promise<AdminActionRow[]> {
    return harness.database.db.select().from(adminActions);
  }

  function registerIdentity(authUserId: string, role: 'customer' | 'vendor', email: string): void {
    harness.clerkUsers.set(authUserId, {
      authUserId,
      email,
      firstName: 'Test',
      lastName: 'User',
      roleHint: role,
      avatarUrl: null,
    });
  }

  /**
   * Re-registers the four fixture identities before every test, not once.
   *
   * Closure now **deletes** the Clerk identity (#451), and the harness's fake
   * deletes it from `clerkUsers` rather than only counting the call — so an
   * identity a closure ended stops resolving, and a `beforeAll` registration
   * would leave every later test in the file signing in as somebody who no
   * longer exists.
   */
  function registerFixtureIdentities(): void {
    for (const [authUserId, role] of [
      [ADMIN, 'customer'],
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
      [OUTSIDER, 'customer'],
    ] as const) {
      registerIdentity(authUserId, role, `${authUserId}@example.com`);
    }
  }

  /** Pinned by the one test that needs a date; `null` is the wall clock. */
  let clockNow: Date | null = null;

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => clockNow ?? new Date() });

    const rows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = rows[0]!.id;
  });

  beforeEach(() => {
    registerFixtureIdentities();
    harness.deletedClerkUsers.length = 0;
    harness.setClerkDeletionFails(false);
  });

  afterEach(async () => {
    clockNow = null;
    await harness.database.db.delete(messages);
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(reviews);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    /*
     * `admin_actions` and `legal_acceptances` both refuse a direct delete while
     * the account they name still exists — that is what makes them records. So
     * deleting `users` is what clears them, and a teardown that tried to clear
     * either one first would be exactly the tampering the triggers refuse.
     */
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('export', () => {
    it('produces every category the policy names, and says what it withheld', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile();

      await harness.database.db
        .update(users)
        .set({ phone: '+15125550101', email: 'vendor-real@example.com' })
        .where(eq(users.id, vendor.userId));

      const bookingId = await createBooking(
        customerId,
        vendor.profileId,
        '2020-06-01',
        'completed',
      );

      await harness.database.db.insert(reviews).values({
        bookingId,
        reviewerId: customerId,
        vendorId: vendor.profileId,
        type: 'customer_to_vendor',
        rating: 5,
        content: 'They were wonderful.',
      });

      const conversationRows = await harness.database.db
        .insert(conversations)
        .values({ customerId, vendorId: vendor.profileId })
        .returning({ id: conversations.id });

      await harness.database.db.insert(messages).values([
        { conversationId: conversationRows[0]!.id, senderId: customerId, content: 'Are you free?' },
        {
          conversationId: conversationRows[0]!.id,
          senderId: vendor.userId,
          content: 'I am, yes.',
        },
      ]);

      await harness.database.db.insert(notifications).values({
        userId: customerId,
        type: 'booking_confirmed',
        title: 'Your booking is confirmed',
        body: 'Sunlit Studio confirmed 1 June.',
      });

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/export`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.subject.id).toBe(customerId);
      expect(body.bookingRequests).toHaveLength(1);
      expect(body.bookings).toHaveLength(1);
      expect(body.reviewsWritten).toHaveLength(1);
      expect(body.reviewsReceived).toHaveLength(0);
      expect(body.messages).toHaveLength(2);
      expect(body.notifications).toHaveLength(1);
      /* Signing in writes the Terms acceptance; the export carries it. */
      expect(body.legalAcceptances).toHaveLength(1);
      expect(body.legalAcceptances[0]).toMatchObject({
        document: 'terms_of_service',
        version: CURRENT_TERMS_VERSION,
        acceptedByUserId: customerId,
      });

      /* Both sides of the thread, tagged with who wrote which. */
      expect(
        body.messages.map((message: { sentBySubject: boolean }) => message.sentBySubject),
      ).toEqual([true, false]);

      /* The counterparty is named, and named once. */
      expect(body.counterparties).toEqual([
        { id: vendor.userId, name: 'Sunlit Studio', role: 'vendor' },
      ]);

      expect(body.withheld).toContainEqual({
        section: 'counterparties',
        fields: ['email', 'phone'],
        reason: expect.stringContaining('not the subject'),
      });
    });

    it("carries no credential, no Stripe secret, and no other user's email", async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile();

      await harness.database.db
        .update(users)
        .set({ phone: '+15125550101', email: 'vendor-real@example.com' })
        .where(eq(users.id, vendor.userId));

      await createBooking(customerId, vendor.profileId, '2020-06-01', 'completed');

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/export`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      const serialized = response.body;

      /*
       * Asserted against the **serialized bytes**, not against the fields the
       * schema declares. A redaction rule checked field by field is one a later
       * writer walks around by adding a field; this one is walked around only
       * by the value genuinely not being there.
       */
      expect(serialized).not.toContain('vendor-real@example.com');
      expect(serialized).not.toContain('+15125550101');
      expect(serialized).not.toContain('acct_rights_vendor');
      expect(serialized).not.toContain('sk_');
      expect(serialized).not.toContain('whsec_');
      expect(serialized).not.toContain('authUserId":"user_');
    });

    it('succeeds for an account with no vendor profile, no bookings and no reviews', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/export`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.vendorProfile).toBeNull();
      expect(body.bookings).toEqual([]);
      expect(body.reviewsWritten).toEqual([]);
      expect(body.reviewsReceived).toEqual([]);
      expect(body.counterparties).toEqual([]);
      /* The withholding note is unconditional: it says what the shape omits. */
      expect(body.withheld).toHaveLength(2);
    });

    it('writes exactly one admin_actions row naming the subject', async () => {
      const actorId = await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/export`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      const rows = await actionRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId,
        action: 'user_data_exported',
        subjectType: 'user',
        subjectId: customerId,
      });
      /* Counts, never content — the row must not become a second copy. */
      expect(JSON.stringify(rows[0]!.detail)).not.toContain('@example.com');
    });

    it('is refused for a caller who is not an admin', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      await signIn(OUTSIDER);

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/export`,
        headers: bearer(OUTSIDER),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('closure', () => {
    it('is refused with a 409 naming the bookings to cancel first (D39)', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile();

      const bookingId = await createBooking(
        customerId,
        vendor.profileId,
        '2099-06-01',
        'confirmed',
      );

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/close`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.message).toContain('1 upcoming confirmed booking');
      expect(body.message).toContain('cancelled through the booking screens');
      expect(body.details.bookings).toEqual([
        { bookingId, eventDate: '2099-06-01', counterpartyName: 'Sunlit Studio' },
      ]);

      /* Nothing moved: the account is live and the booking still stands. */
      const [account] = await harness.database.db
        .select({ deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, customerId));
      expect(account!.deletedAt).toBeNull();

      const [booking] = await harness.database.db
        .select({ status: bookings.status, refundAmountCents: bookings.refundAmountCents })
        .from(bookings)
        .where(eq(bookings.id, bookingId));
      expect(booking).toMatchObject({ status: 'confirmed', refundAmountCents: null });

      expect(await actionRows()).toHaveLength(0);
    });

    /*
     * VEN-423. At 01:00Z on Oct 8 an operator in US Eastern is still on Oct 7,
     * so the booking dated Oct 8 is ahead of them. The blocker check used the
     * UTC date and read it as today, so the closure went through over a
     * confirmed booking. The Oct 6 booking is a day gone and must not count.
     */
    it("counts the booking on the operator's next local day as a close blocker", async () => {
      clockNow = new Date('2026-10-08T01:00:00Z');
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile();

      const ahead = await createBooking(customerId, vendor.profileId, '2026-10-08', 'confirmed');
      await createBooking(customerId, vendor.profileId, '2026-10-06', 'confirmed');

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/close`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().details.bookings).toEqual([
        { bookingId: ahead, eventDate: '2026-10-08', counterpartyName: 'Sunlit Studio' },
      ]);
    });

    it("runs #433's unwind and soft-deletes the account when nothing blocks it", async () => {
      const actorId = await signIn(ADMIN, true);
      await signIn(VENDOR);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile();

      /* A past booking does not block; an open request is the unwind's work. */
      const settledBookingId = await createBooking(
        customerId,
        vendor.profileId,
        '2020-06-01',
        'completed',
      );
      const openRequest = await harness.database.db
        .insert(bookingRequests)
        .values({
          customerId,
          vendorId: vendor.profileId,
          eventDate: '2099-09-01',
          status: 'pending',
        })
        .returning({ id: bookingRequests.id });

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/close`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      /*
       * **One, and it used to be two (#444).** The second was the completed
       * booking's own request, still `accepted` because that is the status
       * checkout leaves behind — and `declineOpenRequests` took `accepted`
       * unconditionally, so closing the account told the customer that a
       * request whose event had happened and been paid for had been *declined*.
       * #438 pinned that here as the behaviour it found rather than widening
       * its own scope to fix it; #444 narrowed the predicate, and this number
       * moving is what makes the change visible as a change.
       */
      expect(response.json()).toMatchObject({
        userId: customerId,
        requestsDeclined: 1,
        bookingsCancelled: 0,
        bookingsLeftForReview: 0,
        profileRetired: false,
      });

      /*
       * The settled booking's own request kept its history on the closure path
       * too — the half of #444 that must survive, asserted here as well as on
       * the ban path, because #433 extracted the unwind and #438's closure
       * shares it.
       */
      const [settled] = await harness.database.db
        .select({ status: bookingRequests.status })
        .from(bookingRequests)
        .innerJoin(bookings, eq(bookings.requestId, bookingRequests.id))
        .where(eq(bookings.id, settledBookingId));
      expect(settled!.status).toBe('accepted');

      /*
       * `requestsDeclined` above is the assertion that this ran **#433's path**
       * rather than a second one. `declineOpenRequests` is only reachable
       * through `unwindAccountBookings`, so an open request left `pending`
       * would mean closure had forked its own unwind.
       */
      const [request] = await harness.database.db
        .select({ status: bookingRequests.status })
        .from(bookingRequests)
        .where(eq(bookingRequests.id, openRequest[0]!.id));
      expect(request!.status).toBe('declined');

      const [account] = await harness.database.db
        .select({ deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, customerId));
      expect(account!.deletedAt).not.toBeNull();

      const rows = await actionRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId,
        action: 'user_closed',
        subjectType: 'user',
        subjectId: customerId,
      });
    });

    it("retires a vendor's storefront, and their slug 404s", async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();

      const before = await harness.app.inject({ method: 'GET', url: `/vendors/${vendor.slug}` });
      expect(before.statusCode).toBe(200);

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${vendor.userId}/close`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().profileRetired).toBe(true);

      const after = await harness.app.inject({ method: 'GET', url: `/vendors/${vendor.slug}` });
      expect(after.statusCode).toBe(404);

      const [profile] = await harness.database.db
        .select({ isDeleted: vendorProfiles.isDeleted, isPublished: vendorProfiles.isPublished })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendor.profileId));
      expect(profile).toMatchObject({ isDeleted: true, isPublished: false });
    });

    /**
     * D39's line, from the side that is not the customer's.
     *
     * The refusal exists because a customer who deletes their account instead
     * of cancelling would take 100% back on every future booking at once. That
     * argument inverts for a vendor — *"the customer did nothing wrong and the
     * vendor walked away"* — so a vendor's forward bookings are refunded in
     * full by #433's path rather than refusing the closure. Refusing here
     * instead would have been unresolvable: only the customer can cancel a
     * confirmed booking, so the vendor would be told to do something they
     * cannot do.
     */
    it('closes a vendor holding a future confirmed booking, refunding it (D39)', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile();

      const bookingId = await createBooking(
        customerId,
        vendor.profileId,
        '2099-06-01',
        'confirmed',
      );

      /* The console offers the control, because the API would not refuse it. */
      const rights = await harness.app.inject({
        method: 'GET',
        url: `/admin/users/${vendor.userId}/data-rights`,
        headers: bearer(ADMIN),
      });
      expect(rights.statusCode).toBe(200);
      expect(rights.json().closeBlockers).toEqual([]);
      /* Nothing refuses it — and the console is told what it will refund. */
      expect(rights.json().bookingsRefundedOnClose).toBe(1);

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${vendor.userId}/close`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        bookingsCancelled: 1,
        bookingsLeftForReview: 0,
        /*
         * Both reported, per #400: a closure that left money at Stripe must
         * not read as a clean one. Nothing was paid here — the fixture booking
         * carries no payment intent — so the honest answer is zero issued and
         * zero failed, and the console has a field to read either way.
         */
        refundsIssued: 0,
        refundsFailed: 0,
        profileRetired: true,
      });

      const [booking] = await harness.database.db
        .select({ status: bookings.status })
        .from(bookings)
        .where(eq(bookings.id, bookingId));
      expect(booking!.status).toBe('cancelled');
    });

    /**
     * The money half of a vendor closure, actually moved.
     *
     * The first pass of this suite proved only that the booking was cancelled:
     * its fixture carried no payment intent, so `refundsIssued` was `0` because
     * nothing had ever been charged, and the refund branch never ran. The
     * confirmation dialog promises "refunds it in full", and that promise needs
     * a test that reaches Stripe rather than one that skips it.
     */
    it("refunds the vendor's paid bookings in full when the vendor closes", async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile();

      const bookingId = await createBooking(
        customerId,
        vendor.profileId,
        '2099-06-01',
        'confirmed',
        'pi_test_close',
      );

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${vendor.userId}/close`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        bookingsCancelled: 1,
        refundsIssued: 1,
        refundsFailed: 0,
        bookingsLeftForReview: 0,
      });

      const [booking] = await harness.database.db
        .select({ status: bookings.status, refundAmountCents: bookings.refundAmountCents })
        .from(bookings)
        .where(eq(bookings.id, bookingId));
      expect(booking).toMatchObject({ status: 'cancelled', refundAmountCents: 120_000 });
    });

    /**
     * #400's shape, on this route.
     *
     * A refund Stripe refuses leaves the booking **confirmed** — the money did
     * not come back, so it must not be cancelled underneath the customer — on
     * an account that is nonetheless closed. The result carries the count so
     * the console can say so; without it an operator sees a clean closure while
     * the money is still at Stripe and neither party has been told.
     */
    it('reports a refund Stripe refused rather than counting the closure clean', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile();

      const bookingId = await createBooking(
        customerId,
        vendor.profileId,
        '2099-06-01',
        'confirmed',
        'pi_test_close_refused',
      );
      harness.stripe.refundsToRefuse.add('pi_test_close_refused');

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${vendor.userId}/close`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        refundsFailed: 1,
        refundsIssued: 0,
        bookingsCancelled: 0,
        profileRetired: true,
      });

      /* The account closed; the booking did not, because the money did not. */
      const [booking] = await harness.database.db
        .select({ status: bookings.status })
        .from(bookings)
        .where(eq(bookings.id, bookingId));
      expect(booking!.status).toBe('confirmed');

      const [account] = await harness.database.db
        .select({ deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, vendor.userId));
      expect(account!.deletedAt).not.toBeNull();

      /* And the audit row carries the count an operator has to act on. */
      const audit = await actionRows();
      expect(audit.filter((row) => row.action === 'user_closed')[0]?.detail).toMatchObject({
        refundsFailed: 1,
      });
    });

    it('leaves the legal acceptance record standing, because it never hard-deletes', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();

      await harness.database.db.insert(legalAcceptances).values({
        vendorId: vendor.profileId,
        document: 'vendor_agreement',
        version: CURRENT_VENDOR_AGREEMENT_VERSION,
        documentSha256: legalDocumentSha256('vendor_agreement'),
        acceptanceMethod: 'clickwrap_checkbox',
        acceptedByUserId: vendor.userId,
        acceptedByName: 'Test User',
        businessName: 'Sunlit Studio',
        ip: '203.0.113.7',
        userAgent: 'Mozilla/5.0',
      });

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${vendor.userId}/close`,
        headers: bearer(ADMIN),
      });
      expect(response.statusCode).toBe(200);

      /*
       * The surviving rows, asserted directly. The database would **not** have
       * refused a hard delete here — the cascade fires after the user row is
       * gone, and the guard returns `OLD`, which means proceed — so what keeps
       * the evidence is that closure retires the account instead of erasing it.
       */
      const surviving = await harness.database.db
        .select({ document: legalAcceptances.document })
        .from(legalAcceptances)
        .where(eq(legalAcceptances.acceptedByUserId, vendor.userId));
      expect(surviving.map((row) => row.document).sort()).toEqual([
        'terms_of_service',
        'vendor_agreement',
      ]);

      const [account] = await harness.database.db
        .select({ deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, vendor.userId));
      expect(account).toBeDefined();
      expect(account!.deletedAt).not.toBeNull();

      /*
       * And the audit trail survives with it, counted the same way. A closure
       * that took the account's own `admin_actions` rows down with it — which
       * a hard delete would, through the same cascade — would erase the record
       * of the closure itself, which is the one row that has to outlive it.
       */
      const audit = await actionRows();
      expect(
        audit.filter((row) => row.subjectId === vendor.userId).map((row) => row.action),
      ).toEqual(['user_closed']);
    });

    /**
     * Acceptance 1 — #451.
     *
     * The retirement used to stop at `deleted_at`, which left the Clerk session
     * alive: every read 401'd while the browser kept rendering signed-in
     * chrome, indefinitely, with nothing to prompt a sign-out. Ending the
     * identity is what makes the two halves agree, and the fake really removes
     * it, so presenting that person's token afterwards fails the way a deleted
     * Clerk session does rather than merely being counted.
     */
    it('deletes the Clerk identity behind the account, ending its session', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/close`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ identityDeleted: true });
      expect(harness.deletedClerkUsers).toEqual([CUSTOMER]);
      expect(harness.clerkUsers.has(CUSTOMER)).toBe(false);

      /*
       * The refusal has to come from the **identity being gone**, not from the
       * retired row — those are different fixes and only one of them is this
       * ticket's. `neon-auth.ts` answers the retired row with "No account is
       * linked to this session", which is the behaviour that already existed
       * and which the ticket names as the bug: every read 401s while the
       * browser keeps rendering signed-in chrome. A token Clerk will no longer
       * verify answers "Session token is invalid or expired" instead, and that
       * is the one that ends the session. Asserting the status code alone
       * cannot tell them apart, and would pass with the Clerk deletion removed.
       */
      const after = await harness.app.inject({
        method: 'GET',
        url: '/users/me',
        headers: bearer(CUSTOMER),
      });
      expect(after.statusCode).toBe(401);
      expect(after.json().message).toBe('Session token is invalid or expired');

      const rows = await actionRows();
      expect(rows[0]?.detail).toMatchObject({ identityDeleted: true });
    });

    /**
     * Acceptance 2 — #451, asserted rather than assumed.
     *
     * Deleting the Clerk user fires `user.deleted` straight back at our own
     * webhook, so closure now provokes the redelivery it has to survive. #433's
     * guard is what survives it: `applyUserDeleted` reads a **live** row, finds
     * the one it just retired, and answers `ignored` — so the money moves once.
     * The refund count is the assertion that matters; an outcome of `ignored`
     * with a second refund behind it would still be the bug.
     */
    it('does not refund twice when its own deletion replays as user.deleted', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile();

      await createBooking(
        customerId,
        vendor.profileId,
        '2099-06-01',
        'confirmed',
        'pi_test_replay',
      );

      /*
       * A baseline rather than a literal: the fake Stripe accumulates across
       * the whole file, so `toHaveLength(1)` would be asserting what the tests
       * before this one happened to refund.
       */
      const refundsBefore = harness.stripe.refunds.length;

      const closed = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${vendor.userId}/close`,
        headers: bearer(ADMIN),
      });
      expect(closed.statusCode).toBe(200);
      expect(closed.json()).toMatchObject({ refundsIssued: 1, identityDeleted: true });
      expect(harness.stripe.refunds).toHaveLength(refundsBefore + 1);

      const replay = await harness.app.inject({
        method: 'POST',
        url: '/webhooks/clerk',
        headers: { ...SVIX_HEADERS, 'content-type': 'application/json' },
        payload: JSON.stringify({ type: 'user.deleted', data: { id: VENDOR, deleted: true } }),
      });

      expect(replay.json()).toEqual({ received: true, outcome: 'ignored' });
      expect(harness.stripe.refunds).toHaveLength(refundsBefore + 1);
    });

    /**
     * Acceptances 3 and 4 — #451, against the real partial index.
     *
     * `users_email_key` is now `UNIQUE (email) WHERE deleted_at IS NULL`, and
     * this runs the whole sign-up path — `syncUserFromAuth` into
     * `insertUserIfAbsent`, whose `onConflictDoNothing` targets `auth_user_id`
     * and therefore does **not** swallow an email collision — against the real
     * engine. A mocked insert could not tell a partial index from a full one,
     * which is the entire content of the change.
     */
    it("lets a closed account's address register again, as a new account", async () => {
      await signIn(ADMIN, true);
      const closedId = await signIn(CUSTOMER);
      const address = `${CUSTOMER}@example.com`;

      const closed = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${closedId}/close`,
        headers: bearer(ADMIN),
      });
      expect(closed.statusCode).toBe(200);

      /* The same person, back with a new Clerk identity and the same address. */
      registerIdentity(RETURNING, 'customer', address);
      const returningId = await signIn(RETURNING);

      expect(returningId).not.toBe(closedId);

      const rows = await harness.database.db
        .select({
          id: users.id,
          email: users.email,
          authUserId: users.authUserId,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(eq(users.email, address));

      expect(rows).toHaveLength(2);

      const retired = rows.find((row) => row.id === closedId);
      const returning = rows.find((row) => row.id === returningId);

      /* The retired row stays retired, and stays readable under its address. */
      expect(retired).toMatchObject({ email: address, authUserId: CUSTOMER });
      expect(retired?.deletedAt).not.toBeNull();
      expect(returning).toMatchObject({
        email: address,
        authUserId: RETURNING,
        deletedAt: null,
      });
    });

    /**
     * The other half of acceptance 3, differently shaped.
     *
     * Releasing the address on closure must not be the same thing as dropping
     * the constraint: two **live** accounts sharing an address is still the
     * collision it always was. Without this, deleting `users_email_key`
     * outright would pass the test above.
     */
    it('still refuses two live accounts holding the same address', async () => {
      const address = `${CUSTOMER}@example.com`;
      await signIn(CUSTOMER);

      await expect(
        harness.database.db.insert(users).values({
          authUserId: 'user_rights_duplicate',
          email: address,
          role: 'customer',
          firstName: 'Test',
          lastName: 'User',
        }),
      ).rejects.toThrow();
    });

    /**
     * The identity half of #400's shape, for #451.
     *
     * Clerk is a network call the committed retirement cannot roll back, so a
     * refusal there leaves an account closed here and signed in there. That is
     * reported rather than thrown: a 500 would tell an operator nothing had
     * happened, when in fact everything except the identity had.
     */
    it('reports a Clerk deletion it could not make, and closes the account anyway', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      harness.setClerkDeletionFails(true);

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/close`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ identityDeleted: false });
      expect(harness.deletedClerkUsers).toEqual([]);

      const [account] = await harness.database.db
        .select({ deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, customerId));
      expect(account!.deletedAt).not.toBeNull();

      const rows = await actionRows();
      expect(rows[0]?.detail).toMatchObject({ identityDeleted: false });
    });

    /**
     * A row Clerk never issued has no identity to end (#451).
     *
     * The seeded marketplace accounts carry `seed_mkt_…` ids, are live, and are
     * listed and closable on `/admin/customers`. Handing one to Clerk asks it
     * about a user it has never heard of, and then reports its answer as fact:
     * a 404 reads as "deleted" and a 400 reads as "still signed in", and both
     * are written into `admin_actions`, which cannot be corrected afterwards.
     * `isClerkIdentity` is the predicate the reconcile pass already owns for
     * exactly this distinction.
     */
    it('does not ask Clerk about a row Clerk never issued', async () => {
      await signIn(ADMIN, true);

      const seeded = await harness.database.db
        .insert(users)
        .values({
          authUserId: 'seed_mkt_customer_0',
          email: 'seed_mkt_customer_0@example.com',
          role: 'customer',
          firstName: 'Seeded',
          lastName: 'Customer',
        })
        .returning({ id: users.id });

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${seeded[0]!.id}/close`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      /* Nothing is owed, because there was never a sign-in to delete. */
      expect(response.json()).toMatchObject({ identityDeleted: true });
      expect(harness.deletedClerkUsers).toEqual([]);
    });

    /*
     * VEN-382. Driven through the real closure route rather than a row hand-set
     * with `deleted_at`, so the fixture is whatever closure actually produces.
     */
    it('lists a closed account on the customers table only when asked, marked closed', async () => {
      await signIn(ADMIN, true);
      const closedId = await signIn(CUSTOMER);
      const liveId = await signIn(OUTSIDER);

      const closed = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${closedId}/close`,
        headers: bearer(ADMIN),
      });
      expect(closed.statusCode).toBe(200);

      const byDefault = await harness.app.inject({
        method: 'GET',
        url: '/admin/customers',
        headers: bearer(ADMIN),
      });
      expect(byDefault.statusCode).toBe(200);
      expect(
        byDefault
          .json()
          .items.map((row: { id: string; isClosed: boolean }) => [row.id, row.isClosed]),
      ).toEqual([[liveId, false]]);

      const explicitLive = await harness.app.inject({
        method: 'GET',
        url: '/admin/customers?status=live',
        headers: bearer(ADMIN),
      });
      expect(explicitLive.json().items.map((row: { id: string }) => row.id)).toEqual([liveId]);

      const asked = await harness.app.inject({
        method: 'GET',
        url: '/admin/customers?status=closed',
        headers: bearer(ADMIN),
      });
      expect(asked.statusCode).toBe(200);
      expect(asked.json().total).toBe(1);
      expect(
        asked.json().items.map((row: { id: string; isClosed: boolean }) => [row.id, row.isClosed]),
      ).toEqual([[closedId, true]]);

      /* The row's link target still answers for the closed account. */
      const rights = await harness.app.inject({
        method: 'GET',
        url: `/admin/users/${closedId}/data-rights`,
        headers: bearer(ADMIN),
      });
      expect(rights.statusCode).toBe(200);
      expect(rights.json().closedAt).not.toBeNull();

      const bogus = await harness.app.inject({
        method: 'GET',
        url: '/admin/customers?status=retired',
        headers: bearer(ADMIN),
      });
      expect(bogus.statusCode).toBe(400);
    });

    /*
     * An empty search on the live view, for a person whose account was closed,
     * counts the closed set as its way out; from the closed view the same key
     * counts the live set. Each count is the rows its link lands on.
     */
    it('counts the other set as the status route out of an empty customers search', async () => {
      await signIn(ADMIN, true);
      const closedId = await signIn(CUSTOMER);
      await signIn(OUTSIDER);

      const closed = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${closedId}/close`,
        headers: bearer(ADMIN),
      });
      expect(closed.statusCode).toBe(200);

      const live = await harness.app.inject({
        method: 'GET',
        url: `/admin/customers?q=${CUSTOMER}`,
        headers: bearer(ADMIN),
      });
      expect(live.json().total).toBe(0);
      expect(
        [...live.json().widenings].sort((a: { key: string }, b: { key: string }) =>
          a.key.localeCompare(b.key),
        ),
      ).toEqual([
        { key: 'q', count: 1 },
        { key: 'status', count: 1 },
      ]);

      const closedView = await harness.app.inject({
        method: 'GET',
        url: `/admin/customers?status=closed&q=${OUTSIDER}`,
        headers: bearer(ADMIN),
      });
      expect(closedView.json().total).toBe(0);
      expect(
        [...closedView.json().widenings].sort((a: { key: string }, b: { key: string }) =>
          a.key.localeCompare(b.key),
        ),
      ).toEqual([
        { key: 'q', count: 1 },
        { key: 'status', count: 1 },
      ]);

      /* A term matching nobody in either set gets no status route: it would find nothing. */
      const nobody = await harness.app.inject({
        method: 'GET',
        url: `/admin/customers?q=nobody-matches-this`,
        headers: bearer(ADMIN),
      });
      expect(nobody.json().widenings).toEqual([{ key: 'q', count: 1 }]);
    });

    /**
     * Hurdles, not refusal (VEN-391): another operator's account closes, and the
     * row says it was an operator's. Two live operators, then one — so the
     * last-operator refusal is observed both not firing and firing.
     */
    describe('an operator account', () => {
      async function close(actor: string, userId: string) {
        return harness.app.inject({
          method: 'POST',
          url: `/admin/users/${userId}/close`,
          headers: bearer(actor),
        });
      }

      it('closes past a second live operator, recorded as an operator closure', async () => {
        const actorId = await signIn(ADMIN, true);
        const peerId = await signIn(OUTSIDER, true);

        const response = await close(ADMIN, peerId);

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ userId: peerId, identityDeleted: true });
        expect(harness.deletedClerkUsers).toEqual([OUTSIDER]);

        const rows = await harness.database.db
          .select({
            actorId: adminActions.actorId,
            action: adminActions.action,
            subjectId: adminActions.subjectId,
          })
          .from(adminActions)
          .where(eq(adminActions.subjectId, peerId));
        expect(rows).toEqual([{ actorId, action: 'operator_account_closed', subjectId: peerId }]);
      });

      it('refuses the last live operator with a 409, even when they are the actor', async () => {
        const actorId = await signIn(ADMIN, true);
        const peerId = await signIn(OUTSIDER, true);

        // Two live: the self-closure refusal answers, not the last-operator one.
        const whileTwo = await close(ADMIN, actorId);
        expect(whileTwo.statusCode).toBe(403);

        expect((await close(ADMIN, peerId)).statusCode).toBe(200);

        // One live: the structural refusal answers first, on its own terms.
        const whileOne = await close(ADMIN, actorId);
        expect(whileOne.statusCode).toBe(409);
        expect(whileOne.json().message).toBe(LAST_OPERATOR_REFUSAL);

        const [account] = await harness.database.db
          .select({ deletedAt: users.deletedAt })
          .from(users)
          .where(eq(users.id, actorId));
        expect(account!.deletedAt).toBeNull();
      });

      it('does not count a banned operator as one who can still sign in', async () => {
        const actorId = await signIn(ADMIN, true);
        const bannedId = await signIn(OUTSIDER, true);
        await harness.database.db
          .update(users)
          .set({ isBanned: true })
          .where(eq(users.id, bannedId));

        const response = await close(ADMIN, actorId);

        expect(response.statusCode).toBe(409);
        expect(response.json().message).toBe(LAST_OPERATOR_REFUSAL);
      });

      it('still writes user_closed for an ordinary account', async () => {
        await signIn(ADMIN, true);
        const customerId = await signIn(CUSTOMER);

        expect((await close(ADMIN, customerId)).statusCode).toBe(200);

        const rows = await harness.database.db
          .select({ action: adminActions.action })
          .from(adminActions)
          .where(eq(adminActions.subjectId, customerId));
        expect(rows).toEqual([{ action: 'user_closed' }]);
      });

      /**
       * AC6's source guard: the flat refusal of operator targets is gone, so the
       * only 403 left in `closeAccount` is the self-closure one. Counted on the
       * code with comments stripped, because a needle a comment can carry is a
       * guard that cannot fail.
       */
      it('keeps no refusal of operator targets in closeAccount', () => {
        const source = readFileSync(new URL('./data-rights.service.ts', import.meta.url), 'utf8');
        const start = source.indexOf('export async function closeAccount(');
        const end = source.indexOf('\nexport ', start + 1);
        const body = source
          .slice(start, end)
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '');

        expect(start).toBeGreaterThan(-1);
        expect(body.match(/forbidden\(/g)).toEqual(['forbidden(']);
        expect(body).toContain("forbidden('You cannot close your own account')");
      });
    });

    it('refuses a second closure of the same account', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);

      const first = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/close`,
        headers: bearer(ADMIN),
      });
      expect(first.statusCode).toBe(200);

      const second = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/close`,
        headers: bearer(ADMIN),
      });
      expect(second.statusCode).toBe(409);
      expect(second.json().message).toContain('already closed');
    });

    it('refuses an operator closing their own account', async () => {
      const actorId = await signIn(ADMIN, true);
      // A second live operator, so the last-operator refusal cannot be what answers.
      await signIn(OUTSIDER, true);

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${actorId}/close`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(403);
    });

    it('is refused for a caller who is not an admin', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      await signIn(OUTSIDER);

      const response = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/close`,
        headers: bearer(OUTSIDER),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('the unwind copies', () => {
    /**
     * The closure and the Clerk backstop are the **same decision** about the
     * account holder's own bookings, so they must select the same branch.
     *
     * `account-holder` on a closure an operator typed is deliberate: the word
     * names whose decision it is, not whose hands were on the keyboard, and it
     * is what makes the branch leave a slipped-through booking standing instead
     * of refunding it in full — the money decision D39 refuses to make.
     */
    it('closure and deletion both refuse to price the account holder’s bookings', () => {
      expect(CLOSURE_UNWIND.initiatedBy).toBe('account-holder');
      expect(DELETION_UNWIND.initiatedBy).toBe('account-holder');
      expect(SUSPENSION_UNWIND.initiatedBy).toBe('operator');
    });

    /** One mechanism, one set of words — everything but the namespacing agrees. */
    it('shares its copy with the deletion path and namespaces its idempotency key', () => {
      const { operation, refundKeyPrefix, ...closureCopy } = CLOSURE_UNWIND;
      const {
        operation: deletionOperation,
        refundKeyPrefix: deletionPrefix,
        ...deletionCopy
      } = DELETION_UNWIND;

      expect(closureCopy).toEqual(deletionCopy);
      expect(operation).not.toBe(deletionOperation);
      expect(refundKeyPrefix).not.toBe(deletionPrefix);
    });
  });

  describe('the legal record', () => {
    it('is readable per user and per vendor, and says it is read-only', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();

      /* The Terms row is already there from signing in; the agreement is not. */
      await harness.database.db.insert(legalAcceptances).values({
        vendorId: vendor.profileId,
        document: 'vendor_agreement',
        version: CURRENT_VENDOR_AGREEMENT_VERSION,
        documentSha256: legalDocumentSha256('vendor_agreement'),
        acceptanceMethod: 'clickwrap_checkbox',
        acceptedByUserId: vendor.userId,
        acceptedByName: 'Test User',
        businessName: 'Sunlit Studio',
        ip: '203.0.113.2',
        userAgent: 'Mozilla/5.0',
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: `/admin/users/${vendor.userId}/data-rights`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      /*
       * Both rows through one read. `accepted_by_user_id` is what a row is
       * about since #429, so "per vendor" and "per user" are the same question
       * asked of a vendor's account.
       */
      expect(body.legalAcceptances).toHaveLength(2);
      expect(body.legalAcceptances.map((row: { document: string }) => row.document)).toEqual([
        'terms_of_service',
        'vendor_agreement',
      ]);
      expect(body.legalAcceptances[1]).toMatchObject({
        businessName: 'Sunlit Studio',
        ip: '203.0.113.2',
      });
      expect(body.retained.legalAcceptances).toBe(2);

      /*
       * Read-only by construction: there is no write route to try. Asserted as
       * the router's own answer rather than as a claim in a comment.
       */
      for (const method of ['PUT', 'DELETE', 'PATCH'] as const) {
        const refused = await harness.app.inject({
          method,
          url: `/admin/users/${vendor.userId}/data-rights`,
          headers: bearer(ADMIN),
        });
        expect(refused.statusCode).toBe(404);
      }
    });

    it('reports what a closed account still holds rather than an empty record', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile();

      await createBooking(customerId, vendor.profileId, '2020-06-01', 'completed');
      await harness.database.db.insert(notifications).values({
        userId: customerId,
        type: 'booking_confirmed',
        title: 'Your booking is confirmed',
        body: 'Sunlit Studio confirmed 1 June.',
      });

      const closed = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/close`,
        headers: bearer(ADMIN),
      });
      expect(closed.statusCode).toBe(200);

      const response = await harness.app.inject({
        method: 'GET',
        url: `/admin/users/${customerId}/data-rights`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.closedAt).not.toBeNull();
      expect(body.retained).toMatchObject({
        bookingRequests: 1,
        bookings: 1,
        notifications: 1,
      });
      /* A closed account has nothing left to block a closure. */
      expect(body.closeBlockers).toEqual([]);
    });

    /**
     * The divergence #462 records, on the one console surface **every** role
     * reaches — `/admin/customers?flag=email-stale` is `role = 'customer'` by
     * domain, so a vendor whose address went stale is only visible here.
     *
     * The export is asserted in the same test rather than a second one,
     * because the two are one rule: this file's own contract is that the
     * console cannot report a record the export does not hand over, and these
     * two fields are personal data that survives closure.
     */
    it('reports a stale address to the operator and to the subject alike', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);

      await harness.database.db
        .update(users)
        .set({ pendingEmail: 'moved@example.com', emailSyncFailedAt: new Date('2026-09-01') })
        .where(eq(users.id, customerId));

      const rights = await harness.app.inject({
        method: 'GET',
        url: `/admin/users/${customerId}/data-rights`,
        headers: bearer(ADMIN),
      });

      expect(rights.statusCode).toBe(200);
      expect(rights.json().pendingEmail).toBe('moved@example.com');
      expect(new Date(rights.json().emailSyncFailedAt as string)).toEqual(new Date('2026-09-01'));

      const exported = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/export`,
        headers: bearer(ADMIN),
      });

      expect(exported.statusCode).toBe(200);
      expect(exported.json().subject.pendingEmail).toBe('moved@example.com');
      expect(exported.json().subject.emailSyncFailedAt).not.toBeNull();
    });

    it('counts exactly what the export enumerates', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const customerId = await signIn(CUSTOMER);
      const vendor = await createVendorProfile();

      await createBooking(customerId, vendor.profileId, '2020-06-01', 'completed');
      await createBooking(customerId, vendor.profileId, '2020-07-01', 'completed');

      const rights = await harness.app.inject({
        method: 'GET',
        url: `/admin/users/${customerId}/data-rights`,
        headers: bearer(ADMIN),
      });
      const exported = await harness.app.inject({
        method: 'POST',
        url: `/admin/users/${customerId}/export`,
        headers: bearer(ADMIN),
      });

      expect(rights.statusCode).toBe(200);
      expect(exported.statusCode).toBe(200);

      const counts = rights.json().retained;
      const archive = exported.json();

      expect(counts.bookings).toBe(archive.bookings.length);
      expect(counts.bookingRequests).toBe(archive.bookingRequests.length);
      expect(counts.messages).toBe(archive.messages.length);
      expect(counts.notifications).toBe(archive.notifications.length);
      expect(counts.legalAcceptances).toBe(archive.legalAcceptances.length);
    });

    it('is refused for a caller who is not an admin', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      await signIn(OUTSIDER);

      const response = await harness.app.inject({
        method: 'GET',
        url: `/admin/users/${customerId}/data-rights`,
        headers: bearer(OUTSIDER),
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
