'use client';

import { Popover as PopoverPrimitive } from 'radix-ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useModalSheet } from '@/lib/use-modal-sheet';
import { cn } from '@/lib/utils';

/**
 * The one dropdown. `design/design-plan/42-dropdowns.md`, and frames
 * `28 Dropdown open — hero` and `28 Dropdown variants`.
 *
 * **Nothing rolls its own.** Before this, every select on the product was a
 * different thing — a native `<select>` here, a Radix `Select` there, a
 * `Popover` + `Command` on the search bar — and the defects were the ones a
 * vocabulary of one avoids: a 719px panel that could not be reached at 1024 or
 * 390, filters that stayed open, Escape that did nothing, and a Refine bar
 * where two controls applied on click and two on Apply.
 *
 * One shell, four bodies, two mounts. The shell is here; the bodies are
 * `dropdown-select.tsx`, `dropdown-range.tsx` and `dropdown-date.tsx`.
 */

/** The width the panel takes, by where it hangs from. */
export type DropdownWidth = 'hero' | 'compact' | 'field';

/**
 * Row height, by where it hangs from — 44px normally, 38px from the compact
 * header bar, 48px in the sheet. The sheet's is chosen by the mount, not here.
 */
export type DropdownDensity = 'default' | 'compact';

/**
 * Panel widths, narrowed from the frame's — and **not** content-sized.
 *
 * `42-dropdowns.md` states 330px from the hero and 258px from the compact bar,
 * never narrower than the field. Built literally, the hero panel came out far
 * wider than anything in it: "Entertainment" is the longest category name in
 * the product, and 330px left a wide empty box with short text down its left
 * edge. **Ruled against the frame here**, on the product owner's call.
 *
 * The first attempt at that was `w-max` — size to content, cap at the frame's
 * number — and it failed in the opposite direction: inside Radix's positioned
 * wrapper `max-content` resolved to about 110px, so the Sort panel clipped
 * "Price: low to high" against its own right edge. Two fixed steps, both
 * comfortably past the longest label they have to hold, are what actually
 * fits both ends: narrower than the frame, wide enough for the words.
 *
 * `field` tracks the trigger, with a floor — a panel hanging off a form control
 * matches it, but a narrow control still needs room for its own options.
 */
const PANEL_WIDTH: Record<DropdownWidth, string> = {
  hero: 'w-[280px]',
  compact: 'w-[230px]',
  field: 'w-(--radix-popover-trigger-width) min-w-[230px]',
};

/**
 * The panel shell, shared by both mounts.
 *
 * The 12px radius is the frame's, and it is not on the radius scale: 12px sits
 * between `radius-md` (8px, what the rows use) and `radius-xl` (14px, what a
 * card uses), and a panel is neither.
 */
const PANEL = 'flex flex-col rounded-panel border border-stone-300 bg-stone-0 shadow-dropdown';

/**
 * Two paddings, because the frame draws two.
 *
 * A list of rows insets by 6px, so each row's own 12px reaches the frame's
 * gutter. A form body — the range and the date — has no rows to inset and
 * takes the full 14px itself.
 */
const PANEL_PADDING = { rows: 'p-[6px]', form: 'p-[14px]' } as const;

export type DropdownPadding = keyof typeof PANEL_PADDING;

/** Everything the rows need from the shell, so a body never re-derives it. */
interface DropdownContextValue {
  density: DropdownDensity;
  /** True while the sheet mount is in use, which sets 48px rows. */
  sheet: boolean;
  close: () => void;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext(): DropdownContextValue {
  const value = useContext(DropdownContext);

  if (!value) {
    throw new Error('Dropdown parts must be rendered inside a <Dropdown>');
  }

  return value;
}

/**
 * Whether the viewport is wide enough for an anchored popover.
 *
 * A popover anchored to a 44px field on a 390px screen either covers the field
 * or runs off it, which is why below 640 the mount changes rather than the
 * panel shrinking.
 *
 * Defaults to the popover on the server and on the first client render, and
 * corrects in an effect. Desktop-first is the project's rule, and it is also
 * the safer default: a popover rendered where a sheet belongs is misplaced,
 * where a sheet rendered on desktop covers the whole screen.
 */
export function useAnchoredMount(): boolean {
  const [anchored, setAnchored] = useState(true);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia('(min-width: 640px)');
    const sync = (): void => setAnchored(query.matches);

    sync();
    query.addEventListener('change', sync);

    return () => query.removeEventListener('change', sync);
  }, []);

  return anchored;
}

