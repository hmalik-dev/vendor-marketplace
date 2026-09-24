import type { CursorPage, KeysetCursor } from '@vendor-marketplace/shared';
import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/** A row as a keyset read returns it: the row, and the cursor that names it. */
export interface Keyed<T> {
  row: T;
  cursor: string;
}

/**
 * The cursor for a row (the sort key may be an expression, not only a column),
 * rendered by Postgres so it keeps the microseconds a JS `Date` would drop:
 * `2026-09-23T12:00:00.123456Z,<id>`.
 */
export function cursorOf(createdAt: PgColumn | SQL, id: PgColumn): SQL<string> {
  return sql<string>`to_char(${createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || ',' || ${id}::text`;
}

/** Rows strictly older than the cursor, in `(created_at, id)` order — the order the pages are read in. */
export function olderThan(createdAt: PgColumn | SQL, id: PgColumn, cursor: KeysetCursor): SQL {
  return sql`(${createdAt}, ${id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
}

/**
 * One page from a read that fetched `limit + 1` rows, newest first: the extra
 * row only says an older page exists, and the cursor is the oldest row kept.
 */
export function pageOf<T>(fetched: Keyed<T>[], limit: number): CursorPage<T> {
  const kept = fetched.slice(0, limit);
  const oldest = kept.at(-1);

  return {
    items: kept.map((entry) => entry.row),
    nextBefore: fetched.length > limit && oldest ? oldest.cursor : null,
  };
}
