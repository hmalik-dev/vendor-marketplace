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

/** Self-reported spending band on a customer profile; helps vendors self-select. */
export const BUDGET_TIERS = ['budget', 'mid_range', 'premium', 'luxury'] as const;
export type BudgetTier = (typeof BUDGET_TIERS)[number];

/** The three groups a vendor tag belongs to, rendered as sections in the picker. */
export const TAG_CATEGORIES = ['language', 'cultural', 'dietary'] as const;
export type TagCategory = (typeof TAG_CATEGORIES)[number];

export const TAG_SUGGESTION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type TagSuggestionStatus = (typeof TAG_SUGGESTION_STATUSES)[number];

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

/**
 * Names are deliberately one word: the landing grid reads as a row of nouns,
 * and the description underneath is what says which vendors sit inside. A
 * two-word name is a sign the category is really two categories.
 *
 * `displayOrder` doubles as landing-page priority — `LANDING_CATEGORY_COUNT`
 * cards are featured on `/`, so the first entries are the highest-intent ones.
 */
export const CATEGORY_SEEDS: readonly CategorySeed[] = [
  {
    name: 'Photography',
    slug: 'photography',
    description: 'Portraits, candids, photo booths, and full-day coverage.',
    icon: 'camera',
    displayOrder: 1,
  },
  {
    name: 'Entertainment',
    slug: 'entertainment',
    description: 'DJs, live bands, musicians, MCs, dancers, and performers.',
    icon: 'music',
    displayOrder: 2,
  },
  {
    name: 'Catering',
    slug: 'catering',
    description: 'Caterers, private chefs, bartenders, and buffet service.',
    icon: 'utensils',
    displayOrder: 3,
  },
  {
    name: 'Venues',
    slug: 'venues',
    description: 'Halls, lofts, rooftops, gardens, and private dining rooms.',
    icon: 'building-2',
    displayOrder: 4,
  },
  {
    name: 'Beauty',
    slug: 'beauty',
    description: 'Makeup artists, hair stylists, henna, and grooming.',
    icon: 'sparkles',
    displayOrder: 5,
  },
  {
    name: 'Carts',
    slug: 'carts',
    description: 'Coffee, ice cream, dessert, and cocktail carts.',
    icon: 'ice-cream-cone',
    displayOrder: 6,
  },
  {
    name: 'Florals',
    slug: 'florals',
    description: 'Bouquets, centerpieces, arches, and floral installations.',
    icon: 'flower',
    displayOrder: 7,
  },
  {
    name: 'Decor',
    slug: 'decor',
    description: 'Backdrops, table styling, uplighting, and stage design.',
    icon: 'palette',
    displayOrder: 8,
  },
  {
    name: 'Videography',
    slug: 'videography',
    description: 'Highlight films, ceremony coverage, and drone work.',
    icon: 'video',
    displayOrder: 9,
  },
  {
    name: 'Planning',
    slug: 'planning',
    description: 'Planners and day-of coordinators who run the event for you.',
    icon: 'clipboard-list',
    displayOrder: 10,
  },
  {
    name: 'Rentals',
    slug: 'rentals',
    description: 'Tents, tables, chairs, AV, and everything in between.',
    icon: 'package',
    displayOrder: 11,
  },
];

/**
 * Slugs that no longer appear in `CATEGORY_SEEDS`, each mapped to the seeded
 * slug that took over its vendors.
 *
 * `seedCategories` upserts on `slug`, so without this a renamed category would
 * insert a *second* row and leave the original live with its vendors attached.
 * A plain rename moves the slug onto the existing row, keeping its id and every
 * `vendor_categories` link; a merge — `lighting` folding into `decor` — moves
 * the links onto the surviving row instead.
 */
export const CATEGORY_SLUG_SUCCESSORS: Readonly<Record<string, string>> = {
  'dj-music': 'entertainment',
  'makeup-beauty': 'beauty',
  decoration: 'decor',
  floristry: 'florals',
  'event-planning': 'planning',
  'rentals-equipment': 'rentals',
  lighting: 'decor',
};

export const CATEGORY_SLUGS = CATEGORY_SEEDS.map((category) => category.slug);

/**
 * How many categories the landing page features. The full taxonomy belongs on
 * search (#6), where a category is a filter you can actually click; a landing
 * grid of eleven inert cards is bloat, not browse.
 */
export const LANDING_CATEGORY_COUNT = 6;

// --- Tag seed data ---------------------------------------------------------

export interface TagSeed {
  readonly name: string;
  /**
   * Globally unique and category-prefixed. Names are only unique *within* a
   * category — "Korean" and "Japanese" are both a language and a culture — so
   * the prefix is what keeps the slug (used for dedup and search filters)
   * collision-free across the three groups.
   */
  readonly slug: string;
  readonly category: TagCategory;
  /** Ordering within the tag's own category group. */
  readonly displayOrder: number;
}

