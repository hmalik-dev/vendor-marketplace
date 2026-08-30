export * from './client.js';
export { loadEnv } from './load-env.js';
export * from './schema/index.js';
export { seedCategories, seedReferenceData, seedTags, type SeedResult } from './seed.js';

/**
 * The demo dataset's stable identifiers.
 *
 * Exported from the barrel because the Playwright suites in #340 are the whole
 * reason the ids are derived rather than random — a consumer that cannot reach
 * `demoVendorProfileId` re-implements the SHA-1 construction instead, and then
 * the id scheme has two implementations that drift.
 */
export { DEMO_VENDORS, type DemoVendorSeed } from './demo-seed-data.js';
export { demoVendorProfileId } from './seed-demo.js';
