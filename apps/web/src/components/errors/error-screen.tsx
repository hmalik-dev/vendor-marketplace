'use client';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';

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

            The rule stopped resolving `/bookings` to a page when the hub moved
            into a route group, so it began flagging what it had always been
            fine with; the reasoning below is why the answer is a comment rather
            than a `<Link>`.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/bookings">Go to my bookings</a>
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
    </div>
  );
}
