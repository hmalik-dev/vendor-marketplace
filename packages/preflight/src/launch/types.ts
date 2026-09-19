import type { LaunchDatabase } from './database.js';
import type { HttpGet } from './http.js';

/**
 * `SKIP` is a check whose subject has not landed yet; `MANUAL` is one no
 * provider API can answer. Neither fails the run — only `FAIL` does.
 */
export type LaunchStatus = 'PASS' | 'FAIL' | 'SKIP' | 'MANUAL';

export type LaunchGroup = 'auth' | 'stripe' | 'resend' | 'storage' | 'database' | 'env' | 'app';

export interface LaunchResult {
  readonly group: LaunchGroup;
  readonly name: string;
  readonly status: LaunchStatus;
  /** What was found. Never an unmasked secret. */
  readonly detail: string;
}

export interface LaunchOptions {
  /** The production values: `.env.production.local` under the real process environment. */
  readonly env: NodeJS.ProcessEnv;
  readonly get: HttpGet;
  /** `null` when `DATABASE_URL` is unset. */
  readonly database: LaunchDatabase | null;
  /** `HANDLED_STRIPE_EVENT_TYPES` from the Stripe webhook route module. */
  readonly handledStripeEvents: readonly string[];
}

/** One provider read. A probe that throws becomes a single `FAIL` under its name. */
export interface Probe {
  readonly group: LaunchGroup;
  readonly name: string;
  run(): Promise<LaunchResult[]>;
}

export function passed(group: LaunchGroup, name: string, detail: string): LaunchResult {
  return { group, name, status: 'PASS', detail };
}

export function failed(group: LaunchGroup, name: string, detail: string): LaunchResult {
  return { group, name, status: 'FAIL', detail };
}

/** Passes on `ok`; a failure appends what was expected to what was found. */
export function judge(
  group: LaunchGroup,
  name: string,
  found: string,
  ok: boolean,
  expected: string,
): LaunchResult {
  return ok ? passed(group, name, found) : failed(group, name, `${found} (expected ${expected})`);
}

/** The origin a URL variable names, without a trailing slash; throws when unset. */
export function originOf(env: NodeJS.ProcessEnv, key: 'API_URL' | 'WEB_URL'): string {
  // WEB_URL may be a comma-separated list; the first entry is the canonical origin.
  const value = env[key]?.split(',')[0]?.trim();

  if (!value) {
    throw new Error(`${key} is unset`);
  }

  return value.replace(/\/+$/, '');
}
