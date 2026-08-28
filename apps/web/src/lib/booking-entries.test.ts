import { describe, expect, it } from 'vitest';
import {
  daysUntil,
  entriesForTab,
  formatCardDate,
  groupByMonth,
  requestToEntry,
  summarise,
  toEntries,
  type BookingEntry,
} from './booking-entries';
import type { WireBooking, WireBookingRequest } from './wire-schemas';

const TODAY = '2026-04-26';
const NOW = new Date('2026-04-26T12:00:00Z');

function request(overrides: Partial<WireBookingRequest> = {}): WireBookingRequest {
  return {
    id: 'req-1',
    customerId: 'cus-1',
    vendorId: 'ven-1',
    packageId: 'pkg-1',
    eventDate: '2026-06-14',
    eventStartTime: null,
    eventType: 'wedding',
    eventLocation: 'Barr Mansion',
    guestCount: 120,
    customDetails: null,
    status: 'pending',
    quotedPriceCents: null,
    quoteNote: null,
    finalPriceCents: 145_000,
    expiresAt: new Date('2026-04-29T12:00:00Z'),
    createdAt: NOW,
    updatedAt: NOW,
    vendor: {
      id: 'ven-1',
      slug: 'kessler-co',
      businessName: 'Kessler & Co.',
      city: 'Austin',
      state: 'TX',
      avatarUrl: null,
      avgRating: 4.9,
      reviewCount: 127,
    },
    package: null,
    ...overrides,
  } as WireBookingRequest;
}

function booking(overrides: Partial<WireBooking> = {}): WireBooking {
  return {
    id: 'bok-1',
    requestId: 'req-1',
    customerId: 'cus-1',
    vendorId: 'ven-1',
    eventDate: '2026-06-14',
    eventLocation: 'Barr Mansion',
    totalAmountCents: 145_000,
    platformFeeCents: 17_400,
    vendorPayoutCents: 127_600,
    status: 'confirmed',
    stripePaymentIntentId: null,
    stripeTransferId: null,
    paidAt: NOW,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    eventType: 'wedding',
    venue: 'Barr Mansion',
    ...overrides,
  } as WireBooking;
}

describe('daysUntil', () => {
  /* Built from date parts, so no timezone can move the day across a boundary. */
  it('counts whole days without a timezone shifting them', () => {
    expect(daysUntil('2026-06-14', TODAY)).toBe(49);
    expect(daysUntil(TODAY, TODAY)).toBe(0);
    expect(daysUntil('2026-04-25', TODAY)).toBe(-1);
  });
});

describe('formatCardDate', () => {
  it('leads with the weekday, which is what makes a date legible', () => {
    expect(formatCardDate('2026-06-14')).toBe('Sun, Jun 14');
  });
});

describe('toEntries', () => {
  it('renders a request that became a booking once, as the booking', () => {
    const entries = toEntries([request({ id: 'req-1' })], [booking({ requestId: 'req-1' })], NOW);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe('booking');
    expect(entries[0]?.subline).toBe('$1,450 paid · Barr Mansion');
  });

  it('sorts by event date, soonest first', () => {
    const entries = toEntries(
      [
        request({ id: 'a', eventDate: '2026-09-05' }),
        request({ id: 'b', eventDate: '2026-06-14' }),
      ],
      [],
      NOW,
    );

    expect(entries.map((entry) => entry.id)).toEqual(['b', 'a']);
  });
});

describe('requestToEntry', () => {
  it('writes the quote and its deadline, which is what the customer acts on', () => {
    const entry = requestToEntry(
      request({ status: 'quoted', quotedPriceCents: 384_000, eventLocation: null }),
      NOW,
    );

    expect(entry.statusLabel).toBe('Quoted');
    expect(entry.subline).toBe('$3,840 quoted · expires in 3d');
  });

  /*
   * A pending card leads with the wait, not a price — nobody has agreed to a
   * number yet, and stating one would imply somebody had.
   */
  it('says a pending request is awaiting a reply, with the deadline', () => {
    expect(requestToEntry(request(), NOW).subline).toBe('awaiting reply · expires in 3d');
  });

  it('drops the deadline once there is none left to state', () => {
    expect(requestToEntry(request({ expiresAt: null }), NOW).subline).toBe('awaiting reply');
  });

  it('shows the agreed price and venue once a request is accepted', () => {
    expect(requestToEntry(request({ status: 'accepted' }), NOW).subline).toBe(
      '$1,450 · Barr Mansion',
    );
  });

  it('spells the occasion out rather than leaking the stored value', () => {
    expect(requestToEntry(request({ eventType: 'baby_shower' }), NOW).occasion).toBe('Baby shower');
  });
});

describe('entriesForTab', () => {
  const entries = toEntries(
    [
      request({ id: 'live', eventDate: '2026-06-14', status: 'pending' }),
      // A declined request for a future date is history, not a plan.
      request({ id: 'declined', eventDate: '2026-07-01', status: 'declined' }),
      request({ id: 'past', eventDate: '2026-01-10', status: 'pending' }),
    ],
    [],
    NOW,
  );

  it('keeps only what is ahead and unsettled under Upcoming', () => {
    expect(entriesForTab(entries, 'upcoming', TODAY).map((entry) => entry.id)).toEqual(['live']);
  });

  it('puts everything else under History, including a future declined request', () => {
    expect(
      entriesForTab(entries, 'history', TODAY)
        .map((entry) => entry.id)
        .sort(),
    ).toEqual(['declined', 'past']);
  });

  it('shows everything under All', () => {
    expect(entriesForTab(entries, 'all', TODAY)).toHaveLength(3);
  });
});

describe('groupByMonth', () => {
  /*
   * The whole grouping model: derived from the booking date, nothing else.
   * There is no Event entity for a header to stand for.
   */
  it('groups by the month of the booking date, oldest month first', () => {
    const entries = toEntries(
      [
        request({ id: 'a', eventDate: '2026-06-14' }),
        request({ id: 'b', eventDate: '2026-06-20' }),
        request({ id: 'c', eventDate: '2026-09-05' }),
      ],
      [],
      NOW,
    );

    const groups = groupByMonth(entries);

    expect(groups.map((group) => group.label)).toEqual(['JUNE 2026', 'SEPTEMBER 2026']);
    expect(groups[0]?.entries).toHaveLength(2);
    expect(groups[1]?.entries).toHaveLength(1);
  });

  it('is empty for no entries rather than inventing a month', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe('summarise', () => {
  it('names the nearest future booking and how far off it is', () => {
    const entries = toEntries(
      [
        request({ id: 'a', eventDate: '2026-06-14' }),
        request({ id: 'b', eventDate: '2026-09-05' }),
      ],
      [],
      NOW,
    );

    expect(summarise(entries, TODAY)).toEqual({
      count: 2,
      nextVendor: 'Kessler & Co.',
      inDays: 49,
    });
  });

  it('has nothing to say when nothing is upcoming', () => {
    const settled: BookingEntry[] = toEntries([request({ status: 'declined' })], [], NOW);

    expect(summarise(settled, TODAY)).toBeNull();
  });
});
