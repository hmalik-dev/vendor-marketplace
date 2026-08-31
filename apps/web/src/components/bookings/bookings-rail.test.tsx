import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BookingsRail } from './bookings-rail';
import type { BookingEntry } from '@/lib/booking-entries';
import type { WireConversation } from '@/lib/wire-schemas';

afterEach(cleanup);

function entry(overrides: Partial<BookingEntry> = {}): BookingEntry {
  return {
    id: 'e1',
    kind: 'request',
    vendorSlug: 'casa-verde',
    vendorName: 'Casa Verde',
    vendorImageUrl: null,
    categoryName: 'Catering',
    occasion: 'Wedding',
    eventDate: '2026-06-14',
    venue: 'Barr Mansion',
    status: 'quoted',
    statusLabel: 'Quoted',
    statusTone: 'quoted',
    subline: '$3,840 quoted · expires in 3d',
    isSettled: false,
    ...overrides,
  };
}

function conversation(overrides: Partial<WireConversation> = {}): WireConversation {
  return {
    id: 'c1',
    otherPartyName: 'Maya Kessler',
    otherPartyAvatarUrl: null,
    lastMessagePreview: 'Golden hour is about 7:40 that week —',
    /*
     * A fixed offset from now, not a fixed instant: the rail calls
     * `shortTimeAgo` without a `now`, so the only stable thing to assert is the
     * delta. Two hours floors to `2h` however long the suite takes, because the
     * gap can only widen between constructing this and reading it.
     */
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    unreadCount: 0,
    ...overrides,
  } as WireConversation;
}

/*
 * #302/#189. Frames `07` and `19` draw **different rails**, and this component
 * used to draw both at once: the `How booking works here` block sat outside
 * every conditional, so a customer with eleven bookings was still being told how
 * booking works, beneath a `Needs you` list of their live quotes.
 *
 * The empty state is keyed on whether the customer has any bookings at all —
 * not on what the current tab or category filter happens to show, which is a
 * different question with the same shape.
 */
describe('BookingsRail', () => {
  describe('when the customer has bookings', () => {
    it('draws Recent messages and not the empty-state promises', () => {
      render(<BookingsRail needsYou={[]} hasBookings conversations={[conversation()]} />);

      expect(screen.getByText('Recent messages')).toBeDefined();
      expect(screen.queryByText('How booking works here')).toBeNull();
      expect(screen.queryByText('Real availability.')).toBeNull();
    });

    it('names each thread, its age and its preview, and links into it', () => {
      render(<BookingsRail needsYou={[]} hasBookings conversations={[conversation()]} />);

      expect(screen.getByText('Maya Kessler')).toBeDefined();
      expect(screen.getByText('2h')).toBeDefined();
      expect(screen.getByText('Golden hour is about 7:40 that week —')).toBeDefined();
      expect(screen.getByRole('link').getAttribute('href')).toBe('/messages?conversation=c1');
    });

    /* Frame `07` draws three. A fourth would push the rail into its own scroll. */
    it('draws at most three threads', () => {
      render(
        <BookingsRail
          needsYou={[]}
          hasBookings
          conversations={[
            conversation({ id: 'c1', otherPartyName: 'One' }),
            conversation({ id: 'c2', otherPartyName: 'Two' }),
            conversation({ id: 'c3', otherPartyName: 'Three' }),
            conversation({ id: 'c4', otherPartyName: 'Four' }),
          ]}
        />,
      );

      expect(screen.getAllByRole('link')).toHaveLength(3);
      expect(screen.queryByText('Four')).toBeNull();
    });

    /*
     * `40-states.md`: the rail is never blanked. Bookings but no replies yet is a
     * real state — it is every customer's first day — and a heading over nothing
     * reads as a column that failed to load.
     */
    it('says so rather than stopping halfway when there are no threads', () => {
      render(<BookingsRail needsYou={[]} hasBookings conversations={[]} />);

      expect(screen.getByText('Recent messages')).toBeDefined();
      // The approved line, shared with `/messages`'s own empty state — asserted
      // by its exact wording so a second spelling of it cannot creep back in.
      expect(
        screen.getByText(
          'A thread opens the moment you send a booking request, so the whole negotiation stays attached to the booking.',
        ),
      ).toBeDefined();
    });

    it('still leads with Needs you when a quote is waiting', () => {
      render(<BookingsRail needsYou={[entry()]} hasBookings conversations={[conversation()]} />);

      expect(screen.getByText('Needs you')).toBeDefined();
      expect(screen.getByText('Casa Verde sent a quote')).toBeDefined();
      expect(screen.getByText('Recent messages')).toBeDefined();
    });
  });

  describe('when the customer has no bookings', () => {
    it("draws frame 19's promises and not Recent messages", () => {
      render(<BookingsRail needsYou={[]} hasBookings={false} conversations={[]} />);

      expect(screen.getByText('How booking works here')).toBeDefined();
      expect(screen.getByText('Real availability.')).toBeDefined();
      expect(screen.queryByText('Recent messages')).toBeNull();
    });

    /*
     * The threads are ignored rather than drawn. A customer with no bookings can
     * still hold a conversation — they messaged a vendor before requesting — and
     * frame `19` draws the promises regardless.
     */
    it('ignores any threads it is given', () => {
      render(<BookingsRail needsYou={[]} hasBookings={false} conversations={[conversation()]} />);

      expect(screen.queryByText('Maya Kessler')).toBeNull();
      expect(screen.getByText('How booking works here')).toBeDefined();
    });
  });

  /**
   * #81's ninth finding. The rail carried a fixed `aria-label` of "What needs
   * your attention" whatever it drew, so a screen-reader user was told to
   * expect work and met the mechanism copy instead. #302 then gave the rail a
   * third shape, which is why this is three cases and not two.
   */
  describe('the label follows the content', () => {
    it('names the attention section when quotes are waiting', () => {
      render(<BookingsRail needsYou={[entry()]} hasBookings conversations={[conversation()]} />);

      expect(screen.getByRole('complementary').getAttribute('aria-label')).toBe(
        'What needs your attention',
      );
    });

    it('names the threads when that is what it draws', () => {
      render(<BookingsRail needsYou={[]} hasBookings conversations={[conversation()]} />);

      expect(screen.getByRole('complementary').getAttribute('aria-label')).toBe('Recent messages');
    });

    it('names the promises for a customer with nothing booked', () => {
      render(<BookingsRail needsYou={[]} hasBookings={false} conversations={[]} />);

      expect(screen.getByRole('complementary').getAttribute('aria-label')).toBe(
        'How booking works here',
      );
    });

    /* The defect as a property: never promise a section the reader will not find. */
    it('never promises attention the rail is not showing', () => {
      for (const hasBookings of [true, false]) {
        cleanup();
        render(<BookingsRail needsYou={[]} hasBookings={hasBookings} conversations={[]} />);

        expect(screen.getByRole('complementary').getAttribute('aria-label')).not.toMatch(
          /attention/i,
        );
      }
    });
  });
});
