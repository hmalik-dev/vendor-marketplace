'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Dropdown,
  DropdownFooter,
  DropdownList,
  type DropdownDensity,
  type DropdownOption,
  type DropdownWidth,
} from './dropdown';

/**
 * Bodies 1 and 2 of `42-dropdowns.md`: single-select and multi-select.
 *
 * They share a list and differ in exactly two ways, both of them the design's:
 * single-select **commits and closes on click** and marks its choice with a
 * check; multi-select uses **checkboxes, not checkmarks** — the square says
 * "more than one" before anything is read — and **never auto-applies**.
 *
 * Neither has a search field. Eleven categories fit on one screen, and a filter
 * box on a list that short is friction rather than help.
 */

export interface SingleSelectDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  label: string;
  options: readonly DropdownOption[];
  value: string | null;
  onChange: (value: string) => void;
  width?: DropdownWidth;
  density?: DropdownDensity;
  scrim?: boolean;
  /**
   * The noun for the caption's count — "11 categories".
   *
   * Omit it where a count says nothing: a sort order has five and nobody is
   * counting them, and "Sort by · 5 orders" reads as a machine describing
   * itself. The caption falls back to the field's own name.
   */
  countNoun?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  /** Rows visible before the 360px cap bites, for the "N more" note. */
  visibleCount?: number;
}

export function SingleSelectDropdown({
  open,
  onOpenChange,
  trigger,
  label,
  options,
  value,
  onChange,
  width = 'field',
  density = 'default',
  scrim = false,
  countNoun,
  emptyMessage,
  emptyAction,
  visibleCount,
}: SingleSelectDropdownProps): React.ReactElement {
  return (
    <Dropdown
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      label={label}
      caption={countNoun ? `${label} · ${options.length} ${countNoun}` : label}
      width={width}
      density={density}
      scrim={scrim}
    >
      <DropdownList
        label={label}
        options={options}
        selected={value === null ? [] : [value]}
        visibleCount={visibleCount}
        emptyMessage={emptyMessage}
        emptyAction={emptyAction}
        onSelect={(next) => {
          onChange(next);
          // Commits and closes: a single-select has nothing left to say.
          onOpenChange(false);
        }}
      />
    </Dropdown>
  );
}

export interface MultiSelectDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  label: string;
  options: readonly DropdownOption[];
  /** What is applied right now — the panel edits a draft of this. */
  value: readonly string[];
  onApply: (value: readonly string[]) => void;
  width?: DropdownWidth;
  density?: DropdownDensity;
  scrim?: boolean;
  captionSuffix?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  visibleCount?: number;
}

export function MultiSelectDropdown({
  open,
  onOpenChange,
  trigger,
  label,
  options,
  value,
  onApply,
  width = 'field',
  density = 'default',
  scrim = false,
  captionSuffix = 'pick any',
  emptyMessage,
  emptyAction,
  visibleCount,
}: MultiSelectDropdownProps): React.ReactElement {
  /*
   * A draft, because this body does not auto-apply. Re-seeded from `value`
   * every time the panel opens, so a panel dismissed without Apply discards
   * its edits rather than leaking them into the next open.
   */
  const [draft, setDraft] = useState<readonly string[]>(value);

  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  function toggle(next: string): void {
    setDraft((current) =>
      current.includes(next) ? current.filter((item) => item !== next) : [...current, next],
    );
  }

  return (
    <Dropdown
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      label={label}
      caption={`${label} · ${captionSuffix}`}
      width={width}
      density={density}
      scrim={scrim}
    >
      <DropdownList
        multi
        label={label}
        options={options}
        selected={draft}
        onSelect={toggle}
        visibleCount={visibleCount}
        emptyMessage={emptyMessage}
        emptyAction={emptyAction}
      />
      <DropdownFooter
        // The count is on the button because it is what Apply will do, and a
        // reader deciding whether to press it is asking exactly that.
        applyLabel={draft.length > 0 ? `Apply · ${draft.length}` : 'Apply'}
        onApply={() => {
          onApply(draft);
          onOpenChange(false);
        }}
        onClear={() => setDraft([])}
      />
    </Dropdown>
  );
}
