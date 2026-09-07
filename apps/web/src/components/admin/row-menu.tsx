'use client';

import { DropdownMenu } from 'radix-ui';
import { useState, useRef, type ReactNode } from 'react';
import { RowTrigger } from '@/components/admin/row-trigger';

export interface RowMenuItem {
  key: string;
  label: string;
  /** Red type, for the item that cannot be undone. */
  destructive?: boolean;
  onSelect: () => void;
}

/**
 * The `···` overflow menu frame `13` draws in a table's last column.
 *
 * `22-admin.md` has specified a **menu** here since the console was designed —
 * "row-select checkbox first column, overflow menu last" — and until #435 there
 * was only ever one action per row, so the control collapsed into a button that
 * opened that one dialog directly. Graduated moderation gives every row a second
 * and third lever, and a table where the same glyph means "suspend" on one
 * screen and "hide" on another is worse than a menu.
 *
 * **It opens dialogs, it does not contain them.** Radix unmounts menu content on
 * close, so an `AlertDialog` rendered as a menu item's child is destroyed by the
 * click that was supposed to open it — a defect that presents as "the
 * confirmation flickers and nothing happens". `onSelect` therefore records which
 * dialog the row wants and the caller renders it as a sibling of this menu, in
 * controlled mode.
 *
 * **The panel is the dropdown shell's geometry, not a local variant.**
 * `04-laws.md` says a screen never invents one, and the frame `13` parity pass
 * caught this doing exactly that: `4px 0` panel padding against the shell's
 * `6px`, 35px rows against its 44, square corners against `rounded-md`. Those
 * three values now come from `dropdown.tsx`'s own, so the two panels this screen
 * mounts agree with each other.
 */
export function RowMenu({
  label,
  items,
  children,
}: {
  /** The accessible name of the trigger — always names the row it acts on. */
  label: string;
  items: readonly RowMenuItem[];
  /**
   * The dialogs this menu opens, rendered outside its content.
   *
   * Called with `restoreFocus`, which the caller **must** invoke when a dialog
   * closes. Radix returns focus to a menu's trigger on close, but a dialog
   * outlives the menu — the item that opened it has already unmounted — so
   * without this a keyboard operator who cancels is dropped on `document.body`
   * and has to tab roughly twenty stops to get back to the row. Caught by the
   * parity pass, and a regression of the move from a button to a menu: before
   * #435 the `···` was itself the dialog's trigger and got focus back for free.
   */
  children?: (restoreFocus: () => void) => ReactNode;
}): React.ReactElement {
  const trigger = useRef<HTMLButtonElement>(null);
  /*
    Controlled, only so `Tab` can close it. Radix owns every other transition;
    an uncontrolled `Root` gave no way to dismiss the panel from a key handler,
    and the first attempt at the behaviour below focused the trigger while
    leaving the panel open — which reads as the menu having swallowed the key.
  */
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <RowTrigger ref={trigger} label={label} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            /*
              `data-focus-own` is `globals.css`'s documented opt-out from the
              global `:focus-visible` ring. Radix moves DOM focus into the panel
              on open and onto each item as it highlights, so without this the
              ring painted around the whole panel **on a mouse click**, and
              around an item on hover. `42-dropdowns.md` rules against precisely
              that — a ring that appears every time the panel opens is
              decoration rather than feedback, and it makes the keyboard
              indicator indistinguishable from the mouse one. The highlight is
              carried by the fill instead, which is what the shell's rows do.
            */
            data-focus-own
            onKeyDown={(event) => {
              /*
                Tab closes the menu and returns focus to the trigger.
                **Measured, and it is a deliberate partial** — read this before
                "fixing" it.

                `42-dropdowns.md` § Behaviour says "Tab closes and moves on",
                and before this the menu did neither: Radix swallowed the key,
                the panel stayed open and focus stayed on the item. That was the
                real defect and it is fixed — the panel unmounts and
                `aria-expanded` goes `false`.

                What is *not* fixed is the "moves on" half. Declining to
                `preventDefault` here does **not** hand the key back to the
                browser: a focus-event log across the press shows the default
                traversal never fires at all, because Radix's own menu keydown
                handling sits between this handler and the default action. So
                focus parks on the trigger and reaching the next control costs
                one extra Tab. It never traps, and the tab order is otherwise
                intact — verified by tabbing from the closed trigger and landing
                on the same element either way.

                Closing that last gap means hand-rolling a tab-order walk, and
                this table renders **every row action twice** (the grid and the
                `md:hidden` card list), which is precisely the DOM that makes a
                naive "next focusable" query pick the wrong element. Returning to
                the trigger is also the conventional ARIA menu-button behaviour,
                and that doc clause was written for the *select* shell. Raised
                for a ruling rather than papered over.
              */
              if (event.key === 'Tab') {
                setOpen(false);
                trigger.current?.focus();
              }
            }}
            className="z-50 flex min-w-[13rem] flex-col rounded-panel border border-stone-300 bg-stone-0 p-[6px] shadow-dropdown"
          >
            {items.map((item) => (
              <DropdownMenu.Item
                key={item.key}
                data-focus-own
                /*
                 * The dialog is opened on the next frame rather than inside
                 * `onSelect`. Radix closes the menu after this handler returns
                 * and moves focus back to the trigger as it goes, which would
                 * steal it from a dialog that opened synchronously.
                 */
                onSelect={() => window.setTimeout(item.onSelect, 0)}
                className={`flex h-11 cursor-pointer items-center rounded-md px-3 text-meta font-semibold outline-none select-none data-[highlighted]:bg-stone-150 ${
                  item.destructive ? 'text-error-500' : 'text-stone-900'
                }`}
              >
                {item.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {children?.(() => trigger.current?.focus())}
    </>
  );
}
