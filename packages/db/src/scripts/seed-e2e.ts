import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { createDatabase } from '../client.js';
import { loadEnv } from '../load-env.js';
import { users, vendorProfiles } from '../schema/index.js';
import { seedE2eFixtures, type E2eAccount } from '../seed-e2e.js';
import { createStripeFixtureGateway, ensureE2eConnectedAccount } from './e2e-stripe-account.js';
import { assertSafeTarget } from './safe-target.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const E2E_ENV_FILE = '.env.e2e.local';

/**
 * Clerk's Backend API, called with `fetch` rather than through `@clerk/backend`.
 *
 * `packages/db` has no business depending on the auth SDK — this is one GET, and
 * adding Clerk to the database package would put it in every test's import
 * graph for the sake of it.
 */
const CLERK_API = 'https://api.clerk.com/v1/users';

interface ClerkUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: { email_address: string }[];
}

function readE2eEnv(): Record<string, string> {
  const file = path.join(REPO_ROOT, E2E_ENV_FILE);

  if (!existsSync(file)) {
    throw new Error(
      `${E2E_ENV_FILE} is absent. It holds the end-to-end account emails and is gitignored; ` +
        'create it before seeding fixtures.',
    );
  }

  return parse(readFileSync(file, 'utf8'));
}

/** The surname a Clerk profile with no last name falls back to, by role. */
function defaultLastName(role: string): string {
  if (role === 'vendor') {
    return 'Vendor';
  }

  return role === 'admin' ? 'Admin' : 'Customer';
}

/**
 * Resolves an end-to-end account's **real** Clerk id from its email.
 *
 * The id cannot be invented. `insertUserIfAbsent` absorbs a conflict on
 * `clerk_user_id` and nothing else, so a row carrying this email under a
 * made-up id makes the account's first real sign-in collide on the email index
 * instead — the insert throws and the account can never sign in. Asking Clerk
 * is the only correct source.
 */
