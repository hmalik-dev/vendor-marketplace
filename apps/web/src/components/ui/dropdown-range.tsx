'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { Dropdown, DropdownFooter, type DropdownWidth } from './dropdown';
import { cn } from '@/lib/utils';
import { useStableValue } from '@/lib/use-stable-value';

/**
 * Body 3 of `42-dropdowns.md`: a range, drawn for price.
 *
 * **Presets first, then inputs, then the slider** — and the order is the
 * argument. The common case is "under a thousand", which is one press; the
 * uncommon case is a specific figure, which is typed. The slider is a
 * *readout* of the inputs rather than the only control, because a budget is a
 * number someone already knows, and dragging for it is worse than typing it.
 *
 * Like the multi-select, it **never auto-applies**: a range that fired per
 * keystroke would re-sort the results grid between the two digits of "18".
 */

export interface RangePreset {
  label: string;
  min: number | null;
  max: number | null;
}

export interface RangeValue {
  min: number | null;
  max: number | null;
}

/**
 * Which bounds held text `parse` could make nothing of.
 *
 * Named because it is the contract between three files — the panel that
 * decides it, the bar that forwards it, and the screen that turns it into a
 * sentence — and a structural `{ min: boolean; max: boolean }` declared in
 * each is three places to keep in step.
 */
export interface RangeDiscarded {
  min: boolean;
  max: boolean;
}

/** No bound was unreadable: the resting verdict, and what a clean Apply restores. */
export const NO_DISCARD: RangeDiscarded = { min: false, max: false };

export interface RangeDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  label: string;
  /** The `lbl` caption's second half — "starting rate" on price. */
  caption: string;
  value: RangeValue;
  /**
   * `discarded` names the bounds that held text the reader typed and `parse`
   * could make nothing of — `abc`, or a lone `$`. It is not the same as an
   * empty bound, which legitimately means "no limit": the value is dropped
   * either way, but only one of the two is a surprise, and #388 is what it
   * cost to treat them identically and say nothing.
   *
   * Per bound, not one flag for the pair: a notice that says "the price range
   * was cleared" over a surviving floor is the same untruth #403 fixed on the
   * URL side, and the caller cannot name what it is not told.
   */
  onApply: (value: RangeValue, meta: { discarded: RangeDiscarded }) => void;
  presets: readonly RangePreset[];
  /** The slider's span, so the readout knows what "full" means. */
  bounds: { min: number; max: number };
  /** Turns a stored value into what the field shows — `formatPrice`, usually. */
  format: (value: number) => string;
  /**
   * What the reader types, turned into the stored value.
   *
   * **This is the unit boundary and it has to be the caller's**, because only
   * the caller knows what it stores. Price is held in integer cents and typed
   * in dollars, and taking the digits at face value made "2" mean two cents:
   * the field showed `$0.02`, and `200` came back as `$2.00`.
   */
  parse: (raw: string) => number | null;
  /** The stored value as the reader would type it — the inverse of `parse`. */
  toEditable: (value: number) => string;
  width?: DropdownWidth;
  scrim?: boolean;
}

const EMPTY: RangeValue = { min: null, max: null };

/** Where a bound sits along the slider, as a percentage. */
function offset(
  value: number | null,
  fallback: number,
  bounds: RangeDropdownProps['bounds'],
): number {
  const span = bounds.max - bounds.min;

  if (span <= 0) {
    return 0;
  }

  const clamped = Math.min(Math.max(value ?? fallback, bounds.min), bounds.max);

  return ((clamped - bounds.min) / span) * 100;
}

