import { BOOKING_REQUEST_EXPIRY_DAYS, toDateString } from '@vendor-marketplace/shared';
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  availability,
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

/** The transaction handle every write below runs on. */
type Tx = Parameters<
  Parameters<
    AnyPgDatabase<PgQueryResultHKT, Record<string, unknown>, TablesRelationalConfig>['transaction']
  >[0]
>[0];

/**
 * The storefront the end-to-end vendor account owns, when the fixture creates
 * one itself.
 *
 * Its own slug, deliberately not one of the marketing vendors': adopting a
 * marketing row would re-point that row's `user_id` and quietly change what
 * every other browser pass sees. If the account already owns a profile under
 * some other slug the fixture adopts *that* one instead — see `ensureProfile`.
 */
export const E2E_VENDOR_SLUG = 'e2e-test-studio';

/** The category the fixture vendor is filed under, so search can find them. */
const E2E_CATEGORY_SLUG = 'photography';

/** How far ahead the seeded request's event sits, before avoiding clashes. */
const EVENT_DAYS_AHEAD = 45;

/** How far past that the fixture will look for a date the vendor has not booked. */
const EVENT_SEARCH_DAYS = 60;

/**
 * The statuses that make a request *live*.
 *
 * This is the set `booking_requests_live_package_key` is partial on, and it has
 * to be matched exactly: probing for `pending` alone finds nothing once a
 * browser pass has sent a quote, so the fixture inserts and dies on that index.
 */
const LIVE_REQUEST_STATUSES = ['pending', 'quoted'] as const;

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
   * The operations account, and the only way `/admin` is reachable at all.
   *
   * Optional so an existing `.env.e2e.local` without `E2E_ADMIN_EMAIL` still
   * seeds, rather than every lane breaking on a file it cannot edit for itself.
   *
   * It exists because `role = 'admin'` cannot be reached from inside the
   * product: the role is read from Clerk's `unsafeMetadata` at first sign-in,
   * falls back to `customer`, and is immutable afterwards — so no sign-up flow
   * produces an admin, and `seed-demo.ts` gives its admin a synthetic
   * `clerk_user_id` that cannot authenticate. Before this, the only route to
   * frame `13`'s screens was promoting a customer in the database by hand,
   * which is a privileged write nobody should be making to run a test.
   */
  admin?: E2eAccount;
  /**
   * Whether the fixture vendor is marked as able to take payment.
   *
   * `true` by default, because the gate it clears — `accept` answering 402
   * until Stripe reports both capabilities — is a Stripe round trip no
   * unattended run can complete. Set it `false` to drive the gate itself.
   */
  payoutsReady?: boolean;
  /**
   * Which storefront state the fixture vendor is left in.
   *
   * `published` by default — the state every other vendor ticket needs, and the
   * one `pnpm preflight` asserts the account can reach.
   *
   * `draft` is the state frame `27 Vendor dashboard - empty . 1024` draws, and
   * the **only** way to reach it: all 17 seeded profiles are published and this
   * is the one account with a sign-in path, so the empty dashboard is otherwise
   * unrenderable and a parity pass over it proves nothing. It unpublishes the
   * profile and clears the account's live requests, which is what makes the
   * screen's two halves -- the gold blocker banner and "No requests yet" --
   * appear together rather than one at a time.
   *
   * It is deliberately not a separate script: re-running the default restores
   * the published fixture, so a pass that leaves the lane in `draft` is undone
   * by the same command every other ticket already runs.
   */
  storefront?: 'published' | 'draft';
  /** "Today", so the seeded event date is deterministic under test. */
  now?: Date;
}