async function resolveAccount(email: string, secretKey: string, role: string): Promise<E2eAccount> {
  const url = `${CLERK_API}?email_address=${encodeURIComponent(email)}&limit=1`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${secretKey}` } });

  if (!response.ok) {
    throw new Error(
      `Clerk refused the lookup for the ${role} account (${response.status}). ` +
        'Check CLERK_SECRET_KEY belongs to the same instance the account lives in.',
    );
  }

  const users = (await response.json()) as ClerkUser[];
  const user = users[0];

  if (!user) {
    throw new Error(
      `Clerk has no user for the ${role} account. Create it in the Clerk dashboard, or sign in ` +
        'once as that account, then re-run.',
    );
  }

  return {
    clerkUserId: user.id,
    email: user.email_addresses[0]?.email_address ?? email,
    firstName: user.first_name?.trim() || 'E2E',
    lastName: user.last_name?.trim() || defaultLastName(role),
  };
}

/**
 * The `.env.e2e.local` key that pins the fixture's connected account.
 *
 * Optional, and worth setting: without it every fresh lane database looks like
 * a vendor who has never onboarded and provisions a new test-mode account. An
 * account id is an identifier, not a credential — it lives here only because
 * this is the file the end-to-end fixture already owns.
 */
const E2E_STRIPE_ACCOUNT_KEY = 'E2E_VENDOR_STRIPE_ACCOUNT_ID';

/**
 * The business URL the fixture account is created with.
 *
 * Stripe validates it and refuses placeholder domains — `example.com` comes
 * back `url_invalid` — so this is the product's own deployed origin rather than
 * `WEB_URL`, which is `localhost` on every machine that runs this.
 */
const FIXTURE_BUSINESS_URL = 'https://web-gules-eta-41.vercel.app';

/** The account id already on the fixture vendor's storefront, if any. */
async function readStoredAccountId(
  db: ReturnType<typeof createDatabase>['db'],
  vendorEmail: string,
): Promise<string | null> {
  const [row] = await db
    .select({ stripeAccountId: vendorProfiles.stripeAccountId })
    .from(vendorProfiles)
    .innerJoin(users, eq(users.id, vendorProfiles.userId))
    .where(
      sql`lower(${users.email}) = lower(${vendorEmail}) and ${vendorProfiles.isDeleted} = false`,
    )
    .limit(1);

  return row?.stripeAccountId ?? null;
}

/** What the fixture writes to the storefront's two payout columns. */
interface PayoutRoute {
  /** The real connected account, kept even when it is not usable yet. */
  accountId: string | null;
  /** Whether Stripe reports both capabilities — the `isOnboarded` conjunction. */
  onboarded: boolean;
}

/** A vendor with no payout route at all, which the product already handles. */
const NO_PAYOUT_ROUTE: PayoutRoute = { accountId: null, onboarded: false };

/**
 * The connected account the fixture vendor is payable through.
 *
 * Real or nothing, and that is the whole of #387: a fixture with no payout route
 * is honest and the product already handles it (the accept gate answers 402 and
 * says so), while a fixture with a made-up account id is a lie that only
 * surfaces as a 404 at the last click of the money path.
 *
 * **Stripe cannot fail the seed.** Every Stripe outcome — no key, a live key, a
 * rotated one, a key for another instance, an outage — degrades to "no payout
 * route" rather than throwing. The rest of the fixture is what makes `/vendor`
 * and `/admin` reachable at all, and losing the vendor, customer and admin rows
 * because one column could not be filled would break every lane for a fixture
 * whose Stripe-dependent part is one column.
 */
async function resolveConnectedAccount(
  db: ReturnType<typeof createDatabase>['db'],
  vendorEmail: string,
  pinnedAccountId: string | undefined,
): Promise<PayoutRoute> {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    console.log(
      'STRIPE_SECRET_KEY is not set, so the fixture vendor is left without payouts. Checkout ' +
        'and accept will answer 402 until it is.',
    );
    return NO_PAYOUT_ROUTE;
  }

  /*
   * The pin wins when there is one, and its *shape* is not judged here — Stripe
   * is asked about whatever it holds. A format test at this seam would decide a
   * write for the same reason D29 refuses one at the column: an id the pattern
   * did not recognise would be silently dropped in favour of the database's,
   * and a replacement account provisioned over the top of a live one.
   */
  const existingAccountId =
    pinnedAccountId !== undefined && pinnedAccountId !== ''
      ? pinnedAccountId
      : await readStoredAccountId(db, vendorEmail);

  let account;

  try {
    account = await ensureE2eConnectedAccount(createStripeFixtureGateway(secretKey), {
      existingAccountId,
      contactEmail: vendorEmail,
      displayName: 'E2E Test Studio',
      businessUrl: FIXTURE_BUSINESS_URL,
    });
  } catch (error: unknown) {
    console.log(
      `  Stripe could not supply a connected account (${error instanceof Error ? error.message : 'unknown error'}), ` +
        'so the fixture vendor is left without payouts.',
    );
    return NO_PAYOUT_ROUTE;
  }

  if (account.created) {
    console.log(`  provisioned Stripe test account ${account.accountId}`);
    console.log(`  pin it: add ${E2E_STRIPE_ACCOUNT_KEY}=${account.accountId} to ${E2E_ENV_FILE}`);
  }

  if (!account.onboarded) {
    /*
     * The id is kept even so, which is what makes the next run converge: it is
     * read back, Stripe is asked again, and the account finishes activating.
     * Returning `null` here instead would blank the column, orphan the account
     * that was just created, and have the following run provision another —
     * one abandoned test-mode account per lane, for ever.
     *
     * `account_id` set with `onboarded` false is also the real product state:
     * the account is claimed first and the flag flips when Stripe reports the
     * capabilities.
     */
    console.log(
      `  Stripe has not activated both capabilities on ${account.accountId} yet — re-run to pick ` +
        'them up',
    );
  }

  return { accountId: account.accountId, onboarded: account.onboarded };
}

/**
 * Gives the end-to-end accounts a storefront they can reach.
 *
 * Opt-in and additive: it never touches `db:seed:marketing`'s rows, so one
 * lane's fixture cannot become another lane's mystery failure. Safe to run
 * repeatedly.
 */
async function main(): Promise<void> {
  loadEnv();

  /*
   * Stricter than it looks necessary. This fixture does not merely add rows: it
   * forces a `users.role` to `vendor` and attaches a Stripe connected account
   * created for a fictional person. Neither belongs in a database holding real
   * accounts, so the target is refused before Clerk or Stripe is even asked.
   */
  assertSafeTarget('end-to-end fixtures');

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is not set, so the accounts cannot be resolved.');
  }

  const values = readE2eEnv();
  const vendorEmail = values.E2E_VENDOR_EMAIL;
  const customerEmail = values.E2E_CUSTOMER_EMAIL;
  /*
   * Optional, unlike the other two. An admin row is what makes `/admin`
   * reachable — the role cannot be reached from inside the product, because it
   * is read from Clerk at first sign-in and immutable after — but a checkout
   * that predates the account should still seed the vendor and customer
   * fixtures rather than failing outright on a gitignored file it cannot fix.
   */
  const adminEmail = values.E2E_ADMIN_EMAIL;

  if (!vendorEmail || !customerEmail) {
    throw new Error(`${E2E_ENV_FILE} must supply E2E_VENDOR_EMAIL and E2E_CUSTOMER_EMAIL.`);
  }

  const [vendor, customer, admin] = await Promise.all([
    resolveAccount(vendorEmail, secretKey, 'vendor'),
    resolveAccount(customerEmail, secretKey, 'customer'),
    adminEmail === undefined ? undefined : resolveAccount(adminEmail, secretKey, 'admin'),
  ]);

  /*
   * `--draft` leaves the fixture vendor unpublished with no requests, which is
   * the only way to render frame `27 Vendor dashboard - empty . 1024` (#371).
   * Re-running without the flag restores the published fixture, so it needs no
   * separate undo.
   */
  const draft = process.argv.includes('--draft');

  const { db, client } = createDatabase({ max: 1 });

  try {
    const payouts = await resolveConnectedAccount(db, vendor.email, values[E2E_STRIPE_ACCOUNT_KEY]);

    const result = await seedE2eFixtures(db, {
      vendor,
      customer,
      ...(admin === undefined ? {} : { admin }),
      stripeAccountId: payouts.accountId,
      payoutsReady: payouts.onboarded,
      storefront: draft ? 'draft' : 'published',
    });

    if (draft) {
      console.log(
        'Seeded the end-to-end fixtures in DRAFT: the vendor account owns an unpublished ' +
          'storefront with no requests. Re-run without --draft to restore the published one.',
      );
      console.log(`  vendor profile ${result.vendorProfileId}`);
      return;
    }

    console.log(
      'Seeded the end-to-end fixtures: the vendor account owns a published storefront with ' +
        'one package and one pending request, and ' +
        (payouts.onboarded
          ? `takes payment through ${payouts.accountId}.`
          : 'no payout route yet, so accept and checkout answer 402.'),
    );
    console.log(`  vendor profile ${result.vendorProfileId}`);
    console.log(`  booking request ${result.bookingRequestId}`);
    console.log(
      result.adminUserId === undefined
        ? '  no admin account — set E2E_ADMIN_EMAIL to make /admin reachable'
        : `  admin ${result.adminUserId}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('E2E seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
