import 'server-only';
import { notFound, permanentRedirect } from 'next/navigation';
import { requestedPath, requestedPathname } from './requested-path';
import { getPublicVendorProfile, getVendorSlugSuccessor } from './vendor-data';

/** The three choices a booking link carries through a slug change (VEN-648). */
const REQUEST_QUERY_KEYS = ['package', 'date', 'guests'] as const;

/**
 * Where a slug the vendor has since changed now lives: the same page under the
 * new slug. The request form keeps the customer's package, date and guest
 * count; the profile keeps nothing, as it never did.
 */
export function successorPath(
  current: string,
  onRequestPage: boolean,
  from: string | null,
): string {
  if (!onRequestPage) {
    return `/vendors/${current}`;
  }

  const kept = new URLSearchParams();
  const query = new URLSearchParams(from?.split('?', 2)[1] ?? '');

  for (const key of REQUEST_QUERY_KEYS) {
    const value = query.get(key);

    if (value) {
      kept.set(key, value);
    }
  }

  const suffix = kept.toString();

  return `/vendors/${current}/request${suffix ? `?${suffix}` : ''}`;
}

/**
 * The vendor routes' status decisions, made in a layout so they can still be a
 * status (VEN-715): a loading boundary streams, and a `notFound()` or
 * `permanentRedirect()` inside one goes out under HTTP 200.
 *
 * Missing, unpublished and deleted all arrive as `null` and all get the
 * designed 404; a slug the vendor gave up is a 308 to its successor. The page
 * reads the vendor back through `getPublicVendorProfile`'s `cache()`, so the
 * layout's read is the only one. A layout has no `searchParams`, so the
 * destination comes from the path the middleware stamped.
 */
export async function gateVendorSlug(slug: string): Promise<void> {
  if ((await getPublicVendorProfile(slug)) !== null) {
    return;
  }

  const current = await getVendorSlugSuccessor(slug);

  if (current !== null) {
    permanentRedirect(
      successorPath(
        current,
        (await requestedPathname())?.endsWith('/request') ?? false,
        await requestedPath(),
      ),
    );
  }

  notFound();
}
