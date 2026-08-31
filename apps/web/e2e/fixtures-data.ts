/**
 * The seed identities the Playwright journeys navigate by.
 *
 * **Why this is a literal rather than an import.** `apps/web` is not
 * `"type": "module"`, so Playwright transpiles every spec to CJS — and
 * `@vendor-marketplace/db` uses `import.meta`, which is a syntax error there.
 * Importing the database package into a browser spec would also couple a
 * black-box journey to the schema layer for the sake of one string.
 *
 * The copy is not left to rot: `fixtures-data.test.ts` runs under Vitest, which
 * *can* load the package, and asserts this still equals the seed's own value.
 * Drift fails that test by name rather than surfacing as a 404 inside an
 * unrelated journey.
 *
 * Demo-vendor identities deliberately are **not** here. Only the search and
 * discovery suite navigates to them, and that suite is deferred (see the
 * follow-up ticket) — a fixture nothing selects on is one nobody notices going
 * stale. The first thing that pass should do is add them here, with the slug
 * read from `DEMO_VENDORS` rather than assumed from the key: two of the four
 * demo vendors have a slug that differs from their key, which this guard caught.
 */

/** `seed:e2e`'s fixture vendor — the storefront both E2E accounts share. */
export const E2E_VENDOR_SLUG = 'e2e-test-studio';
