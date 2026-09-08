import { createClerkClient } from '@clerk/backend';
import { createDatabase, loadEnv } from '@vendor-marketplace/db';
import { canonicalWebOrigin, parseEnv } from '../../config/env.js';
import { createS3Storage } from '../../lib/storage.js';
import { bookingContextFor } from '../payments/payments.service.js';
import { buildServer } from '../../server.js';
import { reconcileClerkUsers } from './clerk.reconcile.js';

/**
 * Runs the reconciliation pass against the configured database and Clerk app.
 *
 * Written as a script rather than a one-off because a webhook being pointed at
 * the wrong place is a recurring class of mistake, not a single incident: the
 * next time it happens, the repair is `pnpm reconcile:clerk` rather than an
 * afternoon of manual SQL.
 *
 * Read-mostly and idempotent — running it when nothing has drifted writes
 * nothing at all.
 */
/** `--dry-run` reports the drift without correcting it. */
const dryRun = process.argv.includes('--dry-run');

loadEnv();

const env = parseEnv();
const { db, client } = createDatabase();
const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

/*
 * The real instance, never listened on (#433).
 *
 * Retiring a user now refunds their bookings, so this pass needs Stripe, the
 * event hub and the mailer — and assembling those here by hand is how the
 * repair path comes to hold a different client from the live one. The payout
 * sweep is off because a repair pass must move no money it was not asked to.
 */
const app = await buildServer({
  env,
  db,
  storage: createS3Storage(env),
  payoutSweepIntervalMs: 0,
});

try {
  const summary = await reconcileClerkUsers(
    bookingContextFor(app, app.log, canonicalWebOrigin(env)),
    clerk.users,
    { dryRun },
    app.clock(),
  );

  process.stdout.write(
    `${dryRun ? 'Would reconcile' : 'Reconciled'} ${summary.examined} user(s) against Clerk\n` +
      `  ${summary.updated} ${dryRun ? 'would be corrected' : 'corrected'}\n` +
      `  ${summary.deleted} ${dryRun ? 'would be retired' : 'retired'} (deleted in Clerk)\n` +
      `  ${summary.diverged} still disagree — the address is held by another account\n` +
      `  ${summary.unchanged} already in agreement\n` +
      `  ${summary.skipped} skipped — seeded accounts Clerk never issued\n`,
  );
} finally {
  await app.close();
  await client.end();
}
