'use client';

import { useEffect, useRef, type RefObject } from 'react';

/** Everything focusable, in DOM order. `[hidden]` and disabled are excluded. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The focusables a Tab press can actually reach, in DOM order.
 *
 * This panel holds controls that are `lg:hidden` and `max-lg:hidden` at the
 * same time, so a purely structural list would put the wrap point on something
 * the browser will not focus. `checkVisibility` is the only reliable way to ask
 * — and jsdom does not implement it, so a runtime without it keeps every
 * candidate rather than filtering them all out and trapping nothing.
 */
function focusableIn(panel: HTMLElement): HTMLElement[] {
  const candidates = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];

  return candidates.filter((element) =>
    typeof element.checkVisibility === 'function' ? element.checkVisibility() : true,
  );
}

/**
 * Whether focus is inside a layer Radix has portalled out of the panel.
 *
 * Radix renders `PopoverContent` (and Select, Dropdown, Tooltip) into a
 * `[data-radix-popper-content-wrapper]` at the end of `<body>`, so a chip
 * popover opened *from inside* this sheet is structurally outside it. A trap
 * that does not know this yanks focus back to the top of the sheet on every
 * Tab — which made the maximum-price slider and every tag checkbox after the
 * first unreachable by keyboard — and closes the whole sheet on the Escape
 * that was meant to dismiss the popover.
 */
function isInsidePortalledLayer(element: Element | null): boolean {
  return element?.closest('[data-radix-popper-content-wrapper]') != null;
}

export interface ModalSheetOptions {
  open: boolean;
  onClose: () => void;
  /** The panel that becomes modal while `open`. */
  panel: RefObject<HTMLElement | null>;
  /** The control that opened it, and where focus returns on close. */
  trigger: RefObject<HTMLElement | null>;
}

/**
 * The three things `04-laws.md` requires of a modal: trap focus, close on
 * Escape, restore focus.
 *
 * Hand-rolled rather than reached for from Radix because this panel is the
 * **same element** as the desktop Refine bar — it is a modal sheet below `lg`
 * and an ordinary inline block above it. A `DialogPrimitive` would have to
 * portal it, which means rendering the bar twice; two `RefineBar`s share one
 * document, and its Sort control is a `name="sort"` radio group, so the second
 * instance would silently join the first's group and steal its selection.
 *
 * `nav-drawer.tsx` is on Radix and should stay there — it has no desktop twin.
 * This exists for the one case that cannot portal.
 */
export function useModalSheet({ open, onClose, panel, trigger }: ModalSheetOptions): void {
  /*
   * `onClose` is read through a ref: callers pass a fresh closure on every
   * render, and depending on it rebuilt the trap each time the parent
   * re-rendered — the cleanup moved focus to the opener and the setup moved it
   * to the panel's first control, so a background search settling pulled focus
   * off the control the user had moved to (VEN-692).
   */
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    /*
     * The trigger ref may be a `display: contents` wrapper, which is not
     * focusable: `.focus()` on it leaves focus on `<body>`. Restore to the
     * control inside it instead.
     */
    const wrapper = trigger.current;
    const opener = (
      wrapper
        ? wrapper.contains(document.activeElement) && wrapper !== document.activeElement
          ? document.activeElement
          : (wrapper.querySelector<HTMLElement>(FOCUSABLE) ?? wrapper)
        : document.activeElement
    ) as HTMLElement | null;

    // Focus enters the panel, so the next Tab is inside it rather than back at
    // the top of the document.
    const first = panel.current ? focusableIn(panel.current)[0] : null;
    first?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      /*
       * Every chip in this panel is a Radix `Popover`, and Radix portals its
       * content to the end of `<body>` — so an open popover is a layer ABOVE
       * this sheet that `panel.contains()` reports as outside. Both cases below
       * defer to it, because the innermost layer owns the keystroke.
       */
      if (isInsidePortalledLayer(document.activeElement)) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !panel.current) {
        return;
      }

      const focusable = focusableIn(panel.current);

      if (focusable.length === 0) {
        return;
      }

      const edge = event.shiftKey ? focusable[0] : focusable.at(-1);

      // Only the edges wrap; everything between them is the browser's job.
      if (edge && document.activeElement === edge) {
        event.preventDefault();
        (event.shiftKey ? focusable.at(-1) : focusable[0])?.focus();
        return;
      }

      // Focus outside the panel while it is modal — pull it back to the edge.
      if (!panel.current.contains(document.activeElement)) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, [open, panel, trigger]);
}
