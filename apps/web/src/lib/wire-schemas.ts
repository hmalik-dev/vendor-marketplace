import {
  ADMIN_NOTIFICATION_RECIPIENTS,
  availabilitySchema,
  bookingRequestDetailSchema,
  bookingWithContextSchema,
  cancelledBookingSchema,
  categorySchema,
  checkoutIntentSchema,
  conversationSummarySchema,
  customerProfileSchema,
  customerReviewSchema,
  notificationItemSchema,
  cursorPageSchema,
  paginatedSchema,
  wideningShape,
  sendMessageResultSchema,
  vendorDashboardSchema,
  termsAcceptanceStatusSchema,
  vendorAgreementStatusSchema,
  vendorPayoutStatusSchema,
  portfolioItemSchema,
  nearbyAvailabilityResultSchema,
  nearbyVendorSchema,
  publicAvailabilitySchema,
  publicReviewSchema,
  publicVendorProfileSchema,
  servicePackageSchema,
  streamTicketSchema,
  tagSchema,
  userSchema,
  adminActivityRowSchema,
  adminPlatformSettingsSchema,
  adminVendorApplicationRowSchema,
  adminVendorInviteRowSchema,
  adminBookingRowSchema,
  adminCaseBookingSchema,
  adminCaseDetailSchema,
  adminConversationMessagesSchema,
  adminCaseRowSchema,
  adminBanResultSchema,
  adminCloseAccountResultSchema,
  adminUserDataRightsSchema,
  adminUserExportSchema,
  adminCustomerRowSchema,
  adminMetricsSchema,
  adminPaymentRowSchema,
  adminPayoutRetryResultSchema,
  adminReviewRowSchema,
  adminTagRowSchema,
  adminTagSuggestionResultSchema,
  adminTagSuggestionRowSchema,
  adminVendorFacetsSchema,
  adminVendorRowSchema,
  adminAvailabilityLockSchema,
  adminLockBookingHolderSchema,
  adminLockRequestHolderSchema,
  adminVendorDetailProfileSchema,
  adminVendorDetailSchema,
  adminNotificationSchema,
  adminNotificationsSchema,
  adminCustomerBookingSchema,
  adminCustomerDetailProfileSchema,
  adminCustomerDetailSchema,
  adminCustomerReviewSchema,
  adminVendorPortfolioItemSchema,
  adminBookingDetailSchema,
  adminRequestRowSchema,
  vendorCardSchema,
  vendorProfileDetailSchema,
  vendorReviewsPageSchema,
  vendorSearchResultSchema,
} from '@vendor-marketplace/shared';
import { resolveImageUrl, toObjectKey } from '@vendor-marketplace/shared';
import { z } from 'zod';

/**
 * The one place a stored image value becomes a URL.
 *
 * The database holds an **object key**, so that moving the CDN is a config
 * change rather than a migration — and the resolution happens here, on the way
 * in, so no component has to remember to do it. A second resolution site would
 * be a second source of truth, which is the coupling this exists to remove.
 *
 * `NEXT_PUBLIC_STORAGE_PUBLIC_URL` is read as a literal property access because
 * Next inlines these only when it can see one statically.
 *
 * A bare read rather than `publicEnv`, deliberately: this module is imported by
 * almost every screen, so a throw here would take the whole app down instead of
 * one image. What used to make a missing value silent — every uploaded photo
 * rendering as the empty state, indistinguishable from "no photos yet" — is
 * closed at the build instead: `assertWebEnv` now validates the `storage`
 * capability and refuses to ship a deployment without this row.
 */
const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL;

/**
 * The same resolution, for a value that did not arrive over the wire.
 *
 * An upload hands the browser an object key before any response carrying it
 * has been re-fetched, so a component holding that key needs the identical
 * mapping the schemas apply — and needs it from here, because
 * `IMAGE_BASE_URL` is the thing that must not be read in two places. Passing
 * an already-resolved URL through is deliberate and is what makes this safe to
 * call on a value that may be either.
 */
