import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { Category } from '@vendor-marketplace/shared';
import { ApiClientError, apiRequest } from './api-client';
import {
  wireAvailabilityListSchema,
  wireCategoryListSchema,
  wirePortfolioListSchema,
  wireServicePackageListSchema,
  wireTagListSchema,
  wireVendorProfileSchema,
  type WireAvailability,
  type WirePortfolioItem,
  type WireServicePackage,
  type WireTag,
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

/** Public reference data; no session needed. */
export async function getCategories(): Promise<Category[]> {
  return apiRequest('/categories', { schema: wireCategoryListSchema });
}

export async function getActiveTags(): Promise<WireTag[]> {
  return apiRequest('/tags', { schema: wireTagListSchema });
}
