import {
  availabilitySchema,
  categorySchema,
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