export interface DropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The field the panel hangs off. Rendered as the trigger. */
  trigger: ReactNode;
  /** Names the field — the sheet's heading, and the panel's accessible name. */
  label: string;
  /**
   * The `lbl` caption above the rows: the field and what it holds, as
   * "Vendor type · 11 categories". Omitted on bodies that carry their own.
   */
  caption?: string;
  width?: DropdownWidth;
  density?: DropdownDensity;
  /** `rows` for a list body, `form` for the range and date bodies. */
  padding?: DropdownPadding;
  /**
   * Dim the page behind the panel. **Hero and mobile only** — never in the
   * compact header, where the results have to stay readable behind it.
   */
  scrim?: boolean;
  children: ReactNode;
}

export function Dropdown({
  open,
  onOpenChange,
  trigger,
  label,
  caption,
  width = 'field',
  density = 'default',
  padding = 'rows',
  scrim = false,
  children,
}: DropdownProps): React.ReactElement {
  const anchored = useAnchoredMount();
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const context = useMemo<DropdownContextValue>(
    () => ({ density, sheet: !anchored, close }),
    [density, anchored, close],
  );

  return (
    <DropdownContext.Provider value={context}>
      {anchored ? (
        <AnchoredDropdown
          open={open}
          onOpenChange={onOpenChange}
          trigger={trigger}
          label={label}
          caption={caption}
          width={width}
          padding={padding}
          scrim={scrim}
        >
          {children}
        </AnchoredDropdown>
      ) : (
        <SheetDropdown open={open} onOpenChange={onOpenChange} trigger={trigger} label={label}>
          {children}
        </SheetDropdown>
      )}
    </DropdownContext.Provider>
  );
}

