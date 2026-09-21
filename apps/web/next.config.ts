import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import { releaseIdentifier } from '@vendor-marketplace/shared/env';
import { errorIngestOrigin, sentryBuildOptions } from './src/config/error-reporting';
import { assertWebEnv, servesOverTls } from './src/config/env';
import {
  DEVICE_SIZES,
  IMAGE_MINIMUM_CACHE_TTL,
  IMAGE_QUALITY,
  IMAGE_SIZES,
  imageRemotePatterns,
} from './src/config/image-optimizer';
import {
  CSP_NONCE_PLACEHOLDER,
  contentSecurityPolicy,
  cspHeaderName,
  securityHeaders,
  shouldEnforceCsp,
} from './src/config/security-headers';

// Next.js only reads `.env` files beside the app, but the file developers edit
// is the one at the repository root — the same one `apps/api` loads explicitly.
// `dotenv` never overwrites a real process variable, so a value supplied by the
// deployment platform still wins.
loadDotenv({ path: path.resolve(process.cwd(), '../../.env'), quiet: true });

// Fail the build here rather than shipping a bundle with an undefined Neon Auth
// setting baked in. `process.env` is complete at config time; after the build only the
// inlined NEXT_PUBLIC_* values remain, so this is the last place to check.
// On a deployment it also refuses every per-environment localhost default, so
// the values read below are the ones this build was configured with.
const webEnv = assertWebEnv();

/*
 * The origin uploads are served from. Public image URLs are absolute and
 * environment-specific, so the CSP's `img-src` is read from the same value
 * rather than guessed — and from the *browser-facing* row rather than the API's
 * `STORAGE_PUBLIC_URL`, because the CSP governs what the browser may load and that
 * is the value the image `src` is built from.
 *
 * Neither of these carries a fallback: `assertWebEnv` has already supplied the
 * development default off a deployment and refused it on one. A `??` here would
 * put `http://localhost:4000` into a deployed bundle's `connect-src`.
 */
const imageOrigin = new URL(webEnv.NEXT_PUBLIC_STORAGE_PUBLIC_URL).origin;
const apiOrigin = webEnv.NEXT_PUBLIC_API_URL;

/*
 * Report-only in development, enforced in production.
 *
 * The policy has been driven through sign-in, sign-up, search and an upload in
 * a real browser, which is what `40-states.md`'s "verify before promoting"
 * means here — but a developer running an unusual local tool should get a
 * console report rather than a broken page.
 */
const isProduction = process.env.NODE_ENV === 'production';

/*
 * Whether to advertise TLS — HSTS and the CSP's `upgrade-insecure-requests`.
 * Read from this app's own public origin rather than from `NODE_ENV`, which
 * `next start` sets on a laptop as readily as on a release; see
 * `servesOverTls` for the round trip that cost. Distinct from `isProduction`
 * above, which still decides the things that really are about the build:
 * `distDir` and webpack's `unsafe-eval`.
 */
const servesTls = servesOverTls();

/*
 * The release this bundle is — the commit the deploy workflow set, or the
 * platform's. Inlined for the browser, the server and the edge alike, and
 * handed to the source-map upload, so an error and the maps it resolves
 * against name one commit.
 */
const release = releaseIdentifier();

/*
 * The CSP needs a nonce per request, so it is set by `src/middleware.ts`, not
 * by `headers()`. The policy is built here, where the validated origins are, as
 * a template carrying `CSP_NONCE_PLACEHOLDER`; it is inlined below and the
 * middleware swaps in a fresh nonce for each response.
 */
const cspEnforced = shouldEnforceCsp({
  cspEnforce: process.env.CSP_ENFORCE,
  nodeEnv: process.env.NODE_ENV,
});
const cspOrigins = {
  apiOrigin,
  imageOrigin,
  errorIngestOrigin: errorIngestOrigin(webEnv.NEXT_PUBLIC_SENTRY_DSN),
  allowEval: !isProduction,
  https: servesTls,
};
const cspTemplate = contentSecurityPolicy({ ...cspOrigins, nonce: CSP_NONCE_PLACEHOLDER });
const cspBaseline = contentSecurityPolicy({ ...cspOrigins, nonce: null });

const nextConfig: NextConfig = {
  /*
   * Next infers the workspace root from the nearest lockfile, and a stray
   * `package-lock.json` in the home directory made it guess `/Users/humza` —
   * warning on every build and, worse, tracing standalone output from there.
   * Pinned to the repo root, which is two levels up from `apps/web`.
   */
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),

  /*
   * `DEPLOY_ENV` is a server-only registry row, so the browser bundle receives
   * it here: the validated value, inlined at build. A deployment refuses to build
   * without it, so there the client's Sentry `environment` is the tier the
   * server and the API report.
   */
  env: {
    NEXT_PUBLIC_SENTRY_RELEASE: release ?? '',
    NEXT_PUBLIC_DEPLOY_ENV: webEnv.DEPLOY_ENV,
    CSP_TEMPLATE: cspTemplate,
    CSP_HEADER_NAME: cspHeaderName(cspEnforced),
  },

  /*
   * The legal copy is read off disk at build time, and file tracing cannot see
   * a `readFileSync` behind a `path.join`. Without this the three pages build
   * locally and throw on the deployment, which is the worst place to find out:
   * the footer links to them from every page and Stripe Connect onboarding asks
   * for two of the URLs.
   */
  outputFileTracingIncludes: { '/**': ['./content/legal/**/*'] },

  /*
   * `next dev` and `next build` both write `.next`, so a build run against a
   * live dev server leaves it serving a half-replaced manifest and failing
   * with `Cannot find module for page: /_document`. Giving dev its own
   * directory makes the two independent; CI only ever runs the build, so it
   * is unaffected either way.
   */
  ...(isProduction ? {} : { distDir: '.next-dev' }),

  /*
   * Uploads are fetched from Neon's storage host once per image and width, then
   * served from the optimizer's cache (VEN-456). `img-src` still lists the
   * storage origin: the browser talks to `'self'` for an optimized image, but a
   * URL the optimizer does not own is served raw and needs it.
   */
  images: {
    remotePatterns: imageRemotePatterns(webEnv.NEXT_PUBLIC_STORAGE_PUBLIC_URL),
    minimumCacheTTL: IMAGE_MINIMUM_CACHE_TTL,
    qualities: [IMAGE_QUALITY],
    deviceSizes: DEVICE_SIZES,
    imageSizes: IMAGE_SIZES,
  },

  async headers() {
    return [
      {
        // Every route, including the API proxy routes and static assets: a
        // header that only covers pages leaves the interesting paths bare.
        // The CSP is the exception: it is per-request, see `src/middleware.ts`.
        source: '/:path*',
        headers: securityHeaders({ https: servesTls }),
      },
      {
        /*
         * The middleware skips `/_next`, so its assets would carry no CSP. This
         * is the nonce-free baseline for them, built from the same origins as
         * the per-request policy — which is also why `pnpm preflight` reads the
         * baked `connect-src` and `img-src` back out of the routes manifest.
         */
        source: '/_next/:path*',
        headers: [{ key: cspHeaderName(cspEnforced), value: cspBaseline }],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, sentryBuildOptions(process.env, release));
