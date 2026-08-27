import Link from 'next/link';
import { Show, UserButton } from '@clerk/nextjs';
import { Logo, LOGO_SIZES } from '@/components/brand/logo';
import { MarketingNav, MARKETING_LINK_CLASS } from '@/components/marketing-nav';
import { Button } from '@/components/ui/button';

/**
 * Global site header. Server Component — Clerk's control components resolve
 * auth state on the server, so no 'use client' boundary is needed here.
 */
export function SiteHeader(): React.ReactElement {
  return (
    // The height sits on the header, not the nav inside it, so the bottom
    // border is part of the 64px rather than a 65th pixel — an app shell is
    // measured against `--header-height`, and one stray pixel is enough to make
    // the page scroll.
    <header className="sticky top-0 z-(--z-header) box-border h-(--header-height) border-b border-stone-300 bg-stone-0">
      <nav
        aria-label="Main"
        className="flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-10"
      >
        {/* 34px from the wordmark to the nav — frame `01`. */}
        <div className="flex items-center gap-8.5">
          <Link href="/" className="transition-opacity hover:opacity-80">
            {/* The wordmark reads BRAND_NAME — never a literal. */}
            <Logo size={LOGO_SIZES.desktopHeader} />
          </Link>

          <Show when="signed-out">
            <MarketingNav />
          </Show>
        </div>

        <div className="flex items-center gap-4">
          <Show when="signed-out">
            {/*
              Both routes are full pages rather than modals: sign-up has to
              collect the customer/vendor role before Clerk's form renders.

              "Sign in" is a nav link, not a ghost button: the frame draws it in
              `stone-700` alongside Browse / How it works / For vendors, and
              ghost's `clay-500` is reserved for tertiary actions in a pane.
            */}
            <Link href="/sign-in" className={MARKETING_LINK_CLASS}>
              Sign in
            </Link>
            {/*
              `ink` is the marketing header's join action and lives nowhere
              else in the product — see design/design-plan/03-components.md.
            */}
            <Button variant="ink" asChild>
              <Link href="/sign-up">Join as a vendor</Link>
            </Button>
          </Show>

          <Show when="signed-in">
            <Button variant="ghost" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <UserButton />
          </Show>
        </div>
      </nav>
    </header>
  );
}
