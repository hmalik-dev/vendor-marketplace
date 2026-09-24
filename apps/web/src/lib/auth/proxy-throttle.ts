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
  'revoke-session',
  'revoke-other-sessions',
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

const SIGN_IN = 'sign-in/email';
const SIGN_IN_PATH: readonly string[] = ['sign-in', 'email'];
const pairHits = new Map<string, number[]>();

/**
 * Counts failed password sign-ins per account address **and** caller (VEN-630).
 * A budget shared by every caller lets a stranger who only knows an address
 * spend it and lock the owner out. So a caller is refused for one of two
 * reasons: it spent its own budget for the address, or the address budget is
 * spent and it has already failed once itself. A caller with no failure of its
 * own for the address is not refused by the address budget, so the owner gets
 * in with the right password; a stranger rotating callers gets one guess from
 * each, up to a hard ceiling per address that binds every caller. The product
 * writes no cookie of its own (`no-cookie-consent.test.ts`), so there is no
 * device token to exempt the owner by.
 */
async function chargePair(
  route: string,
  address: string,
  caller: string,
  limit: number,
  record: boolean,
  now: number,
): Promise<boolean> {
  const normalized = address.trim().toLowerCase();
  // Hashed: the API stores the bucket, and neither an address nor a caller is data it needs.
  const digest = createHash('sha256').update(normalized).digest('hex');
  const callerDigest = createHash('sha256').update(caller).digest('hex');
  const shared = await chargeShared(
    `pair|${route}|${digest}|${callerDigest}`,
    ADDRESS_WINDOW_MS,
    limit,
    record,
  );

  if (shared !== null) {
    return shared;
  }

  const key = `${route}|${normalized}|${caller}`;
  const recent = (pairHits.get(key) ?? []).filter((at) => now - at < ADDRESS_WINDOW_MS);

  if (record) {
    recent.push(now);
    pairHits.set(key, recent);
  }

  if (pairHits.size > 5_000) {
    for (const [stale, times] of pairHits) {
      if (times.every((at) => now - at >= ADDRESS_WINDOW_MS)) {
        pairHits.delete(stale);
      }
    }
  }

  return record ? recent.length > limit : recent.length >= limit;
}

/**
 * Wrong passwords per account address, from every caller together, past which
 * even a caller with no failure of its own is refused: the bound on guessing
 * one account with many addresses (VEN-630). Ten times the per-caller budget, so
 * a stranger has to hold that many failures' worth of callers to reach it.
 */
const SIGN_IN_CEILING = 10 * SIGN_IN_ADDRESS_LIMIT;
/** Stands for "every caller" in a pair bucket; no address is written `*`. */
const ALL_CALLERS = '*';

/**
 * The caller as the sign-in budget counts it: an IPv6 address by its /64, since
 * one host holds a whole /64 and would otherwise be a fresh caller per request.
 */
export function signInCaller(caller: string): string {
  if (!caller.includes(':') || caller.includes('.')) {
    return caller;
  }

  const [head = '', tail] = caller.toLowerCase().split('::');
  const front = head === '' ? [] : head.split(':');
  const back = tail === undefined || tail === '' ? [] : tail.split(':');
  const groups =
    tail === undefined
      ? front
      : [
          ...front,
          ...Array<string>(Math.max(0, 8 - front.length - back.length)).fill('0'),
          ...back,
        ];

  return `${groups
    .slice(0, 4)
    .map((group) => group.padStart(4, '0'))
    .join(':')}::/64`;
}

/** Read-only: whether this caller may try a password for this address now. */
export async function isSignInRefused(
  address: string,
  caller: string,
  now: number = Date.now(),
): Promise<boolean> {
  const who = signInCaller(caller);

  if (
    (await chargePair(SIGN_IN, address, who, SIGN_IN_ADDRESS_LIMIT, false, now)) ||
    (await chargePair(SIGN_IN, address, ALL_CALLERS, SIGN_IN_CEILING, false, now))
  ) {
    return true;
  }

  // Below the ceiling, the address budget binds only a caller that has already failed for it.
  return (
    (await chargeAddress(address, SIGN_IN_PATH, now, false)) &&
    (await chargePair(SIGN_IN, address, who, 1, false, now))
  );
}

/** Records one refused password against the address and against the caller. */
export async function recordSignInFailure(
  address: string,
  caller: string,
  now: number = Date.now(),
): Promise<void> {
  await chargeAddress(address, SIGN_IN_PATH, now);
  await chargePair(SIGN_IN, address, signInCaller(caller), SIGN_IN_ADDRESS_LIMIT, true, now);
  await chargePair(SIGN_IN, address, ALL_CALLERS, SIGN_IN_CEILING, true, now);
}

