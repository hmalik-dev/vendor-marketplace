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
        startingPriceCents={175_000}
        packages={[servicePackage()]}
        reviewCount={127}
      />,
    );

    expect(screen.getByText('$1,750')).toBeDefined();
  });

  /*
   * `40-states.md`: a blocked primary action stays visible and its helper line
   * explains the block. Hiding these would leave the page with no visible ask,
   * which is the one thing this screen exists for.
   */
  it('keeps both actions visible but disabled until #7 and #8 exist', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        startingPriceCents={175_000}
        packages={[servicePackage()]}
        reviewCount={0}
      />,
    );

    const request = screen.getByRole('button', { name: 'Request booking' });
    const message = screen.getByRole('button', { name: 'Send a message' });

    expect(request).toHaveProperty('disabled', true);
    expect(message).toHaveProperty('disabled', true);
    expect(screen.getByText(/Requests and messages open shortly/)).toBeDefined();
  });

  it('names the vendor in the charge reassurance', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        startingPriceCents={175_000}
        packages={[servicePackage()]}
        reviewCount={0}
      />,
    );

    expect(screen.getByText(/Kessler & Co\. confirms the date first/)).toBeDefined();
  });

  /* A vendor with nothing priced gets a route to a conversation, not a blank. */
  it('says pricing is a conversation when no package is priced', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        startingPriceCents={null}
        packages={[]}
        reviewCount={0}
      />,
    );

    expect(screen.getByText('Contact for pricing')).toBeDefined();
    expect(screen.queryByLabelText('Package')).toBeNull();
  });

  it('re-prices the rail when a different package is chosen', async () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        startingPriceCents={175_000}
        packages={[
          servicePackage(),
          servicePackage({ id: 'pkg-2', name: 'Full day', priceCents: 320_000 }),
        ]}
        reviewCount={0}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Package'), 'pkg-2');

    expect(screen.getByText('$3,200')).toBeDefined();
  });

  it('does not claim reviews a vendor has not earned', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        startingPriceCents={175_000}
        packages={[servicePackage()]}
        reviewCount={0}
      />,
    );

    expect(screen.getByText('Every review comes from a completed booking')).toBeDefined();
    expect(screen.queryByText(/0 reviews/)).toBeNull();
  });
});
