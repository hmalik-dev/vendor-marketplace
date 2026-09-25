import { describe, expect, it } from 'vitest';
import {
  hasBookingHappened,
  isBookingReviewable,
  isReviewWindowOpen,
  reviewDeadline,
} from './reviews.dao.js';

/*
 * VEN-747. The window closes when `eventDate + 14` stops being anybody's today,
 * the same universal-past test the "has it happened" half uses, so the server
 * never closes it early for a reviewer west of UTC. On UTC day Sep 24 the last
 * day still somebody's today is Sep 23, so an event on Sep 9 is open and one on
 * Sep 8 is closed, at either end of that UTC day.
 */
describe('the review window', () => {
  const EARLY = new Date('2026-09-24T00:00:00.000Z');
  const LATE = new Date('2026-09-24T23:59:59.999Z');

  it('ends REVIEW_WINDOW_DAYS after the event, across a month end', () => {
    expect(reviewDeadline('2026-09-09')).toBe('2026-09-23');
    expect(reviewDeadline('2026-12-25')).toBe('2027-01-08');
  });

  it('is open on the last open day and closed on the first closed day', () => {
    for (const now of [EARLY, LATE]) {
      expect(isReviewWindowOpen('2026-09-09', now), now.toISOString()).toBe(true);
      expect(isReviewWindowOpen('2026-09-08', now), now.toISOString()).toBe(false);
    }
  });

  it('closes for completed and for confirmed-and-past alike', () => {
    for (const status of ['completed', 'confirmed']) {
      expect(isBookingReviewable({ status, eventDate: '2026-09-09' }, LATE), status).toBe(true);
      expect(isBookingReviewable({ status, eventDate: '2026-09-08' }, EARLY), status).toBe(false);
    }
  });

  it('never opens a booking that did not happen, however recent', () => {
    for (const status of ['pending', 'cancelled', 'disputed']) {
      expect(isBookingReviewable({ status, eventDate: '2026-09-20' }, LATE), status).toBe(false);
    }

    // A confirmed booking dated today is still somebody's future.
    expect(hasBookingHappened({ status: 'confirmed', eventDate: '2026-09-24' }, LATE)).toBe(false);
    expect(isBookingReviewable({ status: 'confirmed', eventDate: '2026-09-24' }, LATE)).toBe(false);
  });
});
