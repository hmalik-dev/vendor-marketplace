import {
  BOOKING_REQUEST_EXPIRY_DAYS,
  calculateFees,
  CURRENT_TERMS_VERSION,
  DEFAULT_PLATFORM_FEE_RATE,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  EVENT_TYPES,
  type EventType,
  legalDocumentSha256,
  type LegalAcceptanceDocument,
  EMAIL_RETRY_MAX_ATTEMPTS,
  parseDurationHours,
  SUPPORT_REFERENCE_PREFIX,
  toDateString,
} from '@vendor-marketplace/shared';
import { and, eq, gte, inArray, lte, ne, notExists, sql } from 'drizzle-orm';
import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  adminActions,
  availability,
  bookingRequests,
  bookings,
  categories,
  legalAcceptances,
  reviews,
  servicePackages,
  supportCases,
  users,
  vendorApplications,
  vendorCategories,
  vendorInvites,
  vendorProfiles,
} from './schema/index.js';
import { deleteBookingRequests } from './delete-booking-requests.js';

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

/** The occasion the seeded request is for — the slug. See `bookings.ts`. */
const SEEDED_EVENT_TYPE: EventType = 'wedding';

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

/** How long ago the seeded completed booking's event took place. */
const COMPLETED_EVENT_DAYS_AGO = 30;

/** When the seeded completed booking was paid, relative to its event. */
const PAID_DAYS_BEFORE_EVENT = 21;

/** When its request was sent, relative to the payment. */
const REQUEST_DAYS_BEFORE_PAYMENT = 7;

/** The ratings the two seeded reviews give — one per direction. */
const SEEDED_REVIEW_RATINGS = { customer_to_vendor: 5, vendor_to_customer: 4 } as const;

export interface E2eAccount {
  /**
   * The account's **real** Auth id.
   *
   * Not optional and not inventable. A `users` row carrying the end-to-end
   * email under a made-up id makes the account's first real sign-in hit
   * `users_email_key`: `insertUserIfAbsent` declines the write, finds no row
   * under the real Neon Auth id, and **throws** naming that id — so the account
   * cannot sign in until somebody removes the fixture's row. The fixture is
   * therefore only ever allowed to attach to the identity Neon Auth actually has.
   *
   * #442 changed how it fails without changing that it fails. The conflict is
   * now swallowed by an untargeted `DO NOTHING` rather than raising a 23505,
   * and the throw is raised deliberately afterwards, precisely so this stays a
   * loud lockout rather than becoming a silent one.
   */
  authUserId: string;
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
   * product: the role is chosen at first acceptance,
   * falls back to `customer`, and is immutable afterwards — so no sign-up flow
   * produces an admin, and `seed-demo.ts` gives its admin a synthetic
   * `auth_user_id` that cannot authenticate. Before this, the only route to
   * frame `13`'s screens was promoting a customer in the database by hand,
   * which is a privileged write nobody should be making to run a test.
   */
  admin?: E2eAccount;
  /**
   * The **real** connected account the fixture vendor is payable through, or
   * `null` when there is none.
   *
   * Real or nothing — there is no third option, and that is the whole of #387.
   * The fixture used to write `acct_e2e_fixture_not_a_real_account` whenever
   * `payoutsReady` was set, which every column-shaped check read as
   * payment-capable and Stripe rejected the moment a PaymentIntent named it as
   * `transfer_data.destination`. The API answered 400, the web app folded that
   * into `notFound()`, and `/bookings/<id>/checkout` served a 404 to the only
   * account an automated pass can drive — so every browser and end-to-end run
   * stopped one click short of the money path, and a dead checkout reached
   * pre-launch. `scripts/e2e-stripe-account.ts` provisions the real one.
   */
  stripeAccountId?: string | null;
  /**
   * Whether the fixture vendor is marked as able to take payment.
   *
   * `true` by default, because the gate it clears — `accept` answering 402
   * until Stripe reports both capabilities — is a Stripe round trip no
   * unattended run can complete. Set it `false` to drive the gate itself.
   *
   * It can only ever **narrow** `stripeAccountId`: with no account there is
   * nothing to be ready with, so the fixture is left un-onboarded rather than
   * claiming a payout route it does not have. The reverse is allowed — an
   * account id with `stripe_onboarded` false is the state a vendor is in
   * between claiming the account and Stripe activating it.
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
  const stripeAccountId = input.stripeAccountId ?? null;
  const payoutsReady = (input.payoutsReady ?? true) && stripeAccountId !== null;
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

    /*
     * Every account, before anything else it owns. The acceptance gate (#429)
     * refuses every authenticated route to an account that does not hold the
     * current Terms, so without these rows a seeded fixture signs in and reaches
     * nothing — the vendor's storefront, the customer's bookings and the admin
     * console alike.
     */
    await ensureTermsAccepted(tx, vendorUserId, input.vendor);
    await ensureTermsAccepted(tx, customerUserId, input.customer);
    if (adminUserId !== undefined && input.admin) {
      await ensureTermsAccepted(tx, adminUserId, input.admin);
    }