/** ≥640: anchored 8px below the field, aligned to its left edge. */
function AnchoredDropdown({
  open,
  onOpenChange,
  trigger,
  label,
  caption,
  width,
  padding,
  scrim,
  children,
}: Omit<DropdownProps, 'density'> & {
  width: DropdownWidth;
  padding: DropdownPadding;
}): React.ReactElement {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      {/*
        The scrim gets a portal of its own. Radix's `Portal` slots a single
        element — putting the scrim beside the content inside one throws
        "failed to slot onto its children" and takes the whole panel with it.

        It sits below the panel and outside it, so a click lands outside the
        content and Radix's own dismissal handles it: one dismissal path rather
        than two that can disagree.
      */}
      {scrim && open ? (
        <PopoverPrimitive.Portal>
          <div aria-hidden="true" className="fixed inset-0 z-40 bg-stone-900/16" />
        </PopoverPrimitive.Portal>
      ) : null}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="dropdown"
          aria-label={label}
          align="start"
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            PANEL,
            PANEL_PADDING[padding],
            PANEL_WIDTH[width],
            'z-50 outline-hidden',
            /*
             * 360px, then scroll — and the cap is what produces the frame's
             * flip rule. "Flips when the field is within 380px of the viewport
             * bottom" is the same statement as "flips when 360px of panel plus
             * its 8px offset will not fit below", which is exactly what Radix's
             * collision detection decides. Stating the height is therefore how
             * the flip distance is set; there is no second number to configure.
             */
            'max-h-[360px] overflow-y-auto',
          )}
        >
          {caption ? <DropdownCaption>{caption}</DropdownCaption> : null}
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** <640: a bottom sheet, full width, with a handle and an explicit Close. */
function SheetDropdown({
  open,
  onOpenChange,
  trigger,
  label,
  children,
}: Pick<
  DropdownProps,
  'open' | 'onOpenChange' | 'trigger' | 'label' | 'children'
>): React.ReactElement {
  const panel = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Focus trap, Escape and focus restoration — the three things a modal owes.
  useModalSheet({ open, onClose: close, panel, trigger: triggerRef as RefObject<HTMLElement> });

  /*
   * Then hand focus to the list, if there is one.
   *
   * `useModalSheet` focuses the first focusable in the panel, which is the
   * Close button — it precedes the rows, as the frame draws it. That left the
   * arrows and type-ahead firing at a button instead of the list, so the whole
   * keyboard model was dead on this mount. A parent's effect runs after its
   * children's, which is why this wins rather than racing.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    panel.current?.querySelector<HTMLElement>('[role="listbox"]')?.focus();
  }, [open]);

  return (
    <>
      {/*
        The popover mount gets its open handler from Radix's `Trigger`; this
        one has to supply its own. Attached to the wrapper rather than cloned
        onto the trigger element, because the trigger is a `ReactNode` the
        caller owns — and a click on a `<button>` bubbles here whether it came
        from a pointer, Enter or Space, so all three open the sheet.
      */}
      <div ref={triggerRef} className="contents" onClick={() => onOpenChange(!open)}>
        {trigger}
      </div>
      {open ? (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-40 bg-stone-900/34" onClick={close} />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            data-slot="dropdown-sheet"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-[18px] bg-stone-0 pt-2 pb-3 shadow-sheet"
          >
            {/* 34x4, the frame's grab handle. Decorative: the sheet is
                dismissed by Close, the scrim or Escape, never by dragging. */}
            <div
              aria-hidden="true"
              className="mx-auto mt-0.5 mb-2.5 h-[4px] w-[34px] rounded-full bg-stone-300"
            />
            <div className="flex items-baseline justify-between px-4 pb-2">
              <span className="font-display text-[19px] text-stone-900">{label}</span>
              <button
                type="button"
                onClick={close}
                className="text-[12.5px] font-semibold text-clay-500"
              >
                Close
              </button>
            </div>
            {children}
          </div>
        </>
      ) : null}
    </>
  );
}

/** The `lbl` caption naming the field and what it holds. */
export function DropdownCaption({ children }: { children: ReactNode }): React.ReactElement {
  const { sheet } = useDropdownContext();

  if (sheet) {
    // The sheet names the field in its own heading; a caption under it would
    // say the same thing twice.
    return <></>;
  }

  return (
    // 9.5px, the frame's own — the `lbl` step is 10.5px and this is the one
    // place the design steps below it.
    <div className="px-3 pt-2 pb-1.5 text-[9.5px] font-semibold tracking-label text-stone-600 uppercase">
      {children}
    </div>
  );
}

/** The hairline above a footer or a scroll note. */
export function DropdownDivider(): React.ReactElement {
  return <div aria-hidden="true" className="mx-2 my-[5px] h-px bg-stone-200" />;
}

/**
 * The row height each mount uses: 44 normally, 38 from the compact bar, 48 in
 * the sheet. Read from context so a body never has to know which mount it is in.
 */
export function useRowHeight(): string {
  const { density, sheet } = useDropdownContext();

  if (sheet) {
    return 'h-12 px-4';
  }

  return density === 'compact' ? 'h-[38px] px-3' : 'h-11 px-3';
}

/** The label sizes that go with those heights. */
export function useRowType(): { label: string; hint: string } {
  const { density, sheet } = useDropdownContext();

  if (sheet) {
    return { label: 'text-[14px]', hint: 'text-[11px]' };
  }

  return density === 'compact'
    ? { label: 'text-[12.5px]', hint: 'text-[10.5px]' }
    : { label: 'text-[13.5px]', hint: 'text-[11.5px]' };
}

/** Frame `28`: a 9x5 two-sided border rotated -45deg — a tick, not a glyph. */
export function DropdownCheck(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="mr-1 ml-auto h-[5px] w-[9px] flex-none -rotate-45 border-b-[1.8px] border-l-[1.8px] border-clay-400"
    />
  );
}

/**
 * The footer that multi-select and range share: a primary Apply and a Clear.
 *
 * Both bodies have one because **neither auto-applies** — a filter that fires
 * per keystroke makes the results grid flicker and re-sort under the hand that
 * is still typing.
 */
