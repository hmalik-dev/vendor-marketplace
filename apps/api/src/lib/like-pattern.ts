import { sql, type SQL } from 'drizzle-orm';
import type { Column } from 'drizzle-orm';

/**
 * Escapes the three characters LIKE treats as syntax, so a search matches the
 * letters somebody typed and nothing else.
 *
 * The value is always a bound parameter, so this was never injection — it is a
 * correctness bug in both directions: a bare `%` matches every row and dumps
 * the whole table, while a name containing a `%` or `_` cannot be found
 * literally. The backslash must be escaped **first**, or it goes on to escape
 * the escapes added after it.
 *
 * It lives here rather than beside one query because it was fixed once in
 * `vendor-search.dao.ts` and then reintroduced verbatim in the admin DAO. A
 * private helper is a fix; a shared one is the class closed.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * A case-insensitive `contains` over one column, with the term escaped.
 *
 * Deliberately **not** Drizzle's `ilike`, which interpolates the pattern
 * verbatim and has no way to declare an `ESCAPE` character — using it is what
 * makes the wildcards live. Every caller that wants "does this column contain
 * what the user typed" should reach for this instead.
 */
export function containsInsensitive(column: Column, term: string): SQL {
  return sql`${column} ILIKE ${`%${escapeLikePattern(term)}%`} ESCAPE '\\'`;
}
