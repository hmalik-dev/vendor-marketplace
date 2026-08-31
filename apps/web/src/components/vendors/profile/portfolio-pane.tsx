'use client';

import type { WirePortfolioItem } from '@/lib/wire-schemas';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null ? null : (current + delta + items.length) % items.length,
      ),
    [items.length],
  );

  useEffect(() => {
    if (openIndex === null) {
      return;
    }

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        close();
      }
      if (event.key === 'ArrowRight') {
        step(1);
      }
      if (event.key === 'ArrowLeft') {
        step(-1);
      }
    };

    document.addEventListener('keydown', onKey);

    // The page behind must not scroll under the backdrop.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, close, step]);

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
              onClick={() => setOpenIndex(index)}
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
          role="dialog"
          aria-modal="true"
          aria-label={open.caption ?? 'Portfolio image'}
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
