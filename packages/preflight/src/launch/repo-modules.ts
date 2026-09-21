import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SeedMarkers } from './database.js';
import { isString } from './http.js';

const STRIPE_ROUTES = 'apps/api/src/modules/webhooks/stripe.routes.ts';
const STRIPE_GATEWAY = 'apps/api/src/lib/stripe.ts';
const MARKETING_SEED = 'packages/db/src/seed-marketing.ts';
const DEMO_SEED_DATA = 'packages/db/src/demo-seed-data.ts';
const E2E_SEED = 'packages/db/src/seed-e2e.ts';

/**
 * Loads another workspace's source module at runtime.
 *
 * The specifier is computed so `tsc` does not pull that workspace's source
 * into this package's program, and no package dependency points from
 * `packages/` back at `apps/`. `tsx` and Vitest resolve the TypeScript, and the
 * module's own imports resolve from its own workspace. The point is that the
 * expected values are the ones the code runs with, not a second list here.
 */
async function importRepoModule(
  repoRoot: string,
  relativePath: string,
): Promise<Record<string, unknown>> {
  return (await import(pathToFileURL(path.join(repoRoot, relativePath)).href)) as Record<
    string,
    unknown
  >;
}

function stringExport(module: Record<string, unknown>, name: string, source: string): string {
  const value = module[name];

  if (!isString(value) || value.length === 0) {
    throw new Error(`${source} no longer exports ${name}`);
  }

  return value;
}

export async function loadHandledStripeEvents(repoRoot: string): Promise<readonly string[]> {
  const module = await importRepoModule(repoRoot, STRIPE_ROUTES);
  const handled = module.HANDLED_STRIPE_EVENT_TYPES;

  if (!Array.isArray(handled) || handled.length === 0 || !handled.every(isString)) {
    throw new Error(`${STRIPE_ROUTES} no longer exports HANDLED_STRIPE_EVENT_TYPES`);
  }

  return handled;
}

export async function loadStripeApiVersion(repoRoot: string): Promise<string> {
  return stringExport(
    await importRepoModule(repoRoot, STRIPE_GATEWAY),
    'STRIPE_API_VERSION',
    STRIPE_GATEWAY,
  );
}

export async function loadSeedMarkers(repoRoot: string): Promise<SeedMarkers> {
  const [marketing, demo, e2e] = await Promise.all([
    importRepoModule(repoRoot, MARKETING_SEED),
    importRepoModule(repoRoot, DEMO_SEED_DATA),
    importRepoModule(repoRoot, E2E_SEED),
  ]);

  return {
    marketingPrefix: stringExport(marketing, 'MARKETING_SEED_PREFIX', MARKETING_SEED),
    demoPrefix: stringExport(demo, 'DEMO_SEED_PREFIX', DEMO_SEED_DATA),
    e2eVendorSlug: stringExport(e2e, 'E2E_VENDOR_SLUG', E2E_SEED),
  };
}
