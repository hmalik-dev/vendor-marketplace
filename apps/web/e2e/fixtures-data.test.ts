import { DEMO_VENDORS, E2E_VENDOR_SLUG as SEEDED_E2E_VENDOR_SLUG } from '@vendor-marketplace/db';
import { describe, expect, it } from 'vitest';

import { E2E_VENDOR_SLUG } from './fixtures-data.js';

/**
 * The drift guard.
 *
 * The Playwright specs cannot import `@vendor-marketplace/db` (CJS
 * transpilation versus `import.meta`), so they navigate by a literal. This is
 * what makes that literal safe: it runs under Vitest, loads the real seed data,
 * and fails by name the moment the seed's value moves. Without it the failure
 * mode is the bad one — a renamed slug becomes a 404 inside a booking journey,
 * and the suite blames the feature.
 *
 * It earned its place on its first run, catching that the export it reads was
 * absent from the package's built output.
 */
describe('e2e fixture data agrees with the seeds', () => {
  it('uses the slug seed:e2e actually writes', () => {
    expect(
      SEEDED_E2E_VENDOR_SLUG,
      'the db package no longer exports E2E_VENDOR_SLUG',
    ).toBeDefined();
    expect(E2E_VENDOR_SLUG).toBe(SEEDED_E2E_VENDOR_SLUG);
  });

  /*
   * Not a fixture the suites use yet — it is the assumption a future search
   * suite would make. `key` and `slug` are separate fields on `DemoVendorSeed`,
   * and **two of the four differ** (`silver-alder` is slugged
   * `silver-alder-studio`, `copper-spoon` is `copper-spoon-catering`). Pinning
   * it here means the next pass reads the fact instead of rediscovering it as a
   * 404.
   */
  it('records that a demo vendor key is not usable as a slug', () => {
    const divergent = DEMO_VENDORS.filter((vendor) => vendor.key !== vendor.slug);

    expect(
      divergent.length,
      'every demo vendor key now equals its slug — a suite may navigate by key, ' +
        'and the warning in fixtures-data.ts should be updated',
    ).toBeGreaterThan(0);
  });

  it('gives every demo vendor a non-empty slug to navigate by', () => {
    for (const vendor of DEMO_VENDORS) {
      expect(vendor.slug, `demo vendor "${vendor.key}" has no slug`).toBeTruthy();
    }
  });
});
