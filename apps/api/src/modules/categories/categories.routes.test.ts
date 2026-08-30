import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';

/*
 * #316. `lane:up` used to migrate a fresh lane's database and stop — it never
 * ran `pnpm db:seed`, so every lane came up with 0 categories and 0 tags.
 * Every vendor and search surface reads categories to render at all, so a
 * lane in that state 404s and redirects to profile creation on the very first
 * page a browser pass opens, with nothing in the response saying why.
 *
 * `createTestHarness` seeds reference data through the exact function
 * `pnpm db:seed` runs (`seedReferenceData`), so this exercises the same path
 * a freshly provisioned lane's database goes through — not a fixture insert
 * standing in for it.
 */
describe('GET /categories', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('answers non-empty once the database has been seeded, the way a fresh lane is', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/categories' });

    expect(response.statusCode).toBe(200);

    const categories = response.json();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]).toMatchObject({ id: expect.any(String), name: expect.any(String) });
  });

  it('is reachable with no authentication, since every vendor surface reads it before sign-in', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/categories' });

    expect(response.statusCode).toBe(200);
  });
});
