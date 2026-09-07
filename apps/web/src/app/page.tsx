import type { Metadata } from 'next';
import Link from 'next/link';
import { Show } from '@clerk/nextjs';
import {
  BRAND_NAME,
  CATEGORY_SEEDS,
  CATEGORY_SLUGS,
  LANDING_CATEGORY_COUNT,
  LANDING_JUMP_CATEGORY_SLUGS,
  serialiseJsonLd,
  toDateString,
  type Category,
} from '@vendor-marketplace/shared';
import { ShieldCheck, Star, Tag, type LucideIcon } from 'lucide-react';
import { HeroSearch } from '@/components/landing/hero-search';
import { PhotoCluster } from '@/components/landing/photo-cluster';
import { StatusStrip } from '@/components/landing/status-strip';
import { Button } from '@/components/ui/button';
import { StockPhoto } from '@/components/ui/stock-photo';
import { VendorCard } from '@/components/vendors/vendor-card';
import { siteOrigin } from '@/config/env';
import { getOwnBookingRequests, getOwnBookings } from '@/lib/customer-data';
import { readRoleForChrome, redirectVendorToDashboard } from '@/lib/current-user';
import {
  GENERIC_TRUST_COPY,
  hasStatusStrip,
  landingStatus,
  trustCopyFor,
} from '@/lib/landing-status';
import type { LandingStatus, TrustTitle } from '@/lib/landing-status';
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
 * The page gutter, at each width a frame draws one: 20px at `14 Landing
 * tablet`, 28px at `27 Landing — 1024`, 40px at `01 Landing`. It used to read
 * `sm:px-8 lg:px-10`, which gave 768 a 32px gutter no frame asks for and 1024
 * the full desktop 40 — the single biggest reason 1024 read as compressed
 * desktop rather than its own composition.
 *
 * The 1440 step is `min-[90rem]`, not `xl`, because 1440 is the width the
 * frame is drawn at; `/search` already sets its own gutter the same way.
 *
 * There is no inner max-width — the category row spans the whole page. The cap
 * keeps the six cards from stretching on an ultrawide display without
 * inventing a margin at 1440.
 */
const CONTAINER = 'mx-auto w-full max-w-[1440px] px-5 lg:px-7 min-[90rem]:px-10';

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
 * The glyph each trust signal is drawn with, by the guarantee it stands for.
 *
 * Keyed by title rather than positional, because the band's order is not fixed:
 * the signed-in page leads with the payment, and an index would silently hand
 * the shield to the reviews line. The copy itself lives in `landing-status.ts`,
 * where the booking-resolved wording is derived — one list, two renderings.
 *
 * Mechanism, never adjective: "payment held by Stripe until the event", not
 * "secure and reliable". This section does the work the stats band would have
 * done, which is why there is no stats band.
 */
const TRUST_ICONS: Record<TrustTitle, LucideIcon> = {
  'Reviews from real bookings': Star,
  'Payment held until the event': ShieldCheck,
  'No service fee': Tag,
};

/**
 * The three mechanism steps beside the vendor pitch — what actually happens,
 * rather than a second copy of the CTA.
 *
 * **No pricing figures in this band, deliberately.** An earlier pass put the
 * commission, `$0 to list` and the payout interval here as display numerals,
 * and they come out for two structural reasons. Commission is a *conversion*
 * number, not an acquisition one: stated bare, with no room to frame it against
 * what a vendor keeps, the first fact a vendor learns about money is what is
 * deducted from them. And **customers read this same page** — a band announcing
 * that the marketplace takes a percentage invites a customer to conclude a
 * vendor charges more here than direct, which is exactly backwards and quietly
 * undercuts *No service fee* three sections above. The commission belongs on
 * `/for-vendors`, where it can be framed, and in the vendor agreement, where
 * it is binding.
 */
