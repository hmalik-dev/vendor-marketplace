/**
 * Single source of truth for every domain enum, business rule, and seed list.
 * The Drizzle schema in `@vendorhub/db` and the Zod schemas in `../schemas`
 * both derive from these arrays so the database, the API contract, and the
 * frontend can never drift apart.
 */

// --- Domain enums ----------------------------------------------------------

export const USER_ROLES = ['customer', 'vendor', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PRICE_TYPES = ['fixed', 'starting_at', 'hourly'] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

export const AVAILABILITY_STATUSES = ['available', 'booked', 'blocked'] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

/**
 * Statuses a vendor may set directly. `booked` is owned by the booking
 * lifecycle (ticket #10) and is never writable from the availability calendar.
 */
export const VENDOR_SETTABLE_AVAILABILITY_STATUSES = ['available', 'blocked'] as const;
export type VendorSettableAvailabilityStatus =
  (typeof VENDOR_SETTABLE_AVAILABILITY_STATUSES)[number];

export const BOOKING_REQUEST_STATUSES = [
  'pending',
  'quoted',
  'accepted',
  'declined',
  'expired',
  'cancelled',
] as const;
export type BookingRequestStatus = (typeof BOOKING_REQUEST_STATUSES)[number];

export const BOOKING_STATUSES = ['confirmed', 'completed', 'cancelled', 'disputed'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const REVIEW_TYPES = ['customer_to_vendor', 'vendor_to_customer'] as const;
export type ReviewType = (typeof REVIEW_TYPES)[number];

export const NOTIFICATION_TYPES = [
  'new_request',
  'request_quoted',
  'request_accepted',
  'request_declined',
  'request_expired',
  'request_cancelled',
  'booking_confirmed',
  'booking_completed',
  'booking_cancelled',
  'new_message',
  'new_review',
  'payout_sent',
  'stripe_onboarding_complete',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const VENDOR_SORT_OPTIONS = [
  'relevance',
  'rating',
  'price_asc',
  'price_desc',
  'newest',
] as const;
export type VendorSortOption = (typeof VENDOR_SORT_OPTIONS)[number];

// --- Category seed data ----------------------------------------------------

export interface CategorySeed {
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  /** Lucide icon name rendered by the frontend. */
  readonly icon: string;
  readonly displayOrder: number;
}

export const CATEGORY_SEEDS: readonly CategorySeed[] = [
  {
    name: 'Photography',
    slug: 'photography',
    description: 'Photographers for weddings, portraits, and events.',
    icon: 'camera',
    displayOrder: 1,
  },
  {
    name: 'DJ/Music',
    slug: 'dj-music',
    description: 'DJs, bands, and live musicians to set the mood.',
    icon: 'music',
    displayOrder: 2,
  },
  {
    name: 'Makeup/Beauty',
    slug: 'makeup-beauty',
    description: 'Makeup artists, hair stylists, and beauty professionals.',
    icon: 'sparkles',
    displayOrder: 3,
  },
  {
    name: 'Decoration',
    slug: 'decoration',
    description: 'Decorators and stylists who transform your venue.',
    icon: 'palette',
    displayOrder: 4,
  },
  {
    name: 'Catering',
    slug: 'catering',
    description: 'Caterers, chefs, and bar services for any guest count.',
    icon: 'utensils',
    displayOrder: 5,
  },
  {
    name: 'Floristry',
    slug: 'floristry',
    description: 'Florists for bouquets, centerpieces, and installations.',
    icon: 'flower',
    displayOrder: 6,
  },
  {
    name: 'Videography',
    slug: 'videography',
    description: 'Videographers and cinematographers for event films.',
    icon: 'video',
    displayOrder: 7,
  },
  {
    name: 'Event Planning',
    slug: 'event-planning',
    description: 'Planners and coordinators who run the day for you.',
    icon: 'clipboard-list',
    displayOrder: 8,
  },
  {
    name: 'Lighting',
    slug: 'lighting',
    description: 'Lighting designers for ambience, uplighting, and stages.',
    icon: 'lightbulb',
    displayOrder: 9,
  },
  {
    name: 'Rentals/Equipment',
    slug: 'rentals-equipment',
    description: 'Tents, tables, chairs, AV, and everything in between.',
    icon: 'package',
    displayOrder: 10,
  },
];

export const CATEGORY_SLUGS = CATEGORY_SEEDS.map((category) => category.slug);

// --- Business rules --------------------------------------------------------

/** Minimum booking amount ($25) — keeps margin positive after Stripe fees. */
export const MIN_BOOKING_AMOUNT_CENTS = 2_500;

/** Ceiling on a single service package price ($100,000). */
export const MAX_PACKAGE_PRICE_CENTS = 10_000_000;

/** Platform commission when `STRIPE_PLATFORM_FEE_RATE` is unset. */
export const DEFAULT_PLATFORM_FEE_RATE = 0.12;

/** A pending booking request auto-expires this many days after creation. */
export const BOOKING_REQUEST_EXPIRY_DAYS = 7;

/** Cancelling at least this many hours before the event earns a full refund. */
export const FULL_REFUND_CUTOFF_HOURS = 48;

/** Refund fraction when cancelling inside the full-refund cutoff. */
export const LATE_CANCELLATION_REFUND_RATE = 0.5;

/** How far forward the vendor availability calendar runs. */
export const AVAILABILITY_MONTHS_AHEAD = 12;

export const MESSAGE_MAX_LENGTH = 5_000;

export const REVIEW_CONTENT_MIN_LENGTH = 10;
export const REVIEW_CONTENT_MAX_LENGTH = 2_000;
export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;

/** Default page size for vendor search and most list endpoints. */
export const DEFAULT_PAGE_SIZE = 20;
/** Message history loads in larger pages than list endpoints. */
export const MESSAGES_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/** Largest accepted upload before server-side image processing. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Column widths mirrored from the Drizzle schema, enforced by Zod. */
export const MAX_SLUG_LENGTH = 200;
export const MAX_BUSINESS_NAME_LENGTH = 200;
export const MAX_NAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 255;
export const MAX_PHONE_LENGTH = 20;
export const MAX_URL_LENGTH = 500;
export const MAX_ADDRESS_LENGTH = 500;
export const MAX_CAPTION_LENGTH = 500;
export const MAX_TITLE_LENGTH = 200;

// --- Error codes -----------------------------------------------------------

/**
 * Machine-readable `error` field on every structured API error response.
 * The human-readable `message` is written at the throw site.
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
