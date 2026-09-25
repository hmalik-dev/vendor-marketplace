import { describe, expect, it } from 'vitest';
import {
  applyRefinements,
  categoryNamesOf,
  daysUntil,
  entriesForTab,
  formatCardDate,
  formatEventDate,
  groupByMonth,
  needsYouItems,
  requestToEntry,
  summarise,
  toEntries,
  type BookingEntry,
} from './booking-entries';
import type { WireBookingRequest, WireOwnBooking } from './wire-schemas';

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
      categoryName: 'Photography',
      avgRating: 4.9,
      reviewCount: 127,
    },
    package: null,
    ...overrides,
  } as WireBookingRequest;
}

/** A vendor block carrying a specific primary category, for the refinement tests. */
function vendorWith(categoryName: string | null, id: string): WireBookingRequest['vendor'] {
  return {
    id,
    slug: `vendor-${id}`,
    businessName: `Vendor ${id}`,
    city: 'Austin',
    state: 'TX',
    avatarUrl: null,
    categoryName,
    avgRating: 4.5,
    reviewCount: 10,
    availability: 'available',
  };
}

function booking(overrides: Partial<WireOwnBooking> = {}): WireOwnBooking {
  return {
    id: 'bok-1',
    requestId: 'req-1',
    customerId: 'cus-1',
    vendorId: 'ven-1',
    eventDate: '2026-06-14',
    eventLocation: 'Barr Mansion',
    totalAmountCents: 145_000,
    status: 'confirmed',
    paidAt: NOW,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    eventType: 'wedding',
    venue: 'Barr Mansion',
    reviewDeadline: null,
    ...overrides,
  } as WireOwnBooking;
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

describe('formatEventDate', () => {
  it('writes the date out, as the request form and its review step do', () => {
    expect(formatEventDate('2026-10-20')).toBe('October 20, 2026');
  });

  it('reads the date as UTC, so no viewer west of UTC loses a day', () => {
    expect(formatEventDate('2026-01-01')).toBe('January 1, 2026');
  });
});

describe('toEntries', () => {
  /**
   * #412's second finding. `/customer/profile` sized the shared sidebar badge
   * as `requests.length + bookings.length`, which counts every paid request
   * twice — 9 against the hub's 7, in the one navigation element the two pages
   * share. `toEntries` is the count, on both pages.
   */
  it('counts a paid request once, not once per table', () => {
    const entries = toEntries(
      [request({ id: 'req-1' }), request({ id: 'req-2' })],
      [booking({ requestId: 'req-1' })],
      NOW,
    );

    expect(entries).toHaveLength(2);
  });

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

/*
 * #302/#187. Both chips were drawn as `<span>`s — not focusable, no handler, no
 * URL param — so the hub rendered a filter bar that filtered nothing. These are
 * the two pure functions behind them; the controls themselves are asserted in
 * the hub's own test, because a filter that computes correctly and is never
 * wired reads exactly like the defect it replaces.
 */
describe('categoryNamesOf', () => {
  const mixed = toEntries(
    [
      request({ id: 'a', vendorId: 'v1' }),
      request({ id: 'b', vendorId: 'v2', vendor: vendorWith('Catering', 'v2') }),
      request({ id: 'c', vendorId: 'v3', vendor: vendorWith('Photography', 'v3') }),
      request({ id: 'd', vendorId: 'v4', vendor: vendorWith(null, 'v4') }),
    ],
    [],
    NOW,
  );

  it('lists each category once, alphabetically, and omits the untagged', () => {
    expect(categoryNamesOf(mixed)).toEqual(['Catering', 'Photography']);
  });

  /*
   * A vendor with no active category yields null, and an "All categories"
   * dropdown carrying a blank row is worse than one that omits it.
   */
  it('is empty when nothing carries a category', () => {
    expect(
      categoryNamesOf(toEntries([request({ vendor: vendorWith(null, 'v9') })], [], NOW)),
    ).toEqual([]);
  });
});

describe('applyRefinements', () => {
  const entries = toEntries(
    [
      request({ id: 'photo', eventDate: '2026-06-14' }),
      request({ id: 'cater', eventDate: '2026-05-02', vendor: vendorWith('Catering', 'v2') }),
      request({ id: 'untagged', eventDate: '2026-07-30', vendor: vendorWith(null, 'v3') }),
    ],
    [],
    NOW,
  );

  it('returns everything, soonest first, when no category is chosen', () => {
    expect(
      applyRefinements(entries, { category: null, sort: 'soonest' }).map((found) => found.id),
    ).toEqual(['cater', 'photo', 'untagged']);
  });

  it('keeps only the chosen category', () => {
    expect(
      applyRefinements(entries, { category: 'Photography', sort: 'soonest' }).map(
        (found) => found.id,
      ),
    ).toEqual(['photo']);
  });

  /*
   * An unknown `?category=` is a stale link or a hand-typed URL, not a reason to
   * show an empty hub with no explanation — the filter is dropped rather than
   * matching nothing.
   */
  it('ignores a category no entry carries', () => {
    expect(
      applyRefinements(entries, { category: 'Taxidermy', sort: 'soonest' }).map(
        (found) => found.id,
      ),
    ).toEqual(['cater', 'photo', 'untagged']);
  });

  it('sorts by event date in both directions', () => {
    expect(
      applyRefinements(entries, { category: null, sort: 'latest' }).map((found) => found.eventDate),
    ).toEqual(['2026-07-30', '2026-06-14', '2026-05-02']);
  });

  it('does not mutate the list it was given', () => {
    const before = entries.map((found) => found.id);
    applyRefinements(entries, { category: null, sort: 'latest' });

    expect(entries.map((found) => found.id)).toEqual(before);
  });

  /*
   * The months have to turn round with the cards. `groupByMonth` used to sort
   * its keys ascending regardless of the order it was given, so `Latest first`
   * would have reversed the cards *inside* each month while the month headings
   * still climbed — a list that is descending in the small and ascending in the
   * large, which is not an order at all.
   */
  it('reverses the month headings too, not just the cards inside them', () => {
    const spread = toEntries(
      [
        request({ id: 'jun', eventDate: '2026-06-14' }),
        request({ id: 'may', eventDate: '2026-05-02' }),
        request({ id: 'jul', eventDate: '2026-07-30' }),
      ],
      [],
      NOW,
    );

    expect(
      groupByMonth(applyRefinements(spread, { category: null, sort: 'latest' })).map(
        (group) => group.key,
      ),
    ).toEqual(['2026-07', '2026-06', '2026-05']);
    expect(
      groupByMonth(applyRefinements(spread, { category: null, sort: 'soonest' })).map(
        (group) => group.key,
      ),
    ).toEqual(['2026-05', '2026-06', '2026-07']);
  });
});

describe('toEntries past the first page of each list (VEN-433)', () => {
  it('reads a paid booking as paid when its request sits beyond the hundredth row', () => {
    const count = 150;
    const requests = Array.from({ length: count }, (_, index) =>
      request({ id: `req-${index}`, status: 'accepted', eventDate: '2026-06-14' }),
    );
    const bookings = Array.from({ length: count }, (_, index) =>
      booking({ id: `bok-${index}`, requestId: `req-${index}`, status: 'confirmed' }),
    );

    const entries = toEntries(requests, bookings, NOW);

    expect(entries).toHaveLength(count);
    expect(entries.filter((entry) => entry.status === 'accepted')).toEqual([]);
    expect(entries.find((entry) => entry.id === 'bok-149')?.status).toBe('confirmed');
  });
});

/*
 * VEN-746. The rail's `Needs you` panel lists what waits on the customer: a
 * quote to review and an accepted request to pay. It was quotes alone, so an
 * accepted request waiting on payment surfaced nowhere.
 */
describe('needsYouItems', () => {
  it('lists quotes first, then accepted requests, each with its action', () => {
    const items = needsYouItems(
      toEntries(
        [
          request({ id: 'req-a', status: 'accepted', eventDate: '2026-05-01' }),
          request({ id: 'req-q1', status: 'quoted', eventDate: '2026-06-01' }),
          request({ id: 'req-q2', status: 'quoted', eventDate: '2026-07-01' }),
        ],
        [],
        NOW,
      ),
      TODAY,
    );

    expect(items.map((item) => [item.kind, item.entry.requestId, item.title, item.action])).toEqual(
      [
        [
          'quote',
          'req-q1',
          'Kessler & Co. sent a quote',
          { label: 'Review quote', href: '/bookings/req-q1' },
        ],
        [
          'quote',
          'req-q2',
          'Kessler & Co. sent a quote',
          { label: 'Review quote', href: '/bookings/req-q2' },
        ],
        [
          'pay',
          'req-a',
          'Kessler & Co. accepted your request',
          { label: 'Pay now', href: '/bookings/req-a/checkout' },
        ],
      ],
    );
  });

  it('never offers Pay now for a request that was already paid', () => {
    const entries = toEntries(
      [request({ id: 'req-1', status: 'accepted' })],
      [booking({ requestId: 'req-1' })],
      NOW,
    );

    expect(entries.map((entry) => entry.status)).toEqual(['confirmed']);
    expect(needsYouItems(entries, TODAY)).toEqual([]);
  });

  /*
   * VEN-747. A finished booking the customer can still review asks for it, after
   * the quotes and payments, newest event first. `reviewDeadline` is the API's
   * answer to "can this reader still review it", so a `null` asks for nothing.
   */
  it('asks for a review after quotes and payments, newest event first', () => {
    const entries = toEntries(
      [
        request({ id: 'req-q', status: 'quoted' }),
        request({ id: 'req-a', status: 'accepted', eventDate: '2026-05-02' }),
      ],
      [
        booking({
          id: 'bok-old',
          requestId: 'paid-old',
          status: 'completed',
          eventDate: '2026-04-14',
          reviewDeadline: '2026-04-28',
        }),
        booking({
          id: 'bok-new',
          requestId: 'paid-new',
          status: 'confirmed',
          eventDate: '2026-04-20',
          eventType: 'holiday_party',
          reviewDeadline: '2026-05-04',
        }),
        booking({
          id: 'bok-shut',
          requestId: 'paid-shut',
          status: 'completed',
          eventDate: '2026-04-22',
          reviewDeadline: null,
        }),
      ],
      NOW,
    );

    expect(
      needsYouItems(entries, TODAY).map((item) => [
        item.kind,
        item.entry.id,
        item.title,
        item.detail,
        item.action,
      ]),
    ).toEqual([
      ['quote', 'req-q', 'Kessler & Co. sent a quote', [expect.any(String)], expect.any(Object)],
      [
        'pay',
        'req-a',
        'Kessler & Co. accepted your request',
        [expect.any(String)],
        expect.any(Object),
      ],
      [
        'review',
        'bok-new',
        'Leave a review for Kessler & Co.',
        ['Your holiday party was 6 days ago.', 'Reviews close May 4.'],
        { label: 'Write a review', href: '/vendors/kessler-co?tab=reviews' },
      ],
      [
        'review',
        'bok-old',
        'Leave a review for Kessler & Co.',
        ['Your wedding was 12 days ago.', 'Reviews close Apr 28.'],
        { label: 'Write a review', href: '/vendors/kessler-co?tab=reviews' },
      ],
    ]);
  });

  it('writes today, yesterday and a missing occasion plainly', () => {
    const detailFor = (eventDate: string, eventType: string | null): readonly string[] =>
      needsYouItems(
        toEntries(
          [request()],
          [booking({ status: 'completed', eventDate, eventType, reviewDeadline: '2026-05-10' })],
          NOW,
        ),
        TODAY,
      )[0]!.detail;

    expect(detailFor(TODAY, 'wedding')[0]).toBe('Your wedding was today.');
    expect(detailFor('2026-04-25', 'wedding')[0]).toBe('Your wedding was yesterday.');
    expect(detailFor('2026-04-25', null)[0]).toBe('Your event was yesterday.');
    const closeFor = (reviewDeadline: string): string | undefined =>
      needsYouItems(
        toEntries(
          [request()],
          [booking({ status: 'completed', eventDate: '2026-04-12', reviewDeadline })],
          NOW,
        ),
        TODAY,
      )[0]!.detail[1];

    expect(closeFor('2026-04-27')).toBe('Reviews close Apr 27.');
    // The last day, and the UTC day after it that the API still counts as open.
    expect(closeFor(TODAY)).toBe('Reviews close today.');
    expect(closeFor('2026-04-25')).toBe('Reviews close today.');
    // `other` reads "Something else" on a card; as an occasion it is just the event.
    expect(detailFor('2026-04-25', 'other')[0]).toBe('Your event was yesterday.');
  });

  it('asks for no review when the vendor has no slug to link to', () => {
    // No request row names this vendor, so nothing carries its slug across.
    const entries = toEntries(
      [],
      [booking({ status: 'completed', eventDate: '2026-04-20', reviewDeadline: '2026-05-04' })],
      NOW,
    );

    expect(entries[0]?.vendorSlug).toBeNull();
    expect(needsYouItems(entries, TODAY)).toEqual([]);
  });

  it('leaves out every status that does not wait on the customer', () => {
    const requests = (['pending', 'declined', 'expired', 'cancelled'] as const).map(
      (status, index) => request({ id: `req-${index}`, status }),
    );
    const bookings = (['confirmed', 'completed', 'cancelled', 'disputed'] as const).map(
      (status, index) => booking({ id: `bok-${index}`, requestId: `paid-${index}`, status }),
    );
    const entries = toEntries(requests, bookings, NOW);

    expect(entries).toHaveLength(8);
    expect(needsYouItems(entries, TODAY)).toEqual([]);
  });
});
