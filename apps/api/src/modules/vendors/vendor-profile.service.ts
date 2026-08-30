import {
  publicVendorProfileSchema,
  toDateString,
  type Availability,
  type PublicVendorProfile,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { notFound } from '../../lib/errors.js';
import { findAvailabilityInRange } from '../availability/availability.dao.js';
import { availabilityWindow } from '../availability/availability.service.js';
import {
  findActivePackages,
  findPortfolio,
  findPublicVendorBySlug,
  findPublicVendorTags,
  findVendorCategories,
} from './vendor-profile.dao.js';

/**
 * The public profile behind frame `03`.
 *
 * Unpublished, deleted and non-existent all answer 404, and they answer it with
 * the same message. Distinguishing them would turn the endpoint into a probe
 * for whether a given slug is a real draft — and the visitor's next step is the
 * same in all three cases anyway.
 */
export async function getPublicVendorProfile(
  db: AppDatabase,
  slug: string,
): Promise<PublicVendorProfile> {
  const vendor = await findPublicVendorBySlug(db, slug);

  if (!vendor) {
    throw notFound('That vendor page is not available');
  }

  /*
   * Four reads that do not depend on each other, so they go together rather
   * than in series — this is the product's most important page and it is
   * rendered on the server before anything reaches the visitor.
   */
  const [categories, tags, packages, portfolio] = await Promise.all([
    findVendorCategories(db, vendor.id),
    findPublicVendorTags(db, vendor.id),
    findActivePackages(db, vendor.id),
    findPortfolio(db, vendor.id),
  ]);

  return publicVendorProfileSchema.parse({
    ...vendor,
    // `numeric` comes back from the driver as a string; the contract is a number.
    avgRating: Number(vendor.avgRating),
    categories,
    tags,
    packages,
    portfolio,
  });
}

/**
 * The vendor's calendar, for the profile's Availability tab.
 *
 * Only rows the vendor has actually set are returned; a date with no row is
 * free, which is the same convention the vendor's own calendar uses. The window
 * is the shared one, so the public view and the editor can never disagree about
 * how far ahead the calendar runs.
 *
 * The same 404 as the profile for an unpublished or missing vendor — otherwise
 * this endpoint would answer questions about a draft the profile route hides.
 */
export async function getPublicVendorAvailability(
  db: AppDatabase,
  slug: string,
  now: Date = new Date(),
): Promise<Availability[]> {
  const vendor = await findPublicVendorBySlug(db, slug);

  if (!vendor) {
    throw notFound('That vendor page is not available');
  }

  /*
   * Forward-only, deliberately. `availabilityWindow` starts at the first of
   * the current month so the vendor's OWN calendar can show completed events;
   * a customer has no use for the days already behind them, and every past row
   * returned here would carry the vendor's private `note` — "Sarah & Tom,
   * deposit paid" — over a public endpoint.
   */
  const { to } = availabilityWindow(now);

  return findAvailabilityInRange(db, vendor.id, toDateString(now), to);
}
