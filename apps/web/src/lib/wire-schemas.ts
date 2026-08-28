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
  publicVendorProfileSchema,
  servicePackageSchema,
  tagSchema,
  userSchema,
  vendorProfileDetailSchema,
} from '@vendor-marketplace/shared';
import { z } from 'zod';

/**
 * The domain schemas in `@vendor-marketplace/shared` model timestamps as `Date`, which
 * is what the database layer holds. JSON has no date type, so responses carry
 * ISO strings — these wire variants coerce them back at the client boundary
 * without forking the rest of the shape.
 */
export const wireUserSchema = userSchema.extend({
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
  createdAt: z.coerce.date(),
});
export type WirePortfolioItem = z.infer<typeof wirePortfolioItemSchema>;

export const wirePortfolioListSchema = z.array(wirePortfolioItemSchema);

/**
 * The public profile as JSON: its nested packages, portfolio items and tags all
 * carry timestamps, which cross the wire as ISO strings.
 */
export const wirePublicVendorProfileSchema = publicVendorProfileSchema.extend({
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
