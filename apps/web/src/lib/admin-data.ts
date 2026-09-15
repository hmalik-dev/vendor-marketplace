import { auth } from '@clerk/nextjs/server';
import { adminCategoryListSchema, type AdminCategoryList } from '@vendor-marketplace/shared';
import { redirect } from 'next/navigation';
import type { z } from 'zod';
import { ApiClientError, apiRequest } from './api-client';
import { redirectIfTermsRequired } from './terms-gate';
import { signInPathReturningHere } from './requested-path';
import {
  wireAdminBookingDetailSchema,
  wireAdminBookingPageSchema,
  wireAdminRequestPageSchema,
  wireAdminCaseDetailSchema,
  wireAdminCasePageSchema,
  wireAdminCustomerDetailSchema,
  wireAdminCustomerPageSchema,
  wireAdminMetricsSchema,
  wireAdminPaymentPageSchema,
  wireAdminActivityPageSchema,
  wireAdminPlatformSettingsSchema,
  wireAdminUserDataRightsSchema,
  wireAdminReviewPageSchema,
  wireAdminTagListSchema,
  wireAdminTagSuggestionPageSchema,
  wireAdminVendorDetailSchema,
  wireAdminVendorFacetsSchema,
  wireAdminVendorPageSchema,
  type WireAdminBookingDetail,
  type WireAdminBookingPage,
  type WireAdminRequestPage,
  type WireAdminCaseDetail,
  type WireAdminCasePage,
  type WireAdminCustomerDetail,
  type WireAdminCustomerPage,
  type WireAdminMetrics,
  type WireAdminPaymentPage,
  type WireAdminActivityPage,
  type WireAdminPlatformSettings,
  type WireAdminUserDataRights,
  type WireAdminReviewPage,
  type WireAdminTagList,
  type WireAdminTagSuggestionPage,
  type WireAdminVendorDetail,
  type WireAdminVendorFacets,
  type WireAdminVendorPage,
} from './wire-schemas';

/**
 * Server-side reads for the operations console. Server Components only — each
 * one resolves the Clerk session on the server, so no token reaches the browser.
 *
 * **Nothing here degrades to an empty result.** Every other surface in the
 * product has a defensible reason to render less rather than fail; a console an
 * operator moderates from does not. A read that silently answered `[]` would
 * show "0 awaiting review" to somebody deciding whether anyone is waiting, and
 * that is worse than the error boundary.
 */

interface AdminSession {
  token: string;
  signInPath: string;
}

async function adminSession(): Promise<AdminSession> {
  const signInPath = await signInPathReturningHere();
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    redirect(signInPath);
  }

  return { token, signInPath };
}

/**
 * The two session failures every protected read shares, turned into redirects.
 *
 * A **403 here is not `/suspended`.** On a vendor read it means a banned
 * account; on `/admin` it is far more often a signed-in non-admin who typed the
 * URL, and sending them to a suspension notice would tell them their account
 * was disabled when it was not. The layout's `requireRole('admin')` bounces
 * those before any read runs, so a 403 reaching here is the narrow case of a
 * role changing mid-render — `/` is the honest destination for both.
 */
async function rethrowUnlessSessionFailure(error: unknown, signInPath: string): Promise<never> {
  if (!(error instanceof ApiClientError)) {
    throw error;
  }

  if (error.statusCode === 401) {
    redirect(signInPath);
  }
  /*
   * The acceptance gate (#429) is a 403 too, and it is a different
   * instruction: an account that has not accepted the current Terms is one
   * tick from usable, while a suspension is terminal. Checked first, because
   * the status alone cannot tell them apart — only the code can.
   */
  await redirectIfTermsRequired(error);
  if (error.statusCode === 403) {
    redirect('/');
  }

  throw error;
}

async function adminRead<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const { token, signInPath } = await adminSession();

  try {
    return await apiRequest(path, { schema, token });
  } catch (error) {
    throw await rethrowUnlessSessionFailure(error, signInPath);
  }
}

export async function getAdminMetrics(): Promise<WireAdminMetrics> {
  return adminRead('/admin/metrics', wireAdminMetricsSchema);
}

export async function getAdminVendors(query: string): Promise<WireAdminVendorPage> {
  return adminRead(`/admin/vendors${query}`, wireAdminVendorPageSchema);
}

/**
 * One vendor and everything the console holds about them (VEN-380), or `null`
 * when no vendor has that id — a point read addressed by an id somebody can
 * hold, so a 404 is a wrong link rather than the error boundary, exactly as
 * `getAdminCase` rules.
 */
export async function getAdminVendorDetail(
  vendorId: string,
): Promise<WireAdminVendorDetail | null> {
  try {
    return await adminRead(`/admin/vendors/${vendorId}`, wireAdminVendorDetailSchema);
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return null;
    }

    throw error;
  }
}

