import {
  adminConversationMessagesSchema,
  ERROR_CODES,
  REPORT_RATE_LIMIT,
  REPORT_REASON_LABELS,
  SUPPORT_REFERENCE_PATTERN,
  type ReportSubject,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import {
  adminActions,
  bookingRequests,
  bookings,
  categories,
  conversations,
  messages,
  notifications,
  portfolioItems,
  reviews,
  supportCases,
  users,
  vendorCategories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * In-product reporting and case-scoped message reads (#436).
 *
 * The suite is written against the two things the ticket says must not happen:
 * a report that reaches nobody, and an operator who can read any thread they
 * can name. Everything else here follows from those.
 */

/** Dates come back over the wire as strings; the assertions parse them back. */
const wireConversationSchema = adminConversationMessagesSchema.extend({
  messages: z.object({
    items: z.array(
      adminConversationMessagesSchema.shape.messages.shape.items.element.extend({
        readAt: z.coerce.date().nullable(),
        createdAt: z.coerce.date(),
      }),
    ),
    total: z.int(),
    page: z.int(),
    pageSize: z.int(),
  }),
});

const ADMIN = 'user_admin_reports';
const VENDOR = 'user_vendor_reports';
const CUSTOMER = 'user_customer_reports';
const OUTSIDER = 'user_outsider_reports';

const PAST_EVENT = '2020-06-01';

interface Fixture {
  adminId: string;
  customerId: string;
  vendorUserId: string;
  outsiderId: string;
  vendorProfileId: string;
  reviewId: string;
  portfolioItemId: string;
  conversationId: string;
}

describe('reporting and message visibility (#436)', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function signIn(clerkUserId: string, promoteToAdmin = false): Promise<string> {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: bearer(clerkUserId),
    });
    expect(response.statusCode).toBe(200);

    if (promoteToAdmin) {
      await harness.database.db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.clerkUserId, clerkUserId));
    }

    const rows = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    return rows[0]!.id;
  }

  /** One storefront with a review, a photo and a thread — the four subjects. */
  async function seed(): Promise<Fixture> {
    const adminId = await signIn(ADMIN, true);
    const customerId = await signIn(CUSTOMER);
    const vendorUserId = await signIn(VENDOR);
    const outsiderId = await signIn(OUTSIDER);

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

    const profiles = await harness.database.db
      .select({ id: vendorProfiles.id })
      .from(vendorProfiles)
      .limit(1);
    const vendorProfileId = profiles[0]!.id;

    const requestRows = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId: vendorProfileId,
        eventDate: PAST_EVENT,
        status: 'accepted',
        finalPriceCents: 120_000,
      })
      .returning({ id: bookingRequests.id });

    const bookingRows = await harness.database.db
      .insert(bookings)
      .values({
        requestId: requestRows[0]!.id,
        customerId,
        vendorId: vendorProfileId,
        eventDate: PAST_EVENT,
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'confirmed',
        paidAt: new Date('2020-05-01T00:00:00Z'),
        stripePaymentIntentId: 'pi_report_fixture',
      })
      .returning({ id: bookings.id });

    const reviewRows = await harness.database.db
      .insert(reviews)
      .values({
        bookingId: bookingRows[0]!.id,
        reviewerId: customerId,
        vendorId: vendorProfileId,
        type: 'customer_to_vendor',
        rating: 1,
        content: 'They asked me to pay by bank transfer.',
      })
      .returning({ id: reviews.id });

    const photoRows = await harness.database.db
      .insert(portfolioItems)
      .values({ vendorId: vendorProfileId, imageUrl: 'https://example.test/photo.jpg' })
      .returning({ id: portfolioItems.id });

    const threadRows = await harness.database.db
      .insert(conversations)
      .values({ customerId, vendorId: vendorProfileId })
      .returning({ id: conversations.id });

    /*
     * Explicit, distinct timestamps. `findMessages` orders newest first and
     * breaks a tie on `id`, so two rows sharing one statement's `defaultNow()`
     * would assert against a random uuid ordering — a green suite that fails
     * on somebody else's machine.
     */
    await harness.database.db.insert(messages).values([
      {
        conversationId: threadRows[0]!.id,
        senderId: vendorUserId,
        content: 'Pay me directly and I will knock off the fee.',
        createdAt: new Date('2020-06-02T10:00:00Z'),
      },
      {
        conversationId: threadRows[0]!.id,
        senderId: customerId,
        content: 'I would rather not.',
        createdAt: new Date('2020-06-02T10:05:00Z'),
      },
    ]);

    return {
      adminId,
      customerId,
      vendorUserId,
      outsiderId,
      vendorProfileId,
      reviewId: reviewRows[0]!.id,
      portfolioItemId: photoRows[0]!.id,
      conversationId: threadRows[0]!.id,
    };
  }

  async function report(
    clerkUserId: string | null,
    subjectType: ReportSubject,
    subjectId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return harness.app.inject({
      method: 'POST',
      url: '/reports',
      ...(clerkUserId ? { headers: bearer(clerkUserId) } : {}),
      payload: { subjectType, subjectId, reason: 'off-platform-payment', ...overrides },
    });
  }

  async function casesFor(subjectId: string) {
    return harness.database.db
      .select()
      .from(supportCases)
      .where(eq(supportCases.subjectId, subjectId));
  }

  async function readThread(conversationId: string, clerkUserId = ADMIN) {
    return harness.app.inject({
      method: 'GET',
      url: `/admin/conversations/${conversationId}/messages`,
      headers: bearer(clerkUserId),
    });
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role] of [
      [ADMIN, 'customer'],
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
      [OUTSIDER, 'customer'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email: `${clerkUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    const rows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = rows[0]!.id;
  });

  afterEach(async () => {
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(supportCases);
    await harness.database.db.delete(messages);
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(reviews);
    await harness.database.db.delete(portfolioItems);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    /* `admin_actions` is immutable by trigger; the `users` cascade takes it. */
    await harness.database.db.delete(users);
    harness.email.sent.length = 0;
  });

  afterAll(async () => {
    await harness.close();
  });

  // --- Acceptance 1: who may report, and what -------------------------------

  it('lets a signed-in account report all four subjects', async () => {
    const fixture = await seed();

    const subjects: readonly (readonly [ReportSubject, string])[] = [
      ['vendor_profile', fixture.vendorProfileId],
      ['review', fixture.reviewId],
      ['portfolio_item', fixture.portfolioItemId],
      ['conversation', fixture.conversationId],
    ];

    for (const [subjectType, subjectId] of subjects) {
      const response = await report(CUSTOMER, subjectType, subjectId);

      expect(response.statusCode).toBe(200);
      expect(response.json().reference).toMatch(SUPPORT_REFERENCE_PATTERN);
    }

    const filed = await harness.database.db.select().from(supportCases);
    expect(filed).toHaveLength(subjects.length);
    expect(filed.map((row) => row.subjectType).sort()).toEqual(
      ['conversation', 'portfolio_item', 'review', 'vendor_profile'].sort(),
    );
  });

  it('refuses a signed-out reporter', async () => {
    const fixture = await seed();

    const response = await report(null, 'vendor_profile', fixture.vendorProfileId);

    expect(response.statusCode).toBe(401);
    expect(await casesFor(fixture.vendorProfileId)).toHaveLength(0);
  });

  /*
   * The id is attacker-controlled, so a subject that does not resolve is the
   * refusal rather than a case an operator opens onto nothing.
   */
  it('refuses a subject that resolves to no row', async () => {
    await seed();

    const response = await report(CUSTOMER, 'review', '00000000-0000-4000-8000-000000000000');

    expect(response.statusCode).toBe(404);
    expect(await harness.database.db.select().from(supportCases)).toHaveLength(0);
  });

  /*
   * The **vendor** arm of the participant check, and it needs its own test
   * because it fails closed and silently.
   *
   * `restrictedTo` is compared against `users.id`, but a conversation stores
   * the vendor's *profile* id — two id spaces that never collide. Read the
   * wrong one and every vendor reporting their own thread gets the 404 above,
   * indistinguishable from a deleted thread, while the customer arm keeps
   * passing. The party most likely to be reporting harassment is the one that
   * would go quiet.
   */
  it('lets the vendor on a thread report it, not only the customer', async () => {
    const fixture = await seed();

    const response = await report(VENDOR, 'conversation', fixture.conversationId);

    expect(response.statusCode).toBe(200);
    const [filed] = await casesFor(fixture.conversationId);
    expect(filed?.senderUserId).toBe(fixture.vendorUserId);
  });

  /*
   * A thread is private to its two parties. Somebody outside it gets the same
   * 404 a missing thread gets — a 403 would confirm the id is a real thread.
   */
  it('refuses a thread the reporter is not a party to, without confirming it exists', async () => {
    const fixture = await seed();

    const response = await report(OUTSIDER, 'conversation', fixture.conversationId);

    expect(response.statusCode).toBe(404);
    expect(await casesFor(fixture.conversationId)).toHaveLength(0);
  });

  // --- Acceptance 2: the report is a case in the #431 queue ------------------

  it('opens a case in the queue whose subject resolves to the real row', async () => {
    const fixture = await seed();

    const filed = await report(CUSTOMER, 'review', fixture.reviewId, {
      reason: 'harassment',
      detail: 'The vendor replied to my review with abuse.',
    });
    expect(filed.statusCode).toBe(200);

    const listed = await harness.app.inject({
      method: 'GET',
      url: '/admin/cases',
      headers: bearer(ADMIN),
    });
    expect(listed.statusCode).toBe(200);

    const page = listed.json() as {
      total: number;
      items: readonly {
        reference: string;
        origin: string;
        status: string;
        topic: string | null;
        subjectType: string | null;
        subjectId: string | null;
        reportReason: string | null;
      }[];
    };

    expect(page.total).toBe(1);
    const row = page.items[0]!;
    expect(row.reference).toBe(filed.json().reference);
    expect(row.origin).toBe('user_report');
    expect(row.status).toBe('open');
    expect(row.topic).toBe('trust-and-safety');
    expect(row.subjectType).toBe('review');
    expect(row.subjectId).toBe(fixture.reviewId);
    expect(row.reportReason).toBe('harassment');

    /* The subject really is the row: the case's id matches the review's. */
    const found = await harness.database.db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.id, row.subjectId!));
    expect(found).toHaveLength(1);
  });

  it('sends the report to the support inbox and keeps the reporter out of the case prose', async () => {
    const fixture = await seed();

    await report(CUSTOMER, 'vendor_profile', fixture.vendorProfileId, {
      detail: 'They asked for a bank transfer.',
    });
    await harness.flushEmail();

    expect(harness.email.sent).toHaveLength(1);
    const sent = harness.email.sent[0]!;
    /* The routing key leads the subject line, the way a support send's does. */
    expect(sent.subject).toContain(REPORT_REASON_LABELS['off-platform-payment']);
    expect(sent.replyTo).toBe(`${CUSTOMER}@example.com`);
    expect(sent.text).toContain('They asked for a bank transfer.');
    expect(sent.text).toContain('Sunlit Studio');

    const [filed] = await casesFor(fixture.vendorProfileId);
    expect(filed?.message).toContain('Sunlit Studio');
    expect(filed?.message).toContain('They asked for a bank transfer.');
    expect(filed?.senderUserId).toBe(fixture.customerId);
    expect(filed?.senderEmail).toBe(`${CUSTOMER}@example.com`);
  });

  /*
   * The guard on #431's finding, from the other direction. Both existing doors
   * freeze a payout and one of them used to do it in silence; this door places
   * no hold at all, so there is nothing to announce and nothing to forget.
   */
  it('places no payout hold and sends the vendor no freeze notice', async () => {
    const fixture = await seed();

    await report(CUSTOMER, 'conversation', fixture.conversationId);
    await harness.flushEmail();

    const held = await harness.database.db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.customerId, fixture.customerId));
    expect(held.map((row) => row.status)).toEqual(['confirmed']);

    const told = await harness.database.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.userId, fixture.vendorUserId));
    expect(told).toHaveLength(0);
  });

  /*
   * **A mail outage must not tell a reporter their report was lost.**
   *
   * Found in the browser, not here: an unverified `EMAIL_FROM` sender made
   * every report answer 502 — "That report did not reach us… try again" — while
   * every one of those reports was sitting in `/admin/cases` waiting to be
   * worked. A retry then files a duplicate case and spends one of the six an
   * hour, so the queue fills with the same complaint and its author is told
   * none of it arrived.
   *
   * The row is what an operator works, so the row is the delivery. The send is
   * a nudge, and its failure is recorded on the case rather than raised.
   */
  it('still files the report, and answers with its reference, when the notice cannot be sent', async () => {
    const fixture = await seed();
    harness.email.failNext = true;

    const response = await report(CUSTOMER, 'vendor_profile', fixture.vendorProfileId);

    expect(response.statusCode).toBe(200);
    expect(response.json().reference).toMatch(SUPPORT_REFERENCE_PATTERN);
    await harness.flushEmail();

    const [filed] = await casesFor(fixture.vendorProfileId);
    expect(filed?.reference).toBe(response.json().reference);
    expect(filed?.status).toBe('open');
    /* Recorded, so an operator can see this one is a case nobody was told about. */
    expect(filed?.emailFailedAt).toBeInstanceOf(Date);
  });

  /*
   * The other half, and the only failure that really does lose a report: the
   * row could not be written, so there is nothing in the queue and nothing to
   * quote. It answers 502 and carries **no** reference — a code that resolves
   * to no case is worse than no code.
   */
  it('answers 502 with no reference when the case row cannot be written', async () => {
    const fixture = await seed();

    /*
     * `freeText()` strips bidi controls and trims; neither removes `U+0000`,
     * and Postgres refuses a null byte with `22021`. So this is a real insert
     * failure a caller can cause, not a mock standing in for one.
     */
    const response = await report(CUSTOMER, 'vendor_profile', fixture.vendorProfileId, {
      detail: `They asked for a bank transfer.\u0000`,
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().details).toBeUndefined();
    expect(await casesFor(fixture.vendorProfileId)).toHaveLength(0);
  });

  // --- Acceptance 3: the limit, and the reader who is told about it ----------

  it('rate limits reports per account and says so rather than 500ing', async () => {
    const fixture = await seed();

    for (let attempt = 0; attempt < REPORT_RATE_LIMIT.max; attempt += 1) {
      const allowed = await report(CUSTOMER, 'vendor_profile', fixture.vendorProfileId);
      expect(allowed.statusCode).toBe(200);
    }

    const refused = await report(CUSTOMER, 'vendor_profile', fixture.vendorProfileId);
    expect(refused.statusCode).toBe(429);
    expect(refused.json()).toMatchObject({
      statusCode: 429,
      error: ERROR_CODES.RATE_LIMITED,
      message: expect.stringContaining('Too many requests'),
    });

    /* Keyed by account: a different one still has its whole allowance. */
    const other = await report(OUTSIDER, 'vendor_profile', fixture.vendorProfileId);
    expect(other.statusCode).toBe(200);
  });

  // --- Acceptance 4: the scoped, logged message read -------------------------

  it('refuses a conversation no case names', async () => {
    const fixture = await seed();

    const response = await readThread(fixture.conversationId);

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toContain('No open case');
  });

  it('refuses a conversation whose case has been resolved', async () => {
    const fixture = await seed();

    const filed = await report(CUSTOMER, 'conversation', fixture.conversationId);
    expect(filed.statusCode).toBe(200);

    const [row] = await casesFor(fixture.conversationId);
    const closed = await harness.app.inject({
      method: 'PUT',
      url: `/admin/cases/${row!.id}/resolve`,
      headers: bearer(ADMIN),
    });
    expect(closed.statusCode).toBe(200);

    const response = await readThread(fixture.conversationId);
    expect(response.statusCode).toBe(403);
  });

  it('refuses a non-admin caller', async () => {
    const fixture = await seed();
    await report(CUSTOMER, 'conversation', fixture.conversationId);

    for (const caller of [CUSTOMER, VENDOR]) {
      const response = await readThread(fixture.conversationId, caller);
      expect(response.statusCode).toBe(403);
    }
  });

  it('returns the thread under an open case and writes an action row for the read', async () => {
    const fixture = await seed();

    const filed = await report(CUSTOMER, 'conversation', fixture.conversationId);
    const [grant] = await casesFor(fixture.conversationId);

    const response = await readThread(fixture.conversationId);
    expect(response.statusCode).toBe(200);

    const body = wireConversationSchema.parse(response.json());
    expect(body.conversationId).toBe(fixture.conversationId);
    expect(body.caseId).toBe(grant!.id);
    expect(body.caseReference).toBe(filed.json().reference);
    expect(body.vendorName).toBe('Sunlit Studio');
    expect(body.messages.total).toBe(2);
    /*
     * `findMessages` pages backwards from the newest and returns each page
     * oldest-first, so the console reads a thread downwards exactly as its
     * participants do — the same function, not a second ordering for admins.
     */
    expect(body.messages.items.map((item) => item.content)).toEqual([
      'Pay me directly and I will knock off the fee.',
      'I would rather not.',
    ]);
    expect(body.messages.items.map((item) => item.senderSide)).toEqual(['vendor', 'customer']);

    /*
     * The assertion most likely to be forgotten, because the read succeeds
     * without it: every successful read leaves a row naming the conversation
     * and the case, and nothing of what was said.
     */
    const logged = await harness.database.db
      .select()
      .from(adminActions)
      .where(
        and(
          eq(adminActions.action, 'conversation_messages_read'),
          eq(adminActions.subjectId, fixture.conversationId),
        ),
      );
    expect(logged).toHaveLength(1);
    expect(logged[0]!.actorId).toBe(fixture.adminId);
    expect(logged[0]!.subjectType).toBe('conversation');
    expect(logged[0]!.detail).toMatchObject({
      caseId: grant!.id,
      reference: filed.json().reference,
    });
    expect(JSON.stringify(logged[0]!.detail)).not.toContain('Pay me directly');
  });

  it('writes no action row for a refused read', async () => {
    const fixture = await seed();

    expect((await readThread(fixture.conversationId)).statusCode).toBe(403);

    const logged = await harness.database.db
      .select({ id: adminActions.id })
      .from(adminActions)
      .where(eq(adminActions.action, 'conversation_messages_read'));
    expect(logged).toHaveLength(0);
  });

  // --- Acceptance 5: the operator reads, and never writes --------------------

  it('exposes no admin route that writes a message', async () => {
    const fixture = await seed();
    await report(CUSTOMER, 'conversation', fixture.conversationId);

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const response = await harness.app.inject({
        method,
        url: `/admin/conversations/${fixture.conversationId}/messages`,
        headers: bearer(ADMIN),
        payload: { content: 'This is the platform speaking.' },
      });

      expect(response.statusCode).toBe(404);
    }

    const stored = await harness.database.db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.conversationId, fixture.conversationId));
    expect(stored).toHaveLength(2);
  });
});
