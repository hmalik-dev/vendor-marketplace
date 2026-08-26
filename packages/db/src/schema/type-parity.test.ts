import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  AVAILABILITY_STATUSES,
  BOOKING_REQUEST_STATUSES,
  BOOKING_STATUSES,
  PRICE_TYPES,
  REVIEW_TYPES,
  USER_ROLES,
  type AvailabilityStatus,
  type BookingRequestStatus,
  type BookingStatus,
  type Booking as BookingModel,
  type Category as CategoryModel,
  type PriceType,
  type ReviewType,
  type User as UserModel,
  type UserRole,
  type VendorProfile as VendorProfileModel,
} from '@vendorhub/shared';
import {
  availabilityStatusEnum,
  bookingRequestStatusEnum,
  bookingStatusEnum,
  priceTypeEnum,
  reviewTypeEnum,
  userRoleEnum,
  type AvailabilityRow,
  type BookingRow,
  type CategoryRow,
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
  });

  it('infers the same enum unions in both layers', () => {
    expectTypeOf<UserRow['role']>().toEqualTypeOf<UserRole>();
    expectTypeOf<AvailabilityRow['status']>().toEqualTypeOf<AvailabilityStatus>();
    expectTypeOf<BookingRow['status']>().toEqualTypeOf<BookingStatus>();
    expectTypeOf<PriceType>().toEqualTypeOf<'fixed' | 'starting_at' | 'hourly'>();
    expectTypeOf<ReviewType>().toEqualTypeOf<'customer_to_vendor' | 'vendor_to_customer'>();
    expectTypeOf<BookingRequestStatus>().not.toBeNever();
  });
});

describe('Drizzle <-> Zod column parity', () => {
  it('matches nullability and scalar types on the shared columns', () => {
    expectTypeOf<UserRow['id']>().toEqualTypeOf<UserModel['id']>();
    expectTypeOf<UserRow['email']>().toEqualTypeOf<UserModel['email']>();
    expectTypeOf<UserRow['phone']>().toEqualTypeOf<UserModel['phone']>();
    expectTypeOf<UserRow['isBanned']>().toEqualTypeOf<UserModel['isBanned']>();
    expectTypeOf<UserRow['bannedAt']>().toEqualTypeOf<UserModel['bannedAt']>();
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

    expect(true).toBe(true);
  });
});
