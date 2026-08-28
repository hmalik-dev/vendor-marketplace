import {
  availabilitySchema,
  bookingRequestDetailSchema,
  bookingWithContextSchema,
  categorySchema,
  conversationSummarySchema,
  customerProfileSchema,
  customerReviewSchema,
  notificationItemSchema,
  paginatedSchema,
  sendMessageResultSchema,
  vendorDashboardSchema,
  portfolioItemSchema,
  nearbyAvailabilityResultSchema,
  nearbyVendorSchema,
  publicVendorProfileSchema,
  servicePackageSchema,
  tagSchema,
  userSchema,
  vendorCardSchema,
  vendorProfileDetailSchema,
  vendorSearchResultSchema,
} from '@vendor-marketplace/shared';
import { resolveImageUrl } from '@vendor-marketplace/shared';
import { z } from 'zod';

/**
 * The one place a stored image value becomes a URL.
 *
 * The database holds an **object key**, so that moving the CDN is a config
 * change rather than a migration — and the resolution happens here, on the way
 * in, so no component has to remember to do it. A second resolution site would
 * be a second source of truth, which is the coupling this exists to remove.
 *
 * `NEXT_PUBLIC_S3_PUBLIC_URL` is read as a literal property access because
 * Next inlines these only when it can see one statically.
 */
const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;

const imageUrl = () =>
  z
    .string()
    .nullable()
    .transform((value) => resolveImageUrl(IMAGE_BASE_URL, value));

/** Non-nullable in the row, but still resolvable to nothing. */
const requiredImageUrl = () =>
  z.string().transform((value) => resolveImageUrl(IMAGE_BASE_URL, value));

/**
 * The domain schemas in `@vendor-marketplace/shared` model timestamps as `Date`, which
 * is what the database layer holds. JSON has no date type, so responses carry
 * ISO strings — these wire variants coerce them back at the client boundary
 * without forking the rest of the shape.
 */
