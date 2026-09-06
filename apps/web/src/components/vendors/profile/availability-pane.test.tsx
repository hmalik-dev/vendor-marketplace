import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AvailabilityStatus } from '@vendor-marketplace/shared';
import { viewerOn } from '@/testing/viewer-clock';
import { formatAccessibleDate } from '@/lib/calendar';
import { AvailabilityPane } from './availability-pane';

/** The server's day. The viewer's is moved away from it on purpose below. */
const SERVER_TODAY = '2026-06-15';

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  viewerOn(SERVER_TODAY);
});

afterAll(() => {
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  viewerOn(SERVER_TODAY);
});

function pane(calendar: Readonly<Record<string, AvailabilityStatus>> = {}): void {
  render(
    <AvailabilityPane
      calendar={calendar}
      serverToday={SERVER_TODAY}
      businessName="Kessler & Co."
    />,
  );
}

/**
 * The cell for a day, found by the words inside it that state its meaning.
 *
 * It used to be found by `title=`, which is a tooltip: not part of a `<span>`'s
 * accessible name, unspoken by most screen readers and unreachable by keyboard.
 * So the test was asserting on a string no assistive technology ever read, and
 * free-versus-booked was carried by colour alone (#411). The state is now real
 * text in the cell, and this reads that.
 */
function day(date: string): HTMLElement | null {
  const state = screen.queryByText(new RegExp(`^${formatAccessibleDate(date)} — `));

  return state?.parentElement ?? null;
}

/** What the cell says about the day, in words. */
function stateOf(date: string): string | undefined {
  return day(date)?.querySelector('.sr-only')?.textContent ?? undefined;
}

describe('AvailabilityPane', () => {
  it('draws the current and next month, and names each day’s state in words', () => {
    pane({ '2026-06-20': 'blocked', '2026-06-21': 'booked' });

    expect(screen.getByRole('region', { name: 'June 2026' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'July 2026' })).toBeDefined();

    // A date with no row is free — the vendor records only exceptions.
    expect(stateOf('2026-06-22')).toBe('Monday, June 22, 2026 — free');
    expect(stateOf('2026-06-20')).toBe('Saturday, June 20, 2026 — not available');
    expect(stateOf('2026-06-21')).toBe('Sunday, June 21, 2026 — not available');
  });

  /*
   * #409. This pane is one half of the pair the ticket says must agree: it and
   * the request form's picker read the same calendar, so if it decides what is
   * past from the server's day while the picker decides from the viewer's, a
   * visitor is shown a day as history and then offered it on the next screen.
   *
   * Server and viewer are deliberately a day apart here; that gap is the test.
   */
  it('reads past from the viewer’s day, not the server’s', () => {
    // 02:00Z on the 15th — still 21:00 on the 14th for a visitor at UTC-5.
    process.env.TZ = 'America/Chicago';
    vi.setSystemTime(new Date('2026-06-15T02:00:00Z'));

    pane();

    // The visitor's own today is live and says so; the day before it is past.
    expect(stateOf('2026-06-14')).toBe('Sunday, June 14, 2026 — free');
    expect(stateOf('2026-06-13')).toBe('Saturday, June 13, 2026 — in the past');

    process.env.TZ = 'UTC';
  });

  it('says a past day is past rather than making a claim about it', () => {
    pane({ '2026-06-10': 'blocked' });

    // "in the past", never "not available": a day nobody could book says
    // nothing about whether the vendor was free on it.
    expect(stateOf('2026-06-10')).toBe('Wednesday, June 10, 2026 — in the past');

    /*
     * `stone-500` is `01-foundations.md`'s disabled/out-of-month tone.
     * `stone-400` is a *border* token, and as text on `stone-0` it measured
     * about 1.7:1 — below the 4.5:1 every text node owes, and below the 3:1
     * even a large one does.
     */
    expect(day('2026-06-10')?.className).toContain('text-stone-500');
  });

  it('gives an unavailable day a text colour that carries meaning', () => {
    pane({ '2026-06-20': 'booked' });

    /*
     * A day that is not available is a *label*, not a disabled control, so it
     * takes `stone-600` — the foundations table's minimum for any real label.
     * It was drawn in `stone-400` with a strikethrough, and neither the colour
     * nor the strikethrough is exposed to a reader at all.
     */
    expect(day('2026-06-20')?.className).toContain('text-stone-600');
  });

  it('says what sage means rather than leaving colour to carry it', () => {
    pane();

    expect(
      screen.getByText(
        'Dates in sage are open. Kessler & Co. confirms the date when they accept a request.',
      ),
    ).toBeDefined();
  });
});