export function DropdownFooter({
  applyLabel,
  onApply,
  onClear,
  applyDisabled = false,
}: {
  applyLabel: string;
  onApply: () => void;
  onClear: () => void;
  applyDisabled?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2 px-1.5 pt-1 pb-0.5">
      <button
        type="button"
        onClick={onApply}
        disabled={applyDisabled}
        className="rounded-md bg-clay-400 px-[15px] py-2 text-[12.5px] font-semibold text-stone-0 disabled:opacity-50"
      >
        {applyLabel}
      </button>
      <button
        type="button"
        onClick={onClear}
        className="text-[12.5px] font-medium text-stone-600 hover:text-stone-900"
      >
        Clear
      </button>
    </div>
  );
}

/** "N more — scroll", plus the keys that move the list. */
export function DropdownScrollNote({ hidden }: { hidden: number }): React.ReactElement | null {
  const { sheet } = useDropdownContext();

  if (hidden <= 0) {
    return null;
  }

  if (sheet) {
    return <div className="px-4 pt-2 text-[11.5px] text-stone-600">{hidden} more — scroll</div>;
  }

  return (
    <>
      <DropdownDivider />
      <div className="flex items-center justify-between px-3 pt-[7px] pb-1.5">
        <span className="text-[11.5px] text-stone-600">{hidden} more — scroll</span>
        <span aria-hidden="true" className="font-mono text-[11px] text-stone-500">
          ↑↓ ↵
        </span>
      </div>
    </>
  );
}

/**
 * One row of an option list.
 *
 * A `button` rather than a `div` with a click handler, so it is in the
 * accessibility tree, reachable, and announces its own selected state. The
 * roving focus lives on the list; this is what it moves between.
 */
export function DropdownRow({
  selected,
  active,
  multi = false,
  label,
  hint,
  onSelect,
  id,
}: {
  selected: boolean;
  active: boolean;
  /** Draws a checkbox rather than a check — the square says "more than one". */
  multi?: boolean;
  label: string;
  hint?: string;
  onSelect: () => void;
  id: string;
}): React.ReactElement {
  const height = useRowHeight();
  const type = useRowType();
  const { sheet } = useDropdownContext();

  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 text-left',
        height,
        // The sheet's rows run edge to edge; the popover's are inset cards.
        sheet ? '' : 'rounded-md',
        selected ? 'bg-clay-100' : 'hover:bg-stone-150',
        active && !selected ? 'bg-stone-150' : '',
      )}
    >
      {multi ? <DropdownCheckbox checked={selected} /> : null}
      <span className="min-w-0">
        <span
          className={cn(
            'block whitespace-nowrap',
            type.label,
            selected ? 'font-semibold text-clay-600' : 'font-medium text-stone-900',
          )}
        >
          {label}
        </span>
        {hint ? (
          <span className={cn('block whitespace-nowrap text-stone-600', type.hint)}>{hint}</span>
        ) : null}
      </span>
      {!multi && selected ? <DropdownCheck /> : null}
    </button>
  );
}

/** Frame `28`: a 15px square, 4px radius, clay when checked. */
function DropdownCheckbox({ checked }: { checked: boolean }): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative box-border size-[15px] flex-none rounded-[4px]',
        checked ? 'bg-clay-400' : 'border-[1.5px] border-stone-400',
      )}
    >
      {checked ? (
        <i className="absolute top-[4px] left-[3px] h-[3px] w-[7px] -rotate-45 border-b-[1.5px] border-l-[1.5px] border-stone-0" />
      ) : null}
    </span>
  );
}

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * The option list and the whole keyboard model: ↑↓ move, ↵ commits, type-ahead
 * jumps to the first letter, Tab closes and moves on.
 *
 * A `listbox` with roving `aria-activedescendant` rather than focus per row:
 * the list has to keep focus itself for type-ahead to work, and moving DOM
 * focus down a 44-row list is what makes screen readers announce the list
 * again on every arrow press.
 */
