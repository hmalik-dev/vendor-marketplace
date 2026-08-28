'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

/**
 * The navigation at 768 and below.
 *
 * Until now the header simply dropped its nav below `md`, so on a phone there
 * was no route to Browse, How it works, or — signed in — the dashboard. Frames
 * `14 Landing mobile` and `14 Search tablet` both draw the same answer: a
 * hamburger beside whichever one control stays in the bar.
 *
 * Built on the dialog primitive rather than a bespoke panel, because the
 * behaviour a drawer needs is exactly a modal's: focus moves into it, stays
 * inside it while it is open, Escape closes it, and focus returns to the
 * trigger afterwards. Reimplementing that is how it gets reimplemented wrong.
 */

export interface NavDrawerLink {
  label: string;
  href: string;
}

export interface NavDrawerProps {
  /** Rendered above the links — the account cluster, when there is one. */
  children?: ReactNode;
  links: readonly NavDrawerLink[];
}

export function NavDrawer({ links, children }: NavDrawerProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  /*
   * A drawer left standing over the page it just navigated to is the most
   * common bug in this component. Closing on pathname covers every route
   * change — a link inside it, a redirect after one, or the back button.
   */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label="Open menu"
        /*
          44px of tap target around an 18px glyph. The frame draws the bars,
          not the button — but #23 already had to fix a 33px trigger on this
          screen, so the target is stated here rather than inferred from the
          artwork.

          Hidden from 769 up rather than from 768: frame `14 Search tablet` is
          drawn at exactly 768 and holds the hamburger, so `md:hidden` — which
          hides it *at* the breakpoint — would miss the frame by one pixel.
        */
        className="-mr-2.5 flex size-11 items-center justify-center rounded-lg text-stone-900 min-[769px]:hidden"
      >
        {/* Three 18x1.6 bars, 3px apart — frame `14 Landing mobile`. */}
        <span aria-hidden="true" className="flex flex-col gap-[3px]">
          <span className="block h-[1.6px] w-4.5 bg-current" />
          <span className="block h-[1.6px] w-4.5 bg-current" />
          <span className="block h-[1.6px] w-4.5 bg-current" />
        </span>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-(--z-header) bg-stone-900/20 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          aria-label="Menu"
          className={cn(
            // Anchored to the right edge and full height: a drawer, not a card.
            'fixed inset-y-0 right-0 z-(--z-header) flex w-72 max-w-[85vw] flex-col gap-1 border-l border-stone-300 bg-stone-0 p-4 shadow-xl outline-none',
            'duration-150 data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right',
          )}
        >
          {/*
            Radix requires a title for the dialog's accessible name. It is
            visually hidden because the frame draws no heading in the drawer —
            the links are the content, and a "Menu" heading above three links
            is chrome the design deliberately does not have.
          */}
          <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>

          <DialogPrimitive.Close
            aria-label="Close menu"
            className="mb-2 self-end rounded-lg p-2.5 text-stone-700 hover:text-stone-900"
          >
            <span aria-hidden="true" className="relative block size-4.5">
              <span className="absolute top-1/2 left-0 block h-[1.6px] w-full rotate-45 bg-current" />
              <span className="absolute top-1/2 left-0 block h-[1.6px] w-full -rotate-45 bg-current" />
            </span>
          </DialogPrimitive.Close>

          {children}

          <nav aria-label="Menu">
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="block rounded-lg px-2 py-3 text-md font-medium text-stone-900 hover:bg-stone-100"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
