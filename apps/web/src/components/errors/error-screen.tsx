'use client';

import { useEffect, useState } from 'react';
import { SUPPORT_PATH } from '@vendor-marketplace/shared';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { supportLink } from '@/lib/support-link';

/**
 * Frame `16`. Shared by `error.tsx` and `global-error.tsx` so the two cannot
 * drift — the only difference between them is the shell around this, which
 * `global-error.tsx` has to supply itself because it replaces the root layout.
 *
 * Two things a user needs from a server error and rarely gets: confirmation
 * that no money moved, and a reference they can paste to support.
 */
export interface ErrorScreenProps {
  /**
   * Next's `error.digest` — the hash it also writes to the server log, so the
   * two can be matched. Absent for an error thrown while rendering on the
   * client, where nothing was logged server-side to match against.
   */
  digest?: string;
  reset: () => void;
}

export function ErrorScreen({ digest, reset }: ErrorScreenProps): React.ReactElement {
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
              route: `${window.location.pathname}${window.location.search}`,
              occurredAt: new Date().toISOString(),
            },
      ),
    );
  }, [digest]);

  return (
    <div className="mx-auto flex min-h-[620px] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <span
        aria-hidden="true"
        className="mb-6 flex size-11.5 items-center justify-center rounded-full bg-error-50"
      >
        <span className="size-4.5 rounded-full bg-error-500" />
      </span>

      <p className="font-mono text-label font-medium tracking-[.16em] text-stone-600 uppercase">
        500 · Server error
      </p>

      <h1 className="mt-3 font-display text-display-lg tracking-[-.015em] text-stone-900">
        Something broke on our end
      </h1>

      <p className="mt-3 max-w-[460px] text-sm leading-[1.65] text-stone-700">
        This wasn&rsquo;t anything you did. We&rsquo;ve been notified and we&rsquo;re looking at it.
      </p>

      {/*
        The money position, stated even though the answer is "nothing" —
        `40-states.md` §1 question 2. Sage because it is settled, not because it
        is good news.
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
          <span className="rounded-[5px] bg-stone-150 px-1.75 py-0.75 font-mono text-xs text-stone-700 select-all">
            {digest}
          </span>{' '}
          — include this if you write to us
        </p>
      ) : null}

      {/*
        Frame `16` draws this in a bespoke 64px header, which is #372's work;
        it sits under the reference here because that is what it carries. The
        link takes the digest, the route and the moment with it, so the visitor
        never has to do the copying the line above asks for — which is the whole
        argument for a form over a `mailto:` (frame `29`).

        An `<a>` for the same reason as `Browse vendors`: `global-error.tsx`
        renders this outside the App Router context `next/link` needs.
      */}
      <p className="mt-3 text-[12.5px]">
        <a
          href={href}
          className="font-semibold text-clay-500 underline-offset-4 hover:text-clay-600 hover:underline"
        >
          Contact support
        </a>
      </p>
    </div>
  );
}
