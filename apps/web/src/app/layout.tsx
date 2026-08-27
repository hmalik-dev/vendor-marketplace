import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import type { Metadata } from 'next';
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Toaster } from '@/components/ui/sonner';
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

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: 'Find and book photographers, DJs, caterers, and florists for your event.',
};

/**
 * The strings frame `12 Sign up` writes, where Clerk's defaults say something
 * else. Scoped keys only: `signUp.start.*` cannot leak onto `/sign-in`.
 *
 * The submit button is deliberately absent. Clerk's `formButtonPrimary` is a
 * single global key shared by every flow, so setting it to the frame's "Create
 * my account" would also put that label on the sign-in form, where it is simply
 * wrong. A wrong string on one screen is worse than a generic one on another —
 * see the deviation note in design/design-plan/21-sign-up.md.
 */
const CLERK_COPY = {
  formFieldLabel__emailAddress: 'Email',
  signUp: {
    start: {
      actionText: 'Already with us?',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${instrumentSans.variable} ${jetBrainsMono.variable}`}
    >
      <body className="flex min-h-screen flex-col antialiased">
        {/*
          Clerk inherits the palette through the shadcn slots bound in
          `globals.css`. Where its own chrome fights the layout — the auth
          panel already draws the surface, and the panel's Serif headline
          already says what Clerk's header repeats — it is corrected there too,
          against the same tokens. Never hand-write a brand hex into an
          appearance object: it becomes a second source of truth and it drifts.
        */}
        <ClerkProvider
          appearance={{ theme: shadcn, variables: { borderRadius: 'var(--radius-lg)' } }}
          localization={CLERK_COPY}
        >
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
            <SiteHeader />
            <main id="main" tabIndex={-1} className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </NuqsAdapter>
          {/*
            Bottom-right, 5s dismiss, per design/design-plan/03-components.md.
            `richColors` is deliberately absent: it fills the whole toast with
            a tint per type, where the spec puts the type in a 4px left accent
            on a `stone-0` surface.
          */}
          <Toaster position="bottom-right" duration={5000} />
        </ClerkProvider>
      </body>
    </html>
  );
}
