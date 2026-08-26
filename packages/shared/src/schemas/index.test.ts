import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  apiErrorSchema,
  availabilityBulkUpdateSchema,
  bookingRequestSchema,
  createBookingRequestSchema,
  createReviewSchema,
  createServicePackageSchema,
  createVendorProfileSchema,
  paginatedSchema,
  sendMessageSchema,
  updateUserSchema,
  userSchema,
  vendorSearchQuerySchema,
} from './index.js';
import {
  ERROR_CODES,
  MAX_PACKAGE_PRICE_CENTS,
  MESSAGE_MAX_LENGTH,
  MIN_BOOKING_AMOUNT_CENTS,
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
    isBanned: false,
    bannedAt: null,
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
});

describe('updateUserSchema', () => {
  it('trims names before validating emptiness', () => {
    expect(updateUserSchema.parse({ firstName: '  Jane  ' })).toEqual({ firstName: 'Jane' });
  });

  it('rejects a whitespace-only name', () => {
    expect(updateUserSchema.safeParse({ firstName: '   ' }).success).toBe(false);
  });

  it('rejects an empty payload so a no-op update cannot reach the DAO', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
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
  const valid = { vendorId: UUID, eventDate: '2026-09-01', eventType: 'Wedding' };

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
