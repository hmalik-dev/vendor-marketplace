import { Writable } from 'node:stream';
import { eq, notInArray, sql } from 'drizzle-orm';
import {
  adminActions,
  bookingRequests,
  bookings,
  categories,
  reviews,
  tagSuggestions,
  tags,
  users,
  vendorCategories,
  vendorProfiles,
  vendorTags,
} from '@vendor-marketplace/db/schema';
import type { AdminActionRow } from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * The action log — #434.
 *
 * Its own file rather than another block in `admin.routes.test.ts`, which is
 * already 1,500 lines and is being edited by two other lanes. The subject here
 * is orthogonal to what that file asserts: not "does the route do the right
 * thing" but "did the console record that an operator did it".
 *
 * Every assertion reads `admin_actions` through the real database. There is no
 * fake to mock — the whole claim is that a row lands in Postgres.
 */
const ADMIN = 'user_activity_admin';
const OTHER_ADMIN = 'user_activity_admin_two';
const VENDOR = 'user_activity_vendor';
const CUSTOMER = 'user_activity_customer';

describe('the admin action log', () => {
  let harness: TestHarness;
  let photographyId: string;
  let seededTagIds: string[];

  /**
   * `normalizeRole` refuses `admin` from Clerk metadata on purpose, so an admin
   * cannot be minted through sync. Sign in to create the row, then promote it.
   */
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

  async function createVendorProfile(): Promise<{ profileId: string; userId: string }> {
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
      .select({ id: vendorProfiles.id, userId: vendorProfiles.userId })
      .from(vendorProfiles)
      .limit(1);
    const row = rows[0]!;

    return { profileId: row.id, userId: row.userId };
  }

  /** A completed booking with a review on it — what a review deletion needs. */
  async function createReview(
    customerId: string,
    vendorProfileId: string,
    content: string,
  ): Promise<string> {
    const requestRows = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId: vendorProfileId,
        eventDate: '2099-06-01',
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
        eventDate: '2099-06-01',
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'completed',
      })
      .returning({ id: bookings.id });

    const rows = await harness.database.db
      .insert(reviews)
      .values({
        bookingId: bookingRows[0]!.id,
        reviewerId: customerId,
        vendorId: vendorProfileId,
        type: 'customer_to_vendor',
        rating: 2,
        content,
      })
      .returning({ id: reviews.id });

    return rows[0]!.id;
  }

  async function actionRows(): Promise<AdminActionRow[]> {
    return harness.database.db.select().from(adminActions);
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role] of [
      [ADMIN, 'customer'],
      [OTHER_ADMIN, 'customer'],
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
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

    const seeded = await harness.database.db.select({ id: tags.id }).from(tags);
    seededTagIds = seeded.map((row) => row.id);
  });

  afterEach(async () => {
    await harness.database.db.delete(reviews);
    await harness.database.db.delete(tagSuggestions);
    await harness.database.db.delete(vendorTags);
    await harness.database.db.delete(tags).where(notInArray(tags.id, seededTagIds));
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    /*
     * The action rows go **with the operator**, never on their own.
     *
     * `admin_actions` refuses a direct DELETE while the actor still exists —
     * that is the whole point of the table — and lets the cascade through when
     * the account itself is erased. So deleting `users` is what clears it, and
     * a teardown that tried to clear it first would be the tampering the
     * trigger is there to refuse. Same shape as the legal-agreement suite's.
     */
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('every mutating route writes exactly one row', () => {
    it('records a ban against the account it suspended', async () => {
      const actorId = await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/ban`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      const rows = await actionRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId,
        action: 'user_banned',
        subjectType: 'user',
        subjectId: vendor.userId,
      });
      // The counts a later reader needs — including the one that needs a human.
      expect(rows[0]?.detail).toMatchObject({
        requestsDeclined: 0,
        bookingsCancelled: 0,
        refundsIssued: 0,
        refundsFailed: 0,
        profileUnpublished: false,
      });
    });

    it('records an unban as its own action, not as a second ban row', async () => {
      const actorId = await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();

      await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/ban`,
        headers: bearer(ADMIN),
      });
      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/unban`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      const rows = await actionRows();
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.action).sort()).toEqual(['user_banned', 'user_unbanned']);
      expect(rows.every((row) => row.actorId === actorId)).toBe(true);
    });

    it('records a review deletion by id, with the review already gone', async () => {
      const actorId = await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();
      const reviewId = await createReview(customerId, vendor.profileId, 'Recorded for the queue.');

      const response = await harness.app.inject({
        method: 'DELETE',
        url: `/admin/reviews/${reviewId}`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(204);
      const rows = await actionRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId,
        action: 'review_deleted',
        subjectType: 'review',
        subjectId: reviewId,
      });
    });

    it('records a tag rename, naming what it was before', async () => {
      const actorId = await signIn(ADMIN, true);
      const created = await harness.database.db
        .insert(tags)
        .values({ name: 'Soy Free', slug: 'dietary-soy-free', category: 'dietary' })
        .returning({ id: tags.id });
      const tagId = created[0]!.id;

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tags/${tagId}`,
        headers: bearer(ADMIN),
        payload: { name: 'Soya Free' },
      });

      expect(response.statusCode).toBe(200);
      const rows = await actionRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId,
        action: 'tag_updated',
        subjectType: 'tag',
        subjectId: tagId,
        detail: { name: 'Soya Free', previousName: 'Soy Free' },
      });
    });

    /**
     * A PUT that names no change is not a mutation, and the log says so by
     * staying empty — the one deliberate departure from "one row per successful
     * call". See the early return in `updateTag`.
     */
    it('records nothing for a tag update that changes nothing', async () => {
      await signIn(ADMIN, true);
      const created = await harness.database.db
        .insert(tags)
        .values({ name: 'Soy Free', slug: 'dietary-soy-free', category: 'dietary' })
        .returning({ id: tags.id });

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tags/${created[0]!.id}`,
        headers: bearer(ADMIN),
        payload: { name: 'Soy Free' },
      });

      expect(response.statusCode).toBe(200);
      expect(await actionRows()).toHaveLength(0);
    });

    it('records an approved tag suggestion, naming the tag it created', async () => {
      const actorId = await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();
      /*
       * A name the seed does not already carry. `Halal` is one of the 43 seeded
       * dietary tags, and an approve that finds an existing name resolves as a
       * **merge** rather than a create — correctly, and it is asserted three
       * tests below. This one is about the create.
       */
      const suggested = await harness.database.db
        .insert(tagSuggestions)
        .values({ vendorId: vendor.userId, suggestedName: 'Raw Vegan Menu', category: 'dietary' })
        .returning({ id: tagSuggestions.id });
      const suggestionId = suggested[0]!.id;

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${suggestionId}`,
        headers: bearer(ADMIN),
        payload: { action: 'approve' },
      });

      expect(response.statusCode).toBe(200);
      const rows = await actionRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId,
        action: 'tag_suggestion_resolved',
        subjectType: 'tag_suggestion',
        subjectId: suggestionId,
      });
      expect(rows[0]?.detail).toMatchObject({
        outcome: 'approved',
        tagId: response.json().tag.id,
      });
    });

    it('records a rejected suggestion as one row, not two', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();
      const suggested = await harness.database.db
        .insert(tagSuggestions)
        .values({ vendorId: vendor.userId, suggestedName: 'Halal', category: 'dietary' })
        .returning({ id: tagSuggestions.id });

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${suggested[0]!.id}`,
        headers: bearer(ADMIN),
        payload: { action: 'reject', adminNote: 'Already covered by the dietary vocabulary.' },
      });

      expect(response.statusCode).toBe(200);
      const rows = await actionRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.detail).toEqual({ outcome: 'rejected' });
    });

    /**
     * An approve that finds an existing name recurses into the merge path.
     * **One row, not two** — the outer call returns the recursion's result
     * rather than continuing, and a second row here would mean it did both.
     */
    it('records a name-matched approval once, as the merge it becomes', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();
      const existing = await harness.database.db
        .insert(tags)
        .values({ name: 'Soy Free', slug: 'dietary-soy-free', category: 'dietary' })
        .returning({ id: tags.id });
      const suggested = await harness.database.db
        .insert(tagSuggestions)
        .values({ vendorId: vendor.userId, suggestedName: '  soy free ', category: 'dietary' })
        .returning({ id: tagSuggestions.id });

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${suggested[0]!.id}`,
        headers: bearer(ADMIN),
        payload: { action: 'approve' },
      });

      expect(response.statusCode).toBe(200);
      const rows = await actionRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.detail).toEqual({ outcome: 'merged', tagId: existing[0]!.id });
    });
  });

  describe('a refused call writes nothing', () => {
    it('writes no row when an operator is refused their own ban (403)', async () => {
      const actorId = await signIn(ADMIN, true);

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${actorId}/ban`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(403);
      expect(await actionRows()).toHaveLength(0);
    });

    it('writes no second row when a ban is re-issued against a banned account (409)', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();

      await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/ban`,
        headers: bearer(ADMIN),
      });
      const again = await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/ban`,
        headers: bearer(ADMIN),
      });

      expect(again.statusCode).toBe(409);
      expect(await actionRows()).toHaveLength(1);
    });

    it('writes no row when a review deletion finds nothing (404)', async () => {
      await signIn(ADMIN, true);
      const missing = '00000000-0000-4000-8000-000000000000';

      const response = await harness.app.inject({
        method: 'DELETE',
        url: `/admin/reviews/${missing}`,
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(404);
      expect(await actionRows()).toHaveLength(0);
    });

    /**
     * The tag rename rolls back with its audit row, which is what the
     * transaction buys: a clash is refused and neither the tag nor the record
     * of a rename survives it.
     */
    it('writes no row when a tag rename clashes with an existing name (409)', async () => {
      await signIn(ADMIN, true);
      await harness.database.db
        .insert(tags)
        .values({ name: 'Soy Free', slug: 'dietary-soy-free', category: 'dietary' });
      const target = await harness.database.db
        .insert(tags)
        .values({ name: 'Nut Free', slug: 'dietary-nut-free', category: 'dietary' })
        .returning({ id: tags.id });

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tags/${target[0]!.id}`,
        headers: bearer(ADMIN),
        payload: { name: 'Soy Free' },
      });

      expect(response.statusCode).toBe(409);
      expect(await actionRows()).toHaveLength(0);
    });

    it('writes no row when a suggestion has already been resolved (409)', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();
      const suggested = await harness.database.db
        .insert(tagSuggestions)
        .values({ vendorId: vendor.userId, suggestedName: 'Halal', category: 'dietary' })
        .returning({ id: tagSuggestions.id });

      await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${suggested[0]!.id}`,
        headers: bearer(ADMIN),
        payload: { action: 'reject', adminNote: 'Already covered.' },
      });
      const again = await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${suggested[0]!.id}`,
        headers: bearer(ADMIN),
        payload: { action: 'reject', adminNote: 'Already covered.' },
      });

      expect(again.statusCode).toBe(409);
      expect(await actionRows()).toHaveLength(1);
    });
  });

  describe('what a row must never contain', () => {
    /**
     * Acceptance 5. The detail payload records *what changed*, never the content
     * of what was moderated — a moderation log that quotes the abuse is a second
     * copy of it, kept for longer and read by more people.
     *
     * Asserted over the **whole serialised table** rather than field by field,
     * so a detail key added later without thinking is caught by the same test.
     */
    it('keeps no review text, no email address and no note in any row', async () => {
      const REVIEW_TEXT = 'The photographer never turned up and swore at my mother.';
      const ADMIN_NOTE = 'Rejected because we already carry this under a different name.';

      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();
      const reviewId = await createReview(customerId, vendor.profileId, REVIEW_TEXT);

      await harness.app.inject({
        method: 'DELETE',
        url: `/admin/reviews/${reviewId}`,
        headers: bearer(ADMIN),
      });
      await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/ban`,
        headers: bearer(ADMIN),
      });

      const suggested = await harness.database.db
        .insert(tagSuggestions)
        .values({ vendorId: vendor.userId, suggestedName: 'Halal', category: 'dietary' })
        .returning({ id: tagSuggestions.id });
      await harness.app.inject({
        method: 'PUT',
        url: `/admin/tag-suggestions/${suggested[0]!.id}`,
        headers: bearer(ADMIN),
        payload: { action: 'reject', adminNote: ADMIN_NOTE },
      });

      const serialised = JSON.stringify(await actionRows());

      expect(serialised).not.toContain(REVIEW_TEXT);
      expect(serialised).not.toContain('swore');
      expect(serialised).not.toContain(ADMIN_NOTE);
      expect(serialised).not.toContain('@example.com');
    });
  });

  describe('the activity feed', () => {
    it('refuses a non-admin before it validates the query', async () => {
      await signIn(CUSTOMER);

      const response = await harness.app.inject({
        method: 'GET',
        url: '/admin/activity?action=not-an-action&page=0',
        headers: bearer(CUSTOMER),
      });

      expect(response.statusCode).toBe(403);
      // Nothing about the enum leaks to a caller who may not read this at all.
      expect(response.body).not.toContain('user_banned');
    });

    it('lists what the console did, newest first, with the actor named', async () => {
      const actorId = await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();

      await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/ban`,
        headers: bearer(ADMIN),
      });
      await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/unban`,
        headers: bearer(ADMIN),
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/admin/activity',
        headers: bearer(ADMIN),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.total).toBe(2);
      expect(body.items).toHaveLength(2);
      expect(body.items[0]).toMatchObject({
        actorId,
        actorName: 'Test User',
        action: 'user_unbanned',
        subjectType: 'user',
        subjectId: vendor.userId,
      });
      expect(body.items[1].action).toBe('user_banned');
      // The payload survives the wire rather than being flattened to a string.
      expect(body.items[1].detail.refundsFailed).toBe(0);
    });

    it('filters by actor, so one operator can be read on their own', async () => {
      const firstActor = await signIn(ADMIN, true);
      const secondActor = await signIn(OTHER_ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();

      await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/ban`,
        headers: bearer(ADMIN),
      });
      await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/unban`,
        headers: bearer(OTHER_ADMIN),
      });

      const mine = await harness.app.inject({
        method: 'GET',
        url: `/admin/activity?actor=${firstActor}`,
        headers: bearer(ADMIN),
      });

      expect(mine.statusCode).toBe(200);
      expect(mine.json().total).toBe(1);
      expect(mine.json().items[0]).toMatchObject({ actorId: firstActor, action: 'user_banned' });

      const theirs = await harness.app.inject({
        method: 'GET',
        url: `/admin/activity?actor=${secondActor}`,
        headers: bearer(ADMIN),
      });

      expect(theirs.json().total).toBe(1);
      expect(theirs.json().items[0]).toMatchObject({
        actorId: secondActor,
        action: 'user_unbanned',
      });
    });

    /**
     * "What did the console do to this account" — the filter that makes this a
     * record rather than a firehose.
     */
    it('filters by subject, across actions of different kinds', async () => {
      await signIn(ADMIN, true);
      const customerId = await signIn(CUSTOMER);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();
      const reviewId = await createReview(customerId, vendor.profileId, 'Recorded for the queue.');

      await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/ban`,
        headers: bearer(ADMIN),
      });
      await harness.app.inject({
        method: 'DELETE',
        url: `/admin/reviews/${reviewId}`,
        headers: bearer(ADMIN),
      });

      const onTheAccount = await harness.app.inject({
        method: 'GET',
        url: `/admin/activity?subject=${vendor.userId}`,
        headers: bearer(ADMIN),
      });

      expect(onTheAccount.statusCode).toBe(200);
      expect(onTheAccount.json().total).toBe(1);
      expect(onTheAccount.json().items[0]).toMatchObject({
        action: 'user_banned',
        subjectId: vendor.userId,
      });

      const onTheReview = await harness.app.inject({
        method: 'GET',
        url: `/admin/activity?subject=${reviewId}`,
        headers: bearer(ADMIN),
      });

      expect(onTheReview.json().total).toBe(1);
      expect(onTheReview.json().items[0]).toMatchObject({
        action: 'review_deleted',
        subjectId: reviewId,
      });
    });

    it('narrows by action as well, and answers an empty page rather than 404', async () => {
      await signIn(ADMIN, true);
      await signIn(VENDOR);
      const vendor = await createVendorProfile();

      await harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendor.userId}/ban`,
        headers: bearer(ADMIN),
      });

      const none = await harness.app.inject({
        method: 'GET',
        url: '/admin/activity?action=dispute_resolved',
        headers: bearer(ADMIN),
      });

      expect(none.statusCode).toBe(200);
      expect(none.json()).toMatchObject({ items: [], total: 0, page: 1 });
    });
  });
});

/**
 * What a failed audit write does — and it is two different things by design.
 *
 * The rule `recordAdminActionBestEffort` states is: **best-effort if and only
 * if the operation has already committed an irreversible effect outside
 * Postgres; otherwise the row rides the transaction.** Both halves are asserted
 * here, because a rule with only one half tested is a rule that drifts.
 *
 * The failure is made real rather than mocked: the table is renamed out from
 * under the insert, so Postgres itself refuses the write with "relation does
 * not exist". `.claude/rules/db-schema.md` asks for the real engine, and a
 * stubbed DAO would prove only that the code catches what the stub throws.
 */
describe('a failed action write', () => {
  const captured: string[] = [];
  let harness: TestHarness;
  let vendorUserId: string;
  let reviewId: string;

  const collector = new Writable({
    write(chunk, _encoding, callback) {
      captured.push(String(chunk));
      callback();
    },
  });

  /** Hides the table for one call, however that call ends. */
  async function withActionLogMissing<T>(work: () => Promise<T>): Promise<T> {
    await harness.database.db.execute(sql.raw('ALTER TABLE admin_actions RENAME TO gone_for_now'));

    try {
      return await work();
    } finally {
      await harness.database.db.execute(
        sql.raw('ALTER TABLE gone_for_now RENAME TO admin_actions'),
      );
    }
  }

  beforeAll(async () => {
    harness = await createTestHarness({ env: { LOG_LEVEL: 'trace' }, loggerStream: collector });

    for (const [clerkUserId, role] of [
      [ADMIN, 'customer'],
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
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

    for (const who of [ADMIN, CUSTOMER, VENDOR]) {
      await harness.app.inject({ method: 'GET', url: '/users/me', headers: bearer(who) });
    }
    await harness.database.db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.clerkUserId, ADMIN));

    const categoryRows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [categoryRows[0]!.id],
        city: 'Austin',
        state: 'TX',
      },
    });

    const vendorRows = await harness.database.db
      .select({ id: vendorProfiles.id, userId: vendorProfiles.userId })
      .from(vendorProfiles)
      .limit(1);
    const customerRows = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, CUSTOMER))
      .limit(1);
    vendorUserId = vendorRows[0]!.userId;

    const requestRows = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId: customerRows[0]!.id,
        vendorId: vendorRows[0]!.id,
        eventDate: '2099-06-01',
        status: 'accepted',
        finalPriceCents: 120_000,
      })
      .returning({ id: bookingRequests.id });
    const bookingRows = await harness.database.db
      .insert(bookings)
      .values({
        requestId: requestRows[0]!.id,
        customerId: customerRows[0]!.id,
        vendorId: vendorRows[0]!.id,
        eventDate: '2099-06-01',
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'completed',
      })
      .returning({ id: bookings.id });
    const reviewRows = await harness.database.db
      .insert(reviews)
      .values({
        bookingId: bookingRows[0]!.id,
        reviewerId: customerRows[0]!.id,
        vendorId: vendorRows[0]!.id,
        type: 'customer_to_vendor',
        rating: 2,
        content: 'Recorded for the moderation queue.',
      })
      .returning({ id: reviews.id });
    reviewId = reviewRows[0]!.id;
  });

  afterAll(async () => {
    await harness.close();
  });

  /**
   * The transactional half, and the sharper of the two.
   *
   * A review deletion touches nothing outside Postgres, so the audit row rides
   * its transaction — and the operation is refused rather than completing
   * unrecorded. That is the outcome worth having: a review deleted with no
   * record of who deleted it is unrecoverable in both directions, while a
   * refusal leaves the operator a button that still works.
   */
  it('rolls the review deletion back rather than deleting it unrecorded', async () => {
    captured.length = 0;

    const response = await withActionLogMissing(() =>
      harness.app.inject({
        method: 'DELETE',
        url: `/admin/reviews/${reviewId}`,
        headers: bearer(ADMIN),
      }),
    );

    expect(response.statusCode).toBe(500);
    // The review is still there, which is the whole point of the transaction.
    const remaining = await harness.database.db.select().from(reviews);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(reviewId);
  });

  /**
   * The best-effort half — acceptance 3.
   *
   * A ban has already refunded cards through Stripe by the time it reaches the
   * log, and no `ROLLBACK` reaches that. A 500 here would send the operator
   * into a retry against a half-applied ban, so the operation stands and the
   * gap is recorded loudly instead.
   */
  it('lets a ban stand and logs the failure as an error', async () => {
    captured.length = 0;

    const response = await withActionLogMissing(() =>
      harness.app.inject({
        method: 'PUT',
        url: `/admin/users/${vendorUserId}/ban`,
        headers: bearer(ADMIN),
      }),
    );

    // The ban stands, which is the whole point.
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ userId: vendorUserId, isBanned: true });

    const banned = await harness.database.db
      .select({ isBanned: users.isBanned })
      .from(users)
      .where(eq(users.id, vendorUserId));
    expect(banned[0]?.isBanned).toBe(true);

    // Loudly, so the gap is findable rather than silent.
    const logged = captured.join('');
    expect(logged).toContain('its action could not be logged');
    expect(logged).toContain('"level":50');
  });

  /** And with the table back, the same ban records normally. */
  it('records the action again once the table is reachable', async () => {
    const response = await harness.app.inject({
      method: 'PUT',
      url: `/admin/users/${vendorUserId}/unban`,
      headers: bearer(ADMIN),
    });

    expect(response.statusCode).toBe(200);
    const rows = await harness.database.db.select().from(adminActions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'user_unbanned', subjectId: vendorUserId });
  });
});
