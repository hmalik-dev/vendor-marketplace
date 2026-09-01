import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Logo, LOGO_SIZES } from '@/components/brand/logo';

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
 * The avatar is the shared `Avatar` at its `xs` step — the 30px frame `13`
 * draws — with the ground and the initial swapped for the inverted pair the
 * frame uses. The colours are an override rather than a new tone: the fallback
 * ramp exists to distinguish *people* from each other, and there is exactly one
 * operator in this header.
 */
export function AdminHeader({ email, name }: AdminHeaderProps): React.ReactElement {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center justify-between border-b border-stone-800 bg-stone-900 px-8">
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
            other header obeys it. The trade this makes is recorded, so a later
            parity pass does not re-find it as new — 15 renders the mark at the
            frame's exact 22 x 15 and the wordmark at 24px against the frame's
            23px, because `WORDMARK_SIZE_RATIO` is a plan law (1.60 D) that ten
            desktop frames contradict at 1.533. That disagreement is #118's, and
            `logo.tsx` already adjudicates it the same way.
          */}
          <Logo tone="dark" size={LOGO_SIZES.desktopHeader} />
        </Link>
        <span className="ml-1 rounded-[5px] bg-stone-0/12 px-2 py-1 text-xs font-semibold tracking-[.06em] text-clay-150 uppercase">
          Admin
        </span>
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
        <span className="truncate text-action text-stone-400" title={email}>
          Logged in as {email}
        </span>
        <Avatar name={name} size="xs" className="bg-stone-700 text-clay-150" />
      </div>
    </header>
  );
}
