import {
  AVAILABILITY_STATUSES,
  BOOKING_REQUEST_STATUSES,
  BOOKING_STATUSES,
  BUDGET_TIERS,
  PRICE_TYPES,
  REVIEW_TYPES,
  TAG_CATEGORIES,
  TAG_SUGGESTION_STATUSES,
  USER_ROLES,
} from '@vendor-marketplace/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Postgres enums are declared from the shared constant arrays, so a value can
 * never exist in Zod validation without also existing in the database type.
 */
export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const priceTypeEnum = pgEnum('price_type', PRICE_TYPES);
export const availabilityStatusEnum = pgEnum('availability_status', AVAILABILITY_STATUSES);
export const bookingRequestStatusEnum = pgEnum('booking_request_status', BOOKING_REQUEST_STATUSES);
export const bookingStatusEnum = pgEnum('booking_status', BOOKING_STATUSES);
export const reviewTypeEnum = pgEnum('review_type', REVIEW_TYPES);
export const budgetTierEnum = pgEnum('budget_tier', BUDGET_TIERS);
export const tagCategoryEnum = pgEnum('tag_category', TAG_CATEGORIES);
export const tagSuggestionStatusEnum = pgEnum('tag_suggestion_status', TAG_SUGGESTION_STATUSES);
