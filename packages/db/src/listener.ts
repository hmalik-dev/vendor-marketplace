import postgres from 'postgres';

/** Neon names a pooled endpoint by this suffix on the first label of its host. */
const NEON_POOLER_SUFFIX = '-pooler';

/**
 * The same database, over its direct endpoint.
 *
 * `LISTEN` belongs to a session, and Neon's pooled endpoint is PgBouncer in
 * transaction mode, which hands the session to someone else after every
 * statement: a listener there hears nothing and reports no error. Neon's
 * direct endpoint is the pooled host without `-pooler`, so it is derived
 * rather than configured — a second connection string would be one more value
 * a release could leave pointing at the wrong branch. A host with no pooler
 * suffix, like the local Docker Postgres, is returned unchanged.
 */
export function directConnectionString(connectionString: string): string {
  const url = new URL(connectionString);
  const [first, ...rest] = url.hostname.split('.');

  if (first?.endsWith(NEON_POOLER_SUFFIX)) {
    url.hostname = [first.slice(0, -NEON_POOLER_SUFFIX.length), ...rest].join('.');
  }

  return url.toString();
}

export interface DatabaseListener {
  /**
   * Subscribes to a channel and returns the function that unsubscribes.
   * `onResubscribed` runs each time the driver re-issues the `LISTEN` after a
   * dropped connection — Postgres keeps nothing for a session that was gone.
   */
  listen: (
    channel: string,
    onPayload: (payload: string) => void,
    onResubscribed?: () => void,
  ) => Promise<() => Promise<void>>;
  close: () => Promise<void>;
}

/**
 * A connection held open for `LISTEN`, on the direct endpoint. The driver
 * reconnects it and re-issues every `LISTEN` when it drops.
 */
export function createListener(connectionString: string): DatabaseListener {
  const client = postgres(directConnectionString(connectionString), { max: 1 });

  return {
    listen: async (channel, onPayload, onResubscribed) => {
      let subscribed = false;
      const subscription = await client.listen(channel, onPayload, () => {
        // The driver calls this on the first LISTEN too; only the ones after it are gaps.
        if (subscribed) {
          onResubscribed?.();
        }
        subscribed = true;
      });
      return () => subscription.unlisten();
    },
    close: () => client.end(),
  };
}
