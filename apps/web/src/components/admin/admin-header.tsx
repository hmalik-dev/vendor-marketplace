import Link from 'next/link';
import { AccountMenu } from '@/components/account-menu';
import { DASHBOARD_LABEL_BY_ROLE, DASHBOARD_PATH_BY_ROLE } from '@/lib/role-routes';
import { Logo, LOGO_SIZES } from '@/components/brand/logo';
import { TierMarker } from '@/components/brand/tier-marker';

export interface AdminHeaderProps {
  /** The signed-in operator's email — frame `13` prints it beside the avatar. */
  email: string;
  /** Drives the avatar's initial. One word, so one letter — as frame `13` draws. */
  name: string;
}

/**
 * The inverted header frame `13` draws.
 *
 * The inversion is the point: it is the one unmistakable signal that this
 * surface acts on other people's accounts. It replaces `SiteHeader` rather than
 * sitting beneath it — see `OutsideAdmin` in `public-chrome.tsx`.
 *
 * The avatar opens the same account menu the site header's does (ruled by the
 * account holder on VEN-677), so an operator reaches `Account settings`,
 * `Contact support` and `Sign out` from the console; its first row returns to
 * the console. `tone="dark"` draws it as frame `13` does: the shared `Avatar`
 * at its 30px `xs` step with the ground and the initial swapped for the
 * inverted pair. The colours are an override rather than a new tone: the
 * fallback ramp exists to distinguish *people* from each other, and there is
 * exactly one operator in this header.
 */
export function AdminHeader({ email, name }: AdminHeaderProps): React.ReactElement {
  /*
   * `box-content` (VEN-388): the frame document ships no reset, so `.hd`'s
   * `height:64px` is the content box and its 1px hairline sits below it —
   * 65px outer, one pixel taller than a border-box header. Every frame draws
   * `.hd` that way, so the value is corroborated rather than read once. The
   * console shell is a flex column, not `app-shell`'s calc, so the extra
   * pixel comes out of the pane rather than scrolling the page; the site
   * header keeps its border-box height for exactly that calc.
   */
  return (
    <header className="box-content flex h-(--header-height) shrink-0 items-center justify-between border-b border-stone-800 bg-stone-900 px-8">
      <div className="flex shrink-0 items-center gap-[9px]">
        <Link href="/admin" className="rounded-sm">
          {/*
            Both numbers are measured off a *rendered* frame `13`, not read off
            its markup: the mark is 22 x 15 and the cluster's gap is 9px. `gap-1`
            and a 14.375 diameter put the `Admin` chip at x=103.5 against the
            frame's x=110 — drift that survives a source read because neither
            side writes the resolved value down.

            `LOGO_SIZES.desktopHeader` rather than the 15 it happens to hold:
            that map exists "so no surface picks a logo size by eye", and every
            other header obeys it. 15 renders the mark at the frame's exact
            22 x 15 and, since VEN-388, the wordmark at the frame's 23px —
            `WORDMARK_SIZES` states it.
          */}
          <Logo tone="dark" size={LOGO_SIZES.desktopHeader} />
        </Link>
        <span className="ml-1 rounded-[5px] bg-stone-0/12 px-2 py-1 text-xs font-semibold tracking-[.06em] text-clay-150 uppercase">
          Admin
        </span>
        <TierMarker tone="dark" />
      </div>

      {/*
        `min-w-0` on the block and `truncate` on the label, because a flex item's
        automatic minimum is `min-content` — the same rule that let one admin
        table row resize its own columns (#389). `Logged in as` plus an address
        measures 239.25px and could not compress below it, so at 390 the pair
        reached `right=406.78` and every `/admin` route reported
        `scrollWidth 407` against a 390 viewport: the whole document scrolled
        sideways, and the table was blamed for it. The `title` keeps the full
        address readable once the label starts eliding.
      */}
      <div className="flex min-w-0 items-center gap-4.5">
        {/*
          `stone-480`, not `stone-400` (#441). `stone-400` is a **border**
          value: the frames draw it on a light ground at thirty-nine sites and
          as text on ink at none. This header is `stone-900`, so its text reads
          from the ink-ground ramp minted in `aac9b3b` — 480, 520, 540, 560 —
          of which 480 is the lightest step.

          Frame `13` does draw this line at `stone-400`'s own value. That is the
          frame naming a colour rather than a role, and the two steps are three
          units apart, so the line renders as it did and only its meaning
          changes. This is the product's one instance, which is why it rides
          with the footer rather than with the admin tickets.
        */}
        <span className="truncate text-action text-stone-480" title={email}>
          Logged in as {email}
        </span>
        <AccountMenu
          name={name}
          avatarUrl={null}
          dashboardLabel={DASHBOARD_LABEL_BY_ROLE.admin}
          dashboardHref={DASHBOARD_PATH_BY_ROLE.admin}
          tone="dark"
        />
      </div>
    </header>
  );
}
