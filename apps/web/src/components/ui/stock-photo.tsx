import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Licensed stock imagery standing in for the marketing photography a launch
 * needs — the hero cluster, the auth panel. It is **not** for vendor content:
 * a vendor's own cover, portfolio and avatar come out of the bucket and go
 * through `Avatar` / `VendorCard`, which deliberately skip `next/image`
 * because the bucket host changes between environments.
 *
 * These files are local to `public/stock`, so the loader needs no remote
 * pattern and the pages render offline. They are decorative: every one sits
 * behind or beside copy that already says what the page is about, so the alt
 * text is empty rather than a description a screen reader would read twice.
 *
 * Replace a file in place when real photography arrives — the component, the
 * sizes and the crops all stay.
 */
export interface StockPhotoProps {
  /** A path under `public/stock`, e.g. `/stock/florals.jpg`. */
  src: string;
  /** Sizing/positioning for the wrapper; the image fills it and is cropped. */
  className?: string;
  /** `sizes` for the responsive loader — the rendered width at each breakpoint. */
  sizes: string;
  /** Set on imagery above the fold so it is not lazy-loaded into a blank hero. */
  priority?: boolean;
}

export function StockPhoto({
  src,
  className,
  sizes,
  priority = false,
}: StockPhotoProps): React.ReactElement {
  return (
    // `overflow-hidden` is what makes the caller's radius clip the photograph;
    // the stone fill is what shows while it loads, so the shape is never blank.
    <div className={cn('relative overflow-hidden bg-stone-150', className)}>
      <Image src={src} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}
