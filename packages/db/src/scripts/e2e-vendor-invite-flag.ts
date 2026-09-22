/**
 * The env var that opts a lane into the vendor invite gate (VEN-406, VEN-584).
 *
 * A plain process env var rather than a `.env.e2e.local` key: it is a
 * lane-shaped toggle, not an account credential, so it belongs beside the
 * other ambient settings (`STRIPE_SECRET_KEY`, `WEB_URL`) a lane's own env
 * already supplies —
 *
 *   pnpm lane:exec <id> -- env E2E_VENDOR_INVITE_ONLY=true pnpm db:seed:e2e
 *
 * needs no edit to the gitignored file that holds the fixture identities.
 */
export const E2E_VENDOR_INVITE_ONLY_KEY = 'E2E_VENDOR_INVITE_ONLY';

/** `undefined` when unset — the seed then leaves the switch exactly as it is. */
export function readVendorInviteOnlyFlag(
  env: NodeJS.ProcessEnv = process.env,
): boolean | undefined {
  const raw = env[E2E_VENDOR_INVITE_ONLY_KEY];

  if (raw === undefined) {
    return undefined;
  }

  if (raw !== 'true' && raw !== 'false') {
    throw new Error(`${E2E_VENDOR_INVITE_ONLY_KEY} must be "true" or "false" if set, not ${raw}.`);
  }

  return raw === 'true';
}
