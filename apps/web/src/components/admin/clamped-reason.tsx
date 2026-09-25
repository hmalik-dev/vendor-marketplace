'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type ClampedReasonProps = { children: string };

/**
 * A reason or error string an admin table cell cannot afford to print whole.
 *
 * Clamped to two lines, with the whole text one step away. The full text is in
 * the DOM either way, so it stays findable; the `Read full reason` trigger is
 * drawn only where the clamp actually hides something, so a short reason
 * carries no control. A `title` attribute would not do — it has no touch and no
 * keyboard path.
 *
 * **Opens on hover for a mouse, and stays open once clicked.** A hover-opened
 * panel closes when the pointer leaves; a click, tap or Enter pins it until
 * Escape or a click outside, which is what returns focus to the trigger.
 */
export function ClampedReason({ children }: ClampedReasonProps): React.ReactElement {
  const textRef = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  /** Opened by a pass of the mouse, so nothing should take focus from wherever it is. */
  const viaHover = useRef(false);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const measure = (): void => {
      const isCut = element.scrollHeight > element.clientHeight;
      setCut(isCut);
      if (!isCut) {
        // The trigger unmounts with the clamp; an open flag left behind would reopen it.
        pinned.current = false;
        setOpen(false);
      }
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children]);

  function handleOpenChange(next: boolean): void {
    pinned.current = next;
    if (next) viaHover.current = false;
    setOpen(next);
  }

  return (
    <span className="flex max-w-full min-w-0 flex-col items-start gap-0.5 whitespace-normal">
      <span ref={textRef} className="line-clamp-2 max-w-full text-meta break-words text-stone-600">
        {children}
      </span>
      {cut ? (
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-meta text-clay-600 hover:underline"
              onPointerEnter={(event) => {
                if (event.pointerType !== 'mouse' || open) return;
                viaHover.current = true;
                setOpen(true);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === 'mouse' && !pinned.current) setOpen(false);
              }}
              onClick={(event) => {
                /*
                 * Radix toggles on click, which would close a panel the hover
                 * just opened. Pin it instead.
                 */
                if (open && !pinned.current) {
                  event.preventDefault();
                  pinned.current = true;
                  viaHover.current = false;
                }
              }}
            >
              Read full reason
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            aria-label="Full reason"
            /*
             * A hover peek must not pull focus out of a field the admin is
             * typing in, on the way in or the way out.
             */
            onOpenAutoFocus={(event) => {
              if (viaHover.current) event.preventDefault();
            }}
            onCloseAutoFocus={(event) => {
              if (viaHover.current) event.preventDefault();
            }}
            className="w-80 text-meta break-words text-stone-900"
          >
            {children}
          </PopoverContent>
        </Popover>
      ) : null}
    </span>
  );
}
