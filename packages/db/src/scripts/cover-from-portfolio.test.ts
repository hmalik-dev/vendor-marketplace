import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../testing/test-db.js';
import { portfolioItems, users, vendorProfiles } from '../schema/index.js';
import { alignCoversWithPortfolios } from './cover-from-portfolio.js';

describe('alignCoversWithPortfolios', () => {
  let database: TestDatabase;
  let vendorId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.runMigrations();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.db.delete(vendorProfiles);
    await database.db.delete(users);

    const [person] = await database.db
      .insert(users)
      .values({
        clerkUserId: `user_${Math.random().toString(36).slice(2)}`,
        email: `${Math.random().toString(36).slice(2)}@example.com`,
        firstName: 'Cover',
        lastName: 'Vendor',
        role: 'vendor',
      })
      .returning();

    const [profile] = await database.db
      .insert(vendorProfiles)
      .values({ userId: person!.id, businessName: 'Cover Studio', slug: 'cover-studio' })
      .returning();
    vendorId = profile!.id;
  });

  async function setPortfolio(...imageUrls: string[]): Promise<void> {
    await database.db.insert(portfolioItems).values(
      imageUrls.map((imageUrl, index) => ({
        vendorId,
        imageUrl,
        displayOrder: index,
      })),
    );
  }

  async function coverOf(): Promise<string | null> {
    const [row] = await database.db
      .select({ coverImageUrl: vendorProfiles.coverImageUrl })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendorId));

    return row?.coverImageUrl ?? null;
  }

  async function portfolioOf(): Promise<string[]> {
    const rows = await database.db
      .select({ imageUrl: portfolioItems.imageUrl })
      .from(portfolioItems)
      .where(eq(portfolioItems.vendorId, vendorId))
      .orderBy(asc(portfolioItems.displayOrder));

    return rows.map((row) => row.imageUrl);
  }

  it('repoints a cover that sits further down the portfolio', async () => {
    await setPortfolio('a.webp', 'b.webp');
    await database.db
      .update(vendorProfiles)
      .set({ coverImageUrl: 'b.webp' })
      .where(eq(vendorProfiles.id, vendorId));

    const summary = await alignCoversWithPortfolios(database.db);

    expect(summary.repointed).toBe(1);
    expect(await coverOf()).toBe('a.webp');
  });

  /*
   * The edge the ticket names. Taking the list's word would silently delete a
   * picture the vendor deliberately chose, so it is adopted instead.
   */
  it('adopts a cover that is not in the portfolio at all, as the first item', async () => {
    await setPortfolio('a.webp', 'b.webp');
    await database.db
      .update(vendorProfiles)
      .set({ coverImageUrl: 'chosen.webp' })
      .where(eq(vendorProfiles.id, vendorId));

    const summary = await alignCoversWithPortfolios(database.db);

    expect(summary.adopted).toBe(1);
    expect(await portfolioOf()).toEqual(['chosen.webp', 'a.webp', 'b.webp']);
    expect(await coverOf()).toBe('chosen.webp');
  });

  it('adopts a cover even when the portfolio is empty', async () => {
    await database.db
      .update(vendorProfiles)
      .set({ coverImageUrl: 'chosen.webp' })
      .where(eq(vendorProfiles.id, vendorId));

    await alignCoversWithPortfolios(database.db);

    expect(await portfolioOf()).toEqual(['chosen.webp']);
  });

  it('gives a vendor with no photos no cover', async () => {
    await database.db
      .update(vendorProfiles)
      .set({ coverImageUrl: null })
      .where(eq(vendorProfiles.id, vendorId));

    const summary = await alignCoversWithPortfolios(database.db);

    expect(summary.unchanged).toBe(1);
    expect(await coverOf()).toBeNull();
  });

  it('fills in a missing cover from the first photo', async () => {
    await setPortfolio('a.webp', 'b.webp');

    await alignCoversWithPortfolios(database.db);

    expect(await coverOf()).toBe('a.webp');
  });

  it('changes nothing on a second run', async () => {
    await setPortfolio('a.webp', 'b.webp');
    await database.db
      .update(vendorProfiles)
      .set({ coverImageUrl: 'chosen.webp' })
      .where(eq(vendorProfiles.id, vendorId));

    await alignCoversWithPortfolios(database.db);
    const second = await alignCoversWithPortfolios(database.db);

    expect(second).toMatchObject({ adopted: 0, repointed: 0, cleared: 0, unchanged: 1 });
    expect(await portfolioOf()).toEqual(['chosen.webp', 'a.webp', 'b.webp']);
  });
});
