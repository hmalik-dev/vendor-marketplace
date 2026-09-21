import { sql, type AnyColumn, type SQL } from 'drizzle-orm';

/**
 * `updated_at = <the version the form was opened on>`, for an edit's `WHERE`
 * (VEN-481). Postgres keeps microseconds and the wire carries milliseconds, so
 * the column is truncated before the comparison; a plain equality would refuse
 * every save.
 */
export function updatedAtIs(column: AnyColumn, expected: Date): SQL {
  return sql`date_trunc('milliseconds', ${column}) = ${expected.toISOString()}::timestamptz`;
}
