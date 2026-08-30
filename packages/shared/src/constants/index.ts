/**
 * Single source of truth for every domain enum, business rule, and seed list.
 * The Drizzle schema in `@vendor-marketplace/db` and the Zod schemas in `../schemas`
 * both derive from these arrays so the database, the API contract, and the
 * frontend can never drift apart.
 */

// --- Domain enums ----------------------------------------------------------

export const USER_ROLES = ['customer', 'vendor', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PRICE_TYPES = ['fixed', 'starting_at', 'hourly'] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

/**
 * `pending` is a date held by an open booking request: the vendor cannot block
 * it while someone is waiting on an answer, and it resolves the moment the
 * request does. Nothing writes it until the booking lifecycle lands in #7 — it
 * exists here so the calendar can render the state its legend promises, rather
 * than advertising a colour no row can ever carry.
 */
export const AVAILABILITY_STATUSES = ['available', 'booked', 'blocked', 'pending'] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

/**
 * Statuses a vendor may set directly. `booked` is owned by the booking
 * lifecycle (ticket #10) and `pending` by the request lifecycle (#7); neither
 * is ever writable from the availability calendar.
 */
export const VENDOR_SETTABLE_AVAILABILITY_STATUSES = ['available', 'blocked'] as const;
export type VendorSettableAvailabilityStatus =
  (typeof VENDOR_SETTABLE_AVAILABILITY_STATUSES)[number];

/**
 * Statuses the calendar renders but refuses to edit, because someone else owns
 * them. Derived from the two sets above so a new status cannot be added without
 * deciding which side of the line it falls on.
 */
export const LOCKED_AVAILABILITY_STATUSES = AVAILABILITY_STATUSES.filter(
  (status): status is Exclude<AvailabilityStatus, VendorSettableAvailabilityStatus> =>
    !(VENDOR_SETTABLE_AVAILABILITY_STATUSES as readonly string[]).includes(status),
);

/**
 * Everything that keeps a vendor profile from going live.
 *
 * Each blocker carries three things because three surfaces need different ones
 * at once: the section it belongs to (the editor's nav paints a gold dot
 * there), a short noun for the submit bar's summary line, and the full sentence
 * the vendor reads next to the field. Keeping them together is what lets the
 * field, the nav and the submit bar say the same thing without any of them
 * re-deriving it from another's wording.
 *
 * The API is the authority on which of these are unmet; it returns the keys.
 */
export const PUBLISH_BLOCKERS = {
  businessName: {
    section: 'business',
    short: 'business name',
    message: 'Add your business name',
  },
  location: {
    section: 'location',
    short: 'location',
    message: 'Add the city and state you serve',
  },
  categories: {
    section: 'business',
    short: 'categories',
    message: 'Choose at least one service category',
  },
  bio: {
    section: 'business',
    short: 'a short bio',
    message: 'Write a short bio so customers know what you do',
  },
  responseTime: {
    section: 'responseTime',
    short: 'response time',
    message: 'Say how quickly you usually reply',
  },
  packages: {
    section: 'packages',
    short: 'a bookable package',
    message: 'Publish at least one service package',
  },
} as const;

export const PUBLISH_BLOCKER_KEYS = Object.keys(PUBLISH_BLOCKERS) as ReadonlyArray<
  keyof typeof PUBLISH_BLOCKERS
>;
export type PublishBlockerKey = keyof typeof PUBLISH_BLOCKERS;

/**
 * Joins blocker shorts the way a person would: "a, b and c". The submit bar
 * reads as a sentence, not as a list widget.
 */
export function describeBlockers(keys: readonly PublishBlockerKey[]): string {
  const shorts = keys.map((key) => PUBLISH_BLOCKERS[key].short);

  if (shorts.length <= 1) {
    return shorts[0] ?? '';
  }

  return `${shorts.slice(0, -1).join(', ')} and ${shorts.at(-1)}`;
}

export const BOOKING_REQUEST_STATUSES = [
  'pending',
  'quoted',
  'accepted',
  'declined',
  'expired',
  'cancelled',
] as const;
export type BookingRequestStatus = (typeof BOOKING_REQUEST_STATUSES)[number];

/**
 * The only transitions the request lifecycle allows. Anything absent here is
 * refused with `INVALID_STATE_TRANSITION` — the map is the state machine, so a
 * new edge cannot be introduced by an endpoint forgetting to check.
 *
 * `accepted` is terminal for this ticket: payment turns it into a booking in
 * #10, and `declined`, `expired` and `cancelled` are final in every case.
 */
export const BOOKING_REQUEST_TRANSITIONS: Record<
  BookingRequestStatus,
  readonly BookingRequestStatus[]
> = {
  pending: ['quoted', 'accepted', 'declined', 'cancelled', 'expired'],
  quoted: ['accepted', 'declined', 'cancelled', 'expired'],
  accepted: [],
  declined: [],
  expired: [],
  cancelled: [],
};

/** Statuses a lazy expiry sweep may still move to `expired`. */
export const EXPIRABLE_BOOKING_REQUEST_STATUSES = ['pending', 'quoted'] as const;

/**
 * A request still awaiting a decision from someone — derived from the state
 * machine rather than listed, so it cannot drift from it: a status is live
 * exactly while it still has somewhere to go.
 *
 * This is what the `booking_requests_live_*` unique indexes cover. `pending`
 * alone would not: a vendor who quotes a custom request moves it out of
 * `pending` without settling it, and the customer resubmitting the same form
 * would then open a second thread for one date.
 */
export const LIVE_BOOKING_REQUEST_STATUSES: readonly BookingRequestStatus[] =
  BOOKING_REQUEST_STATUSES.filter((status) => BOOKING_REQUEST_TRANSITIONS[status].length > 0);

/**
 * The statuses at which the vendor may see the customer's full name and
 * contact details.
 *
 * The rule is deliberate and it is stated once, here, because three layers
 * enforce it (the DAO's projection, the response mapper, and the Zod response
 * schema) and they must not be able to disagree. Before acceptance a vendor is
 * deciding whether to take the work, which does not require being able to
 * identify the person — they see a first name and a last initial. Acceptance
 * is a commitment to turn up, so from that point the vendor can reach the
 * customer outside the app: full name, email, and phone if the customer gave
 * one.
 *
 * `declined`, `cancelled` and `expired` are absent on purpose. A vendor who
 * turned the work down has no reason to keep the contact details, and a
 * request that lapsed never created the obligation that justified them.
 */
export const CONTACT_DISCLOSING_BOOKING_REQUEST_STATUSES = ['accepted'] as const;

/** Whether this request has reached the point that discloses contact details. */
export function disclosesCustomerContact(status: BookingRequestStatus): boolean {
  return (CONTACT_DISCLOSING_BOOKING_REQUEST_STATUSES as readonly BookingRequestStatus[]).includes(
    status,
  );
}

/** Longest "anything else we should know" note on a request — frame `04`. */
export const BOOKING_REQUEST_NOTES_MAX_LENGTH = 600;

/**
 * The occasion a booking request is for — a controlled vocabulary, not free
 * text, because `20-customer-bookings-hub.md` renders it as a label
 * ("Photography · Wedding") and `99-open-questions.md` #6 asks for exactly
 * that guarantee. Stored in `booking_requests.event_type`, which is a
 * `varchar` rather than a `pgEnum` so widening the list needs no migration —
 * the closed set is enforced by `eventTypeSchema` at the API edge.
 */
export const EVENT_TYPES = [
  'wedding',
  'engagement',
  'birthday',
  'anniversary',
  'quinceanera',
  'baby_shower',
  'graduation',
  'corporate',
  'fundraiser',
  'holiday_party',
  'memorial',
  'other',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** How each occasion is written wherever a person reads it. */
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: 'Wedding',
  engagement: 'Engagement',
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  quinceanera: 'Quinceañera',
  baby_shower: 'Baby shower',
  graduation: 'Graduation',
  corporate: 'Corporate event',
  fundraiser: 'Fundraiser',
  holiday_party: 'Holiday party',
  memorial: 'Memorial',
  other: 'Something else',
};

export const BOOKING_STATUSES = ['confirmed', 'completed', 'cancelled', 'disputed'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const REVIEW_TYPES = ['customer_to_vendor', 'vendor_to_customer'] as const;
export type ReviewType = (typeof REVIEW_TYPES)[number];

/** Self-reported spending band on a customer profile; helps vendors self-select. */
export const BUDGET_TIERS = ['budget', 'mid_range', 'premium', 'luxury'] as const;
export type BudgetTier = (typeof BUDGET_TIERS)[number];

/**
 * How a budget tier is written wherever a person reads it. The dollar signs
 * are the compact form a card has room for; the label and range are what the
 * selector and the tooltip say, so the glyph is never the only explanation.
 */
export const BUDGET_TIER_LABELS: Record<
  BudgetTier,
  { glyph: string; label: string; range: string }
> = {
  budget: { glyph: '$', label: 'Budget', range: 'Under $500' },
  mid_range: { glyph: '$$', label: 'Mid-range', range: '$500 – $2,000' },
  premium: { glyph: '$$$', label: 'Premium', range: '$2,000 – $10,000' },
  luxury: { glyph: '$$$$', label: 'Luxury', range: '$10,000+' },
};

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
  /**
   * The landing card's line — "Photo & film". Three or four words naming what
   * the category covers, never a vendor count and never a from-price: a new
   * marketplace has neither worth publishing, and the full sentence in
   * `description` is twice too long for a card an eighth of the page wide.
   * See design/design-plan/10-landing.md.
   */
  readonly shortDescription: string;
  /** Lucide icon name rendered by the frontend. */
  readonly icon: string;
  readonly displayOrder: number;
  /**
   * What the people in this category are called, for sentences about them:
   * "24 photographers in Austin". The category is named for the service
   * ("Photography"); a result count is about the vendors, and no amount of
   * string-mangling turns one into the other. Display language, so it lives
   * here rather than in a column.
   */
  readonly vendorNoun: { readonly one: string; readonly many: string };
}

/**
 * Names are deliberately one word: the landing grid reads as a row of nouns,
 * and the description underneath is what says which vendors sit inside. A
 * two-word name is a sign the category is really two categories.
 *
 * `displayOrder` doubles as landing-page priority — `LANDING_CATEGORY_COUNT`
 * cards are featured on `/`, so the first entries are the highest-intent ones,
 * and the first six are exactly the six frame `01` draws, in its order.
 */
export const CATEGORY_SEEDS: readonly CategorySeed[] = [
  {
    name: 'Photography',
    slug: 'photography',
    description: 'Portraits, candids, photo booths, and full-day coverage.',
    shortDescription: 'Photo & film',
    icon: 'camera',
    displayOrder: 1,
    vendorNoun: { one: 'photographer', many: 'photographers' },
  },
  {
    name: 'Entertainment',
    slug: 'entertainment',
    description: 'DJs, live bands, musicians, MCs, dancers, and performers.',
    shortDescription: 'DJs, bands, hosts',
    icon: 'music',
    displayOrder: 2,
    vendorNoun: { one: 'entertainer', many: 'entertainers' },
  },
  {
    name: 'Catering',
    slug: 'catering',
    description: 'Caterers, private chefs, bartenders, and buffet service.',
    shortDescription: 'Food, bar, carts',
    icon: 'utensils',
    displayOrder: 3,
    vendorNoun: { one: 'caterer', many: 'caterers' },
  },
  {
    name: 'Venues',
    slug: 'venues',
    description: 'Halls, lofts, rooftops, gardens, and private dining rooms.',
    shortDescription: 'Halls & outdoor',
    icon: 'building-2',
    displayOrder: 4,
    vendorNoun: { one: 'venue', many: 'venues' },
  },
  {
    name: 'Florals',
    slug: 'florals',
    description: 'Bouquets, centerpieces, arches, and floral installations.',
    shortDescription: 'Bouquets & decor',
    icon: 'flower',
    displayOrder: 5,
    vendorNoun: { one: 'florist', many: 'florists' },
  },
  {
    name: 'Beauty',
    slug: 'beauty',
    description: 'Makeup artists, hair stylists, henna, and grooming.',
    shortDescription: 'Hair & makeup',
    icon: 'sparkles',
    displayOrder: 6,
    vendorNoun: { one: 'beauty pro', many: 'beauty pros' },
  },
  {
    name: 'Carts',
    slug: 'carts',
    description: 'Coffee, ice cream, dessert, and cocktail carts.',
    shortDescription: 'Coffee & dessert',
    icon: 'ice-cream-cone',
    displayOrder: 7,
    vendorNoun: { one: 'cart', many: 'carts' },
  },
  {
    name: 'Decor',
    slug: 'decor',
    description: 'Backdrops, table styling, uplighting, and stage design.',
    shortDescription: 'Styling & lighting',
    icon: 'palette',
    displayOrder: 8,
    vendorNoun: { one: 'decorator', many: 'decorators' },
  },
  {
    name: 'Videography',
    slug: 'videography',
    description: 'Highlight films, ceremony coverage, and drone work.',
    shortDescription: 'Films & drone',
    icon: 'video',
    displayOrder: 9,
    vendorNoun: { one: 'videographer', many: 'videographers' },
  },
  {
    name: 'Planning',
    slug: 'planning',
    description: 'Planners and day-of coordinators who run the event for you.',
    shortDescription: 'Planners & coordinators',
    icon: 'clipboard-list',
    displayOrder: 10,
    vendorNoun: { one: 'planner', many: 'planners' },
  },
  {
    name: 'Rentals',
    slug: 'rentals',
    description: 'Tents, tables, chairs, AV, and everything in between.',
    shortDescription: 'Tents, tables, AV',
    icon: 'package',
    displayOrder: 11,
    vendorNoun: { one: 'rental supplier', many: 'rental suppliers' },
  },
];

/**
 * "24 photographers in Austin" — the sentence a result count belongs in.
 * Falls back to "vendor" for a slug with no noun of its own, which is what a
 * search with no category selected wants anyway.
 */
export function vendorNounFor(categorySlug: string | undefined, count: number): string {
  const seed = CATEGORY_SEEDS.find((category) => category.slug === categorySlug);

  if (!seed) {
    return count === 1 ? 'vendor' : 'vendors';
  }

  return count === 1 ? seed.vendorNoun.one : seed.vendorNoun.many;
}

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

/**
 * The four categories behind "Or jump straight to" in the landing hero.
 *
 * A shortcut past the search bar for the visitor who already knows what they
 * need, so it is the four highest-intent types rather than the first four of
 * the row below it — Florals outranks Venues here and does not on the grid.
 * They replace the old "Popular: Florals · Taco carts · Live bands" link row,
 * which pointed at free-text queries that no longer exist.
 *
 * See design/design-plan/10-landing.md.
 */
export const LANDING_JUMP_CATEGORY_SLUGS = [
  'photography',
  'florals',
  'catering',
  'entertainment',
] as const;

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

/**
 * The one description of the fee model, in the two voices that need it.
 *
 * Customer and vendor surfaces were each written truthfully and independently
 * — "No service fee, the price you're quoted is the price you pay" against
 * "Your share, after the platform fee" — and read as a flat contradiction to
 * anyone who saw both. They are not in conflict: the commission comes **out of**
 * the total rather than on top of it, which is exactly what `calculateFees`
 * computes. What was missing was any surface saying so.
 *
 * Both strings live here so the two sides cannot drift apart again, and each
 * now names the other half of the arrangement rather than only its own.
 */
export const PLATFORM_FEE_COPY = {
  /** Customer-facing: what they pay, and what is not added to it. */
  customer: {
    title: 'No service fee.',
    body: "The price you're quoted is the price you pay.",
  },
  /** Vendor-facing: what they keep, and why the customer never sees it. */
  vendor: {
    delta: 'Your share, after the platform fee the customer never pays on top',
  },
} as const;

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
 * The pull-quote that opens the About tab. Roughly frame `03`'s line, and a
 * hard cap is what keeps it from becoming a second bio.
 */
export const MAX_TAGLINE_LENGTH = 80;
/**
 * How far either side of a wanted date the "free on a nearby date" band looks.
 *
 * A parameter with a default rather than a number buried in a query: two weeks
 * is close enough that moving is a real option, and far enough to find someone.
 */
export const NEARBY_DATE_WINDOW_DAYS = 14;
export const MAX_NEARBY_DATE_WINDOW_DAYS = 90;
/** Cards the band renders — frame `18` draws three. */
export const NEARBY_ALTERNATIVES_LIMIT = 3;
/**
 * Self-declared years in business. Zero is a real answer — a vendor starting
 * this year — and renders as "Less than a year" rather than "0 yrs".
 */
export const MIN_YEARS_IN_BUSINESS = 0;
export const MAX_YEARS_IN_BUSINESS = 75;

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

/*
 * The upload contract, stated once. `design/design-plan/40-states.md` fixes it
 * at "JPG or PNG · 12 MB each · min 1200px wide · 20 files per upload", and
 * the same sentence has to appear in the drop zone, the requirements rail and
 * the server's own refusals — so every one of them reads these.
 */

/** Largest accepted upload before server-side image processing. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/**
 * Accepted **input** formats. WebP is deliberately not among them: it is the
 * format `sharp` writes, not one a camera or an editor exports, and offering
 * it in the picker only widened the set of files a vendor could pick and then
 * be refused for. Narrowing the client without narrowing the server would do
 * the reverse, so both ends read this list.
 */
export const ACCEPTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'] as const;

/**
 * Narrowest image worth publishing. A photograph below this renders soft on a
 * profile cover, which is a quality floor rather than a validity one — the
 * vendor is asked to replace it, not told the file is invalid.
 */
export const MIN_UPLOAD_IMAGE_WIDTH = 1200;

/**
 * Files accepted in one batch. Over this the extras are held back and named
 * rather than the whole selection being refused: the twenty that fit are still
 * work the vendor does not have to redo.
 */
export const MAX_UPLOAD_BATCH_FILES = 20;

/** Human-readable file extensions for the accepted set, in picker order. */
export const ACCEPTED_IMAGE_LABEL = 'JPG or PNG';

/**
 * The one constraint sentence. `40-states.md` requires it verbatim in both the
 * drop zone and the requirements rail, so it is built here rather than
 * retyped at each site.
 */
export const UPLOAD_CONSTRAINT_LINE = `${ACCEPTED_IMAGE_LABEL} · ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB each · min ${MIN_UPLOAD_IMAGE_WIDTH}px wide · ${MAX_UPLOAD_BATCH_FILES} files per upload`;

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

/**
 * Where Stripe returns a vendor after hosted payout onboarding, and where it
 * sends them when the link has expired or was already used.
 *
 * These are Next.js routes that the **API** has to hand to Stripe, so they live
 * here rather than in either app: renaming the page without minting links to a
 * 404 is only possible while both sides read one value. `apps -> packages` is
 * the allowed direction, so both can.
 */
export const VENDOR_PAYMENTS_PATH = '/vendor/payments';
export const VENDOR_PAYMENTS_RETURN_PATH = `${VENDOR_PAYMENTS_PATH}/return`;

/** `resume` is what turns the page's heading into "that link had expired". */
export const VENDOR_PAYMENTS_RESUME_PATH = `${VENDOR_PAYMENTS_PATH}?resume=1`;
