import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  addDays,
  BRAND_NAME,
  pageTitle,
  parseDateString,
  toDateString,
  todayDateString,
  type AvailabilityStatus,
} from '@vendor-marketplace/shared';
import { AboutPane } from '@/components/vendors/profile/about-pane';
import { AvailabilityPane } from '@/components/vendors/profile/availability-pane';
import { BookingRail } from '@/components/vendors/profile/booking-rail';
import { PackagesPane } from '@/components/vendors/profile/packages-pane';
import { PortfolioPane } from '@/components/vendors/profile/portfolio-pane';
import { ProfileHeader } from '@/components/vendors/profile/profile-header';
import { ProfileTabs } from '@/components/vendors/profile/profile-tabs';
import { ReviewsPane } from '@/components/vendors/profile/reviews-pane';
import { siteOrigin } from '@/config/env';
import {
  getPublicVendorAvailability,
  getPublicVendorProfile,
  getPublicVendorReviews,
} from '@/lib/vendor-data';

/**
 * How far ahead the header chip looks for a free day.
 *
 * The chip is a fact about the vendor, not a promise about the year: a vendor
 * blocked solid for three months has nothing useful to say in a chip, and
 * saying nothing is the designed state — frame `03` draws the chip beside the
 * category chips, where an absent one simply closes the gap.
 */
const FREE_DATE_HORIZON_DAYS = 90;

/*
 * `Jun 14`, matching the vendor's card in search exactly — the header IS that
 * card unpacked, and the chip is the one element that persists between the two
 * surfaces, so a different month format would break the resemblance the whole
 * composition is built on. UTC because a calendar date is a `DATE` column and
 * must not be re-read in the viewer's zone.
 */
const FREE_CHIP_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * The nearest day this vendor is free, as the chip draws it, or null.
 *
 * Read from the same calendar the booking rail reads, so the header and the
 * rail cannot contradict each other. A date the calendar does not mention is
 * available — the endpoint returns only the days a vendor has marked.
 */
