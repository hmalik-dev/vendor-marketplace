import { payoutReleaseAt } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { reportWindowFor, type ReportSubject } from './booking-report';

const EVENT_DATE = '2026-06-15';
/** Two days out: the event is still ahead everywhere on Earth. */
const BEFORE = new Date('2026-06-13T12:00:00Z');
/** The day after: the event has happened, the payout has not moved. */
const INSIDE = new Date('2026-06-16T12:00:00Z');
/** Past the instant the sweep may run, whatever the constant says it is. */
const DUE = new Date(payoutReleaseAt(EVENT_DATE)!.getTime() + 60_000);

const OPEN: ReportSubject = {
  status: 'confirmed',
  eventDate: EVENT_DATE,
  payoutReleasedAt: null,
};

describe('reportWindowFor', () => {
  it('opens once the event has happened and the payout has not moved', () => {
    expect(reportWindowFor(OPEN, INSIDE)).toBe('open');
    expect(reportWindowFor({ ...OPEN, status: 'completed' }, INSIDE)).toBe('open');
  });

  it('is shut before the event, where cancelling is the move', () => {
    expect(reportWindowFor(OPEN, BEFORE)).toBe('before-event');
  });

  /**
   * The boundary is the **column**, not the calendar — the defect this
   * distinction exists to prevent.
   *
   * `payoutReleaseAt` says when the sweep may move the money; only
   * `payoutReleasedAt` says that it has. Between the two the API still accepts
   * a hold, so a control gated on the prediction is withdrawn from a customer
   * who could still use it, over a screen claiming the vendor has been paid.
   */
  it('stays open past the release date until the money has actually gone', () => {
    expect(reportWindowFor(OPEN, DUE)).toBe('open');

    expect(reportWindowFor({ ...OPEN, payoutReleasedAt: DUE }, DUE)).toBe('released');
  });

  it('says a report is already open rather than offering a second', () => {
    expect(reportWindowFor({ ...OPEN, status: 'disputed' }, INSIDE)).toBe('reported');
    // Even before the event, an open report is the fact worth stating.
    expect(reportWindowFor({ ...OPEN, status: 'disputed' }, BEFORE)).toBe('reported');
  });

  /*
   * Cancelled wins over released: a booking the customer called off themselves
   * has nothing to report, and "the vendor has been paid, contact support" is
   * the wrong sentence to hand them.
   */
  it('offers nothing on a cancelled booking, paid out or not', () => {
    expect(reportWindowFor({ ...OPEN, status: 'cancelled' }, INSIDE)).toBe('closed');
    expect(reportWindowFor({ ...OPEN, status: 'cancelled', payoutReleasedAt: DUE }, INSIDE)).toBe(
      'closed',
    );
  });
});
