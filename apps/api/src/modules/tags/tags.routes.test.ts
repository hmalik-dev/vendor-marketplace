import { and, eq, inArray } from 'drizzle-orm';
import {
  categories,
  tagSuggestions,
  tags,
  users,
  vendorProfiles,
  vendorTags,
} from '@vendor-marketplace/db/schema';
import { MAX_TAGS_PER_CATEGORY, type TagCategory } from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const VENDOR = 'user_vendor';
const CUSTOMER = 'user_customer';

describe('tag routes', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function tagIdsFor(category: TagCategory, count: number): Promise<string[]> {
    const rows = await harness.database.db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.category, category), eq(tags.isActive, true)))
      .limit(count);

    expect(rows).toHaveLength(count);
    return rows.map((row) => row.id);
  }

  async function tagIdByName(name: string): Promise<string> {
    const rows = await harness.database.db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.name, name))
      .limit(1);

    const row = rows[0];
    expect(row).toBeDefined();
    return row!.id;
  }

  async function createVendorProfile(): Promise<void> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
      },
    });
    expect(response.statusCode).toBe(201);
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role] of [
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email: `${clerkUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    const rows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = rows[0]!.id;
  });

  afterEach(async () => {
    await harness.database.db.delete(tagSuggestions);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    // Reactivate anything a test deactivated so the seeded list is intact.
    await harness.database.db.update(tags).set({ isActive: true });
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('GET /tags', () => {
    it('is reachable without a session', async () => {
      const response = await harness.app.inject({ method: 'GET', url: '/tags' });

      expect(response.statusCode).toBe(200);
      expect(response.json().length).toBeGreaterThan(0);
    });

    it('covers every picker section, including the scoped one', async () => {
      const response = await harness.app.inject({ method: 'GET', url: '/tags' });
      const seen = new Set<string>(
        response.json().map((tag: { category: string }) => tag.category),
      );

      expect([...seen].sort()).toEqual(['cultural', 'dietary', 'language', 'style']);
    });

    /*
     * A style tag is only meaningful beside the vendor category it belongs to —
     * "Family style" says nothing about a florist — so the scope travels with
     * the row rather than being looked up separately by whoever renders it.
     */
    it('carries the vendor category a style tag is scoped to, and only for style', async () => {
      const response = await harness.app.inject({ method: 'GET', url: '/tags' });
      const rows = response.json() as { category: string; vendorCategoryId: string | null }[];

      for (const row of rows) {
        expect(row.vendorCategoryId === null).toBe(row.category !== 'style');
      }

      expect(rows.some((row) => row.category === 'style')).toBe(true);
    });

    it('omits a deactivated tag', async () => {
      const spanishId = await tagIdByName('Spanish');
      await harness.database.db.update(tags).set({ isActive: false }).where(eq(tags.id, spanishId));

      const response = await harness.app.inject({ method: 'GET', url: '/tags' });
      const ids = response.json().map((tag: { id: string }) => tag.id);

      expect(ids).not.toContain(spanishId);
    });
  });

  describe('PUT /vendor/tags', () => {
    it('rejects a customer', async () => {
      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/tags',
        headers: bearer(CUSTOMER),
        payload: { tagIds: [] },
      });

      expect(response.statusCode).toBe(403);
    });

    it('answers 404 when the vendor has no profile yet', async () => {
      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/tags',
        headers: bearer(VENDOR),
        payload: { tagIds: [] },
      });

      expect(response.statusCode).toBe(404);
    });

    it('stores the selection and returns the resolved tags', async () => {
      await createVendorProfile();
      const tagIds = await tagIdsFor('language', 2);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/tags',
        headers: bearer(VENDOR),
        payload: { tagIds },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveLength(2);
      expect(await harness.database.db.select().from(vendorTags)).toHaveLength(2);
    });

    it('replaces the previous selection rather than adding to it', async () => {
      await createVendorProfile();
      const [first, second] = await tagIdsFor('language', 2);

      await harness.app.inject({
        method: 'PUT',
        url: '/vendor/tags',
        headers: bearer(VENDOR),
        payload: { tagIds: [first] },
      });
      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/tags',
        headers: bearer(VENDOR),
        payload: { tagIds: [second] },
      });

      expect(response.json().map((tag: { id: string }) => tag.id)).toEqual([second]);
      const stored = await harness.database.db.select().from(vendorTags);
      expect(stored.map((row) => row.tagId)).toEqual([second]);
    });

    it('accepts an empty array as "clear my tags"', async () => {
      await createVendorProfile();
      const tagIds = await tagIdsFor('language', 2);
      await harness.app.inject({
        method: 'PUT',
        url: '/vendor/tags',
        headers: bearer(VENDOR),
        payload: { tagIds },
      });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/tags',
        headers: bearer(VENDOR),
        payload: { tagIds: [] },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
      expect(await harness.database.db.select().from(vendorTags)).toHaveLength(0);
    });

    it('collapses a duplicate id rather than failing the insert', async () => {
      await createVendorProfile();
      const [only] = await tagIdsFor('language', 1);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/tags',
        headers: bearer(VENDOR),
        payload: { tagIds: [only, only] },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveLength(1);
    });

    it('rejects a tag id that does not exist', async () => {
      await createVendorProfile();

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/tags',
        headers: bearer(VENDOR),
        payload: { tagIds: ['11111111-1111-4111-8111-111111111111'] },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toMatch(/tags are unavailable/i);
    });

    /*
     * #222: the storefront editor saves tags in the same submit as the profile,
     * so a refusal here has to reach the tag picker rather than a toast the
     * vendor has to match to a control by hand.
     */
    it('names the offending field, so the editor can mark the right control', async () => {
      await createVendorProfile();

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/tags',
        headers: bearer(VENDOR),
        payload: { tagIds: ['11111111-1111-4111-8111-111111111111'] },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().details).toEqual({ field: 'tagIds' });
    });

    it('rejects a deactivated tag', async () => {
      await createVendorProfile();
      const spanishId = await tagIdByName('Spanish');
      await harness.database.db.update(tags).set({ isActive: false }).where(eq(tags.id, spanishId));

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/tags',
        headers: bearer(VENDOR),
        payload: { tagIds: [spanishId] },
      });

      expect(response.statusCode).toBe(400);
    });

    it(`rejects more than ${MAX_TAGS_PER_CATEGORY} tags in one category`, async () => {
      await createVendorProfile();
      const tagIds = await tagIdsFor('language', MAX_TAGS_PER_CATEGORY + 1);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/tags',
        headers: bearer(VENDOR),
        payload: { tagIds },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toMatch(/at most 5 tags per category/i);
      expect(await harness.database.db.select().from(vendorTags)).toHaveLength(0);
    });

    it('allows the per-category maximum in each category at once', async () => {
      await createVendorProfile();
      const tagIds = [
        ...(await tagIdsFor('language', MAX_TAGS_PER_CATEGORY)),
        ...(await tagIdsFor('cultural', MAX_TAGS_PER_CATEGORY)),
        ...(await tagIdsFor('dietary', 4)),
      ];

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/tags',
        headers: bearer(VENDOR),
        payload: { tagIds },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveLength(14);
    });

    it('surfaces the selection on the vendor profile', async () => {
      await createVendorProfile();
      const tagIds = await tagIdsFor('language', 2);
      await harness.app.inject({
        method: 'PUT',
        url: '/vendor/tags',
        headers: bearer(VENDOR),
        payload: { tagIds },
      });

      const profile = await harness.app.inject({
        method: 'GET',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
      });

      expect(profile.json().tags).toHaveLength(2);
    });
  });

  describe('POST /tags/suggest', () => {
    it('rejects a customer', async () => {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/tags/suggest',
        headers: bearer(CUSTOMER),
        payload: { suggestedName: 'Amharic', category: 'language' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('records a genuinely new suggestion for review', async () => {
      await createVendorProfile();

      const response = await harness.app.inject({
        method: 'POST',
        url: '/tags/suggest',
        headers: bearer(VENDOR),
        payload: { suggestedName: 'Amharic', category: 'language' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('submitted');

      const rows = await harness.database.db.select().from(tagSuggestions);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ suggestedName: 'Amharic', status: 'pending' });
    });

    it('hands back the existing tag on an exact match', async () => {
      await createVendorProfile();

      const response = await harness.app.inject({
        method: 'POST',
        url: '/tags/suggest',
        headers: bearer(VENDOR),
        payload: { suggestedName: 'Spanish', category: 'language' },
      });

      expect(response.json()).toMatchObject({ status: 'exists', tag: { name: 'Spanish' } });
      expect(await harness.database.db.select().from(tagSuggestions)).toHaveLength(0);
    });

    it('matches case-insensitively', async () => {
      await createVendorProfile();

      const response = await harness.app.inject({
        method: 'POST',
        url: '/tags/suggest',
        headers: bearer(VENDOR),
        payload: { suggestedName: 'spanish', category: 'language' },
      });

      expect(response.json().status).toBe('exists');
    });

    it('matches across whitespace variants', async () => {
      await createVendorProfile();

      const response = await harness.app.inject({
        method: 'POST',
        url: '/tags/suggest',
        headers: bearer(VENDOR),
        payload: { suggestedName: '  south   asian ', category: 'cultural' },
      });

      expect(response.json()).toMatchObject({ status: 'exists', tag: { name: 'South Asian' } });
    });

    it('does not match a tag of the same name in another category', async () => {
      await createVendorProfile();

      const response = await harness.app.inject({
        method: 'POST',
        url: '/tags/suggest',
        headers: bearer(VENDOR),
        payload: { suggestedName: 'Spanish', category: 'cultural' },
      });

      expect(response.json().status).toBe('submitted');
    });

    it('does not auto-match a deactivated tag', async () => {
      await createVendorProfile();
      const spanishId = await tagIdByName('Spanish');
      await harness.database.db.update(tags).set({ isActive: false }).where(eq(tags.id, spanishId));

      const response = await harness.app.inject({
        method: 'POST',
        url: '/tags/suggest',
        headers: bearer(VENDOR),
        payload: { suggestedName: 'Spanish', category: 'language' },
      });

      expect(response.json().status).toBe('submitted');
    });

    it('reports a suggestion already awaiting review', async () => {
      await createVendorProfile();
      await harness.app.inject({
        method: 'POST',
        url: '/tags/suggest',
        headers: bearer(VENDOR),
        payload: { suggestedName: 'Amharic', category: 'language' },
      });

      const response = await harness.app.inject({
        method: 'POST',
        url: '/tags/suggest',
        headers: bearer(VENDOR),
        payload: { suggestedName: '  AMHARIC  ', category: 'language' },
      });

      expect(response.json().status).toBe('already_suggested');
      expect(await harness.database.db.select().from(tagSuggestions)).toHaveLength(1);
    });

    it('ignores a rejected suggestion when deduping', async () => {
      await createVendorProfile();
      await harness.app.inject({
        method: 'POST',
        url: '/tags/suggest',
        headers: bearer(VENDOR),
        payload: { suggestedName: 'Amharic', category: 'language' },
      });
      await harness.database.db.update(tagSuggestions).set({ status: 'rejected' });

      const response = await harness.app.inject({
        method: 'POST',
        url: '/tags/suggest',
        headers: bearer(VENDOR),
        payload: { suggestedName: 'Amharic', category: 'language' },
      });

      expect(response.json().status).toBe('submitted');
    });

    it('rejects a whitespace-only name', async () => {
      await createVendorProfile();

      const response = await harness.app.inject({
        method: 'POST',
        url: '/tags/suggest',
        headers: bearer(VENDOR),
        payload: { suggestedName: '   ', category: 'language' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('keeps a pending suggestion invisible to the public tag list', async () => {
      await createVendorProfile();
      await harness.app.inject({
        method: 'POST',
        url: '/tags/suggest',
        headers: bearer(VENDOR),
        payload: { suggestedName: 'Amharic', category: 'language' },
      });

      const response = await harness.app.inject({ method: 'GET', url: '/tags' });
      const names = response.json().map((tag: { name: string }) => tag.name);

      expect(names).not.toContain('Amharic');
    });
  });

  describe('GET /categories', () => {
    it('lists the seeded categories in display order', async () => {
      const response = await harness.app.inject({ method: 'GET', url: '/categories' });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body[0]).toMatchObject({ slug: 'photography', displayOrder: 1 });
    });

    it('omits a deactivated category', async () => {
      await harness.database.db
        .update(categories)
        .set({ isActive: false })
        .where(eq(categories.slug, 'photography'));

      const response = await harness.app.inject({ method: 'GET', url: '/categories' });
      const slugs = response.json().map((category: { slug: string }) => category.slug);
      expect(slugs).not.toContain('photography');

      await harness.database.db
        .update(categories)
        .set({ isActive: true })
        .where(inArray(categories.slug, ['photography']));
    });
  });
});
