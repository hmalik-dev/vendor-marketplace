import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

/*
 * The five variants in design/design-plan/03-components.md. Copy is imperative
 * and specific, 2-4 words — "Request booking", "Save changes" — never "Submit"
 * and never a bare "Continue".
 *
 * The focus ring is the product's warm glow, never browser blue, and the
 * hover/active transforms are decorative, so `motion-reduce` drops them while
 * the colour change (which carries the state) survives.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-base font-semibold whitespace-nowrap transition-all duration-(--duration-fast) outline-none select-none focus-visible:ring-2 focus-visible:ring-clay-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // The one action the screen exists for. Clay is a fill: white text on
        // clay-400, never clay as the text colour.
        primary:
          'bg-clay-400 text-stone-0 shadow-sm hover:bg-clay-500 hover:shadow-md active:bg-clay-600 motion-safe:hover:scale-[1.02] motion-safe:active:scale-[.98]',
        // The alternative.
        secondary:
          'border-stone-300 bg-stone-0 text-stone-900 hover:bg-stone-150 motion-safe:active:scale-[.98]',
        // "View all ->" and other tertiary actions. No fill, no border.
        ghost: 'text-clay-500 hover:text-clay-600 hover:underline underline-offset-4',
        // "Join as a vendor" in the marketing header only.
        ink: 'rounded-full bg-stone-900 text-stone-50 hover:bg-stone-700 motion-safe:hover:scale-[1.02] motion-safe:active:scale-[.98]',
        // Irreversible only; always behind an AlertDialog, never the primary action.
        destructive:
          'bg-error-500 text-stone-0 hover:brightness-110 motion-safe:active:scale-[.98]',
      },
      size: {
        // px-5 py-2.5 per 03-components.md; the height follows the type rather
        // than being pinned, so a 13.5px label sits on a 40px control.
        default: 'gap-2 px-5 py-2.5',
        sm: "gap-1.5 rounded-md px-3 py-1.5 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'gap-2 px-6 py-3 text-md',
        icon: 'size-11',
        'icon-sm': 'size-9',
      },
    },
    /*
     * Ink carries its own horizontal padding — 18px, not the 20px every other
     * default-size button uses (03-components.md, and frame `01` draws the
     * same). It has to be a compound rather than part of the variant, because
     * cva emits `size` after `variant` and `px-5` would otherwise win.
     */
    compoundVariants: [{ variant: 'ink', size: 'default', class: 'px-4.5' }],
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'primary',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
