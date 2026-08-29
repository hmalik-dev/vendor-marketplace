import type { ServicePackage } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { BookingRail } from './booking-rail';

function servicePackage(overrides: Partial<ServicePackage> = {}): ServicePackage {
  return {
    id: 'pkg-1',
    vendorId: 'v-1',
    name: 'Half day',
    description: 'Four hours of coverage.',
    priceCents: 175_000,
    priceType: 'fixed',
    durationHours: 4,
    maxGuests: null,
    inclusions: [],
    isActive: true,
    displayOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('BookingRail', () => {
  afterEach(() => {
    cleanup();
  });

  it('leads with the from-price in dollars', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={175_000}
        packages={[servicePackage()]}
        reviewCount={127}
        today="2026-01-01"
        calendar={{}}
      />,
    );

    expect(screen.getByText('$1,750')).toBeDefined();
  });

  /*
   * `40-states.md`: a blocked primary action stays visible and its helper line
   * explains the block. Hiding it would leave the page with no visible ask,
   * which is the one thing this screen exists for.
   */
  it('sends the selected package through to the request form, and still blocks messaging', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={175_000}
        packages={[servicePackage()]}
        reviewCount={0}
        today="2026-01-01"
        calendar={{}}
      />,
    );

    const request = screen.getByRole('link', { name: 'Request booking' });
    const message = screen.getByRole('button', { name: 'Send a message' });

    expect(request.getAttribute('href')).toBe('/vendors/kessler-and-co/request?package=pkg-1');
    expect(message).toHaveProperty('disabled', true);
    expect(screen.getByText(/Messaging opens shortly/)).toBeDefined();
  });

  it('omits the package when the vendor has none to choose from', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={null}
        packages={[]}
        reviewCount={0}
        today="2026-01-01"
        calendar={{}}
      />,
    );

    expect(screen.getByRole('link', { name: 'Request booking' }).getAttribute('href')).toBe(
      '/vendors/kessler-and-co/request',
    );
  });

  it('names the vendor in the charge reassurance', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={175_000}
        packages={[servicePackage()]}
        reviewCount={0}
        today="2026-01-01"
        calendar={{}}
      />,
    );

    expect(screen.getByText(/Kessler & Co\. confirms the date first/)).toBeDefined();
  });

  /* A vendor with nothing priced gets a route to a conversation, not a blank. */
  it('says pricing is a conversation when no package is priced', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={null}
        packages={[]}
        reviewCount={0}
        today="2026-01-01"
        calendar={{}}
      />,
    );

    expect(screen.getByText('Contact for pricing')).toBeDefined();
    expect(screen.queryByLabelText('Package')).toBeNull();
  });

  it('re-prices the rail when a different package is chosen', async () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={175_000}
        packages={[
          servicePackage(),
          servicePackage({ id: 'pkg-2', name: 'Full day', priceCents: 320_000 }),
        ]}
        reviewCount={0}
        today="2026-01-01"
        calendar={{}}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Package'), 'pkg-2');

    expect(screen.getByText('$3,200')).toBeDefined();
  });

  it('does not claim reviews a vendor has not earned', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={175_000}
        packages={[servicePackage()]}
        reviewCount={0}
        today="2026-01-01"
        calendar={{}}
      />,
    );

    expect(screen.getByText('Every review comes from a completed booking')).toBeDefined();
    expect(screen.queryByText(/0 reviews/)).toBeNull();
  });

  describe('the free-on line (#112)', () => {
    /*
     * A vendor publishes only the days they are NOT free, so a date absent from
     * the calendar is available — the same rule the request form applies.
     */
    function renderRail(calendar: Record<string, 'blocked' | 'booked' | 'available' | 'pending'>) {
      return render(
        <BookingRail
          businessName="Kessler & Co."
          slug="kessler-and-co"
          startingPriceCents={145_000}
          packages={[servicePackage()]}
          reviewCount={127}
          today="2026-08-29"
          calendar={calendar}
        />,
      );
    }

    it('names a future date the vendor has not blocked', async () => {
      renderRail({});
      await userEvent.type(screen.getByLabelText('Event date'), '2026-12-05');

      expect(screen.getByText('Free on December 5')).toBeDefined();
    });

    it('says nothing about a date the vendor has blocked', async () => {
      renderRail({ '2026-12-05': 'blocked' });
      await userEvent.type(screen.getByLabelText('Event date'), '2026-12-05');

      expect(screen.queryByText(/^Free on/)).toBeNull();
    });

    it('says nothing about a date already past', async () => {
      renderRail({});
      await userEvent.type(screen.getByLabelText('Event date'), '2026-06-14');

      expect(screen.queryByText(/^Free on/)).toBeNull();
    });

    it('says nothing until a date is chosen', () => {
      renderRail({});

      expect(screen.queryByText(/^Free on/)).toBeNull();
    });
  });
});
