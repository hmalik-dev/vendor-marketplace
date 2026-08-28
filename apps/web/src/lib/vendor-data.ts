import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { type Category } from '@vendor-marketplace/shared';
import { ApiClientError, apiRequest } from './api-client';
import { isNavigationSignal } from './navigation-signal';
import {
  wireAvailabilityListSchema,
  wireCategoryListSchema,
  wirePortfolioListSchema,
  wireServicePackageListSchema,
  wireTagListSchema,
  wirePublicVendorProfileSchema,
  wireVendorDashboardSchema,
  wireVendorSearchResultSchema,
  wireVendorProfileSchema,
  type WireAvailability,
  type WirePortfolioItem,
  type WireServicePackage,
  type WireTag,
  type WirePublicVendorProfile,
  type WireVendorCard,
  type WireVendorDashboard,
  type WireVendorProfile,
} from './wire-schemas';

/**
 * Server-side reads for the vendor profile surfaces. Server Components only —
 * each one resolves the Clerk session on the server, so no token ever reaches
 * the browser.
 */

/** The Clerk session token for a vendor read, or a redirect to sign-in. */
async function vendorToken(): Promise<string> {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    redirect('/sign-in');
  }

  return token;
}

/**
 * Turns the two session failures every protected read shares into the same
 * redirects, so an expired session never surfaces as a raw 500 mid-render.
 */
function rethrowUnlessSessionFailure(error: unknown): never {
  if (!(error instanceof ApiClientError)) {
    throw error;
  }

  if (error.statusCode === 401) {
    redirect('/sign-in');
  }
  if (error.statusCode === 403) {
    redirect('/suspended');
  }

  throw error;
}

/** `null` when the vendor has not created a profile yet, which is not an error. */
export async function getOwnVendorProfile(): Promise<WireVendorProfile | null> {
  const token = await vendorToken();

  try {
    return await apiRequest('/vendor/profile', { schema: wireVendorProfileSchema, token });
  } catch (error) {
    if (!(error instanceof ApiClientError)) {
      throw error;
    }

    // No profile yet is the onboarding case, not a failure.
    if (error.statusCode === 404) {
      return null;
    }

    rethrowUnlessSessionFailure(error);
  }
}

/**
 * The vendor's service packages, portfolio, and calendar. Each answers 404
 * before the profile exists — the surfaces that call these redirect to profile
 * creation rather than rendering an empty manager for a business that has not
 * been described yet.
 */
export async function getOwnPackages(): Promise<WireServicePackage[]> {
  const token = await vendorToken();

  try {
    return await apiRequest('/vendor/packages', {
      schema: wireServicePackageListSchema,
      token,
    });
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return [];
    }
    rethrowUnlessSessionFailure(error);
  }
}

/** The vendor's own dashboard figures — recomputed server-side on every read. */
export async function getVendorDashboard(): Promise<WireVendorDashboard | null> {
  const token = await vendorToken();

  try {
    return await apiRequest('/vendor/dashboard', { schema: wireVendorDashboardSchema, token });
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return null;
    }
    rethrowUnlessSessionFailure(error);
  }
}

export async function getOwnPortfolio(): Promise<WirePortfolioItem[]> {
  const token = await vendorToken();

  try {
    return await apiRequest('/vendor/portfolio', { schema: wirePortfolioListSchema, token });
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return [];
    }
    rethrowUnlessSessionFailure(error);
  }
}

export async function getOwnAvailability(): Promise<WireAvailability[]> {
  const token = await vendorToken();

  try {
    return await apiRequest('/vendor/availability', {
      schema: wireAvailabilityListSchema,
      token,
    });
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return [];
    }
    rethrowUnlessSessionFailure(error);
  }
}

/**
 * How long the taxonomy and the tag vocabulary are cached on the server. Both
 * are public reference data that changes when ops edits it, and the header
 * needs the categories on every route — without this, putting the search bar
 * in the header would cost an API call per page view.
 */
const REFERENCE_DATA_REVALIDATE_SECONDS = 3600;

