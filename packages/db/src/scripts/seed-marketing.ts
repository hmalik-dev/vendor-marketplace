import { createDatabase } from '../client.js';
import { loadEnv } from '../load-env.js';
import { clearMarketingData, seedMarketingData } from '../seed-marketing.js';
import { assertSafeTarget } from './safe-target.js';

/**
 * Populates the demo marketplace used for marketing screenshots. Idempotent.
 * Pass `--clear` to remove everything the seed owns and stop.
 */
async function main(): Promise<void> {
  loadEnv();
  assertSafeTarget('demo marketing data');

  const clearOnly = process.argv.includes('--clear');
  const { db, client } = createDatabase({ max: 1 });

  try {
    if (clearOnly) {
      await clearMarketingData(db);
      console.log('Removed the demo marketing vendors and their booking history.');
      return;
    }

    const result = await seedMarketingData(db);
    console.log(
      `Seeded ${result.vendorsUpserted} vendors, ${result.packagesUpserted} packages, ` +
        `${result.customersUpserted} customers, ${result.bookingsCreated} completed bookings, ` +
        `${result.reviewsCreated} reviews and ${result.availabilityRowsCreated} calendar dates.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Marketing seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
