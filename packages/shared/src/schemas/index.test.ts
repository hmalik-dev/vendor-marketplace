import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  apiErrorSchema,
  availabilityBulkUpdateSchema,
  bookingRequestSchema,
  createBookingRequestSchema,
  createReviewSchema,
  createServicePackageSchema,
  updateServicePackageSchema,
  createTagSuggestionSchema,
  createVendorProfileSchema,
  paginatedSchema,
  sendMessageSchema,
  setVendorTagsSchema,
  tagSchema,
  tagSuggestionResponseSchema,
  uploadedImageSchema,
  updateUserSchema,
  userSchema,
  vendorProfileDetailSchema,
  vendorSearchQuerySchema,
} from './index.js';
import {
  BOOKING_REQUEST_NOTES_MAX_LENGTH,
  ERROR_CODES,
  MAX_CUSTOMER_BIO_LENGTH,
  MAX_PACKAGE_PRICE_CENTS,
  MAX_TAGS_PER_CATEGORY,
  MESSAGE_MAX_LENGTH,
  MIN_BOOKING_AMOUNT_CENTS,
  RESPONSE_TIME_HOURS_OPTIONS,
  TAG_CATEGORIES,
} from '../constants/index.js';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('userSchema', () => {
  const valid = {
    id: UUID,
    clerkUserId: 'user_2abc',
    email: 'jane@example.com',
    role: 'customer',
    firstName: 'Jane',
    lastName: 'Doe',
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
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('accepts a well-formed user row', () => {
    expect(userSchema.parse(valid)).toMatchObject({ email: 'jane@example.com', role: 'customer' });
  });

  it('rejects an unknown role', () => {
    expect(userSchema.safeParse({ ...valid, role: 'superadmin' }).success).toBe(false);
  });

  it('rejects a malformed email', () => {
    expect(userSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('accepts a filled-in customer profile', () => {
    const parsed = userSchema.parse({
      ...valid,
      bio: 'Planning my wedding!',
      city: 'Austin',
      state: 'TX',
      budgetTier: 'mid_range',
      typicalGuestCountMin: 50,
      typicalGuestCountMax: 150,
      avgCustomerRating: 4.5,
      customerReviewCount: 2,
      totalBookingsCount: 3,
      completedBookingsCount: 2,
      cancelledBookingsCount: 1,
    });
    expect(parsed.budgetTier).toBe('mid_range');
    expect(parsed.avgCustomerRating).toBe(4.5);
    expect(parsed.completedBookingsCount).toBe(2);
  });

  it('rejects an unknown budget tier', () => {
    expect(userSchema.safeParse({ ...valid, budgetTier: 'champagne' }).success).toBe(false);
  });

  it('rejects a negative derived booking counter', () => {
    expect(userSchema.safeParse({ ...valid, completedBookingsCount: -1 }).success).toBe(false);
  });

  it('accepts a row whose name is not set yet', () => {
    // Clerk's email-and-password sign-up collects no name, so the row the API
    // lazily creates has none until the user fills their profile in.
    const parsed = userSchema.parse({ ...valid, firstName: '', lastName: '' });

    expect(parsed.firstName).toBe('');
    expect(parsed.lastName).toBe('');
  });

  it('still rejects a name past the length ceiling', () => {
    const tooLong = 'x'.repeat(101);

    expect(userSchema.safeParse({ ...valid, firstName: tooLong }).success).toBe(false);
  });

  it('accepts a row retired after its Clerk identity was deleted', () => {
    const deletedAt = new Date('2026-02-01T00:00:00.000Z');

    expect(userSchema.parse({ ...valid, deletedAt }).deletedAt).toEqual(deletedAt);
  });
});

describe('updateUserSchema', () => {
  it('trims names before validating emptiness', () => {
    expect(updateUserSchema.parse({ firstName: '  Jane  ' })).toEqual({ firstName: 'Jane' });
  });

  it('rejects a whitespace-only name', () => {
    expect(updateUserSchema.safeParse({ firstName: '   ' }).success).toBe(false);
  });

  it('refuses to blank out a name that has already been set', () => {
    expect(updateUserSchema.safeParse({ firstName: '' }).success).toBe(false);
  });

  it('rejects an empty payload so a no-op update cannot reach the DAO', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a customer profile edit', () => {
    expect(updateUserSchema.parse({ budgetTier: 'luxury', city: '  Austin  ', bio: 'Hi' })).toEqual(
      { budgetTier: 'luxury', city: 'Austin', bio: 'Hi' },
    );
  });

  it('allows clearing an optional profile field with null', () => {
    expect(updateUserSchema.parse({ budgetTier: null })).toEqual({ budgetTier: null });
  });

  it('rejects a bio past the length ceiling', () => {
    const result = updateUserSchema.safeParse({ bio: 'x'.repeat(MAX_CUSTOMER_BIO_LENGTH + 1) });
    expect(result.success).toBe(false);
  });

  it('rejects a guest count range whose minimum exceeds its maximum', () => {
    const result = updateUserSchema.safeParse({
      typicalGuestCountMin: 200,
      typicalGuestCountMax: 100,
    });
    expect(result.success).toBe(false);
  });

  it('accepts an equal guest count minimum and maximum', () => {
    expect(
      updateUserSchema.parse({ typicalGuestCountMin: 100, typicalGuestCountMax: 100 }),
    ).toEqual({ typicalGuestCountMin: 100, typicalGuestCountMax: 100 });
  });

  it('accepts a lone guest count bound', () => {
    expect(updateUserSchema.safeParse({ typicalGuestCountMin: 200 }).success).toBe(true);
  });

  it('rejects a derived stat submitted as a profile edit', () => {
    expect(updateUserSchema.parse({ bio: 'Hi', customerReviewCount: 99 })).toEqual({ bio: 'Hi' });
  });
});

describe('tagSchema', () => {
  const valid = {
    id: UUID,
    name: 'South Asian',
    slug: 'cultural-south-asian',
    category: 'cultural',
    displayOrder: 1,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('accepts a well-formed tag row', () => {
    expect(tagSchema.parse(valid)).toMatchObject({ slug: 'cultural-south-asian' });
  });

  it('rejects a tag category outside the shared set', () => {
    expect(tagSchema.safeParse({ ...valid, category: 'religious_dietary' }).success).toBe(false);
  });

  it('rejects a slug that is not URL-safe', () => {
    expect(tagSchema.safeParse({ ...valid, slug: 'South Asian' }).success).toBe(false);
  });
});

describe('createTagSuggestionSchema', () => {
  it('trims the suggested name before validating', () => {
    expect(
      createTagSuggestionSchema.parse({ suggestedName: '  Amharic  ', category: 'language' }),
    ).toEqual({ suggestedName: 'Amharic', category: 'language' });
  });

  it('rejects a whitespace-only suggestion', () => {
    expect(
      createTagSuggestionSchema.safeParse({ suggestedName: '   ', category: 'language' }).success,
    ).toBe(false);
  });

  it('rejects an unknown category', () => {
    expect(
      createTagSuggestionSchema.safeParse({ suggestedName: 'Amharic', category: 'other' }).success,
    ).toBe(false);
  });
});

describe('setVendorTagsSchema', () => {
  it('accepts an empty selection so a vendor can clear every tag', () => {
    expect(setVendorTagsSchema.parse({ tagIds: [] })).toEqual({ tagIds: [] });
  });

  it('rejects more tags than every category combined allows', () => {
    const tooMany = Array.from(
      { length: TAG_CATEGORIES.length * MAX_TAGS_PER_CATEGORY + 1 },
      () => UUID,
    );
    expect(setVendorTagsSchema.safeParse({ tagIds: tooMany }).success).toBe(false);
  });

  it('rejects a non-uuid tag id', () => {
    expect(setVendorTagsSchema.safeParse({ tagIds: ['not-a-uuid'] }).success).toBe(false);
  });
});

describe('createVendorProfileSchema', () => {
  const valid = {
    businessName: 'Golden Hour Photography',
    categoryIds: [UUID],
    city: 'Austin',
    state: 'TX',
  };

  it('accepts the minimum required profile', () => {
    expect(createVendorProfileSchema.parse(valid).businessName).toBe('Golden Hour Photography');
  });

  it('requires at least one category', () => {
    expect(createVendorProfileSchema.safeParse({ ...valid, categoryIds: [] }).success).toBe(false);
  });

  it('rejects a slug that is not URL-safe', () => {
    expect(createVendorProfileSchema.safeParse({ ...valid, slug: 'Not A Slug' }).success).toBe(
      false,
    );
  });

  it('accepts a lowercase hyphenated slug', () => {
    expect(
      createVendorProfileSchema.parse({ ...valid, slug: 'golden-hour-photography' }).slug,
    ).toBe('golden-hour-photography');
  });

  it('rejects a latitude outside the valid range', () => {
    expect(createVendorProfileSchema.safeParse({ ...valid, latitude: 91 }).success).toBe(false);
  });
});

describe('createServicePackageSchema', () => {
  const valid = {
    name: 'Half-Day Coverage',
    description: 'Four hours of on-site coverage with edited gallery delivery.',
    priceCents: 45_000,
    priceType: 'fixed',
    inclusions: ['4 hours coverage', '100 edited photos'],
  };

  it('accepts a well-formed package', () => {
    expect(createServicePackageSchema.parse(valid).priceCents).toBe(45_000);
  });

  it('enforces the $25 platform minimum', () => {
    expect(
      createServicePackageSchema.safeParse({ ...valid, priceCents: MIN_BOOKING_AMOUNT_CENTS - 1 })
        .success,
    ).toBe(false);
    expect(
      createServicePackageSchema.safeParse({ ...valid, priceCents: MIN_BOOKING_AMOUNT_CENTS })
        .success,
    ).toBe(true);
  });

  it('enforces the $100K ceiling', () => {
    expect(
      createServicePackageSchema.safeParse({ ...valid, priceCents: MAX_PACKAGE_PRICE_CENTS + 1 })
        .success,
    ).toBe(false);
  });

  it('rejects a fractional cent price', () => {
    expect(createServicePackageSchema.safeParse({ ...valid, priceCents: 4500.5 }).success).toBe(
      false,
    );
  });

  it('rejects an unknown price type', () => {
    expect(createServicePackageSchema.safeParse({ ...valid, priceType: 'per_guest' }).success).toBe(
      false,
    );
  });

  it('defaults inclusions to an empty list', () => {
    const { inclusions: _omitted, ...withoutInclusions } = valid;
    expect(createServicePackageSchema.parse(withoutInclusions).inclusions).toEqual([]);
  });

  it('rejects a blank inclusion entry', () => {
    expect(createServicePackageSchema.safeParse({ ...valid, inclusions: ['  '] }).success).toBe(
      false,
    );
  });
});

describe('updateServicePackageSchema', () => {
  it('leaves out every field the caller did not send', () => {
    const parsed = updateServicePackageSchema.parse({ name: 'Full-Day Coverage' });

    // The create schema defaults `inclusions` and `priceType`. Carrying those
    // defaults into a partial update would silently erase a package's
    // inclusions on a rename.
    expect(parsed).toEqual({ name: 'Full-Day Coverage' });
    expect('inclusions' in parsed).toBe(false);
    expect('priceType' in parsed).toBe(false);
  });

  it('accepts the active toggle on its own', () => {
    expect(updateServicePackageSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });

  it('rejects an empty patch', () => {
    expect(updateServicePackageSchema.safeParse({}).success).toBe(false);
  });

  it('still enforces the price band on the fields it does carry', () => {
    expect(updateServicePackageSchema.safeParse({ priceCents: 100 }).success).toBe(false);
  });
});

describe('availabilityBulkUpdateSchema', () => {
  it('accepts calendar date strings with a status', () => {
    const parsed = availabilityBulkUpdateSchema.parse({
      entries: [{ date: '2026-09-01', status: 'blocked' }],
    });
    expect(parsed.entries[0]).toEqual({ date: '2026-09-01', status: 'blocked' });
  });

  it('rejects a non-calendar date format', () => {
    expect(
      availabilityBulkUpdateSchema.safeParse({
        entries: [{ date: '09/01/2026', status: 'blocked' }],
      }).success,
    ).toBe(false);
  });

  it('rejects an empty entry list', () => {
    expect(availabilityBulkUpdateSchema.safeParse({ entries: [] }).success).toBe(false);
  });

  it('rejects a vendor-set booked status — booking owns that transition', () => {
    expect(
      availabilityBulkUpdateSchema.safeParse({
        entries: [{ date: '2026-09-01', status: 'booked' }],
      }).success,
    ).toBe(false);
  });
});

describe('createBookingRequestSchema', () => {
  const valid = { vendorId: UUID, eventDate: '2026-09-01', eventType: 'wedding' };

  it('rejects an occasion outside the controlled vocabulary', () => {
    expect(
      createBookingRequestSchema.safeParse({ ...valid, packageId: UUID, eventType: 'Wedding' })
        .success,
    ).toBe(false);
  });

  it('accepts a wall-clock start time and rejects a malformed one', () => {
    expect(
      createBookingRequestSchema.parse({ ...valid, packageId: UUID, eventStartTime: '14:00' })
        .eventStartTime,
    ).toBe('14:00');
    expect(
      createBookingRequestSchema.safeParse({ ...valid, packageId: UUID, eventStartTime: '2:00 PM' })
        .success,
    ).toBe(false);
  });

  it('rejects a custom request whose description is too short to quote from', () => {
    expect(
      createBookingRequestSchema.safeParse({ ...valid, customDetails: 'Photos' }).success,
    ).toBe(false);
  });

  it('caps the note at the length frame 04 counts to', () => {
    expect(
      createBookingRequestSchema.safeParse({
        ...valid,
        packageId: UUID,
        customDetails: 'x'.repeat(BOOKING_REQUEST_NOTES_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('accepts a package request', () => {
    expect(createBookingRequestSchema.parse({ ...valid, packageId: UUID }).packageId).toBe(UUID);
  });

  it('accepts a custom request with details and no package', () => {
    expect(
      createBookingRequestSchema.parse({ ...valid, customDetails: 'Two-hour engagement shoot.' })
        .packageId,
    ).toBeUndefined();
  });

  it('rejects a request that names neither a package nor custom details', () => {
    expect(createBookingRequestSchema.safeParse(valid).success).toBe(false);
  });

  it('rejects a non-positive guest count', () => {
    expect(
      createBookingRequestSchema.safeParse({ ...valid, packageId: UUID, guestCount: 0 }).success,
    ).toBe(false);
  });
});

describe('bookingRequestSchema', () => {
  it('rejects an unknown status', () => {
    const result = bookingRequestSchema.safeParse({
      id: UUID,
      customerId: UUID,
      vendorId: UUID,
      packageId: null,
      eventDate: '2026-09-01',
      eventType: null,
      eventLocation: null,
      guestCount: null,
      customDetails: null,
      status: 'refunded',
      quotedPriceCents: null,
      quoteNote: null,
      finalPriceCents: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(false);
  });
});

describe('sendMessageSchema', () => {
  it('accepts a message at the length ceiling', () => {
    expect(sendMessageSchema.safeParse({ content: 'x'.repeat(MESSAGE_MAX_LENGTH) }).success).toBe(
      true,
    );
  });

  it('rejects a message past the ceiling', () => {
    expect(
      sendMessageSchema.safeParse({ content: 'x'.repeat(MESSAGE_MAX_LENGTH + 1) }).success,
    ).toBe(false);
  });

  it('rejects whitespace-only content', () => {
    expect(sendMessageSchema.safeParse({ content: '   \n  ' }).success).toBe(false);
  });
});

describe('createReviewSchema', () => {
  const valid = { rating: 5, content: 'Outstanding work from start to finish.' };

  it('accepts a valid review', () => {
    expect(createReviewSchema.parse(valid).rating).toBe(5);
  });

  it('rejects a rating outside 1-5', () => {
    expect(createReviewSchema.safeParse({ ...valid, rating: 0 }).success).toBe(false);
    expect(createReviewSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false);
  });

  it('rejects a fractional rating', () => {
    expect(createReviewSchema.safeParse({ ...valid, rating: 4.5 }).success).toBe(false);
  });

  it('rejects content shorter than 10 characters after trimming', () => {
    expect(createReviewSchema.safeParse({ ...valid, content: '   ok   ' }).success).toBe(false);
  });
});

describe('vendorSearchQuerySchema', () => {
  it('applies defaults for page and sort', () => {
    const parsed = vendorSearchQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.sort).toBe('relevance');
  });

  it('coerces numeric query string params', () => {
    const parsed = vendorSearchQuerySchema.parse({ page: '3', minPriceCents: '5000' });
    expect(parsed.page).toBe(3);
    expect(parsed.minPriceCents).toBe(5000);
  });

  it('rejects a page below 1', () => {
    expect(vendorSearchQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('rejects a min price above the max price', () => {
    expect(
      vendorSearchQuerySchema.safeParse({ minPriceCents: 90_000, maxPriceCents: 10_000 }).success,
    ).toBe(false);
  });

  it('rejects an unknown sort option', () => {
    expect(vendorSearchQuerySchema.safeParse({ sort: 'cheapest' }).success).toBe(false);
  });

  /*
   * Search is category + city + date — three enumerable pickers. The free-text
   * `q` that used to sit on the main path is gone; see decision D6. `name`
   * replaces it as the deliberately-secondary referral affordance, and it is
   * matched against the business name alone.
   */
  it('no longer accepts a free-text q on the main path', () => {
    const parsed = vendorSearchQuerySchema.parse({ q: 'wedding photographer near me' });
    expect(parsed).not.toHaveProperty('q');
  });

  it('accepts a trimmed name for the referral case', () => {
    const parsed = vendorSearchQuerySchema.parse({ name: '  June Harlow  ' });
    expect(parsed.name).toBe('June Harlow');
  });

  it('drops a name that is only whitespace rather than matching everything', () => {
    expect(vendorSearchQuerySchema.parse({ name: '   ' }).name).toBeUndefined();
  });

  it('rejects a name longer than the column allows', () => {
    expect(vendorSearchQuerySchema.safeParse({ name: 'a'.repeat(201) }).success).toBe(false);
  });
});

describe('apiErrorSchema', () => {
  it('accepts a structured error using a known error code', () => {
    const parsed = apiErrorSchema.parse({
      statusCode: 404,
      error: ERROR_CODES.NOT_FOUND,
      message: 'Vendor not found',
    });
    expect(parsed.error).toBe('NOT_FOUND');
  });

  it('rejects an error code outside the shared set', () => {
    expect(
      apiErrorSchema.safeParse({ statusCode: 500, error: 'KABOOM', message: 'oops' }).success,
    ).toBe(false);
  });
});

describe('paginatedSchema', () => {
  it('wraps an item schema in the shared list envelope', () => {
    const schema = paginatedSchema(z.object({ id: z.string() }));
    const parsed = schema.parse({ items: [{ id: 'a' }], total: 1, page: 1, pageSize: 20 });
    expect(parsed).toEqual({ items: [{ id: 'a' }], total: 1, page: 1, pageSize: 20 });
  });

  it('rejects a page number below 1', () => {
    const schema = paginatedSchema(z.object({ id: z.string() }));
    expect(schema.safeParse({ items: [], total: 0, page: 0, pageSize: 20 }).success).toBe(false);
  });
});

describe('createVendorProfileSchema responseTimeHours', () => {
  const base = {
    businessName: 'Sunlit Studio',
    categoryIds: [UUID],
    city: 'Austin',
    state: 'TX',
  };

  it('accepts every offered response window', () => {
    for (const hours of RESPONSE_TIME_HOURS_OPTIONS) {
      const parsed = createVendorProfileSchema.parse({ ...base, responseTimeHours: hours });
      expect(parsed.responseTimeHours).toBe(hours);
    }
  });

  it('rejects a response window outside the offered set', () => {
    expect(createVendorProfileSchema.safeParse({ ...base, responseTimeHours: 3 }).success).toBe(
      false,
    );
  });
});

describe('tagSuggestionResponseSchema', () => {
  const tag = {
    id: UUID,
    name: 'Amharic',
    slug: 'language-amharic',
    category: 'language',
    displayOrder: 1,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('carries the matched tag on an `exists` outcome', () => {
    const parsed = tagSuggestionResponseSchema.parse({ status: 'exists', tag });
    expect(parsed.status).toBe('exists');
    expect(parsed).toMatchObject({ tag: { slug: 'language-amharic' } });
  });

  it('accepts a bare `already_suggested` outcome', () => {
    expect(tagSuggestionResponseSchema.parse({ status: 'already_suggested' })).toEqual({
      status: 'already_suggested',
    });
  });

  it('carries the new row id on a `submitted` outcome', () => {
    const parsed = tagSuggestionResponseSchema.parse({ status: 'submitted', suggestionId: UUID });
    expect(parsed).toEqual({ status: 'submitted', suggestionId: UUID });
  });

  it('rejects an `exists` outcome with no tag attached', () => {
    expect(tagSuggestionResponseSchema.safeParse({ status: 'exists' }).success).toBe(false);
  });

  it('rejects an unknown outcome', () => {
    expect(tagSuggestionResponseSchema.safeParse({ status: 'merged' }).success).toBe(false);
  });
});

describe('uploadedImageSchema', () => {
  it('requires both processed variants to be absolute URLs', () => {
    const parsed = uploadedImageSchema.parse({
      imageUrl: 'https://cdn.example.com/a.webp',
      thumbnailUrl: 'https://cdn.example.com/a-thumb.webp',
    });
    expect(parsed.thumbnailUrl).toBe('https://cdn.example.com/a-thumb.webp');
  });

  it('rejects a relative image path', () => {
    expect(
      uploadedImageSchema.safeParse({ imageUrl: '/a.webp', thumbnailUrl: '/a-thumb.webp' }).success,
    ).toBe(false);
  });
});

describe('vendorProfileDetailSchema', () => {
  const row = {
    id: UUID,
    userId: UUID,
    businessName: 'Sunlit Studio',
    slug: 'sunlit-studio',
    bio: null,
    profileImageUrl: null,
    coverImageUrl: null,
    address: null,
    city: 'Austin',
    state: 'TX',
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
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('carries the selections the edit form has to prefill', () => {
    const parsed = vendorProfileDetailSchema.parse({
      ...row,
      categoryIds: [UUID],
      publishBlockers: [],
      tags: [
        {
          id: UUID,
          name: 'Spanish',
          slug: 'language-spanish',
          category: 'language',
          displayOrder: 2,
          isActive: true,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    expect(parsed.categoryIds).toEqual([UUID]);
    expect(parsed.tags).toHaveLength(1);
    expect(parsed.tags[0]?.name).toBe('Spanish');
  });

  it('rejects a detail payload missing its tag list', () => {
    expect(
      vendorProfileDetailSchema.safeParse({ ...row, categoryIds: [], publishBlockers: [] }).success,
    ).toBe(false);
  });
});

/*
 * The price band is stored in cents and spoken in dollars. These messages are
 * shown to a vendor verbatim beside a helper line reading "Between $25 and
 * $100,000", so quoting a bound as "2500 cents" contradicts the field's own
 * copy — and the repo convention is that money crosses the display boundary
 * through `formatPrice`.
 */
describe('priceCentsSchema messages', () => {
  const message = (priceCents: number): string => {
    const parsed = createServicePackageSchema.safeParse({
      name: 'Half day',
      description: 'Four hours of coverage and an online gallery.',
      priceCents,
      priceType: 'fixed',
      inclusions: [],
    });

    if (parsed.success) {
      throw new Error(`expected ${priceCents} to be rejected`);
    }

    const issue = parsed.error.issues.find((candidate) => candidate.path[0] === 'priceCents');

    if (!issue) {
      throw new Error('expected a priceCents issue');
    }

    return issue.message;
  };

  it('states the lower bound in dollars', () => {
    expect(message(2_400)).toBe('Price must be at least $25');
  });

  it('states the upper bound in dollars', () => {
    expect(message(10_000_100)).toBe('Price must be at most $100,000');
  });

  it('tells a vendor what to enter when the field is not a number', () => {
    // The form hands `NaN` on for non-numeric text; Zod's stock "Invalid
    // input" says nothing about how to fix it.
    expect(message(Number.NaN)).toBe('Enter a price between $25 and $100,000');
  });

  it('never quotes a bound in cents', () => {
    expect(message(2_400)).not.toMatch(/cents/i);
    expect(message(10_000_100)).not.toMatch(/cents/i);
  });
});
