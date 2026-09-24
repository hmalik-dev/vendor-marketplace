/**
 * Session settings for the connection pool the API serves requests over
 * (VEN-607).
 *
 * The pool is ten connections on a single replica, so a query that never
 * returns, a lock nobody releases or a transaction left open by a stalled
 * caller takes a tenth of the API's capacity for as long as it lasts. Each
 * setting turns one of those into a failed request instead. Sent as startup
 * parameters, so a reconnect carries them too.
 *
 * Scripts, seeds and the migrator open their own clients and pass their own
 * settings (`MIGRATION_SESSION_SETTINGS`), so none of them is cut at ten
 * seconds.
 *
 * The idle bound is above the longest run of Stripe calls made inside one
 * transaction with no statement between them: the payout claim awaits up to
 * four, each up to about twenty seconds with its one retry. A shorter bound
 * would end the session after the money moved and lose the row that says so.
 */
export const API_SESSION_SETTINGS = {
  statement_timeout: '10s',
  lock_timeout: '5s',
  idle_in_transaction_session_timeout: '120s',
} as const;

/** Seconds to wait for a connection before giving up (postgres.js defaults to 30). */
export const API_CONNECT_TIMEOUT_SECONDS = 10;

/** SQLSTATE `query_canceled`, which a `statement_timeout` raises. */
const QUERY_CANCELED = '57014';

/** SQLSTATE `lock_not_available`, which a `lock_timeout` raises. */
const LOCK_NOT_AVAILABLE = '55P03';

/**
 * True when the database gave up on a statement or a lock wait because of the
 * API session's bounds. Walks the `cause` chain, since Drizzle wraps the
 * driver's error in its own.
 */
export function isDatabaseTimeout(error: unknown): boolean {
  let current: unknown = error;

  while (typeof current === 'object' && current !== null) {
    if (
      'code' in current &&
      (current.code === QUERY_CANCELED || current.code === LOCK_NOT_AVAILABLE)
    ) {
      return true;
    }
    current = 'cause' in current ? current.cause : undefined;
  }

  return false;
}
