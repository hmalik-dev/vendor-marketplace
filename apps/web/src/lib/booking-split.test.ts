import { describe, expect, it } from 'vitest';
import { lostBookings, splitByEventDate } from './booking-split';

const NOW = new Date('2026-09-04T02:00:00.000Z');

function on(eventDate: string): { eventDate: string } {
  return { eventDate };
}

describe('splitByEventDate', () => {
  /*
   * #409, and the whole reason this is not a plain `< today`. At 02:00Z on the
   * 4th a vendor in Chicago is in the evening of the 3rd. On the server's own
   * day their 3rd is past, so the booking they are photographing tonight was
   * filed under `Past events` — beside a `Mark complete` control that, reading
   * the vendor's own clock, refused to close a job that had not happened.
   */
  it('keeps a day the server has passed but the vendor has not', () => {
    const { upcoming, past } = splitByEventDate([on('2026-09-03')], NOW);

    expect(upcoming).toEqual([on('2026-09-03')]);
    expect(past).toEqual([]);
  });

  it('moves a day that is behind every vendor on Earth', () => {
    const { upcoming, past } = splitByEventDate([on('2026-09-02')], NOW);

    expect(upcoming).toEqual([]);
    expect(past).toEqual([on('2026-09-02')]);
  });

  it('orders upcoming soonest first and past most recent first', () => {
    const { upcoming, past } = splitByEventDate(
      [on('2026-10-01'), on('2026-08-01'), on('2026-09-10'), on('2026-08-20')],
      NOW,
    );

    expect(upcoming.map((entry) => entry.eventDate)).toEqual(['2026-09-10', '2026-10-01']);
    expect(past.map((entry) => entry.eventDate)).toEqual(['2026-08-20', '2026-08-01']);
  });

  /* Every entry lands on exactly one side; nothing is dropped or counted twice. */
  it('partitions rather than filters', () => {
    const entries = ['2026-08-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-12-25'].map(on);

    const { upcoming, past } = splitByEventDate(entries, NOW);

    expect(upcoming.length + past.length).toBe(entries.length);
    expect([...past, ...upcoming].map((entry) => entry.eventDate).toSorted()).toEqual(
      entries.map((entry) => entry.eventDate).toSorted(),
    );
  });

  it('does not mutate the list it was given', () => {
    const entries = [on('2026-12-25'), on('2026-09-10')];

    splitByEventDate(entries, NOW);

    expect(entries.map((entry) => entry.eventDate)).toEqual(['2026-12-25', '2026-09-10']);
  });

  it('returns two empty sides for no entries', () => {
    expect(splitByEventDate([], NOW)).toEqual({ upcoming: [], past: [] });
  });
});

/*
 * The vendor had no surface at all for a cancelled booking (#415): the page
 * filters `accepted`, and #400 settles the parent request when a booking is
 * cancelled, so the card simply stopped rendering.
 */
describe('lostBookings', () => {
  const settlement = {
    bookingId: 'bk-1',
    status: 'cancelled' as const,
    totalAmountCents: 145_000,
    paidAt: new Date('2026-05-02T00:00:00Z'),
    cancelledAt: new Date('2026-06-01T12:00:00Z'),
    cancelledBy: 'customer' as const,
    refundAmountCents: 145_000,
  };

  it('takes a cancelled request that reached a booking', () => {
    expect(lostBookings([{ status: 'cancelled' as const, settlement }])).toHaveLength(1);
  });

  /*
   * A withdrawal cost the vendor nothing — the date was never held — so
   * listing it as a booking they lost would be the mirror of the defect.
   */
  it('leaves out a request withdrawn before it was ever accepted', () => {
    expect(lostBookings([{ status: 'cancelled' as const, settlement: null }])).toEqual([]);
  });

  it('leaves out requests that are not cancelled', () => {
    expect(
      lostBookings([
        { status: 'accepted' as const, settlement },
        { status: 'declined' as const, settlement: null },
        { status: 'pending' as const, settlement: null },
      ]),
    ).toEqual([]);
  });
});
