import { isNotNull, sql } from 'drizzle-orm';
import { toObjectKey } from '@vendor-marketplace/shared';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { TablesRelationalConfig } from 'drizzle-orm';
import { createDatabase, loadEnv } from '../index.js';
import { portfolioItems, users, vendorProfiles } from '../schema/index.js';

/**
 * Turns image columns that still hold an absolute URL into the object key they
 * were always describing.
 *
 * Rows now store a key so that moving the CDN is a config change rather than a
 * migration — but rows written before that change hold a full URL under the
 * old host, and a resolver that simply passed them through would leave the
 * data split across two hosts forever.
 *
 * **Re-runnable and idempotent.** A value that is already a key, or that
 * belongs to another host entirely (a Clerk avatar, a site-relative marketing
 * path), is left exactly as it is — so a second run changes nothing.
 */
export async function convertUrlsToKeys<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(
  base: string,
  /** The pooled client in production, or the suite's in-process PGlite. */
  database?: PgDatabase<TQueryResult, TFullSchema, TSchema>,
): Promise<{ table: string; converted: number }[]> {
  // The suite passes its own in-process database; the CLI opens one and closes
  // it, because a short-lived script must not leave a pool open.
  const owned = database ? null : createDatabase();
  const db = database ?? owned!.db;

  try {
    const results: { table: string; converted: number }[] = [];

    const profiles = await db
      .select({
        id: vendorProfiles.id,
        profileImageUrl: vendorProfiles.profileImageUrl,
        coverImageUrl: vendorProfiles.coverImageUrl,
      })
      .from(vendorProfiles);

    let converted = 0;
    for (const row of profiles) {
      const profileImageUrl = row.profileImageUrl ? toObjectKey(base, row.profileImageUrl) : null;
      const coverImageUrl = row.coverImageUrl ? toObjectKey(base, row.coverImageUrl) : null;

      if (profileImageUrl === row.profileImageUrl && coverImageUrl === row.coverImageUrl) {
        continue;
      }

      await db
        .update(vendorProfiles)
        .set({ profileImageUrl, coverImageUrl })
        .where(sql`${vendorProfiles.id} = ${row.id}`);
      converted += 1;
    }
    results.push({ table: 'vendor_profiles', converted });

    const items = await db
      .select({
        id: portfolioItems.id,
        imageUrl: portfolioItems.imageUrl,
        thumbnailUrl: portfolioItems.thumbnailUrl,
      })
      .from(portfolioItems);

    converted = 0;
    for (const row of items) {
      const imageUrl = toObjectKey(base, row.imageUrl);
      const thumbnailUrl = row.thumbnailUrl ? toObjectKey(base, row.thumbnailUrl) : null;

      if (imageUrl === row.imageUrl && thumbnailUrl === row.thumbnailUrl) {
        continue;
      }

      await db
        .update(portfolioItems)
        .set({ imageUrl, thumbnailUrl })
        .where(sql`${portfolioItems.id} = ${row.id}`);
      converted += 1;
    }
    results.push({ table: 'portfolio_items', converted });

    const people = await db
      .select({ id: users.id, avatarUrl: users.avatarUrl })
      .from(users)
      .where(isNotNull(users.avatarUrl));

    converted = 0;
    for (const row of people) {
      const avatarUrl = row.avatarUrl ? toObjectKey(base, row.avatarUrl) : null;

      if (avatarUrl === row.avatarUrl) {
        continue;
      }

      await db
        .update(users)
        .set({ avatarUrl })
        .where(sql`${users.id} = ${row.id}`);
      converted += 1;
    }
    results.push({ table: 'users', converted });

    return results;
  } finally {
    await owned?.client.end();
  }
}

/* c8 ignore start -- the CLI wrapper; the conversion itself is tested. */
if (process.argv[1]?.endsWith('keys-from-urls.ts')) {
  loadEnv();

  const base = process.env.S3_PUBLIC_URL;

  if (!base) {
    console.error('S3_PUBLIC_URL is not set; there is no base to strip.');
    process.exit(1);
  }

  const results = await convertUrlsToKeys(base);
  for (const result of results) {
    console.log(`${result.table}: ${result.converted} row(s) converted`);
  }
}
/* c8 ignore stop */
