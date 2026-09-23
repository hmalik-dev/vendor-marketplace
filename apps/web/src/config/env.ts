import {
  deploymentOrigin,
  deploymentPlatform,
  isDeployedBuild,
  isLiveStripeKey,
  liveKeyOutsideProduction,
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
 * behind a Pay button that does nothing. `sentry` joined in VEN-397: a deployed
 * build with no DSN would ship a web app that reports none of its errors.
 */
const WEB_CAPABILITIES = ['core', 'auth', 'storage', 'stripe', 'sentry'] as const;

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
 * a live-mode key is the wrong value for one.
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

  return assertStripeMode(result.data, source);
}

/**
 * A live key needs `DEPLOY_ENV=production`, and the two Stripe keys must be the
 * same mode wherever a build can see both (CI, a deploy preflight): a live
 * secret beside a test publishable key charges real cards through a checkout
 * that was never meant to. Only production-ness is enforced, never the reverse —
 * the friends beta runs as production on test keys.
 */
function assertStripeMode(env: WebEnv, source: NodeJS.ProcessEnv): WebEnv {
  const secret = source.STRIPE_SECRET_KEY?.trim() || undefined;
  const publishable = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const problems = [
    liveKeyOutsideProduction('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', publishable, env.DEPLOY_ENV),
    liveKeyOutsideProduction('STRIPE_SECRET_KEY', secret, env.DEPLOY_ENV),
    secret !== undefined && isLiveStripeKey(secret) !== isLiveStripeKey(publishable)
      ? 'STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY are in different Stripe modes'
      : null,
  ].filter((problem): problem is string => problem !== null);

  if (problems.length > 0) {
    throw new Error(`Invalid web environment configuration:\n  ${problems.join('\n  ')}`);
  }

  return env;
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
 *
 * **The build's answer is the answer (VEN-606).** `next.config.ts` resolves
 * this once and inlines it as `SITE_ORIGIN`, and every later call returns that.
 * Staging built with its own `WEB_URL` and ran without it, so robots.txt named
 * staging while the ISR sitemap, the canonicals and `og:url` fell back to
 * Vercel's production domain. One resolution, at build, cannot disagree with
 * itself.
 */
export function siteOrigin(
  /*
   * The literal `process.env.SITE_ORIGIN` is what Next inlines, so the default
   * names it explicitly: a key read off a copy of `process.env` is not.
   */
  source: NodeJS.ProcessEnv = { ...process.env, SITE_ORIGIN: process.env.SITE_ORIGIN },
): string {
  const built = source.SITE_ORIGIN?.trim();

  if (built) {
    return built;
  }

  const configured = (source.WEB_URL ?? '').split(',')[0]?.trim().replace(/\/+$/, '') ?? '';
  const deployed = deploymentPlatform(source)?.origin;

  if (deployed && (!configured || configured.startsWith('http://localhost'))) {
    return deployed;
  }

  return configured || deployed || LOCAL_WEB_ORIGIN;
}

/**
 * Whether this origin is **actually served over TLS** — the question HSTS and
 * the CSP's `upgrade-insecure-requests` are both really asking.
 *
 * `NODE_ENV` cannot answer it, and answering it with `NODE_ENV` is the defect
 * #452 measured. `next start` runs a laptop with `NODE_ENV=production`, so a
 * plain `http://localhost:<port>` origin advertised both headers — and while
 * Chromium exempts a potentially-trustworthy host like `localhost` from
 * `upgrade-insecure-requests` for the *initial* request, it applies the
 * directive to a **redirect target** regardless. So every 3xx that a `fetch`
 * followed was retried against `https://localhost:<port>`, failed
 * `ERR_SSL_PROTOCOL_ERROR` and fell back to http: one dead round trip and a
 * standing console error behind every role bounce, from a redirect whose own
 * `Location` was correct. Measured directly — HSTS, sent over the same plain
 * origin, is ignored by the browser and changes nothing.
 *
 * **Read only from what the platform announces**, never from `WEB_URL`, and
 * that restriction is load-bearing twice over.
 *
 * *It is what keeps the answer cacheable.* `headers()` is evaluated by
 * `next build` and frozen into `routes-manifest.json`, so whatever decides it
 * has to be part of what Turborepo's cache key describes. `PLATFORM_ENV_KEYS`
 * are in `globalEnv` (hashed) for exactly that reason; `WEB_URL` is in
 * `globalPassThroughEnv` (unhashed). Deciding on `WEB_URL` left the hash
 * identical for an `http://localhost` build and an `https://` one — measured —
 * so a warm cache replayed the wrong manifest **in both directions**: #452's
 * own defect served again from cache with the fix in the tree, and a TLS
 * deployment shipped with no HSTS. `CSP_ENFORCE` was moved into the hashed set
 * in #396 for the identical reason; this reaches the same end without a
 * registry change.
 *
 * *It is also what leaves one authority.* `WEB_URL` and the announced origin
 * can disagree, and letting both speak needs a rule about which wins — which is
 * the scheme being decided twice and agreeing by luck. The platform's answer is
 * the only one, and an operator who declares `DEPLOYMENT_ORIGIN=http://…` is
 * believed: a proxy-terminated deployment's public origin is `https://`, and
 * declaring it is how it says so.
 *
 * A **deployed build** that announces no TLS origin throws rather than quietly
 * baking an artefact with no HSTS in it — `deployment.ts`'s own instruction,
 * *derive it from something the platform sets, or throw*. `isDeployedBuild`,
 * not `isDeployedRuntime`, which is true for `pnpm build` on a laptop and would
 * refuse the very case this exists to allow.
 */
export function servesOverTls(source: NodeJS.ProcessEnv = process.env): boolean {
  const servesTls = deploymentOrigin(source)?.startsWith('https://') === true;

  if (!servesTls && isDeployedBuild(source)) {
    throw new Error(
      'This deployment announced no https origin, so it would ship without HSTS. ' +
        'Set DEPLOYMENT_ORIGIN to the origin it is served at.',
    );
  }

  return servesTls;
}
