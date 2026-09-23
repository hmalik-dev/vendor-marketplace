// When `pnpm e2e:auth` counts a sign-in as done, and which failures it retries.
//
// A separate module for the reason `e2e-roles.mjs` is one: `e2e-auth.mjs`
// launches a browser and signs in at module scope, so its decisions can only be
// tested from here.
//
// VEN-602: the step used to finish on the page *leaving* `/sign-in`. That is
// the post-sign-in navigation — `/after-sign-in`, then the role's home — and
// the customer's home is `/`, the landing page. On a CI run where `/` never
// finished rendering (the same runs whose journeys time out on `/` and
// `/accept-terms`, VEN-619), the customer was signed in and the step still
// failed after 30 seconds, while vendor and admin, whose homes rendered,
// passed. What the step exists to capture is the session: the provider's answer
// to `POST /api/auth/sign-in/email`, and the cookie that answer sets. Where the
// browser goes next is the journeys' business.
//
// The second failure is a throttle. Five sign-ins at once from one address —
// several processes minting sessions for the same shared identity — drew "Too
// many attempts" on one of them. Better Auth's default rule for sign-in is
// three per ten seconds per address, so a retry fifteen seconds later starts a
// fresh window. Only what a wait can change is retried: a throttle, an
// unreachable provider, a timeout. A wrong password or an unverified address
// answers the same way every time, and each refused try is charged to the
// shared account's failure budget, so those fail at once.

/**
 * The two names Neon Auth writes its session cookie under: `__Secure-` over
 * HTTPS, bare over plain HTTP. The set `apps/web/src/lib/auth/server.ts` keys
 * a session by, matched exactly for the same reason.
 */
export const SESSION_COOKIE_NAMES = new Set([
  '__Secure-neon-auth.session_token',
  'neon-auth.session_token',
]);

/** Whether a cookie list (Playwright's `context.cookies()` shape) holds a session. */
export function hasSessionCookie(cookies) {
  return cookies.some((cookie) => SESSION_COOKIE_NAMES.has(cookie.name) && cookie.value !== '');
}

/** An error `withRetry` rethrows at once: trying again cannot change its answer. */
function final(message) {
  return Object.assign(new Error(message), { final: true });
}

/**
 * Why the provider's answer to the sign-in POST is not a usable session, or
 * `null` when it is. Mirrors `signInWithEmail` in
 * `apps/web/src/lib/auth/auth-requests.ts`: the dev branch answers **200** for
 * an unverified address, with `user.emailVerified: false` and a session the API
 * refuses, so a 2xx alone is not enough — saving it would move the failure to
 * every journey's first API call.
 */
export function signInRefusal(status, body) {
  if (status >= 200 && status < 300) {
    return body?.user?.emailVerified === false
      ? final('the account signed in but its address is unverified; the API refuses that session')
      : null;
  }
  if (status === 429 || (status === 403 && body?.code === 'TOO_MANY_ATTEMPTS')) {
    return new Error(`the sign-in was throttled (${status})`);
  }
  if (status >= 500) {
    return new Error(`the sign-in service answered ${status}`);
  }
  return final(
    status === 403
      ? 'the sign-in was refused (403): the address is unverified'
      : `the sign-in was refused (${status}): check the password in .env.e2e.local`,
  );
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resolves once `readCookies()` returns a session cookie; throws once
 * `timeoutMs` has passed without one. `now` and `sleep` are test seams.
 */
export async function waitForSession(
  readCookies,
  { timeoutMs = 10_000, intervalMs = 250, now = Date.now, sleep = pause } = {},
) {
  const deadline = now() + timeoutMs;
  for (;;) {
    if (hasSessionCookie(await readCookies())) return;
    if (now() >= deadline) {
      throw new Error(`no Neon Auth session cookie was set within ${timeoutMs}ms of the sign-in`);
    }
    await sleep(intervalMs);
  }
}

/**
 * Runs `attempt(n)` until it resolves, at most `attempts` times, waiting
 * `backoffMs` between tries. An error marked `final` is rethrown at once. Every
 * caller's attempt must start from a clean slate — `e2e-auth.mjs` opens a fresh
 * browser context for each — so a retry never inherits the half-finished state
 * of the try before it. The last error is the one thrown.
 */
export async function withRetry(
  attempt,
  { attempts = 3, backoffMs = 15_000, sleep = pause, onRetry = () => {} } = {},
) {
  for (let n = 1; ; n++) {
    try {
      return await attempt(n);
    } catch (error) {
      if (error?.final || n >= attempts) throw error;
      onRetry(error, n);
      await sleep(backoffMs);
    }
  }
}

/**
 * Every `/_next/image` request the sign-in browser would make, answered in the
 * browser instead (VEN-655).
 *
 * The customer lands on `/`, and the context is closed as soon as the session
 * exists — mid-render, with the category art's first optimization in flight.
 * Under `next start`, a client that leaves before a cold optimization finishes
 * wedges that image for the life of the server, and this runs before the
 * suite's own warm-up (`apps/web/e2e/warm-image-optimizer.ts`) can fill the
 * cache. A route abort never reaches the server, so there is nothing to wedge.
 */
export const IMAGE_OPTIMIZER_PATTERN = /\/_next\/image\?/;

export async function keepOffTheImageOptimizer(context) {
  await context.route(IMAGE_OPTIMIZER_PATTERN, (route) => route.abort());
}
