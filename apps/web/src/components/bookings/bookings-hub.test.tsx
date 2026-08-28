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
});
