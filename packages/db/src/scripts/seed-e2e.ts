import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { createDatabase } from '../client.js';
import { loadEnv } from '../load-env.js';
import { seedE2eFixtures, type E2eAccount } from '../seed-e2e.js';
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
   * forces a `users.role` to `vendor` and marks a vendor able to take payment
   * without Stripe ever saying so. Neither belongs in a database holding real
   * accounts, so the target is refused before Clerk is even asked.
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

  const { db, client } = createDatabase({ max: 1 });

  try {
    const result = await seedE2eFixtures(db, {
      vendor,
      customer,
      ...(admin === undefined ? {} : { admin }),
    });
    console.log(
      'Seeded the end-to-end fixtures: the vendor account owns a published storefront with ' +
        'one package and one pending request, and can take payment.',
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
