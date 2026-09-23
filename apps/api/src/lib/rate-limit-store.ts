import type { FastifyRateLimitOptions, FastifyRateLimitStore } from '@fastify/rate-limit';
import { rateLimitCounters } from '@vendor-marketplace/db/schema';
import { lt, sql } from 'drizzle-orm';
import type { AppDatabase } from './database.js';

/** How often a process clears windows that ended, at most. */
const PURGE_INTERVAL_MS = 60_000;

/** Latched keys one process holds before it drops the ones whose window has ended. */
const LATCH_SWEEP_SIZE = 10_000;

export interface RateLimitStoreOptions {
  /** Injectable clock; the suite drives a window's end rather than waiting for it. */
  now?: () => number;
}

type StoreCallback = Parameters<FastifyRateLimitStore['incr']>[1];

interface RouteInfo {
  method?: string | string[];
  url?: string;
}

/**
 * The rate limiter's counters, in Postgres (VEN-650).
 *
 * The plugin's default store is a per-process map, so with two replicas a
 * caller had two budgets, and every deploy handed them a fresh one. Here a
 * request is one upsert on a fixed window shared by every instance: the count
 * goes up while the window is open and restarts at 1 once it has ended — the
 * same semantics as the in-memory store it replaces.
 *
 * A caller already over its limit is refused from memory until its window
 * ends, without another write: a flood past the ceiling would otherwise be
 * one upsert per refused request on one hot row, queueing every other
 * query behind it. Each key costs at most `max + 1` writes per window per
 * instance.
 *
 * Returned as a class because the plugin constructs its store itself.
 */
export function postgresRateLimitStore(
  db: AppDatabase,
  options: RateLimitStoreOptions = {},
): new (params: FastifyRateLimitOptions) => FastifyRateLimitStore {
  const now = options.now ?? Date.now;
  let purgedAt = Number.NEGATIVE_INFINITY;
  /** Keys over their limit, and when the window that refused them ends. */
  const refusedUntil = new Map<string, number>();

  function latched(key: string, nowMs: number): number | null {
    const until = refusedUntil.get(key);
    if (until === undefined) {
      return null;
    }
    if (until > nowMs) {
      return until;
    }
    refusedUntil.delete(key);
    return null;
  }

  function latch(key: string, until: number, nowMs: number): void {
    if (refusedUntil.size >= LATCH_SWEEP_SIZE) {
      for (const [held, end] of refusedUntil) {
        if (end <= nowMs) {
          refusedUntil.delete(held);
        }
      }
    }
    refusedUntil.set(key, until);
  }

  async function purge(nowMs: number): Promise<void> {
    if (nowMs - purgedAt < PURGE_INTERVAL_MS) {
      return;
    }
    purgedAt = nowMs;
    await db.delete(rateLimitCounters).where(lt(rateLimitCounters.windowEndsAt, new Date(nowMs)));
  }

  async function charge(
    key: string,
    timeWindow: number,
    max: number,
  ): Promise<{ current: number; ttl: number }> {
    const nowMs = now();
    const refused = latched(key, nowMs);

    if (refused !== null) {
      return { current: max + 1, ttl: refused - nowMs };
    }

    const at = sql`${new Date(nowMs).toISOString()}::timestamptz`;
    const ended = sql`${rateLimitCounters.windowEndsAt} <= ${at}`;

    await purge(nowMs);

    const [row] = await db
      .insert(rateLimitCounters)
      .values({ key, hits: 1, windowEndsAt: new Date(nowMs + timeWindow) })
      .onConflictDoUpdate({
        target: rateLimitCounters.key,
        set: {
          hits: sql`case when ${ended} then 1 else ${rateLimitCounters.hits} + 1 end`,
          windowEndsAt: sql`case when ${ended} then excluded.window_ends_at else ${rateLimitCounters.windowEndsAt} end`,
        },
      })
      .returning({ hits: rateLimitCounters.hits, windowEndsAt: rateLimitCounters.windowEndsAt });

    if (!row) {
      throw new Error('The rate-limit counter upsert returned no row');
    }

    const windowEndsMs = row.windowEndsAt.getTime();
    if (row.hits > max) {
      latch(key, windowEndsMs, nowMs);
    }

    return { current: row.hits, ttl: Math.max(0, windowEndsMs - nowMs) };
  }

  class PostgresRateLimitStore implements FastifyRateLimitStore {
    readonly #prefix: string;

    constructor(_params: FastifyRateLimitOptions, prefix = '') {
      this.#prefix = prefix;
    }

    incr(key: string, callback: StoreCallback, timeWindow: number, max: number): void {
      charge(`${this.#prefix}${key}`, timeWindow, max).then(
        (result) => callback(null, result),
        (error: unknown) => callback(error instanceof Error ? error : new Error(String(error))),
      );
    }

    /**
     * A route's own limit counts in a bucket of its own, keyed as the plugin's
     * Redis store keys it. The plugin passes its merged parameters with the
     * route under `routeInfo`, whatever its typings say.
     */
    child(routeOptions: Parameters<FastifyRateLimitStore['child']>[0]): FastifyRateLimitStore {
      const { routeInfo } = routeOptions as unknown as { routeInfo?: RouteInfo };
      const method = [routeInfo?.method ?? ''].flat().join(',');
      return new PostgresRateLimitStore(
        routeOptions,
        `${this.#prefix}${method}${routeInfo?.url ?? ''}-`,
      );
    }
  }

  return PostgresRateLimitStore;
}
