/**
 * A per-caller throttle for the `/api/auth/*` proxy.
 *
 * The API's own limiter never sees these calls, and Neon Auth sees every one of
 * them from this server's address — so without a limiter here either nobody is
 * ever slowed (six-digit codes are guessable) or one caller's burst rate-limits
 * everybody at the provider. Credential-bearing and mail-sending calls get the
 * tight budget; the rest a looser one.
 *
 * **Counted in the API's database** (`chargeCaller`, `chargeAddress`, VEN-462),
 * so a cold start does not reset a budget and N warm serverless instances do
 * not multiply it. When `WEB_TIER_KEY` is unset (local) or the API cannot be
 * reached, the same call is counted in this process instead — a floor that
 * keeps a per-instance limit rather than none, and never lets an outage of the
 * counter open the door. The provider's own limits sit behind both.
 */
import { createHash } from 'node:crypto';
import { WEB_TIER_KEY_HEADER } from '@vendor-marketplace/shared';
import { apiBaseUrl } from '../api-base-url';
import { visitorAddress } from '../visitor-address';

const WINDOW_MS = 60_000;
const TIGHT_LIMIT = 10;
const LOOSE_LIMIT = 60;

/** Calls that check a secret or make the platform send mail. */
const TIGHT_PATHS: ReadonlySet<string> = new Set([
  'sign-in/email',
  'sign-up/email',
  'email-otp/verify-email',
  'email-otp/send-verification-otp',
  'email-otp/request-password-reset',
  'email-otp/reset-password',
  'change-password',
]);

const hits = new Map<string, number[]>();

/** The caller's address by the web tier's one rule; a call naming nobody shares a bucket. */
export function callerAddress(headers: Headers): string {
  return visitorAddress(headers) ?? 'unknown';
}

/** The per-caller budget for a path: its bucket, window and limit. */
function callerBudget(caller: string, path: readonly string[]): { bucket: string; limit: number } {
  const joined = path.join('/');
  const tight = TIGHT_PATHS.has(joined);

  return {
    bucket: `${caller}|${tight ? joined : 'other'}`,
    limit: tight ? TIGHT_LIMIT : LOOSE_LIMIT,
  };
}

/** The in-process count: the floor when the shared counter is not available. */
export function isThrottled(
  caller: string,
  path: readonly string[],
  now: number = Date.now(),
): boolean {
  const joined = path.join('/');
  const tight = TIGHT_PATHS.has(joined);
  const key = `${caller}|${tight ? joined : 'other'}`;
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 5_000) {
    for (const [stale, times] of hits) {
      if (times.every((at) => now - at >= WINDOW_MS)) {
        hits.delete(stale);
      }
    }
  }

  return recent.length > (tight ? TIGHT_LIMIT : LOOSE_LIMIT);
}

const ADDRESS_WINDOW_MS = 600_000;
const ADDRESS_LIMIT = 5;
/** A password sign-in is retried by people who mistype; the codes and mail are not. */
const SIGN_IN_ADDRESS_LIMIT = 10;

/** Calls charged to the account address in the body, with their budgets per ten minutes. */
export function addressLimit(path: readonly string[]): number | null {
  const joined = path.join('/');

  if (joined === 'sign-in/email') {
    return SIGN_IN_ADDRESS_LIMIT;
  }

  return ADDRESS_BUDGETED_PATHS.has(joined) ? ADDRESS_LIMIT : null;
}

const ADDRESS_BUDGETED_PATHS: ReadonlySet<string> = new Set([
  'sign-up/email',
  'email-otp/verify-email',
  'email-otp/send-verification-otp',
  'email-otp/request-password-reset',
  'email-otp/reset-password',
]);
const addressHits = new Map<string, number[]>();

/**
 * True when this call for this account address is over budget: five per ten
 * minutes per call, whoever sends it. The per-caller budget above stops one
 * machine; this slows many machines mailing one inbox or guessing one
 * six-digit code. Like that budget it is in-process, so each instance keeps its
 * own count: a floor, with the provider's own limits behind it. Records the
 * call either way.
 */
export function isAddressThrottled(
  address: string,
  path: readonly string[],
  now: number = Date.now(),
  record = true,
): boolean {
  const key = `${path.join('/')}|${address.trim().toLowerCase()}`;
  const recent = (addressHits.get(key) ?? []).filter((at) => now - at < ADDRESS_WINDOW_MS);

  if (record) {
    recent.push(now);
    addressHits.set(key, recent);
  }

  if (addressHits.size > 5_000) {
    for (const [stale, times] of addressHits) {
      if (times.every((at) => now - at >= ADDRESS_WINDOW_MS)) {
        addressHits.delete(stale);
      }
    }
  }

  // A read-only check refuses once the budget is spent; a charge, once it is exceeded.
  const limit = addressLimit(path) ?? ADDRESS_LIMIT;

  return record ? recent.length > limit : recent.length >= limit;
}

const SHARED_COUNTER_TIMEOUT_MS = 2_000;

/**
 * Charges one call to a bucket in the API's database. `null` means the shared
 * counter could not answer — no key configured, unreachable, refused — and the
 * caller counts it locally instead.
 */
async function chargeShared(
  bucket: string,
  windowMs: number,
  limit: number,
  record: boolean,
): Promise<boolean | null> {
  const key = process.env.WEB_TIER_KEY;

  if (!key) {
    return null;
  }

  try {
    const response = await fetch(`${apiBaseUrl(process.env.API_URL)}/internal/throttle`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [WEB_TIER_KEY_HEADER]: key },
      body: JSON.stringify({ bucket, windowMs, limit, record }),
      signal: AbortSignal.timeout(SHARED_COUNTER_TIMEOUT_MS),
    });
    const body = (await response.json()) as { throttled?: unknown };

    return response.ok && typeof body.throttled === 'boolean' ? body.throttled : null;
  } catch {
    return null;
  }
}

/** True when this call is over the per-caller budget, counted across instances. Records the call. */
export async function chargeCaller(
  caller: string,
  path: readonly string[],
  now: number = Date.now(),
): Promise<boolean> {
  // The loose budget (session reads and the like) stays in-process: a database
  // round trip per page view is not worth what it would add over the floor.
  if (!TIGHT_PATHS.has(path.join('/'))) {
    return isThrottled(caller, path, now);
  }

  const { bucket, limit } = callerBudget(caller, path);

  return (await chargeShared(bucket, WINDOW_MS, limit, true)) ?? isThrottled(caller, path, now);
}

/** True when this call is over the account-address budget, counted across instances. Records the call. */
export async function chargeAddress(
  address: string,
  path: readonly string[],
  now: number = Date.now(),
  record = true,
): Promise<boolean> {
  // Hashed: the API stores the bucket, and an address is personal data it has no use for.
  const digest = createHash('sha256').update(address.trim().toLowerCase()).digest('hex');
  const bucket = `addr|${path.join('/')}|${digest}`;
  const shared = await chargeShared(
    bucket,
    ADDRESS_WINDOW_MS,
    addressLimit(path) ?? ADDRESS_LIMIT,
    record,
  );

  return shared ?? isAddressThrottled(address, path, now, record);
}

/** Test seam: forgets every recorded call. */
export function resetThrottle(): void {
  hits.clear();
  addressHits.clear();
}
