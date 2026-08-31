'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Dropdown, DropdownList, useAnchoredMount, type DropdownOption } from './dropdown';
import type { DropdownDensity, DropdownWidth } from './dropdown';
import { cn } from '@/lib/utils';

/**
 * Body 5 of `42-dropdowns.md`: the field itself is the text input.
 *
 * **What this is, and what it deliberately is not.** D13 ruling 1 and D15
 * ruling 1 removed the search field from single-select panels, and the strongest
 * of the three reasons given was that such a field is autofocused, so *"its
 * focus ring would appear every single time the panel opened — permanent
 * decoration, not feedback"*. That objection is to a **second** field inside the
 * panel, and this design dissolves it rather than overruling it: there is no
 * second field. The one the customer already tabbed to is the one they type in,
 * and its focus ring means what it has always meant.
 *
 * The behaviour was never in dispute. `42-dropdowns.md:45` has specified
 * *"typing narrows the list in place (not a jump-to-first-letter)"* since the
 * 2026-08-30 import, and D14 recorded that the code was still on the
 * reversed-away jump. `11-search.md:19-21` specifies both of these controls as
 * a combobox and a typeahead. So most of #375 is closing that gap; the override
 * is the one paragraph that said the trigger may not be an input.
 *
 * **The invariant, which is the whole design.** Typing is an input affordance
 * and never a query term. The committed value only ever changes through
 * `onCommit`, which only ever fires with an option's own value. A customer who
 * types `photograhpy` and walks away has selected nothing, and the field says
 * so by reverting. That is what keeps D6 true — the query can only ask a
 * question the platform can answer — while the field accepts typing.
 */

export interface ComboboxDropdownProps {
  /** Every option, unfiltered. Filtering is this component's job. */
  options: readonly DropdownOption[];
  /** The committed value: an option's `value`, or `''` for none. */
  value: string;
  /** Fires only with a real option value. Typing never calls it. */
  onCommit: (value: string) => void;
  /**
   * The label the input shows for the committed value.
   *
   * Passed rather than derived, because `City` renders a committed pair whose
   * option may have left the list — an unpublished last vendor — and blanking
   * the field mid-session because the *list* changed would be a lie about what
   * the customer asked for.
   */
  committedLabel: string;
  /** Narrows `options` to what the typed text matches. */
  filter: (options: readonly DropdownOption[], query: string) => readonly DropdownOption[];
  /**
   * Whether focusing the field opens the panel.
   *
   * `Vendor type` opens on the **full** list, because eleven categories are a
   * taxonomy worth seeing. `City` does not, and that difference is the user's
   * stated reason for the ticket: *"Not a scrollable dropdown for city since
   * cities can vary drastically."*
   */
  openOnFocus: boolean;
  /** Names the field. Becomes the input's accessible name and the panel's. */
  label: string;
  id: string;
  placeholder: string;
  /** One row of copy naming what was typed — never a blank panel. */
  noMatchMessage: (query: string) => string;
  /** Shown when the field is open with nothing typed and nothing to show. */
  emptyMessage: string;
  /** The caption above the rows: "Vendor type · 12 categories". */
  caption?: string;
  /**
   * Emptying the field commits the empty value.
   *
   * `City` needs it: "Anywhere" is not a row a customer can pick — the list is
   * places that have vendors — so clearing the text is the *only* gesture that
   * means "drop this filter", and without this it would silently revert on blur
   * and leave the old city in the query. `Vendor type` does not, because its
   * `Any vendor type` row is a real option in the list.
   */
  commitOnEmpty?: boolean;
  /** At most this many rows render; the rest are counted, not drawn. */
  limit?: number;
  /** Rows visible before the 360px cap bites, for the "N more" note. */
  visibleCount?: number;
  width?: DropdownWidth;
  density?: DropdownDensity;
  scrim?: boolean;
  /** The whole field, so the search bar can own its segment geometry. */
  className?: string;
  labelClassName?: string;
  /**
   * A function of the open state, not a string.
   *
   * #373 fixed a bug where `font-semibold` for the open state sat beside a
   * `lg:font-normal` in the resting ladder: both are equal-specificity
   * utilities, so at 1440 the responsive variant won on source order and the
   * browser painted 400 while the class list read semibold. Resolving the state
   * **in JavaScript** and emitting one branch is what stops that recurring — an
   * `aria-expanded:` Tailwind variant would reintroduce it exactly, because it
   * would put both classes in the string again and let the stylesheet decide.
   */
  inputClassName?: (open: boolean) => string;
  /** Rendered after the input inside the field — the bar's own furniture. */
  children?: ReactNode;
}

