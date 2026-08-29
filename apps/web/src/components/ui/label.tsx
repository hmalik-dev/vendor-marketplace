'use client';

import * as React from 'react';
import { Label as LabelPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        /*
         * The frames' `.lbl`: `font:600 10.5px`, `letter-spacing:.05em`,
         * `text-transform:uppercase`, `color:#6B6459`. Every token here already
         * existed for it — `--text-label`, `--tracking-label` (annotated
         * "`.lbl`, `.tl` — the uppercase micro-label") and `--color-stone-600`
         * — and the same four classes are the standing idiom in `rail.tsx`,
         * `dashboard-shell.tsx`, `vendor-surface.tsx` and `site-footer.tsx`.
         * The primitive was simply not using them.
         */
        'flex items-center gap-2 text-label leading-none font-semibold tracking-label text-stone-600 uppercase select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
