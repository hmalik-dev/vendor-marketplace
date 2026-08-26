import { describe, expect, it } from 'vitest';
import {
  BOOKING_REQUEST_STATUSES,
  BOOKING_STATUSES,
  CATEGORY_SEEDS,
  DEFAULT_PLATFORM_FEE_RATE,
  ERROR_CODES,
  MIN_BOOKING_AMOUNT_CENTS,
  NOTIFICATION_TYPES,
  PRICE_TYPES,
  REVIEW_TYPES,
  USER_ROLES,
} from './index.js';

describe('enum constants', () => {
  it('exposes exactly the roles the data model defines', () => {
    expect(USER_ROLES).toEqual(['customer', 'vendor', 'admin']);
  });

  it('exposes exactly the booking request statuses the state machine defines', () => {
    expect(BOOKING_REQUEST_STATUSES).toEqual([
      'pending',
      'quoted',
      'accepted',
      'declined',
      'expired',
      'cancelled',
    ]);
  });

  it('exposes exactly the booking statuses the data model defines', () => {
    expect(BOOKING_STATUSES).toEqual(['confirmed', 'completed', 'cancelled', 'disputed']);
  });

  it('exposes exactly the price types and review types the data model defines', () => {
    expect(PRICE_TYPES).toEqual(['fixed', 'starting_at', 'hourly']);
    expect(REVIEW_TYPES).toEqual(['customer_to_vendor', 'vendor_to_customer']);
  });

  it('keeps every enum free of duplicates', () => {
    const enums = [
      USER_ROLES,
      BOOKING_REQUEST_STATUSES,
      BOOKING_STATUSES,
      PRICE_TYPES,
      REVIEW_TYPES,
      NOTIFICATION_TYPES,
    ];
    for (const values of enums) {
      expect(new Set(values).size).toBe(values.length);
    }
  });
});

describe('CATEGORY_SEEDS', () => {
  it('covers all ten launch categories', () => {
    expect(CATEGORY_SEEDS).toHaveLength(10);
    expect(CATEGORY_SEEDS.map((c) => c.name)).toEqual([
      'Photography',
      'DJ/Music',
      'Makeup/Beauty',
      'Decoration',
      'Catering',
      'Floristry',
      'Videography',
      'Event Planning',
      'Lighting',
      'Rentals/Equipment',
    ]);
  });

  it('gives every category a unique slug and a unique display order', () => {
    expect(new Set(CATEGORY_SEEDS.map((c) => c.slug)).size).toBe(CATEGORY_SEEDS.length);
    expect(new Set(CATEGORY_SEEDS.map((c) => c.displayOrder)).size).toBe(CATEGORY_SEEDS.length);
  });

  it('uses URL-safe slugs', () => {
    for (const category of CATEGORY_SEEDS) {
      expect(category.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});

describe('business constants', () => {
  it('pins the $25 minimum booking amount in cents', () => {
    expect(MIN_BOOKING_AMOUNT_CENTS).toBe(2500);
  });

  it('pins the 12% default platform fee rate', () => {
    expect(DEFAULT_PLATFORM_FEE_RATE).toBe(0.12);
  });

  it('maps every error code to its own string', () => {
    const values = Object.values(ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
    expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
  });
});
