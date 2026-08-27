import { z } from 'zod';
import {
  AVAILABILITY_STATUSES,
  BOOKING_REQUEST_STATUSES,
  BOOKING_STATUSES,
  BUDGET_TIERS,
  DEFAULT_PAGE_SIZE,
  ERROR_CODES,
  MAX_ADDRESS_LENGTH,
  MAX_ADMIN_NOTE_LENGTH,
  MAX_BUSINESS_NAME_LENGTH,
  MAX_CAPTION_LENGTH,
  MAX_CUSTOMER_BIO_LENGTH,
  MAX_VENDOR_BIO_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_GUEST_COUNT,
  MAX_NAME_LENGTH,
  MAX_PACKAGE_PRICE_CENTS,
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

/** E.164-ish; permissive because Clerk owns phone verification. */
export const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(MAX_PHONE_LENGTH)
  .regex(/^\+?[0-9 ()\-.]+$/, 'Must be a valid phone number');

/** A non-empty string once surrounding whitespace is removed. */
const trimmedString = (max: number, min = 1) => z.string().trim().min(min).max(max);

/** Integer cents within the platform's $25–$100,000 price band. */
export const priceCentsSchema = z
  .int()
  .min(MIN_BOOKING_AMOUNT_CENTS, `Price must be at least ${MIN_BOOKING_AMOUNT_CENTS} cents`)
  .max(MAX_PACKAGE_PRICE_CENTS, `Price must be at most ${MAX_PACKAGE_PRICE_CENTS} cents`);

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

// --- Enums -----------------------------------------------------------------

export const userRoleSchema = z.enum(USER_ROLES);
export const priceTypeSchema = z.enum(PRICE_TYPES);
export const availabilityStatusSchema = z.enum(AVAILABILITY_STATUSES);
export const vendorSettableAvailabilityStatusSchema = z.enum(VENDOR_SETTABLE_AVAILABILITY_STATUSES);
export const bookingRequestStatusSchema = z.enum(BOOKING_REQUEST_STATUSES);
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
  avatarUrl: urlSchema.nullable(),
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
    avatarUrl: urlSchema.nullable(),
    bio: z.string().trim().max(MAX_CUSTOMER_BIO_LENGTH).nullable(),
    city: z.string().trim().max(MAX_NAME_LENGTH).nullable(),
    state: z.string().trim().max(MAX_NAME_LENGTH).nullable(),
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
  profileImageUrl: urlSchema.nullable(),
  coverImageUrl: urlSchema.nullable(),
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
  profileImageUrl: urlSchema.optional(),
  coverImageUrl: urlSchema.optional(),
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
export const uploadedImageSchema = z.object({
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
  imageUrl: urlSchema,
  thumbnailUrl: urlSchema.nullable(),
  caption: z.string().max(MAX_CAPTION_LENGTH).nullable(),
  displayOrder: z.int(),
  createdAt: z.date(),
});
export type PortfolioItem = z.infer<typeof portfolioItemSchema>;

export const createPortfolioItemSchema = z.object({
  imageUrl: urlSchema,
  thumbnailUrl: urlSchema.optional(),
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

export const bookingRequestSchema = z.object({
  id: uuidSchema,
  customerId: uuidSchema,
  vendorId: uuidSchema,
  packageId: uuidSchema.nullable(),
  eventDate: calendarDateSchema,
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

export const createBookingRequestSchema = z
  .object({
    vendorId: uuidSchema,
    /** Present for a package request, absent for a custom request. */
    packageId: uuidSchema.optional(),
    eventDate: calendarDateSchema,
    eventType: z.string().trim().max(MAX_BUSINESS_NAME_LENGTH).optional(),
    eventLocation: z.string().trim().max(MAX_ADDRESS_LENGTH).optional(),
    guestCount: z.int().min(1).max(MAX_GUEST_COUNT).optional(),
    customDetails: z.string().trim().min(10).max(5_000).optional(),
  })
  .refine((value) => value.packageId !== undefined || value.customDetails !== undefined, {
    message: 'Select a package or describe your custom request',
    path: ['packageId'],
  });
export type CreateBookingRequestInput = z.infer<typeof createBookingRequestSchema>;

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
  title: z.string().trim().max(MAX_TITLE_LENGTH).optional(),
  content: trimmedString(REVIEW_CONTENT_MAX_LENGTH, REVIEW_CONTENT_MIN_LENGTH),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

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
  publishBlockers: z.array(z.string()),
});
export type VendorProfileDetail = z.infer<typeof vendorProfileDetailSchema>;

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

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const vendorSearchQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    category: slugSchema.optional(),
    city: z.string().trim().max(MAX_NAME_LENGTH).optional(),
    state: z.string().trim().max(MAX_NAME_LENGTH).optional(),
    minPriceCents: z.coerce.number().int().min(0).optional(),
    maxPriceCents: z.coerce.number().int().min(0).optional(),
    /** Excludes vendors whose calendar is booked or blocked on this date. */
    date: calendarDateSchema.optional(),
    minRating: z.coerce.number().min(0).max(REVIEW_RATING_MAX).optional(),
    sort: vendorSortOptionSchema.default('relevance'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .refine(
    (value) =>
      value.minPriceCents === undefined ||
      value.maxPriceCents === undefined ||
      value.minPriceCents <= value.maxPriceCents,
    { message: 'Minimum price must not exceed maximum price', path: ['minPriceCents'] },
  );
export type VendorSearchQuery = z.infer<typeof vendorSearchQuerySchema>;

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

// --- Errors ----------------------------------------------------------------

export const apiErrorSchema = z.object({
  statusCode: z.int(),
  error: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
