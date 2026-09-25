import type { BeforeSendEvent } from '@vercel/analytics';

/**
 * How Web Analytics may report each dynamic route under `apps/web/src/app`:
 *
 * - `public`: the segment is public (a vendor's slug), reported as it is.
 * - `normalised`: the segment is a record id, reported as its `[param]` name.
 * - `dropped`: never reported (the admin console, non-page handlers).
 *
 * `analytics-scrub.test.ts` derives the dynamic routes from the directory and
 * fails on one missing here, so a new `[param]` route cannot ship un-reviewed.
 */
export type DynamicRoutePolicy = 'public' | 'normalised' | 'dropped';

export const DYNAMIC_ROUTE_POLICY: Readonly<Record<string, DynamicRoutePolicy>> = {
  '/vendors/[slug]': 'public',
  '/bookings/[requestId]': 'normalised',
  '/admin/customers/[userId]': 'dropped',
  '/admin/vendors/[vendorId]': 'dropped',
  '/admin/bookings/[bookingId]': 'dropped',
  '/admin/cases/[caseId]': 'dropped',
  '/admin/users/[userId]': 'dropped',
  '/api/auth/[...path]': 'dropped',
};

// `public-chrome.tsx` is a client module, which this plain one may not call.
const ADMIN_SEGMENT = 'admin';

const PLACEHOLDER_ORIGIN = 'http://analytics.invalid';

const patternsFor = (wanted: DynamicRoutePolicy): readonly string[][] =>
  Object.entries(DYNAMIC_ROUTE_POLICY)
    .filter(([, policy]) => policy === wanted)
    .map(([route]) => route.split('/').filter(Boolean));

const NORMALISED_PATTERNS = patternsFor('normalised');
const DROPPED_PATTERNS = patternsFor('dropped');

const isParam = (segment: string): boolean => segment.startsWith('[');

const matches = (pattern: readonly string[], segments: readonly string[]): boolean =>
  segments.length >= pattern.length &&
  pattern.every((part, index) => isParam(part) || part === segments[index]);

/** Replaces the record-id segments of a path with their route pattern. */
function normalisePath(segments: readonly string[]): string {
  const pattern = NORMALISED_PATTERNS.find((candidate) => matches(candidate, segments));
  if (!pattern) return `/${segments.join('/')}`;
  return `/${segments
    .map((segment, index) =>
      index < pattern.length && isParam(pattern[index] ?? '') ? pattern[index] : segment,
    )
    .join('/')}`;
}

/**
 * `beforeSend` for Vercel Web Analytics: the admin console and every
 * `dropped` route are never reported, a record id is reported as its route
 * pattern, and the query string and fragment never leave the browser.
 */
export function scrubAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  // A leading `//` is a host to `new URL(url, base)`, so prefix the origin.
  const isRelative = event.url.startsWith('/');
  const parsed = new URL(isRelative ? `${PLACEHOLDER_ORIGIN}${event.url}` : event.url);
  // Empty segments and case are normalised for the test only: `//admin` and
  // `/ADMIN` must not slip past a literal prefix match.
  const segments = parsed.pathname.split('/').filter(Boolean);
  const folded = segments.map((segment) => segment.toLowerCase());
  if (folded[0] === ADMIN_SEGMENT || DROPPED_PATTERNS.some((p) => matches(p, folded))) {
    return null;
  }
  const path = normalisePath(segments);
  return { ...event, url: isRelative ? path : `${parsed.origin}${path}` };
}
