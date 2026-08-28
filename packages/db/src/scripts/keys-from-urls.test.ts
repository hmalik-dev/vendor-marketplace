import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../testing/test-db.js';
import { portfolioItems, users, vendorProfiles } from '../schema/index.js';
import { convertUrlsToKeys } from './keys-from-urls.js';

const BASE = 'https://pub-f0933b41.r2.dev';

describe('convertUrlsToKeys', () => {
  let database: TestDatabase;
  let vendorId: string;
  let userId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.runMigrations();

    const [person] = await database.db
      .insert(users)
      .values({
        clerkUserId: 'user_test',
        email: 'grace@example.com',
        firstName: 'Grace',
        lastName: 'Hopper',
        role: 'vendor',
        // A Clerk avatar: not ours to host, and must survive untouched.
        avatarUrl: 'https://img.clerk.com/abc',
      })
      .returning();
    userId = person!.id;

    const [profile] = await database.db
      .insert(vendorProfiles)
      .values({
        userId,
        businessName: 'Sunlit Studio',
        slug: 'sunlit-studio',
        profileImageUrl: `${BASE}/vendor-profile/a.webp`,
        // Already a key: a second run must not double-strip it.
        coverImageUrl: 'vendor-cover/b.webp',
      })
      .returning();
    vendorId = profile!.id;

    await database.db.insert(portfolioItems).values([
      {
        vendorId,
        imageUrl: `${BASE}/portfolio/c.webp`,
        thumbnailUrl: `${BASE}/portfolio/c-thumb.webp`,
        displayOrder: 0,
      },
      {
        // A seeded marketing path the web app serves itself.
        vendorId,
        imageUrl: '/marketing/vendors/june-harlow.jpg',
        thumbnailUrl: null,
        displayOrder: 1,
      },
    ]);
  });

  afterAll(async () => {
    await database.close();
  });

  it('strips the base so an absolute URL becomes its key', async () => {
    await convertUrlsToKeys(BASE, database.db);

    const [profile] = await database.db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendorId));

    expect(profile?.profileImageUrl).toBe('vendor-profile/a.webp');
    // Already a key before the run, and unchanged by it.
    expect(profile?.coverImageUrl).toBe('vendor-cover/b.webp');
  });

  it('converts both portfolio variants and leaves a marketing path alone', async () => {
    const items = await database.db
      .select()
      .from(portfolioItems)
      .where(eq(portfolioItems.vendorId, vendorId))
      .orderBy(portfolioItems.displayOrder);

    expect(items[0]?.imageUrl).toBe('portfolio/c.webp');
    expect(items[0]?.thumbnailUrl).toBe('portfolio/c-thumb.webp');
    expect(items[1]?.imageUrl).toBe('/marketing/vendors/june-harlow.jpg');
  });

  /* Not ours to host, so not ours to rewrite. */
  it('leaves a Clerk avatar exactly as it was', async () => {
    const [person] = await database.db.select().from(users).where(eq(users.id, userId));

    expect(person?.avatarUrl).toBe('https://img.clerk.com/abc');
  });

  it('changes nothing on a second run', async () => {
    const results = await convertUrlsToKeys(BASE, database.db);

    expect(results.every((result) => result.converted === 0)).toBe(true);
  });
});
