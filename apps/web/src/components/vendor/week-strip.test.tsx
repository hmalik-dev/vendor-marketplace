import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { WireVendorDashboard } from '@/lib/wire-schemas';
import { viewerOn } from '@/testing/viewer-clock';
import { WeekStrip } from './week-strip';

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  viewerOn(SERVER_TODAY);
});

afterAll(() => {
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  // Back on the server's day, so a test that moved the viewer does not decide
  // where the next one's slice starts.
  viewerOn(SERVER_TODAY);
});

/**
 * The nine-day window the API sends, starting on a fixed Monday so no test
 * depends on the real clock. Offsets are indexes into the window, so offset 1
 * is `SERVER_TODAY` — the Tuesday the strip draws first by default.
 */
function windowDays(
  overrides: Record<number, WireVendorDashboard['bookingWindow'][number]['status']> = {},
): WireVendorDashboard['bookingWindow'] {
  return Array.from({ length: 9 }, (_, offset) => ({
    date: `2026-06-${String(8 + offset).padStart(2, '0')}`,
    status: overrides[offset] ?? ('available' as const),
  }));
}

/** The UTC day the window is centred on: index 1, a Tuesday. */
const SERVER_TODAY = '2026-06-09';

function strip(
  overrides: Record<number, WireVendorDashboard['bookingWindow'][number]['status']> = {},
) {
  return render(<WeekStrip days={windowDays(overrides)} serverToday={SERVER_TODAY} />);
}

describe('WeekStrip', () => {
  it('draws one cell per day, at the frame’s 44px height', () => {
    const { container } = strip();

    const cells = container.querySelectorAll('li');
    expect(cells).toHaveLength(7);
    for (const cell of cells) {
      // `h-11` is 44px — frame `27 Vendor dashboard — 1024`'s cell height.
      expect(cell.className).toContain('h-11');
      // 8px — frame `27`'s cell radius, which is `rounded-md` on this scale.
      expect(cell.className).toContain('rounded-md');
    }
    expect(container.querySelector('ul')?.className).toContain('grid-cols-7');
  });

  it('names every state in words, never in colour alone', () => {
    strip({ 2: 'booked', 3: 'pending', 4: 'blocked' });

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
    const { container } = strip({ 2: 'booked', 3: 'pending', 4: 'blocked' });

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
    const { container } = strip();

    const number = container.querySelectorAll('li span[aria-hidden="true"]')[0];
    expect(number?.className).toContain('font-display');
    expect(number?.className).toContain('text-[16px]');
    expect(number?.textContent).toBe('9');
  });

  /*
   * #409. The nine days the API sends are anchored on its UTC day; which seven
   * the vendor sees is anchored on theirs. Before this the strip drew the
   * server's seven, so a vendor at UTC-5 in the evening got a "This week" that
   * began tomorrow and did not contain the day they were living in.
   */
  it('starts the week on the viewer’s day when it is behind the server’s', () => {
    viewerOn('2026-06-08');

    strip();

    // Monday the 8th leads, and Sunday the 14th closes — not the 9th to 15th.
    expect(screen.getByText('Monday, June 8 — Open')).toBeDefined();
    expect(screen.getByText('Sunday, June 14 — Open')).toBeDefined();
    expect(screen.queryByText('Monday, June 15 — Open')).toBeNull();
  });

  it('starts the week on the viewer’s day when it is ahead of the server’s', () => {
    viewerOn('2026-06-10');

    strip();

    expect(screen.getByText('Wednesday, June 10 — Open')).toBeDefined();
    expect(screen.getByText('Tuesday, June 16 — Open')).toBeDefined();
    expect(screen.queryByText('Tuesday, June 9 — Open')).toBeNull();
  });

  /*
   * A viewer's day is always inside the window, so this is unreachable in a
   * browser — but `findIndex` returns -1 rather than throwing, and a bare
   * `slice(-1, 6)` would render a single cell. Seven days, whatever happens.
   */
  it('still draws seven days when the viewer’s day is outside the window', () => {
    viewerOn('2026-07-04');

    const { container } = strip();

    expect(container.querySelectorAll('li')).toHaveLength(7);
    expect(screen.getByText('Monday, June 8 — Open')).toBeDefined();
  });
});
