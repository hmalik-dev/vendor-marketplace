import { z } from 'zod';
import {
  formatPrice,
  isBeyondBookingHorizon,
  isUniversallyPastDate,
  stripBidiControls,
} from '../utils/index.js';
import {
  ADMIN_PAGE_SIZE,
  AVAILABILITY_STATUSES,
  BOOKING_REQUEST_NOTES_MAX_LENGTH,
  BOOKING_WEEK_DAYS,
  BOOKING_REQUEST_STATUSES,
  BOOKING_STATUSES,
  BUDGET_TIERS,
  DEFAULT_PAGE_SIZE,
  ERROR_CODES,
  EVENT_TYPES,
  MAX_ADDRESS_LENGTH,
  MAX_ADMIN_NOTE_LENGTH,
  MAX_BUSINESS_NAME_LENGTH,
  MAX_CAPTION_LENGTH,
  MAX_CUSTOMER_BIO_LENGTH,
  MAX_NEARBY_DATE_WINDOW_DAYS,
  MAX_TAGLINE_LENGTH,
  MAX_VENDOR_BIO_LENGTH,
  MAX_YEARS_IN_BUSINESS,
  MIN_YEARS_IN_BUSINESS,
  NEARBY_ALTERNATIVES_LIMIT,
  NEARBY_DATE_WINDOW_DAYS,
  MAX_EVENT_DATE_MONTHS_AHEAD,
  MAX_EMAIL_LENGTH,
  MAX_GUEST_COUNT,
  MAX_NAME_LENGTH,
  MAX_REVIEWER_DISPLAY_NAME_LENGTH,
  MAX_PACKAGE_PRICE_CENTS,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  MAX_PHONE_LENGTH,
  MAX_SLUG_LENGTH,
  MAX_TAGS_PER_CATEGORY,
  MAX_TITLE_LENGTH,
  MAX_URL_LENGTH,
  MESSAGE_MAX_LENGTH,
  MIN_BOOKING_AMOUNT_CENTS,
  NOTIFICATION_TYPES,
  PRICE_TYPES,
  REVIEW_CONTENT_MAX_LENGTH,
  REVIEW_CONTENT_MIN_LENGTH,
  REVIEW_RATING_MAX,
  REVIEW_RATINGS,
  REVIEW_RATING_MIN,
  RESPONSE_TIME_HOURS_OPTIONS,
  REVIEW_TYPES,
  TAG_CATEGORIES,
  TAG_SUGGESTION_STATUSES,
  USER_ROLES,
  US_STATE_CODES,
  VENDOR_SETTABLE_AVAILABILITY_STATUSES,
  VENDOR_SORT_OPTIONS,
  PUBLISH_BLOCKER_KEYS,
} from '../constants/index.js';

// --- Primitives ------------------------------------------------------------

export const uuidSchema = z.uuid();

/** `YYYY-MM-DD`, matching the Postgres `DATE` columns used for event dates. */
export const calendarDateSchema = z.iso.date();

/** Lowercase, hyphen-separated, no leading/trailing/repeated hyphens. */
export const slugSchema = z
  .string()
  .max(MAX_SLUG_LENGTH)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be lowercase letters, numbers, and single hyphens');

export const emailSchema = z.email().max(MAX_EMAIL_LENGTH);

export const urlSchema = z.url().max(MAX_URL_LENGTH);

/*
 * C0 controls and DEL, the C1 range, and the bidirectional formatting
 * characters. Deliberately not the `g` flag: a global regex carries
 * `lastIndex` between calls, so every other `.test()` would answer false.
 */
const FORBIDDEN_IN_IMAGE_REF =
  // eslint-disable-next-line no-control-regex -- the control characters are the point (#414)
  /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;

/**
 * A stored reference to an image, in any of the three shapes the product
 * actually persists.
 *
 * Since #47 an upload stores an **object key** — `portfolio/abc.webp` — so the
 * CDN can move without a migration. Seeded marketing art is a **site-relative
 * path**, served by the web app itself. An avatar from Clerk is an **absolute
 * URL** on a host that is not ours. `resolveImageUrl` already resolves all
 * three at the render boundary; this is the same contract, stated on the way
 * in.
 *
 * A bare `z.url()` here rejected the first two, which is why adding a portfolio
 * photo failed for every real upload: the client sent the key #47 told it to
 * store, and the schema demanded a URL.
 */
export const imageRefSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_URL_LENGTH)
  .refine(
    (value) => {
      /*
       * Control and bidi characters are refused outright rather than stripped,
       * because their only effect here is to disguise the value from the tests
       * below (#414). A tab or newline inside a scheme — `jav\tascript:` —
       * makes the anchored test fail, so the value fell through to the
       * relative-path branch that never checks a scheme, while a browser
       * removes those characters *before* it parses the scheme and so reads a
       * live `javascript:`. No object key, site path or URL needs one.
       */
      if (FORBIDDEN_IN_IMAGE_REF.test(value)) {
        return false;
      }

      /*
       * An absolute URL, but only over http(s): a `javascript:` or `data:`
       * value reaching an `img src` is the reason this is an allowlist. The
       * `.trim()` above is load-bearing — the scheme test is anchored, so
       * " javascript:alert(1)" would otherwise pass as a relative path.
       */
      if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
        if (!/^https?:\/\//i.test(value)) {
          return false;
        }

        /*
         * The host may be one that is not ours — a Clerk avatar is exactly
         * that — but it may not be *disguised* as one. `https://cdn.ours@evil`
         * reads as our CDN and is fetched from `evil`, which is the same
         * stepping-around this ticket is about. Nothing legitimate puts
         * credentials in an image URL.
         */
        try {
          const parsed = new URL(value);

          return parsed.username === '' && parsed.password === '';
        } catch {
          return false;
        }
      }

      /*
       * Otherwise a site-relative path or a bare object key. Neither may
       * traverse, and neither may be protocol-relative — decided on the value
       * a URL parser sees rather than the one stored, because it normalises
       * `\` to `/` first. Without that, `/\evil.com/x.png` passes as a site
       * path and is then fetched as `//evil.com/x.png`, which is a vendor
       * pointing their public storefront photo at a host they control.
       *
       * `%2e` is folded back to `.` for the same reason: the parser decodes it
       * before it resolves the path, so `a/%2e%2e/b.webp` traverses exactly as
       * `a/../b.webp` does and a guard that reads the stored spelling misses
       * it.
       */
      const path = value.replace(/\\/g, '/').replace(/%2e/gi, '.');

      return !path.startsWith('//') && !path.split('/').includes('..');
    },
    { message: 'Must be an image URL, a site path, or a stored key' },
  );

/** E.164-ish; permissive because Clerk owns phone verification. */
export const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(MAX_PHONE_LENGTH)
  .regex(/^\+?[0-9 ()\-.]+$/, 'Must be a valid phone number');

/**
 * Free text, as every write path accepts it: bidi stripped, then trimmed, and
 * nothing else decided. Bounds and messages belong to the call site.
 *
 * The strip is here, at the one boundary every free-text field crosses, rather
 * than at each rendering site: a venue name carrying an override reorders the
 * sentence around it on screen while the stored value says something else
 * (#398). It runs **before** trimming, so a control cannot hide the whitespace
 * behind it, and before the length checks, so a string padded out with
 * invisible characters cannot buy itself room against a maximum.
 *
 * `overwrite` rather than `transform` so the result is still a `ZodString` and
 * the twenty-odd call sites can keep chaining `.min()`, `.max()`, `.nullable()`
 * and `.optional()` — which is the whole reason this is split out from
 * `trimmedString`. Half the free-text fields in this file carry their own error
 * message or allow an empty value, so they could not use that helper; every one
 * of them had been written out as `z.string().trim()…` by hand and had silently
 * lost the strip.
 *
 * `apps/api/src/request-body-free-text.test.ts` parses a bidi control through
 * every string field of every schema a route attaches as a request body, so a
 * field that goes back to a bare `z.string()` fails on the day it is written.
 * Write paths that are **not** request bodies — names mirrored from Clerk —
 * cannot be seen from there and go through `mirroredClerkName` instead.
 */
const freeText = () => z.string().overwrite(stripBidiControls).trim();

/** Free text with the common bounds: non-empty by default, capped at `max`. */
const trimmedString = (max: number, min = 1) => freeText().min(min).max(max);

/**
 * Integer cents within the platform's $25–$100,000 price band.
 *
 * The band is stored in cents and spoken in dollars. These messages are shown
 * to a vendor verbatim, beside a helper line that already reads "Between $25
 * and $100,000" — quoting the bound in cents contradicts the field's own
 * copy. Money crosses the display boundary through `formatPrice`, here as
 * everywhere else.
 */
export const priceCentsSchema = z
  .int(
    // Reached when the field holds something non-numeric: the form converts
    // dollars to cents and hands `NaN` on. Zod's default here is "Invalid
    // input", which `40-states.md` forbids — every message says how to fix it.
    `Enter a price between ${formatPrice(MIN_BOOKING_AMOUNT_CENTS)} and ${formatPrice(MAX_PACKAGE_PRICE_CENTS)}`,
  )
  .min(MIN_BOOKING_AMOUNT_CENTS, `Price must be at least ${formatPrice(MIN_BOOKING_AMOUNT_CENTS)}`)
  .max(MAX_PACKAGE_PRICE_CENTS, `Price must be at most ${formatPrice(MAX_PACKAGE_PRICE_CENTS)}`);

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

// --- Enums -----------------------------------------------------------------