const VENDOR_STEPS = [
  {
    title: 'Publish your prices',
    body: `What you charge, in the open. ${BRAND_NAME} adds nothing on top of it.`,
  },
  {
    title: 'Set your open dates',
    body: 'Customers only ever request a date you have actually left free.',
  },
  {
    title: 'Get paid after the event',
    body: 'The payment is held from booking until the event is done, then released to you through Stripe.',
  },
] as const;

/**
 * Where the closing band's two controls send a vendor.
 *
 * TODO(#428): both should land on **`/for-vendors`** — a page that states what
 * a vendor keeps, when they are paid, what it costs and how availability works,
 * *then* asks them to sign up. It does not exist yet, so both fall back to the
 * signup form with the role pre-selected, which is where the nav's `For
 * vendors` link already goes. **One destination, never two**: a band whose
 * headline CTA and whose "how it works" link disagree is two doors into one
 * room, and the reason the fallback is written once here.
 */
const VENDOR_ENTRY_PATH = '/sign-up?role=vendor';

const DESCRIPTION = `Compare real availability and pricing from event vendors near you, send one request, and pay securely once the date is locked in. Now booking in ${LAUNCH_CITY}.`;

/*
 * The origin this deployment actually answers on, not `BRAND_DOMAIN`.
 *
 * `BRAND_DOMAIN` is the domain the product will live on; it is not where this
 * build is served from today, and every absolute URL derived from it — the
 * canonical, `og:url`, and the `og:image` Next resolves against it — pointed a
 * crawler and every share card at a host that does not serve this app. The
 * brand domain stays for display (a vendor's slug preview reads as the URL
 * they will have); anything a machine follows uses the real origin.
 */
const CANONICAL_ORIGIN = siteOrigin();

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

/**
 * "Browse by category" leads with the first six; the rest live on search.
 *
 * **A row the seeds no longer describe is dropped before the slice.** The
 * taxonomy lives in `CATEGORY_SEEDS`, but this list comes from the database,
 * and the two only agree once `pnpm db:seed` has run — a retired category
 * stays live at its old `display_order` until then. That gap is what makes it
 * a card rather than a footnote: the card's photograph is `/categories/
 * <slug>.jpg` with no fallback, so a database still holding `florals` after
 * #419 renamed that file would draw a broken image on the front door of the
 * product, and link it to a category the vendor picker no longer offers.
 *
 * Filtering here rather than trusting the seed to have run is the difference
 * between a deploy order that has to be remembered and one that cannot bite.
 * `page.test.tsx` covers the stale row directly.
 */
function landingCategories(categories: readonly Category[]): Category[] {
  const seeded = new Set<string>(CATEGORY_SLUGS);

  return [...categories]
    .filter((category) => seeded.has(category.slug))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, LANDING_CATEGORY_COUNT);
}

/**
 * What a reader with no bookings of their own has to show — a visitor, an
 * operator, and a customer whose hub could not be read.
 *
 * A value rather than a branch, so the strip and the trust band ask the same
 * question of the same shape whoever is looking: both reads degrade to an empty
 * list on their own (`degradeToEmpty` in `customer-data.ts`), and this is what
 * that degrades *to* on this page.
 */
const EMPTY_STATUS: LandingStatus = { next: null, requestsWaitingOnVendor: 0 };

/**
 * One of the customer's own reads, degraded to nothing rather than allowed to
 * navigate.
 *
 * **`/` must render for a signed-in visitor even when the API will not answer
 * them** — #33's law, which is why `readIdentityOnPublicRoute` exists at all.
 * The two hub reads do not honour it on their own: `customerToken()` calls
 * `redirect()` when Clerk hands back no token, and `degradeToEmpty` redirects
 * on a 401 *before* it can return its empty list. Both are right for
 * `/bookings`, whose whole subject is those rows. Here they are wrong: a
 * customer whose JWT the API rejects — a rotated key, clock skew, a session
 * revoked while the cookie survives — would be bounced off the marketing home
 * to `/sign-in?returnTo=/`, and back again on arrival.
 *
 * So the catch is **total, navigation signals included**, which is the one
 * place in this app that is the correct handling rather than a swallowed bug:
 * the only redirect these can raise is to sign-in, and this page is public.
 * The cost of failing is the strip and the resolved trust copy; the page is
 * not about them.
 */
