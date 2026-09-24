import {
  ERROR_CODES,
  LEGAL_PATHS,
  SUPPORT_PATH,
  TERMS_ACCEPTANCE_PATH,
} from '@vendor-marketplace/shared';
import { ApiClientError } from './api-client';
import { CUSTOMER_DETAILS_PATH, pathReturningTo } from './return-path';

/**
 * The name gate's pure half — no `next/headers`, so `useApi` can import it in
 * the browser. `name-gate.ts` is the server half (VEN-701), split the way
 * `terms-gate-paths.ts` is split from `terms-gate.ts`.
 */

/** The name step, carrying where the reader was going. */
export function nameStepPath(returnTo?: string | null): string {
  return pathReturningTo(CUSTOMER_DETAILS_PATH, returnTo);
}

/** Whether an API refusal is the name gate, as opposed to a suspension. */
export function isNameRequired(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === ERROR_CODES.NAME_REQUIRED;
}

/**
 * The pages a nameless customer may sit on: the step itself, which would
 * otherwise redirect to itself; the Terms screen and the legal pages, which
 * come first in the sign-up order and must stay readable; and `/support`, so a
 * person stuck here can say so. `/api/*` is never a page to send anyone away
 * from.
 */
const NAME_GATE_EXEMPT_PATHS: readonly string[] = [
  CUSTOMER_DETAILS_PATH,
  TERMS_ACCEPTANCE_PATH,
  SUPPORT_PATH,
  ...Object.values(LEGAL_PATHS),
];

const API_PREFIX = '/api/';

export function isNameGateExemptPath(pathname: string): boolean {
  return NAME_GATE_EXEMPT_PATHS.includes(pathname) || pathname.startsWith(API_PREFIX);
}
