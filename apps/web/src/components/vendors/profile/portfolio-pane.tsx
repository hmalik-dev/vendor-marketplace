'use client';

import type { WirePortfolioItem } from '@/lib/wire-schemas';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';

export interface PortfolioPaneProps {
  /*
   * The wire shape, whose `imageUrl` is already resolved from a stored object
   * key — and is `null` when no image base is configured, which renders as no
   * image rather than as a broken one.
   */
  items: readonly WirePortfolioItem[];
  businessName: string;
}

/**
 * The Portfolio tab: a CSS-columns masonry that keeps each photograph's own
 * aspect ratio — a fixed grid would crop work the vendor framed deliberately.
 *
 * The lightbox is keyboard-complete: arrows step, Escape closes, and focus is
 * returned to the thumbnail that opened it so a keyboard user is not dropped at
 * the top of the page.
 */
export function PortfolioPane({ items, businessName }: PortfolioPaneProps): React.ReactElement {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  /*
   * The thumbnail that opened the lightbox, so focus can go back to it.
   *
   * A ref rather than `document.activeElement` read at close time: by then the
   * dialog holds focus, and closing on Escape from the last thumbnail in the
   * list is exactly the case where "wherever focus is now" is the wrong answer.
   */
  const opener = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null ? null : (current + delta + items.length) % items.length,
      ),
    [items.length],
  );

  /*
   * Keyed on *whether* the lightbox is open, never on which image it shows.
   *
   * `openIndex` in the dependencies tore the `keydown` listener down and
   * re-attached it — and re-wrote `body.style.overflow` — on every arrow press,
   * and would have taken focus back off whichever arrow the viewer was holding.
   * Neither `close` nor `step` varies with the index either: `close` is
   * `useCallback([])` and `step` depends only on `items.length`.
   */
  const isOpen = openIndex !== null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key === 'ArrowRight') {
        step(1);
        return;
      }
      if (event.key === 'ArrowLeft') {
        step(-1);
        return;
      }
      /*
       * The trap.
       *
       * `aria-modal="true"` is a *claim* that the rest of the page is inert,
       * and nothing in the browser makes it true. Without this, Tab walked
       * straight out of the lightbox and through the profile underneath the
       * scrim — every thumbnail, every tab, the booking rail — with the scrim
       * hiding whatever was focused.
       *
       * Wrapping at both ends rather than one: Shift+Tab off the first control
       * leaves by the other door and is the same defect.
       */
      if (event.key !== 'Tab') {
        return;
      }

      const focusable = dialog.current?.querySelectorAll<HTMLElement>('button');
      const first = focusable?.[0];
      const last = focusable?.[focusable.length - 1];
      if (!first || !last) {
        return;
      }

      /*
       * The container itself counts as "at the edge", in both directions.
       *
       * On open, focus sits on the dialog element — which has `tabIndex={-1}`
       * and so is not in the sequential order at all. Forward Tab happens to
       * walk into the dialog's own buttons, but **Shift+Tab from there falls
       * through to the browser default** and lands on the last thumbnail
       * *before* the dialog in the document: focus ends up on an invisible
       * control underneath the scrim, which is the whole defect this trap
       * exists to prevent.
       */
      const atStart = document.activeElement === first || document.activeElement === dialog.current;
      const atEnd = document.activeElement === last || document.activeElement === dialog.current;

      if (event.shiftKey && atStart) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && atEnd && document.activeElement !== dialog.current) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);

    // The page behind must not scroll under the backdrop.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    /*
     * The container, not the close button: it carries the dialog's accessible
     * name, so landing on it is what makes a screen reader announce which
     * image opened.
     */
    dialog.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      // Back to the thumbnail, so a keyboard user resumes where they were
      // instead of being dropped at the top of the page.
      opener.current?.focus();
    };
  }, [isOpen, close, step]);

  if (items.length === 0) {
    return (
      <EmptyState
        headline="No work published yet"
        description={`${businessName} hasn't added photographs. Their packages and availability are still here.`}
      />
    );
  }

  const open = openIndex === null ? null : items[openIndex];

  return (
    <>
      {/*
        Three columns is the widest the design goes: both `03 Vendor profile`
        (1440) and `27 Vendor profile — 1024` draw
        `grid-template-columns:repeat(3,1fr)`. `xl:columns-4` added a fourth from
        1280 that **no frame draws at any width** — the same `xl:`-is-1280 drift
        #322 corrects elsewhere, except here there was no wider frame for it to
        have come from.
      */}
      <ul className="columns-2 gap-3 md:columns-3 [&>li]:mb-3 [&>li]:break-inside-avoid">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={(event) => {
                opener.current = event.currentTarget;
                setOpenIndex(index);
              }}
              className="block w-full cursor-zoom-in overflow-hidden rounded-xl"
              aria-label={item.caption ?? `Open image ${index + 1} of ${items.length}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.thumbnailUrl ?? item.imageUrl ?? ''}
                alt={item.caption ?? ''}
                className="w-full bg-stone-200 object-cover transition-transform duration-(--duration-base) motion-safe:hover:scale-[1.02]"
              />
            </button>
          </li>
        ))}
      </ul>

      {open ? (
        <div
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-label={open.caption ?? 'Portfolio image'}
          // Programmatically focusable, not a tab stop: the effect above puts
          // focus here on open, and the trap keeps Tab among the controls.
          tabIndex={-1}
          onClick={close}
          className="fixed inset-0 z-(--z-modal) flex items-center justify-center bg-stone-900/90 p-6"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute top-5 right-5 cursor-pointer rounded-full bg-stone-0/10 p-2 text-stone-0 hover:bg-stone-0/20"
          >
            <X aria-hidden="true" className="size-5" />
          </button>

          {items.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(event) => {
                  event.stopPropagation();
                  step(-1);
                }}
                className="absolute left-5 cursor-pointer rounded-full bg-stone-0/10 p-2 text-stone-0 hover:bg-stone-0/20"
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(event) => {
                  event.stopPropagation();
                  step(1);
                }}
                className="absolute right-5 cursor-pointer rounded-full bg-stone-0/10 p-2 text-stone-0 hover:bg-stone-0/20"
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </button>
            </>
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={open.imageUrl ?? ''}
            alt={open.caption ?? ''}
            onClick={(event) => event.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      ) : null}
    </>
  );
}
