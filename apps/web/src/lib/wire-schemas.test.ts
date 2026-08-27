import { describe, expect, it } from 'vitest';
import {
  wireCategoryListSchema,
  wireTagListSchema,
  wireUserSchema,
  wireVendorProfileSchema,
} from './wire-schemas';

const UUID = '11111111-1111-4111-8111-111111111111';
const ISO = '2026-01-01T00:00:00.000Z';

const TAG_JSON = {
  id: UUID,
  name: 'Spanish',
  slug: 'language-spanish',
  category: 'language',
  displayOrder: 2,
  isActive: true,
  createdAt: ISO,
};

describe('wireUserSchema', () => {
  it('coerces the ISO timestamps a JSON response carries', () => {
    const parsed = wireUserSchema.parse({
      id: UUID,
      clerkUserId: 'user_123',
      email: 'grace@example.com',
      role: 'vendor',
      firstName: 'Grace',
      lastName: 'Hopper',
      phone: null,
      avatarUrl: null,
      stripeCustomerId: null,
      bio: null,
      city: null,
      state: null,
      budgetTier: null,
      typicalGuestCountMin: null,
      typicalGuestCountMax: null,
      avgCustomerRating: 0,
      customerReviewCount: 0,
      totalBookingsCount: 0,
      completedBookingsCount: 0,
      cancelledBookingsCount: 0,
      isBanned: false,
      bannedAt: null,
      deletedAt: null,
      createdAt: ISO,
      updatedAt: ISO,
    });

    expect(parsed.createdAt).toBeInstanceOf(Date);
  });
});

describe('wireTagListSchema', () => {
  /*
   * The domain `tagSchema` types `createdAt` as a `Date`, so validating a JSON
   * response against it rejects every tag. `PUT /vendor/tags` returns exactly
   * this shape, and getting it wrong failed the whole profile save.
   */
  it('accepts the ISO timestamp a tag response actually carries', () => {
    const parsed = wireTagListSchema.parse([TAG_JSON]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.createdAt).toBeInstanceOf(Date);
    expect(parsed[0]?.name).toBe('Spanish');
  });

  it('still rejects a tag category outside the shared set', () => {
    expect(
      wireTagListSchema.safeParse([{ ...TAG_JSON, category: 'religious_dietary' }]).success,
    ).toBe(false);
  });
});

describe('wireCategoryListSchema', () => {
  it('accepts the category list as the API serialises it', () => {
    const parsed = wireCategoryListSchema.parse([
      {
        id: UUID,
        name: 'Photography',
        slug: 'photography',
        description: 'Photographers for weddings.',
        icon: 'camera',
        displayOrder: 1,
        isActive: true,
      },
    ]);

    expect(parsed[0]?.slug).toBe('photography');
  });
});

describe('wireVendorProfileSchema', () => {
  const PROFILE_JSON = {
    id: UUID,
    userId: UUID,
    businessName: 'Sunlit Studio',
    slug: 'sunlit-studio',
    bio: 'Documentary wedding photography.',
    profileImageUrl: null,
    coverImageUrl: 'http://localhost:9000/vendor-marketplace-uploads/vendor-cover/abc.webp',
    address: null,
    city: 'Austin',
    state: 'Texas',
    latitude: null,
    longitude: null,
    serviceRadiusKm: 50,
    responseTimeHours: 24,
    stripeAccountId: null,
    stripeOnboarded: false,
    isPublished: false,
    isDeleted: false,
    avgRating: 0,
    reviewCount: 0,
    categoryIds: [UUID],
    tags: [TAG_JSON],
    publishBlockers: [],
    createdAt: ISO,
    updatedAt: ISO,
  };

  it('coerces the profile and its nested tag timestamps', () => {
    const parsed = wireVendorProfileSchema.parse(PROFILE_JSON);

    expect(parsed.updatedAt).toBeInstanceOf(Date);
    expect(parsed.tags[0]?.createdAt).toBeInstanceOf(Date);
  });

  /*
   * Blockers travel as keys rather than sentences: the field, the section nav
   * and the submit bar each need a different rendering of the same blocker, and
   * re-deriving one from another's wording is how they drift apart.
   */
  it('carries the outstanding publish prerequisites as keys', () => {
    const parsed = wireVendorProfileSchema.parse({
      ...PROFILE_JSON,
      publishBlockers: ['bio', 'responseTime'],
    });

    expect(parsed.publishBlockers).toEqual(['bio', 'responseTime']);
  });

  it('rejects a blocker the client has no rendering for', () => {
    expect(
      wireVendorProfileSchema.safeParse({
        ...PROFILE_JSON,
        publishBlockers: ['Write a short bio so customers know what you do'],
      }).success,
    ).toBe(false);
  });

  it('rejects a profile response with no publish prerequisites field', () => {
    const withoutBlockers: Record<string, unknown> = { ...PROFILE_JSON };
    delete withoutBlockers.publishBlockers;

    expect(wireVendorProfileSchema.safeParse(withoutBlockers).success).toBe(false);
  });
});
