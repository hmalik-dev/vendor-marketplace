import Link from 'next/link';
import { Show, UserButton } from '@clerk/nextjs';
import { Logo, LOGO_SIZES } from '@/components/brand/logo';
import { MARKETING_LINK_CLASS } from '@/components/marketing-link';
import { MarketingNav } from '@/components/marketing-nav';
import { SignedInDrawer, SignedOutDrawer } from '@/components/header-drawer';
import { HeaderQuery } from '@/components/search/header-query';
import { NotificationBell } from '@/components/messaging/notification-bell';
import { Button } from '@/components/ui/button';
import { getCategories } from '@/lib/vendor-data';

/**
 * Global site header. Server Component — Clerk's control components resolve
 * auth state on the server, so the account actions never flash between signed
 * -out and signed-in on first paint. The two route-specific pieces inside it
 * (`MarketingNav`, `HeaderQuery`) are client components that read the
 * pathname; keeping them small is what keeps the auth cluster on the server.
 *
 * The taxonomy is fetched here rather than on the search page because frame
 * `02` puts the query bar in this bar. It is cached reference data, so this
 * costs one API call per revalidate window rather than one per page view.
 */
export async function SiteHeader(): Promise<React.ReactElement> {
  const categories = await getCategories();

  return (
    // The height sits on the header, not the nav inside it, so the bottom
    // border is part of the height rather than an extra pixel — an app shell is
    // measured against `--header-height`, and one stray pixel is enough to make
    // the page scroll. The token is 64px, and 56px below `md` per
    // `30-responsive.md`; nothing here restates either number.
    <header className="sticky top-0 z-(--z-header) box-border h-(--header-height) border-b border-stone-300 bg-stone-0">
      <nav
        aria-label="Main"
        className="flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-10"
      >
        {/* 34px from the wordmark to the nav — frame `01`. */}
        <div className="flex min-w-0 flex-none items-center gap-8.5">
          <Link href="/" className="transition-opacity hover:opacity-80">
            {/* The wordmark reads BRAND_NAME — never a literal. */}
            <Logo size={LOGO_SIZES.desktopHeader} />
          </Link>

          <Show when="signed-out">
            <MarketingNav />
          </Show>
        </div>

        {/* Present only on `/search`, and only from `lg` — frame `02`. */}
        <HeaderQuery categories={categories} />

        <div className="flex flex-none items-center gap-4">
          <Show when="signed-out">
            {/*
              "Sign in" is a nav link, not a ghost button: the frame draws it in
              `stone-700` alongside Browse / How it works / For vendors, and
              ghost's `clay-500` is reserved for tertiary actions in a pane.
            */}
            <Link href="/sign-in" className={MARKETING_LINK_CLASS}>
              Sign in
            </Link>
            {/*
              **One** sign-up control, not two. `/sign-up`'s role cards are
              already the fork, and a second header button — a named vendor
              link beside this pill — duplicated that decision in the one place
              a visitor has the least context to make it. Vendors reach the same
              screen through "For vendors" in the nav, which deep-links with the
              role pre-selected. See design/design-plan/21-sign-up.md.

              `ink` is the marketing header's sign-up action and lives nowhere
              else in the product — design/design-plan/03-components.md. It is
              the one control that never degrades: at 390 it stays a pill in the
              bar rather than going into the drawer.

              The route is a full page rather than a modal: sign-up has to
              collect the customer/vendor role before Clerk's form renders.
            */}
            <Button variant="ink" asChild>
              <Link href="/sign-up">Sign up</Link>
            </Button>

            {/*
              Beside the pill, exactly as frame `14 Landing mobile` draws them:
              the pill never goes into the drawer, so the visitor's one action
              stays a tap away.
            */}
            <SignedOutDrawer />
          </Show>

          <Show when="signed-in">
            <Button variant="ghost" asChild>
              <Link href="/messages">Messages</Link>
            </Button>
            {/*
              Four items do not fit at 390 — they pushed the header past the
              viewport. Dashboard is the one that gives way, and since #26 it
              gives way *into the drawer* rather than off the screen: frame
              `14 Search tablet` keeps Messages in the bar and puts the rest
              behind the hamburger.
            */}
            <Button variant="ghost" asChild className="max-sm:hidden">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <NotificationBell />
            <UserButton />
            <SignedInDrawer />
          </Show>
        </div>
      </nav>
    </header>
  );
}