async function ownRowsOrNothing<T>(read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch {
    return [];
  }
}

/**
 * Never prerendered, and **declared rather than inherited** (#428).
 *
 * This route is already dynamic — `redirectVendorToDashboard()` reaches Clerk's
 * `auth()` on the first line of `HomePage`, and `SiteHeader` does the same in
 * the root layout, so a dynamic API is in the tree either way. What changed is
 * the stake: `/` now renders a signed-in customer's **own** rows — their next
 * vendor's name, the event date and the amount held — into the HTML, in the
 * status strip's props and in the trust band's prose. If this page's HTML ever
 * entered the Full Route Cache, that is one customer's payment record served to
 * every visitor after them.
 *
 * Inheriting that from two `auth()` calls the page does not own is thinner than
 * it looks: `readIdentityOnPublicRoute` and `readRoleForChrome` catch
 * *everything* that is not a navigation signal, the `DynamicServerError` a
 * prerender raises included. Next still bails out — the work store is marked
 * before the throw — but that is a framework implementation detail rather than
 * something this route states. Every one of the twelve peer routes rendering
 * per-user data declares this; `/` was the outlier.
 */
export const dynamic = 'force-dynamic';

export default async function HomePage(): Promise<React.ReactElement> {
  await redirectVendorToDashboard();

  /*
   * A vendor never reaches this line — the redirect above sends them to their
   * own dashboard, because roles are exclusive and `/` is a catalogue of other
   * vendors. So the reader here is a signed-out visitor, a customer, or an
   * operator, and only the customer gets the signed-in composition: an admin
   * has no bookings to summarise and is looking at the marketplace, not at
   * their own things.
   *
   * `readRoleForChrome` is `cache()`d and the header has already called it, so
   * this costs nothing beyond the first request.
   */
  const isCustomer = (await readRoleForChrome()) === 'customer';

  /*
    One wave, and every read in it bounded by `API_REQUEST_TIMEOUT_MS` (#390).

    Every one of them degrades to an empty list, so a wedged upstream costs
    this page its category row, its featured row and a signed-in customer's
    status strip, and keeps everything else — but before the deadline existed,
    "degrades" was theoretical: a suspended API never answers at all, so `/`
    held the connection open with zero bytes flushed until the platform's
    gateway ended it. The visitor got a blank tab and then somebody else's 504
    page. Measured 2026-08-31: 35s and 0 bytes before, 8.1s and a rendered page
    after.

    The two reference reads degrade on their own; the customer's two are the
    hub's, which redirect rather than degrade, so `ownRowsOrNothing` is what
    holds them to this route's rule.
  */
  const [categories, featuredVendors, requests, bookings] = await Promise.all([
    getCategories(),
    // Fetched only for the composition that renders it — the featured row is
    // off for a signed-in customer, and a discarded round trip is one this
    // page's own deadline comment measures the cost of.
    isCustomer ? [] : getFeaturedVendors(),
    isCustomer ? ownRowsOrNothing(getOwnBookingRequests) : [],
    isCustomer ? ownRowsOrNothing(getOwnBookings) : [],
  ]);
  const featured = landingCategories(categories);
  const status = isCustomer ? landingStatus(requests, bookings) : EMPTY_STATUS;
  const trustSignals = isCustomer ? trustCopyFor(status) : GENERIC_TRUST_COPY;

  return (
    <>
      {/*
        The signed-in customer's continuation content, in the space the removed
        acquisition sections used to occupy. It is the *only* thing above the
        hero, and it is absent entirely when there is nothing in it — see
        `hasStatusStrip`.
      */}
      {isCustomer && hasStatusStrip(status) ? (
        <StatusStrip status={status} serverToday={toDateString(new Date())} />
      ) : null}

      <script
        type="application/ld+json"
        /*
          A literal above, so nothing untrusted reaches it — but it goes through
          the same serialiser as the vendor page's so that the two JSON-LD sites
          cannot drift, and so the guard in `json-ld-escaping.test.ts` is a rule
          about the sink rather than about which payloads someone judged safe.
        */
        dangerouslySetInnerHTML={{ __html: serialiseJsonLd(STRUCTURED_DATA) }}
      />

      {/* Full-bleed so the gradient runs edge to edge behind the headline. */}
      <section className="hero-gradient relative overflow-hidden">
        {/* One blob per page. It is the only atmospheric shape in the product. */}
        <div
          aria-hidden="true"
          /*
            330 at 1024 and 260 at 768, with the frames' own offsets. It used to
            carry only the 1440 size, so a 440px circle sat in a 768px viewport
            — more than half the width of the screen, where the frame draws a
            quarter of it.
          */
          className="pointer-events-none absolute -top-17.5 -right-20 size-65 rounded-full bg-clay-400/6 lg:-top-22.5 lg:-right-25 lg:size-82.5 min-[90rem]:-top-27.5 min-[90rem]:-right-32.5 min-[90rem]:size-110"
        />

        <div className={`${CONTAINER} relative`}>
          {/*
            Two drawn tablet/desktop compositions, one DOM.

            `14 Landing tablet` puts the search bar **below both columns** at
            full width; `27 Landing — 1024` keeps it inside the left column.
            Rendering `HeroSearch` twice behind breakpoint classes would give
            the page two instances of a client component with its own state —
            two different half-filled searches, depending which width the
            visitor last resized through. So the bar stays one node and the
            *grid* moves it: row 2 spanning both columns at `md`, row 2 of
            column 1 at `lg`, which reads identically to sitting inside the
            copy column because the cluster spans both rows beside it.
          */}
          {/*
            26px at both narrow frames, 40 only at 1440. This single value was
            14px of the 41px of accumulated drift at 1024 — every block below
            the headline inherited it.
          */}
          {/*
            `lg:grid-rows-[min-content_1fr]` is what puts the search bar where
            the frame draws it.

            From `lg` the cluster spans both rows, and it is taller than the
            copy and the bar stacked. Grid distributes that surplus across the
            rows it spans, so row 1 — the copy — grew by half of it and carried
            the bar down with it: the bar measured y=372.25 against the frame's
            352.5, and the jump chips inherited the same +19.75.

            Sizing row 1 to `min-content` pins it to the copy, and `1fr` gives
            row 2 the whole surplus, which the bar then sits at the top of. The
            cluster is unaffected — its cards are absolutely positioned inside a
            fixed-height box, so it does not care which row owns the slack.
          */}
          <div className="grid pt-6.5 md:grid-cols-[1fr_288px] md:gap-x-5 lg:grid-cols-[56%_44%] lg:grid-rows-[min-content_1fr] lg:gap-x-0 min-[90rem]:pt-10">
            {/*
              34px from the copy to the cluster is the frame's gutter at the
              1440 design target, but at 1024 it was the last 18px the search
              bar needed: "Any vendor type" wanted 495px and the column gave it
              486. `30-responsive.md` is explicit that when a control cannot
              fit at 1024 the widths change, not the content — so the gutter
              narrows there and the frame's value returns at `xl`.
            */}
            <div className="md:col-start-1 md:row-start-1 lg:pr-5.5 min-[90rem]:pr-8.5">
              {/*
                `text-meta`, not `text-xs`: frame `01 Landing` draws the badge
                at 12px and `--text-xs` is 11px (#85). The step already existed
                — #198 added `--text-meta: 12px` — the badge had simply never
                been moved onto it.
              */}
              <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-clay-400/10 px-2.5 py-1.25 text-[11px] font-semibold text-clay-600 lg:mb-3.25 lg:px-2.75 lg:text-[11.5px] min-[90rem]:mb-4.5 min-[90rem]:gap-1.75 min-[90rem]:px-3 min-[90rem]:py-1.5 min-[90rem]:text-meta">
                <span
                  aria-hidden="true"
                  className="size-1 rounded-full bg-clay-400 min-[90rem]:size-1.25"
                />
                Now booking in {LAUNCH_CITY}
              </p>

              {/*
                The product's one flourish: a plain first line in ink over an
                italic second line in clay carrying the promise. It repeats
                nowhere else — design/design-plan/31-content-voice.md.
              */}
              {/*
                Three steps, because 1024 is a drawn viewport rather than a
                squeezed 1440: `25 Landing — 1024` sets the headline at 40px so
                the category row — the fold marker — still clears 640px.
              */}
              {/*
                Four drawn sizes, one per drawn width: 34 below the frames, 36
                at `14 Landing tablet`, 40 at `27 Landing — 1024`, 54 at `01`.
                The 40 used to start at `sm`, which gave 768 the 1024 size.

                No `leading-` here: each size token carries the ratio its own
                frame declares (1.06, 1.05, 1.04, 1.04), and a single hardcoded
                1.04 silently overrode all four. The 768 frame is the one that
                differs, so that was a real 0.4px-per-line error rather than a
                tidiness point.
              */}
              <h1 className="font-display text-display-lg tracking-[-.02em] text-stone-900 md:text-display-hero-sm lg:text-display-hero-md min-[90rem]:text-display-xl">
                Book your vendors
                <br />
                <span className="text-clay-500 italic">without the back-and-forth.</span>
              </h1>

              <p className="mt-2.75 max-w-105 text-base leading-prose text-stone-700 lg:mt-3 min-[90rem]:mt-3.75 min-[90rem]:max-w-112.5 min-[90rem]:text-lg">
                Compare real availability and pricing from vendors near you, send one request, and
                pay securely once the date is locked in.
              </p>
            </div>

            <div className="md:col-span-2 md:row-start-2 lg:col-span-1 lg:col-start-1 lg:pr-5.5 min-[90rem]:pr-8.5">
              <HeroSearch categories={categories} />

              {/*
                The shortcut past the bar for a visitor who already knows what
                they need. Plain links, so they work before hydration and can
                be opened in a new tab — the bar is the only part that needs a
                client boundary.

                `14 Landing tablet` does not draw this row: at 768 the bar has
                just taken the full width and the category cards are directly
                beneath it, so a third row of category shortcuts between them
                repeats the same navigation twice in 120px.
              */}
              <div className="mt-3.25 hidden flex-wrap items-center gap-[7px] max-md:flex lg:flex min-[90rem]:mt-4 min-[90rem]:gap-2">
                {/* Steps with the chips beside it: 11.5px/1px, 12.5px/2px at 1440. */}
                <span className="mr-px text-[11.5px] text-stone-600 min-[90rem]:mr-0.5 min-[90rem]:text-sm">
                  Or jump straight to
                </span>
                {LANDING_JUMP_CATEGORY_SLUGS.map((slug, index) => (
                  <Link
                    key={slug}
                    href={`/search?category=${slug}`}
                    className="rounded-full border border-stone-300 bg-stone-0 px-2.5 py-1.25 text-[11.5px] font-semibold text-stone-900 transition-colors duration-(--duration-fast) min-[90rem]:px-3 min-[90rem]:py-1.5 min-[90rem]:text-sm hover:border-clay-300 hover:text-clay-600"
                  >
                    {JUMP_CATEGORY_NAMES[index]}
                  </Link>
                ))}
              </div>
            </div>

            {/*
              The cluster is the composition, not an illustration: it only
              means anything sitting beside the headline. `14 Landing tablet`
              draws it at 768 beside a narrower copy column, which is why it
              now appears from `md` — it used to be dropped below `lg`, on the
              reasoning that a single-column hero turned it into a third block
              of photographs in a vertical scroll. That reasoning still holds
              *below* 768, where it stays hidden and `14 Landing mobile` draws
              no cards at all.

              It spans both rows from `lg`, so the search bar sitting in row 2
              of column 1 reads as part of the copy column rather than pushing
              the cluster down.
            */}
            <div className="hidden md:col-start-2 md:row-start-1 md:flex md:justify-start lg:row-span-2">
              <PhotoCluster />
            </div>
          </div>

          {/*
            Same rule as the featured row below: a section with nothing to list
            is not drawn. The taxonomy degrades to empty when the API is having
            a bad day, and "All 0 categories" over a bare grid is a worse front
            door than a hero that simply ends after the search bar.
          */}
          {featured.length > 0 ? (
            /*
              Every metric below steps with the frames. The whole section used
              to render `01 Landing`'s numbers at all three widths, which is
              the largest single piece of #169's "1024 is compressed desktop":
              a 6-across grid of 94px covers under a 26px heading does not fit
              a 640px-tall laptop the way the 1024 frame's 68px covers do.
            */
            <section
              aria-labelledby="categories-heading"
              className="pt-5.5 pb-16 lg:pt-1 min-[90rem]:pt-1.5"
            >
              <div className="mb-2.5 flex items-baseline justify-between gap-4 lg:mb-2.75 min-[90rem]:mb-3.5">
                <h2
                  id="categories-heading"
                  className="display-heading text-display-xs text-stone-900 min-[90rem]:text-display-md"
                >
                  Browse by category
                </h2>
                {/*
                  The count is the taxonomy's length, read from the API.

                  Frame `01 Landing` draws this as a plain action link rather
                  than a control: a bare span at padding 0 and radius 0, with
                  no fill. A `Button variant="ghost" size="sm"` wrapper put a
                  `px-3 py-1.5` pill and an 8px radius around it, taking the
                  16px-tall link to 29px (#82). The colour, hover affordance
                  and focus ring the wrapper used to supply are spelled out
                  here, so dropping it costs the link neither.
                */}
                <Link
                  href="/search"
                  className="text-[12px] font-semibold text-clay-500 underline-offset-4 transition-colors duration-(--duration-fast) outline-none min-[90rem]:text-action hover:text-clay-600 hover:underline"
                >
                  {/*
                    `14 Landing tablet` shortens this to `All 11 →`; 1024 and
                    1440 both keep the noun. One element rather than two, so the
                    link is a single tab stop and a single accessible name at
                    every width — and the word is hidden with the space in front
                    of it, or 768 reads "All 11  →".
                  */}
                  All {categories.length} <span className="max-lg:hidden">categories</span> →
                </Link>
              </div>

              <ul
                aria-labelledby="categories-heading"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-2.75 min-[90rem]:gap-3.5"
              >
                {featured.map((category) => (
                  <li key={category.slug}>
                    {/*
                      `overflow-hidden` with no padding on the card itself is
                      what lets the radius clip the photograph — with padding the
                      image cannot reach the edge, and without the clip its
                      corners escape the card. See design/design-plan/10-landing.md.
                    */}
                    <Link
                      href={`/search?category=${category.slug}`}
                      /*
                        The ring is not a parity detail here — these six links
                        had **no focus indicator of any kind**: no outline, no
                        ring utility, nothing but the resting shadow. A keyboard
                        visitor tabbing the front door's primary navigation had
                        no way to see where they were. Pre-existing rather than
                        introduced by #304, and the six accessibility laws in
                        `04-laws.md` are the parity pass's only gate, so it is
                        fixed here rather than deferred.
                      */
                      className="block h-full overflow-hidden rounded-panel bg-stone-0 shadow-sm transition-[box-shadow,transform] duration-(--duration-base) outline-none min-[90rem]:rounded-xl hover:shadow-hover motion-safe:hover:-translate-y-0.5"
                    >
                      <StockPhoto
                        src={`/categories/${category.slug}.jpg`}
                        sizes="(min-width: 1024px) 15vw, (min-width: 640px) 30vw, 45vw"
                        /*
                          84 at 768, 68 at 1024, 94 at 1440. It is not monotonic
                          because the grid is not: 768 draws three across and
                          1024 draws six, so the 1024 card is the narrowest of
                          the three and its 3:2 cover is the shortest.
                        */
                        className="h-[84px] w-full lg:h-[68px] min-[90rem]:h-[94px]"
                      />
                      <div className="px-2.75 pt-2.25 pb-2.75 min-[90rem]:px-3.25 min-[90rem]:pt-2.75 min-[90rem]:pb-3.25">
                        {/*
                          **Named deviation, 1px.** `27 Landing — 1024` draws
                          this title at 15px in Instrument Serif (`.sh`), and
                          `01-foundations.md` states 16px as the floor for that
                          face — "Never below 16px", a rule of the type system
                          rather than a preference, guarded by
                          `display-type.test.ts`.

                          The floor wins here, against the usual "build the
                          frame, correct the plan" order, because the plan's
                          rule is a legibility law and the frame's 15px is one
                          pixel of it at one width: `14 Landing tablet` draws
                          the same title at 16px and `01 Landing` at 17px, so
                          1024 is the only width that dips below. Weakening the
                          guard to admit it would open the face to every future
                          sub-floor use, which is the regression the guard was
                          written for.

                          Recorded rather than resolved silently — if the
                          intent is that the floor bends for this card, that is
                          a foundations change, not a page change.
                        */}
                        <h3 className="font-display text-[16px] text-stone-900 min-[90rem]:text-[17px]">
                          {category.name}
                        </h3>
                        {/*
                          What the category covers, never a vendor count and
                          never a from-price — both are deferred until the
                          numbers are real (design/design-plan/98-post-mvp.md).
                        */}
                        {/*
                          3px, which frame `01` draws and `mt-0.5`'s 2px misses
                          by one — the card ends up 156px tall against the
                          frame's 157. Not on the 4px scale, so it is stated.
                        */}
                        <p className="mt-[3px] text-[10.5px] text-stone-600 min-[90rem]:text-helper">
                          {SHORT_DESCRIPTIONS.get(category.slug) ?? category.description}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </section>

      {/*
        Nothing is invented here: an empty marketplace shows no featured row at
        all rather than four placeholder businesses. An upstream that failed or
        timed out degrades to the same empty list, and to the same absent row —
        the front door has no honest way to tell those apart, and inventing one
        would mean claiming a vendor count nobody queried.
      */}
      {featuredVendors.length > 0 ? (
        <section aria-labelledby="featured-heading" className={`${CONTAINER} py-14`}>
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 id="featured-heading" className="display-heading text-display-md text-stone-900">
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
                {/* `h3`: this strip has its own `h2` above it. */}
                <VendorCard vendor={vendor} density="featured" headingLevel="h3" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/*
        Off for a signed-in customer: it explains a process this person has
        completed, which is pure acquisition. *Featured vendors* goes with it —
        the row is a catalogue teaser for somebody who has not searched yet, and
        this reader has a search bar in the hero and bookings in the strip.
      */}
      {isCustomer ? null : (
        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          className="scroll-mt-(--header-height) bg-stone-100 py-16"
        >
          <div className={CONTAINER}>
            <h2
              id="how-it-works-heading"
              className="display-heading text-display-md text-stone-900"
            >
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
                  <p className="mt-1.5 max-w-80 text-base leading-prose text-stone-700">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/*
        The trust band stays on both pages, and on the signed-in one it is the
        **ending**: a deliberate reversal of an earlier note that cut it. *How
        it works* explains a process; this states standing guarantees that hold
        on every booking, and "payment held until the event" matters more to
        someone with money in flight than to a visitor.

        Which is also why it changes ground there. With the closing band gone
        the merge into the footer is a value ramp — hero gradient → `stone-50`
        → `stone-100` here → `stone-950` footer — each step darker than the
        last, so the footer arrives as the bottom of a ramp rather than a hard
        cut off cream. On the signed-out page the band above it does that job,
        so the section keeps the page ground.
      */}
      <section aria-labelledby="trust-heading" className={isCustomer ? 'bg-stone-100' : undefined}>
        <div className={`${CONTAINER} py-16`}>
          <h2 id="trust-heading" className="sr-only">
            Why booking here is safe
          </h2>

          <ul className="grid gap-8 sm:grid-cols-3">
            {trustSignals.map((signal) => {
              const Icon = TRUST_ICONS[signal.title];

              return (
                <li key={signal.title}>
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-sage-50 text-sage-600">
                    <Icon aria-hidden="true" className="size-4.5" />
                  </span>
                  <h3 className="mt-3 font-display text-display-sm text-stone-900">
                    {signal.title}
                  </h3>
                  <p className="mt-1.5 max-w-80 text-base leading-prose text-stone-700">
                    {signal.body}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/*
        The closing band, and it has **one** audience: a signed-out visitor.

        It used to be a two-column fork — *Planning an event?* on the left,
        *Booking events yourself?* on the right. The customer half was the
        redundant one: the hero is a *live search bar*, so a button whose only
        job is to scroll you back up to it earns nothing. The vendor half is the
        page's only supply-side entry besides one nav link, so it is the half
        worth keeping — and it spends the reclaimed width on how the thing
        works, three steps deep, instead of repeating a CTA.

        `Show` rather than the role read above, because "signed out" is a
        question about the session and Clerk is the one that can answer it: a
        signed-in customer whose account record cannot be read still holds a
        session, and they must not be shown a vendor pitch they cannot act on.
        A signed-in vendor never reaches this page at all.

        `for-vendors` stays as the anchor id: nothing points at it today — the
        nav, the footer and both controls below all go to `VENDOR_ENTRY_PATH` —
        but it is the fragment the page has advertised, and dropping it would
        break any link already written down.
      */}
      <Show when="signed-out">
        <section
          id="for-vendors"
          aria-labelledby="cta-heading"
          className="scroll-mt-(--header-height) bg-stone-900"
        >
          <h2 id="cta-heading" className="sr-only">
            Start taking bookings
          </h2>

          {/*
            An inner cap inside the page gutter, which the rest of the page does
            not have: the category row and the featured grid span the full 1440
            because they are grids that keep their rhythm at any width, and this
            is two blocks of prose. Left uncapped they sit at opposite edges
            with 300px of ink between them and stop reading as one band. 1160 is
            the frame's own measure.
          */}
          <div className={`${CONTAINER} py-15`}>
            <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-10 sm:flex-row sm:items-start sm:justify-between sm:gap-15">
              <div className="max-w-110">
                <h3 className="display-heading text-[33px] leading-[1.14] text-stone-50">
                  Booking events yourself?
                </h3>
                <p className="mt-3.25 text-base leading-prose text-stone-400">
                  Publish your prices and your open dates, and take bookings without the phone tag.
                  You are paid through Stripe after the event.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-5">
                  {/*
                  Both controls, one destination — see `VENDOR_ENTRY_PATH`. The
                  primary is the cream fill the frame draws rather than clay:
                  clay on this ink would be the largest clay area on the site
                  and would swallow its own label.
                */}
                  <Button variant="secondary" className="mt-0" asChild>
                    <Link href={VENDOR_ENTRY_PATH}>Start taking bookings</Link>
                  </Button>
                  <Link
                    href={VENDOR_ENTRY_PATH}
                    className="text-base font-semibold text-stone-50 underline-offset-4 transition-colors duration-(--duration-fast) hover:underline"
                  >
                    See how payouts work
                  </Link>
                </div>
              </div>

              <ol className="flex flex-col gap-4.75 border-stone-50/14 sm:border-l sm:pt-1.25 sm:pl-13">
                {VENDOR_STEPS.map((step, index) => (
                  <li key={step.title} className="flex items-start gap-3.25">
                    <span
                      aria-hidden="true"
                      className="mt-px flex size-5.5 flex-none items-center justify-center rounded-full border border-stone-50/30 font-mono text-xs font-medium text-stone-400"
                    >
                      {index + 1}
                    </span>
                    <div>
                      <h4 className="text-cta font-semibold text-stone-50">{step.title}</h4>
                      <p className="mt-0.75 max-w-62.5 text-sm leading-prose text-stone-540">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </Show>
    </>
  );
}
