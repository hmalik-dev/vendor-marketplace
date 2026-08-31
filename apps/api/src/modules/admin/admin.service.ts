import type { FastifyBaseLogger } from 'fastify';
import { addDays, generateSlug, toDateString } from '@vendor-marketplace/shared';
import type {
  AdminBanResult,
  AdminBookingPage,
  AdminBookingQuery,
  AdminCustomerPage,
  AdminCustomerQuery,
  AdminMetrics,
  AdminPaymentPage,
  AdminPaymentQuery,
  AdminReviewPage,
  AdminReviewQuery,
  AdminTagList,
  AdminTagRow,
  AdminTagSuggestionPage,
  AdminTagSuggestionQuery,
  AdminTagSuggestionResult,
  AdminTagSuggestionRow,
  AdminVendorFacets,
  AdminVendorPage,
  AdminVendorQuery,
  AdminVendorRow,
  AdminVendorStatus,
  FieldErrorDetails,
  ResolveTagSuggestion,
  TagCategory,
  UpdateTag,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import type { EventHub } from '../../lib/event-stream.js';
import type { StripeConnectGateway } from '../../lib/stripe.js';
import { conflict, forbidden, notFound, validationFailed } from '../../lib/errors.js';
import { insertNotification } from '../messaging/messaging.dao.js';
import { cancelBookingAndFreeDate } from '../payments/payments.dao.js';
import { deleteReviewAndRecalculate } from '../reviews/reviews.dao.js';
import { normalizeTagName } from '../tags/tags.service.js';
import {
  assignTagToVendor,
  countAdminBookings,
  countAdminCustomers,
  countAdminPayments,
  countAdminReviews,
  countAdminTagSuggestions,
  countAdminVendors,
  countVendorsHoldingTag,
  declineOpenRequests,
  findAdminBookings,
  findAdminCustomers,
  findAdminMetricSeries,
  findAdminMetricTotals,
  findAdminPayments,
  findAdminReviews,
  findAdminTagSuggestionById,
  findAdminTagSuggestions,
  findAdminTags,
  findAdminVendors,
  findConfirmedBookingsToUnwind,
  findTagByCategoryAndName,
  findTagById,
  findTagBySlug,
  findTagSuggestionById,
  findUserById,
  findVendorFilterFacets,
  findVendorProfileByUserId,
  findVendorProfileIdByUserId,
  insertTag,
  resolveTagSuggestionRow,
  setBanned,
  updateTagRow,
  type AdminTagSuggestionProjection,
  type AdminVendorFilters,
  type AdminVendorProjection,
  type DailyBucket,
} from './admin.dao.js';

/**
 * The page window's offset.
 *
 * One line, six call sites. An off-by-one here silently repeats or skips a row
 * rather than failing, which makes it the most expensive one-line bug this file
 * can host — so it is written once.
 */
function offsetOf(query: { page: number; pageSize: number }): number {
  return (query.page - 1) * query.pageSize;
}

/** Everything an admin operation needs. Mirrors `PaymentContext`, for the same reason. */
export interface AdminContext {
  db: AppDatabase;
  stripe: StripeConnectGateway;
  hub: EventHub;
  log: FastifyBaseLogger;
}

/**
 * The four statuses, derived from the three columns that actually record state.
 *
 * Order matters and is the same order `statusCondition` filters in: a banned
 * vendor is `flagged` whatever their publish flag says, because the ban is the
 * fact an operator needs to see first.
 */
export function deriveVendorStatus(row: {
  isBanned: boolean;
  isPublished: boolean;
  stripeOnboarded: boolean;
}): AdminVendorStatus {
  if (row.isBanned) {
    return 'flagged';
  }

  if (row.isPublished) {
    return 'live';
  }

  return row.stripeOnboarded ? 'paused' : 'review';
}

function toVendorRow(row: AdminVendorProjection): AdminVendorRow {
  return {
    id: row.id,
    userId: row.userId,
    businessName: row.businessName,
    slug: row.slug,
    categoryName: row.categoryName,
    city: row.city,
    state: row.state,
    avgRating: row.avgRating,
    reviewCount: row.reviewCount,
    bookingsCount: row.bookingsCount,
    status: deriveVendorStatus(row),
    stripeOnboarded: row.stripeOnboarded,
    createdAt: row.createdAt,
  };
}

export async function listVendors(
  db: AppDatabase,
  query: AdminVendorQuery,
): Promise<AdminVendorPage> {
  const filters: AdminVendorFilters = {
    q: query.q,
    category: query.category,
    city: query.city,
    payouts: query.payouts,
    status: query.status,
  };
  const offset = offsetOf(query);

  /*
   * The counts run against the same filters as the page, so the count line can
   * never describe a different set from the rows under it. See
   * `countAdminVendors` for why `awaitingReview` ignores `status`.
   */
  const [rows, counts] = await Promise.all([
    findAdminVendors(db, filters, query.pageSize, offset),
    countAdminVendors(db, filters),
  ]);

  return {
    items: rows.map(toVendorRow),
    ...counts,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Bans or unbans an account.
 *
 * **A ban is not just a flag.** It has to leave the marketplace in a state where
 * nobody is waiting on an account that can no longer answer: open requests are
 * declined, future confirmed bookings are cancelled and refunded **in full**,
 * and a vendor's storefront comes down.
 *
 * The refund is deliberately full rather than D3's cancellation tiers. Those
 * tiers price a *customer's* change of mind. Here the platform is removing a
 * party from a transaction the other side did nothing wrong in, so charging
 * them a cancellation penalty for our moderation decision would be indefensible.
 *
 * Order is the same one `cancelBooking` argues for and for the same reason: the
 * money moves before the row does. A refund that succeeded against a booking
 * that then failed to update is recoverable; a cancelled booking whose refund
 * never happened tells someone their money is coming back when it is not.
 */
export async function setUserBanned(
  context: AdminContext,
  actorId: string,
  targetId: string,
  isBanned: boolean,
  now: Date,
): Promise<AdminBanResult> {
  if (actorId === targetId) {
    /*
     * 403 rather than 400: this is a refusal about who the caller is, not about
     * the shape of what they sent. An admin who could ban themselves could lock
     * the platform's only operator out of it, and nothing else could undo it.
     */
    throw forbidden('You cannot ban your own account');
  }

  const target = await findUserById(context.db, targetId);

  if (!target) {
    throw notFound('No account with that id');
  }

  if (target.isBanned === isBanned) {
    throw conflict(isBanned ? 'That account is already banned' : 'That account is not banned');
  }

  const profile = await findVendorProfileByUserId(context.db, targetId);

  if (!isBanned) {
    /*
     * Unban is only the flag. The vendor republishes themselves — reinstating an
     * account is not the same as reinstating a listing, and the operator does not
     * decide when a vendor is ready to trade again.
     */
    const { profileUnpublished } = await setBanned(
      context.db,
      targetId,
      profile?.id ?? null,
      false,
      now,
    );

    return {
      userId: targetId,
      isBanned: false,
      requestsDeclined: 0,
      bookingsCancelled: 0,
      refundsIssued: 0,
      profileUnpublished,
    };
  }

  const today = toDateString(now);
  const affected = await findConfirmedBookingsToUnwind(
    context.db,
    targetId,
    profile?.id ?? null,
    today,
  );

  let refundsIssued = 0;
  let bookingsCancelled = 0;

  for (const booking of affected) {
    if (booking.stripePaymentIntentId) {
      try {
        await context.stripe.createRefund({
          paymentIntentId: booking.stripePaymentIntentId,
          amountCents: booking.totalAmountCents,
        });
        refundsIssued += 1;
      } catch (error) {
        /*
         * One failed refund must not abandon the rest of the ban. The account is
         * still removed, the remaining bookings are still unwound, and this one
         * is logged loudly because the money did not move and only a human can
         * finish it.
         */
        context.log.error(
          { bookingId: booking.id, err: error },
          'Refund failed while banning an account',
        );
        continue;
      }
    }

    const cancelled = await cancelBookingAndFreeDate(context.db, booking.id, {
      cancelledAt: now,
      cancellationReason: 'The other party’s account was suspended',
    });

    if (!cancelled) {
      continue;
    }

    bookingsCancelled += 1;

    const recipients = [booking.customerId, booking.vendorUserId].filter(
      (id): id is string => typeof id === 'string' && id !== targetId,
    );

    for (const recipient of recipients) {
      const stored = await insertNotification(context.db, {
        userId: recipient,
        type: 'booking_cancelled',
        title: 'A booking was cancelled',
        body: 'The other party’s account was suspended. Your payment has been refunded in full.',
        data: { bookingId: booking.id },
      });

      if (stored) {
        context.hub.publish(recipient, {
          type: 'new_notification',
          notification: {
            id: stored.id,
            type: stored.type,
            title: stored.title,
            body: stored.body,
            href: '/bookings',
            isRead: false,
            createdAt: stored.createdAt,
          },
        });
      }
    }
  }

  const requestsDeclined = await declineOpenRequests(
    context.db,
    targetId,
    profile?.id ?? null,
    now,
  );
  const { profileUnpublished } = await setBanned(
    context.db,
    targetId,
    profile?.id ?? null,
    true,
    now,
  );

  return {
    userId: targetId,
    isBanned: true,
    requestsDeclined,
    bookingsCancelled,
    refundsIssued,
    profileUnpublished,
  };
}

export async function listCustomers(
  db: AppDatabase,
  query: AdminCustomerQuery,
): Promise<AdminCustomerPage> {
  const offset = offsetOf(query);
  const [rows, total] = await Promise.all([
    findAdminCustomers(db, query.q, query.pageSize, offset),
    countAdminCustomers(db, query.q),
  ]);

  return { items: rows, total, page: query.page, pageSize: query.pageSize };
}

/** `First Last`, collapsed — the same shape every other admin surface prints. */
function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export async function listBookings(
  db: AppDatabase,
  query: AdminBookingQuery,
): Promise<AdminBookingPage> {
  const offset = offsetOf(query);
  const [rows, total] = await Promise.all([
    findAdminBookings(db, query.status, query.pageSize, offset),
    countAdminBookings(db, query.status),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      status: row.status,
      eventDate: row.eventDate,
      totalCents: row.totalAmountCents,
      customerName: fullName(row.customerFirstName, row.customerLastName),
      vendorName: row.vendorName,
      vendorSlug: row.vendorSlug,
      createdAt: row.createdAt,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function listPayments(
  db: AppDatabase,
  query: AdminPaymentQuery,
): Promise<AdminPaymentPage> {
  const offset = offsetOf(query);
  const [rows, total] = await Promise.all([
    findAdminPayments(db, query.pageSize, offset),
    countAdminPayments(db),
  ]);

  return {
    items: rows.map((row) => ({
      bookingId: row.id,
      status: row.status,
      totalAmountCents: row.totalAmountCents,
      platformFeeCents: row.platformFeeCents,
      vendorPayoutCents: row.vendorPayoutCents,
      stripePaymentIntentId: row.stripePaymentIntentId,
      vendorName: row.vendorName,
      customerName: fullName(row.customerFirstName, row.customerLastName),
      paidAt: row.paidAt,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function listReviews(
  db: AppDatabase,
  query: AdminReviewQuery,
): Promise<AdminReviewPage> {
  const offset = offsetOf(query);
  const [rows, total] = await Promise.all([
    findAdminReviews(db, query.type, query.pageSize, offset),
    countAdminReviews(db, query.type),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      title: row.title,
      content: row.content,
      type: row.type,
      authorName: fullName(row.authorFirstName, row.authorLastName),
      vendorName: row.vendorName,
      vendorSlug: row.vendorSlug,
      createdAt: row.createdAt,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Deletes a review and re-derives the rating it contributed to.
 *
 * `deleteReviewAndRecalculate` is the reviews module's own write — reached from
 * here rather than reimplemented, because a second recompute is how the two come
 * to disagree. Deleting the last review leaves `0 / 0`, not `NULL`.
 */
export async function deleteReview(db: AppDatabase, reviewId: string): Promise<void> {
  const deleted = await deleteReviewAndRecalculate(db, reviewId);

  if (!deleted) {
    throw notFound('No review with that id');
  }
}

// --- Tag moderation --------------------------------------------------------

function toSuggestionRow(row: AdminTagSuggestionProjection): AdminTagSuggestionRow {
  return {
    id: row.id,
    vendorId: row.vendorId,
    suggestedName: row.suggestedName,
    category: row.category,
    status: row.status,
    resolvedTagId: row.resolvedTagId,
    adminNote: row.adminNote,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    /*
     * The storefront name where there is one, the account name otherwise: a
     * suggestion can come from a vendor who has not built a profile yet, and
     * "· suggested by" with nothing after it is worse than the account name.
     */
    vendorName: row.vendorBusinessName ?? fullName(row.vendorFirstName, row.vendorLastName),
    resolvedTagName: row.resolvedTagName,
  };
}

export async function listTagSuggestions(
  db: AppDatabase,
  query: AdminTagSuggestionQuery,
): Promise<AdminTagSuggestionPage> {
  const offset = offsetOf(query);
  const [rows, total] = await Promise.all([
    findAdminTagSuggestions(db, query.status, query.pageSize, offset),
    countAdminTagSuggestions(db, query.status),
  ]);

  return {
    items: rows.map(toSuggestionRow),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * The tag vocabulary is category-scoped, so the slug is too — `tags_slug_key` is
 * global and "Korean" is legitimately both a language and a culture.
 */
function tagSlug(category: TagCategory, name: string): string {
  return `${category}-${generateSlug(name)}`;
}

async function notifyVendorOfTag(
  context: AdminContext,
  userId: string,
  title: string,
  body: string,
): Promise<void> {
  const stored = await insertNotification(context.db, {
    userId,
    type: 'tag_suggestion_approved',
    title,
    body,
    data: {},
  });

  if (stored) {
    context.hub.publish(userId, {
      type: 'new_notification',
      notification: {
        id: stored.id,
        type: stored.type,
        title: stored.title,
        body: stored.body,
        href: '/vendor/profile/edit',
        isRead: false,
        createdAt: stored.createdAt,
      },
    });
  }
}

/**
 * Approve, reject or merge one suggestion.
 *
 * **Concurrency is settled by the write, not by the read.** The `status =
 * 'pending'` predicate lives on the UPDATE in `resolveTagSuggestionRow`, so two
 * operators acting on the same suggestion cannot both succeed however the reads
 * interleave — the second gets a 409 rather than overwriting the first's
 * decision. Checking the status here first only makes that failure legible; it
 * is not what makes it correct.
 */
export async function resolveTagSuggestion(
  context: AdminContext,
  suggestionId: string,
  input: ResolveTagSuggestion,
  now: Date,
): Promise<AdminTagSuggestionResult> {
  const suggestion = await findTagSuggestionById(context.db, suggestionId);

  if (!suggestion) {
    throw notFound('No tag suggestion with that id');
  }

  if (suggestion.status !== 'pending') {
    throw conflict('That suggestion has already been resolved');
  }

  const suggesterProfileId = await findVendorProfileIdByUserId(context.db, suggestion.vendorId);

  if (input.action === 'reject') {
    const resolved = await resolveTagSuggestionRow(context.db, {
      suggestionId,
      status: 'rejected',
      resolvedTagId: null,
      adminNote: input.adminNote,
      resolvedAt: now,
    });

    if (!resolved) {
      throw conflict('That suggestion has already been resolved');
    }

    /*
     * No notification, by design. The queue records why; telling a vendor their
     * idea was turned down is how a product stops receiving suggestions.
     */
    return { suggestion: await readResolved(context.db, suggestionId), tag: null };
  }

  if (input.action === 'merge') {
    const target = await findTagById(context.db, input.mergeTagId);

    if (!target) {
      throw notFound('No tag with that id');
    }

    if (target.category !== suggestion.category) {
      /*
       * A merge across categories would file "Kosher" under languages. The
       * vocabulary is category-scoped and so is every reader of it.
       */
      throw validationFailed('That tag is in a different category', {
        field: 'mergeTagId',
      } satisfies FieldErrorDetails);
    }

    const resolved = await resolveTagSuggestionRow(context.db, {
      suggestionId,
      status: 'approved',
      resolvedTagId: target.id,
      adminNote: input.adminNote ?? `Merged with ${target.name}`,
      resolvedAt: now,
    });

    if (!resolved) {
      throw conflict('That suggestion has already been resolved');
    }

    if (suggesterProfileId) {
      await assignTagToVendor(context.db, suggesterProfileId, target.id);
    }

    await notifyVendorOfTag(
      context,
      suggestion.vendorId,
      'Your tag suggestion matched an existing tag',
      `“${suggestion.suggestedName}” matched our existing tag “${target.name}” — it has been added to your profile.`,
    );

    return { suggestion: await readResolved(context.db, suggestionId), tag: target };
  }

  const normalized = normalizeTagName(suggestion.suggestedName);
  /*
   * Name match first, then slug. The ticket lists them the other way round, but
   * the slug is *derived from* the name — so checking it first would reject
   * every exact duplicate that step 3 says to merge, and step 3 would be
   * unreachable. Same-name is therefore treated as the merge it is; a slug
   * collision that survives this check is a *different* name that slugifies the
   * same ("Gluten Free" vs "gluten-free"), which is the case the operator has to
   * rule on rather than the machine.
   */
  const sameName = await findTagByCategoryAndName(context.db, suggestion.category, normalized);

  if (sameName) {
    return resolveTagSuggestion(
      context,
      suggestionId,
      { action: 'merge', mergeTagId: sameName.id },
      now,
    );
  }

  const slug = tagSlug(suggestion.category, suggestion.suggestedName);
  const slugTaken = await findTagBySlug(context.db, slug);

  if (slugTaken) {
    throw conflict(`A similar tag already exists: ${slugTaken.name}. Merge into it instead.`);
  }

  const created = await context.db.transaction(async (tx) => {
    const tag = await insertTag(tx, {
      name: suggestion.suggestedName,
      slug,
      category: suggestion.category,
    });

    const resolved = await resolveTagSuggestionRow(tx, {
      suggestionId,
      status: 'approved',
      resolvedTagId: tag.id,
      adminNote: input.adminNote ?? null,
      resolvedAt: now,
    });

    if (!resolved) {
      /*
       * Another operator resolved it between the read and this write. Throwing
       * inside the transaction rolls the new tag back, which is the point: a
       * tag created for a decision that did not happen is orphaned vocabulary.
       */
      throw conflict('That suggestion has already been resolved');
    }

    if (suggesterProfileId) {
      await assignTagToVendor(tx, suggesterProfileId, tag.id);
    }

    return tag;
  });

  await notifyVendorOfTag(
    context,
    suggestion.vendorId,
    'Your tag suggestion was approved',
    `“${created.name}” is now available, and has been added to your profile.`,
  );

  return { suggestion: await readResolved(context.db, suggestionId), tag: created };
}

/** Re-reads the suggestion through the list projection, so the response and the queue agree. */
async function readResolved(db: AppDatabase, suggestionId: string): Promise<AdminTagSuggestionRow> {
  const row = await findAdminTagSuggestionById(db, suggestionId);

  if (!row) {
    throw notFound('No tag suggestion with that id');
  }

  return toSuggestionRow(row);
}

export async function listTags(db: AppDatabase): Promise<AdminTagList> {
  const rows = await findAdminTags(db);

  return { items: rows };
}

/**
 * Renames, reorders or deactivates one tag.
 *
 * A rename regenerates the slug, because the slug is the dedup key every
 * approval checks against — leaving it on the old name would let the same tag be
 * suggested and approved twice. Deactivation is a soft remove: `vendor_tags`
 * rows survive, so a vendor keeps what they chose while the tag stops being
 * offered and stops filtering search.
 */
export async function updateTag(
  db: AppDatabase,
  tagId: string,
  input: UpdateTag,
): Promise<AdminTagRow> {
  const existing = await findTagById(db, tagId);

  if (!existing) {
    throw notFound('No tag with that id');
  }

  const patch: { name?: string; slug?: string; isActive?: boolean; displayOrder?: number } = {};

  if (
    input.name !== undefined &&
    normalizeTagName(input.name) !== normalizeTagName(existing.name)
  ) {
    const clash = await findTagByCategoryAndName(
      db,
      existing.category,
      normalizeTagName(input.name),
    );

    if (clash) {
      throw conflict(`A tag called ${clash.name} already exists in that category`);
    }

    const slug = tagSlug(existing.category, input.name);
    const slugClash = await findTagBySlug(db, slug);

    if (slugClash && slugClash.id !== tagId) {
      throw conflict(`A similar tag already exists: ${slugClash.name}`);
    }

    patch.name = input.name;
    patch.slug = slug;
  }

  if (input.isActive !== undefined) {
    patch.isActive = input.isActive;
  }

  if (input.displayOrder !== undefined) {
    patch.displayOrder = input.displayOrder;
  }

  if (Object.keys(patch).length === 0) {
    return { ...existing, vendorCount: await countVendorsHoldingTag(db, tagId) };
  }

  const updated = await updateTagRow(db, tagId, patch);

  if (!updated) {
    throw notFound('No tag with that id');
  }

  return { ...updated, vendorCount: await countVendorsHoldingTag(db, tagId) };
}

// --- Overview --------------------------------------------------------------

/** The window every chart on the Overview draws, in days. */
export const ADMIN_METRICS_WINDOW_DAYS = 30;

/**
 * Turns the sparse buckets Postgres returns into a continuous series.
 *
 * A day with no bookings has no row, and a line chart fed a gap draws a
 * straight segment across it as though the value had been interpolated. Every
 * day in the window is present, and a quiet day reads as the zero it was.
 */
function fillWindow(buckets: DailyBucket[], since: Date, days: number): DailyBucket[] {
  const byDate = new Map(buckets.map((bucket) => [bucket.date, bucket.value]));
  const series: DailyBucket[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = toDateString(addDays(since, offset));
    series.push({ date, value: byDate.get(date) ?? 0 });
  }

  return series;
}

export async function readMetrics(db: AppDatabase, now: Date): Promise<AdminMetrics> {
  /*
   * Midnight UTC `days - 1` back, so the window is thirty whole days ending
   * today rather than a rolling thirty-times-24-hours whose first bucket is
   * always a partial day.
   */
  const since = addDays(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    -(ADMIN_METRICS_WINDOW_DAYS - 1),
  );

  const [totals, series] = await Promise.all([
    findAdminMetricTotals(db),
    findAdminMetricSeries(db, since),
  ]);

  return {
    totalRevenueCents: totals.totalRevenueCents,
    bookingsCount: totals.bookingsCount,
    activeVendorsCount: totals.activeVendorsCount,
    usersCount: totals.usersCount,
    pendingTagSuggestionsCount: totals.pendingTagSuggestionsCount,
    reviewsCount: totals.reviewsCount,
    revenueByDay: fillWindow(series.revenueByDay, since, ADMIN_METRICS_WINDOW_DAYS),
    bookingsByDay: fillWindow(series.bookingsByDay, since, ADMIN_METRICS_WINDOW_DAYS),
    signupsByDay: fillWindow(series.signupsByDay, since, ADMIN_METRICS_WINDOW_DAYS),
    completedByDay: fillWindow(series.completedByDay, since, ADMIN_METRICS_WINDOW_DAYS),
  };
}

export async function readVendorFacets(db: AppDatabase): Promise<AdminVendorFacets> {
  return findVendorFilterFacets(db);
}
