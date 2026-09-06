import type { AvailabilityStatus } from '@vendor-marketplace/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatAccessibleDate } from '@/lib/calendar';
import { DateDropdown } from './dropdown-date';

/*
 * The grid keyboard model the `role="grid"` was promising (#411).
 *
 * What shipped was a flat run of `gridcell` buttons with no rows, no arrow
 * keys and no roving tabindex — so every one of the forty-two days in a month
 * was a tab stop, and the role advertised a keyboard model the component did
 * not have. Reaching the control after the picker meant pressing Tab
 * forty-two times; the arrows did nothing at all.
 *
 * Unchoosable days carried the native `disabled` attribute, which takes an
 * element out of the arrow keys' reach as well as out of the tab order: a
 * booked or past day could not be reached to find out *why* it could not be
 * chosen. The grid jumped over it silently.
 */

/** The viewer's day for every case here. A Sunday, so the week arithmetic is
 * legible: 2026-06-14 sits in column 1 of its row. */
const TODAY = '2026-06-14';

function renderPicker(
  calendar: Readonly<Record<string, AvailabilityStatus>> = {},
  value: string | null = null,
): { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn();

  render(
    <DateDropdown
      open
      onOpenChange={vi.fn()}
      trigger={<button type="button">Event date</button>}
      label="Event date"
      value={value}
      onChange={onChange}
      today={TODAY}
      calendar={calendar}
    />,
  );

  return { onChange };
}

function grid(): HTMLElement {
  return screen.getByRole('grid', { name: 'Event date' });
}

/** The cell for a `YYYY-MM-DD`, by the date in its accessible name. */
function cell(date: string): HTMLElement {
  return within(grid()).getByRole('gridcell', {
    name: new RegExp(`^${formatAccessibleDate(date)} —`),
  });
}

