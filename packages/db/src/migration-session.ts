/**
 * Session settings for the connection migrations run over (VEN-650).
 *
 * A release migrates while the previous one is still serving. An `ALTER TABLE`
 * queued behind a long-held row lock — the payout sweep's, say — waits with
 * its own `ACCESS EXCLUSIVE` request at the head of the queue, and every query
 * the live release sends to that table queues behind it: the site stalls for
 * as long as the migration is willing to wait, which by default is for ever.
 *
 * `lock_timeout` gives up after five seconds instead, so the worst a busy
 * table costs the live site is five seconds, and the migration is tried
 * again. `statement_timeout` bounds a statement that got its lock and then ran
 * away. Sent as startup parameters, so a reconnect carries them too.
 */
export const MIGRATION_SESSION_SETTINGS = {
  lock_timeout: '5s',
  statement_timeout: '60s',
} as const;

/** Tries of the whole migration run before a lock timeout fails the release. */
export const MIGRATION_LOCK_ATTEMPTS = 5;

/** Pause before the first retry, doubled after each further one. */
export const MIGRATION_LOCK_RETRY_BASE_MS = 2_000;

/** SQLSTATE `lock_not_available`, which a `lock_timeout` raises. */
const LOCK_NOT_AVAILABLE = '55P03';

/** Walks the `cause` chain, since Drizzle wraps the driver's error in its own. */
export function isLockTimeout(error: unknown): boolean {
  let current: unknown = error;

  while (typeof current === 'object' && current !== null) {
    if ('code' in current && current.code === LOCK_NOT_AVAILABLE) {
      return true;
    }
    current = 'cause' in current ? current.cause : undefined;
  }

  return false;
}

export interface LockRetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  wait?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, delayMs: number) => void;
}

/**
 * Runs `migrate` again when it lost a lock race, up to a bounded number of
 * tries. Drizzle applies every pending migration in one transaction, so a
 * timed-out run left nothing half-applied and the retry starts clean. Any
 * other failure is thrown at once: retrying a broken migration only delays
 * the report.
 */
export async function retryOnLockTimeout<T>(
  migrate: () => Promise<T>,
  options: LockRetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? MIGRATION_LOCK_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? MIGRATION_LOCK_RETRY_BASE_MS;
  const wait =
    options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await migrate();
    } catch (error) {
      if (attempt >= attempts || !isLockTimeout(error)) {
        throw error;
      }
      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      options.onRetry?.(attempt, delayMs);
      await wait(delayMs);
    }
  }
}
