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

  /*
   * The column holds the slug (`wedding`), and every other read site routes it
   * through `EVENT_TYPE_LABELS`. This one printed the slug verbatim, so the
   * line under the heading read `wedding · Barr Mansion · Austin, TX` in the
   * middle of the receipt (#394).
   */
  it('writes the occasion the way a person reads it, not as the stored slug', () => {
    render(
      <BookingConfirmed
        booking={booking({ eventType: 'wedding' })}
        vendor={VENDOR}
        conversationId="conv-1"
      />,
    );

    expect(screen.getByText('Wedding · Barr Mansion · Austin, TX')).toBeDefined();
  });

  it('never reads a label off the prototype chain', () => {
    render(
      <BookingConfirmed
        booking={booking({ eventType: 'constructor' })}
        vendor={VENDOR}
        conversationId="conv-1"
      />,
    );

    expect(screen.getByText('constructor · Barr Mansion · Austin, TX')).toBeDefined();
  });

  it('falls back to the stored value for an occasion the vocabulary does not know', () => {
    render(
      <BookingConfirmed
        booking={booking({ eventType: 'Vow renewal' })}
        vendor={VENDOR}
        conversationId="conv-1"
      />,
    );

    expect(screen.getByText('Vow renewal · Barr Mansion · Austin, TX')).toBeDefined();
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

  /*
   * #386. The label was `text-sage-700`, a step the theme does not define, so
   * Tailwind resolved it to its own built-in green and the button read in a
   * colour from outside the palette. `sage-600` is the darkest step the ramp
   * has and the one `01-foundations.md` records as the deviation from the
   * frame's `#3A4D33`. Pinned here because the ratchet in `design-tokens.test`
   * only proves the step exists — it passes on any defined step, including a
   * wrong one.
   */
  it('paints the primary action in the darkest sage the ramp defines', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    const message = screen.getByRole('link', { name: 'Message Kessler & Co.' });

    expect(message.className).toContain('text-sage-600');
    expect(message.className).not.toContain('text-sage-700');
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

  /*
   * #383. This hero is the one dark surface in the product, and the only place
   * that keeps an outline rather than taking the base `:focus-visible` ring:
   * clay at `/40` over a `stone-50` band is designed for the cream ground and
   * is both low-contrast and a bright halo on deep sage. What it must not do is
   * paint *both*, which is what it did — the outline plus the base rule's ring,
   * on all three controls.
   *
   * Asserted as a class-level fact. The page needs a confirmed, paid booking to
   * reach in a browser, so this is the check that runs on every commit; the
   * mechanism itself is driven for real on nine routes in
   * `e2e/focus-indicator.spec.ts`.
   */
  it('opts its three controls out of the base ring, keeping one outline each', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    const controls = [
      screen.getByRole('link', { name: /^Message / }),
      screen.getByRole('link', { name: 'View booking' }),
      screen.getByRole('link', { name: 'Florals' }),
    ];

    for (const control of controls) {
      expect(control.getAttribute('data-focus-own'), control.textContent).not.toBeNull();
      expect(control.className).toContain('focus-visible:outline-2');
      // Without the style the width utility paints nothing at all.
      expect(control.className).toContain('focus-visible:outline-solid');
      expect(control.className).not.toContain('focus-visible:ring-');
    }
  });
});