export interface E2eSeedResult {
  vendorUserId: string;
  customerUserId: string;
  /** Absent when `.env.e2e.local` supplies no admin account. */
  adminUserId?: string;
  vendorProfileId: string;
  /** `null` under `storefront: 'draft'`, which seeds no package. */
  packageId: string | null;
  /** `null` under `storefront: 'draft'`, which seeds no request. */
  bookingRequestId: string | null;
  /** The date the request landed on, which is not always `now + 45`. */
  eventDate: string | null;
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
 * **One transaction**, per `.claude/rules/db-schema.md`, and not as ceremony: a
 * half-applied run is worse than a failed one here, because it grants the vendor
 * role and then leaves no fixture — a state that reads as healthy to anything
 * checking the role alone.
 *
 * Idempotent against every state a browser pass can leave behind, not only a
 * pristine one: a profile the account already owns is adopted, and a request
 * that has moved from `pending` to `quoted` is reused rather than duplicated.
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
  const draft = (input.storefront ?? 'published') === 'draft';

  return db.transaction(async (tx) => {
    const vendorUserId = await upsertAccount(tx, input.vendor, 'vendor');
    const customerUserId = await upsertAccount(tx, input.customer, 'customer');
    /*
     * The admin needs no fixture beyond the row — `/admin` reads the whole
     * platform, so it has nothing of its own to own. The role is the entire
     * deliverable, which is exactly why it belongs in the same transaction as
     * the other two: a half-applied run that granted a role and seeded no
     * fixture is the failure mode this transaction exists to prevent.
     */
    const adminUserId = input.admin ? await upsertAccount(tx, input.admin, 'admin') : undefined;

    const vendorProfileId = await ensureProfile(tx, vendorUserId, payoutsReady, draft);
    await attachCategory(tx, vendorProfileId);

    if (draft) {
      /*
       * Cleared rather than skipped. The account is long-lived and a previous
       * pass will have left a live request on it, so seeding a draft without
       * this produces the one state the frame never draws: a storefront that is
       * not live with requests waiting on it.
       */
      await clearLiveRequests(tx, vendorProfileId);

      return {
        vendorUserId,
        customerUserId,
        vendorProfileId,
        packageId: null,
        bookingRequestId: null,
        eventDate: null,
      };
    }

    const servicePackage = await ensurePackage(tx, vendorProfileId);
    const request = await ensureBookingRequest(tx, {
      vendorProfileId,
      customerUserId,
      servicePackage,
      now,
    });

    return {
      vendorUserId,
      customerUserId,
      ...(adminUserId === undefined ? {} : { adminUserId }),
      vendorProfileId,
      packageId: servicePackage.id,
      bookingRequestId: request.id,
      eventDate: request.eventDate,
    };
  });
}

/**
 * Ensures the local row for a Clerk identity, and that it holds the role the
 * fixture needs.
 *
 * The role is forced rather than left alone: it comes from Clerk's
 * `unsafeMetadata` at first sign-in, falls back to `customer` for anything
 * unrecognised, and is immutable afterwards — so an end-to-end vendor account
 * that signed up without the hint has a `customer` row that nothing in the
 * application can correct, and every vendor guard refuses it.
 */
async function upsertAccount(
  tx: Tx,
  account: E2eAccount,
  role: 'vendor' | 'customer' | 'admin',
): Promise<string> {
  const [row] = await tx
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

/**
 * The storefront, adopting whatever the account already owns.
 *
 * `vendor_profiles` carries **two** unique indexes — `slug` and `user_id` — and
 * an upsert can only name one of them. Inserting with a conflict target of
 * `slug` therefore dies on `vendor_profiles_user_id_key` the moment the account
 * owns a profile under any other slug, which is exactly what a browser pass
 * exercising `POST /vendor/profile` leaves behind. So the owned row is looked up
 * first and updated in place, keeping its slug; only an account with no profile
 * at all reaches the insert.
 */
async function ensureProfile(
  tx: Tx,
  vendorUserId: string,
  payoutsReady: boolean,
  draft: boolean,
): Promise<string> {
  const [owned] = await tx
    .select({ id: vendorProfiles.id })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.userId, vendorUserId))
    .limit(1);

  if (owned) {
    const [adopted] = await tx
      .update(vendorProfiles)
      .set({
        isPublished: !draft,
        isDeleted: false,
        stripeOnboarded: payoutsReady,
        updatedAt: sql`now()`,
      })
      .where(eq(vendorProfiles.id, owned.id))
      .returning({ id: vendorProfiles.id });

    if (!adopted) {
      throw new Error('seedE2eFixtures: could not adopt the profile the vendor already owns');
    }

    return adopted.id;
  }

  const [created] = await tx
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
      isPublished: !draft,
      isDeleted: false,
      stripeOnboarded: payoutsReady,
    })
    .onConflictDoUpdate({
      target: vendorProfiles.slug,
      set: {
        // Safe: this branch only runs for an account that owns no profile, so
        // re-pointing a stale fixture row cannot collide on `user_id`.
        userId: sql`excluded.user_id`,
        isPublished: sql`excluded.is_published`,
        isDeleted: sql`excluded.is_deleted`,
        stripeOnboarded: sql`excluded.stripe_onboarded`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: vendorProfiles.id });

  if (!created) {
    throw new Error('seedE2eFixtures: could not create the end-to-end vendor profile');
  }

  return created.id;
}