export function toImageSrc(stored: string | null): string | null {
  return resolveImageUrl(IMAGE_BASE_URL, stored);
}

/**
 * The inverse of `toImageSrc`: the stored key for a value that came off the
 * wire resolved. Send this, not the resolved URL, when a form writes an image
 * back it did not change, or the row stops holding a key.
 */
export function toStoredImage(resolved: string | null): string | null {
  return resolved === null || !IMAGE_BASE_URL ? resolved : toObjectKey(IMAGE_BASE_URL, resolved);
}

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

/**
 * `POST /events/stream-ticket`. Carries no date, so there is nothing to coerce
 * and the shared schema is used as it stands.
 */
export const wireStreamTicketSchema = streamTicketSchema;

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

/**
 * The public calendar read. It carries no `note` — the vendor's private
 * reminder never leaves their own calendar (#407) — so the visitor-facing
 * surfaces parse this and cannot come to depend on a field the API will not
 * send them.
 */
export const wirePublicAvailabilityListSchema = z.array(publicAvailabilitySchema);
export type WirePublicAvailability = z.infer<typeof publicAvailabilitySchema>;

/*
 * The booking surfaces, as JSON. Dates on the wire are ISO strings; the domain
 * schemas model them as `Date`, so each one is coerced back at the boundary.
 */
export const wireCustomerReviewSchema = customerReviewSchema.extend({
  createdAt: z.coerce.date(),
});
export type WireCustomerReview = z.infer<typeof wireCustomerReviewSchema>;
export const wireCustomerReviewListSchema = z.array(wireCustomerReviewSchema);

/** One appended page of the vendor profile's Reviews tab. */
export const wireVendorReviewsPageSchema = vendorReviewsPageSchema.extend({
  items: z.array(publicReviewSchema.extend({ createdAt: z.coerce.date() })),
});
export type WireVendorReviewsPage = z.infer<typeof wireVendorReviewsPageSchema>;
export type WirePublicReview = WireVendorReviewsPage['items'][number];

