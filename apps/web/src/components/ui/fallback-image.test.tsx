import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FallbackImage, ImageFallback, IMAGE_FALLBACK_GROUND } from './fallback-image';

/*
 * jsdom fetches nothing, so an `<img>` here never really 404s — `fireEvent.error`
 * is the event the browser would have dispatched, and it is the honest limit of
 * this file. **The real load failure is driven in `e2e/image-fallback.spec.ts`**,
 * which routes the image request to a 404 in Chromium and measures the block's
 * rendered box. `web-design-parity.md`: where a check cannot fail, assert the
 * class-level fact and say what is left unverified.
 */

afterEach(() => {
  cleanup();
});

function block(): HTMLElement | null {
  return document.querySelector('[data-slot="image-fallback"]');
}

/**
 * Replace jsdom's own `HTMLImageElement` accessors for one test, and hand back
 * the restore. jsdom decodes nothing, so `complete` and `naturalWidth` are the
 * only way to model an image the browser has already finished with.
 */
function stub(getters: Record<string, () => unknown>): () => void {
  const originals = Object.entries(getters).map(([name, get]) => {
    const previous = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, name);
    Object.defineProperty(HTMLImageElement.prototype, name, { configurable: true, get });
    return [name, previous] as const;
  });

  return () => {
    for (const [name, previous] of originals) {
      if (previous) {
        Object.defineProperty(HTMLImageElement.prototype, name, previous);
      } else {
        Reflect.deleteProperty(HTMLImageElement.prototype, name);
      }
    }
  };
}

describe('ImageFallback', () => {
  it('is the ruled tone block and nothing else — no hatch, no label, no icon', () => {
    render(<ImageFallback className="aspect-[3/2] w-full" />);

    const fallback = block();

    expect(fallback).not.toBeNull();
    expect(fallback?.className).toContain(IMAGE_FALLBACK_GROUND);
    expect(fallback?.textContent).toBe('');
    expect(fallback?.children).toHaveLength(0);
  });

  /*
   * `cn` is tailwind-merge, and the classes arriving here are the image's —
   * which routinely carry a loading ground of their own. The ruled ground has
   * to win, or D17 is overridden by a class nobody thought was a colour
   * decision. The portfolio tile did exactly that while this was being built.
   */
  it('keeps the ruled ground even when the image carries one of its own', () => {
    render(<ImageFallback className="w-full bg-stone-200" />);

    expect(block()?.className).toContain(IMAGE_FALLBACK_GROUND);
    expect(block()?.className).not.toContain('bg-stone-200');
  });

  it('is decorative, so a reader is not told an image failed', () => {
    render(<ImageFallback />);

    expect(block()?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('FallbackImage', () => {
  it('renders the photograph while it is loading fine', () => {
    render(<FallbackImage src="/cover.jpg" alt="" className="size-full" />);

    expect(document.querySelector('img')?.getAttribute('src')).toBe('/cover.jpg');
    expect(block()).toBeNull();
  });

  /* Acceptance 1: a failed load renders the ruled fallback, not a browser glyph. */
  it('replaces a failed photograph with the tone block', () => {
    render(<FallbackImage src="/gone.jpg" alt="" className="size-full" />);

    fireEvent.error(document.querySelector('img')!);

    expect(document.querySelector('img')).toBeNull();
    expect(block()?.className).toContain(IMAGE_FALLBACK_GROUND);
  });

  /*
   * Acceptance 2, and the whole defect: the two paths differed. Rendered from
   * the same component with the same classes, an absent image and a failed one
   * are the same markup — not merely similar.
   */
  it.each([null, undefined, ''])(
    'renders an absent (%s) image the same way a failed one',
    (src) => {
      const absent = render(<FallbackImage src={src} alt="" className="aspect-[3/2] w-full" />);
      const absentHtml = absent.container.innerHTML;
      cleanup();

      const failed = render(
        <FallbackImage src="/gone.jpg" alt="" className="aspect-[3/2] w-full" />,
      );
      fireEvent.error(failed.container.querySelector('img')!);

      expect(failed.container.innerHTML).toBe(absentHtml);
    },
  );

  /*
   * Acceptance 3. jsdom performs no layout, so this asserts the class-level
   * fact — the extent classes reach the block — and the rendered geometry is
   * verified in Chromium by the e2e spec instead.
   */
  it('carries the image box and radius onto the block, so nothing reflows', () => {
    render(
      <FallbackImage
        src="/gone.jpg"
        alt=""
        className="aspect-[3/2] w-full rounded-[16px]"
        imageClassName="object-cover"
      />,
    );

    fireEvent.error(document.querySelector('img')!);

    const className = block()?.className ?? '';

    expect(className).toContain('aspect-[3/2]');
    expect(className).toContain('w-full');
    expect(className).toContain('rounded-[16px]');
    /* The photograph's own classes do not follow it into the block. */
    expect(className).not.toContain('object-cover');
  });

  it('takes a ruled fallback of another shape, for the sites D24 governs', () => {
    render(
      <FallbackImage src="/gone.jpg" alt="" fallback={<span data-slot="monogram">MF</span>} />,
    );

    fireEvent.error(document.querySelector('img')!);

    expect(screen.getByText('MF')).toBeDefined();
    expect(block()).toBeNull();
  });

  /*
   * Failure is tracked against the `src` that failed, not as a latched boolean:
   * a portfolio tile whose photograph is replaced must show the new one.
   */
  it('shows a replacement photograph rather than latching on the failure', () => {
    const { rerender } = render(<FallbackImage src="/gone.jpg" alt="" />);

    fireEvent.error(document.querySelector('img')!);
    expect(block()).not.toBeNull();

    rerender(<FallbackImage src="/present.jpg" alt="" />);

    expect(document.querySelector('img')?.getAttribute('src')).toBe('/present.jpg');
    expect(block()).toBeNull();
  });

  /*
   * The server-rendered case. The browser starts the fetch from the streamed
   * HTML, so a 404 can land before React hydrates and `onError` is never
   * attached in time — a completed image with no intrinsic width is the only
   * evidence left, and the `ref` reads it on mount.
   */
  it('catches a failure that landed before hydration attached the handler', () => {
    /*
     * jsdom's own accessors are captured and **restored**, not deleted.
     * Deleting them leaves `img.complete` as `undefined` for every test
     * appended after this one — falsy, so the ref check can never fire and a
     * later test would silently assert against a component stuck in the wrong
     * branch. Caught by `diff-reviewer`; it passed only because this happened
     * to be the last case in the file.
     */
    const restore = stub({ complete: () => true, naturalWidth: () => 0 });

    try {
      render(<FallbackImage src="/gone.jpg" alt="" className="size-full" />);

      expect(document.querySelector('img')).toBeNull();
      expect(block()).not.toBeNull();
    } finally {
      restore();
    }
  });

  it('leaves the image alone when a completed load really did decode', () => {
    /*
     * The other half of the same read, and what makes the one above a check:
     * `complete` is true for a *successful* load too, so only the zero
     * `naturalWidth` may stand in for failure.
     */
    const restore = stub({ complete: () => true, naturalWidth: () => 800 });

    try {
      render(<FallbackImage src="/present.jpg" alt="" className="size-full" />);

      expect(document.querySelector('img')).not.toBeNull();
      expect(block()).toBeNull();
    } finally {
      restore();
    }
  });
});