/**
 * Removes the live requests on the fixture vendor, for the draft storefront.
 *
 * A delete rather than a status change: `declined` and `cancelled` requests
 * still render in the vendor's Requests list, and frame
 * `27 Vendor dashboard - empty . 1024` draws `Requests 0` in the sidebar beside
 * an empty pane. Only the fixture pair's own rows are touched, and only in a
 * database `assertSafeTarget` has already cleared.
 */
async function clearLiveRequests(tx: Tx, vendorProfileId: string): Promise<void> {
  await tx.delete(bookingRequests).where(eq(bookingRequests.vendorId, vendorProfileId));
}

/** Files the fixture vendor under one category, so search can return them. */
async function attachCategory(tx: Tx, vendorId: string): Promise<void> {
  const [category] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, E2E_CATEGORY_SLUG))
    .limit(1);

  if (!category) {
    throw new Error(
      `seedE2eFixtures: category "${E2E_CATEGORY_SLUG}" is missing — run \`pnpm db:seed\` first`,
    );
  }

  await tx
    .insert(vendorCategories)
    .values({ vendorId, categoryId: category.id })
    .onConflictDoNothing();
}

interface SeededPackage {
  id: string;
  priceCents: number;
}

/** One bookable package, which is what makes the vendor publishable. */
async function ensurePackage(tx: Tx, vendorId: string): Promise<SeededPackage> {
  const name = 'Full day coverage';

  const [existing] = await tx
    .select({ id: servicePackages.id, priceCents: servicePackages.priceCents })
    .from(servicePackages)
    .where(and(eq(servicePackages.vendorId, vendorId), eq(servicePackages.name, name)))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await tx
    .insert(servicePackages)
    .values({
      vendorId,
      name,
      description: 'Eight hours of coverage, edited gallery delivered in three weeks.',
      priceCents: 145_000,
    })
    .returning({ id: servicePackages.id, priceCents: servicePackages.priceCents });

  if (!created) {
    throw new Error('seedE2eFixtures: could not create the end-to-end package');
  }

  return created;
}

/**
 * The first date at or after `from` that this vendor has not already booked.
 *
 * A re-seed after a browser pass has *accepted* the last request would
 * otherwise land on a date the accept marked `booked`, and the new request
 * could never be accepted in turn — `prepareTransition` answers 409. The
 * fixture has to survive its own previous run, so it steps past the clash.
 */
async function firstFreeDate(tx: Tx, vendorId: string, from: Date): Promise<string> {
  const last = new Date(from);
  last.setDate(last.getDate() + EVENT_SEARCH_DAYS);

  const taken = await tx
    .select({ date: availability.date })
    .from(availability)
    .where(
      and(
        eq(availability.vendorId, vendorId),
        eq(availability.status, 'booked'),
        gte(availability.date, toDateString(from)),
        lte(availability.date, toDateString(last)),
      ),
    );

  const booked = new Set(taken.map((row) => row.date));

  for (let offset = 0; offset <= EVENT_SEARCH_DAYS; offset += 1) {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + offset);
    const asString = toDateString(candidate);

    if (!booked.has(asString)) {
      return asString;
    }
  }

  throw new Error(
    `seedE2eFixtures: the vendor has every date booked for ${EVENT_SEARCH_DAYS} days — ` +
      'clear their availability before re-seeding',
  );
}

