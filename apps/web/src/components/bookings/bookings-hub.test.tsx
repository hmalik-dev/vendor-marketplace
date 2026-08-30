import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BookingsHub } from './bookings-hub';
import type { BookingEntry } from '@/lib/booking-entries';

afterEach(cleanup);

const TODAY = '2026-04-26';

function entry(overrides: Partial<BookingEntry> = {}): BookingEntry {
  return {
    id: 'e1',
    kind: 'request',
    vendorSlug: 'kessler-co',
    vendorName: 'Kessler & Co.',
    vendorImageUrl: null,
    categoryName: 'Photography',
    occasion: 'Wedding',
    eventDate: '2026-06-14',
    venue: 'Barr Mansion',
    status: 'confirmed',
    statusLabel: 'Confirmed',
    statusTone: 'confirmed',
    subline: '$1,450 paid · Barr Mansion',
    isSettled: false,
    ...overrides,
  };
}

describe('BookingsHub', () => {
  it('names the next booking and how far off it is', () => {
    render(
      <BookingsHub entries={[entry()]} tab="upcoming" today={TODAY} city="Austin" needsYou={[]} />,
    );

    expect(screen.getByText(/1 upcoming booking\./)).toBeDefined();
    expect(screen.getByText('Kessler & Co.', { selector: 'strong' })).toBeDefined();
    expect(screen.getByText(/in 49 days\./)).toBeDefined();
  });

  /*
   * The header is derived from the booking date and stands for nothing else:
   * there is no Event entity, so it carries a count and no link to open.
   */
  it('heads each month with its label, a rule and a count, and nothing to open', () => {
    render(
      <BookingsHub
        entries={[entry({ id: 'a' }), entry({ id: 'b', eventDate: '2026-06-20' })]}
        tab="upcoming"
        today={TODAY}
        city={null}
        needsYou={[]}
      />,
    );

    const heading = screen.getByRole('heading', { name: 'JUNE 2026' });
    const group = heading.closest('section');

    expect(group).not.toBeNull();
    expect(within(group!).getByText('2 bookings')).toBeDefined();
    expect(within(group!).queryByRole('link', { name: /Event details/ })).toBeNull();
  });

  it('writes the card as the frame does — vendor, category and occasion, date, sub-line', () => {
    render(
      <BookingsHub entries={[entry()]} tab="upcoming" today={TODAY} city={null} needsYou={[]} />,
    );

    expect(screen.getByText('Photography · Wedding')).toBeDefined();
    expect(screen.getByText('Sun, Jun 14')).toBeDefined();
    expect(screen.getByText('$1,450 paid · Barr Mansion')).toBeDefined();
    expect(screen.getByText('Confirmed')).toBeDefined();
  });

  it('offers the next booking from the last group date, in the customer city', () => {
    render(
      <BookingsHub
        entries={[entry({ eventDate: '2026-09-05' })]}
        tab="upcoming"
        today={TODAY}
        city="Austin"
        needsYou={[]}
      />,
    );

    expect(screen.getByText('Search Sep 5 in Austin')).toBeDefined();
    expect(screen.getByRole('link', { name: /Book another vendor/ }).getAttribute('href')).toBe(
      '/search?date=2026-09-05&city=Austin',
    );
  });

  it('omits the city from the invitation when the customer has not set one', () => {
    render(
      <BookingsHub entries={[entry()]} tab="upcoming" today={TODAY} city={null} needsYou={[]} />,
    );

    expect(screen.getByText('Search Jun 14')).toBeDefined();
  });

  /* Frame `19`. Never a blank pane, and never a dead end. */
  it('explains what will land here when there is nothing yet', () => {
    render(<BookingsHub entries={[]} tab="upcoming" today={TODAY} city={null} needsYou={[]} />);

    expect(screen.getByText('No bookings yet')).toBeDefined();
    expect(
      screen.getByText(
        /Every request you send will land here, grouped by month, with its status and the vendor’s replies\./,
      ),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Find a vendor' }).getAttribute('href')).toBe(
      '/search',
    );
    expect(screen.getByText('Send a request')).toBeDefined();
  });

  it('says nothing is coming up rather than naming a booking that is not there', () => {
    render(<BookingsHub entries={[]} tab="upcoming" today={TODAY} city={null} needsYou={[]} />);

    expect(screen.getByText(/Nothing coming up\./)).toBeDefined();
  });

  it('counts each tab, and labels the controls as the frame does', () => {
    render(
      <BookingsHub
        entries={[entry(), entry({ id: 'old', eventDate: '2026-01-01', isSettled: true })]}
        tab="upcoming"
        today={TODAY}
        city={null}
        needsYou={[]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Upcoming 1' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'History 1' })).toBeDefined();
    expect(screen.getByText('All categories ▾')).toBeDefined();
    expect(screen.getByText('Soonest first ▾')).toBeDefined();
  });

  /* The word belongs to the vendor's screen, not the customer's. */
  it('never calls itself a dashboard', () => {
    const { container } = render(
      <BookingsHub entries={[entry()]} tab="upcoming" today={TODAY} city={null} needsYou={[]} />,
    );

    expect(container.textContent?.toLowerCase()).not.toContain('dashboard');
  });

  /*
   * #309. Every card here opened `/vendors/<slug>` — the vendor's marketing
   * page, whose only controls are `Request booking` and `Send a message`. A
   * customer opening the request they had already sent arrived somewhere
   * offering to send it again.
   *
   * The rail's `Review quote` link was corrected when that surface was built.
   * The cards were not, and they are how everything that is *not* a live quote
   * is reached — so `pending`, `accepted` and every settled row had no route to
   * their own detail at all. Withdrawing an unanswered request is unreachable
   * from this page without this.
   */
  describe('where a card opens', () => {
    /*
     * Found by the card's own content, not by position. The status tabs are
     * `li > a` too, and a positional selector picked those up instead — a
     * reading that would have "passed" against the wrong element entirely.
     */
    function linkFor(
      overrides: Partial<BookingEntry>,
      tab: 'upcoming' | 'history' = 'upcoming',
    ): string | null {
      render(
        <BookingsHub
          entries={[entry({ vendorName: 'Kessler & Co.', ...overrides })]}
          tab={tab}
          today={TODAY}
          city="Austin"
          needsYou={[]}
        />,
      );

      const card = screen
        .getAllByRole('link')
        .find((link) => link.textContent?.includes('Kessler & Co.'));

      return card ? (card.getAttribute('href') ?? null) : null;
    }

    it('opens a pending request at the request, not the storefront', () => {
      expect(linkFor({ kind: 'request', id: 'req-9', status: 'pending' })).toBe('/bookings/req-9');
    });

    it('opens a quoted request at the request', () => {
      expect(linkFor({ kind: 'request', id: 'req-9', status: 'quoted' })).toBe('/bookings/req-9');
    });

    /*
     * "What did I agree to, and what happened to it" is exactly what a
     * customer opens a finished request for, so a settled row keeps its own
     * detail rather than falling back to a page about selling to them.
     */
    it('opens a settled request at the request too', () => {
      // Settled rows live under History; asking for one on `upcoming` renders
      // no card at all, which is a null that looks like a failing assertion.
      expect(
        linkFor({ kind: 'request', id: 'req-9', status: 'cancelled', isSettled: true }, 'history'),
      ).toBe('/bookings/req-9');
    });

    /*
     * A booking row has no detail route of its own yet, and no slug either —
     * `bookingToEntry` writes `vendorSlug: null` unconditionally — so it is a
     * card and not a link.
     *
     * An earlier version of this asserted that a booking row kept a
     * `/vendors/<slug>` link, which passed only because the fixture supplied a
     * slug on a `kind: 'booking'` entry. `bookingToEntry` cannot emit that
     * combination, so the assertion described a row the application does not
     * produce — the same "impossible row" this file criticises two tests up.
     */
    it('renders a booking row as a card, because it has nowhere of its own to go', () => {
      expect(linkFor({ kind: 'booking', id: 'bk-9', status: 'confirmed', vendorSlug: null })).toBe(
        null,
      );
    });
  });
});
