import {
  ERROR_CODES,
  LEGAL_PATHS,
  SUPPORT_PATH,
  TERMS_ACCEPTANCE_PATH,
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
 * The pages a gated account may sit on — and the gate must not take away.
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
];

export function isGateExemptPath(pathname: string): boolean {
  return GATE_EXEMPT_PATHS.includes(pathname);
}
