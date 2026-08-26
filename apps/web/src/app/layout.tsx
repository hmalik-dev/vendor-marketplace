import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import type { Metadata } from 'next';
import { Albert_Sans, Fraunces, JetBrains_Mono } from 'next/font/google';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

/** Warm organic serif — headlines, vendor business names, editorial moments. */
const fraunces = Fraunces({
  variable: '--font-display-face',
  subsets: ['latin'],
  display: 'swap',
});

/** Friendly geometric sans — body copy, navigation, form labels, buttons. */
const albertSans = Albert_Sans({
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
  title: 'VenMatch',
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
      className={`${fraunces.variable} ${albertSans.variable} ${jetBrainsMono.variable}`}
    >
      <body className="flex min-h-screen flex-col antialiased">
        <ClerkProvider appearance={{ theme: shadcn }}>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <Toaster richColors position="top-center" />
        </ClerkProvider>
      </body>
    </html>
  );
}
