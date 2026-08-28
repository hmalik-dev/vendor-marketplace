/**
 * The page-scope loader — first paint and auth redirects only, per the loading
 * table in `40-states.md`. Anything smaller than a whole page uses a skeleton
 * or an element spinner instead; two idioms on one screen is the bug that
 * table exists to prevent.
 *
 * **Mount it as a segment's `loading.tsx`, never the root's.** A `loading.tsx`
 * is a Suspense boundary, and Next streams anything inside one: the 200 shell
 * flushes before the page finishes, so a later `notFound()` cannot set the
 * status. At the root that silently turned every `notFound()` in the app into
 * a soft 404. `loading-boundaries.test.ts` enforces the rule.
 *
 * **The mark's geometry, and no text at all.** This is the one surface that
 * renders before webfonts are guaranteed, and a wordmark in a fallback serif
 * is a worse first impression than no wordmark — so frame `26` replaced the
 * pulsing wordmark with the logo's two rings converging and parting.
 */
export function PageLoader(): React.ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[520px] flex-1 items-center justify-center"
    >
      {/*
        52x30 holding two 30px rings that overlap by 8px — the mark's own
        construction, at the size frame `26` draws it.
      */}
      <span aria-hidden="true" className="relative block h-7.5 w-13">
        <span className="absolute top-0 left-0 size-7.5 rounded-full bg-clay-400 motion-safe:animate-mark-converge-left" />
        {/*
          `box-border` matters: the ring is drawn as a 2px border inside the
          same 30px, so without it the outlined ring would be 34px and sit a
          little low against its filled twin.
        */}
        <span className="absolute top-0 left-5.5 box-border size-7.5 rounded-full border-2 border-stone-900 motion-safe:animate-mark-converge-right" />
      </span>
      {/*
        The only text, and it is never painted: a loader that says nothing to a
        screen reader is a silent wait.
      */}
      <span className="sr-only">Loading</span>
    </div>
  );
}