export interface ReferenceReadOptions {
  /**
   * Propagate an upstream failure instead of degrading to an empty list.
   *
   * For the few surfaces where an empty taxonomy is a trap rather than a
   * smaller page: the storefront editor cannot be completed without a
   * category, so an error boundary the vendor can retry is honest, while a
   * form whose category select is silently empty is not.
   */
  required?: boolean;
}

/**
 * Runs a reference read so that an upstream failure costs one section of the
 * page rather than the whole route.
 *
 * The blast radius is the reason: since the search bar moved into the header,
 * the taxonomy is read on **every** page, so one 500 on `/categories` took the
 * entire site down in production. Every failure mode degrades the same way —
 * an HTTP error, a body that is not JSON, a schema drift, and an API that is
 * not answering at all are all "this list is unavailable right now" to the
 * visitor, and none of them is a reason to withhold the rest of the page.
 */
async function degradeToEmpty<T>(read: () => Promise<T[]>, required?: boolean): Promise<T[]> {
  try {
    return await read();
  } catch (error) {
    if (required === true || isNavigationSignal(error)) {
      throw error;
    }

    return [];
  }
}

/** Public reference data; no session needed. */
export async function getCategories(options: ReferenceReadOptions = {}): Promise<Category[]> {
  return degradeToEmpty(
    () =>
      apiRequest('/categories', {
        schema: wireCategoryListSchema,
        revalidate: REFERENCE_DATA_REVALIDATE_SECONDS,
      }),
    options.required,
  );
}

export async function getActiveTags(options: ReferenceReadOptions = {}): Promise<WireTag[]> {
  return degradeToEmpty(
    () =>
      apiRequest('/tags', {
        schema: wireTagListSchema,
        revalidate: REFERENCE_DATA_REVALIDATE_SECONDS,
      }),
    options.required,
  );
}

/** One row of four on the landing page — see design/design-plan/10-landing.md. */
export const FEATURED_VENDOR_COUNT = 4;

/**
 * The vendors the landing page leads with: the best-reviewed published ones.
 *
 * Sorted by rating rather than curated, because "featured" on a marketplace
 * with no editorial team is otherwise a euphemism for "whichever four the
 * database returned first".
 *
 * A failure here yields an empty list rather than propagating: the front door
 * must still render its search bar when one section's data is unavailable, and
 * a marketplace with no published vendors yet is a normal state, not an error.
 */
export async function getFeaturedVendors(): Promise<WireVendorCard[]> {
  return degradeToEmpty(async () => {
    const result = await apiRequest(`/vendors?sort=rating&pageSize=${FEATURED_VENDOR_COUNT}`, {
      schema: wireVendorSearchResultSchema,
    });

    return result.items;
  });
}

/**
 * The public vendor profile — frame `03`. Unauthenticated, because the page
 * where the decision happens cannot sit behind a sign-up.
 *
 * `null` for a slug that is missing, unpublished or deleted: the API answers
 * 404 for all three, and the page turns that into `notFound()` so the visitor
 * gets the designed 404 with its category recovery rather than a raw error.
 * Any other failure propagates to the error boundary — a vendor page that
 * silently renders empty is worse than one that says it broke.
 */
export async function getPublicVendorProfile(
  slug: string,
): Promise<WirePublicVendorProfile | null> {
  try {
    return await apiRequest(`/vendors/${encodeURIComponent(slug)}`, {
      schema: wirePublicVendorProfileSchema,
    });
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return null;
    }

    throw error;
  }
}

/**
 * The vendor's calendar for the profile's Availability tab.
 *
 * An empty list is the honest answer to a failure here: the calendar's
 * convention is that a date with no row is free, so an empty list renders a
 * fully open month rather than a broken pane — and the tab is one of five, none
 * of the others depending on it. The profile read above is the one that must
 * propagate, because without it there is no page.
 */
export async function getPublicVendorAvailability(slug: string): Promise<WireAvailability[]> {
  try {
    return await apiRequest(`/vendors/${encodeURIComponent(slug)}/availability`, {
      schema: wireAvailabilityListSchema,
    });
  } catch (error) {
    if (error instanceof ApiClientError) {
      return [];
    }

    throw error;
  }
}
