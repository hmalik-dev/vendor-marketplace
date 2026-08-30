import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { slugSchema, type Category } from '@vendor-marketplace/shared';
import { ApiClientError, apiRequest } from './api-client';
import { isNavigationSignal } from './navigation-signal';
import { signInPathReturningHere } from './requested-path';
import {
  wireAvailabilityListSchema,
  wireCategoryListSchema,
  wirePortfolioListSchema,
  wireServicePackageListSchema,
  wireTagListSchema,
  wirePublicVendorProfileSchema,
  wireVendorDashboardSchema,
  wireVendorCityListSchema,
  wireVendorReviewsPageSchema,
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
  type WireVendorCity,
  type WireVendorReviewsPage,
  type WireVendorPayoutStatus,
  wireVendorPayoutStatusSchema,
} from './wire-schemas';

/**
 * Server-side reads for the vendor profile surfaces. Server Components only —
 * each one resolves the Clerk session on the server, so no token ever reaches
 * the browser.
 */

interface VendorSession {
  /** The Clerk session token for a vendor read. */
  token: string;
  /** Where to send this reader if the session turns out not to work. */
  signInPath: string;
}

/**
 * The session a vendor read needs, or a redirect to sign-in.
 *
 * The sign-in path is resolved here rather than at the point of failure so
 * that `rethrowUnlessSessionFailure` can stay synchronous: TypeScript only
 * treats a call as terminating control flow when the callee is declared
 * `never`, and an `await`ed `Promise<never>` does not qualify — every caller
 * would fall through to a missing return.
 */
async function vendorSession(): Promise<VendorSession> {
  const signInPath = await signInPathReturningHere();
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    redirect(signInPath);
  }

  return { token, signInPath };
}

/**
 * Turns the two session failures every protected read shares into the same
 * redirects, so an expired session never surfaces as a raw 500 mid-render.
 */
function rethrowUnlessSessionFailure(error: unknown, signInPath: string): never {
  if (!(error instanceof ApiClientError)) {
    throw error;
  }

  if (error.statusCode === 401) {
    redirect(signInPath);
  }
  if (error.statusCode === 403) {
    redirect('/suspended');
  }

  throw error;
}

/** `null` when the vendor has not created a profile yet, which is not an error. */
export async function getOwnVendorProfile(): Promise<WireVendorProfile | null> {
  const { token, signInPath } = await vendorSession();

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

    rethrowUnlessSessionFailure(error, signInPath);
  }
}

/**
 * The vendor's service packages, portfolio, and calendar. Each answers 404
 * before the profile exists — the surfaces that call these redirect to profile
 * creation rather than rendering an empty manager for a business that has not
 * been described yet.
 */
export async function getOwnPackages(): Promise<WireServicePackage[]> {
  const { token, signInPath } = await vendorSession();

  try {
    return await apiRequest('/vendor/packages', {
      schema: wireServicePackageListSchema,
      token,
    });
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return [];
    }
    rethrowUnlessSessionFailure(error, signInPath);
  }
}

/** The vendor's own dashboard figures — recomputed server-side on every read. */
export async function getVendorDashboard(): Promise<WireVendorDashboard | null> {
  const { token, signInPath } = await vendorSession();

  try {
    return await apiRequest('/vendor/dashboard', { schema: wireVendorDashboardSchema, token });
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return null;
    }
    rethrowUnlessSessionFailure(error, signInPath);
  }
}

export async function getOwnPortfolio(): Promise<WirePortfolioItem[]> {
  const { token, signInPath } = await vendorSession();

  try {
    return await apiRequest('/vendor/portfolio', { schema: wirePortfolioListSchema, token });
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return [];
    }
    rethrowUnlessSessionFailure(error, signInPath);
  }
}