    /*
     * Pre-invited (VEN-406), so the fixture vendor keeps signing in with the
     * vendor gate on. The account already exists, so the invite reads as used.
     */
    await tx
      .insert(vendorInvites)
      .values({ email: input.vendor.email.toLowerCase(), acceptedAt: now })
      .onConflictDoNothing({ target: vendorInvites.email });

    /*
     * An invite whose email failed (VEN-465), for the operator's resend control.
     * Already at the attempt cap, so the retry sweep leaves it failed for the
     * browser pass; a re-seed puts it back after a resend has healed it.
     */
    const failedInvite = {
      emailAttempts: EMAIL_RETRY_MAX_ATTEMPTS,
      emailLastAttemptAt: now,
      emailSentAt: null,
      emailFailureReason: 'Resend refused the send (500)',
    };
    await tx
      .insert(vendorInvites)
      .values({ email: E2E_FAILED_INVITE_EMAIL, ...failedInvite })
      .onConflictDoUpdate({ target: vendorInvites.email, set: failedInvite });

    const vendorProfileId = await ensureProfile(tx, vendorUserId, {
      stripeAccountId,
      payoutsReady,
      draft,
    });
    await attachCategory(tx, vendorProfileId);
    await ensureAgreementAccepted(tx, vendorProfileId, vendorUserId, input.vendor);

