import { z } from 'zod';
import { formatPrice, isBeyondBookingHorizon, isUniversallyPastDate } from '../utils/index.js';
import {
  AVAILABILITY_STATUSES,
  BOOKING_REQUEST_NOTES_MAX_LENGTH,
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
  REVIEW_RATING_MIN,
  RESPONSE_TIME_HOURS_OPTIONS,
  REVIEW_TYPES,
  TAG_CATEGORIES,
  TAG_SUGGESTION_STATUSES,
  USER_ROLES,
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
       * An absolute URL, but only over http(s): a `javascript:` or `data:`
       * value reaching an `img src` is the reason this is an allowlist. The
       * `.trim()` above is load-bearing — the scheme test is anchored, so
       * " javascript:alert(1)" would otherwise pass as a relative path.
       */
      if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
        return /^https?:\/\//i.test(value);
      }

      // Otherwise a site-relative path or a bare object key. Neither may
      // traverse, and neither may be protocol-relative.
      return !value.startsWith('//') && !value.split('/').includes('..');
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

/** A non-empty string once surrounding whitespace is removed. */
const trimmedString = (max: number, min = 1) => z.string().trim().min(min).max(max);

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
    bio: z.string().trim().min(1).max(MAX_CUSTOMER_BIO_LENGTH).nullable(),
    city: z.string().trim().min(1).max(MAX_NAME_LENGTH).nullable(),
    state: z.string().trim().min(1).max(MAX_NAME_LENGTH).nullable(),
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
  businessName: z.string().trim().min(2, 'Enter your business name').max(MAX_BUSINESS_NAME_LENGTH),
  /** Optional — the service generates one from the business name when omitted. */
  slug: slugSchema.optional(),
  categoryIds: z.array(uuidSchema).min(1, 'Select at least one category').max(5),
  city: z.string().trim().min(1, 'Enter the city you serve').max(MAX_NAME_LENGTH),
  state: z.string().trim().min(1, 'Choose the state you serve').max(MAX_NAME_LENGTH),
  bio: z
    .string()
    .trim()
    .max(MAX_VENDOR_BIO_LENGTH, `Keep your bio under ${MAX_VENDOR_BIO_LENGTH} characters`)
    .optional(),
  tagline: z
    .string()
    .trim()
    .max(MAX_TAGLINE_LENGTH, `Keep it to ${MAX_TAGLINE_LENGTH} characters — it is one line`)
    .optional(),
  yearsInBusiness: z
    .int()
    .min(MIN_YEARS_IN_BUSINESS, 'Years in business cannot be negative')
    .max(MAX_YEARS_IN_BUSINESS, `Enter ${MAX_YEARS_IN_BUSINESS} or fewer years`)
    .optional(),
  address: z.string().trim().max(MAX_ADDRESS_LENGTH).optional(),
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
  caption: z.string().trim().max(MAX_CAPTION_LENGTH).optional(),
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
  caption: z.string().trim().max(MAX_CAPTION_LENGTH).nullable(),
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
  note: z.string().trim().max(MAX_CAPTION_LENGTH).optional(),
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
    eventLocation: z.string().trim().max(MAX_ADDRESS_LENGTH).optional(),
    guestCount: z.int().min(1).max(MAX_GUEST_COUNT).optional(),
    customDetails: z.string().trim().max(BOOKING_REQUEST_NOTES_MAX_LENGTH).optional(),
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
  reason: z.string().trim().max(1_000).optional(),
});
export type BookingRequestReasonInput = z.infer<typeof bookingRequestReasonSchema>;

/** Whose requests a list call wants — the caller's role decides which is legal. */
export const bookingRequestListQuerySchema = z.object({
  status: bookingRequestStatusSchema.optional(),
});
export type BookingRequestListQuery = z.infer<typeof bookingRequestListQuerySchema>;

export const quoteBookingRequestSchema = z.object({
  quotedPriceCents: priceCentsSchema,
  quoteNote: z.string().trim().max(5_000).optional(),
});
export type QuoteBookingRequestInput = z.infer<typeof quoteBookingRequestSchema>;

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(1_000).optional(),
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
  /** Bookings on today's date, for the rail once the profile is published. */
  todaysBookings: z.array(
    z.object({
      id: uuidSchema,
      eventDate: calendarDateSchema,
      eventLocation: z.string().max(MAX_ADDRESS_LENGTH).nullable(),
      customerFirstName: trimmedString(MAX_NAME_LENGTH, 0),
    }),
  ),
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
  bookingId: uuidSchema,
  rating: z.int().min(REVIEW_RATING_MIN).max(REVIEW_RATING_MAX),
  title: z.string().trim().max(MAX_TITLE_LENGTH).optional(),
  content: trimmedString(REVIEW_CONTENT_MAX_LENGTH, REVIEW_CONTENT_MIN_LENGTH),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/**
 * A public customer-to-vendor review as the vendor profile's Reviews tab
 * renders it — the reviewer's first name and last initial only, never their
 * full identity, and the booking's occasion as the badge.
 */
export const vendorReviewSchema = z.object({
  id: uuidSchema,
  rating: z.int().min(REVIEW_RATING_MIN).max(REVIEW_RATING_MAX),
  title: z.string().max(MAX_TITLE_LENGTH).nullable(),
  content: z.string(),
  reviewerFirstName: trimmedString(MAX_NAME_LENGTH, 0),
  reviewerLastInitial: z.string().max(1),
  /*
   * Read back as a plain string rather than `eventTypeSchema`, for the same
   * reason `bookingRequestSchema` does: a row written before the vocabulary
   * closed must still be readable.
   */
  eventType: z.string().max(MAX_BUSINESS_NAME_LENGTH).nullable(),
  createdAt: z.date(),
});
export type VendorReview = z.infer<typeof vendorReviewSchema>;

/** One bar of the Reviews tab's five-bar distribution chart. */
export const reviewRatingDistributionSchema = z.object({
  1: z.int().min(0),
  2: z.int().min(0),
  3: z.int().min(0),
  4: z.int().min(0),
  5: z.int().min(0),
});
export type ReviewRatingDistribution = z.infer<typeof reviewRatingDistributionSchema>;

/**
 * `GET /vendors/:slug/reviews`. `limit`, not `pageSize` — this is the one
 * paginated endpoint the product exposes as "show more" rather than page
 * numbers, and the query name matches the ticket's own wire contract.
 */
export const vendorReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type VendorReviewsQuery = z.infer<typeof vendorReviewsQuerySchema>;

export const vendorReviewsPageSchema = z.object({
  items: z.array(vendorReviewSchema),
  total: z.int().min(0),
  page: z.int().min(1),
  limit: z.int().min(1),
  distribution: reviewRatingDistributionSchema,
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
