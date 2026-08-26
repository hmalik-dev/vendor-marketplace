import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { Category } from '@vendorhub/shared';
import { ApiClientError, apiRequest } from './api-client';
import {
  wireCategoryListSchema,
  wireTagListSchema,
  wireVendorProfileSchema,
  type WireTag,
  type WireVendorProfile,
} from './wire-schemas';

/**
 * Server-side reads for the vendor profile surfaces. Server Components only —
 * each one resolves the Clerk session on the server, so no token ever reaches
 * the browser.
 */

/** `null` when the vendor has not created a profile yet, which is not an error. */
export async function getOwnVendorProfile(): Promise<WireVendorProfile | null> {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    redirect('/sign-in');
  }

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

    /*
     * A session that expires between the layout's auth check and this call
     * would otherwise surface as a raw 500. Answer it the way every other
     * protected read does instead.
     */
    if (error.statusCode === 401) {
      redirect('/sign-in');
    }
    if (error.statusCode === 403) {
      redirect('/suspended');
    }

    throw error;
  }
}

/** Public reference data; no session needed. */
export async function getCategories(): Promise<Category[]> {
  return apiRequest('/categories', { schema: wireCategoryListSchema });
}

export async function getActiveTags(): Promise<WireTag[]> {
  return apiRequest('/tags', { schema: wireTagListSchema });
}
