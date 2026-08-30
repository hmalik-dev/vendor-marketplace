import { toDateString } from '@vendor-marketplace/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  bookingRequests,
  categories,
  servicePackages,
  users,
  vendorCategories,
  vendorProfiles,
} from './schema/index.js';

/**
 * Any Drizzle Postgres database — the pooled `postgres-js` client the script
 * uses, or the in-process PGlite driver the suite runs against.
 */
type AnyPgDatabase<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> = PgDatabase<TQueryResult, TFullSchema, TSchema>;

/**
 * The storefront the end-to-end vendor account owns.
 *
 * Its own slug, deliberately not one of the marketing vendors': adopting a
 * marketing row would re-point that row's `user_id` and quietly change what
 * every other browser pass sees, which is how one lane's fixture becomes
 * another lane's mystery failure. This vendor is additive and disposable.
 */
export const E2E_VENDOR_SLUG = 'e2e-test-studio';

/** The category the fixture vendor is filed under, so search can find them. */
const E2E_CATEGORY_SLUG = 'photography';

/** How far ahead the seeded booking request's event sits. */
const EVENT_DAYS_AHEAD = 45;

export interface E2eAccount {
  /**
   * The account's **real** Clerk id.
   *
   * Not optional and not inventable. `insertUserIfAbsent` absorbs a conflict on
   * `clerk_user_id` and nothing else, so a `users` row carrying the end-to-end
   * email under a made-up id makes the account's first real sign-in collide on
   * the email index instead — the insert throws, the lazy sync returns null,
   * and the account can no longer sign in at all. The fixture is therefore only
   * ever allowed to attach to the identity Clerk actually has.
   */
  clerkUserId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface E2eSeedInput {
  vendor: E2eAccount;
  customer: E2eAccount;
  /**
   * Whether the fixture vendor is marked as able to take payment.
   *
   * `true` by default, because the gate it clears — `accept` answering 402
   * until Stripe reports both capabilities — is a Stripe round trip no
   * unattended run can complete. Set it `false` to drive the gate itself.
   */
  payoutsReady?: boolean;
  /** "Today", so the seeded event date is deterministic under test. */
  now?: Date;
}

export interface E2eSeedResult {
  vendorUserId: string;
  customerUserId: string;
  vendorProfileId: string;
  packageId: string;
  bookingRequestId: string;
}

/**
 * Attaches the end-to-end accounts to a storefront they can actually reach.
 *
 * Signing in creates a `users` row and nothing else — `vendor_profiles` is only
 * ever written by `POST /vendor/profile` — so the vendor account lands on an
 * empty profile form and every `/vendor` route redirects there. That blocks the
 * `browser-verifier` gate on every vendor-side ticket, which is the whole
 * reason this exists.
 *
 * Idempotent: re-running adopts its own rows rather than duplicating them, so
 * it is safe to call from `lane:up` on every lane.
 */
export async function seedE2eFixtures<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(
  db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>,
  input: E2eSeedInput,
): Promise<E2eSeedResult> {
  const now = input.now ?? new Date();
  const payoutsReady = input.payoutsReady ?? true;

  const vendorUserId = await upsertAccount(db, input.vendor, 'vendor');
  const customerUserId = await upsertAccount(db, input.customer, 'customer');

  const [profile] = await db
    .insert(vendorProfiles)
    .values({
      userId: vendorUserId,
      businessName: 'E2E Test Studio',
      slug: E2E_VENDOR_SLUG,
      bio: 'The storefront the end-to-end vendor account signs in to. Seeded, not real.',
      tagline: 'A fixture, not a business',
      yearsInBusiness: 4,
      city: 'Austin',
      state: 'TX',
      responseTimeHours: 4,
      isPublished: true,
      isDeleted: false,
      stripeOnboarded: payoutsReady,
    })
    .onConflictDoUpdate({
      target: vendorProfiles.slug,
      set: {
        // Ownership follows the fixture: a previous run under a different
        // Clerk identity must not strand this profile on a stale user.
        userId: sql`excluded.user_id`,
        isPublished: sql`excluded.is_published`,
        isDeleted: sql`excluded.is_deleted`,
        stripeOnboarded: sql`excluded.stripe_onboarded`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: vendorProfiles.id });

  if (!profile) {
    throw new Error('seedE2eFixtures: could not upsert the end-to-end vendor profile');
  }

  await attachCategory(db, profile.id);
  const packageId = await upsertPackage(db, profile.id);
  const bookingRequestId = await upsertBookingRequest(db, {
    vendorProfileId: profile.id,
    customerUserId,
    packageId,
    now,
  });

  return {
    vendorUserId,
    customerUserId,
    vendorProfileId: profile.id,
    packageId,
    bookingRequestId,
  };
}

/**
 * Ensures the local row for a Clerk identity, and that it holds the role the
 * fixture needs.
 *
 * The role is forced rather than left alone: it comes from Clerk's
 * `unsafeMetadata` at first sign-in and falls back to `customer` for anything
 * unrecognised, so an end-to-end vendor account that signed up without the
 * hint has a `customer` row and is refused by every vendor guard.
 */
async function upsertAccount<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(
  db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>,
  account: E2eAccount,
  role: 'vendor' | 'customer',
): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({
      clerkUserId: account.clerkUserId,
      email: account.email,
      role,
      firstName: account.firstName,
      lastName: account.lastName,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        email: sql`excluded.email`,
        role: sql`excluded.role`,
        firstName: sql`excluded.first_name`,
        lastName: sql`excluded.last_name`,
        deletedAt: sql`null`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: users.id });

  if (!row) {
    throw new Error(`seedE2eFixtures: could not upsert the ${role} account`);
  }

  return row.id;
}

/** Files the fixture vendor under one category, so search can return them. */
async function attachCategory<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>, vendorId: string): Promise<void> {
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, E2E_CATEGORY_SLUG))
    .limit(1);

  if (!category) {
    throw new Error(
      `seedE2eFixtures: category "${E2E_CATEGORY_SLUG}" is missing — run \`pnpm db:seed\` first`,
    );
  }

  await db
    .insert(vendorCategories)
    .values({ vendorId, categoryId: category.id })
    .onConflictDoNothing();
}