export const TAG_SEEDS: readonly TagSeed[] = [
  { name: 'English', slug: 'language-english', category: 'language', displayOrder: 1 },
  { name: 'Spanish', slug: 'language-spanish', category: 'language', displayOrder: 2 },
  { name: 'French', slug: 'language-french', category: 'language', displayOrder: 3 },
  { name: 'Portuguese', slug: 'language-portuguese', category: 'language', displayOrder: 4 },
  { name: 'Mandarin', slug: 'language-mandarin', category: 'language', displayOrder: 5 },
  { name: 'Cantonese', slug: 'language-cantonese', category: 'language', displayOrder: 6 },
  { name: 'Hindi', slug: 'language-hindi', category: 'language', displayOrder: 7 },
  { name: 'Urdu', slug: 'language-urdu', category: 'language', displayOrder: 8 },
  { name: 'Punjabi', slug: 'language-punjabi', category: 'language', displayOrder: 9 },
  { name: 'Arabic', slug: 'language-arabic', category: 'language', displayOrder: 10 },
  { name: 'Korean', slug: 'language-korean', category: 'language', displayOrder: 11 },
  { name: 'Japanese', slug: 'language-japanese', category: 'language', displayOrder: 12 },
  { name: 'Tagalog', slug: 'language-tagalog', category: 'language', displayOrder: 13 },
  { name: 'Vietnamese', slug: 'language-vietnamese', category: 'language', displayOrder: 14 },
  { name: 'Italian', slug: 'language-italian', category: 'language', displayOrder: 15 },
  { name: 'German', slug: 'language-german', category: 'language', displayOrder: 16 },
  { name: 'Russian', slug: 'language-russian', category: 'language', displayOrder: 17 },
  { name: 'Polish', slug: 'language-polish', category: 'language', displayOrder: 18 },
  { name: 'Turkish', slug: 'language-turkish', category: 'language', displayOrder: 19 },
  { name: 'Swahili', slug: 'language-swahili', category: 'language', displayOrder: 20 },
  { name: 'Yoruba', slug: 'language-yoruba', category: 'language', displayOrder: 21 },
  {
    name: 'Haitian Creole',
    slug: 'language-haitian-creole',
    category: 'language',
    displayOrder: 22,
  },
  {
    name: 'ASL/Sign Language',
    slug: 'language-asl-sign-language',
    category: 'language',
    displayOrder: 23,
  },
  { name: 'South Asian', slug: 'cultural-south-asian', category: 'cultural', displayOrder: 1 },
  { name: 'East Asian', slug: 'cultural-east-asian', category: 'cultural', displayOrder: 2 },
  {
    name: 'Southeast Asian',
    slug: 'cultural-southeast-asian',
    category: 'cultural',
    displayOrder: 3,
  },
  {
    name: 'Middle Eastern',
    slug: 'cultural-middle-eastern',
    category: 'cultural',
    displayOrder: 4,
  },
  { name: 'West African', slug: 'cultural-west-african', category: 'cultural', displayOrder: 5 },
  { name: 'East African', slug: 'cultural-east-african', category: 'cultural', displayOrder: 6 },
  { name: 'Caribbean', slug: 'cultural-caribbean', category: 'cultural', displayOrder: 7 },
  {
    name: 'Latin American',
    slug: 'cultural-latin-american',
    category: 'cultural',
    displayOrder: 8,
  },
  { name: 'Mediterranean', slug: 'cultural-mediterranean', category: 'cultural', displayOrder: 9 },
  {
    name: 'Eastern European',
    slug: 'cultural-eastern-european',
    category: 'cultural',
    displayOrder: 10,
  },
  { name: 'Jewish', slug: 'cultural-jewish', category: 'cultural', displayOrder: 11 },
  { name: 'Filipino', slug: 'cultural-filipino', category: 'cultural', displayOrder: 12 },
  { name: 'Korean', slug: 'cultural-korean', category: 'cultural', displayOrder: 13 },
  { name: 'Japanese', slug: 'cultural-japanese', category: 'cultural', displayOrder: 14 },
  { name: 'Chinese', slug: 'cultural-chinese', category: 'cultural', displayOrder: 15 },
  { name: 'Polynesian', slug: 'cultural-polynesian', category: 'cultural', displayOrder: 16 },
  { name: 'Vegan', slug: 'dietary-vegan', category: 'dietary', displayOrder: 1 },
  { name: 'Vegetarian', slug: 'dietary-vegetarian', category: 'dietary', displayOrder: 2 },
  { name: 'Halal', slug: 'dietary-halal', category: 'dietary', displayOrder: 3 },
  { name: 'Kosher', slug: 'dietary-kosher', category: 'dietary', displayOrder: 4 },
];

export const TAG_SLUGS = TAG_SEEDS.map((tag) => tag.slug);

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

/** Largest guest count accepted anywhere a party size is captured. */
export const MAX_GUEST_COUNT = 100_000;

/** Short customer intro shown to vendors, e.g. "Planning my wedding!". */
export const MAX_CUSTOMER_BIO_LENGTH = 300;

/**
 * A vendor bio is a pitch, not an essay — roughly two solid paragraphs. The
 * column is `text`, so this ceiling exists to keep profiles scannable rather
 * than to protect storage.
 */
export const MAX_VENDOR_BIO_LENGTH = 1_200;

/**
 * Response windows a vendor may advertise, in hours. A closed set rather than
 * a free number so search (ticket #6) can filter on it without normalising
 * arbitrary values.
 */
export const RESPONSE_TIME_HOURS_OPTIONS = [1, 4, 24, 48] as const;

/** A vendor may claim at most this many tags from any one tag category. */
export const MAX_TAGS_PER_CATEGORY = 5;

/** Admin rejection reason or merge note on a tag suggestion. */
export const MAX_ADMIN_NOTE_LENGTH = 500;

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
