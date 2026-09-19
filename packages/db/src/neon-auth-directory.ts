import postgres from 'postgres';

/** One identity as Neon Auth holds it: the columns the local `users` row mirrors. */
export interface NeonAuthIdentity {
  id: string;
  email: string;
  /** Better Auth keeps one `name` field; the split into first and last is the caller's. */
  name: string;
  image: string | null;
}

/**
 * The identity store behind a Neon Auth branch, read and ended over SQL.
 *
 * SQL rather than Neon's management API on purpose (VEN-448): the API has no
 * user-list or user-get route (VEN-444), and its delete route needs a
 * project-wide API key inside the API's runtime, which can do far more than
 * end an identity. A connection to the branch's own database reaches the same
 * `neon_auth` schema with a credential that can be scoped to it.
 */
export interface NeonAuthDirectory {
  /** The identities that exist among `ids`; an absent id is one Neon Auth no longer has. */
  lookup: (ids: string[]) => Promise<NeonAuthIdentity[]>;
  /**
   * Ends an identity: its row, its sessions and accounts (cascaded), and the
   * one-time-code rows Neon leaves behind (VEN-444, q3). Idempotent, and it
   * answers whether it actually removed one: an id this branch does not hold
   * reads the same as one already gone, and only the caller can decide that
   * claiming it "deleted" would be a lie it cannot take back.
   */
  deleteIdentity: (id: string) => Promise<boolean>;
  close: () => Promise<void>;
}

/** The one call the directory needs, so a suite can supply PGlite and production supplies `postgres`. */
export type SqlExecutor = (query: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

/** Ids are compared as text: Better Auth mints them, and the column type is Neon's to change. */
const LOOKUP = `select id::text as id, email, name, image from neon_auth."user" where id::text = any($1::text[])`;
const SELECT_EMAIL = `select email from neon_auth."user" where id::text = $1`;
const DELETE_USER = `delete from neon_auth."user" where id::text = $1`;
/** The whole identifier, or a `<flow>-` prefix on it: never a substring, which would reach other people's codes. */
const DELETE_CODES = `delete from neon_auth.verification where lower(identifier) = lower($1) or lower(identifier) like '%-' || replace(replace(replace(lower($1), '\\', '\\\\'), '%', '\\%'), '_', '\\_')`;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function createNeonAuthDirectoryOver(
  execute: SqlExecutor,
  close: () => Promise<void> = async () => {},
): NeonAuthDirectory {
  return {
    lookup: async (ids) => {
      if (ids.length === 0) {
        return [];
      }

      const rows = await execute(LOOKUP, [ids]);

      return rows.map((row) => ({
        id: text(row['id']),
        email: text(row['email']),
        name: text(row['name']),
        image: typeof row['image'] === 'string' && row['image'] !== '' ? row['image'] : null,
      }));
    },
    deleteIdentity: async (id) => {
      const [row] = await execute(SELECT_EMAIL, [id]);

      if (!row) {
        return false;
      }

      await execute(DELETE_USER, [id]);

      const email = text(row['email']);
      if (email !== '') {
        await execute(DELETE_CODES, [email]);
      }

      return true;
    },
    close,
  };
}

/** A pooled connection to the branch database that holds the `neon_auth` schema. */
export function createNeonAuthDirectory(connectionString: string): NeonAuthDirectory {
  const client = postgres(connectionString, { max: 2 });

  return createNeonAuthDirectoryOver(
    async (query, params) =>
      [...(await client.unsafe(query, params as postgres.ParameterOrJSON<never>[]))] as Record<
        string,
        unknown
      >[],
    () => client.end(),
  );
}
