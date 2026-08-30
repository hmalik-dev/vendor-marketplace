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
if (!window.matchMedia) {
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
