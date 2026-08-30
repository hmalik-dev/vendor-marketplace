import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BookingCard } from './booking-card';
import type { WireBooking, WireBookingRequest } from '@/lib/wire-schemas';

vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

/** Before the fixture's event date, so `Mark complete` is not yet offered. */
const TODAY = '2027-01-01';

/** The paid booking behind the fixture request. */
function paid(overrides: Partial<WireBooking> = {}): WireBooking {
  return {
    id: 'bkg-1',
    requestId: 'req-1',
    customerId: 'cus-1',
    vendorId: 'ven-1',
    eventDate: '2027-02-13',
    eventLocation: 'Zilker Park Clubhouse',
    totalAmountCents: 120_000,
    platformFeeCents: 14_400,
    vendorPayoutCents: 105_600,
    status: 'confirmed',
    stripePaymentIntentId: 'pi_test_1',
    stripeTransferId: null,
    paidAt: new Date(),
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    eventType: 'wedding',
    venue: 'Zilker Park Clubhouse',
    ...overrides,
  } as WireBooking;
}

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
    render(<BookingCard request={accepted()} booking={paid()} today={TODAY} />);

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
    render(<BookingCard request={accepted()} booking={paid()} today={TODAY} />);

    expect(screen.getByText('Booked')).toBeDefined();
  });

  it('writes the event facts in full, with the price', () => {
    render(<BookingCard request={accepted()} booking={paid()} today={TODAY} />);

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
      <BookingCard
        request={accepted({ customer: { ...accepted().customer, phone: null } })}
        booking={paid()}
        today={TODAY}
      />,
    );

    expect(screen.getByRole('link', { name: 'priya@example.com' })).toBeDefined();
    expect(screen.queryByText('Phone')).toBeNull();
  });

  /*
   * #10. Accepted is not paid, and `40-states.md` reserves sage for settled —
   * a vendor whose customer has not paid yet must not read "Booked" in the
   * colour that means the money is in.
   */
  it('separates an accepted request from a paid booking', () => {
    const { rerender } = render(<BookingCard request={accepted()} booking={null} today={TODAY} />);

    expect(screen.getByText('Awaiting payment')).toBeDefined();
    expect(screen.queryByText('Booked')).toBeNull();

    rerender(<BookingCard request={accepted()} booking={paid()} today={TODAY} />);

    expect(screen.getByText('Booked')).toBeDefined();
    expect(screen.queryByText('Awaiting payment')).toBeNull();
  });

  /*
   * The control appears only once the event can have happened. The API refuses
   * an early completion with a 409 either way; this is why the vendor is never
   * offered a button that only answers one.
   */
  it('offers Mark complete only after the event date', () => {
    const { rerender } = render(
      <BookingCard request={accepted()} booking={paid()} today={TODAY} />,
    );

    expect(screen.queryByRole('button', { name: 'Mark complete' })).toBeNull();

    rerender(<BookingCard request={accepted()} booking={paid()} today="2027-02-13" />);

    expect(screen.getByRole('button', { name: 'Mark complete' })).toBeDefined();
  });

  it('shows the completed state rather than the control once it is done', () => {
    render(
      <BookingCard
        request={accepted()}
        booking={paid({ status: 'completed' })}
        today="2027-03-01"
      />,
    );

    expect(screen.getByText('Complete')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mark complete' })).toBeNull();
  });

  it('falls back to a description rather than a blank when the account has no name', () => {
    render(
      <BookingCard
        request={accepted({
          customer: { firstName: '', lastInitial: '', lastName: null, email: null, phone: null },
        })}
        booking={paid()}
        today={TODAY}
      />,
    );

    expect(screen.getByText('A customer')).toBeDefined();
  });
});
