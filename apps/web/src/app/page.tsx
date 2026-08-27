import type { Metadata } from 'next';
import Link from 'next/link';
import { Show } from '@clerk/nextjs';
import {
  BRAND_DOMAIN,
  BRAND_NAME,
  CATEGORY_SEEDS,
  LANDING_CATEGORY_COUNT,
  LANDING_JUMP_CATEGORY_SLUGS,
  type Category,
} from '@vendor-marketplace/shared';
import { ShieldCheck, Star, Tag } from 'lucide-react';
import { HeroSearch } from '@/components/landing/hero-search';
import { PhotoCluster } from '@/components/landing/photo-cluster';
import { Button } from '@/components/ui/button';
import { StockPhoto } from '@/components/ui/stock-photo';
import { VendorCard } from '@/components/vendors/vendor-card';
import { redirectVendorToDashboard } from '@/lib/current-user';
import { getCategories, getFeaturedVendors } from '@/lib/vendor-data';

/**
 * The one market that is live. It is a fact about the business rather than a
 * measurement, so unlike a vendor count it can be stated on day one — and it
 * is what makes "Now booking in Austin" true. A city picker replaces it once
 * there is a second market (design/design-plan/98-post-mvp.md).
 */
const LAUNCH_CITY = 'Austin';
const LAUNCH_REGION = 'TX';

/**
 * The frame is drawn at 1440 with a 40px gutter and no inner max-width — the
 * category row spans the whole page. The cap keeps the six cards from
 * stretching on an ultrawide display without inventing a margin at 1440.
 */
const CONTAINER = 'mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-10';

/** The blurb each landing card carries, by slug. Copy, so it lives in shared. */
const SHORT_DESCRIPTIONS = new Map(
  CATEGORY_SEEDS.map((seed) => [seed.slug, seed.shortDescription]),
);

const JUMP_CATEGORY_NAMES = LANDING_JUMP_CATEGORY_SLUGS.map(
  (slug) => CATEGORY_SEEDS.find((seed) => seed.slug === slug)?.name ?? slug,
);

/**
 * Three steps, one line each. The verbs are what the customer does, not what
 * the platform does — "Discover", not "Search our network".
 */
const HOW_IT_WORKS = [
  {
    title: 'Discover',
    body: 'Pick a vendor type, a city and your date. Every profile shows what they charge and which dates are still open.',
  },
  {
    title: 'Book',
    body: 'Send one request with your details. The vendor confirms, or sends a revised quote you approve first.',
  },
  {
    title: 'Celebrate',
    body: 'Pay once the date is locked in. Your payment is held until the event is done, then released.',
  },
] as const;

/**
 * Mechanism, never adjective: "payment held by Stripe until the event", not
 * "secure and reliable". This section does the work the stats band would have
 * done, which is why there is no stats band.
 */
const TRUST_SIGNALS = [
  {
    icon: Star,
    title: 'Reviews from real bookings',
    body: 'Every review comes from a booking that actually happened. There is no other way to leave one.',
  },
  {
    icon: ShieldCheck,
    title: 'Payment held until the event',
    body: 'Stripe holds your payment until your event is complete, then releases it to the vendor.',
  },
  {
    icon: Tag,
    title: 'No service fee',
    body: 'Vendors publish what they charge, and nothing is added on top of it at checkout.',
  },
] as const;

const DESCRIPTION = `Compare real availability and pricing from event vendors near you, send one request, and pay securely once the date is locked in. Now booking in ${LAUNCH_CITY}.`;

const CANONICAL_ORIGIN = `https://${BRAND_DOMAIN}`;

/**
 * The share-card headline. It has room for a sentence; a browser tab does not,
 * which is why the two are different strings rather than one reused three
 * times. Written once here for the same reason `brand.ts` holds the name once.
 */
const SOCIAL_TITLE = `${BRAND_NAME} — book event vendors without the back-and-forth`;

/**
 * The tab. Brand first, because a tab truncates from the right at roughly
 * fifteen characters and a pinned tab shows the favicon alone — so the half
 * that survives has to be the half that identifies the product.
 */
const TAB_TITLE = `${BRAND_NAME} · Book event vendors`;

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_ORIGIN),
  title: { absolute: TAB_TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: BRAND_NAME,
    url: '/',
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
  },
};

