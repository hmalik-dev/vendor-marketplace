import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { NextConfig } from 'next';
import { assertWebEnv } from './src/config/env';
import { securityHeaders, shouldEnforceCsp } from './src/config/security-headers';

// Next.js only reads `.env` files beside the app, but the file developers edit
// is the one at the repository root — the same one `apps/api` loads explicitly.
// `dotenv` never overwrites a real process variable, so a value supplied by the
// deployment platform still wins.
loadDotenv({ path: path.resolve(process.cwd(), '../../.env'), quiet: true });

// Fail the build here rather than shipping a bundle with an undefined Clerk key
// baked in. `process.env` is complete at config time; after the build only the
// inlined NEXT_PUBLIC_* values remain, so this is the last place to check.
// On a deployment it also refuses every per-environment localhost default, so
// the values read below are the ones this build was configured with.
const webEnv = assertWebEnv();

/*
 * The origin uploads are served from. Public image URLs are absolute and
 * environment-specific, so the CSP's `img-src` is read from the same value
 * rather than guessed — and from the *browser-facing* row rather than the API's
 * `S3_PUBLIC_URL`, because the CSP governs what the browser may load and that
 * is the value the image `src` is built from.
 *
 * Neither of these carries a fallback: `assertWebEnv` has already supplied the
 * development default off a deployment and refused it on one. A `??` here would
 * put `http://localhost:4000` into a deployed bundle's `connect-src`.
 */
const imageOrigin = new URL(webEnv.NEXT_PUBLIC_S3_PUBLIC_URL).origin;
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

const nextConfig: NextConfig = {
  /*
   * Next infers the workspace root from the nearest lockfile, and a stray
   * `package-lock.json` in the home directory made it guess `/Users/humza` —
   * warning on every build and, worse, tracing standalone output from there.
   * Pinned to the repo root, which is two levels up from `apps/web`.
   */
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),

  /*
   * `next dev` and `next build` both write `.next`, so a build run against a
   * live dev server leaves it serving a half-replaced manifest and failing
   * with `Cannot find module for page: /_document`. Giving dev its own
   * directory makes the two independent; CI only ever runs the build, so it
   * is unaffected either way.
   */
  ...(isProduction ? {} : { distDir: '.next-dev' }),

  async headers() {
    return [
      {
        // Every route, including the API proxy routes and static assets: a
        // header that only covers pages leaves the interesting paths bare.
        source: '/:path*',
        headers: securityHeaders({
          apiOrigin,
          imageOrigin,
          allowEval: !isProduction,
          enforceCsp: shouldEnforceCsp({
            cspEnforce: process.env.CSP_ENFORCE,
            nodeEnv: process.env.NODE_ENV,
          }),
          https: isProduction,
        }),
      },
    ];
  },
};

export default nextConfig;
