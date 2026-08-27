import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface VendorSurfaceProps {
  eyebrow: string;
  heading: string;
  description: string;
  /** Rendered opposite the heading — status, a primary action, or both. */
  aside?: ReactNode;
  /**
   * App shells fill the viewport below the header and scroll their panes
   * internally (design/design-plan/04-laws.md, scroll budget 1.0×). Surfaces that are
   * legitimately taller than one screen leave this off.
   */
  fills?: boolean;
  children: ReactNode;
}

/**
 * The frame the vendor's management surfaces share: one heading block, one
 * aside, and the working area below. Kept in one place so packages, portfolio,
 * and availability cannot drift into three slightly different headers.
 */
export function VendorSurface({
  eyebrow,
  heading,
  description,
  aside,
  fills = false,
  children,
}: VendorSurfaceProps): React.ReactElement {
  return (
    <div
      // The attribute is what `globals.css` keys the footer rule off: an app
      // shell owns the whole viewport, so the marketing footer below it would
      // push the page past its 1.0x scroll budget.
      data-app-shell={fills ? '' : undefined}
      className={cn('flex w-full flex-col px-4 py-6 sm:px-6 lg:px-8', fills && 'lg:app-shell')}
    >
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div className="max-w-prose">
          <p className="text-[10.5px] font-semibold tracking-[.05em] text-stone-600 uppercase">
            {eyebrow}
          </p>
          {/* App page titles cap at 26px — a display-lg heading in an app frame is a bug. */}
          <h1 className="mt-1 font-display text-display-md text-stone-900">{heading}</h1>
          <p className="mt-1 text-sm text-stone-600">{description}</p>
        </div>
        {aside}
      </header>

      <div className={cn('mt-5', fills && 'min-h-0 flex-1')}>{children}</div>
    </div>
  );
}
