'use client';

import { useEffect, useState } from 'react';
import { SUPPORT_PATH } from '@vendor-marketplace/shared';
import { Logo, LOGO_SIZES } from '@/components/brand/logo';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { scrubbedRoute, supportLink } from '@/lib/support-link';

/**
 * Frame `16`. Shared by `error.tsx` and `global-error.tsx` so the two cannot
 * drift — the only difference between them is the shell around this, which
 * `global-error.tsx` has to supply itself because it replaces the root layout.
 *
 * Two things a user needs from a server error and rarely gets: confirmation
 * that no money moved, and a reference they can paste to support.
 *
 * **It draws its own chrome, and takes the site's away.** Frame `16` is a
 * bespoke 64px header — the wordmark and one link to a human — over a centred
 * column, with **no site footer and no marketplace navigation**. That is the
 * whole point of the screen: a reader whose page has just crashed is offered
 * one route out, not the ordinary navigation of an application they have
 * already watched fail. Leaving the shell up also made the page scroll
 * (`scrollHeight` measured 964 against a 900 viewport), so the recovery
 * controls sat below the fold on the one screen that exists to offer them.
 *
 * `data-error-screen` is how the shell comes down. `error.tsx` renders
 * *underneath* the root layout — the header and footer are its siblings, above
 * it in the tree — so nothing this component returns can remove them. The
 * attribute is a hook for one `:has()` rule in `globals.css`, which is why this
 * works identically on a server-rendered throw and a client one: there is no
 * effect, no store and no hydration pass between the crash and the correct
 * screen. `global-error.tsx` replaces the root layout outright and has no site
 * chrome to hide, so the same markup is right there for a different reason.
 */
export interface ErrorScreenProps {
  /**
   * Next's `error.digest` — the hash it also writes to the server log, so the
   * two can be matched. Absent for an error thrown while rendering on the
   * client, where nothing was logged server-side to match against.
   */
  digest?: string;
  reset: () => void;
  /**
   * Whether this screen draws the 64px header itself. `true` everywhere but
   * checkout.
   *
   * `bookings/[requestId]/checkout/error.tsx` renders inside `checkout/layout.tsx`,
   * which already draws frame `05`'s wordmark bar — deliberately, so that every
   * render at that URL keeps the header the route promises, its `not-found` and
   * `error` boundaries included. A second bar there is 128px of chrome where the
   * frame draws 64, and `min-h-screen` under it forces exactly the scroll this
   * screen was rebuilt to remove.
   *
   * The marker stays either way: `public-chrome.tsx` already takes the site
   * header and footer off the checkout URL, so the rule keyed on it has nothing
   * to hide there — but a route that stops suppressing them should not silently
   * grow a marketplace footer under a crashed payment.
   */
  chrome?: boolean;
}

