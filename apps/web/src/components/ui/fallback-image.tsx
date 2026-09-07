'use client';

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The one image fallback (#422).
 *
 * **An absent image and a failed one look identical to the person reading, so
 * they land in the same place.** The app already handled *absent* — a published
 * vendor with no `coverImageUrl` got the tone block, per D17 — and handled
 * *failure* nowhere: a stored key whose object is gone, an R2 outage, or a
 * category photograph that was never shipped all rendered the browser's
 * broken-image glyph on a public page.
 *
 * What the design rules, and what is deliberately **not** invented here:
 *
 * - **D17 / D18, frame `26 State library`** — a neutral tone block at
 *   `stone-250` (`#ece6dc`), the image's exact dimensions and the container's
 *   own radius, and *nothing inside it*.
 * - **No hatch, no label, no icon.** `03-components.md` and `40-states.md` both
 *   mark the hatch "never on a public page": it is a build-time device for
 *   photography *the product* lacks, and the person reading is not the person
 *   who can fix it.
 * - **Avatars keep their own fallback** — `clay-150`/`sage-100` behind a
 *   monogram (D24), not a tone block. `Avatar` gets there through
 *   `useImageFailure` directly; the bookings card's 9px squircle passes its
 *   monogram as `fallback`.
 *
 * Two rendering paths need covering and they are not interchangeable:
 * `next/image` (the stock and category art, via `StockPhoto`) and plain `<img>`
 * (bucket content, which skips `next/image` deliberately because the host
 * changes between environments). Both consume `useImageFailure` and
 * `ImageFallback` below, so there is one mechanism and two thin adapters rather
 * than two implementations that can drift.
 *
 * `image-sites.test.ts` is what makes acceptance 5 real: a new `<img>` or
 * `next/image` anywhere under `apps/web/src` fails that guard unless it goes
 * through one of these, so a new image site inherits the fallback without
 * anyone remembering to opt in.
 */

/** D17's image ground. One place, so a call site cannot spell it differently. */
export const IMAGE_FALLBACK_GROUND = 'bg-stone-250';

export interface ImageFailure {
  /** Whether *this* `src` has failed to load. */
  failed: boolean;
  /** Hand to the image's `onError`. */
  onError: () => void;
  /**
   * Hand to the image's `ref`.
   *
   * `onError` alone is not enough on a server-rendered page: the browser starts
   * fetching the `<img>` in the streamed HTML, and a 404 can land *before*
   * React hydrates, so no handler is attached when the event fires and it is
   * never replayed. A completed image with no intrinsic width is a failed one —
   * this catches exactly the case the handler slept through.
   */
  ref: (node: HTMLImageElement | null) => void;
}

/**
 * Tracks failure **by `src` rather than as a boolean**, so a component whose
 * `src` changes — a reordered portfolio tile, a replaced cover — is not left
 * showing the fallback for an image that never failed.
 */
export function useImageFailure(src: string | null | undefined): ImageFailure {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const markFailed = useCallback(() => {
    setFailedSrc(src ?? null);
  }, [src]);

  const ref = useCallback(
    (node: HTMLImageElement | null) => {
      if (node && node.complete && node.naturalWidth === 0) {
        markFailed();
      }
    },
    [markFailed],
  );

  return {
    failed: src != null && src !== '' && failedSrc === src,
    onError: markFailed,
    ref,
  };
}

export interface ImageFallbackProps {
  /** Extent and radius — the block must hold the image's exact box. */
  className?: string;
  style?: CSSProperties;
}

/**
 * The tone block itself. Decorative by construction: it stands in for an image
 * nobody can see, so there is nothing for a screen reader to announce.
 *
 * **The ground is appended last, and that is deliberate.** `cn` is
 * tailwind-merge, so the later of two conflicting classes wins — and the
 * classes reaching here are the *image's*, which routinely carry a loading
 * ground of their own (`bg-stone-200` on a portfolio tile). Put the ruled
 * `stone-250` first and any such class silently overrides D17, with the block
 * still passing every assertion about being a block. Caught exactly that way
 * on the portfolio tile while building this. A site whose fallback is ruled
 * differently passes its own element as `fallback` rather than recolouring
 * this one.
 */
export function ImageFallback({ className, style }: ImageFallbackProps): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      data-slot="image-fallback"
      className={cn('block', className, IMAGE_FALLBACK_GROUND)}
      style={style}
    />
  );
}

export interface FallbackImageProps {
  /** Absent (`null`, `undefined`, `''`) and failed both render the fallback. */
  src: string | null | undefined;
  alt: string;
  /**
   * Classes shared by the photograph and its fallback. This is where extent and
   * radius belong — a tone block on a zero-height box has replaced nothing.
   */
  className?: string;
  /** The photograph only — `object-cover`, hover transforms. */
  imageClassName?: string;
  /** The fallback only. */
  fallbackClassName?: string;
  /**
   * Replaces the tone block outright, for the sites the design rules
   * differently: the bookings card's monogram squircle.
   */
  fallback?: ReactNode;
  style?: CSSProperties;
  draggable?: boolean;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
}

/**
 * The plain-`<img>` adapter: bucket content on a host `next/image` has no
 * per-environment remote pattern for.
 */
export function FallbackImage({
  src,
  alt,
  className,
  imageClassName,
  fallbackClassName,
  fallback,
  style,
  draggable,
  onClick,
}: FallbackImageProps): React.ReactElement {
  const failure = useImageFailure(src);

  if (!src || failure.failed) {
    return (
      <>
        {fallback ?? <ImageFallback className={cn(className, fallbackClassName)} style={style} />}
      </>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the file docblock
    <img
      ref={failure.ref}
      src={src}
      alt={alt}
      onError={failure.onError}
      onClick={onClick}
      draggable={draggable}
      style={style}
      className={cn(className, imageClassName)}
    />
  );
}
