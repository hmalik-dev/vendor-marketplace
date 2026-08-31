/**
 * Which origin the E2E suites drive.
 *
 * This deliberately **refuses to guess**. `scripts/e2e-base-url.mjs` — the
 * sibling that aims `pnpm e2e:auth` — falls back to `http://localhost:3000`,
 * which is right for signing in from the main checkout. It is wrong here: a
 * lane whose web server is on 3031 would run its whole suite against whatever
 * holds 3000, which is another session's server backed by the *shared*
 * database. Every assertion would pass or fail for reasons that have nothing to
 * do with the lane's code, and nothing in the output would say so.
 *
 * A harness that silently targets the wrong server is worse than one that will
 * not start, so an unset environment is an error with the fix in its message.
 */

/** `${BASE}/path` must not become `//path` when the origin is set by hand. */
function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * `WEB_URL` doubles as the API's CORS allow-list, so it is a comma-separated
 * list — `packages/shared/src/env/registry.ts` types it as `HTTP_URL_LIST`.
 * Handing the whole string to Playwright's `baseURL` yields `Invalid URL`.
 */
function firstOrigin(value: string): string {
  return withoutTrailingSlash(value.split(',')[0]!.trim());
}

/**
 * Typed as a plain record rather than `NodeJS.ProcessEnv` so a test can pass an
 * object literal without a cast — `ProcessEnv` carries an index signature that
 * literals do not satisfy, and casting in every test would blunt the checking
 * this signature exists to provide.
 */
export function resolveE2EBaseUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.E2E_BASE_URL?.trim();
  if (explicit) {
    return withoutTrailingSlash(explicit);
  }

  const webUrl = env.WEB_URL?.trim();
  if (webUrl) {
    return firstOrigin(webUrl);
  }

  throw new Error(
    'E2E base URL is not set. Run the suites through the lane so the port is ' +
      'resolved for you:\n' +
      '  pnpm lane:exec <ticket> -- pnpm --filter @vendor-marketplace/web test:e2e\n' +
      'or set E2E_BASE_URL to aim at a deployed origin. Refusing to default to ' +
      "http://localhost:3000, which is another lane's server.",
  );
}
