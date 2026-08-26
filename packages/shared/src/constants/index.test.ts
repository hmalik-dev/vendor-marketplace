import { describe, expect, it } from 'vitest';
import {
  BOOKING_REQUEST_STATUSES,
  BOOKING_STATUSES,
  BUDGET_TIERS,
  CATEGORY_SEEDS,
  CATEGORY_SLUG_SUCCESSORS,
  CATEGORY_SLUGS,
  LANDING_CATEGORY_COUNT,
  DEFAULT_PLATFORM_FEE_RATE,
  ERROR_CODES,
  MIN_BOOKING_AMOUNT_CENTS,
  NOTIFICATION_TYPES,
  PRICE_TYPES,
  REVIEW_TYPES,
  TAG_CATEGORIES,
  TAG_SEEDS,
  TAG_SUGGESTION_STATUSES,
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

  it('exposes exactly the budget tiers and tag enums the data model defines', () => {
    expect(BUDGET_TIERS).toEqual(['budget', 'mid_range', 'premium', 'luxury']);
    expect(TAG_CATEGORIES).toEqual(['language', 'cultural', 'dietary']);
    expect(TAG_SUGGESTION_STATUSES).toEqual(['pending', 'approved', 'rejected']);
  });

  it('keeps every enum free of duplicates', () => {
    const enums = [
      USER_ROLES,
      BOOKING_REQUEST_STATUSES,
      BOOKING_STATUSES,
      PRICE_TYPES,
      REVIEW_TYPES,
      NOTIFICATION_TYPES,
      BUDGET_TIERS,
      TAG_CATEGORIES,
      TAG_SUGGESTION_STATUSES,
    ];
    for (const values of enums) {
      expect(new Set(values).size).toBe(values.length);
    }
  });
});

describe('CATEGORY_SEEDS', () => {
  it('covers all eleven launch categories, in display order', () => {
    expect(CATEGORY_SEEDS).toHaveLength(11);
    expect(CATEGORY_SEEDS.map((c) => c.name)).toEqual([
      'Photography',
      'Entertainment',
      'Catering',
      'Venues',
      'Beauty',
      'Carts',
      'Florals',
      'Decor',
      'Videography',
      'Planning',
      'Rentals',
    ]);
  });

  it('names every category in a single word, so the landing grid reads as nouns', () => {
    for (const category of CATEGORY_SEEDS) {
      expect(category.name, category.slug).toMatch(/^[A-Z][a-z]+$/);
    }
  });

  it('says what sits inside each category in the description', () => {
    for (const category of CATEGORY_SEEDS) {
      expect(category.description.length, category.slug).toBeGreaterThan(20);
      expect(category.description.endsWith('.'), category.slug).toBe(true);
    }
  });

  it('numbers displayOrder 1..n in array order, since it drives landing priority', () => {
    expect(CATEGORY_SEEDS.map((c) => c.displayOrder)).toEqual(
      CATEGORY_SEEDS.map((_, index) => index + 1),
    );
  });

  it('features the categories the landing page leads with, carts included', () => {
    const featured = CATEGORY_SEEDS.slice(0, LANDING_CATEGORY_COUNT).map((c) => c.name);

    expect(featured).toEqual([
      'Photography',
      'Entertainment',
      'Catering',
      'Venues',
      'Beauty',
      'Carts',
    ]);
  });

  it('features fewer categories than it seeds, so the landing grid stays a taste', () => {
    expect(LANDING_CATEGORY_COUNT).toBeLessThan(CATEGORY_SEEDS.length);
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

describe('TAG_SEEDS', () => {
  it('seeds every tag category', () => {
    const seeded = new Set(TAG_SEEDS.map((tag) => tag.category));
    expect([...seeded].sort()).toEqual([...TAG_CATEGORIES].sort());
  });

  it('covers the launch language, cultural, and dietary lists', () => {
    const byCategory = (category: string) =>
      TAG_SEEDS.filter((tag) => tag.category === category).map((tag) => tag.name);

    expect(byCategory('language')).toHaveLength(23);
    expect(byCategory('language')).toContain('ASL/Sign Language');
    expect(byCategory('language')).toContain('Haitian Creole');

    expect(byCategory('cultural')).toHaveLength(16);
    expect(byCategory('cultural')).toContain('South Asian');

    expect(byCategory('dietary')).toHaveLength(4);
    // Order matters: the picker renders by displayOrder, and the two
    // preference-based options read first for most customers.
    expect(byCategory('dietary')).toEqual(['Vegan', 'Vegetarian', 'Halal', 'Kosher']);
  });

  it('gives every tag a globally unique slug', () => {
    const slugs = TAG_SEEDS.map((tag) => tag.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('keeps names unique within a category while allowing reuse across categories', () => {
    for (const category of TAG_CATEGORIES) {
      const names = TAG_SEEDS.filter((tag) => tag.category === category).map((tag) => tag.name);
      expect(new Set(names).size).toBe(names.length);
    }

    // "Korean" is both a language and a culture — the category prefix in the
    // slug is what keeps the two rows from colliding.
    const korean = TAG_SEEDS.filter((tag) => tag.name === 'Korean');
    expect(korean).toHaveLength(2);
    expect(korean.map((tag) => tag.slug).sort()).toEqual(['cultural-korean', 'language-korean']);
  });

  it('uses URL-safe, category-prefixed slugs', () => {
    for (const tag of TAG_SEEDS) {
      expect(tag.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(tag.slug.startsWith(`${tag.category.replace(/_/g, '-')}-`)).toBe(true);
    }
  });

  it('numbers display order from 1 within each category', () => {
    for (const category of TAG_CATEGORIES) {
      const orders = TAG_SEEDS.filter((tag) => tag.category === category).map(
        (tag) => tag.displayOrder,
      );
      expect(orders).toEqual(orders.map((_, index) => index + 1));
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

describe('CATEGORY_SLUG_SUCCESSORS', () => {
  it('points every retired slug at a category that is actually seeded', () => {
    for (const [retired, successor] of Object.entries(CATEGORY_SLUG_SUCCESSORS)) {
      expect(CATEGORY_SLUGS, retired).toContain(successor);
    }
  });

  it('never retires a slug that is still seeded, which would delete a live category', () => {
    for (const retired of Object.keys(CATEGORY_SLUG_SUCCESSORS)) {
      expect(CATEGORY_SLUGS, retired).not.toContain(retired);
    }
  });

  it('carries a successor for every slug the previous taxonomy shipped', () => {
    // Renamed rather than dropped: each of these still has vendors attached.
    expect(Object.keys(CATEGORY_SLUG_SUCCESSORS).sort()).toEqual([
      'decoration',
      'dj-music',
      'event-planning',
      'floristry',
      'lighting',
      'makeup-beauty',
      'rentals-equipment',
    ]);
  });

  it('folds lighting into decor rather than leaving it standalone', () => {
    expect(CATEGORY_SLUG_SUCCESSORS.lighting).toBe('decor');
  });
});
