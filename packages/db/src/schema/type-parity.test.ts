import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  AVAILABILITY_STATUSES,
  BOOKING_REQUEST_STATUSES,
  BOOKING_STATUSES,
  BUDGET_TIERS,
  PRICE_TYPES,
  REVIEW_TYPES,
  TAG_CATEGORIES,
  TAG_SUGGESTION_STATUSES,
  USER_ROLES,
  type AvailabilityStatus,
  type BookingRequestStatus,
  type BookingStatus,
  type Booking as BookingModel,
  type BudgetTier,
  type Category as CategoryModel,
  type PriceType,
  type Review as ReviewModel,
  type ReviewType,
  type Tag as TagModel,
  type TagCategory,
  type TagSuggestion as TagSuggestionModel,
  type User as UserModel,
  type UserRole,
  type VendorProfile as VendorProfileModel,
} from '@vendorhub/shared';
import {
  availabilityStatusEnum,
  bookingRequestStatusEnum,
  bookingStatusEnum,
  budgetTierEnum,
  priceTypeEnum,
  reviewTypeEnum,
  tagCategoryEnum,
  tagSuggestionStatusEnum,
  userRoleEnum,
  type AvailabilityRow,
  type BookingRow,
  type CategoryRow,
  type ReviewRow,
  type TagRow,
  type TagSuggestionRow,
  type UserRow,
  type VendorProfileRow,
} from './index.js';

/**
 * These assertions fail the build if the Drizzle column types and the types
 * inferred from the shared Zod schemas ever diverge. Type-level checks are
 * paired with a runtime assertion so the suite reports a real test result.
 */
describe('Drizzle <-> Zod enum parity', () => {
  it('declares identical enum members in both layers', () => {
    expect(userRoleEnum.enumValues).toEqual([...USER_ROLES]);
    expect(priceTypeEnum.enumValues).toEqual([...PRICE_TYPES]);
    expect(availabilityStatusEnum.enumValues).toEqual([...AVAILABILITY_STATUSES]);
    expect(bookingRequestStatusEnum.enumValues).toEqual([...BOOKING_REQUEST_STATUSES]);
    expect(bookingStatusEnum.enumValues).toEqual([...BOOKING_STATUSES]);
    expect(reviewTypeEnum.enumValues).toEqual([...REVIEW_TYPES]);
    expect(budgetTierEnum.enumValues).toEqual([...BUDGET_TIERS]);
    expect(tagCategoryEnum.enumValues).toEqual([...TAG_CATEGORIES]);
    expect(tagSuggestionStatusEnum.enumValues).toEqual([...TAG_SUGGESTION_STATUSES]);
  });

  it('infers the same enum unions in both layers', () => {
    expectTypeOf<UserRow['role']>().toEqualTypeOf<UserRole>();
    expectTypeOf<AvailabilityRow['status']>().toEqualTypeOf<AvailabilityStatus>();
    expectTypeOf<BookingRow['status']>().toEqualTypeOf<BookingStatus>();
    expectTypeOf<PriceType>().toEqualTypeOf<'fixed' | 'starting_at' | 'hourly'>();
    expectTypeOf<ReviewType>().toEqualTypeOf<'customer_to_vendor' | 'vendor_to_customer'>();
    expectTypeOf<BookingRequestStatus>().not.toBeNever();

    // `budget_tier` and the tag category are nullable/non-nullable in opposite
    // places, so compare against the enum union rather than the column type.
    expectTypeOf<NonNullable<UserRow['budgetTier']>>().toEqualTypeOf<BudgetTier>();
    expectTypeOf<TagRow['category']>().toEqualTypeOf<TagCategory>();
    expectTypeOf<TagSuggestionRow['status']>().toEqualTypeOf<TagSuggestionModel['status']>();
  });
});

describe('Drizzle <-> Zod column parity', () => {
  it('matches nullability and scalar types on the shared columns', () => {
    expectTypeOf<UserRow['id']>().toEqualTypeOf<UserModel['id']>();
    expectTypeOf<UserRow['email']>().toEqualTypeOf<UserModel['email']>();
    expectTypeOf<UserRow['phone']>().toEqualTypeOf<UserModel['phone']>();
    expectTypeOf<UserRow['isBanned']>().toEqualTypeOf<UserModel['isBanned']>();
    expectTypeOf<UserRow['bannedAt']>().toEqualTypeOf<UserModel['bannedAt']>();
    expectTypeOf<UserRow['deletedAt']>().toEqualTypeOf<UserModel['deletedAt']>();
    expectTypeOf<UserRow['createdAt']>().toEqualTypeOf<UserModel['createdAt']>();

    expectTypeOf<VendorProfileRow['isPublished']>().toEqualTypeOf<
      VendorProfileModel['isPublished']
    >();
    expectTypeOf<VendorProfileRow['reviewCount']>().toEqualTypeOf<
      VendorProfileModel['reviewCount']
    >();
    expectTypeOf<VendorProfileRow['serviceRadiusKm']>().toEqualTypeOf<
      VendorProfileModel['serviceRadiusKm']
    >();

    expectTypeOf<CategoryRow['displayOrder']>().toEqualTypeOf<CategoryModel['displayOrder']>();
    expectTypeOf<CategoryRow['description']>().toEqualTypeOf<CategoryModel['description']>();

    expectTypeOf<BookingRow['totalAmountCents']>().toEqualTypeOf<
      BookingModel['totalAmountCents']
    >();
    expectTypeOf<BookingRow['stripeTransferId']>().toEqualTypeOf<
      BookingModel['stripeTransferId']
    >();

    // `event_date` is a Postgres DATE and stays a `YYYY-MM-DD` string on both
    // sides — never a Date, which would reintroduce timezone drift.
    expectTypeOf<BookingRow['eventDate']>().toEqualTypeOf<string>();
    expectTypeOf<BookingModel['eventDate']>().toEqualTypeOf<string>();

    // `avg_rating` is a Postgres NUMERIC, surfaced as a string by the driver
    // and parsed to a number at the DAO boundary.
    expectTypeOf<VendorProfileRow['avgRating']>().toEqualTypeOf<string>();
    expectTypeOf<VendorProfileModel['avgRating']>().toEqualTypeOf<number>();
    expectTypeOf<UserRow['avgCustomerRating']>().toEqualTypeOf<string>();
    expectTypeOf<UserModel['avgCustomerRating']>().toEqualTypeOf<number>();

    // Customer profile fields and derived counters.
    expectTypeOf<UserRow['bio']>().toEqualTypeOf<UserModel['bio']>();
    expectTypeOf<UserRow['budgetTier']>().toEqualTypeOf<UserModel['budgetTier']>();
    expectTypeOf<UserRow['typicalGuestCountMin']>().toEqualTypeOf<
      UserModel['typicalGuestCountMin']
    >();
    expectTypeOf<UserRow['completedBookingsCount']>().toEqualTypeOf<
      UserModel['completedBookingsCount']
    >();

    expectTypeOf<ReviewRow['isPublic']>().toEqualTypeOf<ReviewModel['isPublic']>();

    expectTypeOf<TagRow['displayOrder']>().toEqualTypeOf<TagModel['displayOrder']>();
    expectTypeOf<TagRow['isActive']>().toEqualTypeOf<TagModel['isActive']>();
    expectTypeOf<TagSuggestionRow['resolvedTagId']>().toEqualTypeOf<
      TagSuggestionModel['resolvedTagId']
    >();
    expectTypeOf<TagSuggestionRow['adminNote']>().toEqualTypeOf<TagSuggestionModel['adminNote']>();

    expect(true).toBe(true);
  });
});
