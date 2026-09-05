/*
 * Vitest replaces `next build`, and `next build` is what inlines every
 * `NEXT_PUBLIC_*` value into the bundle a component reads. Checkout reads its
 * Stripe key at import time — deliberately, so a build cannot ship an empty one
 * — which without a stand-in fails that whole file on a machine whose shell
 * happens not to carry `.env`.
 *
 * Only ever a stand-in: `??=` leaves a real value alone, and it is confined to
 * the one key a module reads eagerly, so a test that stubs its own environment
 * still sees its own value.
 */
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??= 'pk_test_vitest0000000000000000';

/**
 * jsdom implements neither of these, and Radix and cmdk call both on mount —
 * without them every popover-backed component throws before it can render.
 */
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

/**
 * The storefront editor's section rail observes its sections to highlight the
 * one being read. jsdom has no implementation, so the component throws on
 * mount and takes the whole form's test file with it.
 */
if (!('IntersectionObserver' in globalThis)) {
  globalThis.IntersectionObserver = class {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: readonly number[] = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  };
}

/*
 * Everything below patches the DOM, and this file is the whole suite's setup —
 * so it also runs for a file that opts into the **node** environment with
 * `@vitest-environment node`, where `Element` and `window` do not exist and a
 * bare reference is a `ReferenceError` that fails the suite before its first
 * test. `api-client.deadline.test.ts` is such a file, deliberately: the
 * deadline it covers is armed only when there is no `window`, so asserting it
 * under jsdom would assert the opposite of the claim.
 */
if (typeof Element !== 'undefined') {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView(): void {};
  }

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = function hasPointerCapture(): boolean {
      return false;
    };
    Element.prototype.setPointerCapture = function setPointerCapture(): void {};
    Element.prototype.releasePointerCapture = function releasePointerCapture(): void {};
  }
}

/*
 * jsdom implements no media queries at all, so any component that asks the
 * viewport a question throws rather than answering. The search shell asks
 * whether it is past `lg`, because its Refine panel is a modal sheet below that
 * width and the ordinary inline bar above it — and a sheet that stayed modal
 * across the breakpoint would leave `aria-modal` and a focus trap on the
 * desktop bar.
 *
 * Reports "not matching", which is the small-viewport answer and therefore the
 * one that leaves sheet behaviour on for the suites that exercise it.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = function matchMedia(query: string): MediaQueryList {
    return {
      matches: false,
      media: query,
      onchange: null,
      addEventListener(): void {},
      removeEventListener(): void {},
      addListener(): void {},
      removeListener(): void {},
      dispatchEvent(): boolean {
        return false;
      },
    } as MediaQueryList;
  };
}
