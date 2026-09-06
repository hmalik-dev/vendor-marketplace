import { createDatabase } from '../client.js';
import { loadEnv } from '../load-env.js';
import { seedReferenceData, seedUsCities } from '../seed.js';

/** Populates baseline reference data. Safe to run repeatedly. */
async function main(): Promise<void> {
  loadEnv();

  const { db, client } = createDatabase({ max: 1 });

  try {
    const result = await seedReferenceData(db);
    /*
     * After, and separately, because it is the slow half: ~35,600 rows against
     * two dozen. `seedReferenceData` is what the test harness calls, and it is
     * called once per suite — see its own note. This script is the one place
     * that wants the whole database, so this is where the two meet.
     */
    const citiesUpserted = await seedUsCities(db);
    console.log(
      `Seeded ${result.categoriesUpserted} categories, ${result.tagsUpserted} tags and ${citiesUpserted} US cities.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
