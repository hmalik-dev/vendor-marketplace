import {
  completionRate,
  type CustomerProfile,
  type CustomerReview,
} from '@vendor-marketplace/shared';
import type { UserRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { forbidden, notFound } from '../../lib/errors.js';
import type { AuthenticatedUser } from '../../plugins/clerk-auth.js';
import {
  findCustomerById,
  findCustomerReviews,
  findRelationship,
  findVendorIdForUser,
  type CustomerReviewRow,
} from './customers.dao.js';

/** How many reviews travel inline on the profile, newest first. */
const INLINE_REVIEW_COUNT = 3;

/** `avg_customer_rating` is a Postgres NUMERIC, surfaced as a string. */
function parseRating(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toReview(row: CustomerReviewRow): CustomerReview {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    content: row.content,
    vendorBusinessName: row.vendorBusinessName,
    createdAt: row.createdAt,
  };
}

/**
 * The half of a customer profile every vendor with a booking relationship
 * sees. It carries no field that identifies or contacts the person — that is
 * the point of the tier, not an oversight.
 */
function toLimited(row: UserRow, recentReviews: CustomerReview[]) {
  return {
    id: row.id,
    firstName: row.firstName,
    memberSince: row.createdAt,
    bio: row.bio,
    city: row.city,
    state: row.state,
    budgetTier: row.budgetTier,
    typicalGuestCountMin: row.typicalGuestCountMin,
    typicalGuestCountMax: row.typicalGuestCountMax,
    totalBookingsCount: row.totalBookingsCount,
    completedBookingsCount: row.completedBookingsCount,
    cancelledBookingsCount: row.cancelledBookingsCount,
    avgCustomerRating: parseRating(row.avgCustomerRating),
    customerReviewCount: row.customerReviewCount,
    completionRate: completionRate(row.completedBookingsCount, row.cancelledBookingsCount),
    recentReviews,
  };
}

/**
 * A customer as one particular vendor may see them.
 *
 * Visibility is decided **here, from the booking relationship**, never from a
 * parameter the caller sends: a vendor cannot ask for the full tier, they can
 * only have accepted a booking. A vendor with no relationship at all gets
 * neither tier and cannot tell the id apart from one that does not exist.
 */
export async function getCustomerProfileForVendor(
  db: AppDatabase,
  user: AuthenticatedUser,
  customerId: string,
): Promise<CustomerProfile> {
  const vendorId = await findVendorIdForUser(db, user.id);

  if (!vendorId) {
    throw forbidden('Only a vendor can view a customer profile');
  }

  const customer = await findCustomerById(db, customerId);

  if (!customer || customer.role !== 'customer' || customer.deletedAt !== null) {
    throw notFound('That customer does not exist');
  }

  const relationship = await findRelationship(db, vendorId, customerId);

  if (!relationship.exists) {
    /*
     * 404 rather than 403: a vendor with no booking from this person should
     * not be able to confirm the account exists by probing ids.
     */
    throw notFound('That customer does not exist');
  }

  const reviews = (await findCustomerReviews(db, customerId, INLINE_REVIEW_COUNT)).map(toReview);
  const limited = toLimited(customer, reviews);

  if (!relationship.accepted) {
    return { ...limited, visibility: 'limited' };
  }

  return {
    ...limited,
    visibility: 'full',
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    avatarUrl: customer.avatarUrl,
  };
}

/**
 * A customer's public review history — what vendors said about working with
 * them. Readable by any vendor with a booking relationship, on the same
 * reasoning as the profile itself.
 */
export async function listCustomerReviews(
  db: AppDatabase,
  user: AuthenticatedUser,
  customerId: string,
): Promise<CustomerReview[]> {
  // Reuses the profile's own gate, so the two cannot diverge on who may read.
  await getCustomerProfileForVendor(db, user, customerId);

  return (await findCustomerReviews(db, customerId)).map(toReview);
}

/** The signed-in customer's own review history — no relationship gate needed. */
export async function listOwnReviews(
  db: AppDatabase,
  user: AuthenticatedUser,
): Promise<CustomerReview[]> {
  return (await findCustomerReviews(db, user.id)).map(toReview);
}