export function ComboboxDropdown({
  options,
  value,
  onCommit,
  committedLabel,
  filter,
  openOnFocus,
  label,
  id,
  placeholder,
  noMatchMessage,
  emptyMessage,
  caption,
  commitOnEmpty = false,
  limit,
  visibleCount,
  width = 'field',
  density = 'default',
  scrim = false,
  className,
  labelClassName,
  inputClassName,
  children,
}: ComboboxDropdownProps): React.ReactElement {
  const listId = useId();
  const [open, setOpen] = useState(false);
  /**
   * `null` means "showing the committed value". A string means the customer is
   * typing, and the field is in its uncommitted state.
   *
   * Two states rather than one, so `committedLabel` changing underneath — a
   * deep link rehydrating, a soft navigation handing down new props — updates
   * the field when nobody is typing and never overwrites a word in progress.
   */
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const anchored = useAnchoredMount();
  const inputRef = useRef<HTMLInputElement>(null);
  /*
   * IME composition. A multi-byte input fires `change` for each intermediate
   * state, and filtering on those empties the list on the first keystroke of a
   * Japanese or Korean word. The value is still shown; only the filtering waits.
   */
  const composing = useRef(false);

  const typed = query ?? '';
  const matched = openOnFocus || typed !== '' ? filter(options, typed) : [];
  const shown = limit === undefined ? matched : matched.slice(0, limit);
  const beyondLimit = matched.length - shown.length;

  const revert = useCallback(() => {
    setQuery(null);
    setActive(0);
  }, []);

  const commit = useCallback(
    (next: string) => {
      onCommit(next);
      revert();
      setOpen(false);
    },
    [onCommit, revert],
  );

  const close = useCallback(() => {
    revert();
    setOpen(false);
  }, [revert]);

  /*
   * The list can shrink under the active index — one more character matches
   * fewer rows — and an active index past the end points
   * `aria-activedescendant` at a row that does not exist, which reads as
   * silence. Clamping on every change is cheaper than reasoning about which
   * ones can shrink it.
   */
  useEffect(() => {
    setActive((current) => (current >= shown.length ? 0 : current));
  }, [shown.length]);

  function move(delta: number): void {
    if (shown.length === 0) {
      return;
    }

    setActive((current) => (current + delta + shown.length) % shown.length);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    switch (event.key) {
      case 'ArrowDown':
        /*
         * `preventDefault` is the whole reason arrows are handled here rather
         * than left to the input: in a text field the browser's own
         * ArrowDown/ArrowUp move the caret to the end and the start. The
         * ticket's requirement that the caret not move is a requirement to
         * suppress that default.
         */
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        move(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        return;
      case 'Enter': {
        const option = shown[active];
        if (open && option) {
          // Only inside the panel. Otherwise Enter belongs to the form's submit.
          event.preventDefault();
          commit(option.value);
        }
        return;
      }
      case 'Escape':
        if (open) {
          // Reverts *and* closes: the ticket asks for both, and a revert that
          // left the panel open would show a list matching text no longer there.
          event.preventDefault();
          close();
        }
        return;
      case 'Tab':
        // Commits nothing new and reverts, then lets focus move on.
        close();
        return;
      default:
        break;
    }
  }

  const input = (
    <input
      ref={inputRef}
      id={id}
      data-slot="combobox-input"
      type="text"
      role="combobox"
      autoComplete="off"
      aria-expanded={open}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-haspopup="listbox"
      aria-activedescendant={open && shown.length > 0 ? `${listId}-${active}` : undefined}
      value={query ?? committedLabel}
      placeholder={placeholder}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        setQuery(event.currentTarget.value);
        setActive(0);
      }}
      onChange={(event) => {
        const next = event.target.value;
        setQuery(next);
        setActive(0);

        if (composing.current) {
          return;
        }

        /*
         * Emptying the field is a commit, where the field asks for it. It has
         * to be, because the alternative is a revert on blur that puts the old
         * value back — a customer who deleted their city and walked away would
         * find it still filtering their results.
         */
        if (commitOnEmpty && next.trim() === '' && value !== '') {
          onCommit('');
        }

        // Typing opens a field that does not open on focus — that is how the
        // city suggestions appear at all. Emptying it closes them again.
        setOpen(openOnFocus ? true : next.trim() !== '');
      }}
      onFocus={() => {
        if (openOnFocus) {
          setOpen(true);
        }
      }}
      onBlur={(event) => {
        /*
         * A click on a row blurs the input before the row's own click fires,
         * so a blanket revert-and-close on blur eats the selection. The panel
         * is portalled, so `relatedTarget` is the only way to ask "did focus go
         * into my own panel" — the DOM tree cannot answer it.
         */
        const next = event.relatedTarget as HTMLElement | null;

        if (next?.closest('[data-slot="dropdown"], [data-slot="dropdown-sheet"]')) {
          return;
        }

        close();
      }}
      onKeyDown={onKeyDown}
      className={inputClassName?.(open)}
    />
  );

  const list = (
    <DropdownList
      label={label}
      options={shown}
      selected={value === '' ? [] : [value]}
      visibleCount={visibleCount}
      controlled={{ activeIndex: active, listId }}
      emptyMessage={typed.trim() === '' ? emptyMessage : noMatchMessage(typed.trim())}
      onSelect={commit}
    />
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      triggerMode="anchor"
      trigger={
        /*
          `data-slot` so the panel can tell "the customer clicked back into the
          field" from "the customer clicked away". Radix treats an `Anchor` as
          outside the panel, so without this every click into the input
          dismisses the list it is filtering.
        */
        <div data-slot="combobox-field" className={className}>
          {/*
            A real `<label htmlFor>`, not a caption span — `04-laws.md:141`:
            "Every input has a visible `<label htmlFor>`; placeholder is not a
            label". The button this replaced carried an `aria-label` instead,
            which was correct for a button and is not enough for a field.
          */}
          <label htmlFor={id} className={labelClassName}>
            {label}
          </label>
          {input}
          {children}
        </div>
      }
      label={label}
      caption={caption}
      width={width}
      density={density}
      scrim={scrim}
    >
      {/*
        The sheet has no anchored field to type into — the trigger is behind a
        scrim — so the input is rendered again inside it. One component, one
        state: this is the same `input` element description, mounted where the
        customer can reach it.
      */}
      {anchored ? null : <div className="px-4 pb-2">{input}</div>}
      {list}
      <PanelOverflowNote hidden={beyondLimit} />
    </Dropdown>
  );
}

/**
 * "and N more" — the honest end of a capped list.
 *
 * `DropdownScrollNote` counts rows that exist but are below the fold; this
 * counts rows that were **not rendered at all**. A city typeahead capped at
 * eight that said nothing about the ninth would be telling a customer their
 * city is not in the list when it is.
 */
function PanelOverflowNote({ hidden }: { hidden: number }): React.ReactElement | null {
  if (hidden <= 0) {
    return null;
  }

  return (
    <p className={cn('px-3 pt-1.5 pb-0.5 text-[11.5px] text-stone-600')}>
      {hidden} more {hidden === 1 ? 'match' : 'matches'} — keep typing to narrow them
    </p>
  );
}