export async function getAdminVendorFacets(): Promise<WireAdminVendorFacets> {
  return adminRead('/admin/vendors/facets', wireAdminVendorFacetsSchema);
}

export async function getAdminCustomers(query: string): Promise<WireAdminCustomerPage> {
  return adminRead(`/admin/customers${query}`, wireAdminCustomerPageSchema);
}

/**
 * One customer's record (VEN-400), or `null` when no customer has that id —
 * including an id that names a vendor or an operator, whose record is not
 * this one. A point read reached by link, as `getAdminVendorDetail` rules.
 */
export async function getAdminCustomerDetail(
  userId: string,
): Promise<WireAdminCustomerDetail | null> {
  try {
    return await adminRead(`/admin/customers/${userId}`, wireAdminCustomerDetailSchema);
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return null;
    }

    throw error;
  }
}

export async function getAdminBookings(query: string): Promise<WireAdminBookingPage> {
  return adminRead(`/admin/bookings${query}`, wireAdminBookingPageSchema);
}

/**
 * One booking's money story (VEN-399), or `null` when no booking has that id —
 * a point read an operator reaches by link, so a 404 is a wrong link rather
 * than the error boundary, as `getAdminVendorDetail` rules.
 */
export async function getAdminBookingDetail(
  bookingId: string,
): Promise<WireAdminBookingDetail | null> {
  try {
    return await adminRead(`/admin/bookings/${bookingId}`, wireAdminBookingDetailSchema);
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return null;
    }

    throw error;
  }
}

/** `Bookings · Requests` (VEN-399): every booking request, lazy expiry applied. */
export async function getAdminRequests(query: string): Promise<WireAdminRequestPage> {
  return adminRead(`/admin/requests${query}`, wireAdminRequestPageSchema);
}

export async function getAdminPayments(query: string): Promise<WireAdminPaymentPage> {
  return adminRead(`/admin/payments${query}`, wireAdminPaymentPageSchema);
}

/**
 * The case queue (#431).
 *
 * Nothing here degrades to an empty page either — the module's own header
 * gives the reason, and this is the surface it applies to hardest: an
 * operator told "no open cases" by a failed read would conclude nobody is
 * waiting while a vendor's payout stays frozen.
 */
export async function getAdminCases(query: string): Promise<WireAdminCasePage> {
  return adminRead(`/admin/cases${query}`, wireAdminCasePageSchema);
}

/**
 * One case, or `null` when no case has that id.
 *
 * **The one read in this module that maps 404 to `null`**, because it is the one
 * addressed by an id somebody can hold: a stale link out of an email, an id
 * copied from a resolved case, a uuid typed with one character wrong. Every
 * other read here is a list or a metric that cannot be "not found".
 * `rethrowUnlessSessionFailure` passes a 404 straight through, so without this
 * those all render the 500 error boundary — the same defect the page's uuid
 * guard exists to prevent, one shape further along. `customer-data.ts` and
 * `vendor-data.ts` handle their point reads exactly this way.
 */
export async function getAdminCase(caseId: string): Promise<WireAdminCaseDetail | null> {
  try {
    return await adminRead(`/admin/cases/${caseId}`, wireAdminCaseDetailSchema);
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return null;
    }

    throw error;
  }
}

export async function getAdminReviews(query: string): Promise<WireAdminReviewPage> {
  return adminRead(`/admin/reviews${query}`, wireAdminReviewPageSchema);
}

export async function getAdminTagSuggestions(query: string): Promise<WireAdminTagSuggestionPage> {
  return adminRead(`/admin/tag-suggestions${query}`, wireAdminTagSuggestionPageSchema);
}

export async function getAdminActivity(query: string): Promise<WireAdminActivityPage> {
  return adminRead(`/admin/activity${query}`, wireAdminActivityPageSchema);
}

/** The launch switches and the vendors whose payouts are held (VEN-404). */
export async function getAdminPlatformSettings(): Promise<WireAdminPlatformSettings> {
  return adminRead('/admin/settings', wireAdminPlatformSettingsSchema);
}

export async function getAdminTags(): Promise<WireAdminTagList> {
  return adminRead('/admin/tags', wireAdminTagListSchema);
}

/** Every category, inactive ones included. No dates on the row, so the shared schema parses the wire as is. */
export async function getAdminCategories(): Promise<AdminCategoryList> {
  return adminRead('/admin/categories', adminCategoryListSchema);
}

/**
 * One account's retained record and its legal acceptances (#438).
 *
 * Reads a **closed** account as readily as a live one, which is the surface's
 * whole point: the privacy policy promises records are kept, so the console has
 * to be able to show what is still held rather than 404 on the person the
 * promise was written for.
 */
export async function getAdminUserDataRights(userId: string): Promise<WireAdminUserDataRights> {
  return adminRead(`/admin/users/${userId}/data-rights`, wireAdminUserDataRightsSchema);
}
