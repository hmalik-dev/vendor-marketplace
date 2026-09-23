import { readFileSync } from 'node:fs';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { portfolioItems, users, vendorProfiles } from './schema/index.js';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * `0083` against image columns that still hold an absolute URL (VEN-648).
 *
 * The migration is data-only and re-runnable, so the suite migrates to head —
 * `migrateUpTo` cannot replay `0077`, which grants on the migrator's own schema
 * — writes the URL rows, and applies it again.
 */
const THIS_MIGRATION = '0083_image_columns_hold_keys';

const OWNER = '6f1c2b0a-1111-4222-8333-944445555666';
const PROFILE_KEY = `vendor-profile/${OWNER}/a1.webp`;
const COVER_KEY = `vendor-cover/${OWNER}/b2.webp`;
const IMAGE_KEY = `portfolio/${OWNER}/c3.webp`;
const THUMB_KEY = `portfolio/${OWNER}/c3-thumb.webp`;
const AVATAR_KEY = `customer-profile/${OWNER}/d4.webp`;

let testDb: TestDatabase;

async function applyMigration(tag: string): Promise<void> {
  const body = readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8');

  for (const statement of body.split('--> statement-breakpoint')) {
    if (statement.trim().length > 0) {
      await testDb.db.execute(sql.raw(statement));
    }
  }
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();
});

afterAll(async () => {
  await testDb.close();
});

describe('0083 against image columns written as URLs', () => {
  it('leaves every upload column holding the key and no host, and nothing else changed', async () => {
    const [vendorUser, customer, oauthCustomer] = await testDb.db
      .insert(users)
      .values([
        {
          authUserId: 'keys_vendor',
          email: 'keys-vendor@example.com',
          role: 'vendor',
          firstName: 'Kay',
          lastName: 'Vendor',
        },
        {
          authUserId: 'keys_customer',
          email: 'keys-customer@example.com',
          role: 'customer',
          firstName: 'Kay',
          lastName: 'Customer',
          avatarUrl: `http://localhost:9000/vendor-marketplace-uploads/${AVATAR_KEY}`,
        },
        {
          authUserId: 'keys_oauth',
          email: 'keys-oauth@example.com',
          role: 'customer',
          firstName: 'Kay',
          lastName: 'Customer',
          avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocK=s96-c',
        },
      ])
      .returning({ id: users.id });

    const [storageVendor, legacyVendor, seededVendor] = await testDb.db
      .insert(vendorProfiles)
      .values([
        {
          userId: vendorUser!.id,
          businessName: 'Keyed Studio',
          slug: 'keyed-studio',
          profileImageUrl: `https://storage.example.com/vendor-marketplace-uploads/${PROFILE_KEY}`,
          coverImageUrl: COVER_KEY,
        },
        {
          userId: customer!.id,
          businessName: 'Legacy Studio',
          slug: 'legacy-studio',
          // The R2 host uploads were served from before Neon.
          coverImageUrl: `https://pub-0123.r2.dev/${COVER_KEY}`,
        },
        {
          userId: oauthCustomer!.id,
          businessName: 'Seeded Studio',
          slug: 'seeded-studio',
          coverImageUrl: '/marketing/covers/seeded-studio.jpg',
          // A path that merely ends in something key-shaped is not an upload.
          profileImageUrl: `https://cdn.example.com/myportfolio/${OWNER}/e5.webp`,
        },
      ])
      .returning({ id: vendorProfiles.id });

    const [item] = await testDb.db
      .insert(portfolioItems)
      .values({
        vendorId: storageVendor!.id,
        imageUrl: `http://localhost:9000/vendor-marketplace-uploads/${IMAGE_KEY}`,
        thumbnailUrl: `http://localhost:9000/vendor-marketplace-uploads/${THUMB_KEY}`,
      })
      .returning({ id: portfolioItems.id });

    await applyMigration(THIS_MIGRATION);
    // Re-runnable: a second pass over keys changes nothing.
    await applyMigration(THIS_MIGRATION);

    const vendor = async (
      id: string,
    ): Promise<{ profileImageUrl: string | null; coverImageUrl: string | null }> => {
      const [row] = await testDb.db
        .select({
          profileImageUrl: vendorProfiles.profileImageUrl,
          coverImageUrl: vendorProfiles.coverImageUrl,
        })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, id));

      return row!;
    };

    expect(await vendor(storageVendor!.id)).toEqual({
      profileImageUrl: PROFILE_KEY,
      coverImageUrl: COVER_KEY,
    });
    expect(await vendor(legacyVendor!.id)).toEqual({
      profileImageUrl: null,
      coverImageUrl: COVER_KEY,
    });
    expect(await vendor(seededVendor!.id)).toEqual({
      profileImageUrl: `https://cdn.example.com/myportfolio/${OWNER}/e5.webp`,
      coverImageUrl: '/marketing/covers/seeded-studio.jpg',
    });

    const [portfolio] = await testDb.db
      .select({ imageUrl: portfolioItems.imageUrl, thumbnailUrl: portfolioItems.thumbnailUrl })
      .from(portfolioItems)
      .where(eq(portfolioItems.id, item!.id));
    expect(portfolio).toEqual({ imageUrl: IMAGE_KEY, thumbnailUrl: THUMB_KEY });

    const avatars = await testDb.db
      .select({ id: users.id, avatarUrl: users.avatarUrl })
      .from(users)
      .where(sql`${users.id} in (${customer!.id}, ${oauthCustomer!.id})`);
    expect(Object.fromEntries(avatars.map((row) => [row.id, row.avatarUrl]))).toEqual({
      [customer!.id]: AVATAR_KEY,
      [oauthCustomer!.id]: 'https://lh3.googleusercontent.com/a/ACg8ocK=s96-c',
    });
  });
});
