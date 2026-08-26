import { categorySchema, tagSchema, userSchema, vendorProfileDetailSchema } from '@vendorhub/shared';
import { z } from 'zod';

/**
 * The domain schemas in `@vendorhub/shared` model timestamps as `Date`, which
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
