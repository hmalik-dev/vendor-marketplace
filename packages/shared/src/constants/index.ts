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
 * request does. It is overlaid at read time rather than stored, so an
 * unanswered request never takes the vendor out of a date-filtered search.
 *
 * `completed` is a date the vendor was booked for that has now passed. It is
 * **derived at read time from `booked` plus the date**, not written by anything
 * — a booked day that is behind us is a delivered event, and the frame keeps it
 * on the calendar rather than letting delivered work vanish. Storing it would
 * mean a writer that has to run at midnight, and a status that silently lies
 * until it does.
 */
export const AVAILABILITY_STATUSES = [
  'available',
  'booked',
  'blocked',
  'pending',
  'completed',
] as const;
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

/**
 * How a booking's money was arranged at the moment it was paid — **written
 * down rather than inferred, because the two are unwound differently and a row
 * cannot be asked afterwards which one it was.**
 *
 * `destination`: the pre-#423 destination charge. Stripe split the money as the
 * card succeeded, so the vendor already holds their share, there is no transfer
 * object, and a refund had to carry `reverse_transfer`. Nothing writes this any
 * more; it is the column's **default**, which is the point.
 *
 * `separate`: separate charges and transfers. The whole amount sits in Orla's
 * balance until the payout sweep moves the vendor's share.
 *
 * The default is what closes the deploy window. Migrations run in Railway's
 * `preDeployCommand`, so the old image keeps serving until the new one is
 * healthy — every checkout completing in between is a destination charge that
 * the backfill has already been and gone past. Defaulting to `destination` and
 * having only the new code write `separate` means those rows identify
 * themselves, instead of looking to the sweep like unpaid new-model bookings
 * and being transferred a second time.
 */
export const PAYOUT_MODELS = ['destination', 'separate'] as const;
export type PayoutModel = (typeof PAYOUT_MODELS)[number];

/**
 * Who ended a booking, recorded rather than inferred.
 *
 * A cancelled booking reaches the customer's screen by two routes that read
 * identically on the row — they cancelled it themselves, or an operator
 * unwound it when the other party was suspended — and the two need different
 * words. It was only ever distinguishable by string-matching
 * `cancellation_reason` against the sentence `admin.service.ts` happens to
 * write, which is a copy edit away from being wrong.
 *
 * A request withdrawn before acceptance is the third case and is **not** a
 * value here: it produces no `bookings` row at all, so its absence is what
 * names it.
 */
export const BOOKING_CANCELLED_BY = ['customer', 'admin'] as const;
export type BookingCancelledBy = (typeof BOOKING_CANCELLED_BY)[number];

export const REVIEW_TYPES = ['customer_to_vendor', 'vendor_to_customer'] as const;
export type ReviewType = (typeof REVIEW_TYPES)[number];

/**
 * The states a vendor can serve, as **two-letter USPS codes**. Ruled canonical
 * 2026-08-30.
 *
 * The code is the stored value, not a display choice. `Austin, TX` and
 * `Austin, Texas` were two rows in the same database, so a customer who picked
 * one never saw the other's vendors — and the split widened with every new
 * vendor, because the form offered full names while the majority of rows held
 * codes. Closing the vocabulary is what stops that reopening.
 *
 * Fifty states plus the District of Columbia. Territories are deliberately
 * absent: the product does not serve them yet, and an unserved option on a
 * required field is a dead end a vendor cannot get past.
 */
export const US_STATE_CODES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
] as const;
export type UsStateCode = (typeof US_STATE_CODES)[number];

/**
 * How each code is written wherever a person reads or picks one. The form
 * shows the name and stores the code, so a vendor never types a state and the
 * two spellings can never diverge again.
 */
export const US_STATE_NAMES: Readonly<Record<UsStateCode, string>> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

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

/**
 * The three groups a vendor tag belongs to, rendered as sections in the picker.
 *
 * All three are global: a language, a culture and a dietary requirement mean the
 * same thing whichever trade is being filtered, so a tag belongs to every vendor
 * category at once and needs no scope column.
 *
 * A fourth group, `style`, was built in #281 and removed in #329 when Style was
 * ruled out of the MVP. It was the only scoped group — its option set changed
 * with the selected vendor type — and `tags.vendor_category_id` existed solely
 * to carry that scope. Both went together; re-adding one means re-adding both.
 */
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
  /*
   * Admin moderation (#15). Approving and merging both land here: the
   * vendor's suggestion became a real tag on their profile either way, and
   * only the body differs. A rejection deliberately sends nothing —
   * notifying somebody their idea was turned down discourages the next one,
   * and the admin note is recorded for the queue rather than for them.
   */
  'tag_suggestion_approved',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * What became of one transactional email, on the row written beside the send.
 *
 * Two of these are written locally and three only ever arrive from Resend, and
 * the split is what the values are shaped around:
 *
 * - `sent` — the provider accepted the message. It is the *end* of what the
 *   sending process can know, not the end of the story.
 * - `failed` — the provider refused it, or the send threw before it answered.
 *   A row in this state carries no provider message id, so no delivery event
 *   can ever reach it; the failure reason is the whole record.
 * - `delivered`, `bounced`, `complained` — the provider's own account of what
 *   happened afterwards, matched to the row by message id.
 *
 * There is deliberately no `opened` or `clicked`. Resend emits both, and
 * recording them would turn an operational record of *whether we told someone*
 * into behavioural tracking of a person who never asked for it. #439 asks
 * whether the customer was told, and delivery answers that.
 */
