import { eq } from 'drizzle-orm';
import {
  conversations,
  portfolioItems,
  reviews,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import type { ReportSubject } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/**
 * The subject of a report, resolved from `(subject_type, subject_id)` to the
 * row it names (#436).
 *
 * **This read is acceptance 2 and it is also the authorisation.** A report
 * whose subject does not resolve is a case an operator opens onto nothing, and
 * an id is a thing anybody can type — so the pair is looked up before a row is
 * written, and the vendor it ultimately concerns is read from the database
 * rather than from the reporter's payload. The same rule `supportMessageSchema`
 * states about a booking's figures: a queue that quoted the reporter's own
 * words about *who* would be a queue reading whatever the reporter chose.
 */
export interface ReportSubjectProjection {
  /** The vendor this report ultimately concerns, for the operator's context. */
  vendorBusinessName: string;
  vendorSlug: string;
  /**
   * The accounts allowed to report this subject, or **empty for a subject
   * anybody signed in can see**.
   *
   * A storefront, its reviews and its photos are published to the world, so
   * restricting who may report one would only stop the passer-by who noticed.
   * A conversation is the opposite: it is private to its two parties, and a
   * report is the one way somebody outside it could learn a thread id resolves
   * to a real thread. So the list is populated for exactly that subject.
   */
  restrictedTo: readonly string[];
}

/**
 * Reads the subject, whichever of the four it is.
 *
 * One function rather than four exported ones because every caller has a
 * `subjectType` in hand and would otherwise write the same switch: the branch
 * belongs beside the queries it chooses between, where a fifth subject is one
 * arm and not a fifth call site to find.
 */
export async function findReportSubject(
  db: AppDatabase,
  subjectType: ReportSubject,
  subjectId: string,
): Promise<ReportSubjectProjection | null> {
  switch (subjectType) {
    case 'vendor_profile':
      return vendorProfileSubject(db, subjectId);
    case 'review':
      return reviewSubject(db, subjectId);
    case 'portfolio_item':
      return portfolioSubject(db, subjectId);
    case 'conversation':
      return conversationSubject(db, subjectId);
  }
}

/** A storefront, by its own id. */
async function vendorProfileSubject(
  db: AppDatabase,
  vendorProfileId: string,
): Promise<ReportSubjectProjection | null> {
  const rows = await db
    .select({ businessName: vendorProfiles.businessName, slug: vendorProfiles.slug })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.id, vendorProfileId))
    .limit(1);

  return publicSubjectOf(rows[0]);
}

/** The three published subjects answer the same shape; this is that shape. */
function publicSubjectOf(
  row: { businessName: string; slug: string } | undefined,
): ReportSubjectProjection | null {
  return row
    ? { vendorBusinessName: row.businessName, vendorSlug: row.slug, restrictedTo: [] }
    : null;
}

/** A review, joined to the storefront it was left on. */
async function reviewSubject(
  db: AppDatabase,
  reviewId: string,
): Promise<ReportSubjectProjection | null> {
  const rows = await db
    .select({ businessName: vendorProfiles.businessName, slug: vendorProfiles.slug })
    .from(reviews)
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, reviews.vendorId))
    .where(eq(reviews.id, reviewId))
    .limit(1);

  return publicSubjectOf(rows[0]);
}

/** A portfolio photo, joined to the storefront that publishes it. */
async function portfolioSubject(
  db: AppDatabase,
  itemId: string,
): Promise<ReportSubjectProjection | null> {
  const rows = await db
    .select({ businessName: vendorProfiles.businessName, slug: vendorProfiles.slug })
    .from(portfolioItems)
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, portfolioItems.vendorId))
    .where(eq(portfolioItems.id, itemId))
    .limit(1);

  return publicSubjectOf(rows[0]);
}

/**
 * A thread, and **both of its parties**.
 *
 * The vendor's *user* id rather than their profile id: `restrictedTo` is
 * compared against `users.id`, and a conversation stores the profile. Reading
 * the wrong one of those would refuse every vendor reporting their own thread
 * while silently comparing two id spaces that never collide.
 */
async function conversationSubject(
  db: AppDatabase,
  conversationId: string,
): Promise<ReportSubjectProjection | null> {
  const rows = await db
    .select({
      businessName: vendorProfiles.businessName,
      slug: vendorProfiles.slug,
      customerId: conversations.customerId,
      vendorUserId: vendorProfiles.userId,
    })
    .from(conversations)
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, conversations.vendorId))
    .where(eq(conversations.id, conversationId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    vendorBusinessName: row.businessName,
    vendorSlug: row.slug,
    restrictedTo: [row.customerId, row.vendorUserId],
  };
}

/**
 * The two names on a thread, for the console's read of it (#436).
 *
 * Lives here rather than in `messaging.dao.ts` because the participant-facing
 * reads there answer "may this caller see this", and this one answers "who is
 * this operator looking at" — a different question with a different guard in
 * front of it. `findMessages` and `countMessages` are shared with those reads;
 * the parties are not, because a participant already knows who they are talking
 * to and an operator does not.
 */
export interface ConversationPartiesProjection {
  customerId: string;
  customerFirstName: string;
  customerLastName: string;
  vendorUserId: string;
  vendorBusinessName: string;
}

export async function findConversationParties(
  db: AppDatabase,
  conversationId: string,
): Promise<ConversationPartiesProjection | null> {
  const rows = await db
    .select({
      customerId: conversations.customerId,
      customerFirstName: users.firstName,
      customerLastName: users.lastName,
      vendorUserId: vendorProfiles.userId,
      vendorBusinessName: vendorProfiles.businessName,
    })
    .from(conversations)
    .innerJoin(users, eq(users.id, conversations.customerId))
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, conversations.vendorId))
    .where(eq(conversations.id, conversationId))
    .limit(1);

  return rows[0] ?? null;
}
