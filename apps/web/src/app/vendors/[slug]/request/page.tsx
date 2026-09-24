import type { Metadata } from 'next';
import {
  isUniversallyPastDate,
  pageTitle,
  parseDateString,
  toDateString,
  type AvailabilityStatus,
} from '@vendor-marketplace/shared';
import { BookingRequestScreen } from '@/components/booking/booking-request-screen';
import { parseGuestCountParam } from '@/lib/guest-count';
import { getPublicVendorAvailability, getPublicVendorProfile } from '@/lib/vendor-data';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ package?: string; date?: string; guests?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await getPublicVendorProfile(slug);

  return {
    title: pageTitle(vendor ? `Request ${vendor.businessName}` : 'Page not found'),
    // A request form is a private, single-vendor action: nothing to index.
    robots: { index: false, follow: false },
  };
}

/**
 * Frame `04` — the booking request, as a page rather than a modal so the
 * vendor, the package and the total stay in the rail while the form is filled.
 *
 * The package and the date arrive in the query string from wherever the
 * customer clicked: the profile rail, or a search whose date they already
 * chose. Neither is trusted — the package is matched against this vendor's own
 * active list, and the date is dropped if it is in the past.
 */
export default async function BookingRequestPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  const vendor = await getPublicVendorProfile(slug);

  /*
   * The 404, the 308 for a renamed slug and the customer gate are answered by
   * `layout.tsx` beside this file, above the loading boundary (VEN-715), so a
   * `null` here can only be a bug.
   */
  if (!vendor) {
    throw new Error('Vendor vanished between its layout and its page');
  }

  /*
   * The server's UTC day. It is only a seed: `BookingRequestScreen` re-anchors
   * the picker's floor on the customer's own day after mount, because this
   * component has no way to know it. #409.
   */
  const serverToday = toDateString(new Date());
  const availability = await getPublicVendorAvailability(slug);

  const calendar: Record<string, AvailabilityStatus> = {};
  for (const entry of availability) {
    calendar[entry.date] = entry.status;
  }

  const selected =
    vendor.packages.find((servicePackage) => servicePackage.id === query.package) ?? null;

  /*
   * A date carried in from search or the profile rail.
   *
   * **Shape first, then meaning** — `web-route-boundaries.md`. The floor used
   * to be `query.date >= today`, a string compare that dropped a malformed
   * value by accident; `isUniversallyPastDate` answers `false` for anything it
   * cannot parse, so on its own it would seed the form from a crafted link with
   * whatever the URL carried. `parseDateString` is the boundary guard and the
   * semantic one runs behind it.
   *
   * Past for **everyone**, not past for this server — the same rule the API
   * applies — because a customer west of UTC picking their own today would
   * otherwise have it silently dropped on the way to the form they picked it
   * for. #409.
   */
  const initialDate =
    query.date && parseDateString(query.date) !== null && !isUniversallyPastDate(query.date)
      ? query.date
      : '';

  /*
   * `?guests=` arrives from the profile rail and is attacker-controlled like
   * every other URL value: parsed at the boundary, and dropped rather than
   * rendered when it is not a whole number inside the bounds the form enforces.
   */
  const initialGuestCount = parseGuestCountParam(query.guests);

  const leadCategory = vendor.categories[0]?.name ?? null;

  return (
    <BookingRequestScreen
      vendorId={vendor.id}
      vendorSlug={vendor.slug}
      vendor={{
        businessName: vendor.businessName,
        avatarUrl: vendor.profileImageUrl,
        avgRating: vendor.avgRating,
        reviewCount: vendor.reviewCount,
        categoryName: leadCategory,
      }}
      responseTimeHours={vendor.responseTimeHours}
      servicePackage={
        selected
          ? {
              id: selected.id,
              name: selected.name,
              priceCents: selected.priceCents,
              inclusions: selected.inclusions,
              durationHours: selected.durationHours,
              maxGuests: selected.maxGuests,
            }
          : null
      }
      calendar={calendar}
      initialDate={initialDate}
      initialGuestCount={initialGuestCount}
      serverToday={serverToday}
    />
  );
}
