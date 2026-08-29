/**
 * Where `pnpm e2e:auth` should sign in.
 *
 * Split out of `e2e-auth.mjs` so it can be tested without launching a browser:
 * that script signs in at import time, so importing it from a test would drive
 * Playwright rather than assert on a string.
 *
 * `pnpm lane:exec <n> --` puts the lane's `WEB_URL` and `WEB_PORT` in the child
 * environment, which is the only channel that reaches a script the lane runs.
 * Without consulting them a lane authenticates against whatever holds port
 * 3000 — the main checkout's server, backed by the *shared* database — and
 * writes that session into the lane's `.auth/`, so every later browser pass in
 * the lane loads a storage state minted against the wrong origin and the wrong
 * data.
 */

/** `${BASE}/sign-in` must not become `//sign-in` when the origin is set by hand. */
function withoutTrailingSlash(url) {
  return url.replace(/\/+$/, '');
}

/**
 * `WEB_URL` doubles as the API's CORS allow-list, so it is a *comma-separated
 * list* — `packages/shared/src/env/registry.ts` types it as `HTTP_URL_LIST`.
 * Passing the whole string to `page.goto` throws `Invalid URL` and fails every
 * role. Sign in against the first origin it names.
 */
function firstOrigin(value) {
  return withoutTrailingSlash(value.split(',')[0].trim());
}

/**
 * Resolves the origin to sign in against, most explicit source first.
 *
 * `E2E_BASE_URL` stays the top of the chain because it is how a run is aimed at
 * a deployed origin, which no lane variable can describe.
 */
export function resolveBaseUrl(env = process.env) {
  if (env.E2E_BASE_URL) {
    return withoutTrailingSlash(env.E2E_BASE_URL);
  }

  if (env.WEB_URL) {
    return firstOrigin(env.WEB_URL);
  }

  const port = Number(env.WEB_PORT);

  return `http://localhost:${Number.isInteger(port) && port > 0 && port <= 65535 ? port : 3000}`;
}
