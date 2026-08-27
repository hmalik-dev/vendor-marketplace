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
        <ClerkProvider appearance={{ theme: shadcn }}>
          {/*
            The adapter sits above the header, not inside the search page: on
            `/search` the query bar lives in the header and the results live in
            the page, and both read the same `nuqs` params. Two readers of one
            URL cannot disagree; two copies of the adapter could.
          */}
          <NuqsAdapter>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </NuqsAdapter>
          <Toaster richColors position="top-center" />
        </ClerkProvider>
      </body>
    </html>
  );
}