export const wireBookingRequestSchema = bookingRequestDetailSchema.extend({
  /*
   * The vendor's photo is nested, and a nested field does not inherit the
   * resolution the top-level ones get. Without this the bookings hub rendered
   * the bare object key straight into `<img src>`, so the browser asked the
   * *web* origin for `/vendor-profile/…` — a 500 and a broken avatar for every
   * vendor who has a profile photo. Found driving #414.
   */
  vendor: bookingRequestDetailSchema.shape.vendor.extend({ avatarUrl: imageUrl() }),
  /*
   * Nested dates, and nested means they need saying: JSON hands these back as
   * strings and the object is `nullable`, so the coercion is applied to the
   * inner shape and the whole thing re-wrapped rather than spread.
   */
  settlement: bookingRequestDetailSchema.shape.settlement
    .unwrap()
    .extend({
      paidAt: z.coerce.date().nullable(),
      paidOutAt: z.coerce.date().nullable(),
      cancelledAt: z.coerce.date().nullable(),
    })
    .nullable(),
  expiresAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type WireBookingRequest = z.infer<typeof wireBookingRequestSchema>;
export const wireBookingRequestListSchema = z.array(wireBookingRequestSchema);

/** The checkout read. `acceptedAt` is the only date on it. */
export const wireCheckoutIntentSchema = checkoutIntentSchema.extend({
  acceptedAt: z.coerce.date().nullable(),
});
export type WireCheckoutIntent = z.infer<typeof wireCheckoutIntentSchema>;

export const wireBookingSchema = bookingWithContextSchema.extend({
  paidAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  cancelledAt: z.coerce.date().nullable(),
  /* #425. A `z.date()` on the API side needs its coercion here or the parse
     rejects the string the server really sent — and this one is `null` on every
     unreleased booking, so a fixture without a released payout proves nothing.
     `wire-schemas.test.ts` parses one that carries a value. */
  payoutReleasedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type WireBooking = z.infer<typeof wireBookingSchema>;
export const wireBookingListSchema = z.array(wireBookingSchema);

/**
 * A booking with no request context — what the action routes and the report
 * read answer. Derived from the schema above rather than restated, so the date
 * coercions are declared once (#425).
 */
export const wireBookingViewSchema = wireBookingSchema.omit({ eventType: true, venue: true });
export type WireBookingView = z.infer<typeof wireBookingViewSchema>;

/** What a cancellation answers: the booking as it now stands, and the refund. */
export const cancelledBookingWireSchema = cancelledBookingSchema.extend({
  booking: wireBookingViewSchema,
});
export type WireCancelledBooking = z.infer<typeof cancelledBookingWireSchema>;

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

/**
 * The vendor dashboard's figures, with the payout's release date coerced back
 * from JSON.
 *
 * This said *"No date fields, so no coercion is needed"* and stood as the
 * shared schema unchanged — true until #423 gave `nextPayout` a `releaseAt`,
 * and false the moment it did. A `z.date()` against the string JSON actually
 * carries fails `safeParse`, so `api-client` threw and the vendor's home screen
 * died for **every vendor who was owed a payout** — while rendering fine for
 * everyone owed nothing, which is why nothing caught it: `tsc` infers `Date`
 * either side of the wire, and the route suite reads the response object rather
 * than its JSON.
 */
export const wireVendorDashboardSchema = vendorDashboardSchema.extend({
  /*
   * `nextReleaseAt` is a `z.date()` on the wire, so it arrives as an ISO string
   * and must be coerced back here. #423 shipped the same trap one field over:
   * the dashboard 500'd for every vendor who was owed a payout and rendered
   * fine for everyone else, with the whole local gate green, because the only
   * fixture exercising it had the field absent. `.claude/rules/
   * web-route-boundaries.md` carries the rule; the tests below it carry a
   * fixture that has money in it.
   */
  payouts: vendorDashboardSchema.shape.payouts.extend({
    next: vendorDashboardSchema.shape.payouts.shape.next
      .unwrap()
      .extend({ releaseAt: z.coerce.date() })
      .nullable(),
  }),
});
export type WireVendorDashboard = z.infer<typeof wireVendorDashboardSchema>;

/** The vendor's payout state — plain JSON, so the shared schema stands as-is. */
export const wireVendorPayoutStatusSchema = vendorPayoutStatusSchema;
export type WireVendorPayoutStatus = z.infer<typeof wireVendorPayoutStatusSchema>;

/**
 * The vendor agreement's state.
 *
 * The shared schema stands as-is because `acceptedAt` is already
 * `z.coerce.date()` there — a `z.date()` over the wire is a string the parser
 * refuses, and that failure renders as a 500 on the one screen a vendor cannot
 * take payment without.
 */
export const wireVendorAgreementStatusSchema = vendorAgreementStatusSchema;
export type WireVendorAgreementStatus = z.infer<typeof wireVendorAgreementStatusSchema>;

/**
 * The first-sign-in acceptance gate's state, for the same reason: its
 * `acceptedAt` is already `z.coerce.date()` on the shared schema, so the JSON
 * string the API actually sends parses rather than 500ing the one screen a new
 * account cannot get past.
 */
export const wireTermsAcceptanceStatusSchema = termsAcceptanceStatusSchema;
export type WireTermsAcceptanceStatus = z.infer<typeof wireTermsAcceptanceStatusSchema>;

/** Messaging, as JSON — every timestamp coerced back at the boundary. */
export const wireConversationSchema = conversationSummarySchema.extend({
  otherPartyAvatarUrl: imageUrl(),
  lastMessageAt: z.coerce.date().nullable(),
});
export type WireConversation = z.infer<typeof wireConversationSchema>;
export const wireConversationPageSchema = cursorPageSchema(wireConversationSchema).extend({
  hasUnread: z.boolean(),
});

export const wireMessageSchema = sendMessageResultSchema.extend({
  readAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type WireMessage = z.infer<typeof wireMessageSchema>;
export const wireMessagePageSchema = cursorPageSchema(wireMessageSchema);

export const wireNotificationSchema = notificationItemSchema.extend({
  readAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type WireNotification = z.infer<typeof wireNotificationSchema>;
export const wireNotificationPageSchema = cursorPageSchema(wireNotificationSchema);

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

// --- Admin (#15) -----------------------------------------------------------

/**
 * The admin console's reads, with their timestamps coerced back from the ISO
 * strings JSON carries. No image resolution: the console shows names and
 * numbers, and a table of thumbnails is not what an operations tool is for.
 */
export const wireAdminVendorRowSchema = adminVendorRowSchema.extend({
  createdAt: z.coerce.date(),
});
export type WireAdminVendorRow = z.infer<typeof wireAdminVendorRowSchema>;

export const wireAdminVendorPageSchema = paginatedSchema(wireAdminVendorRowSchema).extend({
  awaitingReview: z.int(),
  ...wideningShape,
});
export type WireAdminVendorPage = z.infer<typeof wireAdminVendorPageSchema>;

/** One row of the Notifications card every admin detail view carries (VEN-400). */
export const wireAdminNotificationSchema = adminNotificationSchema.extend({
  createdAt: z.coerce.date(),
  readAt: z.coerce.date().nullable(),
});
export type WireAdminNotification = z.infer<typeof wireAdminNotificationSchema>;

export const wireAdminNotificationsSchema = adminNotificationsSchema.extend({
  items: z.array(wireAdminNotificationSchema),
});
export type WireAdminNotifications = z.infer<typeof wireAdminNotificationsSchema>;

/**
 * `GET /admin/vendors/:vendorId` (VEN-380). Four dates cross the wire — the
 * vendor's `createdAt`, a request holder's `expiresAt`, and each notification's
 * `createdAt` and `readAt` — and the portfolio's object keys resolve to URLs.
 */
export const wireAdminVendorDetailSchema = adminVendorDetailSchema.extend({
  vendor: adminVendorDetailProfileSchema.extend({ createdAt: z.coerce.date() }),
  portfolio: z.array(
    adminVendorPortfolioItemSchema.extend({
      imageUrl: requiredImageUrl(),
      thumbnailUrl: imageUrl(),
    }),
  ),
  locks: z.array(
    adminAvailabilityLockSchema.extend({
      holders: z.array(
        z.discriminatedUnion('kind', [
          adminLockBookingHolderSchema,
          adminLockRequestHolderSchema.extend({ expiresAt: z.coerce.date().nullable() }),
        ]),
      ),
    }),
  ),
  notifications: wireAdminNotificationsSchema,
});
export type WireAdminVendorDetail = z.infer<typeof wireAdminVendorDetailSchema>;

export const wireAdminVendorFacetsSchema = adminVendorFacetsSchema;
export type WireAdminVendorFacets = z.infer<typeof wireAdminVendorFacetsSchema>;

export const wireAdminCustomerRowSchema = adminCustomerRowSchema.extend({
  createdAt: z.coerce.date(),
});
export type WireAdminCustomerRow = z.infer<typeof wireAdminCustomerRowSchema>;
export const wireAdminCustomerPageSchema = paginatedSchema(wireAdminCustomerRowSchema).extend(
  wideningShape,
);
export type WireAdminCustomerPage = z.infer<typeof wireAdminCustomerPageSchema>;

/**
 * `GET /admin/customers/:userId` (VEN-400) — the account's three instants,
 * each review's `createdAt`, and the notifications' two dates cross the wire.
 */
const wireAdminCustomerReviewListSchema = z.object({
  total: z.int(),
  items: z.array(adminCustomerReviewSchema.extend({ createdAt: z.coerce.date() })),
});
export const wireAdminCustomerDetailSchema = adminCustomerDetailSchema.extend({
  customer: adminCustomerDetailProfileSchema.extend({
    bannedAt: z.coerce.date().nullable(),
    deletedAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
  }),
  bookings: z.object({ total: z.int(), items: z.array(adminCustomerBookingSchema) }),
  reviews: z.object({
    written: wireAdminCustomerReviewListSchema,
    received: wireAdminCustomerReviewListSchema,
  }),
  notifications: wireAdminNotificationsSchema,
});
export type WireAdminCustomerDetail = z.infer<typeof wireAdminCustomerDetailSchema>;

export const wireAdminBookingRowSchema = adminBookingRowSchema.extend({
  createdAt: z.coerce.date(),
});
export type WireAdminBookingRow = z.infer<typeof wireAdminBookingRowSchema>;
export const wireAdminBookingPageSchema =
  paginatedSchema(wireAdminBookingRowSchema).extend(wideningShape);
export type WireAdminBookingPage = z.infer<typeof wireAdminBookingPageSchema>;

/** `GET /admin/bookings/:bookingId` (VEN-399) — five dates, and the notifications' two. */
export const wireAdminBookingDetailSchema = adminBookingDetailSchema.extend({
  payoutReleasedAt: z.coerce.date().nullable(),
  paidAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  cancelledAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  notifications: wireAdminNotificationsSchema.extend({
    items: z.array(
      wireAdminNotificationSchema.extend({
        recipient: z.enum(ADMIN_NOTIFICATION_RECIPIENTS),
      }),
    ),
  }),
});
export type WireAdminBookingDetail = z.infer<typeof wireAdminBookingDetailSchema>;

/** `GET /admin/requests` (VEN-399) — `expiresAt`, `resolvedAt` and `createdAt` are dates. */
export const wireAdminRequestRowSchema = adminRequestRowSchema.extend({
  expiresAt: z.coerce.date().nullable(),
  resolvedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type WireAdminRequestRow = z.infer<typeof wireAdminRequestRowSchema>;
export const wireAdminRequestPageSchema =
  paginatedSchema(wireAdminRequestRowSchema).extend(wideningShape);
export type WireAdminRequestPage = z.infer<typeof wireAdminRequestPageSchema>;

/**
 * Two dates, and `payoutReleasedAt` is the one that is new (#432).
 *
 * `.claude/rules/web-route-boundaries.md` is explicit that a `z.date()` added
 * to a response schema without its `z.coerce.date()` here 500s the page —
 * conditionally, for the rows that carry a value, with the whole local gate
 * green. #423 shipped exactly that on the vendor dashboard.
 */
export const wireAdminPaymentRowSchema = adminPaymentRowSchema.extend({
  paidAt: z.coerce.date().nullable(),
  payoutReleasedAt: z.coerce.date().nullable(),
});
export type WireAdminPaymentRow = z.infer<typeof wireAdminPaymentRowSchema>;
export const wireAdminPaymentPageSchema =
  paginatedSchema(wireAdminPaymentRowSchema).extend(wideningShape);
export type WireAdminPaymentPage = z.infer<typeof wireAdminPaymentPageSchema>;

/** Calendar years with settled bookings, for the 1099-K downloads (VEN-722). */
export const wireAdminTaxYearsSchema = z.object({
  years: z.array(z.number().int()),
  /** What backup withholding kept in each year, for Form 945 (VEN-723); only years that withheld something. */
  backupWithheld: z.array(z.object({ year: z.number().int(), cents: z.number().int() })),
});
export type WireAdminTaxYears = z.infer<typeof wireAdminTaxYearsSchema>;

/** The years a vendor has a yearly statement for (VEN-725): the same shape as the admin's list. */
export const wireVendorTaxYearsSchema = wireAdminTaxYearsSchema;

/**
 * The retry's answer, with its date coerced — **the one that gets away** (#432).
 *
 * `payoutReleasedAt` is null on the `failed` and `busy` outcomes and a string
 * on `released`, so passing the shared schema straight to `useApi` parses fine
 * for every retry that did not work and throws for the one that did: the
 * admin is told a completed transfer failed, in the API client's own words,
 * while the money has already left the platform balance. Found by review, not
 * by the suite — the route tests read the response object rather than its JSON.
 */
export const wireAdminPayoutRetryResultSchema = adminPayoutRetryResultSchema.extend({
  payoutReleasedAt: z.coerce.date().nullable(),
});
export type WireAdminPayoutRetryResult = z.infer<typeof wireAdminPayoutRetryResultSchema>;

export const wireAdminReviewRowSchema = adminReviewRowSchema.extend({
  createdAt: z.coerce.date(),
});
export type WireAdminReviewRow = z.infer<typeof wireAdminReviewRowSchema>;
export const wireAdminReviewPageSchema =
  paginatedSchema(wireAdminReviewRowSchema).extend(wideningShape);
export type WireAdminReviewPage = z.infer<typeof wireAdminReviewPageSchema>;

export const wireAdminTagSuggestionRowSchema = adminTagSuggestionRowSchema.extend({
  createdAt: z.coerce.date(),
  resolvedAt: z.coerce.date().nullable(),
});
export type WireAdminTagSuggestionRow = z.infer<typeof wireAdminTagSuggestionRowSchema>;
export const wireAdminTagSuggestionPageSchema = paginatedSchema(wireAdminTagSuggestionRowSchema);
export type WireAdminTagSuggestionPage = z.infer<typeof wireAdminTagSuggestionPageSchema>;

export const wireAdminTagRowSchema = adminTagRowSchema.extend({ createdAt: z.coerce.date() });
export type WireAdminTagRow = z.infer<typeof wireAdminTagRowSchema>;
export const wireAdminTagListSchema = z.object({ items: z.array(wireAdminTagRowSchema) });
export type WireAdminTagList = z.infer<typeof wireAdminTagListSchema>;

/**
 * The action log (#434).
 *
 * `createdAt` is the coercion `.claude/rules/web-route-boundaries.md` asks for
 * on every `z.date()` that crosses the wire — and here it is the only column
 * the screen sorts and prints, so a missing coercion would 500 the page for any
 * console that has ever done anything, rather than only for some rows.
 */
export const wireAdminActivityRowSchema = adminActivityRowSchema.extend({
  createdAt: z.coerce.date(),
});
export type WireAdminActivityRow = z.infer<typeof wireAdminActivityRowSchema>;
export const wireAdminActivityPageSchema = paginatedSchema(wireAdminActivityRowSchema).extend(
  wideningShape,
);
export type WireAdminActivityPage = z.infer<typeof wireAdminActivityPageSchema>;

/** The launch switches (VEN-404); `updatedAt` is the only date on it. */
export const wireAdminPlatformSettingsSchema = adminPlatformSettingsSchema.extend({
  updatedAt: z.coerce.date().nullable(),
});
export type WireAdminPlatformSettings = z.infer<typeof wireAdminPlatformSettingsSchema>;

/** The vendor waitlist (VEN-406); `createdAt` is the only date on a row. */
export const wireAdminVendorApplicationRowSchema = adminVendorApplicationRowSchema.extend({
  createdAt: z.coerce.date(),
});
export type WireAdminVendorApplicationRow = z.infer<typeof wireAdminVendorApplicationRowSchema>;

export const wireAdminVendorApplicationListSchema = paginatedSchema(
  wireAdminVendorApplicationRowSchema,
).extend({ waiting: z.int().min(0) });
export type WireAdminVendorApplicationList = z.infer<typeof wireAdminVendorApplicationListSchema>;

/** The vendor invites (VEN-406): when sent, and when used. */
export const wireAdminVendorInviteRowSchema = adminVendorInviteRowSchema.extend({
  createdAt: z.coerce.date(),
  acceptedAt: z.coerce.date().nullable(),
});
export type WireAdminVendorInviteRow = z.infer<typeof wireAdminVendorInviteRowSchema>;

export const wireAdminVendorInviteListSchema = paginatedSchema(wireAdminVendorInviteRowSchema);
export type WireAdminVendorInviteList = z.infer<typeof wireAdminVendorInviteListSchema>;

/**
 * The case queue (#431).
 *
 * Five coercions rather than one, because the case detail is the console's only
 * read with dates on **two** levels — the case's own, and the booking's money
 * timestamps. A missing coercion on either 500s the screen an admin opens to
 * decide who keeps the money, which is the worst place in the product for a
 * `.getTime is not a function`.
 */
export const wireAdminCaseRowSchema = adminCaseRowSchema.extend({
  createdAt: z.coerce.date(),
});
export type WireAdminCaseRow = z.infer<typeof wireAdminCaseRowSchema>;
export const wireAdminCasePageSchema =
  paginatedSchema(wireAdminCaseRowSchema).extend(wideningShape);
export type WireAdminCasePage = z.infer<typeof wireAdminCasePageSchema>;

export const wireAdminCaseBookingSchema = adminCaseBookingSchema.extend({
  paidAt: z.coerce.date().nullable(),
  payoutReleasedAt: z.coerce.date().nullable(),
});
export type WireAdminCaseBooking = z.infer<typeof wireAdminCaseBookingSchema>;

export const wireAdminCaseDetailSchema = adminCaseDetailSchema.extend({
  createdAt: z.coerce.date(),
  emailFailedAt: z.coerce.date().nullable(),
  resolvedAt: z.coerce.date().nullable(),
  booking: wireAdminCaseBookingSchema.nullable(),
});
export type WireAdminCaseDetail = z.infer<typeof wireAdminCaseDetailSchema>;

/**
 * A reported thread as the console reads it (#436).
 *
 * `readAt` earns its coercion as much as `createdAt` does: "they saw it and
 * kept going" is a different complaint from "they never opened it", and it is
 * the fact a harassment report turns on that the message text does not carry.
 */
export const wireAdminConversationMessagesSchema = adminConversationMessagesSchema.extend({
  messages: z.object({
    items: z.array(
      adminConversationMessagesSchema.shape.messages.shape.items.element.extend({
        readAt: z.coerce.date().nullable(),
        createdAt: z.coerce.date(),
      }),
    ),
    total: z.int().min(0),
    page: z.int().min(1),
    pageSize: z.int().min(1),
  }),
});
export type WireAdminConversationMessages = z.infer<typeof wireAdminConversationMessagesSchema>;

/** No dates on the wire: every series point is already a `YYYY-MM-DD` string. */
export const wireAdminMetricsSchema = adminMetricsSchema;
export type WireAdminMetrics = z.infer<typeof wireAdminMetricsSchema>;

/**
 * What resolving a suggestion answered.
 *
 * `tag` is `wireTagSchema`, **not** `wireAdminTagRowSchema`: the API returns
 * `tagSchema` here, which carries no `vendorCount`, so requiring the admin row
 * would reject every successful response.
 */
export const wireAdminTagSuggestionResultSchema = adminTagSuggestionResultSchema.extend({
  suggestion: wireAdminTagSuggestionRowSchema,
  tag: wireTagSchema.nullable(),
});
export type WireAdminTagSuggestionResult = z.infer<typeof wireAdminTagSuggestionResultSchema>;

/**
 * The data-rights surfaces (#438).
 *
 * No `.extend` with a coerced date on any of the three: every date in these
 * schemas is already `z.coerce.date()` at the source, because they are read by
 * an admin's browser as well as by the API's own response validator and a
 * `z.date()` would reject the ISO string the wire actually carries.
 */
export const wireAdminUserDataRightsSchema = adminUserDataRightsSchema;
export type WireAdminUserDataRights = z.infer<typeof wireAdminUserDataRightsSchema>;

/** One row of the refusal, named on the page before the API has to make it. */
export type WireAdminCloseBlocker = WireAdminUserDataRights['closeBlockers'][number];

export const wireAdminUserExportSchema = adminUserExportSchema;
export type WireAdminUserExport = z.infer<typeof wireAdminUserExportSchema>;

export const wireAdminBanResultSchema = adminBanResultSchema;
export const wireAdminCloseAccountResultSchema = adminCloseAccountResultSchema;
export type WireAdminCloseAccountResult = z.infer<typeof wireAdminCloseAccountResultSchema>;
