import {
  ERROR_CODES,
  LEGAL_PATHS,
  SUPPORT_PATH,
  TERMS_ACCEPTANCE_PATH,
  VENDOR_APPLY_PATH,
  VENDOR_DETAILS_PATH,
  WAITLIST_PATH,
} from '@vendor-marketplace/shared';
import { ApiClientError } from './api-client';
import { pathReturningTo } from './return-path';

/**
 * The acceptance gate's pure half — no `next/headers`, so the browser can
 * import it.
 *
 * `terms-gate.ts` is the server half and re-exports all of this, so a Server
 * Component keeps importing one module. The split exists because `useApi` runs
 * in the browser and needs two of these, and a module that reaches for request
 * headers cannot be pulled into a client bundle at all.
 */

/** Where the interstitial lives, carrying where the reader was going. */
export function termsAcceptancePath(returnTo?: string | null): string {
  return pathReturningTo(TERMS_ACCEPTANCE_PATH, returnTo);
}

/**
 * Whether an error is the gate rather than a refusal.
 *
 * Both are 403, and telling them apart is the whole reason `TERMS_REQUIRED`
 * exists as its own code: a `FORBIDDEN` sends the reader to `/suspended`, which
 * is terminal, and this sends them to a box they tick once.
 */
export function isTermsRequired(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === ERROR_CODES.TERMS_REQUIRED;
}

/**
 * A refusal no retry can clear, as the place it sends the person: a suspension
 * (403 that is not the gate or the vendor gate) to `/suspended`, and a session
 * the API no longer honours (401) to sign-out. `null` for everything a retry
 * might clear. The gate itself and the vendor gate are 403s too, and are
 * excluded by code (unlike `signedInFailurePath`, whose callers never see the
 * vendor gate).
 */
export function terminalRefusal(error: unknown): 'suspended' | 'signed-out' | null {
  if (!(error instanceof ApiClientError) || isTermsRequired(error)) {
    return null;
  }

  if (error.statusCode === 401) {
    return 'signed-out';
  }

  return error.statusCode === 403 && error.code !== ERROR_CODES.VENDOR_NOT_INVITED
    ? 'suspended'
    : null;
}

/**
 * The pages a gated account may sit on — and the Terms funnel must not take
 * away. **`useRefusalRedirect`'s exemption below is a separate, narrower
 * list** — this one governs only where `TERMS_REQUIRED` sends a reader, never
 * a genuine 401 or suspension, so it is safe to widen with pages that carry
 * real authenticated actions (a storefront's booking rail, its reviews).
 *
 * Everything else is refused anyway, so bouncing a gated reader off it is the
 * correct answer. These are the exceptions, and each one is load-bearing:
 *
 * - the legal pages, because `/terms` is the document the gate is **asking the
 *   reader to accept**, and the interstitial links it to open in its own tab.
 *   A gate that navigates away from the text it demands you read is unusable.
 * - `/support`, because the visitor most likely to need it is the one who
 *   cannot get through — and a person stuck here has to be able to say so.
 * - the interstitial itself, which would otherwise redirect to itself.
 * - the vendor details and waitlist screens (VEN-512), where a refused vendor's
 *   own row now lives — that session can never clear the Terms gate (no
 *   account was created for it), so bouncing it back there would be a loop.
 *   `VENDOR_APPLY_PATH` stays exempt too: it is still a reachable redirect for
 *   old links.
 * - the home page, `/search` and a vendor storefront (`/vendors/<slug>`,
 *   VEN-586): VEN-512 AC18 already requires these public browse surfaces to
 *   stay viewable for a gated account exactly as they do for a signed-out
 *   visitor — not only for the waitlisted vendor whose gate is unrecoverable,
 *   but for any account that has simply not accepted the current Terms yet.
 *   That account keeps its own route back to the gate through `Sign in` →
 *   `redirectIfSignedIn` → `signedInFailurePath`, so exempting these three is
 *   a widened funnel, not a lost one.
 *
 * This exists because the client funnel is genuinely ambient: `NotificationBell`
 * is mounted by the root layout on every non-admin route and fetches on mount,
 * so without this a gated account opening `/terms` in a new tab is pushed
 * straight back to the gate one round trip later.
 */
const GATE_EXEMPT_PATHS: readonly string[] = [
  ...Object.values(LEGAL_PATHS),
  SUPPORT_PATH,
  TERMS_ACCEPTANCE_PATH,
  VENDOR_APPLY_PATH,
  VENDOR_DETAILS_PATH,
  WAITLIST_PATH,
  '/',
  '/search',
];

/** A vendor storefront's single dynamic segment — `/vendors/<slug>`, never a nested path like `/vendors/<slug>/request`. */
const VENDOR_STOREFRONT_PATTERN = /^\/vendors\/[^/]+$/;

export function isGateExemptPath(pathname: string): boolean {
  return GATE_EXEMPT_PATHS.includes(pathname) || VENDOR_STOREFRONT_PATTERN.test(pathname);
}

/**
 * The pages `useRefusalRedirect` must not navigate away from — a **different,
 * narrower** list than `isGateExemptPath` above, and not a subset by accident.
 *
 * That hook fires on a genuine mid-session refusal (a real 401, or a 403
 * `ACCOUNT_SUSPENDED`) — `terminalRefusal` has already filtered out
 * `TERMS_REQUIRED`, so this never governs the Terms funnel. It exists so a
 * refusal on the page that is already answering it — `/suspended` itself, or
 * a Terms/support page a gated reader is mid-way through — does not navigate
 * a second time. `/`, `/search` and a storefront carry real authenticated
 * actions (a storefront's booking rail, its review form, the header's
 * notification bell), so a session revoked or banned there still has to be
 * signed out or bounced to `/suspended` — VEN-586 widened `GATE_EXEMPT_PATHS`
 * with exactly those three pages, and reusing that list here would have
 * silently disabled both redirects on the app's highest-traffic surfaces.
 */
const REFUSAL_EXEMPT_PATHS: readonly string[] = [
  ...Object.values(LEGAL_PATHS),
  SUPPORT_PATH,
  TERMS_ACCEPTANCE_PATH,
  VENDOR_APPLY_PATH,
  VENDOR_DETAILS_PATH,
  WAITLIST_PATH,
];

export function isRefusalExemptPath(pathname: string): boolean {
  return REFUSAL_EXEMPT_PATHS.includes(pathname);
}
