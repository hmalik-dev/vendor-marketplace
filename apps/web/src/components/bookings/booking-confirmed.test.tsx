import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BookingConfirmed } from './booking-confirmed';
import type { WireBooking } from '@/lib/wire-schemas';

function booking(overrides: Partial<WireBooking> = {}): WireBooking {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    requestId: 'req-1',
    eventDate: '2027-06-14',
    eventType: 'Wedding',
    venue: 'Barr Mansion',
    totalAmountCents: 145_000,
    status: 'confirmed',
    ...overrides,
  } as unknown as WireBooking;
}

const VENDOR = {
  slug: 'kessler-co',
  businessName: 'Kessler & Co.',
  avatarUrl: null,
  city: 'Austin, TX',
};

afterEach(cleanup);

describe('BookingConfirmed', () => {
  /*
   * The date, not the transaction. "Booking confirmed" is a receipt; the date
   * is what they bought, and frame `06` leads with it in 48px serif.
   */
  it('names the date rather than the transaction', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('June 14 is yours.');
  });

  it('shows what was paid and the booking id support would ask for', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    expect(screen.getByText('$1,450')).toBeDefined();
    expect(screen.getByText('a1b2c3d4-0000-4000-8000-000000000001')).toBeDefined();
  });

  it('sends Message to the thread with this vendor', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    expect(screen.getByRole('link', { name: 'Message Kessler & Co.' }).getAttribute('href')).toBe(
      '/messages?conversation=conv-1',
    );
  });

  /* No thread yet is not a dead control — it goes to the list. */
  it('falls back to the message list when no thread exists yet', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId={null} />);

    expect(screen.getByRole('link', { name: 'Message Kessler & Co.' }).getAttribute('href')).toBe(
      '/messages',
    );
  });

  /*
   * The revised frame `06` cut the "couples who booked Maya also booked"
   * framing: it needs pairing data the app does not have. What is left is
   * category **names**, and a count beside any of them would be exactly the
   * invented number the parity rules forbid on a public surface.
   */
  it('offers category names with no counts, filtered to this event date', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId={null} />);

    expect(screen.getByText('Still need someone for June 14?')).toBeDefined();

    const florals = screen.getByRole('link', { name: 'Florals' });
    expect(florals.getAttribute('href')).toBe('/search?category=florals&date=2027-06-14');

    for (const chip of ['Florals', 'Live music', 'Catering', 'Cake']) {
      expect(screen.getByRole('link', { name: chip }).textContent).toBe(chip);
    }
  });
});
