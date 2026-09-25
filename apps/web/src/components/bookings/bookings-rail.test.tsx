import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingsRail } from './bookings-rail';
import { needsYouItems, type BookingEntry } from '@/lib/booking-entries';
import type { WireConversation } from '@/lib/wire-schemas';

// A quote's `Decline` is a client control; its behaviour is `needs-you-decline.test.tsx`'s.
vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

const TODAY = '2026-04-26';

function entry(overrides: Partial<BookingEntry> = {}): BookingEntry {
  return {
    id: 'e1',
    kind: 'request',
    requestId: 'e1',
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
    reviewDeadline: null,
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
      expect(screen.getByText('A thread opens when you send a booking request.')).toBeDefined();
    });

    it('still leads with Needs you when a quote is waiting', () => {
      render(
        <BookingsRail
          needsYou={needsYouItems([entry()], TODAY)}
          hasBookings
          conversations={[conversation()]}
        />,
      );

      expect(screen.getByText('Needs you')).toBeDefined();
      expect(screen.getByText('Casa Verde sent a quote')).toBeDefined();
      expect(screen.getByText('Recent messages')).toBeDefined();
    });
  });

  /*
   * VEN-746. Frame `07` opens the rail with `Needs you` for every customer with
   * bookings. It was drawn only while a quote waited, so most of the time the
   * rail started at `Recent messages` and the panel read as missing, and an
   * accepted request waiting on payment surfaced nowhere.
   */
  describe('the Needs you panel', () => {
    it('is drawn with nothing waiting, and says so above Recent messages', () => {
      render(<BookingsRail needsYou={[]} hasBookings conversations={[conversation()]} />);

      const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
      expect(headings).toEqual(['Needs you', 'Recent messages']);
      expect(screen.getByText('Nothing is waiting on you.')).toBeDefined();
    });

    it('draws a quote with its subline, Review quote and Decline', () => {
      render(
        <BookingsRail needsYou={needsYouItems([entry()], TODAY)} hasBookings conversations={[]} />,
      );

      const panel = screen.getByText('Casa Verde sent a quote').closest('li') as HTMLElement;
      expect(panel.className.split(' ')).toContain('bg-clay-100');
      // Frame `07` draws the panel at 12px (`rounded-panel`), not the 14px card radius.
      expect(panel.className.split(' ')).toContain('rounded-panel');
      expect(within(panel).getByText('$3,840 quoted · expires in 3d')).toBeDefined();
      expect(within(panel).getByRole('link', { name: 'Review quote' }).getAttribute('href')).toBe(
        '/bookings/e1',
      );
      expect(within(panel).getByRole('button', { name: 'Decline' })).toBeDefined();
      expect(screen.queryByText('Nothing is waiting on you.')).toBeNull();
    });

    it('draws an accepted request with Pay now into checkout and no Decline', () => {
      render(
        <BookingsRail
          needsYou={needsYouItems(
            [
              entry({
                id: 'r9',
                requestId: 'r9',
                status: 'accepted',
                subline: '$1,450 · Barr Mansion',
              }),
            ],
            TODAY,
          )}
          hasBookings
          conversations={[]}
        />,
      );

      const panel = screen
        .getByText('Casa Verde accepted your request')
        .closest('li') as HTMLElement;
      expect(panel.className.split(' ')).toContain('bg-clay-100');
      expect(within(panel).getByText('$1,450 · Barr Mansion')).toBeDefined();
      expect(within(panel).getByRole('link', { name: 'Pay now' }).getAttribute('href')).toBe(
        '/bookings/r9/checkout',
      );
      expect(within(panel).queryByRole('button', { name: 'Decline' })).toBeNull();
    });

    it('draws two quotes and an accepted request as three panels, quotes first', () => {
      render(
        <BookingsRail
          needsYou={needsYouItems(
            [
              entry({ id: 'a1', requestId: 'a1', vendorName: 'Bloom & Co.', status: 'accepted' }),
              entry({ id: 'q1', requestId: 'q1', vendorName: 'Casa Verde' }),
              entry({ id: 'q2', requestId: 'q2', vendorName: 'Kessler & Co.' }),
            ],
            TODAY,
          )}
          hasBookings
          conversations={[]}
        />,
      );

      const list = screen.getByRole('list', { name: 'Needs you' });
      expect(
        within(list)
          .getAllByRole('listitem')
          .map((item) => item.querySelector('p')?.textContent),
      ).toEqual([
        'Casa Verde sent a quote',
        'Kessler & Co. sent a quote',
        'Bloom & Co. accepted your request',
      ]);
    });

    /*
     * VEN-747. Frame `07`'s second panel: gold, not clay, with the event's age,
     * the close date and a link to the vendor's Reviews tab, after the quotes.
     */
    it('draws a review on gold after the quote, with its age, close date and link', () => {
      const review = entry({
        id: 'b7',
        kind: 'booking',
        requestId: 'r7',
        vendorSlug: 'bloom-co',
        vendorName: 'Bloom & Co.',
        occasion: 'Wedding',
        eventDate: '2026-04-20',
        status: 'completed',
        reviewDeadline: '2026-05-04',
      });

      render(
        <BookingsRail
          needsYou={needsYouItems([review, entry()], TODAY)}
          hasBookings
          conversations={[conversation()]}
        />,
      );

      const items = within(screen.getByRole('list', { name: 'Needs you' })).getAllByRole(
        'listitem',
      );
      expect(items.map((item) => item.querySelector('p')?.textContent)).toEqual([
        'Casa Verde sent a quote',
        'Leave a review for Bloom & Co.',
      ]);

      const panel = items[1]!;
      expect(panel.className.split(' ')).toContain('bg-gold-50');
      expect(panel.className.split(' ')).not.toContain('bg-clay-100');
      expect(panel.querySelector('[aria-hidden="true"]')?.className.split(' ')).toContain(
        'bg-gold-400',
      );
      expect(within(panel).getByText('Your wedding was 6 days ago.')).toBeDefined();
      expect(within(panel).getByText('Reviews close May 4.')).toBeDefined();
      expect(within(panel).getByRole('link', { name: 'Write a review' }).getAttribute('href')).toBe(
        '/vendors/bloom-co?tab=reviews',
      );
      expect(within(panel).queryByRole('button', { name: 'Decline' })).toBeNull();

      // The rail's other blocks are unchanged.
      expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
        'Needs you',
        'Recent messages',
      ]);
      expect(screen.getByText('Maya Kessler')).toBeDefined();
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
    /*
     * VEN-746: with bookings the rail always opens on `Needs you`, whether or
     * not anything is waiting, so that is the heading it is named for.
     */
    it('names the Needs you panel it leads with, whether or not anything waits', () => {
      for (const needsYou of [needsYouItems([entry()], TODAY), []]) {
        cleanup();
        render(<BookingsRail needsYou={needsYou} hasBookings conversations={[conversation()]} />);

        expect(screen.getByRole('complementary').getAttribute('aria-label')).toBe('Needs you');
      }
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
