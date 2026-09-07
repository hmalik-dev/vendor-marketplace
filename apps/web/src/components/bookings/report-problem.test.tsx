import { payoutReleaseAt, SUPPORT_PATH } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BookingStatus } from '@vendor-marketplace/shared';
import { ReportProblem } from './report-problem';

const EVENT_DATE = '2026-06-15';
const BEFORE = new Date('2026-06-13T12:00:00Z');
const INSIDE = new Date('2026-06-16T12:00:00Z');
const RELEASE_AT = payoutReleaseAt(EVENT_DATE)!;

/**
 * The window is decided from the clock at render, so the clock is an input —
 * every case here is about which side of a boundary it falls on.
 */
function at(now: Date, status: BookingStatus, payoutReleasedAt: Date | null = null): void {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  render(
    <ReportProblem
      booking={{ id: 'booking-1', status, eventDate: EVENT_DATE, payoutReleasedAt }}
      vendorName="Sunlit Studio"
    />,
  );
}

describe('ReportProblem', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('offers the report, pointed at the booking, inside the window', () => {
    at(INSIDE, 'confirmed');

    const link = screen.getByRole('link', { name: 'Report a problem' });
    expect(link.getAttribute('href')).toBe(`${SUPPORT_PATH}?booking=booking-1`);
    // The consequence is stated before the click, not after it.
    expect(screen.getByText(/hold Sunlit Studio's payment/)).toBeDefined();
  });

  /**
   * The deadline is a **date**, read from `payoutReleaseAt`. D16 bans a screen
   * restating an interval the code derives — the release window has already
   * moved once — so no state here may name a number of hours or days.
   */
  it('names the day the window closes, and never the interval behind it', () => {
    at(INSIDE, 'confirmed');

    expect(screen.getByText(/up until Jun 18, when it goes out/)).toBeDefined();
    expect(RELEASE_AT.toISOString().startsWith('2026-06-18')).toBe(true);

    for (const [now, status] of [
      [BEFORE, 'confirmed'],
      [INSIDE, 'confirmed'],
      [INSIDE, 'disputed'],
    ] as const) {
      cleanup();
      at(now, status);
      expect(document.body.textContent).not.toMatch(/\d+\s*(hours|days)/i);
    }
  });

  /*
   * `40-states.md` prefers a blocker the reader cannot cross to a control that
   * answers with a refusal — and outside the window the API refuses the hold,
   * so the control would spend a click to be told no.
   */
  it('says what to do instead before the event, and offers no control', () => {
    at(BEFORE, 'confirmed');

    expect(screen.queryByRole('link', { name: 'Report a problem' })).toBeNull();
    expect(screen.getByText(/Reporting a problem opens after the event/)).toBeDefined();
  });

  it('sends the customer to a person once the payout has actually gone out', () => {
    at(INSIDE, 'confirmed', RELEASE_AT);

    expect(screen.queryByRole('link', { name: 'Report a problem' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Contact support' }).getAttribute('href')).toBe(
      SUPPORT_PATH,
    );
    /*
     * Two assertions, because the copy has one job in each half. It must still
     * state that the money has gone — dropping that would leave a customer
     * expecting a hold that cannot happen — and it must lead with the offer,
     * which is the part that was wrong before and the part a future edit would
     * lose first.
     */
    const body = screen.getByText(/payment for this booking has already gone out/);

    expect(body.textContent).toContain("Sunlit Studio's payment for this booking");
    expect(body.textContent?.startsWith('Something still not right?')).toBe(true);
  });

  /*
   * The release date passing is not the release. Between the two the API still
   * accepts a hold, so the control has to still be there.
   */
  it('keeps offering the report after the release date while the money is still held', () => {
    at(new Date(RELEASE_AT.getTime() + 60_000), 'confirmed');

    expect(screen.getByRole('link', { name: 'Report a problem' })).toBeDefined();
  });

  it('says a report is open rather than offering a second one', () => {
    at(INSIDE, 'disputed');

    expect(screen.queryByRole('link', { name: 'Report a problem' })).toBeNull();
    expect(screen.getByText(/payment is on hold while we look into it/)).toBeDefined();
  });

  it('renders nothing at all on a cancelled booking', () => {
    at(INSIDE, 'cancelled');

    expect(screen.queryByText(/report/i)).toBeNull();
  });
});
