import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BRAND_DOMAIN, BRAND_NAME, pageTitle, todayDateString } from '@vendor-marketplace/shared';
import { AboutPane } from '@/components/vendors/profile/about-pane';
import { AvailabilityPane } from '@/components/vendors/profile/availability-pane';
import { BookingRail } from '@/components/vendors/profile/booking-rail';
import { PackagesPane } from '@/components/vendors/profile/packages-pane';
import { PortfolioPane } from '@/components/vendors/profile/portfolio-pane';
import { ProfileHeader } from '@/components/vendors/profile/profile-header';
import { ProfileTabs } from '@/components/vendors/profile/profile-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { getPublicVendorAvailability, getPublicVendorProfile } from '@/lib/vendor-data';

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
  const vendor = await getPublicVendorProfile(slug);

  /*
   * Missing, unpublished and deleted all arrive here as `null`, and all three
   * get the designed 404 with its category recovery — a visitor's next step is
   * the same in every case.
   */
  if (!vendor) {
    notFound();
  }

  const availability = await getPublicVendorAvailability(slug);
  const today = todayDateString();

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
    url: `https://${BRAND_DOMAIN}/vendors/${vendor.slug}`,
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
        avgRating={vendor.avgRating}
        reviewCount={vendor.reviewCount}
        city={vendor.city}
        state={vendor.state}
        categories={vendor.categories}
        tags={vendor.tags}
      />

      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <div className="min-w-0">
          <ProfileTabs
            panes={{
              about: (
                <AboutPane
                  bio={vendor.bio}
                  completedEventCount={vendor.completedEventCount}
                  serviceRadiusKm={vendor.serviceRadiusKm}
                  responseTimeHours={vendor.responseTimeHours}
                  portfolio={vendor.portfolio}
                  onSeeAllHref={`/vendors/${vendor.slug}?tab=portfolio`}
                />
              ),
              packages: (
                <PackagesPane packages={vendor.packages} businessName={vendor.businessName} />
              ),
              portfolio: (
                <PortfolioPane items={vendor.portfolio} businessName={vendor.businessName} />
              ),
              reviews: (
                /* The tab and its empty state only — review content is #12. */
                <EmptyState
                  headline={vendor.reviewCount > 0 ? 'Reviews are on their way' : 'No reviews yet'}
                  description={
                    vendor.reviewCount > 0
                      ? `${vendor.businessName} has ${vendor.reviewCount} reviews. We're building the page that shows them.`
                      : `Every review here comes from a completed booking, so ${vendor.businessName} has none until they've worked an event.`
                  }
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
        </div>

        {/*
          Sticky through the whole page, offset by the header so it never slides
          under it. `self-start` is what stops the grid stretching the rail to
          the row height, which would make `sticky` a no-op.
        */}
        <div className="lg:sticky lg:top-[calc(var(--header-height)+16px)] lg:self-start">
          <BookingRail
            businessName={vendor.businessName}
            slug={vendor.slug}
            startingPriceCents={vendor.startingPriceCents}
            packages={vendor.packages}
            reviewCount={vendor.reviewCount}
          />
        </div>
      </div>
    </>
  );
}
