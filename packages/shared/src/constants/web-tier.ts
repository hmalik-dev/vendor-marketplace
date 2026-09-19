/**
 * How the web app tells the API which visitor a server-rendered call is for.
 *
 * On the deployed topology every server-rendered page reaches the API from the
 * web platform's own egress address, so `request.ip` is the same for every
 * visitor. The web tier forwards the visitor's address in {@link VISITOR_IP_HEADER}
 * and proves it is the web tier with {@link WEB_TIER_KEY_HEADER} — a header
 * alone is one any caller can write, and trusting it bare would hand the
 * rate-limit key to whoever is being limited.
 */
export const VISITOR_IP_HEADER = 'x-visitor-ip';
export const WEB_TIER_KEY_HEADER = 'x-web-tier-key';
