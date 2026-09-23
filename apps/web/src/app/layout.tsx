import type { Metadata } from 'next';
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Suspense } from 'react';
import { BRAND_DESCRIPTION, BRAND_NAME } from '@vendor-marketplace/shared';
import { siteOrigin } from '@/config/env';
import { SITE_OPEN_GRAPH } from '@/lib/canonical';
import { analyticsEnabled } from '@/lib/analytics-enabled';
import { getServerSession } from '@/lib/auth/server';
import { ErrorReportingUser } from '@/components/errors/error-reporting-user';
import { OutsideAdmin, PublicChrome } from '@/components/public-chrome';
import { SiteFooter } from '@/components/site-footer';
import { SearchStatusProvider } from '@/components/search/search-status';
import { SiteHeader } from '@/components/site-header';
import { Toaster } from '@/components/ui/sonner';
import { TOAST_BOTTOM_OFFSET } from '@/components/ui/toast-offset';
import { WebAnalytics } from '@/components/web-analytics';
import './globals.css';

/**
 * Display — business names, page titles, prices, dates, empty-state headlines.
 * Regular weight only; the family has one. Never set below 16px.
 */
const instrumentSerif = Instrument_Serif({
  variable: '--font-display-face',
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
});

/** Body — everything else: copy, navigation, form labels, buttons. */
const instrumentSans = Instrument_Sans({
  variable: '--font-body-face',
  subsets: ['latin'],
  display: 'swap',
});

/** Reserved for prices in tables, booking ids, and admin data views. */
const jetBrainsMono = JetBrains_Mono({
  variable: '--font-mono-face',
  subsets: ['latin'],
  display: 'swap',
});

/**
 * `metadataBase` is what makes every relative OG and canonical URL absolute.
 * Without it Next warns and emits relative `og:image` paths, which no preview
 * renderer resolves — the reason a shared link showed a blank card.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  /*
    No `template`. Every page already sets a composed title through
    `pageTitle()`, which is the single place the `<page> · <brand>` shape is
    defined — a template here appended the brand a second time, so the sign-in
    tab read the brand name twice.
  */
  title: BRAND_NAME,
  description: BRAND_DESCRIPTION,
  // No canonical and no `og:url`: each page declares its own (VEN-606).
  openGraph: SITE_OPEN_GRAPH,
  // `summary_large_image` is what turns the 1200x630 card into a full-width
  // preview rather than a thumbnail beside the text.
  twitter: { card: 'summary_large_image', title: BRAND_NAME, description: BRAND_DESCRIPTION },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession();

  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${instrumentSans.variable} ${jetBrainsMono.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        <ErrorReportingUser userId={session?.userId ?? null} />
        {/*
            The adapter sits above the header, not inside the search page: on
            `/search` the query bar lives in the header and the results live in
            the page, and both read the same `nuqs` params. Two readers of one
            URL cannot disagree; two copies of the adapter could.
          */}
        <NuqsAdapter>
          {/*
              First in the tab order, and the only thing before the header.
              Off-screen until focused, then it lands on the cream surface at
              the top-left rather than shifting the layout — `sr-only` alone
              would keep it unreachable to a sighted keyboard user.
            */}
          <a
            href="#main"
            className="sr-only rounded-lg bg-stone-0 px-4 py-2 text-sm font-semibold text-stone-900 shadow-md focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-3 focus-visible:z-(--z-skip-link)"
          >
            Skip to content
          </a>
          {/*
              Wraps the header and the page together, because the one thing it
              carries — whether a search is in flight — is set by the results
              and read by the query bar in the header. See `search-status.tsx`.
            */}
          <SearchStatusProvider>
            {/*
                The operations console draws its own inverted header (frame
                `13`), so the marketplace one is removed there rather than
                stacked above it. Same argument as `PublicChrome` below.
              */}
            <OutsideAdmin>
              {/*
                  Both chrome pieces read the taxonomy from the API and sit above
                  every segment's `loading.tsx`, so an unanswered read held the
                  whole document — the segment loader never got to paint (VEN-492,
                  `/support` 8s under a slow API). A boundary here lets the shell
                  flush first; the chrome streams in when its read settles. The
                  fallback is an empty `<header>` of the bar's own height, so the
                  page does not jump when it lands and the `calc(100dvh -
                  var(--header-height))` panes are sized right meanwhile. It must
                  be a `<header>`: `globals.css` hides that element on the auth
                  screens, and a `<div>` would leave a phantom bar there.
                */}
              <Suspense fallback={<header className="box-border h-(--header-height)" />}>
                <SiteHeader />
              </Suspense>
            </OutsideAdmin>
            <main id="main" tabIndex={-1} className="flex-1">
              {children}
            </main>
          </SearchStatusProvider>
          {/*
              The footer belongs to the public face. An app screen owns the
              whole viewport, and a footer under a full-height pane layout is
              what makes the page scroll when only the panes should.
            */}
          <PublicChrome>
            <Suspense fallback={null}>
              <SiteFooter />
            </Suspense>
          </PublicChrome>
        </NuqsAdapter>
        {/*
            Bottom-right, 8s dismiss (VEN-542, WCAG 2.2.1: 03-components.md's 5s
            was too short for a toast that is the only error message).
            `richColors` is deliberately absent: it fills the whole toast with
            a tint per type, where the spec puts the type in a 4px left accent
            on a `stone-0` surface.

            The bottom inset clears the sticky submit bar rather than landing on
            it. `/vendor/profile/edit` floats one at `bottom-0`, and the toast
            confirming a save was covering the button that produced it —
            `elementFromPoint` on the button centre returned the toast. sonner
            pauses its dismiss timer on hover and the pointer is still resting
            where it clicked, so the control was unreachable for 30 seconds
            rather than a few.

            **`bottom` only, and `mobileOffset` as well as `offset`.** A scalar
            is written to all four sides, which would move every toast in from
            the right edge too; and sonner applies `mobileOffset` below 600px,
            which is inside the range where the bar is `sticky` rather than
            `static` — so leaving it at its 16px default would have left #225's
            trap intact on exactly the widths that still have the bar.
          */}
        <Toaster
          position="bottom-right"
          duration={8000}
          offset={{ bottom: TOAST_BOTTOM_OFFSET }}
          mobileOffset={{ bottom: TOAST_BOTTOM_OFFSET }}
        />
        {analyticsEnabled(process.env.VERCEL_ENV) ? <WebAnalytics /> : null}
      </body>
    </html>
  );
}
