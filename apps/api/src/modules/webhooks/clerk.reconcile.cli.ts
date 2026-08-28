import { createClerkClient } from '@clerk/backend';
import { createDatabase, loadEnv } from '@vendor-marketplace/db';
import { parseEnv } from '../../config/env.js';
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

try {
  const summary = await reconcileClerkUsers(db, clerk.users, { dryRun });

  process.stdout.write(
    `${dryRun ? 'Would reconcile' : 'Reconciled'} ${summary.examined} user(s) against Clerk\n` +
      `  ${summary.updated} ${dryRun ? 'would be corrected' : 'corrected'}\n` +
      `  ${summary.deleted} ${dryRun ? 'would be retired' : 'retired'} (deleted in Clerk)\n` +
      `  ${summary.unchanged} already in agreement\n` +
      `  ${summary.skipped} skipped — seeded accounts Clerk never issued\n`,
  );
} finally {
  await client.end();
}
