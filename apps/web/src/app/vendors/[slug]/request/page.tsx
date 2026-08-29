import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  MAX_GUEST_COUNT,
  pageTitle,
  todayDateString,
  type AvailabilityStatus,
} from '@vendor-marketplace/shared';
import { BookingRequestScreen } from '@/components/booking/booking-request-screen';
import { requireCurrentUser } from '@/lib/current-user';
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
  if (!vendor) {
    notFound();
  }

  /*
   * A vendor cannot request their own listing, and has no customer identity to
   * do it with — sending them to their dashboard is more use than a 403 page.
   */
  /*
   * Signing in comes back here, with the package and date the customer already
   * chose in the rail — losing them meant starting the booking over.
   */
  const returnQuery = new URLSearchParams();
  if (query.package) returnQuery.set('package', query.package);
  if (query.date) returnQuery.set('date', query.date);
  if (query.guests) returnQuery.set('guests', query.guests);
  const returnSuffix = returnQuery.toString();

  const user = await requireCurrentUser(
    `/vendors/${slug}/request${returnSuffix ? `?${returnSuffix}` : ''}`,
  );
  if (user.role === 'vendor') {
    redirect('/vendor/dashboard');
  }

  const today = todayDateString();
  const availability = await getPublicVendorAvailability(slug);

  const calendar: Record<string, AvailabilityStatus> = {};
  for (const entry of availability) {
    calendar[entry.date] = entry.status;
  }

  const selected =
    vendor.packages.find((servicePackage) => servicePackage.id === query.package) ?? null;

  const initialDate = query.date && query.date >= today ? query.date : '';

  /*
   * `?guests=` arrives from the profile rail and is attacker-controlled like
   * every other URL value: parsed here, and dropped rather than rendered if it
   * is not a whole number inside the same bounds the form itself enforces.
   */
  const parsedGuests = Number.parseInt(query.guests ?? '', 10);
  const initialGuestCount =
    Number.isInteger(parsedGuests) &&
    String(parsedGuests) === query.guests &&
    parsedGuests > 0 &&
    parsedGuests <= MAX_GUEST_COUNT
      ? String(parsedGuests)
      : '';

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
      today={today}
    />
  );
}
