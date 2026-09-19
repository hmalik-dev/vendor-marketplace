import { createDatabase, createNeonAuthDirectory, loadEnv } from '@vendor-marketplace/db';
import { canonicalWebOrigin, parseEnv } from '../../config/env.js';
import { createS3Storage } from '../../lib/storage.js';
import { bookingContextFor } from '../payments/payments.service.js';
import { buildServer } from '../../server.js';
import { reconcileAuthUsers } from './auth-sync.reconcile.js';

/**
 * Runs the reconciliation pass against the configured database and Neon Auth
 * branch.
 *
 * This is the sync, not a repair tool (VEN-448): Neon Auth sends no update or
 * delete event, so a changed name or address and a deleted identity reach the
 * local `users` row only when this runs. Read-mostly and idempotent — running
 * it when nothing has drifted writes nothing at all. `--dry-run` reports the
 * drift without correcting it.
 */
const dryRun = process.argv.includes('--dry-run');

loadEnv();

const env = parseEnv();

if (env.NEON_AUTH_DATABASE_URL === undefined) {
  throw new Error(
    'NEON_AUTH_DATABASE_URL is not set, so there is no identity source to reconcile against. ' +
      'Run `pnpm preflight` for the fix.',
  );
}

const { db, client } = createDatabase();
const directory = createNeonAuthDirectory(env.NEON_AUTH_DATABASE_URL);

/*
 * The real instance, never listened on (#433).
 *
 * Retiring a user refunds their bookings, so this pass needs Stripe, the event
 * hub and the mailer — and assembling those here by hand is how the repair path
 * comes to hold a different client from the live one. The payout sweep is off
 * because a repair pass must move no money it was not asked to.
 */
const app = await buildServer({
  env,
  db,
  storage: createS3Storage(env),
  payoutSweepIntervalMs: 0,
});

try {
  const summary = await reconcileAuthUsers(
    bookingContextFor(app, app.log, canonicalWebOrigin(env)),
    directory,
    { dryRun },
    app.clock(),
  );

  process.stdout.write(
    `${dryRun ? 'Would reconcile' : 'Reconciled'} ${summary.examined} user(s) against Neon Auth\n` +
      `  ${summary.updated} ${dryRun ? 'would be corrected' : 'corrected'}\n` +
      `  ${summary.deleted} ${dryRun ? 'would be retired' : 'retired'} (deleted in Neon Auth)\n` +
      `  ${summary.diverged} still disagree — the address is held by another account\n` +
      `  ${summary.unchanged} already in agreement\n` +
      `  ${summary.skipped} skipped — seeded accounts Neon Auth never issued\n`,
  );
} finally {
  await app.close();
  await directory.close();
  await client.end();
}