export function ErrorScreen({
  digest,
  reset,
  chrome = true,
}: ErrorScreenProps): React.ReactElement {
  /*
   * The route and the moment can only be read in the browser, and this screen
   * renders on the server too when the throw happened there — so the link
   * starts as the bare path and gains its context on mount. Both render the
   * same words, so nothing moves; what changes is whether the digest travels
   * with the visitor.
   *
   * `window.location`, not `usePathname`: this component is shared with
   * `global-error.tsx`, which replaces the root layout and therefore renders
   * outside the App Router context those hooks need — the same reason
   * `Browse vendors` below is an `<a>` rather than a `<Link>`.
   */
  const [href, setHref] = useState<string>(SUPPORT_PATH);

  useEffect(() => {
    setHref(
      supportLink(
        digest === undefined
          ? undefined
          : {
              digest,
              /*
                The query goes too — it says what broke — but scrubbed of
                anything credential-shaped. Clerk puts a single-use
                `__clerk_ticket` on the auth routes, and a crash there would
                otherwise have mailed it to support.
              */
              route: scrubbedRoute(window.location.pathname, window.location.search),
              occurredAt: new Date().toISOString(),
            },
      ),
    );
  }, [digest]);

  return (
    <div
      data-error-screen
      /*
        `min-h-screen` only when this screen owns the page: under checkout's own
        shell it is a `flex-1` child of a `min-h-dvh` column, so a second full
        viewport height there is one bar's worth of scroll by construction.
      */
      className={chrome ? 'flex min-h-screen flex-col' : 'flex flex-1 flex-col'}
    >
      {chrome ? (
        <>
          {/*
        The frame's own header: `.hd` at `--header-height`, on `stone-0` over a
        `stone-300` hairline, inset 40px rather than the shell's 32 — frame `16`
        overrides `padding:0 40px` on it.

        The mark is the site header's lockup, not the frame's. Frame `16` draws
        an 18px mark beside a 23px wordmark, a ratio of 1.28 against the 1.6
        `02-brand-and-logo.md` states as a law — so the 18 is drift, and the
        lockup every other header in the product draws is what belongs here.
      */}
          <header
            data-slot="error-header"
            className="flex h-(--header-height) flex-none items-center justify-between border-b border-stone-300 bg-stone-0 px-6 sm:px-10"
          >
            {/*
          An `<a>` rather than a `<Link>`, for the same reason as the two
          controls below: `global-error.tsx` renders this outside the App Router
          context `next/link` needs to mount, and that is the one case the
          reader is already looking at a crashed application.

          The disable is on the line rather than the file, and it is the shape
          `Browse vendors` predicted: `no-html-link-for-pages` resolves `/` to a
          real page and flags it, where `/search` satisfied the rule and needed
          none. The `<a>` is deliberate either way.
        */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see above */}
            <a href="/" className="flex items-center rounded-lg">
              <Logo size={LOGO_SIZES.desktopHeader} />
            </a>

            {/*
          The one route to a human, where the frame puts it. `/support` is a
          real screen (#421), and the link takes the digest, the route and the
          moment with it — so the visitor never has to do the copying the
          reference line below asks for.
        */}
            <a href={href} className="text-base font-semibold text-clay-500 hover:underline">
              Contact support
            </a>
          </header>
        </>
      ) : null}

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center sm:px-10">
        <span
          aria-hidden="true"
          className="mb-6 flex size-11.5 items-center justify-center rounded-full bg-error-50"
        >
          <span className="size-4.5 rounded-full bg-error-500" />
        </span>

        <p className="font-mono text-label font-medium tracking-[.16em] text-stone-600 uppercase">
          500 · Server error
        </p>

        {/*
          38px, `text-display-error` — the size frames `15` and `16` both draw a
          full-page error headline at. It was `display-lg`'s 34.
        */}
        <h1 className="mt-3 font-display text-display-error tracking-[-.015em] text-stone-900">
          Something broke on our end
        </h1>

        {/*
          14px at 1.65, which is `text-cta` — the frame's body size, where this
          read `text-sm`'s 12.5. Straight apostrophes, per the ruling in
          `31-content-voice.md`.
        */}
        <p className="mt-3 max-w-[460px] text-cta leading-[1.65] text-stone-700">
          This wasn&apos;t anything you did. We&apos;ve been notified and we&apos;re looking at it.
        </p>

        {/*
          The money position, stated even though the answer is "nothing" —
          `40-states.md` §1 question 2. Sage because it is settled, not because it
          is good news.

          The shared `Banner`, bordered. Frame `16` draws this one strip
          borderless and no other frame does; ruled 2026-09-06 in
          `03-components.md` — the component wins and the frame is corrected.
        */}
        <Banner status="settled" className="mt-5.5 text-left">
          No payment was taken and no booking was changed.
        </Banner>

        <div className="mt-6.5 flex flex-wrap justify-center gap-3">
          {/* Most 500s are transient, so retrying the segment is the primary action. */}
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Button asChild variant="secondary">
            {/*
              A hard navigation, deliberately. This screen is shared with
              `global-error.tsx`, which replaces the **root layout** and therefore
              renders outside the App Router context that `next/link` needs to
              mount — a `<Link>` here works in `error.tsx` and throws in the one
              case the user is already looking at a crashed application.

              The rule stopped resolving the destination to a page when the hub
              moved into a route group, so it began flagging what it had always
              been fine with; the reasoning below is why the answer is a comment
              rather than a `<Link>`.
            */}
            {/*
              D17: this screen cannot know who is reading it. `Go to my bookings`
              is addressed to a signed-in customer and is a dead end for anyone
              else — a signed-out visitor lands on a sign-in wall and a vendor on
              a hub that is not theirs. `/search` is the one destination true for
              every reader. Frame `16`.

              No `eslint-disable` here, unlike the destination this replaced:
              `no-html-link-for-pages` resolves `/search` to a real page and is
              satisfied by it. The `<a>` is still deliberate for the reason
              above — if the rule ever starts flagging it, the disable comes back
              rather than the `<a>` becoming a `<Link>`.
            */}
            <a href="/search">Browse vendors</a>
          </Button>
        </div>

        {/*
          Only rendered when there is a real digest to show. A reference the
          support inbox cannot look up is worse than none, so a decorative id is
          never invented to fill the space.
        */}
        {digest ? (
          <p className="mt-6.5 text-[12.5px] text-stone-600">
            Reference{' '}
            <span className="rounded-[5px] bg-stone-150 px-1.75 py-0.75 font-mono text-meta text-stone-700 select-all">
              {digest}
            </span>{' '}
            — include this if you write to us
          </p>
        ) : null}

        {/*
          The route to a human, for the one composition that has no header to
          put it in. Checkout draws its own bar and there is no room on it —
          frame `05` is "no nav, nothing competes with finishing" — so the link
          sits under the reference here, which is where #421 put it on every 500
          before this screen had a header of its own.

          Never both: the header's copy is the same link, and two on one screen
          is the defect the `carries exactly one route to a human` test pins.
        */}
        {chrome ? null : (
          <p className="mt-3 text-[12.5px]">
            <a
              href={href}
              className="font-semibold text-clay-500 underline-offset-4 hover:text-clay-600 hover:underline"
            >
              Contact support
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