export const wireUserSchema = userSchema.extend({
  avatarUrl: imageUrl(),
  bannedAt: z.coerce.date().nullable(),
  deletedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type WireUser = z.infer<typeof wireUserSchema>;

export const wireTagSchema = tagSchema.extend({ createdAt: z.coerce.date() });
export type WireTag = z.infer<typeof wireTagSchema>;

export const wireTagListSchema = z.array(wireTagSchema);

/** Categories carry no timestamps, so the domain schema needs no coercion. */
export const wireCategoryListSchema = z.array(categorySchema);

export const wireVendorProfileSchema = vendorProfileDetailSchema.extend({
  profileImageUrl: imageUrl(),
  coverImageUrl: imageUrl(),
  tags: z.array(wireTagSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type WireVendorProfile = z.infer<typeof wireVendorProfileSchema>;

export const wireServicePackageSchema = servicePackageSchema.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type WireServicePackage = z.infer<typeof wireServicePackageSchema>;

export const wireServicePackageListSchema = z.array(wireServicePackageSchema);

export const wirePortfolioItemSchema = portfolioItemSchema.extend({
  imageUrl: requiredImageUrl(),
  thumbnailUrl: imageUrl(),
  createdAt: z.coerce.date(),
});
export type WirePortfolioItem = z.infer<typeof wirePortfolioItemSchema>;

export const wirePortfolioListSchema = z.array(wirePortfolioItemSchema);

/**
 * The public profile as JSON: its nested packages, portfolio items and tags all
 * carry timestamps, which cross the wire as ISO strings.
 */
export const wirePublicVendorProfileSchema = publicVendorProfileSchema.extend({
  profileImageUrl: imageUrl(),
  coverImageUrl: imageUrl(),
  tags: z.array(wireTagSchema),
  packages: z.array(wireServicePackageSchema),
  portfolio: z.array(wirePortfolioItemSchema),
});
export type WirePublicVendorProfile = z.infer<typeof wirePublicVendorProfileSchema>;

/**
 * Availability carries no timestamps — `date` is a `YYYY-MM-DD` calendar date
 * that stays a string end to end — so the domain schema needs no coercion.
 */
export const wireAvailabilityListSchema = z.array(availabilitySchema);
export type WireAvailability = z.infer<typeof availabilitySchema>;

/*
 * The booking surfaces, as JSON. Dates on the wire are ISO strings; the domain
 * schemas model them as `Date`, so each one is coerced back at the boundary.
 */
export const wireCustomerReviewSchema = customerReviewSchema.extend({
  createdAt: z.coerce.date(),
});
export type WireCustomerReview = z.infer<typeof wireCustomerReviewSchema>;
export const wireCustomerReviewListSchema = z.array(wireCustomerReviewSchema);

export const wireBookingRequestSchema = bookingRequestDetailSchema.extend({
  expiresAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type WireBookingRequest = z.infer<typeof wireBookingRequestSchema>;
export const wireBookingRequestListSchema = z.array(wireBookingRequestSchema);

export const wireBookingSchema = bookingWithContextSchema.extend({
  paidAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  cancelledAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type WireBooking = z.infer<typeof wireBookingSchema>;
export const wireBookingListSchema = z.array(wireBookingSchema);

/**
 * A customer as a vendor sees them. The discriminated union survives the
 * coercion, so the `limited` branch still cannot carry contact details.
 */
export const wireCustomerProfileSchema = z.discriminatedUnion('visibility', [
  customerProfileSchema.options[0].extend({
    memberSince: z.coerce.date(),
    recentReviews: wireCustomerReviewListSchema,
  }),
  customerProfileSchema.options[1].extend({
    memberSince: z.coerce.date(),
    recentReviews: wireCustomerReviewListSchema,
  }),
]);
export type WireCustomerProfile = z.infer<typeof wireCustomerProfileSchema>;

/** The vendor dashboard's figures. No date fields, so no coercion is needed. */
export const wireVendorDashboardSchema = vendorDashboardSchema;
export type WireVendorDashboard = z.infer<typeof wireVendorDashboardSchema>;

/** Messaging, as JSON — every timestamp coerced back at the boundary. */
export const wireConversationSchema = conversationSummarySchema.extend({
  otherPartyAvatarUrl: imageUrl(),
  lastMessageAt: z.coerce.date().nullable(),
});
export type WireConversation = z.infer<typeof wireConversationSchema>;
export const wireConversationListSchema = z.array(wireConversationSchema);

export const wireMessageSchema = sendMessageResultSchema.extend({
  readAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type WireMessage = z.infer<typeof wireMessageSchema>;
export const wireMessagePageSchema = paginatedSchema(wireMessageSchema);

export const wireNotificationSchema = notificationItemSchema.extend({
  readAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type WireNotification = z.infer<typeof wireNotificationSchema>;
export const wireNotificationPageSchema = paginatedSchema(wireNotificationSchema);

/**
 * Search results, with each card's images resolved from their stored keys.
 *
 * The domain schema is used directly on the API side, where the values are
 * still keys; this is the boundary where they become URLs.
 */
export const wireVendorCardSchema = vendorCardSchema.extend({
  coverImageUrl: imageUrl(),
  profileImageUrl: imageUrl(),
});
export type WireVendorCard = z.infer<typeof wireVendorCardSchema>;

export const wireVendorSearchResultSchema = vendorSearchResultSchema.extend({
  items: z.array(wireVendorCardSchema),
});

export const wireNearbyVendorSchema = nearbyVendorSchema.extend({
  coverImageUrl: imageUrl(),
  profileImageUrl: imageUrl(),
});
export type WireNearbyVendor = z.infer<typeof wireNearbyVendorSchema>;

export const wireNearbyAvailabilityResultSchema = nearbyAvailabilityResultSchema.extend({
  items: z.array(wireNearbyVendorSchema),
});