export function DropdownList({
  options,
  selected,
  onSelect,
  multi = false,
  label,
  emptyMessage,
  emptyAction,
  visibleCount,
}: {
  options: readonly DropdownOption[];
  /** The selected values. Single-select passes at most one. */
  selected: readonly string[];
  onSelect: (value: string) => void;
  multi?: boolean;
  label: string;
  /** One row of copy saying why this is empty — never a blank panel. */
  emptyMessage?: string;
  emptyAction?: ReactNode;
  /**
   * How many rows fit before the panel scrolls, for the "N more" note. The
   * note is the only thing that needs the number; the cap itself is CSS.
   */
  visibleCount?: number;
}): React.ReactElement {
  const listId = useId();
  const { close } = useDropdownContext();
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((option) => selected.includes(option.value)),
    ),
  );
  const typeAhead = useRef({ buffer: '', at: 0 });
  const listRef = useRef<HTMLDivElement>(null);

  // Focus the list on open so the arrows work without a click first.
  useEffect(() => {
    listRef.current?.focus();
  }, []);

  /*
   * Keep the active row in view as the arrows move past the 360px cap — but
   * **not on the first render**.
   *
   * The active row starts on the current selection, so scrolling it into view
   * on open meant a panel whose second option was already selected opened
   * slightly scrolled: the caption was cut off at the top and the list looked
   * like it had been nudged. A panel opens at its beginning; the arrows are
   * what earn a scroll.
   */
  const hasMoved = useRef(false);

  useEffect(() => {
    if (!hasMoved.current) {
      hasMoved.current = true;
      return;
    }

    listRef.current
      ?.querySelector(`#${CSS.escape(`${listId}-${active}`)}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  function move(delta: number): void {
    setActive((current) => {
      if (options.length === 0) {
        return 0;
      }

      return (current + delta + options.length) % options.length;
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        return;
      case 'Home':
        event.preventDefault();
        setActive(0);
        return;
      case 'End':
        event.preventDefault();
        setActive(Math.max(0, options.length - 1));
        return;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const option = options[active];
        if (option) {
          onSelect(option.value);
        }
        return;
      }
      case 'Tab':
        // Closes and moves on, rather than trapping — the panel is not a modal
        // on this mount, and Radix returns focus to the field.
        close();
        return;
      default:
        break;
    }

    /*
     * Type-ahead. A single printable character jumps to the next option
     * starting with it, so repeated presses of `c` walk Catering → Catering's
     * neighbours rather than sticking on the first. Consecutive characters
     * within a second build a prefix instead, which is what makes "ph" reach
     * Photography past Planning.
     */
    if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    event.preventDefault();
    const now = Date.now();
    const state = typeAhead.current;
    const buffer = now - state.at < 1000 ? state.buffer + event.key : event.key;
    typeAhead.current = { buffer, at: now };

    const prefix = buffer.toLowerCase();
    const from = buffer.length === 1 ? active + 1 : active;

    for (let step = 0; step < options.length; step += 1) {
      const index = (from + step) % options.length;

      if (options[index]?.label.toLowerCase().startsWith(prefix)) {
        setActive(index);
        return;
      }
    }
  }

  if (options.length === 0) {
    return (
      <div className="px-3 py-2.5">
        <p className="text-[12.5px] text-stone-600">
          {emptyMessage ?? 'Nothing to choose from here yet.'}
        </p>
        {emptyAction ? <div className="mt-2">{emptyAction}</div> : null}
      </div>
    );
  }

  const hidden = visibleCount === undefined ? 0 : Math.max(0, options.length - visibleCount);

  return (
    <>
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        aria-multiselectable={multi || undefined}
        aria-activedescendant={`${listId}-${active}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="flex flex-col outline-hidden"
      >
        {options.map((option, index) => (
          <DropdownRow
            key={option.value}
            id={`${listId}-${index}`}
            label={option.label}
            hint={option.hint}
            multi={multi}
            selected={selected.includes(option.value)}
            active={index === active}
            onSelect={() => onSelect(option.value)}
          />
        ))}
      </div>
      <DropdownScrollNote hidden={hidden} />
    </>
  );
}