export const EMAIL_DELIVERY_OUTCOMES = [
  'sent',
  'failed',
  'delivered',
  'bounced',
  'complained',
] as const;
export type EmailDeliveryOutcome = (typeof EMAIL_DELIVERY_OUTCOMES)[number];

/**
 * Which outcome may replace which, so a replayed or reordered provider event
 * cannot walk a record backwards.
 *
 * An event is applied **only when it outranks what the row already holds**,
 * which is the whole of the idempotency rule: replaying `email.delivered` a
 * second time is a no-op because `delivered` does not outrank `delivered`, and
 * a `delivered` webhook arriving after a `bounced` one — Resend retries for
 * hours, and nothing promises order — leaves the bounce standing.
 *
 * `bounced` ranks highest because it is the one outcome that says something
 * about the *address* rather than about this message: every future
 * notification to that person is lost too, which is exactly the signal an
 * operator needs and the one that must never be overwritten. `complained`
 * outranks `delivered` because it can only ever follow one.
 *
 * `failed` sits just above `sent` and below every delivery outcome. Above
 * `sent`, because Resend's own `email.failed` and `email.suppressed` say the
 * message never went out and must be able to replace "we handed it over".
 * Below the rest, because if the provider ever says both `failed` and
 * `delivered` for one message, the delivery is the later truth — and a locally
 * written `failed` row carries no provider message id for any event to reach
 * anyway.
 */
export const EMAIL_DELIVERY_OUTCOME_RANK: Readonly<Record<EmailDeliveryOutcome, number>> = {
  sent: 0,
  failed: 1,
  delivered: 2,
  complained: 3,
  bounced: 4,
};

/**
 * What a transactional email was *about*, when it was about anything.
 *
 * Stored beside the id rather than instead of it, for `ADMIN_ACTION_SUBJECTS`'
 * reason and one more. The reason: a bare uuid does not say which table it came
 * from, and these ids carry no foreign key because the record has to outlive
 * its subject. The one more: the fourteen notification payloads name **two**
 * different entities — the booking-request flow carries `bookingRequestId`,
 * while payments, moderation and reviews carry `bookingId` — so a single
 * untyped column would put two id spaces in one place and make "the emails this
 * booking generated" answerable only by guessing.
 *
 * A conversation is deliberately absent: `new_message` is the one notification
 * type that never emails, so no delivery record can ever be about one.
 */
export const EMAIL_DELIVERY_ENTITIES = ['booking_request', 'booking'] as const;
export type EmailDeliveryEntity = (typeof EMAIL_DELIVERY_ENTITIES)[number];

/**
 * How much of a provider failure reason is kept.
 *
 * Long enough for Resend's bounce diagnostics — an SMTP rejection quotes the
 * receiving server verbatim — and short enough that a provider answering with
 * something unbounded cannot write a page of text per send into the table.
 */
export const MAX_EMAIL_FAILURE_REASON_LENGTH = 500;

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
  /**
   * The tag groups the Refine bar may offer on a search for this category.
   *
   * A control that can open nothing is furniture (`01-foundations.md`), and
   * `Dietary` on a photography search is exactly that: the four dietary tags
   * are `Vegan`, `Vegetarian`, `Halal` and `Kosher` — diets, which only a
   * vendor who puts food in a guest's hand can accommodate. `language` and
   * `cultural` are universal: every vendor works in some language and knows
   * some traditions, whatever they sell.
   *
   * **Here rather than in a `categories` column**, for the same reason
   * `vendorNoun` is. The seed is the only writer either way — `seedCategories`
   * upserts from this array and no surface in the product edits a category —
   * so a column would buy the appearance of deploy-free editing and none of
   * the substance, while costing a migration, a widened wire schema, and a
   * prop threaded to a client component that only ever holds the slug out of
   * the URL. Required rather than optional, so a twelfth category cannot
   * forget to declare it. If the set ever does need to change without a
   * deploy, this array is the single write point to migrate from.
   */
  readonly applicableTagCategories: readonly TagCategory[];
}