    if (draft) {
      /*
       * Cleared rather than skipped. The account is long-lived and a previous
       * pass will have left a live request on it, so seeding a draft without
       * this produces the one state the frame never draws: a storefront that is
       * not live with requests waiting on it.
       */
      await clearLiveRequests(tx, vendorProfileId);
      // And the reviewed booking the published seed wrote, which is not empty.
      await removeReviewedBooking(tx, vendorProfileId, customerUserId);
      /*
       * And the two blockers the frame draws open. Without this the draft
       * fixture rendered `Publish checklist · 6 of 6` on an unpublished
       * profile — a real state, but not the one frames `20` and
       * `27 Vendor dashboard — empty · 1024` are of: their whole premise is that
       * an empty dashboard has a cause, and the gold banner names it. A
       * long-lived account carries whatever the last published run left, so this
       * has to retire it rather than skip creating it (#371).
       */
      await openPublishBlockers(tx, vendorProfileId);

      return {
        vendorUserId,
        customerUserId,
        ...(adminUserId === undefined ? {} : { adminUserId }),
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
    await ensureReviewedBooking(tx, {
      vendorProfileId,
      vendorUserId,
      customerUserId,
      servicePackage,
      now,
    });
    await ensureConsoleListRows(tx, {
      customer: input.customer,
      customerUserId,
      adminUserId,
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

/*
 * Fixed identifiers, so a re-run finds its own rows instead of writing a second
 * set. The applicant address is under `example.test`, which cannot be
 * registered, so no invite or sign-up can ever match it.
 */
const E2E_APPLICANT_EMAIL = 'e2e-applicant@example.test';
const E2E_FAILED_INVITE_EMAIL = 'e2e-failed-invite@example.test';
const E2E_CASE_REFERENCE = `${SUPPORT_REFERENCE_PREFIX}-E2EE-22`;
const E2E_AUDIT_ROW_ID = '00000000-0000-4000-8000-0000000e2e01';
const E2E_AUDIT_SUBJECT_ID = '00000000-0000-4000-8000-0000000e2e02';

/**
 * One row for each console list that would otherwise read empty after the seed
 * (VEN-460): an open support case, an application waiting on an operator, and
 * one audit entry. A list that draws nothing renders its empty state cleanly,
 * so a browser pass over it proves nothing about the rows a real list draws.
 *
 * The audit row needs an operator to have taken the action, so it exists only
 * when the fixture has an admin account. All three insert-if-absent: the audit
 * log is immutable by trigger, and the other two are the operator's to work on,
 * so a re-run must not put back what a pass has since changed.
 */
async function ensureConsoleListRows(
  tx: Tx,
  input: { customer: E2eAccount; customerUserId: string; adminUserId: string | undefined },
): Promise<void> {
  await tx
    .insert(supportCases)
    .values({
      reference: E2E_CASE_REFERENCE,
      origin: 'support_message',
      topic: 'something-else',
      senderUserId: input.customerUserId,
      senderEmail: input.customer.email,
      message: 'A seeded question, so the console has a case to list. Not a real customer.',
    })
    .onConflictDoNothing({ target: supportCases.reference });

  await tx
    .insert(vendorApplications)
    .values({
      email: E2E_APPLICANT_EMAIL,
      businessName: 'E2E Applicant Bakery',
      category: 'Catering',
      city: 'Austin',
      message: 'A seeded application, so the console has one waiting. Not a real business.',
    })
    .onConflictDoNothing({ target: vendorApplications.email });

  if (input.adminUserId !== undefined) {
    await tx
      .insert(adminActions)
      .values({
        id: E2E_AUDIT_ROW_ID,
        actorId: input.adminUserId,
        action: 'tag_updated',
        subjectType: 'tag',
        subjectId: E2E_AUDIT_SUBJECT_ID,
      })
      .onConflictDoNothing({ target: adminActions.id });
  }
}

/**
 * A `users` row no Neon Auth identity backs: a seeded one (`seed`), read from
 * the recorded `auth_provider`, never the id's shape.
 */
const UNBACKED_ROW = ne(users.authProvider, 'neon_auth');

/**
 * Re-keys a pre-swap row to the identity Neon Auth actually holds.
 *
 * A database that predates the swap to Neon Auth already has the fixture's
 * row under an auth id. The upsert below is keyed on `auth_user_id`, so without
 * this it would insert a second row and die on the unique email. Only a row no
 * identity backs is touched, and only when the Neon id has no row yet: a
 * Neon-keyed row is never re-keyed, and its email and role are left to the
 * upsert exactly as before. Re-running finds nothing to adopt.
 */
async function adoptUnbackedRow(tx: Tx, account: E2eAccount): Promise<void> {
  const [existing] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.authUserId, account.authUserId));

  if (existing) {
    return;
  }

  await tx
    .update(users)
    .set({ authUserId: account.authUserId, authProvider: 'neon_auth', updatedAt: sql`now()` })
    .where(and(sql`lower(${users.email}) = lower(${account.email})`, UNBACKED_ROW));
}

/**
 * Ensures the local row for a Neon Auth identity, and that it holds the role the
 * fixture needs.
 *
 * The role is forced rather than left alone: it comes from the sign-up choice
 * at first acceptance, falls back to `customer` for anything
 * unrecognised, and is immutable afterwards — so an end-to-end vendor account
 * that signed up without the hint has a `customer` row that nothing in the
 * application can correct, and every vendor guard refuses it.
 */
async function upsertAccount(
  tx: Tx,
  account: E2eAccount,
  role: 'vendor' | 'customer' | 'admin',
): Promise<string> {
  await adoptUnbackedRow(tx, account);

  const [row] = await tx
    .insert(users)
    .values({
      authUserId: account.authUserId,
      email: account.email,
      role,
      firstName: account.firstName,
      lastName: account.lastName,
    })
    .onConflictDoUpdate({
      target: users.authUserId,
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
interface ProfileState {
  /** The real connected account, or `null` for a vendor with no payout route. */
  stripeAccountId: string | null;
  payoutsReady: boolean;
  draft: boolean;
}

async function ensureProfile(
  tx: Tx,
  vendorUserId: string,
  { stripeAccountId, payoutsReady, draft }: ProfileState,
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
        /*
         * Both columns, unconditionally, on every adoption. `db-schema.md`'s
         * legacy rule applies and this is the repair: a database seeded before
         * #387 holds the placeholder id, and re-running the seed is what
         * replaces it with the real account rather than leaving the row to
         * fail at `transfer_data.destination` for ever.
         *
         * The id is written even when the vendor is not payout-ready, and only
         * the flag is narrowed. That is the real product state — the account is
         * claimed first and `stripe_onboarded` flips when Stripe reports the
         * capabilities — and it is what lets the next run read the account back
         * and finish activating it rather than provisioning another.
         */
        stripeOnboarded: payoutsReady,
        stripeAccountId,
        /*
         * Restored on a published adoption, for the same reason the package is:
         * the draft fixture nulls it to open the `responseTime` blocker, and a
         * published run that left it null would seed a storefront the publish
         * gate refuses.
         */
        ...(draft ? {} : { responseTimeHours: 4 }),
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
      stripeAccountId,
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
        stripeAccountId: sql`excluded.stripe_account_id`,
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
 *
 * **A request that became a booking is kept.** `bookings.request_id` is
 * `RESTRICT`, so deleting one failed the whole draft seed the moment the
 * published seed wrote its completed, reviewed booking (VEN-395) — or a paid
 * journey had booked one. A booking is history, not a request waiting on the
 * vendor, and deleting paid history to draw an empty pane is not this
 * fixture's to do.
 */
async function clearLiveRequests(tx: Tx, vendorProfileId: string): Promise<void> {
  await deleteBookingRequests(
    tx,
    and(
      eq(bookingRequests.vendorId, vendorProfileId),
      notExists(
        tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(eq(bookings.requestId, bookingRequests.id)),
      ),
    )!,
  );
}

/**
 * Re-opens the two publish blockers the draft frames draw — response time and a
 * bookable package.
 *
 * **Both are cleared rather than left uncreated**, because the account is
 * long-lived: `ensureProfile` adopts the row a published run left behind, and
 * that row already has a response time and at least one active package. The
 * result was a draft storefront with an empty `publishBlockers`, which renders a
 * dashboard with no gold banner and a full checklist — the one composition
 * frames `20` and `27 Vendor dashboard — empty · 1024` do not draw.
 *
 * The packages are deactivated, not deleted: `publishBlockers` counts *active*
 * packages, and a delete would take the rows a past booking still points at.
 */
async function openPublishBlockers(tx: Tx, vendorProfileId: string): Promise<void> {
  await tx
    .update(vendorProfiles)
    .set({ responseTimeHours: null, updatedAt: sql`now()` })
    .where(eq(vendorProfiles.id, vendorProfileId));

  await tx
    .update(servicePackages)
    .set({ isActive: false, updatedAt: sql`now()` })
    .where(eq(servicePackages.vendorId, vendorProfileId));
}

/**
 * Gives a fixture account an acceptance it needs to be usable, once.
 *
 * Two of them exist and they gate different things:
 *
 * - **The Terms of Service**, for every account. Since #429 the acceptance gate
 *   holds any session whose account does not hold `CURRENT_TERMS_VERSION` at the
 *   first-sign-in interstitial and answers every other route `TERMS_REQUIRED`.
 *   Without this row a seeded account can sign in and reach nothing, which reads
 *   exactly like the ticket under test being broken.
 * - **The vendor agreement**, for the vendor. #427 refuses a charge against a
 *   vendor who does not hold the version in force — the agreement is what the
 *   commission and the payout timing are agreed under — so a fixture that
 *   skipped it would stop every browser pass one click short of the money path,
 *   which is the failure #387 already fixed once for the connected account.
 *
 * Written only when it is missing, and never rewritten: the table is
 * append-only and the database refuses an update outright, so a re-run of the
 * seed must not try. A row for a *superseded* version is left exactly where it
 * is and a row for the current one is added beside it, which is the same thing
 * a real account re-accepting does.
 *
 * **The method is `seed_fixture`, not `clickwrap_checkbox`.** Nobody ticked a
 * box here, and labelling a seeded row as though somebody did would put a
 * fabricated act into the one table whose whole value is that it is true.
 */
async function ensureAcceptance(
  tx: Tx,
  params: {
    userId: string;
    document: LegalAcceptanceDocument;
    version: string;
    vendorId: string | null;
    /** Resolved only when a row is actually written — see the early return. */
    businessName: () => Promise<string | null>;
    acceptedByName: string;
  },
): Promise<void> {
  const [held] = await tx
    .select({ id: legalAcceptances.id })
    .from(legalAcceptances)
    .where(
      and(
        eq(legalAcceptances.acceptedByUserId, params.userId),
        eq(legalAcceptances.document, params.document),
        eq(legalAcceptances.version, params.version),
      ),
    )
    .limit(1);

  if (held) {
    return;
  }

  await tx.insert(legalAcceptances).values({
    vendorId: params.vendorId,
    document: params.document,
    version: params.version,
    documentSha256: legalDocumentSha256(params.document),
    acceptanceMethod: 'seed_fixture',
    acceptedByUserId: params.userId,
    acceptedByName: params.acceptedByName,
    businessName: await params.businessName(),
    /*
     * No address and no agent: this acceptance was made by a seed, not by a
     * person at a browser, and inventing either would put a fabricated fact
     * into the one table whose value is that it is not fabricated.
     */
    ip: null,
    userAgent: null,
  });
}

/** How a fixture account's name is frozen onto the row it accepts with. */
function acceptedByName(account: E2eAccount): string {
  return `${account.firstName} ${account.lastName}`.trim() || account.email;
}

/** The Terms of Service acceptance every seeded account needs to be usable. */
async function ensureTermsAccepted(tx: Tx, userId: string, account: E2eAccount): Promise<void> {
  await ensureAcceptance(tx, {
    userId,
    document: 'terms_of_service',
    version: CURRENT_TERMS_VERSION,
    vendorId: null,
    businessName: async () => null,
    acceptedByName: acceptedByName(account),
  });
}

async function ensureAgreementAccepted(
  tx: Tx,
  vendorProfileId: string,
  vendorUserId: string,
  vendor: E2eAccount,
): Promise<void> {
  await ensureAcceptance(tx, {
    userId: vendorUserId,
    document: 'vendor_agreement',
    version: CURRENT_VENDOR_AGREEMENT_VERSION,
    vendorId: vendorProfileId,
    /*
     * Lazy, so a re-seed that already holds the agreement does not pay for a
     * profile read it will discard — the early return in `ensureAcceptance`
     * fires first.
     */
    businessName: async () => {
      const [profile] = await tx
        .select({ businessName: vendorProfiles.businessName })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendorProfileId))
        .limit(1);

      return profile?.businessName ?? 'E2E Test Studio';
    },
    acceptedByName: acceptedByName(vendor),
  });
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

/**
 * One bookable package, which is what makes the vendor publishable.
 *
 * The duration is part of the fixture rather than an optional extra: frame `05`
 * draws the checkout rail's sub-line as `<package> · <duration>`, so a package
 * without one leaves half of that line unreachable to a parity pass. It is
 * backfilled onto an existing row too — a lane seeded before #395 would
 * otherwise keep measuring the shorter line for ever.
 */
async function ensurePackage(tx: Tx, vendorId: string): Promise<SeededPackage> {
  const name = 'Full day coverage';
  /** Eight, because that is what this package's own description promises. */
  const durationHours = '8';

  const [existing] = await tx
    .select({
      id: servicePackages.id,
      priceCents: servicePackages.priceCents,
      durationHours: servicePackages.durationHours,
      isActive: servicePackages.isActive,
    })
    .from(servicePackages)
    .where(and(eq(servicePackages.vendorId, vendorId), eq(servicePackages.name, name)))
    .limit(1);

  if (existing) {
    /*
     * Two repairs on adoption, and each one only when it is actually needed.
     *
     * The duration: NUMERIC comes back with its scale (`8.0` for an `8`), so the
     * comparison is on the parsed number rather than on the string — otherwise
     * this writes on every run for ever, and `lane:up` runs it once per lane.
     *
     * The active flag: the draft fixture deactivates this row to open the
     * `packages` blocker, so a published run that only *found* it left the
     * storefront with no bookable package and no way back to published without
     * editing the profile by hand (#371).
     */
    const staleDuration = parseDurationHours(existing.durationHours) !== Number(durationHours);

    if (staleDuration || !existing.isActive) {
      await tx
        .update(servicePackages)
        .set({
          ...(staleDuration ? { durationHours } : {}),
          ...(existing.isActive ? {} : { isActive: true }),
        })
        .where(eq(servicePackages.id, existing.id));
    }

    return { id: existing.id, priceCents: existing.priceCents };
  }

  const [created] = await tx
    .insert(servicePackages)
    .values({
      vendorId,
      name,
      description: 'Eight hours of coverage, edited gallery delivered in three weeks.',
      priceCents: 145_000,
      durationHours,
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
      eventType: bookingRequests.eventType,
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
     * Nulls are filled, and nothing else — with one named exception below. A
     * request that legitimately carries no package is left alone, and a price
     * already locked is never overwritten.
     */
    const repair: { finalPriceCents?: number; expiresAt?: Date; eventType?: EventType } = {};

    /*
     * The named exception: this is the one repair that overwrites a non-null
     * value. The seed wrote the display label `Wedding` for months, so every
     * database seeded before the fix carries a row whose occasion renders
     * blank — and `$type` cannot reach a row already written. Null is filled
     * for the same reason the price and the expiry are; a value the vocabulary
     * does declare is left exactly as it is, whoever wrote it.
     *
     * `unknown[]`, so the null and the out-of-vocabulary string are one test
     * rather than two.
     */
    if (!(EVENT_TYPES as readonly unknown[]).includes(existing.eventType)) {
      repair.eventType = SEEDED_EVENT_TYPE;
    }

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
      eventType: SEEDED_EVENT_TYPE,
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

/** The instant `days` before `now`; a negative `days` is after it. */
function daysBefore(now: Date, days: number): Date {
  const date = new Date(now);
  date.setDate(date.getDate() - days);

  return date;
}

/**
 * Marks the request behind the fixture's own completed booking.
 *
 * The paid-booking journey completes bookings between the same two accounts, so
 * "a completed booking between the pair" is not the fixture's row — and the
 * draft seed removes this one. Matched on the request's details rather than a
 * new column: it is the one free-text field the fixture already writes.
 */
const SEEDED_COMPLETED_DETAILS = 'Seeded completed booking, so the console has reviews to filter.';

/** Where the seeded completed booking took place. */
const SEEDED_COMPLETED_LOCATION = 'Laguna Gloria, Austin TX';

/** The rounded average and count `reviews.dao.ts` derives on both sides of a review. */
const RATING_AGGREGATE = {
  avgRating: sql<string>`coalesce(round(avg(${reviews.rating})::numeric, 2), 0)`,
  reviewCount: sql<number>`count(*)::int`,
};

/** The fixture's own completed booking, found through the request it came from. */
async function findSeededBooking(tx: Tx, vendorProfileId: string): Promise<string | null> {
  const [row] = await tx
    .select({ bookingId: bookings.id })
    .from(bookings)
    .innerJoin(bookingRequests, eq(bookingRequests.id, bookings.requestId))
    .where(
      and(
        eq(bookings.vendorId, vendorProfileId),
        eq(bookingRequests.customDetails, SEEDED_COMPLETED_DETAILS),
      ),
    )
    .limit(1);

  return row?.bookingId ?? null;
}

/**
 * One completed booking between the two fixture accounts, reviewed in **both**
 * directions (VEN-395).
 *
 * Without it `/admin/reviews` is empty after `seed:e2e`, so the review-direction
 * filter spec passes because it found nothing to check — a review needs a
 * completed booking, and nothing in this fixture completed one.
 *
 * **The payout is the legacy destination pair** — `payout_released_at` set with
 * no `stripe_transfer_id` (`isLegacyDestinationPayout`). The vendor is payable
 * through a *real* connected account, so an unreleased `separate` row would be
 * picked up by the payout sweep and moved as real test-mode money; a made-up
 * transfer id is the fake Stripe object #387 removed. This pair is neither: the
 * sweep ignores it and a refund against it reverses nothing.
 *
 * Idempotent: the fixture's own booking is adopted, and each review is written
 * only if its author has not reviewed that booking. The derived ratings are then
 * re-derived from the rows, so a re-run cannot double-count.
 */
async function ensureReviewedBooking(
  tx: Tx,
  input: {
    vendorProfileId: string;
    vendorUserId: string;
    customerUserId: string;
    servicePackage: SeededPackage;
    now: Date;
  },
): Promise<void> {
  const bookingId =
    (await findSeededBooking(tx, input.vendorProfileId)) ??
    (await createCompletedBooking(tx, input));

  await tx
    .insert(reviews)
    .values([
      {
        bookingId,
        reviewerId: input.customerUserId,
        vendorId: input.vendorProfileId,
        type: 'customer_to_vendor',
        rating: SEEDED_REVIEW_RATINGS.customer_to_vendor,
        content: 'Seeded review, so the console has a review about a vendor.',
        isPublic: true,
      },
      {
        bookingId,
        reviewerId: input.vendorUserId,
        vendorId: input.vendorProfileId,
        type: 'vendor_to_customer',
        rating: SEEDED_REVIEW_RATINGS.vendor_to_customer,
        content: 'Seeded review, so the console has a review about a customer.',
        // The vendor's read on a customer stays private, as `seed-demo` writes it.
        isPublic: false,
      },
    ])
    .onConflictDoNothing({ target: [reviews.bookingId, reviews.reviewerId] });

  await rederiveRatings(tx, input.vendorProfileId, input.customerUserId);
}

/**
 * Removes the fixture's own reviewed booking, for the draft storefront.
 *
 * The draft seed exists to draw frame `27 Vendor dashboard — empty · 1024`, and
 * a completed, paid, five-star booking is not empty: it feeds the payout totals
 * and the rating. The booking goes first — its reviews cascade with it — then
 * the request `RESTRICT` was guarding, and the ratings are re-derived from what
 * is left. Only the fixture's marked row: a booking a paid journey completed is
 * history this fixture did not write.
 */
async function removeReviewedBooking(
  tx: Tx,
  vendorProfileId: string,
  customerUserId: string,
): Promise<void> {
  const bookingId = await findSeededBooking(tx, vendorProfileId);

  if (bookingId === null) {
    return;
  }

  const [removed] = await tx
    .delete(bookings)
    .where(eq(bookings.id, bookingId))
    .returning({ requestId: bookings.requestId });

  if (removed) {
    await deleteBookingRequests(tx, eq(bookingRequests.id, removed.requestId));
  }

  await rederiveRatings(tx, vendorProfileId, customerUserId);
}

/** Both parties' derived ratings, recounted from the review rows as `reviews.dao.ts` does. */
async function rederiveRatings(
  tx: Tx,
  vendorProfileId: string,
  customerUserId: string,
): Promise<void> {
  const [vendorTotals] = await tx
    .select(RATING_AGGREGATE)
    .from(reviews)
    .where(
      and(
        eq(reviews.vendorId, vendorProfileId),
        eq(reviews.type, 'customer_to_vendor'),
        eq(reviews.isPublic, true),
      ),
    );
  await tx
    .update(vendorProfiles)
    .set({
      avgRating: vendorTotals?.avgRating ?? '0',
      reviewCount: vendorTotals?.reviewCount ?? 0,
    })
    .where(eq(vendorProfiles.id, vendorProfileId));

  const [customerTotals] = await tx
    .select(RATING_AGGREGATE)
    .from(reviews)
    .innerJoin(bookings, eq(bookings.id, reviews.bookingId))
    .where(and(eq(reviews.type, 'vendor_to_customer'), eq(bookings.customerId, customerUserId)));
  await tx
    .update(users)
    .set({
      avgCustomerRating: customerTotals?.avgRating ?? '0',
      customerReviewCount: customerTotals?.reviewCount ?? 0,
    })
    .where(eq(users.id, customerUserId));
}

/**
 * The accepted request and the completed booking it became, past the event.
 *
 * Every timestamp is in the past and in the order the product writes them —
 * sent, accepted and paid, event, completed. A request left at the `now()`
 * default counted as answered inside the dashboard's 30-day response window
 * while claiming to have been accepted seven weeks before it was sent.
 */
async function createCompletedBooking(
  tx: Tx,
  input: {
    vendorProfileId: string;
    customerUserId: string;
    servicePackage: SeededPackage;
    now: Date;
  },
): Promise<string> {
  const event = daysBefore(input.now, COMPLETED_EVENT_DAYS_AGO);
  const eventDate = toDateString(event);
  const paidAt = daysBefore(event, PAID_DAYS_BEFORE_EVENT);
  const sentAt = daysBefore(paidAt, REQUEST_DAYS_BEFORE_PAYMENT);
  const completedAt = daysBefore(event, -1);
  const fees = calculateFees(input.servicePackage.priceCents, DEFAULT_PLATFORM_FEE_RATE);

  const [request] = await tx
    .insert(bookingRequests)
    .values({
      customerId: input.customerUserId,
      vendorId: input.vendorProfileId,
      packageId: input.servicePackage.id,
      eventDate,
      eventLocation: SEEDED_COMPLETED_LOCATION,
      eventType: SEEDED_EVENT_TYPE,
      guestCount: 80,
      customDetails: SEEDED_COMPLETED_DETAILS,
      status: 'accepted',
      finalPriceCents: input.servicePackage.priceCents,
      acceptedAt: paidAt,
      createdAt: sentAt,
      updatedAt: paidAt,
    })
    .returning({ id: bookingRequests.id });

  if (!request) {
    throw new Error('seedE2eFixtures: could not create the completed booking request');
  }

  const [booking] = await tx
    .insert(bookings)
    .values({
      requestId: request.id,
      customerId: input.customerUserId,
      vendorId: input.vendorProfileId,
      eventDate,
      eventLocation: SEEDED_COMPLETED_LOCATION,
      totalAmountCents: fees.totalCents,
      platformFeeCents: fees.platformFeeCents,
      vendorPayoutCents: fees.vendorPayoutCents,
      payoutModel: 'destination',
      payoutReleasedAt: paidAt,
      status: 'completed',
      paidAt,
      completedAt,
      createdAt: paidAt,
      updatedAt: completedAt,
    })
    .returning({ id: bookings.id });

  if (!booking) {
    throw new Error('seedE2eFixtures: could not create the completed booking');
  }

  return booking.id;
}
