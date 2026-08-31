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
      className="flex size-8 items-center justify-center rounded-md text-stone-600 hover:bg-stone-150 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-400"
    >
      <span aria-hidden="true">···</span>
    </button>
  );
});