/** One bookable package, which is what makes the vendor publishable. */
async function upsertPackage<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>, vendorId: string): Promise<string> {
  const name = 'Full day coverage';

  const [existing] = await db
    .select({ id: servicePackages.id })
    .from(servicePackages)
    .where(and(eq(servicePackages.vendorId, vendorId), eq(servicePackages.name, name)))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const [created] = await db
    .insert(servicePackages)
    .values({
      vendorId,
      name,
      description: 'Eight hours of coverage, edited gallery delivered in three weeks.',
      priceCents: 145_000,
    })
    .returning({ id: servicePackages.id });

  if (!created) {
    throw new Error('seedE2eFixtures: could not create the end-to-end package');
  }

  return created.id;
}

/**
 * One pending request from the end-to-end customer to the end-to-end vendor.
 *
 * Without it the vendor dashboard renders its empty state, and the flows that
 * matter most on the vendor side — accept, decline, quote — have nothing to act
 * on. Dated from `now` so it never drifts into the past.
 */
async function upsertBookingRequest<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(
  db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>,
  input: { vendorProfileId: string; customerUserId: string; packageId: string; now: Date },
): Promise<string> {
  const [existing] = await db
    .select({ id: bookingRequests.id })
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.vendorId, input.vendorProfileId),
        eq(bookingRequests.customerId, input.customerUserId),
        eq(bookingRequests.status, 'pending'),
      ),
    )
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const eventDate = new Date(input.now);
  eventDate.setDate(eventDate.getDate() + EVENT_DAYS_AHEAD);

  const [created] = await db
    .insert(bookingRequests)
    .values({
      customerId: input.customerUserId,
      vendorId: input.vendorProfileId,
      packageId: input.packageId,
      eventDate: toDateString(eventDate),
      eventLocation: 'Barr Mansion, Austin TX',
      eventType: 'Wedding',
      guestCount: 120,
      customDetails: 'Seeded request, so the vendor dashboard has something to act on.',
      status: 'pending',
    })
    .returning({ id: bookingRequests.id });

  if (!created) {
    throw new Error('seedE2eFixtures: could not create the end-to-end booking request');
  }

  return created.id;
}