describe('DateDropdown — grid structure', () => {
  afterEach(() => {
    cleanup();
  });

  it('puts its cells in rows, as the grid role requires', () => {
    renderPicker();

    const rows = within(grid()).getAllByRole('row');

    // June 2026 begins on a Monday and runs 30 days: five week rows.
    expect(rows.length).toBe(5);
    for (const row of rows) {
      // Seven columns in every row, counting the `aria-hidden` pads that fill
      // the leading and trailing gaps — a ragged row is not a grid.
      expect(row.children.length).toBe(7);
    }

    // The first row is one pad plus six days; the last is padded at its end.
    expect(within(rows[0] as HTMLElement).getAllByRole('gridcell').length).toBe(6);
    expect(within(rows[4] as HTMLElement).getAllByRole('gridcell').length).toBe(3);
  });

  it('names a day the way a person says it, not as an ISO string', () => {
    renderPicker();

    expect(cell('2026-06-20').getAttribute('aria-label')).toBe(
      'Saturday, June 20, 2026 — available',
    );
  });

  it('has exactly one tab stop, on the day the viewer is looking at', () => {
    renderPicker();

    const stops = within(grid())
      .getAllByRole('gridcell')
      .filter((day) => day.getAttribute('tabindex') === '0');

    expect(stops.length).toBe(1);
    expect(stops[0]).toBe(cell(TODAY));
  });

  it('puts the single tab stop on the chosen day when there is one', () => {
    renderPicker({}, '2026-06-25');

    expect(cell('2026-06-25').getAttribute('tabindex')).toBe('0');
    expect(cell(TODAY).getAttribute('tabindex')).toBe('-1');
  });

  it('keeps an unchoosable day reachable, and says why', () => {
    renderPicker({ '2026-06-20': 'booked' });

    const booked = cell('2026-06-20');

    // Reachable — a `disabled` cell is skipped by the arrows as well as by Tab.
    expect((booked as HTMLButtonElement).disabled).toBe(false);
    expect(booked.getAttribute('aria-disabled')).toBe('true');
    expect(booked.getAttribute('aria-label')).toBe('Saturday, June 20, 2026 — unavailable');
  });

  it('refuses a click on an unchoosable day', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker({ '2026-06-20': 'booked' });

    await user.click(cell('2026-06-20'));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('DateDropdown — arrow keys', () => {
  afterEach(() => {
    cleanup();
  });

  it.each([
    ['{ArrowRight}', '2026-06-15'],
    ['{ArrowLeft}', '2026-06-13'],
    ['{ArrowDown}', '2026-06-21'],
    ['{ArrowUp}', '2026-06-07'],
  ])('moves the focused day on %s', async (key, expected) => {
    const user = userEvent.setup();
    renderPicker();

    cell(TODAY).focus();
    await user.keyboard(key);

    expect(document.activeElement).toBe(cell(expected));
    expect(cell(expected).getAttribute('tabindex')).toBe('0');
    // The stop moves rather than multiplying.
    expect(cell(TODAY).getAttribute('tabindex')).toBe('-1');
  });

  it('crosses into a past day rather than skipping it', async () => {
    const user = userEvent.setup();
    renderPicker();

    cell(TODAY).focus();
    await user.keyboard('{ArrowLeft}');

    const past = cell('2026-06-13');
    expect(document.activeElement).toBe(past);
    expect(past.getAttribute('aria-label')).toBe('Saturday, June 13, 2026 — in the past');
  });

  it('moves to the ends of the week on Home and End', async () => {
    const user = userEvent.setup();
    renderPicker();

    cell('2026-06-17').focus();
    await user.keyboard('{Home}');
    // The 17th is a Wednesday; its week begins on Sunday the 14th.
    expect(document.activeElement).toBe(cell('2026-06-14'));

    await user.keyboard('{End}');
    expect(document.activeElement).toBe(cell('2026-06-20'));
  });

  it('steps a whole month on PageDown, following the grid to it', async () => {
    const user = userEvent.setup();
    renderPicker();

    cell(TODAY).focus();
    await user.keyboard('{PageDown}');

    expect(screen.getByText('July 2026')).toBeDefined();
    expect(document.activeElement).toBe(cell('2026-07-14'));
  });

  it('clamps a month step to the target month’s length', async () => {
    const user = userEvent.setup();
    renderPicker();

    // The 31st of August has no counterpart in September, and `Date.UTC`
    // overflows rather than clamping — 31 August plus a month is 1 October,
    // which would step past September entirely.
    cell(TODAY).focus();
    await user.keyboard('{PageDown}{PageDown}');
    expect(document.activeElement).toBe(cell('2026-08-14'));

    cell('2026-08-31').focus();
    await user.keyboard('{PageDown}');
    expect(document.activeElement).toBe(cell('2026-09-30'));
  });

  it('will not step behind the month the picker is floored at', async () => {
    const user = userEvent.setup();
    renderPicker();

    cell('2026-06-01').focus();
    await user.keyboard('{ArrowLeft}');

    // 31 May is before the floor, so the move is refused outright rather than
    // opening a month with nothing choosable in it.
    expect(screen.getByText('June 2026')).toBeDefined();
    expect(document.activeElement).toBe(cell('2026-06-01'));
  });

  /*
   * A key that cannot move must not arm the focus-taking either.
   *
   * `Home` on a Sunday returns where it started, so `roving` does not change
   * and the effect that clears the flag never runs. The flag then survived
   * until the next thing that *did* move the roving cell — the month chevron —
   * which yanked focus off the chevron and into the grid, so a second month
   * step was impossible without tabbing back in.
   */
  it('leaves focus alone when a key moves nowhere, and after it', async () => {
    const user = userEvent.setup();
    renderPicker();

    // 2026-06-14 is a Sunday, so Home is a no-op on it.
    cell(TODAY).focus();
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(cell(TODAY));

    const nextMonth = screen.getByRole('button', { name: 'Next month' });
    nextMonth.focus();
    await user.click(nextMonth);

    expect(screen.getByText('July 2026')).toBeDefined();
    // The chevron keeps focus: a click on it is not a request to enter the grid.
    expect(document.activeElement).toBe(nextMonth);
  });

  it('chooses the focused day on Enter', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker();

    cell(TODAY).focus();
    await user.keyboard('{ArrowRight}{Enter}');

    expect(onChange).toHaveBeenCalledWith('2026-06-15');
  });
});
