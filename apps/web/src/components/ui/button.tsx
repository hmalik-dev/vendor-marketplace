import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

/*
 * The five variants in design/design-plan/03-components.md. Copy is imperative
 * and specific, 2-4 words — "Request booking", "Save changes" — never "Submit"
 * and never a bare "Continue".
 *
 * The focus ring is the product's warm glow, never browser blue, and the
 * hover/active transforms are decorative, so `motion-reduce` drops them while
 * the colour change (which carries the state) survives.
 *
 * **The transition is an explicit property list, never `transition-all` (#73).**
 * Tailwind v4 registers `--tw-ring-shadow` and friends as animatable custom
 * properties, so `transition-all` animates the focus ring *in* over 150ms. A
 * parity pass measured the ring on this primitive as "five all-transparent
 * entries and `outline: 3px none`" and read it as a broken ring; re-measured
 * across the transition it paints correctly at 250ms. It was never broken —
 * it was 0% of the way through an animation nobody asked for.
 *
 * That is still a defect, just a smaller one than it looked: every keyboard
 * stop spends 150ms with no visible indicator, which is exactly the population
 * the ring exists for. `04-laws.md` already draws the line — functional
 * transitions survive, decorative ones do not — and a focus indicator is
 * functional, so it arrives at once while hover and the scale keep their ease.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-base font-semibold whitespace-nowrap transition-[color,background-color,border-color,opacity,transform,translate,scale,rotate,filter] duration-(--duration-fast) outline-none select-none focus-visible:ring-2 focus-visible:ring-clay-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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
        /*
         * `text-action` rather than the base `text-base`: frame `01 Landing`
         * draws the sign-up pill at 13px (#83). `ink` is the marketing
         * header's sign-up action and lives nowhere else, so the step lands on
         * exactly the one control the frame measures.
         *
         * `border-0` for the last 2px in each axis. The frame draws a bare
         * span, while the button base carries `border border-transparent` —
         * invisible, but 1px on every side, which is the whole of the residual
         * once the size is right. The text is identical either way: a range
         * over it measures 46.05x16 in the frame and in the app.
         */
        ink: 'rounded-full border-0 bg-stone-900 text-stone-50 text-action hover:bg-stone-700 motion-safe:hover:scale-[1.02] motion-safe:active:scale-[.98]',
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
        /*
         * 44px, the hit area `04-laws.md` requires of an icon-only control.
         * There is deliberately no smaller icon size: the `icon-sm` variant
         * this replaced was 36px, which no caller could make compliant, and
         * all three of its uses were icon-only controls that had to grow.
         */
        icon: 'size-11',
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
  loading = false,
  children,
  disabled,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * The element loader: this one control is busy.
     *
     * Never a page spinner and never a skeleton — a skeleton says "content is
     * on its way in this shape", and a button that is working has no shape to
     * promise. The label dims to 60% and the caller says what is happening in
     * it, exactly as frame `26` draws: a clay fill, `Sending…` at 60%, and the
     * ring to its left.
     */
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  /*
   * `asChild` hands rendering to the child — a `Link`, usually — and injecting
   * a second element would break Slot's single-child contract. A link is a
   * navigation rather than an action, so it has nothing to be busy about.
   */
  if (asChild) {
    return (
      <Comp
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? 'true' : undefined}
      // Busy is not the same as unavailable: the control still exists and will
      // work again, so it is announced rather than merely greyed out.
      aria-busy={loading || undefined}
      // A second submit would send the request twice.
      disabled={disabled ?? loading}
      className={cn(
        buttonVariants({ variant, size, className }),
        // The disabled fade is for a control you cannot use. This one you can,
        // it is simply working, so it keeps its full contrast.
        loading && 'disabled:opacity-100',
      )}
      {...props}
    >
      {loading ? (
        <Spinner
          className={
            /*
              On a clay or ink fill a clay ring is invisible, so the ring takes
              the label's colour — the frame draws the in-button ring as
              `rgba(255,253,249,.35)` with a solid `#FFFDF9` leading quarter.
              The light-backed variants keep the standing clay ring.
            */
            variant === 'primary' || variant === 'ink' || variant === 'destructive'
              ? 'border-stone-0/35 border-t-stone-0'
              : undefined
          }
        />
      ) : null}
      {/*
        Wrapped only while loading. The variants space an icon from its label
        with `gap-2` on the button itself, and a permanent wrapper would put
        both inside one child and collapse that gap.
      */}
      {loading ? <span className="opacity-60">{children}</span> : children}
    </Comp>
  );
}

export { Button, buttonVariants };
