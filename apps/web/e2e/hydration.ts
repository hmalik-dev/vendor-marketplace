import type { Page } from '@playwright/test';

/**
 * Wait until React has taken over the server-rendered markup for a selector.
 *
 * `page.goto` resolves when the shell has loaded. The App Router streams the
 * rest of the route in afterwards and React renders it on the client, so
 * anything a spec does in that window is aimed at markup React does not own
 * yet: a `change` event reaches an input whose `onChange` is not attached, and
 * a `focus()` is dropped when the node it landed on is replaced.
 *
 * Neither failure looks like a race, which is why both were filed against the
 * product (VEN-387). The first reads as a vendor with no photographs — two
 * uploads lost in three runs on `/vendor/portfolio`, with no request reaching
 * `POST /upload/image` at all. The second reads as a field that paints no
 * focus ring, and reads it *stably*, so sampling twice agrees with itself.
 *
 * The signal is React's own bookkeeping: it stamps `__reactFiber$…` and
 * `__reactProps$…` onto every host node it owns, so a node carrying one has
 * been hydrated rather than merely parsed. Pass a selector for an element
 * *inside* the boundary being driven — the header is interactive long before
 * the route's own content is.
 *
 * **Every** match has to be React's, not merely one of them. Mid-swap the
 * route holds both copies of a control at once, and acting on the first
 * React-owned node fails with `strict mode violation: …resolved to 2
 * elements` instead. Requiring the whole set waits for the stale copy to go.
 */
export async function waitForHydration(page: Page, selector: string): Promise<void> {
  try {
    await page.waitForFunction(
      (target: string) => {
        const nodes = Array.from(document.querySelectorAll(target));

        return (
          nodes.length > 0 &&
          nodes.every((node) => Object.keys(node).some((key) => key.startsWith('__react')))
        );
      },
      selector,
      { timeout: 30_000 },
    );
  } catch (cause) {
    /*
     * A bare `waitForFunction: Timeout 30000ms exceeded` names nothing. The
     * reachable causes are: the route is still arriving; it redirected and the
     * selector is not on the page it landed on; or React renamed the properties
     * this reads, which makes the predicate permanently false — it fails
     * closed, but it still has to say so.
     */
    throw new Error(
      `React never took over ${selector} at ${page.url()}. Either the route did not ` +
        `finish arriving, it redirected somewhere that selector does not exist, or ` +
        `React no longer stamps __reactFiber$/__reactProps$ onto the nodes it owns.`,
      { cause },
    );
  }
}
