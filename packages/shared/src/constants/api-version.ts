/**
 * The path every API route is served under, except the ones something outside
 * the app calls by a fixed address: `/health` and `/ready` (the host's probes
 * and the release gate) and `/webhooks/*` (URLs registered in the Stripe and
 * Resend consoles). VEN-650.
 *
 * Browsers call the API directly — streams, uploads — so a breaking change to
 * a route can only ship beside the old one, and a version in the path is what
 * lets the two coexist while tabs opened on the old release are still live.
 */
export const API_VERSION_PREFIX = '/v1';