export function RangeDropdown({
  open,
  onOpenChange,
  trigger,
  label,
  caption,
  value,
  onApply,
  presets,
  bounds,
  format,
  parse,
  toEditable,
  width = 'field',
  scrim = false,
}: RangeDropdownProps): React.ReactElement {
  const fieldId = useId();
  const [draft, setDraft] = useState<RangeValue>(value);
  /** Which bounds currently hold text `parse` could make nothing of. */
  const [unusable, setUnusable] = useState<RangeDiscarded>(NO_DISCARD);

  /*
   * Re-seeded on open, so a panel dismissed without Apply discards its edits.
   *
   * Seeded from the bounds' contents, never from the object: `RefineBar` passes
   * `value={{ min: …, max: … }}`, a new object on every parent render, so
   * `[open, value]` re-ran this while the panel was **open** — every time the
   * search results landed under it — and wiped a half-typed price range back to
   * the URL's. The re-seed belongs to opening, and only opening (#403).
   */
  const seed = useStableValue(value);

  useEffect(() => {
    if (open) {
      setDraft(seed);
      setUnusable(NO_DISCARD);
    }
  }, [open, seed]);

  const activePreset = presets.findIndex(
    (preset) => preset.min === draft.min && preset.max === draft.max,
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      label={label}
      width={width}
      padding="form"
      scrim={scrim}
    >
      <div className="mb-[9px] text-[9.5px] font-semibold tracking-label text-stone-600 uppercase">
        {label} · {caption}
      </div>

      <div className="mb-3 flex items-center gap-[9px]">
        <AmountField
          id={`${fieldId}-min`}
          label="Min"
          value={draft.min}
          format={format}
          parse={parse}
          toEditable={toEditable}
          onChange={(min, isUnusable) => {
            setDraft((current) => ({ ...current, min }));
            setUnusable((current) => ({ ...current, min: isUnusable }));
          }}
        />
        <span aria-hidden="true" className="mt-3.5 text-stone-500">
          –
        </span>
        <AmountField
          id={`${fieldId}-max`}
          label="Max"
          value={draft.max}
          format={format}
          parse={parse}
          toEditable={toEditable}
          onChange={(max, isUnusable) => {
            setDraft((current) => ({ ...current, max }));
            setUnusable((current) => ({ ...current, max: isUnusable }));
          }}
        />
      </div>

      {/*
        A readout, not a control — `aria-hidden`, no tab stop, no drag. The two
        inputs above are the control, and they are already reachable and
        announced. A decorative track that also claimed to be a slider would be
        two controls for one value, only one of which works.
      */}
      <div
        aria-hidden="true"
        className="relative mx-0.5 mt-0 mb-3.5 h-[3px] rounded-full bg-stone-200"
      >
        <span
          className="absolute top-0 h-[3px] rounded-full bg-clay-400"
          style={{
            left: `${offset(draft.min, bounds.min, bounds)}%`,
            right: `${100 - offset(draft.max, bounds.max, bounds)}%`,
          }}
        />
        <span
          className="absolute top-[-4px] -ml-[5px] size-[11px] rounded-full border-2 border-clay-400 bg-stone-0"
          style={{ left: `${offset(draft.min, bounds.min, bounds)}%` }}
        />
        <span
          className="absolute top-[-4px] -mr-[5px] size-[11px] rounded-full border-2 border-clay-400 bg-stone-0"
          style={{ right: `${100 - offset(draft.max, bounds.max, bounds)}%` }}
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {presets.map((preset, index) => (
          <button
            key={preset.label}
            type="button"
            aria-pressed={index === activePreset}
            onClick={() => {
              setDraft({ min: preset.min, max: preset.max });
              /*
               * A preset replaces whatever was typed, so it also replaces the
               * verdict on it. Without this, `abc` in Min followed by `$1–2k`
               * applied the preset and still announced the range as discarded
               * — a notice that contradicted the chip beside it.
               */
              setUnusable(NO_DISCARD);
            }}
            className={cn(
              'rounded-full border px-2.5 py-[5px] text-[11.5px]',
              index === activePreset
                ? 'border-clay-200 bg-clay-100 font-semibold text-clay-600'
                : 'border-stone-300 bg-stone-50 font-medium text-stone-700 hover:bg-stone-150',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <DropdownFooter
        applyLabel="Apply"
        onApply={() => {
          onApply(draft, { discarded: unusable });
          onOpenChange(false);
        }}
        onClear={() => {
          setDraft(EMPTY);
          setUnusable(NO_DISCARD);
        }}
      />
    </Dropdown>
  );
}

/**
 * One bound. Typed as text, because it carries a currency symbol on blur.
 *
 * Two units meet here and neither is hidden: `value` is what the caller stores,
 * `raw` is what the reader typed, and `parse`/`toEditable` are the only things
 * that cross between them.
 */
function AmountField({
  id,
  label,
  value,
  format,
  parse,
  toEditable,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  format: (value: number) => string;
  parse: (raw: string) => number | null;
  toEditable: (value: number) => string;
  /** `unusable` distinguishes "typed something we cannot read" from "empty". */
  onChange: (value: number | null, unusable: boolean) => void;
}): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  return (
    <div className="flex-1">
      <label htmlFor={id} className="mb-[3px] block text-[10px] text-stone-600">
        {label}
      </label>
      <input
        id={id}
        type="text"
        /*
         * `decimal`, not `numeric`: iOS renders `numeric` as a digits-only
         * keypad with no decimal key, so `999.99` would be untypeable on an
         * iPhone — exactly the whole-dollars-only behaviour #403 removed from
         * the parser. No frame pins the hint.
         */
        inputMode="decimal"
        value={editing ? raw : value === null ? '' : format(value)}
        placeholder="Any"
        onFocus={() => {
          setRaw(value === null ? '' : toEditable(value));
          setEditing(true);
        }}
        onBlur={() => setEditing(false)}
        onChange={(event) => {
          const typed = event.target.value;
          const parsed = parse(typed);

          setRaw(typed);
          onChange(parsed, parsed === null && typed.trim() !== '');
        }}
        className="w-full rounded-md border border-stone-300 bg-stone-150 px-2.5 py-2 text-[13px] text-stone-900 outline-none focus-visible:border-[1.5px] focus-visible:border-clay-400 focus-visible:px-[9px] focus-visible:py-[7px] focus-visible:shadow-[0_0_0_3px_rgba(180,85,47,.15)]"
      />
    </div>
  );
}
