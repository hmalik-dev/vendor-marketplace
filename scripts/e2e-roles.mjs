/**
 * Which roles `pnpm e2e:auth` signs in as, and when it is allowed to decide
 * that for itself.
 *
 * Split out of `e2e-auth.mjs` for the same reason `resolveBaseUrl` was: that
 * script launches a browser and signs in at module scope, so a module that
 * exported this from there could not be imported by a test — or by anything
 * else — without driving three sign-ins under the importer's own origin and
 * taking its exit code with it.
 */

/**
 * Every role `db:seed:e2e` provisions an account for.
 *
 * It read `['customer', 'vendor']` until #392 — it predated the persistent
 * admin account (D27) — so `pnpm e2e:auth` with no argument refreshed two of
 * three sessions and every lane inherited the main checkout's expired
 * `.auth/admin.json`. The failure looks nothing like its cause: `/admin` enters
 * Clerk's handshake loop and reads as the console being broken rather than as
 * the one role the refresh skipped.
 */
export const DEFAULT_ROLES = ['customer', 'vendor', 'admin'];

/**
 * A loopback origin, by parsed hostname.
 *
 * Never a substring test: `localhost.example.com` and
 * `https://evil/?x=localhost` both contain the word, and that exact bypass is
 * already recorded against the Clerk webhook guard.
 */
export function isLocalOrigin(base) {
  let hostname;
  try {
    ({ hostname } = new URL(base));
  } catch {
    return false;
  }

  // `new URL` keeps IPv6 hosts in brackets.
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
}

/**
 * The roles to mint, or the reason for refusing.
 *
 * **A deployed origin never gets a default.** `resolveBaseUrl` puts
 * `E2E_BASE_URL` at the top of its chain precisely so a run can be aimed at a
 * deployed origin, and `docs/pre-launch.md` records that production still
 * authenticates against the *same* Clerk development instance as localhost — so
 * the E2E passwords work there and `admin` carries authority over the
 * production console. Minting that by default, into a file `.worktreeinclude`
 * copies into every lane and every browser agent loads by filename without
 * knowing which origin produced it, is the repo law "a development default must
 * never be able to reach production" exactly.
 *
 * So off localhost the roles must be named on argv. Signing in as admin against
 * a deployed origin stays possible — it just has to be somebody's decision
 * rather than the default's.
 */
export function resolveRoles(argvRoles, base) {
  if (argvRoles.length > 0) {
    return { roles: argvRoles, explicit: true };
  }

  if (!isLocalOrigin(base)) {
    return {
      roles: [],
      explicit: false,
      refusal:
        `Refusing to pick roles for ${base}, which is not a loopback origin.\n` +
        `  That origin shares its Clerk instance with production, so a default here would\n` +
        `  mint a session with real authority and persist it to .auth/ for every lane.\n` +
        `  Name the roles explicitly if that is what you mean: pnpm e2e:auth customer vendor`,
    };
  }

  return { roles: DEFAULT_ROLES, explicit: false };
}
