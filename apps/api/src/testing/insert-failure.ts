import { sql } from 'drizzle-orm';
import type { AppDatabase } from '../lib/database.js';

/**
 * Makes every insert into `table` fail the way Postgres refuses a NUL byte
 * (SQLSTATE 22021), and returns what puts the table back.
 *
 * A test of what a failed write logs used to cause the failure by sending
 * `U+0000` in a request body. The API now refuses that with a 400 before any
 * statement runs (VEN-544), which is the right answer and no longer a lever, so
 * the failure is made in the database instead: a real driver error with the
 * statement's real bound parameters, not a mock standing in for one.
 */
export async function failInsertsInto(
  db: AppDatabase,
  table: 'support_cases' | 'vendor_profiles',
): Promise<() => Promise<void>> {
  const name = `test_fail_${table}`;

  await db.execute(
    sql.raw(`
      create or replace function ${name}() returns trigger language plpgsql as $$
      begin
        raise exception 'invalid byte sequence for encoding "UTF8": 0x00' using errcode = '22021';
      end $$;
    `),
  );
  await db.execute(
    sql.raw(
      `create trigger ${name} before insert on ${table} for each row execute function ${name}()`,
    ),
  );

  return async () => {
    await db.execute(sql.raw(`drop trigger ${name} on ${table}`));
    await db.execute(sql.raw(`drop function ${name}()`));
  };
}
