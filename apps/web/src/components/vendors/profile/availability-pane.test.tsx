import { cleanup, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AvailabilityStatus } from '@vendor-marketplace/shared';
import { viewerOn } from '@/testing/viewer-clock';
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

/** The cell for a day, found by the `title` that states its meaning in words. */
function day(date: string): HTMLElement | null {
  return screen.queryByTitle(new RegExp(`^${date} — `));
}

describe('AvailabilityPane', () => {
  it('draws the current and next month, and names each day’s state in words', () => {
    pane({ '2026-06-20': 'blocked', '2026-06-21': 'booked' });

    expect(screen.getByRole('region', { name: 'June 2026' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'July 2026' })).toBeDefined();

    // A date with no row is free — the vendor records only exceptions.
    expect(day('2026-06-22')?.getAttribute('title')).toBe('2026-06-22 — free');
    expect(day('2026-06-20')?.getAttribute('title')).toBe('2026-06-20 — not available');
    expect(day('2026-06-21')?.getAttribute('title')).toBe('2026-06-21 — not available');
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

    // The visitor's own today is live and says so; a past day carries no title.
    expect(day('2026-06-14')?.getAttribute('title')).toBe('2026-06-14 — free');
    expect(day('2026-06-13')).toBeNull();

    process.env.TZ = 'UTC';
  });

  it('leaves a past day inert, with no claim about it either way', () => {
    pane({ '2026-06-10': 'blocked' });

    // Rendered — the month grid is whole — but carrying no title at all, so it
    // never says "not available" about a day nobody could book anyway.
    expect(day('2026-06-10')).toBeNull();

    // Scoped to June: the grid draws a 10th in both months.
    const june = within(screen.getByRole('region', { name: 'June 2026' }));
    expect(june.getByText('10').className).toContain('text-stone-400');
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