function nearestFreeDate(
  calendar: Readonly<Record<string, AvailabilityStatus>>,
  today: string,
): string | null {
  const start = parseDateString(today);
  if (start === null) {
    return null;
  }

  for (let offset = 0; offset < FREE_DATE_HORIZON_DAYS; offset += 1) {
    const date = toDateString(addDays(start, offset));

    if ((calendar[date] ?? 'available') === 'available') {
      return FREE_CHIP_FORMATTER.format(new Date(`${date}T00:00:00Z`));
    }
  }

  return null;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * The public vendor profile — frame `03`, the page where the decision happens.
 *
 * Every search result, every featured card on the landing page and the
 * storefront editor's Preview button lands here.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  /*
    This read is **deliberately not guarded against a timeout** (#390).

    Next runs `generateMetadata` in a separate React cache scope from the page
    component, and after it, so the `cache()` on this read does not dedupe
    between the two and each spends its own `API_REQUEST_TIMEOUT_MS`. Against
    a suspended API the route therefore answers in ~16s rather than ~8s —
    twice the deadline, and the one part of this ticket's second acceptance
    line still outstanding. It is recorded here rather than hidden because
    this is the only place that can see it.

    Catching the timeout here was tried and reverted: it does not save the
    second deadline (the read still runs), and the neutral title it falls back
    to is `Page not found`, which measurably labelled a **500** response as a
    missing page. A wedged upstream is not a 404, and telling a visitor and a
    crawler that it is, is worse than an unhelpful title. The fix that would
    actually close the gap is to stop reading the profile here at all — a
    title derived from the slug — which is a change to what this page tells
    crawlers, not a change to its timeout behaviour.
  */
  const vendor = await getPublicVendorProfile(slug);

  if (!vendor) {
    // The 404 page supplies its own title; anything invented here would be
    // indexed against a page that does not exist.
    return { title: pageTitle('Page not found') };
  }

  const location = [vendor.city, vendor.state].filter(Boolean).join(', ');
  const description =
    vendor.bio?.slice(0, 160) ??
    `Book ${vendor.businessName}${location ? ` in ${location}` : ''} on ${BRAND_NAME}.`;

  return {
    title: pageTitle(vendor.businessName),
    description,
    alternates: { canonical: `/vendors/${vendor.slug}` },
    openGraph: {
      type: 'profile',
      siteName: BRAND_NAME,
      url: `/vendors/${vendor.slug}`,
      title: vendor.businessName,
      description,
      ...(vendor.coverImageUrl ? { images: [{ url: vendor.coverImageUrl }] } : {}),
    },
  };
}

export default async function VendorProfilePage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { slug } = await params;

  /*
    One wave, not two (#390).

    These used to run as the profile, and then — once it had landed — these
    other two. Each wave is bounded by `API_REQUEST_TIMEOUT_MS`, so against a
    wedged upstream the route spent two full deadlines in series: measured at
    16.1s for an 8s timeout, which is not "the timeout plus a margin" by any
    reading. Neither of the other two needs anything from the profile; both
    take only the slug, which is in hand on the line above. Issuing all three
    together makes the page's worst case one deadline rather than the sum of
    two.

    `Promise.all` rather than starting them and awaiting later, because
    `notFound()` below throws: a read still in flight at that point would
    reject with nobody listening. Awaiting all three first means every
    rejection has a handler, and the 404 costs two reads whose results are
    discarded — a page nobody can see is not worth a second round trip to
    optimise.
  */
  const [vendor, availability, reviews] = await Promise.all([
    getPublicVendorProfile(slug),
    getPublicVendorAvailability(slug),
    getPublicVendorReviews(slug),
  ]);

  /*
   * Missing, unpublished and deleted all arrive here as `null`, and all three
   * get the designed 404 with its category recovery — a visitor's next step is
   * the same in every case.
   */
  if (!vendor) {
    notFound();
  }
  const today = todayDateString();

  /* The same keyed view of availability the request form takes, so the rail's
     free-date line and that form read one source. */
  const calendar: Record<string, AvailabilityStatus> = {};
  for (const entry of availability) {
    calendar[entry.date] = entry.status;
  }

  /**
   * `LocalBusiness` rather than `Organization`, matching the landing page: a
   * vendor serves a metro, and the search result that matters is a local one.
   * The rating is only claimed when there is one — a review-less vendor with an
   * `aggregateRating` of 0 is a lie search engines will repeat.
   */
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: vendor.businessName,
    // The origin this deployment answers on — structured data a crawler
    // follows must not point at a domain that does not serve this app.
    url: `${siteOrigin()}/vendors/${vendor.slug}`,
    ...(vendor.bio ? { description: vendor.bio } : {}),
    ...(vendor.profileImageUrl ? { image: vendor.profileImageUrl } : {}),
    ...(vendor.city
      ? {
          address: {
            '@type': 'PostalAddress',
            addressLocality: vendor.city,
            ...(vendor.state ? { addressRegion: vendor.state } : {}),
          },
        }
      : {}),
    ...(vendor.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: vendor.avgRating,
            reviewCount: vendor.reviewCount,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Serialised from values this page just read, so there is no untrusted
        // markup in it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <ProfileHeader
        businessName={vendor.businessName}
        coverImageUrl={vendor.coverImageUrl}
        profileImageUrl={vendor.profileImageUrl}
        tagline={vendor.tagline}
        avgRating={vendor.avgRating}
        reviewCount={vendor.reviewCount}
        city={vendor.city}
        state={vendor.state}
        freeOn={nearestFreeDate(calendar, today)}
        categories={vendor.categories}
        tags={vendor.tags}
        rail={
          <BookingRail
            businessName={vendor.businessName}
            slug={vendor.slug}
            startingPriceCents={vendor.startingPriceCents}
            packages={vendor.packages}
            reviewCount={vendor.reviewCount}
            today={today}
            calendar={calendar}
          />
        }
      >
        <ProfileTabs
          panes={{
            about: (
              <AboutPane
                bio={vendor.bio}
                yearsInBusiness={vendor.yearsInBusiness}
                completedEventCount={vendor.completedEventCount}
                serviceRadiusKm={vendor.serviceRadiusKm}
                packages={vendor.packages}
                onSeePackagesHref={`/vendors/${vendor.slug}?tab=packages`}
              />
            ),
            packages: (
              <PackagesPane packages={vendor.packages} businessName={vendor.businessName} />
            ),
            portfolio: (
              <PortfolioPane items={vendor.portfolio} businessName={vendor.businessName} />
            ),
            reviews: (
              <ReviewsPane
                slug={vendor.slug}
                businessName={vendor.businessName}
                /* From the profile read, so the pane can tell "none" from
                   "we couldn't load them" when its own read fails. */
                reviewCount={vendor.reviewCount}
                initial={reviews}
              />
            ),
            availability: (
              <AvailabilityPane
                entries={availability}
                today={today}
                businessName={vendor.businessName}
              />
            ),
          }}
        />
      </ProfileHeader>
    </>
  );
}