/**
 * `LocalBusiness` rather than `Organization`: the product serves one metro and
 * the search result that matters is a local one. `areaServed` names the market
 * that is actually live, so it stays true as markets are added rather than
 * claiming national coverage on day one.
 */
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: BRAND_NAME,
  description: DESCRIPTION,
  url: CANONICAL_ORIGIN,
  areaServed: {
    '@type': 'City',
    name: LAUNCH_CITY,
    containedInPlace: { '@type': 'State', name: LAUNCH_REGION },
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${CANONICAL_ORIGIN}/search?category={category}`,
    },
    'query-input': 'required name=category',
  },
} as const;

/** "Browse by category" leads with the first six; the rest live on search. */
function landingCategories(categories: readonly Category[]): Category[] {
  return [...categories]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, LANDING_CATEGORY_COUNT);
}

export default async function HomePage(): Promise<React.ReactElement> {
  await redirectVendorToDashboard();

  const [categories, featuredVendors] = await Promise.all([getCategories(), getFeaturedVendors()]);
  const featured = landingCategories(categories);

  return (
    <>
      <script
        type="application/ld+json"
        // Serialised from a literal above, so there is no untrusted input in it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />

      {/* Full-bleed so the gradient runs edge to edge behind the headline. */}
      <section className="hero-gradient relative overflow-hidden">
        {/* One blob per page. It is the only atmospheric shape in the product. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-27.5 -right-32.5 size-110 rounded-full bg-clay-400/6"
        />

        <div className={`${CONTAINER} relative`}>
          <div className="grid pt-10 lg:grid-cols-[56%_44%]">
            <div className="lg:pr-8.5">
              <p className="mb-4.5 inline-flex items-center gap-1.75 rounded-full bg-clay-400/10 px-3 py-1.5 text-xs font-semibold text-clay-600">
                <span aria-hidden="true" className="size-1.25 rounded-full bg-clay-400" />
                Now booking in {LAUNCH_CITY}
              </p>

              {/*
                The product's one flourish: a plain first line in ink over an
                italic second line in clay carrying the promise. It repeats
                nowhere else — design/design-plan/31-content-voice.md.
              */}
              <h1 className="font-display text-display-lg leading-[1.04] tracking-[-.02em] text-stone-900 sm:text-display-xl">
                Book your vendors
                <br />
                <span className="text-clay-500 italic">without the back-and-forth.</span>
              </h1>

              <p className="mt-3.75 max-w-112.5 text-lg text-stone-700">
                Compare real availability and pricing from vendors near you, send one request, and
                pay securely once the date is locked in.
              </p>

              <HeroSearch categories={categories} />

              {/*
                The shortcut past the bar for a visitor who already knows what
                they need. Plain links, so they work before hydration and can
                be opened in a new tab — the bar is the only part that needs a
                client boundary.
              */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-0.5 text-sm text-stone-600">Or jump straight to</span>
                {LANDING_JUMP_CATEGORY_SLUGS.map((slug, index) => (
                  <Link
                    key={slug}
                    href={`/search?category=${slug}`}
                    className="rounded-full border border-stone-300 bg-stone-0 px-3 py-1.5 text-sm font-semibold text-stone-900 transition-colors duration-(--duration-fast) hover:border-clay-300 hover:text-clay-600"
                  >
                    {JUMP_CATEGORY_NAMES[index]}
                  </Link>
                ))}
              </div>
            </div>

            {/* The cluster is the composition, so it never stacks above lg. */}
            <div className="mt-12 flex justify-center max-lg:overflow-hidden lg:mt-0 lg:justify-start">
              <PhotoCluster />
            </div>
          </div>

          <section aria-labelledby="categories-heading" className="pt-1.5 pb-16">
            <div className="mb-3.5 flex items-baseline justify-between gap-4">
              <h2
                id="categories-heading"
                className="font-display text-display-md tracking-[-.01em] text-stone-900"
              >
                Browse by category
              </h2>
              {/* The count is the taxonomy's length, read from the API. */}
              <Button variant="ghost" size="sm" asChild>
                <Link href="/search">All {categories.length} categories →</Link>
              </Button>
            </div>

            <ul
              aria-labelledby="categories-heading"
              className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6"
            >
              {featured.map((category) => (
                <li key={category.slug}>
                  {/*
                    `overflow-hidden` with no padding on the card itself is what
                    lets the radius clip the photograph — with padding the image
                    cannot reach the edge, and without the clip its corners
                    escape the card. See design/design-plan/10-landing.md.
                  */}
                  <Link
                    href={`/search?category=${category.slug}`}
                    className="block h-full overflow-hidden rounded-xl bg-stone-0 shadow-sm transition-[box-shadow,transform] duration-(--duration-base) hover:shadow-hover motion-safe:hover:-translate-y-0.5"
                  >
                    <StockPhoto
                      src={`/categories/${category.slug}.jpg`}
                      sizes="(min-width: 1024px) 15vw, (min-width: 640px) 30vw, 45vw"
                      className="h-[94px] w-full"
                    />
                    <div className="px-3.25 pt-2.75 pb-3.25">
                      <h3 className="font-display text-[17px] text-stone-900">{category.name}</h3>
                      {/*
                        What the category covers, never a vendor count and never
                        a from-price — both are deferred until the numbers are
                        real (design/design-plan/98-post-mvp.md).
                      */}
                      <p className="mt-0.75 text-[11.5px] text-stone-600">
                        {SHORT_DESCRIPTIONS.get(category.slug) ?? category.description}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      {/*
        Nothing is invented here: an empty marketplace shows no featured row at
        all rather than four placeholder businesses.
      */}
      {featuredVendors.length > 0 ? (
        <section aria-labelledby="featured-heading" className={`${CONTAINER} py-14`}>
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 id="featured-heading" className="font-display text-display-md text-stone-900">
              Featured vendors
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/search">View all vendors →</Link>
            </Button>
          </div>

          <ul
            aria-labelledby="featured-heading"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {featuredVendors.map((vendor) => (
              <li key={vendor.id}>
                <VendorCard vendor={vendor} density="featured" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        id="how-it-works"
        aria-labelledby="how-it-works-heading"
        className="scroll-mt-(--header-height) bg-stone-100 py-16"
      >
        <div className={CONTAINER}>
          <h2 id="how-it-works-heading" className="font-display text-display-md text-stone-900">
            How it works
          </h2>

          <ol className="mt-8 grid gap-10 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step.title}>
                <span
                  aria-hidden="true"
                  className="block font-display text-[54px] leading-none text-clay-200"
                >
                  {index + 1}
                </span>
                <h3 className="mt-2 font-display text-display-sm text-stone-900">{step.title}</h3>
                <p className="mt-1.5 max-w-80 text-base text-stone-700">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="trust-heading" className={`${CONTAINER} py-16`}>
        <h2 id="trust-heading" className="sr-only">
          Why booking here is safe
        </h2>

        <ul className="grid gap-8 sm:grid-cols-3">
          {TRUST_SIGNALS.map((signal) => (
            <li key={signal.title}>
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-sage-50 text-sage-600">
                <signal.icon aria-hidden="true" className="size-4.5" />
              </span>
              <h3 className="mt-3 font-display text-display-sm text-stone-900">{signal.title}</h3>
              <p className="mt-1.5 max-w-80 text-base text-stone-700">{signal.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/*
        `for-vendors` is where the header's "For vendors" lands. It is the only
        surface in MVP that addresses vendors, so the nav item points at it
        rather than at a vendor marketing page that does not exist.
      */}
      <section
        id="for-vendors"
        aria-labelledby="cta-heading"
        className="scroll-mt-(--header-height) bg-stone-900"
      >
        <h2 id="cta-heading" className="sr-only">
          Get started
        </h2>

        <div
          className={`${CONTAINER} grid divide-stone-0/12 py-16 max-sm:divide-y sm:grid-cols-2 sm:divide-x`}
        >
          <div className="max-sm:pb-10 sm:pr-12">
            <h3 className="font-display text-display-md text-stone-50">Planning an event?</h3>
            <p className="mt-2 max-w-90 text-base text-stone-50/78">
              Tell us the vendor type, the city and the date. You will see prices and open dates
              before you speak to anyone.
            </p>
            <Button variant="primary" className="mt-5" asChild>
              <Link href="/search">Find a vendor</Link>
            </Button>
          </div>

          <div className="max-sm:pt-10 sm:pl-12">
            <h3 className="font-display text-display-md text-stone-50">Booking events yourself?</h3>
            <p className="mt-2 max-w-90 text-base text-stone-50/78">
              Publish your prices and your open dates, and take bookings without the phone tag.
              Payouts run through Stripe.
            </p>
            {/*
              Never offered to somebody who already holds a session — the footer
              hides the same pair, and a page that disagrees with itself is a bug.
            */}
            <Show when="signed-out">
              {/*
                Every vendor CTA arrives at sign-up with the role pre-selected;
                the role cards there stay the real fork — 21-sign-up.md.
              */}
              <Button variant="secondary" className="mt-5" asChild>
                <Link href="/sign-up?role=vendor">Join as a vendor</Link>
              </Button>
            </Show>
            <Show when="signed-in">
              <Button variant="secondary" className="mt-5" asChild>
                <Link href="/dashboard">Go to your dashboard</Link>
              </Button>
            </Show>
          </div>
        </div>
      </section>
    </>
  );
}
