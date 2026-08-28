import { BRAND_NAME } from '@vendor-marketplace/shared';

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
 * The wordmark pulses 0.4 → 1 → 0.4 over 2s rather than spinning: at page
 * scope there is nothing yet to spin beside, and the brand is the one thing
 * that is certainly correct before the data arrives.
 */
export function PageLoader(): React.ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[520px] flex-1 items-center justify-center"
    >
      <span className="font-display text-display-md text-clay-500 motion-safe:animate-wordmark-pulse">
        {BRAND_NAME}
      </span>
      <span className="sr-only">Loading</span>
    </div>
  );
}
