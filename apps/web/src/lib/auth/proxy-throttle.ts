/**
 * A per-caller throttle for the `/api/auth/*` proxy.
 *
 * The API's own limiter never sees these calls, and Neon Auth sees every one of
 * them from this server's address — so without a limiter here either nobody is
 * ever slowed (six-digit codes are guessable) or one caller's burst rate-limits
 * everybody at the provider. Credential-bearing and mail-sending calls get the
 * tight budget; the rest a looser one.
 *
 * In-process and per instance: it bounds a single attacker hitting one
 * instance, which is the realistic shape, and it costs nothing to run. It is a
 * floor, not a substitute for the provider's own limits.
 */
const WINDOW_MS = 60_000;
const TIGHT_LIMIT = 10;
const LOOSE_LIMIT = 60;

/** Calls that check a secret or make the platform send mail. */
const TIGHT_PATHS: ReadonlySet<string> = new Set([
  'sign-in/email',
  'sign-up/email',
  'email-otp/verify-email',
  'email-otp/send-verification-otp',
]);

const hits = new Map<string, number[]>();

/** The caller's address as the platform reports it; the first hop is the client. */
export function callerAddress(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/** True when this call is over budget. Records the call either way. */
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

/** Test seam: forgets every recorded call. */
export function resetThrottle(): void {
  hits.clear();
}