export const userRoleSchema = z.enum(USER_ROLES);
export const priceTypeSchema = z.enum(PRICE_TYPES);
export const availabilityStatusSchema = z.enum(AVAILABILITY_STATUSES);
export const vendorSettableAvailabilityStatusSchema = z.enum(VENDOR_SETTABLE_AVAILABILITY_STATUSES);
export const bookingRequestStatusSchema = z.enum(BOOKING_REQUEST_STATUSES);
export const eventTypeSchema = z.enum(EVENT_TYPES);
export const bookingStatusSchema = z.enum(BOOKING_STATUSES);
export const reviewTypeSchema = z.enum(REVIEW_TYPES);
export const budgetTierSchema = z.enum(BUDGET_TIERS);
export const tagCategorySchema = z.enum(TAG_CATEGORIES);
export const tagSuggestionStatusSchema = z.enum(TAG_SUGGESTION_STATUSES);
/**
 * Two-letter USPS code. The message names the fix rather than the rule,
 * because a vendor picking from a list can only reach this by sending a value
 * the list does not offer.
 */
export const usStateCodeSchema = z.enum(US_STATE_CODES, {
  message: 'Choose the state you serve',
});
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export const vendorSortOptionSchema = z.enum(VENDOR_SORT_OPTIONS);

// --- Users -----------------------------------------------------------------

