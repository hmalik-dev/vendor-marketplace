import { createDatabase } from '../client.js';
import { loadEnv } from '../load-env.js';
import { clearDemoData, seedDemoData } from '../seed-demo.js';
import { assertSafeTarget } from './safe-target.js';

/**
 * Populates the fully-featured demo marketplace. Idempotent, and deterministic
 * for a fixed clock. Pass `--clear` to remove everything the seed owns and stop.
 *
 * Needs no Clerk or Stripe credentials: every identity is a local row under the
 * `seed_demo_` prefix, and the Stripe ids are demo strings that no API is asked
 * about. That is deliberate — the seed has to work on a laptop with no external
 * keys configured at all.
 */
async function main(): Promise<void> {
  loadEnv();

  /*
   * This seed fabricates admins, vendors and paid bookings. None of that
   * belongs in a database holding real accounts, so the target is refused
   * before a connection is opened.
   */
  assertSafeTarget('demo marketplace data');

  const clearOnly = process.argv.includes('--clear');
  const { db, client } = createDatabase({ max: 1 });

  try {
    if (clearOnly) {
      await clearDemoData(db);
      console.log('Removed the demo marketplace: every row under the seed_demo_ prefix.');
      return;
    }

    const startedAt = Date.now();
    const result = await seedDemoData(db);
    const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

    console.log(
      `Seeded ${result.vendorsUpserted} vendors across every category, ` +
        `${result.packagesUpserted} packages, ${result.portfolioItemsUpserted} portfolio items, ` +
        `${result.usersUpserted} accounts, ${result.requestsUpserted} booking requests, ` +
        `${result.bookingsUpserted} bookings, ${result.conversationsUpserted} conversations, ` +
        `${result.messagesUpserted} messages, ${result.reviewsUpserted} reviews, ` +
        `${result.notificationsUpserted} notifications and ` +
        `${result.availabilityRowsUpserted} calendar dates in ${elapsedSeconds}s.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Demo seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
