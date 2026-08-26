import { createDatabase } from '../client.js';
import { loadEnv } from '../load-env.js';
import { seedCategories } from '../seed.js';

/** Populates baseline reference data. Safe to run repeatedly. */
async function main(): Promise<void> {
  loadEnv();

  const { db, client } = createDatabase({ max: 1 });

  try {
    const result = await seedCategories(db);
    console.log(`Seeded ${result.categoriesUpserted} categories.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
