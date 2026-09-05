import {
  deploymentPlatform,
  isDeployedBuild,
  registrySchemaShape,
} from '@vendor-marketplace/shared/env';
import { z } from 'zod';
import { LOCAL_WEB_ORIGIN } from './public-env';

/**
 * Capabilities apps/web reads.
 *
 * `storage` and `stripe` are here because the browser bundle reads a row from
 * each and a build that omitted them shipped anyway: every stored-key image
 * resolved to `null` and rendered as the empty state, and checkout called
 * `loadStripe('')`, which Stripe.js rejects — a card field that never mounts
 * behind a Pay button that does nothing. Sentry joins in #15.
 */
const WEB_CAPABILITIES = ['core', 'auth', 'storage', 'stripe'] as const;

/**
 * Two value sets, chosen per build.
 *
 * `NODE_ENV` cannot pick between them: `next build` sets `NODE_ENV=production`
 * for a build on a laptop as readily as for a release. The platform building
 * the bundle can, and that is what `isDeployedBuild` reads — on Vercel the
 * per-environment rows must be supplied, so a bundle can no longer bake
 * `http://localhost:4000` in as its API origin and send every visitor's call
 * to their own machine.
 *
 * The stricter *production* set — live keys, https-only — stays with
 * `pnpm preflight --env production`: a preview deployment is a deployment, and
 * a live-mode Clerk key is the wrong value for one.
 */
const SCHEMAS = {
  baseline: z.object(
    registrySchemaShape({ consumer: 'web', capabilities: WEB_CAPABILITIES, target: 'baseline' }),
  ),
  deployed: z.object(
    registrySchemaShape({ consumer: 'web', capabilities: WEB_CAPABILITIES, target: 'deployed' }),
  ),
} as const;

export type WebEnv = z.infer<(typeof SCHEMAS)['baseline']>;

/**
 * Validates every variable apps/web reads. Called from `next.config.ts`, where
 * the full `process.env` is still available — after the build, only the inlined
 * `NEXT_PUBLIC_*` values survive.
 */
export function assertWebEnv(source: NodeJS.ProcessEnv = process.env): WebEnv {
  const result = (isDeployedBuild(source) ? SCHEMAS.deployed : SCHEMAS.baseline).safeParse(source);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n  ');

    throw new Error(
      `Invalid web environment configuration:\n  ${problems}\n\nRun \`pnpm preflight\` for the fix for each one.`,
    );
  }

  return result.data;
}

/**
 * This app's own public origin, without a trailing slash.
 *
 * `metadataBase`, the sitemap and robots all build absolute URLs from it, and
 * it is the same `WEB_URL` the API allow-lists for CORS rather than a second
 * value that could disagree. `WEB_URL` accepts a comma-separated list, because
 * it doubles as that allow-list — the first entry is the canonical origin.
 *
 * **A deployed environment never falls back to localhost.** `WEB_URL` carries
 * a localhost default so a laptop needs no configuration, and that default
 * reached production: every `<loc>` in the sitemap, the `Host` in robots.txt
 * and every OG image URL pointed at `http://localhost:3000`, which makes the
 * sitemap useless to a crawler and renders every shared link as a blank card.
 * So when a platform announces the host, its own domain wins over a localhost
 * value —
 * whether that value was defaulted or set by hand, because a localhost
 * canonical on a public origin is never what was meant.
 */
export function siteOrigin(source: NodeJS.ProcessEnv = process.env): string {
  const configured = (source.WEB_URL ?? '').split(',')[0]?.trim().replace(/\/+$/, '') ?? '';
  const deployed = deploymentPlatform(source)?.origin;

  if (deployed && (!configured || configured.startsWith('http://localhost'))) {
    return deployed;
  }

  return configured || deployed || LOCAL_WEB_ORIGIN;
}
