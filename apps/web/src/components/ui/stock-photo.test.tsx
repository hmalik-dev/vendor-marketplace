import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StockPhoto } from './stock-photo';

/*
 * The `next/image` half of #422, and the half that had a real-world failure to
 * its name: `StockPhoto` draws the landing page's category cards from
 * `/categories/<slug>.jpg`, built from a constant at render time — so `next
 * build` cannot see it, and a category promoted without its photograph was a
 * broken glyph on the front door. Found 2026-09-06 when `carts` had no art.
 *
 * `landing-category-art.test.ts` guards that the files ship. This is the net
 * under it, for the cases a repository guard cannot reach at all — a file
 * deleted after deploy, a CDN failing, a request that simply does not arrive.
 *
 * jsdom fetches nothing, so `fireEvent.error` stands in for the browser's own
 * event; `e2e/image-fallback.spec.ts` routes a real request to a 404 in
 * Chromium and measures the block's rendered box.
 */
afterEach(() => {
  cleanup();
});

function renderPhoto(className: string) {
  return render(<StockPhoto src="/categories/carts.jpg" sizes="200px" className={className} />);
}

describe('StockPhoto', () => {
  it('draws the photograph while it loads fine', () => {
    const { container } = renderPhoto('h-[94px] w-full');

    expect(container.querySelector('img')).not.toBeNull();
    expect(container.querySelector('[data-slot="image-fallback"]')).toBeNull();
  });

  it('replaces a photograph that fails to load with the ruled tone block', () => {
    const { container } = renderPhoto('h-[94px] w-full');

    fireEvent.error(container.querySelector('img')!);

    const block = container.querySelector('[data-slot="image-fallback"]');

    expect(container.querySelector('img')).toBeNull();
    expect(block?.className).toContain('bg-stone-250');
    /* Nothing inside it — no hatch, no label, no icon (D17). */
    expect(block?.textContent).toBe('');
    expect(block?.children).toHaveLength(0);
  });

  it('leaves the caller box untouched, so a failed card does not reflow the grid', () => {
    const { container } = renderPhoto('h-[94px] w-full');

    const wrapper = container.firstElementChild as HTMLElement;
    const before = wrapper.className;

    fireEvent.error(container.querySelector('img')!);

    expect(wrapper.className).toBe(before);
    expect(before).toContain('h-[94px]');
    /*
     * `fill` positioned the photograph absolutely inside that box; the block
     * takes the same positioning, so it covers the wrapper rather than
     * collapsing to nothing. jsdom performs no layout, so this is the
     * class-level fact — the rendered geometry is measured in the e2e spec.
     */
    expect(container.querySelector('[data-slot="image-fallback"]')?.className).toContain(
      'absolute inset-0',
    );
  });
});

/*
 * The pre-hydration failure, on the adapter it matters most for.
 *
 * The landing page's category art is server-rendered and eager, so the browser
 * starts the fetch from the streamed HTML and a 404 can land before React
 * attaches `onError` — an event that is never replayed. `useImageFailure`'s
 * ref reads the only evidence left: an image the browser has finished with and
 * could not decode.
 *
 * Kept as its own case because it is what a Next upgrade would break silently.
 * `next/image` forwards `ref` to the underlying element today; if it stopped,
 * the front door would be where that was discovered.
 */
describe('StockPhoto, when the photograph failed before hydration', () => {
  it('reads a completed, undecodable image as a failure', () => {
    const complete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'complete');
    const width = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'naturalWidth');

    Object.defineProperty(HTMLImageElement.prototype, 'complete', {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
      configurable: true,
      get: () => 0,
    });

    try {
      const { container } = renderPhoto('h-[94px] w-full');

      expect(container.querySelector('img')).toBeNull();
      expect(container.querySelector('[data-slot="image-fallback"]')?.className).toContain(
        'bg-stone-250',
      );
    } finally {
      if (complete) Object.defineProperty(HTMLImageElement.prototype, 'complete', complete);
      if (width) Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', width);
    }
  });
});
