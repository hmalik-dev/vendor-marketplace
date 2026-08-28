import { asc, eq, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { TablesRelationalConfig } from 'drizzle-orm';
import { createDatabase, loadEnv } from '../index.js';
import { portfolioItems, vendorProfiles } from '../schema/index.js';

/**
 * Brings every vendor's stored cover into line with their portfolio order.
 *
 * The cover became a designation on the first portfolio tile rather than its
 * own upload, so rows written before that change can disagree with the list in
 * two ways, and the two want opposite treatment:
 *
 * - **The cover is a photo further down the portfolio**, or there is no cover
 *   at all. The list is the truth now, so the first item wins.
 * - **The cover is an image that is not in the portfolio at all.** Taking the
 *   list's word here would silently delete a picture the vendor deliberately
 *   chose, so it is *adopted* instead: inserted as the first portfolio item,
 *   which both keeps their choice and makes it visible where they can move it.
 *
 * Re-runnable and idempotent — a second run finds nothing to do.
 */
export async function alignCoversWithPortfolios<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(
  database?: PgDatabase<TQueryResult, TFullSchema, TSchema>,
): Promise<{ adopted: number; repointed: number; cleared: number; unchanged: number }> {
  const owned = database ? null : createDatabase();
  const db = database ?? owned!.db;

  try {
    const summary = { adopted: 0, repointed: 0, cleared: 0, unchanged: 0 };

    const vendors = await db
      .select({ id: vendorProfiles.id, coverImageUrl: vendorProfiles.coverImageUrl })
      .from(vendorProfiles);

    for (const vendor of vendors) {
      const items = await db
        .select({ id: portfolioItems.id, imageUrl: portfolioItems.imageUrl })
        .from(portfolioItems)
        .where(eq(portfolioItems.vendorId, vendor.id))
        .orderBy(asc(portfolioItems.displayOrder), asc(portfolioItems.id));

      const cover = vendor.coverImageUrl;
      const first = items[0]?.imageUrl ?? null;

      if (cover !== null && !items.some((item) => item.imageUrl === cover)) {
        // Adopted: everything already there shifts down by one.
        await db.transaction(async (tx) => {
          for (const [index, item] of items.entries()) {
            await tx
              .update(portfolioItems)
              .set({ displayOrder: index + 1 })
              .where(eq(portfolioItems.id, item.id));
          }

          await tx
            .insert(portfolioItems)
            .values({ vendorId: vendor.id, imageUrl: cover, displayOrder: 0 });
        });
        summary.adopted += 1;
        continue;
      }

      if (cover === first) {
        summary.unchanged += 1;
        continue;
      }

      await db
        .update(vendorProfiles)
        .set({ coverImageUrl: first, updatedAt: sql`now()` })
        .where(eq(vendorProfiles.id, vendor.id));

      if (first === null) {
        summary.cleared += 1;
      } else {
        summary.repointed += 1;
      }
    }

    return summary;
  } finally {
    await owned?.client.end();
  }
}

/* c8 ignore start -- the CLI wrapper; the alignment itself is tested. */
if (process.argv[1]?.endsWith('cover-from-portfolio.ts')) {
  loadEnv();

  const summary = await alignCoversWithPortfolios();
  process.stdout.write(
    `${summary.adopted} cover(s) adopted into the portfolio\n` +
      `${summary.repointed} repointed at the first photo\n` +
      `${summary.cleared} cleared (empty portfolio)\n` +
      `${summary.unchanged} already correct\n`,
  );
}
/* c8 ignore stop */
