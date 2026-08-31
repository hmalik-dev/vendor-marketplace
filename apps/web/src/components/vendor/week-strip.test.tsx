import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { WireVendorDashboard } from '@/lib/wire-schemas';
import { WeekStrip } from './week-strip';

afterEach(cleanup);

/** Seven consecutive days from a fixed Tuesday, so no test depends on today. */
function week(
  overrides: Record<number, WireVendorDashboard['bookingWeek'][number]['status']> = {},
): WireVendorDashboard['bookingWeek'] {
  return Array.from({ length: 7 }, (_, offset) => ({
    date: `2026-06-${String(9 + offset).padStart(2, '0')}`,
    status: overrides[offset] ?? ('available' as const),
  }));
}

describe('WeekStrip', () => {
  it('draws one cell per day, at the frame’s 44px height', () => {
    const { container } = render(<WeekStrip week={week()} />);

    const cells = container.querySelectorAll('li');
    expect(cells).toHaveLength(7);
    for (const cell of cells) {
      // `h-11` is 44px — frame `27 Vendor dashboard — 1024`'s cell height.
      expect(cell.className).toContain('h-11');
      expect(cell.className).toContain('rounded-lg');
    }
    expect(container.querySelector('ul')?.className).toContain('grid-cols-7');
  });

  it('names every state in words, never in colour alone', () => {
    render(<WeekStrip week={week({ 1: 'booked', 2: 'pending', 3: 'blocked' })} />);

    // The accessible name carries the date and the state together, so the
    // 7.5px caption is never the only place either one is stated.
    expect(screen.getByText('Tuesday, June 9 — Open')).toBeDefined();
    expect(screen.getByText('Wednesday, June 10 — Booked')).toBeDefined();
    expect(screen.getByText('Thursday, June 11 — Held')).toBeDefined();
    expect(screen.getByText('Friday, June 12 — Blocked')).toBeDefined();
  });

  /*
   * The defect this guards: a strip that painted `pending` or `blocked` with
   * the open tone would tell the vendor they are free on a day they are not.
   * `40-states.md` binds the colours — sage is settled, gold is waiting.
   */
  it('gives a held or blocked day its own tone, not the open one', () => {
    const { container } = render(
      <WeekStrip week={week({ 1: 'booked', 2: 'pending', 3: 'blocked' })} />,
    );

    const cells = [...container.querySelectorAll('li')].map((cell) => cell.className);

    expect(cells[0]).toContain('bg-stone-150');
    expect(cells[1]).toContain('bg-sage-50');
    expect(cells[2]).toContain('bg-gold-50');
    expect(cells[3]).toContain('bg-stone-100');
  });

  /*
   * `01-foundations.md`'s serif floor, asserted here as well as in the
   * tree-wide guard: this is the one place in the bundle where a frame asks
   * for serif below 16px, so a later edit "back to the frame" has to fail
   * beside the component rather than only in a file nobody reads.
   */
  it('keeps the day number at the serif floor, above the frame’s 15px', () => {
    const { container } = render(<WeekStrip week={week()} />);

    const number = container.querySelectorAll('li span[aria-hidden="true"]')[0];
    expect(number?.className).toContain('font-display');
    expect(number?.className).toContain('text-[16px]');
    expect(number?.textContent).toBe('9');
  });
});