export async function getOwnAvailability(): Promise<WireAvailability[]> {
  const { token, signInPath } = await vendorSession();

  try {
    return await apiRequest('/vendor/availability', {
      schema: wireAvailabilityListSchema,
      token,
    });
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return [];
    }
    rethrowUnlessSessionFailure(error, signInPath);
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
  /**
   * Read past the shared cache, for a surface whose **ids are posted back**.
   *
   * A cached id outlives the reference data it came from: after a reseed the
   * editor kept offering ids the API no longer had, for up to an hour and
   * across a hard reload, and every save was refused with "One or more
   * selected categories are unavailable." (#222). A page that only *displays*
   * the taxonomy is unharmed by a stale copy and keeps the cache; a page whose
   * selection is submitted cannot.
   */
  fresh?: boolean;
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

/**
 * `apiRequest` treats an omitted `revalidate` as `cache: 'no-store'`, so this
 * is what a fresh read looks like: the option is left out entirely rather than
 * sent as `0`, which Next would pair with `cache` and then ignore.
 */
function referenceCaching(fresh?: boolean): { revalidate?: number } {
  return fresh === true ? {} : { revalidate: REFERENCE_DATA_REVALIDATE_SECONDS };
}

/** Public reference data; no session needed. */
export async function getCategories(options: ReferenceReadOptions = {}): Promise<Category[]> {
  return degradeToEmpty(
    () =>
      apiRequest('/categories', {
        schema: wireCategoryListSchema,
        ...referenceCaching(options.fresh),
      }),
    options.required,
  );
}

export async function getActiveTags(options: ReferenceReadOptions = {}): Promise<WireTag[]> {
  return degradeToEmpty(
    () =>
      apiRequest('/tags', {
        schema: wireTagListSchema,
        ...referenceCaching(options.fresh),
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
 *
 * **A path segment that is not a slug gets the same answer, without a request.**
 * `/vendors/JUNE-HARLOW`, `/vendors/%00`, a 300-character string: none of them
 * can name a vendor, so an identifier that cannot exist is a 404 rather than
 * the 500 that rethrowing produced. Asking first is what makes that true for
 * every rejection and not just the ones worth enumerating — the API answers an
 * over-long slug with **414**, not the 400 its schema gives a malformed one,
 * and a status list would have missed it. The decision belongs here rather
 * than in the page, so every caller gets it.
 */
export async function getPublicVendorProfile(
  slug: string,
): Promise<WirePublicVendorProfile | null> {
  if (!slugSchema.safeParse(slug).success) {
    return null;
  }

  try {
    return await apiRequest(`/vendors/${encodeURIComponent(slug)}`, {
      schema: wirePublicVendorProfileSchema,
    });
  } catch (error) {
    // A well-formed slug the API still refuses: it names nothing either.
    if (error instanceof ApiClientError && (error.statusCode === 404 || error.statusCode === 400)) {
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

/**
 * The cities that have vendors, for the search bar's City field.
 *
 * Public reference data, like the taxonomy: it changes when a vendor publishes
 * rather than per request, and every visitor gets the same answer — so it is
 * cached on the same hour the categories are. An empty list is the honest
 * degradation: the field then offers "Anywhere" and nothing else, which is
 * true of a marketplace whose vendors have not said where they work.
 */
export async function getVendorCities(): Promise<WireVendorCity[]> {
  try {
    return await apiRequest('/vendors/cities', {
      schema: wireVendorCityListSchema,
      revalidate: REFERENCE_DATA_REVALIDATE_SECONDS,
    });
  } catch (error) {
    if (error instanceof ApiClientError || error instanceof TypeError) {
      return [];
    }

    throw error;
  }
}

/**
 * The first page of the profile's Reviews tab, plus its summary and what this
 * reader may do there.
 *
 * The session is read but never required. The tab is public, and the API
 * resolves the `viewer` block from whoever is asking — so a signed-in customer
 * is offered "Write a review" on the first paint rather than after a second
 * round trip, and a signed-out one gets the same reviews with no offer.
 *
 * **This is the only one of the three public-profile reads that presents a
 * token**, which makes it the only one a refused token can fail. The API's
 * auth hook answers 401 or 403 on *any* route when a presented token does not
 * verify or belongs to a suspended account, public routes included — so without
 * the retry below, one stale session turned a vendor with 127 reviews into a
 * tab that said they had never worked an event. The reviews themselves need no
 * session; only the `viewer` block does, and losing that costs a reader nothing
 * but the offer to write one.
 *
 * Anything else returns `null`, and the pane says the reviews are on their way
 * rather than that there are none — the vendor's own count is what tells those
 * two apart, and it comes from a different read.
 */
export async function getPublicVendorReviews(slug: string): Promise<WireVendorReviewsPage | null> {
  if (!slugSchema.safeParse(slug).success) {
    return null;
  }

  const { getToken } = await auth();
  const token = await getToken();

  const read = async (bearer: string | null): Promise<WireVendorReviewsPage> =>
    apiRequest(`/vendors/${encodeURIComponent(slug)}/reviews`, {
      schema: wireVendorReviewsPageSchema,
      token: bearer,
    });

  try {
    return await read(token);
  } catch (error) {
    if (!(error instanceof ApiClientError)) {
      throw error;
    }

    if (token && (error.statusCode === 401 || error.statusCode === 403)) {
      try {
        return await read(null);
      } catch (retry) {
        if (retry instanceof ApiClientError) {
          return null;
        }

        throw retry;
      }
    }

    return null;
  }
}

/**
 * The vendor's payout state, read on every dashboard render.
 *
 * The API answers this from its own row rather than from Stripe, so this is a
 * cheap read — see `readPayoutStatus`. A vendor with no profile yet has no
 * payout state either, and that is the onboarding case rather than a failure.
 */
export async function getPayoutStatus(): Promise<WireVendorPayoutStatus | null> {
  const { token, signInPath } = await vendorSession();

  try {
    return await apiRequest('/vendor/stripe/status', {
      schema: wireVendorPayoutStatusSchema,
      token,
    });
  } catch (error) {
    if (!(error instanceof ApiClientError)) {
      throw error;
    }

    if (error.statusCode === 404) {
      return null;
    }

    rethrowUnlessSessionFailure(error, signInPath);
  }
}
