import type { UserRole } from '@vendor-marketplace/shared';
import { safeReturnPath } from './return-path';

/** Where each role's own dashboard lives. */
export const DASHBOARD_PATH_BY_ROLE: Record<UserRole, string> = {
  /*
   * A customer has no dashboard and never did — their home is the list of
   * bookings they have made. #22b replaced the placeholder that used to sit
   * at `/customer/dashboard`.
   */
  customer: '/bookings',
  vendor: '/vendor/dashboard',
  /*
   * The operations console (#15). It was `/` until the console existed, with a
   * comment explaining that `/` was terminal *because there was no admin
   * surface* — the role bounce redirects here, so a destination that bounced
   * again would loop forever, and `/bookings` is gated by
   * `requireRole('customer')`.
   *
   * `/admin` is terminal for the same reason `/vendor/dashboard` is: it is
   * gated by `requireRole('admin')`, which this role passes, so the bounce
   * lands and stops.
   */
  admin: '/admin',
};

/**
 * Where each role *starts* after authenticating, which is not the same question
 * as where its dashboard lives. A customer's first move is to browse vendors,
 * so sign-in drops them on the marketplace home rather than a dashboard they
 * did not ask for; a vendor has no use for a catalogue of other vendors, so
 * they start on their own.
 */
export const POST_SIGN_IN_PATH_BY_ROLE: Record<UserRole, string> = {
  customer: '/',
  vendor: DASHBOARD_PATH_BY_ROLE.vendor,
  /*
   * An operator signs in to operate. Like a vendor, they have no use for a
   * catalogue of vendors as a *starting* place, so this matches their dashboard
   * rather than the marketplace home.
   */
  admin: DASHBOARD_PATH_BY_ROLE.admin,
};

/**
 * Which roles a route will actually render for — the bounces the layouts and
 * pages perform, written down once so a redirect can be *decided* rather than
 * discovered by performing it.
 *
 * A route absent from this table renders for every signed-in role. Only routes
 * that turn a role away belong here, and each entry mirrors exactly one gate in
 * the app: a `requireRole` in a layout or page, or `redirectVendorToDashboard`
 * on `/`. Patterns are anchored and match whole segments, so `/vendor` never
 * matches `/vendors/june-harlow` — that is the public storefront.
 *
 * **That correspondence is the thing that can rot**, and a comment naming the
 * gate is not what keeps it honest: a gate added under a path no rule matches
 * falls through to the default and reproduces #410 on that route, silently.
 * `role-routes.guard.test.ts` reads the gates out of `app/` and checks both
 * directions against this table, so the drift fails a test rather than a
 * visitor. Exported for it, and for nothing else.
 *
 * The guard recognises the two shapes a gate is written in here —
 * `requireRole(...)` and `redirectVendorToDashboard()`. A gate written inline
 * instead, as `admin/vendors/export/route.ts` does with its own
 * `user.role !== 'admin'` check, is invisible to it; that one is covered by the
 * `/admin` rule, but the next inline gate on an unruled path would not be. Use
 * `requireRole` for a new one, or add the rule here by hand.
 */
export const ROLE_ROUTE_RULES: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly roles: readonly UserRole[];
}> = [
  // `app/vendor/layout.tsx` — `requireRole('vendor')`.
  { pattern: /^\/vendor(?:\/|$)/, roles: ['vendor'] },
  // `app/customer/layout.tsx` — `requireRole('customer')`.
  { pattern: /^\/customer(?:\/|$)/, roles: ['customer'] },
  // `app/admin/layout.tsx` — `requireRole('admin')`.
  { pattern: /^\/admin(?:\/|$)/, roles: ['admin'] },
  // The bookings hub and every request detail, checkout and confirmed page.
  { pattern: /^\/bookings(?:\/|$)/, roles: ['customer'] },
  /*
   * The booking request form. A vendor cannot request their own listing and an
   * admin has no customer identity to send one with, so `requireRole('customer')`
   * turns both away (#401); the storefront around it stays public.
   */
  { pattern: /^\/vendors\/[^/]+\/request(?:\/|$)/, roles: ['customer'] },
  /*
   * The marketplace home is a catalogue of other vendors, which
   * `redirectVendorToDashboard` sends a vendor away from. Nobody else is gated
   * out of it, and it is the customer's own start.
   */
  { pattern: /^\/$/, roles: ['customer', 'admin'] },
];

/**
 * The pathname of a **normalised** same-origin path.
 *
 * A split rather than `new URL(path, origin).pathname` because the input is
 * already the output of `safeReturnPath`, which parses and re-serialises for
 * exactly that reason: it returns `${pathname}${search}${hash}`, so the first
 * `?` or `#` is the end of the pathname and dot segments are already resolved.
 * Parsing a second time would re-derive a value the caller has, and would let a
 * caller pass an un-normalised path without noticing that it must not.
 */
function pathnameOf(path: string): string {
  return path.split(/[?#]/, 1)[0] ?? path;
}

/**
 * Whether `role` renders `path`, or is bounced away from it.
 *
 * Answering this *before* redirecting is the whole point. A redirect to a route
 * the role is refused is not merely a wasted hop: the bounce out of it is an
 * RSC `redirect()` raised inside a page or layout, and on the client-side
 * navigation that follows sign-in the App Router cannot reconcile a redirect
 * that crosses layout segments. The visitor is left on a blank page still
 * wearing the previous render's signed-out header — #410, and the same failure
 * `/dashboard` and `/after-sign-in` already exist as route handlers to avoid.
 */
export function roleCanReach(role: UserRole, path: string): boolean {
  const pathname = pathnameOf(path);
  const rule = ROLE_ROUTE_RULES.find((candidate) => candidate.pattern.test(pathname));

  return rule ? rule.roles.includes(role) : true;
}

/**
 * Where a freshly authenticated session actually lands: the destination it was
 * carrying when the role can use it, and that role's own start when it cannot.
 *
 * This is the one place the post-sign-in target is computed, which makes it
 * both the open-redirect boundary — the destination is re-validated here rather
 * than trusted because an earlier screen looked at it — and the place a
 * destination the role would only be bounced out of is exchanged for somewhere
 * that role can actually be.
 */
export function postSignInPath(role: UserRole, returnTo: string | null | undefined): string {
  const safe = safeReturnPath(returnTo);

  return safe !== null && roleCanReach(role, safe) ? safe : POST_SIGN_IN_PATH_BY_ROLE[role];
}