/**
 * True when this reset, code or mail request is refused (VEN-718). Counted like
 * a sign-in (`isSignInRefused`), but every request is a use of the budget, not
 * only a failure: a caller is refused when it spent its own budget for the
 * address, or the address budget is spent and it has already asked once itself,
 * or a hard ceiling per address is spent by everyone: ten times the budget for mail, twice for
 * a code check, where every extra caller is another guess at a six-digit code.
 * A stranger who spent the address budget therefore cannot stop the owner's
 * first request from another caller. A refused request records nothing.
 */
/** Calls that check a six-digit code: past the address budget each fresh caller is another guess, so the ceiling stays low. */
const CODE_CHECK_PATHS: ReadonlySet<string> = new Set([
  'email-otp/verify-email',
  'email-otp/reset-password',
]);

export async function chargeRequest(
  address: string,
  caller: string,
  path: readonly string[],
  now: number = Date.now(),
): Promise<boolean> {
  const route = path.join('/');
  const who = signInCaller(caller);
  const limit = addressLimit(path) ?? ADDRESS_LIMIT;
  const ceiling = (CODE_CHECK_PATHS.has(route) ? 2 : 10) * limit;

  if (
    (await chargePair(route, address, who, limit, false, now)) ||
    (await chargePair(route, address, ALL_CALLERS, ceiling, false, now)) ||
    ((await chargeAddress(address, path, now, false)) &&
      (await chargePair(route, address, who, 1, false, now)))
  ) {
    return true;
  }

  await chargeAddress(address, path, now);

  // The checks above are reads; a burst that passed them together is caught by the count of its own charge.
  const own = await chargePair(route, address, who, limit, true, now);
  const all = await chargePair(route, address, ALL_CALLERS, ceiling, true, now);

  return own || all;
}

const MAIL_PACE_WINDOW_MS = 60_000;
/** Under what the provider took before it stopped mailing an address (five in a burst, VEN-718). */
const MAIL_PACE_LIMIT = 3;
const paceHits = new Map<string, number[]>();

/**
 * True when a reset mail for this address would be one send too many for the
 * minute, whoever asked (VEN-719). The provider limits mail per address itself
 * and drops the rest without a word, so a stranger's burst used up its allowance
 * and the owner's next request was answered "sent" and never arrived. Sending
 * fewer per minute than the provider allows keeps the owner's mail deliverable;
 * past that the caller is told to wait. A refused request records nothing, so
 * polling cannot hold the window shut. The same for every address, so it says
 * nothing about whether an account exists. `record = false` only reads: asked
 * before the request budgets are charged, so a request told to wait spends none
 * of them and the retry it was told to make is not refused for it.
 */
export async function isMailPaced(
  address: string,
  now: number = Date.now(),
  record = true,
): Promise<boolean> {
  const normalized = address.trim().toLowerCase();
  // Hashed: the API stores the bucket, and an address is personal data it has no use for.
  const bucket = `mail|${createHash('sha256').update(normalized).digest('hex')}`;
  const recentLocal = (): number[] =>
    (paceHits.get(normalized) ?? []).filter((at) => now - at < MAIL_PACE_WINDOW_MS);

  const spent = await chargeShared(bucket, MAIL_PACE_WINDOW_MS, MAIL_PACE_LIMIT, false);

  if (spent ?? recentLocal().length >= MAIL_PACE_LIMIT) {
    return true;
  }

  if (!record) {
    return false;
  }

  if (paceHits.size > 5_000) {
    for (const [stale, times] of paceHits) {
      if (times.every((at) => now - at >= MAIL_PACE_WINDOW_MS)) {
        paceHits.delete(stale);
      }
    }
  }

  // The read passed; a burst that passed it together is caught by the count of its own charge.
  const over = await chargeShared(bucket, MAIL_PACE_WINDOW_MS, MAIL_PACE_LIMIT, true);

  if (over !== null) {
    return over;
  }

  const recent = [...recentLocal(), now];
  paceHits.set(normalized, recent);

  return recent.length > MAIL_PACE_LIMIT;
}

/** Test seam: forgets every recorded call. */
export function resetThrottle(): void {
  hits.clear();
  addressHits.clear();
  pairHits.clear();
  paceHits.clear();
}
