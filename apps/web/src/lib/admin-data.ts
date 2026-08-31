import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { z } from 'zod';
import { ApiClientError, apiRequest } from './api-client';
import { signInPathReturningHere } from './requested-path';
import {
  wireAdminBookingPageSchema,
  wireAdminCustomerPageSchema,
  wireAdminMetricsSchema,
  wireAdminPaymentPageSchema,
  wireAdminReviewPageSchema,
  wireAdminTagListSchema,
  wireAdminTagSuggestionPageSchema,
  wireAdminVendorFacetsSchema,
  wireAdminVendorPageSchema,
  type WireAdminBookingPage,
  type WireAdminCustomerPage,
  type WireAdminMetrics,
  type WireAdminPaymentPage,
  type WireAdminReviewPage,
  type WireAdminTagList,
  type WireAdminTagSuggestionPage,
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
function rethrowUnlessSessionFailure(error: unknown, signInPath: string): never {
  if (!(error instanceof ApiClientError)) {
    throw error;
  }

  if (error.statusCode === 401) {
    redirect(signInPath);
  }
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
    rethrowUnlessSessionFailure(error, signInPath);
  }
}

/** Drops empty values so a cleared filter leaves the query string rather than sending `?city=`. */
export function adminQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }

  const query = search.toString();

  return query ? `?${query}` : '';
}

export async function getAdminMetrics(): Promise<WireAdminMetrics> {
  return adminRead('/admin/metrics', wireAdminMetricsSchema);
}

export async function getAdminVendors(query: string): Promise<WireAdminVendorPage> {
  return adminRead(`/admin/vendors${query}`, wireAdminVendorPageSchema);
}

export async function getAdminVendorFacets(): Promise<WireAdminVendorFacets> {
  return adminRead('/admin/vendors/facets', wireAdminVendorFacetsSchema);
}

export async function getAdminCustomers(query: string): Promise<WireAdminCustomerPage> {
  return adminRead(`/admin/customers${query}`, wireAdminCustomerPageSchema);
}

export async function getAdminBookings(query: string): Promise<WireAdminBookingPage> {
  return adminRead(`/admin/bookings${query}`, wireAdminBookingPageSchema);
}

export async function getAdminPayments(query: string): Promise<WireAdminPaymentPage> {
  return adminRead(`/admin/payments${query}`, wireAdminPaymentPageSchema);
}

export async function getAdminReviews(query: string): Promise<WireAdminReviewPage> {
  return adminRead(`/admin/reviews${query}`, wireAdminReviewPageSchema);
}

export async function getAdminTagSuggestions(query: string): Promise<WireAdminTagSuggestionPage> {
  return adminRead(`/admin/tag-suggestions${query}`, wireAdminTagSuggestionPageSchema);
}

export async function getAdminTags(): Promise<WireAdminTagList> {
  return adminRead('/admin/tags', wireAdminTagListSchema);
}
