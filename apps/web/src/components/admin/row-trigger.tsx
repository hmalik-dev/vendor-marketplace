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
       * 44x44, which `04-laws.md` requires of an icon-only control — it was
       * 32x32. The frame draws a 70px cell with `···` in it and says nothing
       * about the target, so the law is the only gate and it was unmet. The
       * glyph keeps the frame's size; the target grows around it.
       *
       * No `focus-visible:outline-*`: `outline-style` defaults to `none`, so
       * those declarations painted nothing at all. The ring that actually
       * renders is the global `:focus-visible` treatment in `globals.css`.
       */
      className="flex size-11 items-center justify-center rounded-md text-stone-600 hover:bg-stone-150 hover:text-stone-900"
    >
      <span aria-hidden="true">···</span>
    </button>
  );
});
