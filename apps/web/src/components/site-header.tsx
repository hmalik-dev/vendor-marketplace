import Link from 'next/link';
import { Show, UserButton } from '@clerk/nextjs';
import { Logo, LOGO_SIZES } from '@/components/brand/logo';
import { RoleChip } from '@/components/brand/role-chip';
import { MARKETING_LINK_CLASS } from '@/components/marketing-link';
import { MarketingNav } from '@/components/marketing-nav';
import { SignedInDrawer, SignedOutDrawer } from '@/components/header-drawer';
import { HeaderNav } from '@/components/header-nav';
import { HeaderQuery } from '@/components/search/header-query';
import { NotificationBell } from '@/components/messaging/notification-bell';
import { Button } from '@/components/ui/button';
import { getCategories } from '@/lib/vendor-data';
import { readRoleForChrome } from '@/lib/current-user';

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
  /*
   * The role decides whether the header carries the vendor chip, and it is
   * read from the local account record rather than Clerk metadata — the same
   * rule `current-user.ts` states. Signed out, the read returns before it
   * makes a request, so a marketing page pays nothing for it.
   *
   * `readRoleForChrome` never throws. This header is in the root layout, where
   * a throw escapes every `error.tsx` and takes the whole document to the
   * global error screen — see the note on that function.
   */
  const [categories, role] = await Promise.all([getCategories(), readRoleForChrome()]);

  return (
    // The height sits on the header, not the nav inside it, so the bottom
    // border is part of the height rather than an extra pixel — an app shell is
    // measured against `--header-height`, and one stray pixel is enough to make
    // the page scroll. The token is 64px, and 56px below `md` per
    // `30-responsive.md`; nothing here restates either number.
    <header className="sticky top-0 z-(--z-header) box-border h-(--header-height) border-b border-stone-300 bg-stone-0">
      {/*
        The inset is per-route, not one number: the frames set it per screen and
        `HeaderNav` holds that choice.
      */}
      <HeaderNav>
        {/*
          34px from the wordmark to the nav at 1440 (frame `01`), 26px at 1024
          and 20px at 768 — the narrow frames tighten the whole bar, not just
          its gutter.
        */}
        <div className="flex min-w-0 flex-none items-center gap-5 lg:gap-6.5 min-[90rem]:gap-8.5">
          {/*
            The chip is a child of the wordmark's own row, not a sibling of it,
            so it takes that row's 9px gap *and* its own 4px margin — 13px from
            the wordmark, as the frames draw it. Keeping it in this row also
            leaves the cluster's 34px gap between the logo and the nav.
          */}
          <div className="flex items-center gap-[9px]">
            <Link href="/" className="transition-opacity hover:opacity-80">
              {/* The wordmark reads BRAND_NAME — never a literal. */}
              <Logo size={LOGO_SIZES.desktopHeader} />
            </Link>

            {role === 'vendor' ? <RoleChip label="Vendor" /> : null}
          </div>

          <Show when="signed-out">
            <MarketingNav />
          </Show>
        </div>

        {/* Present only on `/search`, and only from `lg` — frame `02`. */}
        <HeaderQuery categories={categories} />

        {/* 16 / 14 / 12px, per frame, same as the cluster on the left. */}
        <div className="flex flex-none items-center gap-3 lg:gap-3.5 min-[90rem]:gap-4">
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
            {/*
              Stepped at the call site rather than in the variant: `ink` is one
              control in one place, and its padding comes from `size`, so a
              breakpoint inside the variant string would race the size variant
              through `twMerge` rather than override it. The frames draw
              `12.5px / 8 15` below 1440 and `13px / 10 18` at it.
            */}
            <Button
              variant="ink"
              asChild
              className="px-3.75 py-2 text-[12.5px] min-[90rem]:px-4.5 min-[90rem]:py-2.5 min-[90rem]:text-action"
            >
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
      </HeaderNav>
    </header>
  );
}
