import { todayDateString, type VendorDashboard } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { countActivePackages } from '../packages/packages.dao.js';
import {
  countBookingsBetween,
  countPendingRequests,
  countResponses,
  findBookingsOn,
  findCategoryIds,
  sumPayoutsBetween,
} from './dashboard.dao.js';
import { publishBlockers, requireOwnVendorProfile } from './vendors.service.js';

/** The window the response rate is measured over, as the frame labels it. */
const RESPONSE_WINDOW_DAYS = 30;

/** `YYYY-MM-01` for the month `date` falls in, and for the one before it. */
function monthBounds(date: string): { start: string; next: string; previous: string } {
  const [year, month] = date.split('-').map(Number);
  const pad = (value: number): string => String(value).padStart(2, '0');

  const startYear = year ?? 1970;
  const startMonth = month ?? 1;

  const nextMonth = startMonth === 12 ? 1 : startMonth + 1;
  const nextYear = startMonth === 12 ? startYear + 1 : startYear;
  const previousMonth = startMonth === 1 ? 12 : startMonth - 1;
  const previousYear = startMonth === 1 ? startYear - 1 : startYear;

  return {
    start: `${startYear}-${pad(startMonth)}-01`,
    next: `${nextYear}-${pad(nextMonth)}-01`,
    previous: `${previousYear}-${pad(previousMonth)}-01`,
  };
}

/**
 * The vendor's own dashboard figures.
 *
 * Every number is recomputed from source rows on read — none is a counter
 * something else increments, which is the rule that keeps a derived figure from
 * drifting away from the rows it claims to describe.
 *
 * `publishBlockers` is the **same function the publish gate uses**, not a
 * parallel list: a checklist that disagrees with the gate is worse than none,
 * because it tells the vendor they are ready when the gate will refuse them.
 */
export async function getVendorDashboard(
  db: AppDatabase,
  userId: string,
  now: Date = new Date(),
): Promise<VendorDashboard> {
  const vendor = await requireOwnVendorProfile(db, userId);
  const today = todayDateString(now);
  const { start, next, previous } = monthBounds(today);

  const since = new Date(now.getTime() - RESPONSE_WINDOW_DAYS * 86_400_000);

  const [
    newRequestCount,
    bookingsThisMonth,
    bookingsLastMonth,
    responses,
    earningsThisMonthCents,
    todaysBookings,
    categoryIds,
    activePackageCount,
  ] = await Promise.all([
    countPendingRequests(db, vendor.id),
    countBookingsBetween(db, vendor.id, start, next),
    countBookingsBetween(db, vendor.id, previous, start),
    countResponses(db, vendor.id, since),
    sumPayoutsBetween(
      db,
      vendor.id,
      new Date(`${start}T00:00:00.000Z`),
      new Date(`${next}T00:00:00.000Z`),
    ),
    findBookingsOn(db, vendor.id, today),
    findCategoryIds(db, vendor.id),
    countActivePackages(db, vendor.id),
  ]);

  const rating = Number.parseFloat(vendor.avgRating);

  return {
    newRequestCount,
    bookingsThisMonth,
    bookingsLastMonth,
    // `null`, not 0 — a vendor nobody has asked has no rate to report.
    responseRate: responses.offered === 0 ? null : responses.answered / responses.offered,
    avgRating: Number.isFinite(rating) ? rating : 0,
    reviewCount: vendor.reviewCount,
    earningsThisMonthCents,
    isPublished: vendor.isPublished,
    publishBlockers: publishBlockers(vendor, categoryIds, activePackageCount),
    stripeOnboarded: vendor.stripeOnboarded,
    todaysBookings,
  };
}
