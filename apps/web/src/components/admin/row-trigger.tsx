'use client';

import { forwardRef } from 'react';

/**
 * The `···` control frame `13` draws in the table's last column.
 *
 * `forwardRef`, because it is always the child of a Radix `Trigger` with
 * `asChild` — which needs to attach both a ref and its own handlers, and
 * silently loses the ref on a plain function component.
 */
export const RowTrigger = forwardRef<HTMLButtonElement, { label: string }>(function RowTrigger(
  { label, ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type="button"
      aria-label={label}
      /*
       * 70x44 — comfortably past the 44x44 `04-laws.md` requires of an
       * icon-only control, which this was failing at 32x32.
       *
       * It fills the cell and right-aligns the glyph rather than centring a
       * 44px square: the frame draws `···` flush with the cell's right edge, and
       * a centred button put the dots 20px left of it.
       *
       * No `focus-visible:outline-*`: `outline-style` defaults to `none`, so
       * those declarations painted nothing at all. The ring that actually
       * renders is the global `:focus-visible` treatment in `globals.css`.
       */
      className="flex h-11 w-full items-center justify-end rounded-md pr-0 text-stone-600 hover:bg-stone-150 hover:text-stone-900"
    >
      <span aria-hidden="true">···</span>
    </button>
  );
});
