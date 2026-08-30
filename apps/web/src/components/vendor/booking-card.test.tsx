import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BookingCard } from './booking-card';
import type { WireBookingRequest } from '@/lib/wire-schemas';

function accepted(overrides: Partial<WireBookingRequest> = {}): WireBookingRequest {
  return {
    id: 'req-1',
    customerId: 'cus-1',
    vendorId: 'ven-1',
    packageId: 'pkg-1',
    eventDate: '2027-02-13',
    eventStartTime: null,
    eventType: 'wedding',
    eventLocation: 'Zilker Park Clubhouse',
    guestCount: 120,
    customDetails: null,
    status: 'accepted',
    quotedPriceCents: null,
    quoteNote: null,
    finalPriceCents: 120_000,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: {
      firstName: 'Priya',
      lastInitial: 'N',
      lastName: 'Nandakumar',
      email: 'priya@example.com',
      phone: '+15125550143',
    },
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
    package: {
      id: 'pkg-1',
      name: 'Full day coverage',
      priceCents: 120_000,
      priceType: 'fixed',
      durationHours: 6,
      inclusions: ['6 hours'],
    },
    ...overrides,
  } as WireBookingRequest;
}

describe('BookingCard', () => {
  /*
   * The whole reason the surface exists: a vendor who has committed to a date
   * can identify the customer and reach them outside the app.
   */
  it('names the customer in full and offers both contact routes', () => {
    render(<BookingCard request={accepted()} />);

    expect(screen.getByText('Priya Nandakumar')).toBeDefined();
    expect(screen.getByRole('link', { name: 'priya@example.com' })).toHaveProperty(
      'href',
      'mailto:priya@example.com',
    );
    expect(screen.getByRole('link', { name: '+15125550143' })).toHaveProperty(
      'href',
      'tel:+15125550143',
    );
  });

  it('marks the booking settled rather than pending', () => {
    render(<BookingCard request={accepted()} />);

    expect(screen.getByText('Booked')).toBeDefined();
  });

  it('writes the event facts in full, with the price', () => {
    render(<BookingCard request={accepted()} />);

    expect(screen.getByText(/Wedding · Saturday, February 13, 2027/)).toBeDefined();
    expect(
      screen.getByText(/Zilker Park Clubhouse · 120 guests · Full day coverage/),
    ).toBeDefined();
    expect(screen.getByText('$1,200')).toBeDefined();
  });

  /*
   * A customer whose account carries no phone still has to render — the field
   * is nullable at the source, and an empty row is worse than an absent one.
   */
  it('omits a contact row the customer never supplied', () => {
    render(
      <BookingCard request={accepted({ customer: { ...accepted().customer, phone: null } })} />,
    );

    expect(screen.getByRole('link', { name: 'priya@example.com' })).toBeDefined();
    expect(screen.queryByText('Phone')).toBeNull();
  });

  it('falls back to a description rather than a blank when the account has no name', () => {
    render(
      <BookingCard
        request={accepted({
          customer: { firstName: '', lastInitial: '', lastName: null, email: null, phone: null },
        })}
      />,
    );

    expect(screen.getByText('A customer')).toBeDefined();
  });
});