export const userSchema = z.object({
  id: uuidSchema,
  clerkUserId: z.string().min(1).max(255),
  email: emailSchema,
  role: userRoleSchema,
  /*
   * Empty until the user provides one. Clerk's email-and-password sign-up does
   * not collect a name, so a freshly synced row genuinely has none — the read
   * model has to be able to represent that. `updateUserSchema` still requires a
   * non-empty name, so a name that has been set cannot be blanked out again.
   */
  firstName: trimmedString(MAX_NAME_LENGTH, 0),
  lastName: trimmedString(MAX_NAME_LENGTH, 0),
  phone: phoneSchema.nullable(),
  /*
   * An image **reference**, not a URL. Since #47 an upload returns an object
   * key, and the resolver turns it into a URL on the way out — the same shape
   * `vendorProfile`'s images already use. This was missed by that migration,
   * which is why a customer's uploaded avatar could not be saved or read back.
   */
  avatarUrl: imageRefSchema.nullable(),
  stripeCustomerId: z.string().max(255).nullable(),
  bio: z.string().max(MAX_CUSTOMER_BIO_LENGTH).nullable(),
  city: z.string().max(MAX_NAME_LENGTH).nullable(),
  state: z.string().max(MAX_NAME_LENGTH).nullable(),
  budgetTier: budgetTierSchema.nullable(),
  typicalGuestCountMin: z.int().nullable(),
  typicalGuestCountMax: z.int().nullable(),
  /** Derived from vendor-to-customer reviews; never written by an endpoint. */
  avgCustomerRating: z.number().min(0).max(REVIEW_RATING_MAX),
  customerReviewCount: z.int().min(0),
  totalBookingsCount: z.int().min(0),
  completedBookingsCount: z.int().min(0),
  cancelledBookingsCount: z.int().min(0),
  isBanned: z.boolean(),
  bannedAt: z.date().nullable(),
  /** Set when Clerk reports the identity was deleted; the row is retired, not removed. */
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof userSchema>;

/** Public projection of another user — never exposes Stripe or ban fields. */
export const publicUserSchema = userSchema.pick({
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
});
export type PublicUser = z.infer<typeof publicUserSchema>;

/**
 * Self-service profile edits. Derived stats (`avgCustomerRating`, the booking
 * counters) and identity/ban fields are deliberately absent — they are only
 * ever written by their owning service.
 */
export const updateUserSchema = z
  .object({
    firstName: trimmedString(MAX_NAME_LENGTH),
    lastName: trimmedString(MAX_NAME_LENGTH),
    phone: phoneSchema.nullable(),
    /** The object key the uploader returns — see `userSchema.avatarUrl`. */
    avatarUrl: imageRefSchema.nullable(),
    /*
     * `null` clears the bio; a string has to survive trimming. Without the
     * minimum, "   " stored as an empty string and rendered as a bio that was
     * there but said nothing.
     */
    bio: trimmedString(MAX_CUSTOMER_BIO_LENGTH).nullable(),
    city: trimmedString(MAX_NAME_LENGTH).nullable(),
    state: trimmedString(MAX_NAME_LENGTH).nullable(),
    budgetTier: budgetTierSchema.nullable(),
    typicalGuestCountMin: z.int().min(1).max(MAX_GUEST_COUNT).nullable(),
    typicalGuestCountMax: z.int().min(1).max(MAX_GUEST_COUNT).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  })
  .refine(
    (value) =>
      value.typicalGuestCountMin === null ||
      value.typicalGuestCountMin === undefined ||
      value.typicalGuestCountMax === null ||
      value.typicalGuestCountMax === undefined ||
      value.typicalGuestCountMin <= value.typicalGuestCountMax,
    {
      message: 'Minimum guest count must not exceed maximum guest count',
      path: ['typicalGuestCountMin'],
    },
  );
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// --- Customer profiles -----------------------------------------------------

/**
 * How much of a customer a vendor may see, and when.
 *
 * A vendor deciding whether to accept a request needs enough to judge the
 * person — how long they have been here, whether they finish what they book,
 * what other vendors said. They do not need to be able to identify or contact
 * them, because they have not agreed to work together yet. Accepting is what
 * makes contact details relevant, so that is where they appear.
 */
export const CUSTOMER_PROFILE_VISIBILITIES = ['limited', 'full'] as const;
export type CustomerProfileVisibility = (typeof CUSTOMER_PROFILE_VISIBILITIES)[number];
export const customerProfileVisibilitySchema = z.enum(CUSTOMER_PROFILE_VISIBILITIES);

/** A vendor-to-customer review, as the customer profile renders it. */
export const customerReviewSchema = z.object({
  id: uuidSchema,
  rating: z.int().min(REVIEW_RATING_MIN).max(REVIEW_RATING_MAX),
  title: z.string().max(MAX_TITLE_LENGTH).nullable(),
  content: z.string(),
  /** Who wrote it — the business name, never the vendor's personal identity. */
  vendorBusinessName: z.string().max(MAX_BUSINESS_NAME_LENGTH),
  createdAt: z.date(),
});
export type CustomerReview = z.infer<typeof customerReviewSchema>;

/**
 * What every vendor with a booking relationship may see. Deliberately carries
 * no field that identifies or contacts the person.
 */
const limitedCustomerProfileShape = {
  id: uuidSchema,
  visibility: customerProfileVisibilitySchema,
  firstName: trimmedString(MAX_NAME_LENGTH, 0),
  memberSince: z.date(),
  bio: z.string().max(MAX_CUSTOMER_BIO_LENGTH).nullable(),
  city: z.string().max(MAX_NAME_LENGTH).nullable(),
  state: z.string().max(MAX_NAME_LENGTH).nullable(),
  budgetTier: budgetTierSchema.nullable(),
  typicalGuestCountMin: z.int().nullable(),
  typicalGuestCountMax: z.int().nullable(),
  /*
   * There is deliberately no `emailVerified` here. Clerk holds that signal and
   * the local row does not mirror it, so the badge #16 asks for could only be
   * rendered as always-true — which is decoration, not a signal. It returns
   * when the Clerk sync carries the field.
   */
  totalBookingsCount: z.int().min(0),
  completedBookingsCount: z.int().min(0),
  cancelledBookingsCount: z.int().min(0),
  avgCustomerRating: z.number().min(0).max(REVIEW_RATING_MAX),
  customerReviewCount: z.int().min(0),
  /**
   * `completed / (completed + cancelled)`, or `null` when that denominator is
   * zero — a customer who has finished nothing and cancelled nothing has no
   * rate, and showing 0% would read as a bad one rather than an absent one.
   */
  completionRate: z.number().min(0).max(1).nullable(),
  /** The most recent public vendor-to-customer reviews. */
  recentReviews: z.array(customerReviewSchema),
} as const;

export const limitedCustomerProfileSchema = z.object({
  ...limitedCustomerProfileShape,
  visibility: z.literal('limited'),
});

/** Everything above, plus the contact details accepting a booking earns. */
export const fullCustomerProfileSchema = z.object({
  ...limitedCustomerProfileShape,
  visibility: z.literal('full'),
  lastName: trimmedString(MAX_NAME_LENGTH, 0),
  email: emailSchema,
  phone: phoneSchema.nullable(),
  avatarUrl: imageRefSchema.nullable(),
});

export const customerProfileSchema = z.discriminatedUnion('visibility', [
  limitedCustomerProfileSchema,
  fullCustomerProfileSchema,
]);
export type CustomerProfile = z.infer<typeof customerProfileSchema>;
export type LimitedCustomerProfile = z.infer<typeof limitedCustomerProfileSchema>;
export type FullCustomerProfile = z.infer<typeof fullCustomerProfileSchema>;

/**
 * `completed / (completed + cancelled)`, or `null` when nothing has settled
 * either way. One implementation so the API and the UI cannot disagree about
 * what the rate means.
 */
export function completionRate(completed: number, cancelled: number): number | null {
  const settled = completed + cancelled;

  return settled === 0 ? null : completed / settled;
}

// --- Categories ------------------------------------------------------------

export const categorySchema = z.object({
  id: uuidSchema,
  name: trimmedString(MAX_NAME_LENGTH),
  slug: slugSchema,
  description: z.string().nullable(),
  icon: z.string().max(50).nullable(),
  displayOrder: z.int(),
  isActive: z.boolean(),
});
export type Category = z.infer<typeof categorySchema>;

// --- Vendor profiles -------------------------------------------------------

export const vendorProfileSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  businessName: trimmedString(MAX_BUSINESS_NAME_LENGTH),
  slug: slugSchema,
  bio: z.string().nullable(),
  tagline: z.string().max(MAX_TAGLINE_LENGTH).nullable(),
  yearsInBusiness: z.int().nullable(),
  profileImageUrl: imageRefSchema.nullable(),
  coverImageUrl: imageRefSchema.nullable(),
  address: z.string().max(MAX_ADDRESS_LENGTH).nullable(),
  city: z.string().max(MAX_NAME_LENGTH).nullable(),
  state: z.string().max(MAX_NAME_LENGTH).nullable(),
  latitude: latitudeSchema.nullable(),
  longitude: longitudeSchema.nullable(),
  serviceRadiusKm: z.int().nullable(),
  responseTimeHours: z.int().nullable(),
  stripeAccountId: z.string().max(255).nullable(),
  stripeOnboarded: z.boolean(),
  isPublished: z.boolean(),
  isDeleted: z.boolean(),
  avgRating: z.number().min(0).max(REVIEW_RATING_MAX),
  reviewCount: z.int().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type VendorProfile = z.infer<typeof vendorProfileSchema>;

export const createVendorProfileSchema = z.object({
  /*
   * The required fields carry their own messages: they are the ones a vendor
   * can actually leave blank, and Zod's default "Invalid input" gives no clue
   * which field the form is complaining about.
   */
  businessName: freeText().min(2, 'Enter your business name').max(MAX_BUSINESS_NAME_LENGTH),
  /** Optional — the service generates one from the business name when omitted. */
  slug: slugSchema.optional(),
  categoryIds: z.array(uuidSchema).min(1, 'Select at least one category').max(5),
  city: freeText().min(1, 'Enter the city you serve').max(MAX_NAME_LENGTH),
  state: usStateCodeSchema,
  bio: freeText()
    .max(MAX_VENDOR_BIO_LENGTH, `Keep your bio under ${MAX_VENDOR_BIO_LENGTH} characters`)
    .optional(),
  tagline: freeText()
    .max(MAX_TAGLINE_LENGTH, `Keep it to ${MAX_TAGLINE_LENGTH} characters — it is one line`)
    .optional(),
  yearsInBusiness: z
    .int()
    .min(MIN_YEARS_IN_BUSINESS, 'Years in business cannot be negative')
    .max(MAX_YEARS_IN_BUSINESS, `Enter ${MAX_YEARS_IN_BUSINESS} or fewer years`)
    .optional(),
  address: freeText().max(MAX_ADDRESS_LENGTH).optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  serviceRadiusKm: z.int().min(1).max(500).optional(),
  responseTimeHours: z
    .int()
    .refine((hours) => (RESPONSE_TIME_HOURS_OPTIONS as readonly number[]).includes(hours), {
      message: 'Choose one of the offered response windows',
    })
    .optional(),
  profileImageUrl: imageRefSchema.optional(),
  coverImageUrl: imageRefSchema.optional(),
});
export type CreateVendorProfileInput = z.infer<typeof createVendorProfileSchema>;

/**
 * Every create field is optional on update, plus the publish toggle. Derived
 * fields (`avgRating`, `reviewCount`) and Stripe fields are deliberately absent
 * — they are only ever written by their owning service.
 */
export const updateVendorProfileSchema = createVendorProfileSchema
  .partial()
  .extend({ isPublished: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });
export type UpdateVendorProfileInput = z.infer<typeof updateVendorProfileSchema>;

// --- Uploads ---------------------------------------------------------------

/** What `POST /upload/image` returns once the processed variants are stored. */
/**
 * What an upload returns: the **object keys**, not URLs.
 *
 * The key is what gets stored, so that a CDN move is a config change rather
 * than a migration. `resolveImageUrl` turns one into a URL at the render
 * boundary, which is the only place that resolution happens.
 */
export const uploadedImageSchema = z.object({
  imageKey: z.string().min(1).max(MAX_URL_LENGTH),
  thumbnailKey: z.string().min(1).max(MAX_URL_LENGTH),
  /** Resolved for immediate preview only — never persisted. */
  imageUrl: urlSchema,
  thumbnailUrl: urlSchema,
});
export type UploadedImage = z.infer<typeof uploadedImageSchema>;

// --- Service packages ------------------------------------------------------

export const servicePackageSchema = z.object({
  id: uuidSchema,
  vendorId: uuidSchema,
  name: trimmedString(MAX_BUSINESS_NAME_LENGTH),
  description: z.string(),
  priceCents: priceCentsSchema,
  priceType: priceTypeSchema,
  durationHours: z.number().nullable(),
  maxGuests: z.int().nullable(),
  inclusions: z.array(z.string()),
  isActive: z.boolean(),
  displayOrder: z.int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ServicePackage = z.infer<typeof servicePackageSchema>;

const inclusionsSchema = z.array(trimmedString(200)).max(20);

/**
 * The editable shape of a package, with no defaults attached.
 *
 * The defaults belong to *creation* only. `.partial()` does not strip them, so
 * a schema built by making a defaulted shape optional still substitutes the
 * default for every key the caller left out — which would turn "rename this
 * package" into "rename it and throw away its inclusions".
 */
const servicePackageFieldsSchema = z.object({
  name: trimmedString(MAX_BUSINESS_NAME_LENGTH, 2),
  description: trimmedString(5_000, 10),
  priceCents: priceCentsSchema,
  priceType: priceTypeSchema,
  durationHours: z.number().min(0.5).max(999.9).optional(),
  maxGuests: z.int().min(1).max(MAX_GUEST_COUNT).optional(),
  inclusions: inclusionsSchema,
  displayOrder: z.int().min(0).optional(),
});

export const createServicePackageSchema = servicePackageFieldsSchema.extend({
  priceType: priceTypeSchema.default('fixed'),
  inclusions: inclusionsSchema.default([]),
});
export type CreateServicePackageInput = z.infer<typeof createServicePackageSchema>;

export const updateServicePackageSchema = servicePackageFieldsSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });
export type UpdateServicePackageInput = z.infer<typeof updateServicePackageSchema>;

/** Full ordered list of the vendor's package ids, applied as one reorder. */
export const reorderServicePackagesSchema = z.object({
  packageIds: z.array(uuidSchema).min(1),
});
export type ReorderServicePackagesInput = z.infer<typeof reorderServicePackagesSchema>;

// --- Portfolio -------------------------------------------------------------

export const portfolioItemSchema = z.object({
  id: uuidSchema,
  vendorId: uuidSchema,
  imageUrl: imageRefSchema,
  thumbnailUrl: imageRefSchema.nullable(),
  caption: z.string().max(MAX_CAPTION_LENGTH).nullable(),
  displayOrder: z.int(),
  createdAt: z.date(),
});
export type PortfolioItem = z.infer<typeof portfolioItemSchema>;

export const createPortfolioItemSchema = z.object({
  imageUrl: imageRefSchema,
  // Nullish, not optional: an upload with no thumbnail sends an explicit null.
  thumbnailUrl: imageRefSchema.nullish(),
  caption: freeText().max(MAX_CAPTION_LENGTH).optional(),
  displayOrder: z.int().min(0).optional(),
});
export type CreatePortfolioItemInput = z.infer<typeof createPortfolioItemSchema>;

/** Full ordered list of portfolio item ids, applied as one reorder operation. */
export const reorderPortfolioSchema = z.object({
  itemIds: z.array(uuidSchema).min(1),
});
export type ReorderPortfolioInput = z.infer<typeof reorderPortfolioSchema>;

/**
 * Caption edits only. The image itself is immutable — replacing a photo means
 * deleting the item and uploading a new one, so a stored object is never
 * orphaned behind a row that now points somewhere else.
 */
export const updatePortfolioItemSchema = z.object({
  caption: freeText().max(MAX_CAPTION_LENGTH).nullable(),
});
export type UpdatePortfolioItemInput = z.infer<typeof updatePortfolioItemSchema>;

// --- Availability ----------------------------------------------------------

export const availabilitySchema = z.object({
  id: uuidSchema,
  vendorId: uuidSchema,
  date: calendarDateSchema,
  status: availabilityStatusSchema,
  note: z.string().max(MAX_CAPTION_LENGTH).nullable(),
});
export type Availability = z.infer<typeof availabilitySchema>;

export const availabilityEntrySchema = z.object({
  date: calendarDateSchema,
  status: vendorSettableAvailabilityStatusSchema,
  note: freeText().max(MAX_CAPTION_LENGTH).optional(),
});
export type AvailabilityEntryInput = z.infer<typeof availabilityEntrySchema>;

export const availabilityBulkUpdateSchema = z.object({
  entries: z.array(availabilityEntrySchema).min(1).max(400),
});
export type AvailabilityBulkUpdateInput = z.infer<typeof availabilityBulkUpdateSchema>;

// --- Booking requests ------------------------------------------------------

/** `HH:MM` wall clock at the venue — no zone, because the venue's clock is the clock. */
export const clockTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a time as HH:MM');

export const bookingRequestSchema = z.object({
  id: uuidSchema,
  customerId: uuidSchema,
  vendorId: uuidSchema,
  packageId: uuidSchema.nullable(),
  eventDate: calendarDateSchema,
  eventStartTime: clockTimeSchema.nullable(),
  /*
   * Read back as a plain string rather than `eventTypeSchema`: rows written
   * before the vocabulary closed, and rows written after it later widens, must
   * still be readable. The closed set is enforced on the way in.
   */
  eventType: z.string().max(MAX_BUSINESS_NAME_LENGTH).nullable(),
  eventLocation: z.string().max(MAX_ADDRESS_LENGTH).nullable(),
  guestCount: z.int().nullable(),
  customDetails: z.string().nullable(),
  status: bookingRequestStatusSchema,
  quotedPriceCents: z.int().nullable(),
  quoteNote: z.string().nullable(),
  finalPriceCents: z.int().nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type BookingRequest = z.infer<typeof bookingRequestSchema>;

/**
 * What a request looks like to the two people in it. The vendor and package
 * facts are denormalised onto the read model because every surface that lists
 * requests (#22a, #22b) renders "Photography · Wedding" beside a business name
 * — and a per-row profile fetch to render a list is how a hub gets slow.
 */
export const bookingRequestDetailSchema = bookingRequestSchema.extend({
  vendor: z.object({
    id: uuidSchema,
    slug: slugSchema,
    businessName: z.string().max(MAX_BUSINESS_NAME_LENGTH),
    city: z.string().max(MAX_NAME_LENGTH).nullable(),
    state: z.string().max(MAX_NAME_LENGTH).nullable(),
    /** Read from `vendorProfile.profileImageUrl`, which is already a key. */
    avatarUrl: imageRefSchema.nullable(),
    /**
     * The vendor's primary category, by `categories.displayOrder` — the
     * "Photography" half of the "Photography · Wedding" line this schema's own
     * comment promises, which until #302 it did not actually carry. Null for a
     * vendor with no active category, which the bookings hub renders as the
     * occasion alone rather than as a stray separator.
     *
     * The **name**, not the id: every consumer draws it, and the one that
     * filters by it groups on the same string it shows, so a second lookup
     * would buy nothing.
     */
    categoryName: z.string().max(MAX_NAME_LENGTH).nullable(),
    avgRating: z.number().min(0).max(REVIEW_RATING_MAX),
    reviewCount: z.int().min(0),
  }),
  /**
   * Who sent it. Before acceptance the vendor sees a first name and a last
   * initial only — deciding whether to take the work does not require being
   * able to identify the person. `CONTACT_DISCLOSING_BOOKING_REQUEST_STATUSES`
   * owns where that line sits; past it the three contact fields carry a value
   * instead of `null`, because a vendor who has committed to the date needs a
   * way to reach the customer that does not depend on them opening the app.
   *
   * The fields are `nullable` rather than `optional` so the shape is the same
   * on both sides of the line and a caller cannot mistake "not disclosed yet"
   * for "the API forgot".
   */
  customer: z.object({
    firstName: trimmedString(MAX_NAME_LENGTH, 0),
    lastInitial: z.string().max(1),
    lastName: trimmedString(MAX_NAME_LENGTH, 0).nullable(),
    email: emailSchema.nullable(),
    phone: phoneSchema.nullable(),
  }),
  /** `null` for a custom request, and for a package the vendor later deleted. */
  package: z
    .object({
      id: uuidSchema,
      name: z.string().max(MAX_TITLE_LENGTH),
      priceCents: z.int(),
      priceType: priceTypeSchema,
      durationHours: z.number().nullable(),
      inclusions: z.array(z.string()),
    })
    .nullable(),
});
export type BookingRequestDetail = z.infer<typeof bookingRequestDetailSchema>;

/** A custom request has no package, so its description is the whole brief. */
const CUSTOM_REQUEST_MIN_LENGTH = 10;

export const createBookingRequestSchema = z
  .object({
    vendorId: uuidSchema,
    /** Present for a package request, absent for a custom request. */
    packageId: uuidSchema.optional(),
    /*
     * Bounded at both ends. The floor — a date past everywhere on Earth — was
     * already enforced by the service; the ceiling was not, so `9999-12-31` was
     * a bookable event date and nothing downstream expects one. Only the
     * **input** carries this: the read schemas above and below deliberately do
     * not, because a bound there would refuse rows that are already stored.
     */
    eventDate: calendarDateSchema.refine((value) => !isBeyondBookingHorizon(value), {
      message: `Event date must be within ${MAX_EVENT_DATE_MONTHS_AHEAD} months`,
    }),
    eventStartTime: clockTimeSchema.optional(),
    eventType: eventTypeSchema.optional(),
    eventLocation: freeText().max(MAX_ADDRESS_LENGTH).optional(),
    guestCount: z.int().min(1).max(MAX_GUEST_COUNT).optional(),
    customDetails: freeText().max(BOOKING_REQUEST_NOTES_MAX_LENGTH).optional(),
  })
  /*
   * Without a package there is nothing to quote from, so the description stops
   * being the optional "anything else" note of frame `04` and becomes the
   * required brief the rail asks for instead.
   */
  .refine(
    (value) =>
      value.packageId !== undefined ||
      (value.customDetails !== undefined &&
        value.customDetails.length >= CUSTOM_REQUEST_MIN_LENGTH),
    {
      message: 'Select a package, or describe what you need in a sentence or two',
      path: ['customDetails'],
    },
  );
export type CreateBookingRequestInput = z.infer<typeof createBookingRequestSchema>;

/** Why a vendor declined, or why a customer pulled the request. */
export const bookingRequestReasonSchema = z.object({
  reason: freeText().max(1_000).optional(),
});
export type BookingRequestReasonInput = z.infer<typeof bookingRequestReasonSchema>;

/** Whose requests a list call wants — the caller's role decides which is legal. */
export const bookingRequestListQuerySchema = z.object({
  status: bookingRequestStatusSchema.optional(),
});
export type BookingRequestListQuery = z.infer<typeof bookingRequestListQuerySchema>;

export const quoteBookingRequestSchema = z.object({
  quotedPriceCents: priceCentsSchema,
  quoteNote: freeText().max(5_000).optional(),
});
export type QuoteBookingRequestInput = z.infer<typeof quoteBookingRequestSchema>;

export const cancelBookingSchema = z.object({
  reason: freeText().max(1_000).optional(),
});
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

// --- Bookings --------------------------------------------------------------

export const bookingSchema = z.object({
  id: uuidSchema,
  requestId: uuidSchema,
  customerId: uuidSchema,
  vendorId: uuidSchema,
  eventDate: calendarDateSchema,
  eventLocation: z.string().max(MAX_ADDRESS_LENGTH).nullable(),
  totalAmountCents: z.int(),
  platformFeeCents: z.int(),
  vendorPayoutCents: z.int(),
  status: bookingStatusSchema,
  stripePaymentIntentId: z.string().max(255).nullable(),
  stripeTransferId: z.string().max(255).nullable(),
  paidAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  cancelledAt: z.date().nullable(),
  cancellationReason: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Booking = z.infer<typeof bookingSchema>;

/**
 * A booking as the hubs render it. `eventType` lives on the request rather than
 * the booking row, and the hub card's sub-line reads "$1,450 paid · Barr
 * Mansion" — so both travel with every booking the API returns.
 *
 * **Ruling (#394): `nullable()`, never `optional()`.** A null is a fact about
 * the booking — the request named no occasion or no venue. A missing key is a
 * fact about the server — a route serialised with `bookingSchema` and
 * stripped the context. Making the client tolerate the missing key would turn
 * that serialiser bug into a blank line on the confirmation screen; keeping
 * it strict is what turned it into the 500 that got it fixed. A route that
 * answers a screen reading `eventType` or `venue` therefore declares this
 * schema; `bookingSchema` alone is for actions whose client parses the
 * reply with the same two fields omitted (`cancelledBookingWireSchema`).
 */
export const bookingWithContextSchema = bookingSchema.extend({
  eventType: z.string().max(MAX_BUSINESS_NAME_LENGTH).nullable(),
  /** The venue, named as the hub names it. Mirrors `eventLocation`. */
  venue: z.string().max(MAX_ADDRESS_LENGTH).nullable(),
});
export type BookingWithContext = z.infer<typeof bookingWithContextSchema>;

// --- Checkout --------------------------------------------------------------

/**
 * What `POST /customer/booking-requests/:requestId/pay` answers.
 *
 * The client secret is the only thing that lets the browser confirm the charge,
 * and it is returned rather than stored: it is scoped to one intent, it is
 * useless without the publishable key, and holding a copy would mean keeping a
 * live payment credential in a row nobody reads.
 *
 * The amounts travel with it so the summary rail renders from the same numbers
 * the intent was created with. A rail that recomputes them client-side is a rail
 * that can disagree with the charge.
 */
export const checkoutIntentSchema = z.object({
  paymentIntentId: z.string().max(255),
  /** `null` only for an intent that is already terminal — see `status`. */
  clientSecret: z.string().nullable(),
  /** Stripe's own vocabulary; `succeeded` means this is already paid. */
  status: z.string().max(64),
  amountCents: z.int().min(MIN_BOOKING_AMOUNT_CENTS),
  /**
   * What is **added** to the quoted price at checkout, which is nothing.
   *
   * Named for what the customer pays rather than for the platform's cut,
   * because those are different numbers and only this one belongs on their
   * receipt: D1 has the platform absorb Stripe's processing fee out of its
   * commission, so the quoted price is the paid price. The rail states
   * "Service fee: None" from this figure rather than from a hard-coded word,
   * so a future decision to charge one cannot leave the copy lying.
   */
  customerFeeCents: z.int().min(0),
  eventDate: calendarDateSchema,
  eventLocation: z.string().max(MAX_ADDRESS_LENGTH).nullable(),
  guestCount: z.int().nullable(),
  vendor: z.object({
    slug: slugSchema,
    businessName: z.string().max(MAX_BUSINESS_NAME_LENGTH),
    avatarUrl: imageRefSchema.nullable(),
  }),
  /** The date the vendor accepted, for the "Maya accepted your request on…" line. */
  acceptedAt: z.date().nullable(),
});
export type CheckoutIntent = z.infer<typeof checkoutIntentSchema>;

/**
 * What a cancellation returns: the booking as it now stands, plus what was
 * actually refunded.
 *
 * The refund is reported rather than left to be inferred from the tier, because
 * the two can legitimately differ — a refund Stripe accepted for less than was
 * asked is still a successful cancellation, and the customer is owed the real
 * number rather than the one the policy predicted.
 */
export const cancelledBookingSchema = z.object({
  booking: bookingSchema,
  refundCents: z.int().min(0),
  isFullRefund: z.boolean(),
});
export type CancelledBooking = z.infer<typeof cancelledBookingSchema>;

// --- Vendor dashboard ------------------------------------------------------

/**
 * Whether a vendor can be paid yet. Two fields rather than one because the
 * surfaces need different things from it: the banner asks only "is this done",
 * while the payouts page distinguishes a vendor who has never started from one
 * who started and stopped, and only the account id can tell those apart.
 *
 * Picked from `vendorProfileSchema` rather than restated, because
 * `GET /vendor/profile` already returns both fields off the same row — two
 * hand-written copies of one contract is how they drift.
 *
 * There is deliberately no fee figure here. The platform charges vendors
 * nothing in MVP, and a rate rendered anywhere on this flow would be a claim
 * the product has not made.
 */
export const vendorPayoutStatusSchema = vendorProfileSchema.pick({
  /** `null` until the vendor has begun onboarding at least once. */
  stripeAccountId: true,
  /** True only when Stripe can both transfer to and pay out from the account. */
  stripeOnboarded: true,
});

export type VendorPayoutStatus = z.infer<typeof vendorPayoutStatusSchema>;

/** What `POST /vendor/stripe/connect` answers: where to send the vendor next. */
export const stripeOnboardingLinkSchema = z.object({
  url: urlSchema,
});

export type StripeOnboardingLink = z.infer<typeof stripeOnboardingLinkSchema>;

/**
 * The vendor's own numbers, on their own private surface.
 *
 * Every figure here is a query result over the vendor's own rows — none is a
 * platform statistic and none makes a ranking claim. There is deliberately no
 * reply-time median: it needs message history a new vendor does not have, so
 * on their own dashboard it could only be invented. See `98-post-mvp.md`.
 */
export const vendorDashboardSchema = z.object({
  /** Requests still awaiting this vendor's first answer. Drives the title. */
  newRequestCount: z.int().min(0),
  bookingsThisMonth: z.int().min(0),
  bookingsLastMonth: z.int().min(0),
  /**
   * Requests this vendor answered, over requests they were given a chance to
   * answer, in the last 30 days. `null` when there were none — an honest
   * absence rather than a 0% that reads as a bad record.
   */
  responseRate: z.number().min(0).max(1).nullable(),
  avgRating: z.number().min(0).max(REVIEW_RATING_MAX),
  reviewCount: z.int().min(0),
  /** The vendor's share, not the gross — what actually reaches them. */
  earningsThisMonthCents: z.int().min(0),
  isPublished: z.boolean(),
  /** The **real** publish gate, so the checklist cannot disagree with it. */
  publishBlockers: z.array(z.enum(PUBLISH_BLOCKER_KEYS)),
  /**
   * Whether Stripe can both pay this vendor and pay out to their bank. It rides
   * on the dashboard payload rather than a second request because it is the
   * same class of state as `publishBlockers` — what this vendor still cannot do
   * — and it is read off the same row the rest of this object comes from.
   */
  stripeOnboarded: z.boolean(),
  /**
   * The seven days from today, for the published rail's `This week` strip.
   *
   * Read off the **availability calendar**, which is the same row the booking
   * lifecycle writes `booked` and `pending` to and the vendor writes `blocked`
   * to — not a second derivation over `bookings`. A strip that disagreed with
   * the availability screen would be the `publishBlockers` mistake again.
   *
   * `completed` cannot appear: every date here is today or later, and the
   * calendar only derives it for a `booked` date already in the past.
   */
  bookingWeek: z
    .array(
      z.object({
        date: calendarDateSchema,
        status: availabilityStatusSchema,
      }),
    )
    .length(BOOKING_WEEK_DAYS),
  /**
   * The soonest event this vendor is owed money for, for the rail's second card.
   *
   * The **amount** is real — it is that booking's `vendor_payout_cents`, already
   * settled at payment. The **date is the event's**, not a payout date: there is
   * no payout schedule to read one from until #10, and frame `08`'s
   * `Next payout Jun 18` is exactly the invented number the money rules forbid.
   * `null` when nothing upcoming has been paid for.
   */
  nextPayout: z
    .object({
      bookingId: uuidSchema,
      eventDate: calendarDateSchema,
      customerFirstName: trimmedString(MAX_NAME_LENGTH, 0),
      vendorPayoutCents: z.int().min(0),
    })
    .nullable(),
});
export type VendorDashboard = z.infer<typeof vendorDashboardSchema>;

// --- Messaging -------------------------------------------------------------

export const conversationSchema = z.object({
  id: uuidSchema,
  customerId: uuidSchema,
  vendorId: uuidSchema,
  bookingRequestId: uuidSchema.nullable(),
  lastMessageAt: z.date().nullable(),
  createdAt: z.date(),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const messageSchema = z.object({
  id: uuidSchema,
  conversationId: uuidSchema,
  senderId: uuidSchema,
  content: z.string(),
  readAt: z.date().nullable(),
  createdAt: z.date(),
});
export type Message = z.infer<typeof messageSchema>;

export const sendMessageSchema = z.object({
  content: trimmedString(MESSAGE_MAX_LENGTH),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// --- Reviews ---------------------------------------------------------------

export const reviewSchema = z.object({
  id: uuidSchema,
  bookingId: uuidSchema,
  reviewerId: uuidSchema,
  vendorId: uuidSchema,
  type: reviewTypeSchema,
  rating: z.int().min(REVIEW_RATING_MIN).max(REVIEW_RATING_MAX),
  title: z.string().max(MAX_TITLE_LENGTH).nullable(),
  content: z.string(),
  /** Vendor-to-customer reviews are visible to other vendors when true. */
  isPublic: z.boolean(),
  createdAt: z.date(),
});
export type Review = z.infer<typeof reviewSchema>;

export const createReviewSchema = z.object({
  rating: z.int().min(REVIEW_RATING_MIN).max(REVIEW_RATING_MAX),
  title: freeText().max(MAX_TITLE_LENGTH).optional(),
  content: trimmedString(REVIEW_CONTENT_MAX_LENGTH, REVIEW_CONTENT_MIN_LENGTH),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/**
 * A customer-to-vendor review as the public profile renders it.
 *
 * Deliberately **not** `reviewSchema`. That one is the row; this is what a
 * stranger may read, and the difference is the point: no `reviewerId`, no
 * `bookingId`, no `type`. The reviewer is a first name and an initial —
 * `12-vendor-profile.md:135` — because a full name beside an event date and a
 * city identifies someone at a wedding.
 */
export const publicReviewSchema = z.object({
  id: uuidSchema,
  rating: z.int().min(REVIEW_RATING_MIN).max(REVIEW_RATING_MAX),
  title: z.string().max(MAX_TITLE_LENGTH).nullable(),
  content: z.string(),
  /**
   * "Priya M." — built server-side, so the full name never leaves the API.
   *
   * Bounded by what the concatenation can produce, not by the column it starts
   * from: `MAX_NAME_LENGTH` is three characters short of the longest legal
   * value, and a name at the column's own limit made this response
   * un-serialisable.
   */
  reviewerName: z.string().max(MAX_REVIEWER_DISPLAY_NAME_LENGTH),
  /**
   * The booking's own `event_type`, for the card's badge. Nullable because the
   * column is: a booking made without one gets no badge rather than a made-up
   * category.
   */
  eventType: z.string().max(MAX_TITLE_LENGTH).nullable(),
  createdAt: z.date(),
});
export type PublicReview = z.infer<typeof publicReviewSchema>;

/**
 * The numbers above the list: the big Serif average, and the five-bar chart.
 *
 * Counted from the `reviews` rows in the same request that reads the page, not
 * from `vendor_profiles.avg_rating`. The denormalised column is what search and
 * the card render from and it is written by the same transaction — but a
 * summary that disagrees with the list under it is the defect this avoids, and
 * the chart needs the per-rating counts regardless, so the average comes from
 * the same GROUP BY rather than from a second source.
 */
export const reviewSummarySchema = z.object({
  /** `null` when there are none — never a 0.0 that reads as a bad score. */
  avgRating: z.number().min(0).max(REVIEW_RATING_MAX).nullable(),
  reviewCount: z.int().min(0),
  /**
   * One count per rating, ascending from `REVIEW_RATING_MIN`. Always the full
   * length: a rating nobody gave is a zero-length bar, not a missing row.
   */
  distribution: z.array(z.int().min(0)).length(REVIEW_RATINGS.length),
});
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;

/**
 * What the signed-in viewer may do here, resolved server-side.
 *
 * On the response rather than behind its own endpoint because the tab needs it
 * on first paint, and because the answer is only ever "this viewer, this
 * vendor" — a second request would ask the same question with the same inputs.
 * Every field is `false`/`null` for a signed-out reader.
 */
export const reviewViewerSchema = z.object({
  /**
   * A completed booking with this vendor that this viewer has not reviewed.
   * `12-vendor-profile.md:138`: "Write a review" appears only for a user with a
   * completed booking with this vendor.
   */
  canReview: z.boolean(),
  /** Which booking the review would be filed against, when there is one. */
  bookingId: uuidSchema.nullable(),
});
export type ReviewViewer = z.infer<typeof reviewViewerSchema>;

/** One appended page of the Reviews tab, with everything above it. */
export const vendorReviewsPageSchema = z.object({
  items: z.array(publicReviewSchema),
  summary: reviewSummarySchema,
  viewer: reviewViewerSchema,
  page: z.int().min(1),
  pageSize: z.int().min(1),
  /** Whether another press of "Show more reviews" would return anything. */
  hasMore: z.boolean(),
});
export type VendorReviewsPage = z.infer<typeof vendorReviewsPageSchema>;

// --- Tags ------------------------------------------------------------------

export const tagSchema = z.object({
  id: uuidSchema,
  name: trimmedString(MAX_NAME_LENGTH),
  slug: slugSchema,
  category: tagCategorySchema,
  displayOrder: z.int(),
  isActive: z.boolean(),
  createdAt: z.date(),
});
export type Tag = z.infer<typeof tagSchema>;

export const tagSuggestionSchema = z.object({
  id: uuidSchema,
  /** The user who submitted the suggestion. */
  vendorId: uuidSchema,
  suggestedName: trimmedString(MAX_NAME_LENGTH),
  category: tagCategorySchema,
  status: tagSuggestionStatusSchema,
  /** Set when approved and linked to a new or existing tag. */
  resolvedTagId: uuidSchema.nullable(),
  adminNote: z.string().max(MAX_ADMIN_NOTE_LENGTH).nullable(),
  createdAt: z.date(),
  resolvedAt: z.date().nullable(),
});
export type TagSuggestion = z.infer<typeof tagSuggestionSchema>;

export const createTagSuggestionSchema = z.object({
  suggestedName: trimmedString(MAX_NAME_LENGTH, 2),
  category: tagCategorySchema,
});
export type CreateTagSuggestionInput = z.infer<typeof createTagSuggestionSchema>;

/**
 * The three outcomes of `POST /tags/suggest`. Server-side dedup is the
 * authoritative layer: `exists` hands back the tag the client should select
 * instead, `already_suggested` means someone got there first, and `submitted`
 * is the only case that creates a row for admin review.
 */
export const tagSuggestionResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('exists'), tag: tagSchema }),
  z.object({ status: z.literal('already_suggested') }),
  z.object({ status: z.literal('submitted'), suggestionId: uuidSchema }),
]);
export type TagSuggestionResponse = z.infer<typeof tagSuggestionResponseSchema>;

/**
 * A vendor's full tag selection, applied as one replace operation. The
 * per-category ceiling is enforced by the service, which resolves each id to
 * its category.
 */
export const setVendorTagsSchema = z.object({
  tagIds: z.array(uuidSchema).max(TAG_CATEGORIES.length * MAX_TAGS_PER_CATEGORY),
});
export type SetVendorTagsInput = z.infer<typeof setVendorTagsSchema>;

/**
 * What the vendor's own profile endpoints return: the row plus the two
 * many-to-many selections the edit form has to prefill, plus the outstanding
 * publish prerequisites the dashboard renders. Tags are returned whole rather
 * than as ids so the form can render pills without a second lookup against the
 * full tag list.
 */
export const vendorProfileDetailSchema = vendorProfileSchema.extend({
  categoryIds: z.array(uuidSchema),
  tags: z.array(tagSchema),
  /**
   * Human-readable prerequisites still standing between this profile and a
   * public listing. Empty means the publish toggle is safe to turn on.
   */
  publishBlockers: z.array(z.enum(PUBLISH_BLOCKER_KEYS)),
});
export type VendorProfileDetail = z.infer<typeof vendorProfileDetailSchema>;

/**
 * A conversation as the list renders it: who it is with, what was last said,
 * and the booking it is about.
 *
 * The booking line is what makes a list of names navigable — a vendor with
 * thirty threads is looking for "the June 14 wedding", not for a person.
 */
export const conversationSummarySchema = z.object({
  id: uuidSchema,
  /** The other party — a business name for the customer, a person for the vendor. */
  otherPartyName: z.string().max(MAX_BUSINESS_NAME_LENGTH),
  /*
   * A user avatar, so an object key — not a URL. A response schema is a second
   * write boundary: `serializerCompiler` re-validates on the way out, and a
   * refusal there is an opaque 500. Left as a URL, one customer uploading a
   * photo would 500 the conversations list of every vendor they had messaged.
   */
  otherPartyAvatarUrl: imageRefSchema.nullable(),
  /** `null` until somebody says something. */
  lastMessagePreview: z.string().nullable(),
  lastMessageAt: z.date().nullable(),
  unreadCount: z.int().min(0),
  /** "Jun 14 wedding", or `null` when no request is linked. */
  bookingContext: z.string().nullable(),
  /** The vendor's slug, so the thread can link back to the profile. */
  vendorSlug: slugSchema,
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

/**
 * Opening a thread from a vendor's profile, before any request exists.
 *
 * The slug rather than the id: it is what the customer's URL already carries,
 * and it keeps a profile id off a body the browser composes.
 */
export const openConversationSchema = z.object({
  vendorSlug: slugSchema,
});
export type OpenConversationInput = z.infer<typeof openConversationSchema>;

/** Just the thread's id — enough to navigate to it, which is all this is for. */
export const openedConversationSchema = z.object({
  id: uuidSchema,
});
export type OpenedConversation = z.infer<typeof openedConversationSchema>;

export const sendMessageResultSchema = z.object({
  id: uuidSchema,
  conversationId: uuidSchema,
  senderId: uuidSchema,
  content: z.string(),
  readAt: z.date().nullable(),
  createdAt: z.date(),
});
export type SendMessageResult = z.infer<typeof sendMessageResultSchema>;

/**
 * A notification as the panel renders it — the row's `data` payload resolved
 * into a link, so the client never has to know how to build one from an id.
 */
export const notificationItemSchema = z.object({
  id: uuidSchema,
  type: notificationTypeSchema,
  title: z.string().max(MAX_TITLE_LENGTH),
  body: z.string().nullable(),
  /** Where clicking it goes, derived from the payload — never a raw id. */
  href: z.string().max(MAX_URL_LENGTH).nullable(),
  readAt: z.date().nullable(),
  createdAt: z.date(),
});
export type NotificationItem = z.infer<typeof notificationItemSchema>;

// --- Notifications ---------------------------------------------------------

export const notificationSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  type: notificationTypeSchema,
  title: z.string().max(MAX_TITLE_LENGTH),
  body: z.string().nullable(),
  data: z.record(z.string(), z.unknown()).nullable(),
  readAt: z.date().nullable(),
  createdAt: z.date(),
});
export type Notification = z.infer<typeof notificationSchema>;

// --- Search & pagination ---------------------------------------------------

/**
 * The one definition of a page window, for every endpoint that takes one.
 *
 * `page` is bounded **above** as well as below. Without a ceiling,
 * `?page=2147483648` reached the DAO and overflowed `int4` in
 * `(page - 1) * pageSize`, answering a 500 where a 400 was owed — see
 * `MAX_PAGE`.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * The page window as a plain shape, for schemas that build their own object.
 *
 * Exported so `vendorSearchQuerySchema` can spread it instead of restating the
 * two fields — which is what it did, and how `page` came to be bounded in one
 * place and not the other.
 */
export const paginationQueryShape = paginationQuerySchema.shape;

export const vendorSearchQuerySchema = z
  .object({
    /**
     * Vendor-name search, for the referral case only: someone was handed a
     * business card. It matches the business name and nothing else — see
     * decision D6. The main path is `category` + `city` + `date`, three
     * enumerable values, so there is no free-text query over profile copy.
     */
    name: z
      .string()
      .trim()
      .max(MAX_BUSINESS_NAME_LENGTH)
      .optional()
      .transform((value) => (value === undefined || value === '' ? undefined : value)),
    /**
     * A category slug, never free text: the vendor-type picker resolves to one
     * of the seeded categories or stays empty, so a search can only ever ask a
     * question the platform can answer.
     */
    category: slugSchema.optional(),
    city: z.string().trim().max(MAX_NAME_LENGTH).optional(),
    state: z.string().trim().max(MAX_NAME_LENGTH).optional(),
    /**
     * Bounded above as well as below. Without the cap a pasted
     * `?minPriceCents=2147483648` passed validation, reached Postgres and
     * overflowed `int4` — a 500 for a URL anyone can share. No package may
     * cost more than the cap, so a query above it cannot match anything and
     * 400 is the honest answer.
     */
    minPriceCents: z.coerce.number().int().min(0).max(MAX_PACKAGE_PRICE_CENTS).optional(),
    maxPriceCents: z.coerce.number().int().min(0).max(MAX_PACKAGE_PRICE_CENTS).optional(),
    /**
     * Excludes vendors whose calendar is booked or blocked on this date.
     *
     * A date that is already past everywhere on Earth is refused rather than
     * searched: nobody can be booked for it, so the honest answer is 400 and
     * not an empty result set that looks like the market is bare. The web
     * layer strips one before it ever gets here, but the endpoint is public
     * and #7 books against this same field.
     */
    date: calendarDateSchema
      .refine((value) => !isUniversallyPastDate(value), {
        message: 'Event date has already passed',
      })
      .optional(),
    minRating: z.coerce.number().min(0).max(REVIEW_RATING_MAX).optional(),
    /**
     * Tag ids, AND-combined: a vendor must carry every one of them. A customer
     * who picks "Korean" and "halal" wants both, not either — OR would bury the
     * matches they actually asked for under everything that matched one.
     */
    tags: z
      .union([z.array(uuidSchema), uuidSchema.transform((one) => [one])])
      .optional()
      .transform((value) => (value === undefined || value.length === 0 ? undefined : value)),
    sort: vendorSortOptionSchema.default('relevance'),
    // Spread, not restated. These two were declared here as well as in
    // `paginationQuerySchema`, and the copies disagreed: only one of them ever
    // gained an upper bound on `page`.
    ...paginationQueryShape,
  })
  .refine(
    (value) =>
      value.minPriceCents === undefined ||
      value.maxPriceCents === undefined ||
      value.minPriceCents <= value.maxPriceCents,
    { message: 'Minimum price must not exceed maximum price', path: ['minPriceCents'] },
  );
export type VendorSearchQuery = z.infer<typeof vendorSearchQuerySchema>;

/**
 * A vendor as a search result: everything the card needs to be a complete
 * decision unit, and nothing else. The profile detail is a separate fetch, so
 * a page of twenty cards does not carry twenty bios.
 */
export const vendorCardSchema = z.object({
  id: uuidSchema,
  businessName: z.string(),
  slug: z.string(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  avgRating: z.number().min(0).max(REVIEW_RATING_MAX),
  reviewCount: z.int().min(0),
  /** Cheapest active package, or `null` when the vendor has none priced yet. */
  startingPriceCents: z.int().min(0).nullable(),
  categories: z.array(z.object({ id: uuidSchema, name: z.string(), slug: z.string() })),
  /** Only present when the query carried a date: the answer that was asked for. */
  availableOnDate: z.boolean().optional(),
});
export type VendorCard = z.infer<typeof vendorCardSchema>;

/**
 * "Free on a nearby date instead" — frame `18`'s closing band, and the same
 * answer #7 needs when a booking request lands on a date the vendor has taken.
 *
 * One shape serves both, deliberately. A date-window search returning every
 * free date is more than either consumer renders: the card shows one date, and
 * the request screen suggests two.
 */
export const nearbyAvailabilityQuerySchema = z.object({
  category: slugSchema.optional(),
  city: z.string().trim().max(MAX_NAME_LENGTH).optional(),
  state: z.string().trim().max(MAX_NAME_LENGTH).optional(),
  /** The date that came back empty. Required — this question needs an anchor. */
  date: calendarDateSchema,
  /** Days either side to consider. Never a magic number in the DAO. */
  windowDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_NEARBY_DATE_WINDOW_DAYS)
    .default(NEARBY_DATE_WINDOW_DAYS),
  limit: z.coerce.number().int().min(1).max(20).default(NEARBY_ALTERNATIVES_LIMIT),
});
export type NearbyAvailabilityQuery = z.infer<typeof nearbyAvailabilityQuerySchema>;

export const nearbyVendorSchema = vendorCardSchema.extend({
  /** The vendor's nearest free day to the wanted one, never the wanted one. */
  nearestAvailableDate: calendarDateSchema,
});
export type NearbyVendor = z.infer<typeof nearbyVendorSchema>;

export const nearbyAvailabilityResultSchema = z.object({
  /** Ordered by how close the free date is, then by the search's own order. */
  items: z.array(nearbyVendorSchema),
  /**
   * Every vendor with a free date in the window, not just the ones returned —
   * what "See all N in the region" counts. Read at request time so the link
   * never shows a number the page did not measure.
   */
  total: z.int().min(0),
  /** Echoed back so a caller can say what window the answer covers. */
  windowDays: z.int().min(1),
});
export type NearbyAvailabilityResult = z.infer<typeof nearbyAvailabilityResultSchema>;

/**
 * The public vendor profile — frame `03`, the page where the decision happens.
 *
 * Deliberately not `vendorProfileSchema`: that carries `userId`,
 * `stripeAccountId`, `stripeOnboarded`, `address`, `isDeleted` and the exact
 * coordinates, none of which is any of a visitor's business. A public shape
 * that starts from the private one and remembers to `omit` leaks the next
 * column somebody adds; this one starts empty and names what is public.
 *
 * `avgRating` and `reviewCount` are the derived columns, never recomputed here.
 */
export const publicVendorProfileSchema = z.object({
  id: uuidSchema,
  businessName: z.string(),
  slug: slugSchema,
  bio: z.string().nullable(),
  /** The vendor's own line, opening the About tab. Absent for most vendors. */
  tagline: z.string().nullable(),
  /** Self-declared, so it is the vendor's claim rather than a platform figure. */
  yearsInBusiness: z.int().nullable(),
  profileImageUrl: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  /** Stored in kilometres; the display boundary converts with `kmToMiles`. */
  serviceRadiusKm: z.int().nullable(),
  responseTimeHours: z.int().nullable(),
  avgRating: z.number().min(0).max(REVIEW_RATING_MAX),
  reviewCount: z.int().min(0),
  /** Completed bookings — the only "events" figure that is not self-declared. */
  completedEventCount: z.int().min(0),
  /** Cheapest active package, or `null` when nothing is priced yet. */
  startingPriceCents: z.int().min(0).nullable(),
  categories: z.array(z.object({ id: uuidSchema, name: z.string(), slug: z.string() })),
  tags: z.array(tagSchema),
  /** Active packages only, in display order. */
  packages: z.array(servicePackageSchema),
  portfolio: z.array(portfolioItemSchema),
});
export type PublicVendorProfile = z.infer<typeof publicVendorProfileSchema>;

/**
 * The `:slug` path parameter. Shaped rather than free: a slug that cannot exist
 * is rejected at the edge as a 400, so the handler never runs a lookup for a
 * string the column could not hold.
 */
export const vendorSlugParamsSchema = z.object({ slug: slugSchema });
export type VendorSlugParams = z.infer<typeof vendorSlugParamsSchema>;

/**
 * How many published vendors each category would return under the rest of the
 * current filters. A query result, not marketing — see design-plan/98-post-mvp.md.
 */
export const categoryFacetSchema = z.object({
  categoryId: uuidSchema,
  count: z.int().min(0),
});
export type CategoryFacet = z.infer<typeof categoryFacetSchema>;

/**
 * One place a customer can actually search, and how many vendors are in it.
 *
 * City and state travel **together**, always. "Springfield" names a place in
 * thirty-odd states and "Portland" names two people would fly between; a city
 * field that took either on its own could not tell a customer which one they
 * had asked for. The pair is also the unit the vendor profile stores and the
 * search filters on, so nothing has to be re-joined to use it.
 */
export const vendorCitySchema = z.object({
  city: z.string().max(MAX_NAME_LENGTH),
  state: z.string().max(MAX_NAME_LENGTH),
  /** Published vendors there — a query result, never a platform statistic. */
  vendorCount: z.int().min(1),
});
export type VendorCity = z.infer<typeof vendorCitySchema>;
export const vendorCityListSchema = z.array(vendorCitySchema);

export const vendorSearchResultSchema = z.object({
  items: z.array(vendorCardSchema),
  total: z.int().min(0),
  page: z.int().min(1),
  pageSize: z.int().min(1),
  facets: z.object({ categories: z.array(categoryFacetSchema) }),
});
export type VendorSearchResult = z.infer<typeof vendorSearchResultSchema>;

/** Envelope for every paginated list response. */
export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.int().min(0),
    page: z.int().min(1),
    pageSize: z.int().min(1),
  });

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// --- Event stream ----------------------------------------------------------

/**
 * What `POST /events/stream-ticket` answers with.
 *
 * `EventSource` cannot set an `Authorization` header, so something has to
 * travel in the stream's URL. This is that something: an opaque, single-use,
 * minutes-long ticket exchanged for the session over a normal authenticated
 * request — never the session JWT itself, which is what #215 found in the
 * API's own logs.
 *
 * The ticket alone: no expiry is published. The client connects immediately
 * and re-exchanges on every reconnect, so it has nothing to do with a
 * deadline, and a field no caller reads is a contract to keep for nothing.
 */
export const streamTicketSchema = z.object({
  ticket: z.string().min(1),
});
export type StreamTicket = z.infer<typeof streamTicketSchema>;

// --- Errors ----------------------------------------------------------------

export const apiErrorSchema = z.object({
  statusCode: z.int(),
  error: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/**
 * The `details` a validation failure carries when the refusal belongs to one
 * named field, keyed by the **payload** key rather than a control id — the API
 * knows what it rejected, not how a client lays it out.
 *
 * Without it a form can only match on prose to decide which control to mark,
 * which is how #222 shipped: a 400 the storefront editor could not attribute
 * became no feedback at all, and onboarding could not be completed in the UI.
 */
export const fieldErrorDetailsSchema = z.object({ field: z.string().min(1) });
export type FieldErrorDetails = z.infer<typeof fieldErrorDetailsSchema>;

// --- Admin (#15) -----------------------------------------------------------

/**
 * The four statuses frame `13 Admin` draws in the Status column, **derived from
 * state that already exists** rather than from a column invented for the table.
 *
 * There is no `flagged` or `paused` column on `vendor_profiles`, and adding one
 * would give an operator a second place to record something the product already
 * knows. The mapping, in order — the first match wins:
 *
 * | Status    | Condition                                                          |
 * | --------- | ------------------------------------------------------------------ |
 * | `flagged` | the account is banned — the one moderation state there is          |
 * | `live`    | the profile is published                                           |
 * | `paused`  | unpublished, but payouts are connected — set up and taken down     |
 * | `review`  | unpublished and never onboarded — a draft that has never been live |
 *
 * `review` is therefore the "awaiting review" the frame's saved filter counts.
 */
/**
 * The page window every console list uses.
 *
 * `paginationQueryShape` with `pageSize` re-defaulted to `ADMIN_PAGE_SIZE` — the
 * frame's fifteen rows. Spreading the shape and overriding one field keeps the
 * bounds (`MAX_PAGE`, `MAX_PAGE_SIZE`) in one place; restating them here is how
 * the two would come to disagree.
 */
export const adminPaginationShape = {
  ...paginationQueryShape,
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(ADMIN_PAGE_SIZE),
};

export const ADMIN_VENDOR_STATUSES = ['live', 'review', 'flagged', 'paused'] as const;
export const adminVendorStatusSchema = z.enum(ADMIN_VENDOR_STATUSES);
export type AdminVendorStatus = (typeof ADMIN_VENDOR_STATUSES)[number];

/** Whether a vendor has finished Stripe onboarding — the frame's `Payouts` filter. */
export const ADMIN_PAYOUT_FILTERS = ['connected', 'not-connected'] as const;
export const adminPayoutFilterSchema = z.enum(ADMIN_PAYOUT_FILTERS);
export type AdminPayoutFilter = (typeof ADMIN_PAYOUT_FILTERS)[number];

export const adminVendorRowSchema = z.object({
  /** The `vendor_profiles` row. */
  id: uuidSchema,
  /** The `users` row — what ban and unban act on. */
  userId: uuidSchema,
  businessName: z.string(),
  slug: z.string(),
  categoryName: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  /** Serialised as a string, like every other decimal on the wire. */
  avgRating: z.string(),
  reviewCount: z.int(),
  bookingsCount: z.int(),
  status: adminVendorStatusSchema,
  stripeOnboarded: z.boolean(),
  createdAt: z.date(),
});
export type AdminVendorRow = z.infer<typeof adminVendorRowSchema>;

export const adminVendorQuerySchema = z.object({
  ...adminPaginationShape,
  /** Matches business name, slug or the owner's email. */
  q: trimmedString(MAX_NAME_LENGTH).optional(),
  category: z.string().trim().max(MAX_NAME_LENGTH).optional(),
  city: z.string().trim().max(MAX_NAME_LENGTH).optional(),
  payouts: adminPayoutFilterSchema.optional(),
  status: adminVendorStatusSchema.optional(),
});
export type AdminVendorQuery = z.infer<typeof adminVendorQuerySchema>;

/**
 * The count line under the title — "412 total · 38 awaiting review".
 *
 * Both numbers are query results over the same filter the table ran, so the
 * sentence can never describe a different set from the rows beneath it.
 * `awaitingReview` is the only field any console list adds to the shared
 * envelope, which is why it is an `.extend` rather than a second envelope.
 */
export const adminVendorPageSchema = paginatedSchema(adminVendorRowSchema).extend({
  awaitingReview: z.int(),
});
export type AdminVendorPage = z.infer<typeof adminVendorPageSchema>;

export const adminCustomerRowSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  totalBookingsCount: z.int(),
  isBanned: z.boolean(),
  createdAt: z.date(),
});
export type AdminCustomerRow = z.infer<typeof adminCustomerRowSchema>;

export const adminCustomerQuerySchema = z.object({
  ...adminPaginationShape,
  q: trimmedString(MAX_NAME_LENGTH).optional(),
});

export const adminBookingRowSchema = z.object({
  id: uuidSchema,
  /*
   * The enum, not `z.string()`. The lifecycle is a closed vocabulary declared
   * once in `BOOKING_STATUSES`, and typing it loosely here forced a cast at the
   * one place that maps a status to a pill — which is where a status the map
   * does not cover would have to be caught.
   */
  status: bookingStatusSchema,
  eventDate: z.string(),
  /** Integer cents, like every other amount. */
  totalCents: z.int(),
  customerName: z.string(),
  vendorName: z.string(),
  vendorSlug: z.string(),
  createdAt: z.date(),
});
export type AdminBookingRow = z.infer<typeof adminBookingRowSchema>;

/**
 * A payment as the Payments view reads it.
 *
 * **There is no `payments` table** — the money lives on `bookings`
 * (`stripe_payment_intent_id`, `platform_fee_cents`, `vendor_payout_cents`,
 * `paid_at`), because a booking is created by the succeeded intent and the two
 * are one-to-one. This row is that projection, not a second source.
 */
export const adminPaymentRowSchema = z.object({
  bookingId: uuidSchema,
  status: bookingStatusSchema,
  totalAmountCents: z.int(),
  platformFeeCents: z.int(),
  vendorPayoutCents: z.int(),
  stripePaymentIntentId: z.string().nullable(),
  vendorName: z.string(),
  customerName: z.string(),
  paidAt: z.date().nullable(),
});
export type AdminPaymentRow = z.infer<typeof adminPaymentRowSchema>;

export const adminReviewRowSchema = z.object({
  id: uuidSchema,
  rating: z.int(),
  title: z.string().nullable(),
  content: z.string(),
  /** `customer_to_vendor` or `vendor_to_customer` — the column is `type`. */
  type: reviewTypeSchema,
  authorName: z.string(),
  vendorName: z.string(),
  vendorSlug: z.string(),
  createdAt: z.date(),
});
export type AdminReviewRow = z.infer<typeof adminReviewRowSchema>;

/** A pending suggestion with the name of the vendor who sent it. */
export const adminTagSuggestionRowSchema = tagSuggestionSchema.extend({
  vendorName: z.string(),
  /** Set once resolved, so the queue's history explains itself. */
  resolvedTagName: z.string().nullable(),
});
export type AdminTagSuggestionRow = z.infer<typeof adminTagSuggestionRowSchema>;

export const adminTagSuggestionQuerySchema = z.object({
  ...adminPaginationShape,
  status: tagSuggestionStatusSchema.optional(),
});

/**
 * What an admin does with one suggestion.
 *
 * `reject` requires a note — the queue is the only record of why an idea was
 * turned down, and "rejected, no reason given" is how the same suggestion comes
 * back next month. `merge` requires the tag it merges into; the API never
 * guesses which existing tag was meant.
 */
export const resolveTagSuggestionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    adminNote: freeText().max(MAX_ADMIN_NOTE_LENGTH).optional(),
  }),
  z.object({
    action: z.literal('reject'),
    adminNote: trimmedString(MAX_ADMIN_NOTE_LENGTH),
  }),
  z.object({
    action: z.literal('merge'),
    mergeTagId: uuidSchema,
    adminNote: freeText().max(MAX_ADMIN_NOTE_LENGTH).optional(),
  }),
]);
export type ResolveTagSuggestion = z.infer<typeof resolveTagSuggestionSchema>;

/** A tag as the management table shows it — with the count that makes deactivation legible. */
export const adminTagRowSchema = tagSchema.extend({ vendorCount: z.int() });
export type AdminTagRow = z.infer<typeof adminTagRowSchema>;

export const updateTagSchema = z
  .object({
    name: trimmedString(MAX_NAME_LENGTH, 2).optional(),
    isActive: z.boolean().optional(),
    displayOrder: z.int().min(0).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });
export type UpdateTag = z.infer<typeof updateTagSchema>;

/** One day of the 30-day series behind each chart. */
export const adminMetricPointSchema = z.object({
  /** `YYYY-MM-DD`, like every other date on the wire. */
  date: z.string(),
  value: z.int(),
});

/**
 * The Overview screen. Every number is a query result; nothing here is a
 * platform statistic rendered on a public page, so the no-invented-numbers law
 * is satisfied by construction — this surface is admin-only.
 */
export const adminMetricsSchema = z.object({
  totalRevenueCents: z.int(),
  bookingsCount: z.int(),
  activeVendorsCount: z.int(),
  usersCount: z.int(),
  pendingTagSuggestionsCount: z.int(),
  /*
   * The number beside `Reviews` in the sidebar. It is the review count and
   * nothing narrower: there is no flag column on `reviews`, and deriving a
   * "flagged" set from the rating would invent a moderation state the product
   * does not have — the same reason the four vendor statuses are derived from
   * columns that already record something.
   */
  reviewsCount: z.int(),
  /** Colour-coded in the UI by meaning: revenue gold, bookings clay, users steel, completion sage. */
  revenueByDay: z.array(adminMetricPointSchema),
  bookingsByDay: z.array(adminMetricPointSchema),
  signupsByDay: z.array(adminMetricPointSchema),
  completedByDay: z.array(adminMetricPointSchema),
});
export type AdminMetrics = z.infer<typeof adminMetricsSchema>;

/** What a ban actually did, so the confirmation can name it rather than guess. */
export const adminBanResultSchema = z.object({
  userId: uuidSchema,
  isBanned: z.boolean(),
  requestsDeclined: z.int(),
  bookingsCancelled: z.int(),
  refundsIssued: z.int(),
  /**
   * Bookings whose refund Stripe refused, and which are therefore **still
   * confirmed** on a suspended account.
   *
   * The ban used to log those and carry on, and the result had no field to say
   * so — so the operator's table showed the account suspended with no signal
   * that money had not moved and a booking still stood (#400). A ban with a
   * non-zero count here needs a human: the money is with Stripe, the customer
   * has not been told, and the vendor's date is still held.
   */
  refundsFailed: z.int(),
  profileUnpublished: z.boolean(),
});
export type AdminBanResult = z.infer<typeof adminBanResultSchema>;

/** The real cities and categories the Vendors filter bar offers — no invented options. */
export const adminVendorFacetsSchema = z.object({
  cities: z.array(z.string()),
  categories: z.array(z.object({ slug: z.string(), name: z.string() })),
});
export type AdminVendorFacets = z.infer<typeof adminVendorFacetsSchema>;

export type AdminCustomerQuery = z.infer<typeof adminCustomerQuerySchema>;
export const adminCustomerPageSchema = paginatedSchema(adminCustomerRowSchema);
export type AdminCustomerPage = z.infer<typeof adminCustomerPageSchema>;

export const adminBookingQuerySchema = z.object({
  ...adminPaginationShape,
  status: bookingStatusSchema.optional(),
});
export type AdminBookingQuery = z.infer<typeof adminBookingQuerySchema>;
export const adminBookingPageSchema = paginatedSchema(adminBookingRowSchema);
export type AdminBookingPage = z.infer<typeof adminBookingPageSchema>;

export const adminPaymentQuerySchema = z.object({ ...adminPaginationShape });
export type AdminPaymentQuery = z.infer<typeof adminPaymentQuerySchema>;
export const adminPaymentPageSchema = paginatedSchema(adminPaymentRowSchema);
export type AdminPaymentPage = z.infer<typeof adminPaymentPageSchema>;

export const adminReviewQuerySchema = z.object({
  ...adminPaginationShape,
  type: reviewTypeSchema.optional(),
});
export type AdminReviewQuery = z.infer<typeof adminReviewQuerySchema>;
export const adminReviewPageSchema = paginatedSchema(adminReviewRowSchema);
export type AdminReviewPage = z.infer<typeof adminReviewPageSchema>;

export type AdminTagSuggestionQuery = z.infer<typeof adminTagSuggestionQuerySchema>;
export const adminTagSuggestionPageSchema = paginatedSchema(adminTagSuggestionRowSchema);
export type AdminTagSuggestionPage = z.infer<typeof adminTagSuggestionPageSchema>;

/**
 * The tag management table. Not paginated: the whole point of the screen is to
 * see the vocabulary as one list, grouped by category, and the vocabulary is
 * bounded by what an operator has approved rather than by user-generated volume.
 */
export const adminTagListSchema = z.object({ items: z.array(adminTagRowSchema) });
export type AdminTagList = z.infer<typeof adminTagListSchema>;

/** What resolving a suggestion did, so the queue can say it rather than guess. */
export const adminTagSuggestionResultSchema = z.object({
  suggestion: adminTagSuggestionRowSchema,
  /** The tag the suggestion now points at — created by `approve`, chosen by `merge`. */
  tag: tagSchema.nullable(),
});
export type AdminTagSuggestionResult = z.infer<typeof adminTagSuggestionResultSchema>;
