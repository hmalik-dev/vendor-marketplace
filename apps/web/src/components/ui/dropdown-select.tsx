'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Dropdown,
  DropdownFooter,
  DropdownList,
  type DropdownDensity,
  type DropdownOption,
  type DropdownWidth,
} from './dropdown';
import { useStableValue } from '@/lib/use-stable-value';

/**
 * Bodies 1 and 2 of `42-dropdowns.md`: single-select and multi-select.
 *
 * They share a list and differ in exactly two ways, both of them the design's:
 * single-select **commits and closes on click** and marks its choice with a
 * check; multi-select uses **checkboxes, not checkmarks** — the square says
 * "more than one" before anything is read — and **each tick applies**, with
 * no Apply button (frame `28`, VEN-761).
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

/** Rapid ticks settle into one request: three quick ticks, one refetch. */
export const MULTI_SELECT_COMMIT_DELAY_MS = 250;

/** `18 results`, or nothing while no count is known yet. */
export function resultsSummary(lead: string | null, count: number | null | undefined): string {
  const results = count === null || count === undefined ? null : `${count} results`;

  return [lead, results].filter((part) => part !== null).join(' · ');
}

export interface MultiSelectDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  label: string;
  options: readonly DropdownOption[];
  /** What is applied right now. */
  value: readonly string[];
  /** Called once the ticks settle — 250ms trailing — and on close or Clear. */
  onApply: (value: readonly string[]) => void;
  /** What the applied selection returned; the previous number stays while a new one loads. */
  resultCount?: number | null;
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
  resultCount,
  width = 'field',
  density = 'default',
  scrim = false,
  captionSuffix = 'pick any',
  emptyMessage,
  emptyAction,
  visibleCount,
}: MultiSelectDropdownProps): React.ReactElement {
  /*
   * The ticks the reader has made, drawn at once; the commit trails them by
   * 250ms so a run of ticks is one request rather than one per tick.
   */
  const [draft, setDraft] = useState<readonly string[]>(value);
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; next: readonly string[] } | null>(
    null,
  );

  /*
   * Seeded from the selection's *contents*, never from the array. Every caller
   * builds this list with a `.map`, so `[open, value]` re-ran the re-seed on
   * each parent render — under an open panel, that discarded the ticks the
   * reader had just made the moment anything else on the screen changed (#403).
   */
  const seed = useStableValue(value);

  useEffect(() => {
    if (open && pending.current === null) {
      setDraft(seed);
    }
  }, [open, seed]);

  function flush(): void {
    if (pending.current !== null) {
      clearTimeout(pending.current.timer);
      const { next } = pending.current;
      pending.current = null;
      onApply(next);
    }
  }

  // A tick still settling when the panel closes is applied, not dropped: Esc
  // keeps what was ticked.
  useEffect(() => {
    if (!open) {
      flush();
    }
  });

  function commit(next: readonly string[]): void {
    setDraft(next);
    if (pending.current !== null) {
      clearTimeout(pending.current.timer);
    }
    pending.current = {
      next,
      timer: setTimeout(() => {
        pending.current = null;
        onApply(next);
      }, MULTI_SELECT_COMMIT_DELAY_MS),
    };
  }

  function toggle(next: string): void {
    commit(draft.includes(next) ? draft.filter((item) => item !== next) : [...draft, next]);
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
        summary={resultsSummary(draft.length > 0 ? `${draft.length} selected` : null, resultCount)}
        onClear={draft.length > 0 ? () => commit([]) : undefined}
      />
    </Dropdown>
  );
}