/**
 * One live request from the end-to-end customer to the end-to-end vendor.
 *
 * Without it the vendor dashboard renders its empty state, and the flows that
 * matter most — accept, decline, quote — have nothing to act on.
 *
 * The row is shaped the way `createBookingRequest` shapes one, not merely the
 * way the columns allow. A request with no `finalPriceCents` renders as
 * "quote needed" rather than a price, never expires because `ageIfExpired`
 * returns early on a null `expiresAt`, and can be quoted against — which the
 * service forbids for a package request. A fixture producing a row the
 * application itself could never create makes every pass that measures it
 * measure a state real data never reaches.
 */
async function ensureBookingRequest(
  tx: Tx,
  input: {
    vendorProfileId: string;
    customerUserId: string;
    servicePackage: SeededPackage;
    now: Date;
  },
): Promise<{ id: string; eventDate: string }> {
  const [existing] = await tx
    .select({
      id: bookingRequests.id,
      eventDate: bookingRequests.eventDate,
      packageId: bookingRequests.packageId,
      finalPriceCents: bookingRequests.finalPriceCents,
      expiresAt: bookingRequests.expiresAt,
    })
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.vendorId, input.vendorProfileId),
        eq(bookingRequests.customerId, input.customerUserId),
        inArray(bookingRequests.status, [...LIVE_REQUEST_STATUSES]),
      ),
    )
    .limit(1);

  if (existing) {
    /*
     * Repair, don't just adopt.
     *
     * Reusing the row untouched leaves every database seeded before this
     * fixture learned to lock a price showing "quote needed" and no countdown
     * — for ever, because the early return means re-seeding never reaches the
     * insert that would get it right. An already-seeded database is precisely
     * one of the states this fixture has to survive.
     *
     * Only nulls are filled. A request that legitimately carries no package is
     * left alone, and a price already locked is never overwritten.
     */
    const repair: { finalPriceCents?: number; expiresAt?: Date } = {};

    if (existing.finalPriceCents === null && existing.packageId !== null) {
      repair.finalPriceCents = input.servicePackage.priceCents;
    }

    if (existing.expiresAt === null) {
      const expires = new Date(input.now);
      expires.setDate(expires.getDate() + BOOKING_REQUEST_EXPIRY_DAYS);
      repair.expiresAt = expires;
    }

    if (Object.keys(repair).length > 0) {
      await tx
        .update(bookingRequests)
        .set({ ...repair, updatedAt: sql`now()` })
        .where(eq(bookingRequests.id, existing.id));
    }

    return { id: existing.id, eventDate: existing.eventDate };
  }

  const wanted = new Date(input.now);
  wanted.setDate(wanted.getDate() + EVENT_DAYS_AHEAD);
  const eventDate = await firstFreeDate(tx, input.vendorProfileId, wanted);

  const expiresAt = new Date(input.now);
  expiresAt.setDate(expiresAt.getDate() + BOOKING_REQUEST_EXPIRY_DAYS);

  const [created] = await tx
    .insert(bookingRequests)
    .values({
      customerId: input.customerUserId,
      vendorId: input.vendorProfileId,
      packageId: input.servicePackage.id,
      eventDate,
      eventLocation: 'Barr Mansion, Austin TX',
      eventType: 'Wedding',
      guestCount: 120,
      customDetails: 'Seeded request, so the vendor dashboard has something to act on.',
      status: 'pending',
      // Both locked the way the service locks them, so the dashboard shows a
      // price and a countdown rather than "quote needed" and no deadline.
      finalPriceCents: input.servicePackage.priceCents,
      expiresAt,
    })
    .returning({ id: bookingRequests.id, eventDate: bookingRequests.eventDate });

  if (!created) {
    throw new Error('seedE2eFixtures: could not create the end-to-end booking request');
  }

  return created;
}