/**
 * Every group but `dietary` — what a category that serves no food offers.
 *
 * Named rather than spelled out ten times, so the eight categories that
 * share this answer are visibly sharing one answer rather than eight that
 * happen to agree.
 */
const NON_DIETARY_TAG_CATEGORIES: readonly TagCategory[] = TAG_CATEGORIES.filter(
  (category) => category !== 'dietary',
);

/**
 * Names are deliberately one word: the landing grid reads as a row of nouns,
 * and the description underneath is what says which vendors sit inside. A
 * two-word name is a sign the category is really two categories.
 *
 * `displayOrder` doubles as landing-page priority — `LANDING_CATEGORY_COUNT`
 * cards are featured on `/`, so the first entries are the highest-intent ones.
 *
 * **#419 removed `Florals` and folded it into `Decor`**, on the account
 * holder's ruling: both were empty and in this market one vendor sells both.
 * `Decor` inherits the fifth slot along with the vendors — the landing grid
 * has no image fallback, and `apps/web/public/categories/` holds a photograph
 * for exactly the first six, so leaving the order alone would have promoted
 * `Carts` and shipped a broken image (`page.test.tsx` guards it). Frame `01`
 * still draws a `Florals` card; it predates the ruling.
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
    applicableTagCategories: NON_DIETARY_TAG_CATEGORIES,
  },
  {
    name: 'Entertainment',
    slug: 'entertainment',
    description: 'DJs, live bands, musicians, MCs, dancers, and performers.',
    shortDescription: 'DJs, bands, hosts',
    icon: 'music',
    displayOrder: 2,
    vendorNoun: { one: 'entertainer', many: 'entertainers' },
    applicableTagCategories: NON_DIETARY_TAG_CATEGORIES,
  },
  {
    name: 'Catering',
    slug: 'catering',
    description: 'Caterers, private chefs, bartenders, and buffet service.',
    /*
     * Not "Food, bar, carts". `carts` is its own category one row below, with
     * its own vendors and its own short description, so naming it here sent a
     * visitor looking for a coffee cart into Catering and made the two rows
     * read as overlapping when the taxonomy treats them as distinct.
     */
    shortDescription: 'Food, bar, buffet',
    icon: 'utensils',
    displayOrder: 3,
    vendorNoun: { one: 'caterer', many: 'caterers' },
    applicableTagCategories: TAG_CATEGORIES,
  },
  {
    name: 'Venues',
    slug: 'venues',
    description: 'Halls, lofts, rooftops, gardens, and private dining rooms.',
    shortDescription: 'Halls & outdoor',
    icon: 'building-2',
    displayOrder: 4,
    vendorNoun: { one: 'venue', many: 'venues' },
    applicableTagCategories: NON_DIETARY_TAG_CATEGORIES,
  },
  {
    name: 'Decor',
    slug: 'decor',
    description: 'Flowers, backdrops, table styling, uplighting, and stage design.',
    shortDescription: 'Flowers & styling',
    icon: 'palette',
    displayOrder: 5,
    vendorNoun: { one: 'decorator', many: 'decorators' },
    applicableTagCategories: NON_DIETARY_TAG_CATEGORIES,
  },
  {
    name: 'Beauty',
    slug: 'beauty',
    description: 'Makeup artists, hair stylists, henna, and grooming.',
    shortDescription: 'Hair & makeup',
    icon: 'sparkles',
    displayOrder: 6,
    vendorNoun: { one: 'beauty pro', many: 'beauty pros' },
    applicableTagCategories: NON_DIETARY_TAG_CATEGORIES,
  },
  {
    name: 'Carts',
    slug: 'carts',
    description: 'Coffee, ice cream, dessert, and cocktail carts.',
    shortDescription: 'Coffee & dessert',
    icon: 'ice-cream-cone',
    displayOrder: 7,
    vendorNoun: { one: 'cart', many: 'carts' },
    applicableTagCategories: TAG_CATEGORIES,
  },
  {
    name: 'Videography',
    slug: 'videography',
    description: 'Highlight films, ceremony coverage, and drone work.',
    shortDescription: 'Films & drone',
    icon: 'video',
    displayOrder: 8,
    vendorNoun: { one: 'videographer', many: 'videographers' },
    applicableTagCategories: NON_DIETARY_TAG_CATEGORIES,
  },
  {
    name: 'Planning',
    slug: 'planning',
    description: 'Planners and day-of coordinators who run the event for you.',
    shortDescription: 'Planners & coordinators',
    icon: 'clipboard-list',
    displayOrder: 9,
    vendorNoun: { one: 'planner', many: 'planners' },
    applicableTagCategories: NON_DIETARY_TAG_CATEGORIES,
  },
  {
    name: 'Rentals',
    slug: 'rentals',
    description: 'Tents, tables, chairs, AV, and everything in between.',
    shortDescription: 'Tents, tables, AV',
    icon: 'package',
    displayOrder: 10,
    vendorNoun: { one: 'rental supplier', many: 'rental suppliers' },
    applicableTagCategories: NON_DIETARY_TAG_CATEGORIES,
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
 * The tag groups worth offering as filters on a search for this category.
 *
 * Falls back to **every** group when no category is selected or the slug is not
 * one we seed. A search across the whole marketplace has caterers in its result
 * set, so `Dietary` there can return something; and a slug we do not recognise
 * has told us nothing about which filters are pointless, so hiding a control on
 * that basis would be a guess. The narrowing is only ever made from a category
 * we actually know.
 */
export function tagCategoriesFor(categorySlug: string | undefined): readonly TagCategory[] {
  const seed = CATEGORY_SEEDS.find((category) => category.slug === categorySlug);

  return seed?.applicableTagCategories ?? TAG_CATEGORIES;
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
 *
 * Every value is a slug this file still seeds, so nothing chains: `floristry`
 * points straight at `decor` rather than at `florals`, which #419 retired in
 * turn. A chain would depend on object key order to resolve, and would resolve
 * only if the intermediate hop happened to run first.
 */
export const CATEGORY_SLUG_SUCCESSORS: Readonly<Record<string, string>> = {
  'dj-music': 'entertainment',
  'makeup-beauty': 'beauty',
  decoration: 'decor',
  floristry: 'decor',
  'event-planning': 'planning',
  'rentals-equipment': 'rentals',
  lighting: 'decor',
  // #419: Florals folded into Decor. Removing the seed alone would have left
  // the live row standing with its vendors and merely deactivated.
  florals: 'decor',
};

/**
 * The seeded slug a retired one now points at, or `null` for a slug that was
 * never retired — including one that is still live, and one that never existed.
 *
 * `/search?category=florals` is a link somebody may have shared before #419
 * retired the category, and left alone it renders an empty result grid that
 * reads as "this marketplace has no florists" rather than "this category moved".
 * The search page redirects on this instead.
 *
 * `Object.hasOwn` rather than a plain lookup: the map is an object literal, so
 * `?category=constructor` would otherwise resolve to `Object`'s own and send
 * the visitor somewhere no category describes.
 */
export function retiredCategorySuccessor(slug: string | undefined | null): string | null {
  if (typeof slug !== 'string' || !Object.hasOwn(CATEGORY_SLUG_SUCCESSORS, slug)) {
    return null;
  }

  return CATEGORY_SLUG_SUCCESSORS[slug] ?? null;
}

export const CATEGORY_SLUGS = CATEGORY_SEEDS.map((category) => category.slug);

/**
 * How many categories the landing page features. The full taxonomy belongs on
 * search (#6), where a category is a filter you can actually click; a landing
 * grid of ten inert cards is bloat, not browse.
 */
export const LANDING_CATEGORY_COUNT = 6;

/**
 * The four categories behind "Or jump straight to" in the landing hero.
 *
 * A shortcut past the search bar for the visitor who already knows what they
 * need, so it is the four highest-intent types rather than the first four of
 * the row below it — Beauty outranks Venues here and does not on the grid.
 * They replace the old "Popular: Florals · Taco carts · Live bands" link row,
 * which pointed at free-text queries that no longer exist.
 *
 * **The four and their order were ruled by the account holder on 2026-09-06**
 * (#419), when `florals` left the taxonomy and took the second slot with it.
 * `beauty` takes that slot; the other three keep theirs.
 *
 * The landing hero (`app/page.tsx`) and the footer's Browse column
 * (`site-footer.tsx`) both read this one constant, deliberately, so the two
 * can never disagree — editing it here moves both.
 *
 * See design/design-plan/10-landing.md.
 */
export const LANDING_JUMP_CATEGORY_SLUGS = [
  'photography',
  'catering',
  'entertainment',
  'beauty',
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
 * What each side is told about money, in the one place both are decided.
 *
 * #217 read this as a contradiction — the customer told "No service fee", the
 * vendor told "your share, after the platform fee" — and asked for the two to
 * be reconciled. Reconciling them is the wrong fix, because
 * `98-post-mvp.md` **defers all fee language on vendor surfaces**: "no
 * vendor-facing surface makes any fee claim, in either direction. Not 'no
 * fees', not a rate, not a hint", and the customer's promise "must not be
 * mirrored, or negated, onto the vendor side". The vendor model is not settled,
 * and a claim walked back later costs more trust than saying nothing now.
 *
 * So the vendor line was not an inconsistency to be explained — it was a
 * Post-MVP claim that should never have shipped. It is replaced by the payment
 * **mechanism**, which is true under any pricing model the platform later
 * picks. The customer's half is a real differentiator on their side of the
 * transaction and stays exactly as it was.
 */
export const MONEY_COPY = {
  /** Customer-facing: what they pay, and what is not added to it. */
  customer: {
    title: 'No service fee.',
    body: "The price you're quoted is the price you pay.",
  },
  /**
   * Vendor-facing: the mechanism, never the fee. Anything naming a rate, a
   * commission or a fee on a vendor surface is a Post-MVP leak — see the guard
   * in `no-vendor-fee-language.test.ts`.
   *
   * **This stopped being the interim string and became the fallback (#424).**
   * Frame `08` draws the line as `Next payout Jun 18` — a real date, not a
   * statement about the arrangement — and #308 could not ship one, because
   * there was no payout schedule to read a date from and a date the platform
   * invents is exactly what the no-invented-numbers rule forbids. So this said
   * something true and dateless instead, and the frame's Text axis stayed open.
   *
   * #423 created the schedule and #424 renders it, so the axis is closed and
   * the date is derived from `payoutReleaseAt` rather than written here. This
   * string is what the dashboard falls back to when a vendor is owed nothing:
   * there is no next payout to date, and the mechanism is still true. Keep it
   * dateless — a date belongs to the surface that read one, not to a constant.
   */
  vendorPayout: 'Paid out after each event',
} as const;

/** Cancelling at least this many hours before the event earns a full refund. */
export const FULL_REFUND_CUTOFF_HOURS = 48;

/** Refund fraction when cancelling inside the full-refund cutoff. */
export const LATE_CANCELLATION_REFUND_RATE = 0.5;

/**
 * How long after the event date the vendor's share is transferred. **D35.**
 *
 * The product charges into Orla's own balance and pays the vendor afterwards
 * (#423), so this is the whole of the payout schedule. **It is one constant,
 * read everywhere**: `payoutReleaseAt` is the only place a release date is
 * derived from it, and every surface that names one — the vendor dashboard's
 * payout line, the window a customer can report a problem inside, the terms —
 * reads it from there. Nothing restates the interval, in code or in prose.
 *
 * **72, and calendar hours.** No business days, no holiday calendar, and no new
 * timezone arithmetic: #409 already cost this product one bug of that shape.
 * The window exists so that a customer can dispute *before* the release, and
 * that is worth more than a short one — under D31 a dispute after release is a
 * transfer reversal that can push a vendor negative, while before it there is
 * nothing transferred and a cancellation is a plain refund. Every dispute the
 * window pulls forward avoids the worst failure this path has.
 *
 * D35 also rules out what this is *not* for: a deliverable that arrives weeks
 * after the event — a photographer's gallery — is not a release-window problem
 * and no interval fixes it. That belongs to the dispute path, and after release
 * to D31's unwind. Do not widen this trying to cover it.
 *
 * Changing it reprices nothing, because the date is derived on every read
 * rather than written onto the booking, and the amount is the stored
 * `vendor_payout_cents`.
 */
export const PAYOUT_RELEASE_HOURS = 72;

/**
 * How often the API sweeps for payouts that have come due.
 *
 * Fifteen minutes, because the thing being waited for is measured in hours: a
 * tighter loop would add database round trips to buy resolution the release
 * window cannot use. The sweep is safe to run twice — a booking is claimed with
 * `FOR UPDATE SKIP LOCKED` and the transfer carries an idempotency key — so the
 * interval is a cost decision rather than a correctness one.
 */
export const PAYOUT_SWEEP_INTERVAL_MS = 15 * 60_000;

/**
 * What the vendor's side of a booking can say about its payout, as data.
 *
 * `status` cannot carry this: a booking is `confirmed` both before and after
 * the money moves, so a surface reading the status alone cannot tell a payout
 * that is waiting for its date from one already sent. `held` is the dispute
 * hold — distinguishable from `pending` here rather than by inferring it from
 * `status = 'disputed'`, which is what #423 acceptance 16 asks for.
 */
export const PAYOUT_STATUSES = ['pending', 'held', 'released'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/**
 * The booking statuses that hold a payout — the other half of the pair
 * `RELEASABLE_STATUSES` opens.
 *
 * A list of one, and a list rather than a literal because the fact "`disputed`
 * means the money is stuck" has to be stated exactly once. `payoutStatusOf`
 * tests membership in it, and the vendor dashboard **selects** on it: a second
 * hold status added to the classifier but not to the selector would drop those
 * rows out of the vendor's owed figure entirely — the money would simply stop
 * being mentioned, which is a worse failure than mislabelling it (#424).
 */
export const HELD_PAYOUT_STATUSES = ['disputed'] as const;

/**
 * Which way an operator settled a reported problem.
 *
 * Here rather than beside its Zod schema because `.claude/rules/shared-contracts.md`
 * has one home for a domain vocabulary, and `resolveDispute`'s parameter type
 * is derived from this rather than re-spelled as a literal union — which the
 * same rule calls a defect even when the two currently match.
 */
export const RESOLVE_DISPUTE_OUTCOMES = ['vendor', 'customer'] as const;
export type DisputeOutcome = (typeof RESOLVE_DISPUTE_OUTCOMES)[number];

/**
 * Every mutation the operations console can make, one member per route (#434).
 *
 * A **closed enum rather than free text**, because the whole point of the log
 * is that it can be counted and filtered: "how many accounts did we suspend
 * last week" is answerable over an enum and guesswork over a sentence somebody
 * typed. A new mutating admin route adds a member here, and the `pgEnum` it
 * feeds refuses the row until it does.
 *
 * Named after what happened, not after the function that did it: `updateTag`
 * may be renamed, and the rows it already wrote must still mean the same thing.
 */
export const ADMIN_ACTIONS = [
  'user_banned',
  'user_unbanned',
  'review_deleted',
  'tag_updated',
  'tag_suggestion_resolved',
  'dispute_resolved',
  'support_case_resolved',
  'payout_retried',
] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/**
 * What an action was taken *on* — the other half of the subject filter.
 *
 * The pair `(subject_type, subject_id)` rather than five nullable foreign keys.
 * An audit row must survive the thing it is about being deleted — a review
 * deletion whose row cascaded away with the review would erase the only record
 * that the deletion happened — so these ids deliberately carry **no foreign
 * key**. That is also why the type has to be stored: a bare uuid does not say
 * which table it came from.
 */
export const ADMIN_ACTION_SUBJECTS = [
  'user',
  'review',
  'tag',
  'tag_suggestion',
  'booking',
  'support_case',
] as const;
export type AdminActionSubject = (typeof ADMIN_ACTION_SUBJECTS)[number];

/**
 * Days in the dashboard's `This week` strip.
 *
 * Seven, and **rolling from today** rather than snapped to a calendar week:
 * frame `27 Vendor dashboard — 1024` draws Jun 9 through Jun 15 against a
 * Sunday-the-14th event, which no Sunday- or Monday-started week produces. A
 * rolling week is also the one a vendor is actually working — the back half of
 * the current week is history to them by Thursday.
 */
export const BOOKING_WEEK_DAYS = 7;

/**
 * How many days the dashboard sends so the strip can start on the **viewer's**
 * today rather than the server's.
 *
 * A server cannot know a visitor's day, and the widest wall-clock spread in use
 * puts it one day either side of the UTC day — the same reasoning
 * `isUniversallyPastDate` is built on. So the window runs from the day before
 * the UTC day, and the strip slices its seven from whichever day the browser
 * turns out to be on. Before this it slid: a vendor at UTC-5 in the evening got
 * a "This week" that began tomorrow and did not contain today. #409.
 */
export const BOOKING_WEEK_WINDOW_DAYS = BOOKING_WEEK_DAYS + 2;

/** How far forward the vendor availability calendar runs. */
export const AVAILABILITY_MONTHS_AHEAD = 12;

/**
 * The furthest ahead an event date may be booked for.
 *
 * `eventDate` was bounded below — a date past everywhere on Earth is refused —
 * and not above, so `9999-12-31` was accepted and stored. Nothing downstream
 * expects it: the expiry window, the "days until" arithmetic and every calendar
 * read are written for dates inside a working horizon.
 *
 * Derived from the calendar rather than chosen: a vendor's availability runs
 * `AVAILABILITY_MONTHS_AHEAD` forward, so a request beyond twice that horizon
 * is asking about a date the vendor cannot see, let alone answer for. Two years
 * leaves room for the genuine long-lead case — a wedding booked eighteen months
 * out — without admitting the fourth millennium.
 */
export const MAX_EVENT_DATE_MONTHS_AHEAD = AVAILABILITY_MONTHS_AHEAD * 2;

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

/**
 * Every rating a review can carry, ascending — the distribution chart's rows.
 *
 * Derived from the bounds rather than written out, so the chart cannot disagree
 * with what the schema accepts: `12-vendor-profile.md:134` draws **five** bars,
 * and five is `MAX - MIN + 1`, not a number the component gets to choose.
 */
export const REVIEW_RATINGS = Array.from(
  { length: REVIEW_RATING_MAX - REVIEW_RATING_MIN + 1 },
  (_unused, index) => REVIEW_RATING_MIN + index,
) as readonly number[];

/**
 * How many reviews a page of the vendor's Reviews tab holds.
 *
 * Its own number rather than `DEFAULT_PAGE_SIZE`, because the tab **appends**
 * — `12-vendor-profile.md:137`, "Show more reviews appends; no page numbers" —
 * so this is how much arrives per press, not how much fills a numbered page.
 */
export const REVIEW_PAGE_SIZE = 10;

/** Default page size for vendor search and most list endpoints. */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * The admin console's page size, and the reason it is not `DEFAULT_PAGE_SIZE`.
 *
 * `22-admin.md` states it as an acceptance criterion — "**Fifteen rows fit at
 * 1440 × 900.** Count them against the real header height before claiming a
 * number — a table that promises eighteen and clips three is a bug." The
 * console's table is 44px rows in a pane that measures ~700px once the header,
 * title row and Refine bar are taken out, so fifteen is what fits.
 *
 * Setting it here rather than trusting the layout makes the count a property of
 * the **data**: a page can never carry more rows than the pane can show, so the
 * clipping the criterion warns about is unreachable rather than merely
 * unobserved. The pane still scrolls internally, which is what absorbs the
 * pager and the narrower viewports.
 */
export const ADMIN_PAGE_SIZE = 15;
/** Message history loads in larger pages than list endpoints. */
export const MESSAGES_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/**
 * The highest page number any list endpoint will accept.
 *
 * `page` was bounded below and not above, so `?page=2147483648` reached the DAO,
 * where `offset = (page - 1) * pageSize` overflowed `int4` and the query failed
 * as a 500 rather than a 400. The ceiling is derived from that arithmetic rather
 * than picked: at `MAX_PAGE_SIZE` per page the largest offset this permits is
 * 10,000,000, which is three orders of magnitude inside `int4` and still far
 * past any result set this product will return. A deep offset is a table scan,
 * not a search — nobody paginates to the hundred-thousandth vendor.
 */
export const MAX_PAGE = 100_000;

/*
 * The upload contract, stated once. `design/design-plan/40-states.md` fixes it
 * at "JPG or PNG · 12 MB each · min 1200px wide · 20 files per upload", and
 * the same sentence has to appear in the drop zone, the requirements rail and
 * the server's own refusals — so every one of them reads these.
 */

/** One megabyte, decimal — the convention a file manager reports. */
export const BYTES_PER_MB = 1_000_000;

/**
 * Largest accepted upload before server-side image processing.
 *
 * **Decimal megabytes, not binary.** This was `12 * 1024 * 1024`, and every
 * displayed size divided by the same figure while labelling the result "MB" —
 * so a 70,062,643-byte file was reported as `66.8 MB` where Finder called it
 * `70.1 MB`, an under-report of 4.8% against the only number the vendor can
 * see. Internally consistent and externally wrong.
 *
 * Changing the divisor alone would have made the limit read `12.6 MB` and
 * contradicted `40-states.md`, which fixes the contract at "12 MB each". So the
 * limit moved to the vendor's units instead: **12 MB now means 12,000,000
 * bytes**, the stated number is literally true, and the drop zone, the
 * refusals and the file manager finally agree. The server's multipart ceiling
 * reads this same constant, so both ends moved together.
 */
export const MAX_UPLOAD_BYTES = 12 * BYTES_PER_MB;

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
export const UPLOAD_CONSTRAINT_LINE = `${ACCEPTED_IMAGE_LABEL} · ${MAX_UPLOAD_BYTES / BYTES_PER_MB} MB each · min ${MIN_UPLOAD_IMAGE_WIDTH}px wide · ${MAX_UPLOAD_BATCH_FILES} files per upload`;

/**
 * The same contract for a field that holds **one** image.
 *
 * `UPLOAD_CONSTRAINT_LINE` is the batch drop zone's sentence — `40-states.md`
 * fixes it for the portfolio uploader, where "each" and "20 files per upload"
 * are both facts. A single-photo field has neither: the customer profile photo
 * offered "12 MB each · 20 files per upload" above a chooser that takes one
 * file and a refusal that already says "under 12 MB · at least 1200px wide",
 * so the hint was the only copy on the screen describing a control that does
 * not exist.
 */
export const SINGLE_UPLOAD_CONSTRAINT_LINE = `${ACCEPTED_IMAGE_LABEL} · under ${MAX_UPLOAD_BYTES / BYTES_PER_MB} MB · at least ${MIN_UPLOAD_IMAGE_WIDTH}px wide`;

/**
 * The cover is landscape 3:2. Frame `09` draws its drop zone 216x144, and the
 * public card and profile header crop to the same ratio.
 *
 * This replaces the `21:9, 1600x686 min` ask #288 retired: a spec nobody
 * shoots, stated as arithmetic. Asking for "landscape, this big or better" is
 * a thing a photographer can answer without a calculator.
 */
export const COVER_ASPECT_RATIO = 3 / 2;

/**
 * The cover zone's own constraint line, stated inside the zone before the
 * picker opens — `40-states.md` requires the constraint at the point of
 * choosing, and the generic `UPLOAD_CONSTRAINT_LINE` says nothing about
 * orientation, which is the one thing that matters for a cover.
 *
 * The height is derived from the shared minimum width and the cover ratio
 * rather than written down: 1200 / 1.5 = 800, which is what frame `09` draws.
 * Writing `800` here would be a second source for a number the code already
 * holds, and the two would drift the first time the floor moved.
 */
export const COVER_CONSTRAINT_LINE = `landscape · ${MIN_UPLOAD_IMAGE_WIDTH}×${Math.round(
  MIN_UPLOAD_IMAGE_WIDTH / COVER_ASPECT_RATIO,
)} or larger`;

/** Column widths mirrored from the Drizzle schema, enforced by Zod. */
export const MAX_SLUG_LENGTH = 200;
export const MAX_BUSINESS_NAME_LENGTH = 200;
export const MAX_NAME_LENGTH = 100;
/**
 * The longest `Priya M.` the database can produce — **not** `MAX_NAME_LENGTH`.
 *
 * The reviewer's display name is built by concatenation, so it is longer than
 * either column it comes from: a first name at its own 100-character limit,
 * plus a space, an initial and a full stop, is 103. Bounding the response at
 * 100 made a legal profile un-serialisable, and the whole Reviews tab 500ed for
 * every reader of that vendor — something a customer could do to a vendor by
 * saving one long first name.
 *
 * Derived rather than written down, so a change to the name column moves this
 * with it. The three is the space, the initial and the stop.
 */
export const MAX_REVIEWER_DISPLAY_NAME_LENGTH = MAX_NAME_LENGTH + 3;
export const MAX_EMAIL_LENGTH = 255;
export const MAX_PHONE_LENGTH = 20;
export const MAX_URL_LENGTH = 500;
export const MAX_ADDRESS_LENGTH = 500;
export const MAX_CAPTION_LENGTH = 500;
export const MAX_TITLE_LENGTH = 200;

/**
 * The widest value `integer` (int4) holds, and therefore the ceiling on every
 * `displayOrder` a request may carry.
 *
 * Zod's `z.int()` accepts up to 2^53, so a body of `2147483648` passed
 * validation, reached the insert and came back as an opaque 500 —
 * `value "2147483648" is out of range for type integer` is a Postgres error,
 * not an `AppError`. Every other bounded integer in the wire schema (guest
 * count, price, years in business, service radius, page) already states its
 * ceiling; this is the one that did not (#408).
 */
export const MAX_DISPLAY_ORDER = 2_147_483_647;

/**
 * `notifications.title`, which is **not** `MAX_TITLE_LENGTH`.
 *
 * A notification title is derived, not typed: three of them interpolate a
 * business name at its own 200-character limit — `"<name> sent a quote"` is the
 * longest at 214 — so a column sized for the input was always too narrow for
 * the output. The write happens *after* the state transition has committed, so
 * the overflow turned a legal quote or decline into a 500 on a request that had
 * already moved, with no notification and no email for the other party (#408).
 *
 * Derived from the business-name limit rather than written down, so widening
 * that column moves this with it. `56` is headroom for the longest fixed
 * wording either side of the name.
 */
export const MAX_NOTIFICATION_TITLE_LENGTH = MAX_BUSINESS_NAME_LENGTH + 56;

/**
 * `tags.slug`, which is wider than `MAX_SLUG_LENGTH` for the same reason.
 *
 * The slug is category-prefixed — `${category}-${generateSlug(name)}` — because
 * `tags_slug_key` is global while a name is only unique within its category.
 * The prefix is up to 8 characters plus a hyphen, on top of a name at its own
 * 100-character limit, so a legal 100-character suggestion produced a
 * 109-character slug that `varchar(100)` refused: the approve transaction
 * rolled back, the admin got an opaque INTERNAL_ERROR, and the suggestion
 * stayed in the queue with no way to resolve it (#408).
 */
export const MAX_TAG_SLUG_LENGTH = MAX_NAME_LENGTH + 28;

// --- Error codes -----------------------------------------------------------

/**
 * Machine-readable `error` field on every structured API error response.
 * The human-readable `message` is written at the throw site.
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  /**
   * The session is genuine and the account has not accepted the current Terms
   * of Service, so nothing it could ask for may be answered yet.
   *
   * Distinct from `FORBIDDEN` because the two are opposite instructions to the
   * frontend: a `FORBIDDEN` is terminal and sends the reader to `/suspended`,
   * while this one is a gate they clear themselves in one click. Answering it
   * as a plain 403 put every un-accepted account on the suspended screen.
   */
  TERMS_REQUIRED: 'TERMS_REQUIRED',
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
