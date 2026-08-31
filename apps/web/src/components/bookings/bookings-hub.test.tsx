import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingsHub } from './bookings-hub';
import type { BookingEntry } from '@/lib/booking-entries';
import { FALLBACK_TONES } from '@/components/ui/avatar';

/*
 * The Refine chips push URL state, so the hub now reaches `useRouter`. The push
 * itself is captured rather than stubbed away: which URL a chip navigates to is
 * the contract, and #187 is a ticket about controls that looked wired and were
 * not.
 */
const pushed = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => pushed.calls.push(href) }),
}));

afterEach(() => {
  cleanup();
  pushed.calls.length = 0;
});

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
      <BookingsHub
        entries={[entry()]}
        tab="upcoming"
        today={TODAY}
        city="Austin"
        needsYou={[]}
        category={null}
        sort="soonest"
      />,
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
        category={null}
        sort="soonest"
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
      <BookingsHub
        entries={[entry()]}
        tab="upcoming"
        today={TODAY}
        city={null}
        needsYou={[]}
        category={null}
        sort="soonest"
      />,
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
        category={null}
        sort="soonest"
      />,
    );

    expect(screen.getByText('Search Sep 5 in Austin')).toBeDefined();
    expect(screen.getByRole('link', { name: /Book another vendor/ }).getAttribute('href')).toBe(
      '/search?date=2026-09-05&city=Austin',
    );
  });

  it('omits the city from the invitation when the customer has not set one', () => {
    render(
      <BookingsHub
        entries={[entry()]}
        tab="upcoming"
        today={TODAY}
        city={null}
        needsYou={[]}
        category={null}
        sort="soonest"
      />,
    );

    expect(screen.getByText('Search Jun 14')).toBeDefined();
  });

  /* Frame `19`. Never a blank pane, and never a dead end. */
  it('explains what will land here when there is nothing yet', () => {
    render(
      <BookingsHub
        entries={[]}
        tab="upcoming"
        today={TODAY}
        city={null}
        needsYou={[]}
        category={null}
        sort="soonest"
      />,
    );

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
    render(
      <BookingsHub
        entries={[]}
        tab="upcoming"
        today={TODAY}
        city={null}
        needsYou={[]}
        category={null}
        sort="soonest"
      />,
    );

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
        category={null}
        sort="soonest"
      />,
    );

    expect(screen.getByRole('link', { name: 'Upcoming 1' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'History 1' })).toBeDefined();
    expect(screen.getByText('All categories')).toBeDefined();
    expect(screen.getByText('Soonest first')).toBeDefined();
  });

  /* The word belongs to the vendor's screen, not the customer's. */
  it('never calls itself a dashboard', () => {
    const { container } = render(
      <BookingsHub
        entries={[entry()]}
        tab="upcoming"
        today={TODAY}
        city={null}
        needsYou={[]}
        category={null}
        sort="soonest"
      />,
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
          category={null}
          sort="soonest"
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

/*
 * #302/#187. The two Refine chips were `<span>`s: the right pixels, nothing
 * behind them. Every assertion here is about an **observable effect** — which
 * rows render, in which order — rather than about a handler being attached,
 * because "a control exists" is exactly what was true before and is what made
 * the defect invisible.
 */
describe('BookingsHub refine chips', () => {
  const mixed = [
    entry({ id: 'photo', categoryName: 'Photography', eventDate: '2026-06-14' }),
    entry({ id: 'cater', categoryName: 'Catering', eventDate: '2026-05-02' }),
    entry({ id: 'florals', categoryName: 'Florals', eventDate: '2026-07-30' }),
  ];

  function renderHub(category: string | null, sort: 'soonest' | 'latest') {
    render(
      <BookingsHub
        entries={mixed}
        tab="upcoming"
        today={TODAY}
        city={null}
        needsYou={[]}
        category={category}
        sort={sort}
      />,
    );
  }

  it('draws both chips as real controls, not decoration', () => {
    renderHub(null, 'soonest');

    expect(screen.getByRole('button', { name: /All categories/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Soonest first/ })).toBeDefined();
  });

  it('renders every category when none is chosen', () => {
    renderHub(null, 'soonest');

    expect(screen.getByText(/Photography/)).toBeDefined();
    expect(screen.getByText(/Catering/)).toBeDefined();
    expect(screen.getByText(/Florals/)).toBeDefined();
  });

  it('renders only the chosen category, and names it on the chip', () => {
    renderHub('Catering', 'soonest');

    // The chip carries the name too, so the card is read out of the list pane.
    const list = screen.getByRole('navigation', { name: 'Booking status' }).parentElement
      ?.nextElementSibling as HTMLElement;
    expect(within(list).getByText(/Catering/)).toBeDefined();
    expect(within(list).queryByText(/Photography/)).toBeNull();
    expect(within(list).queryByText(/Florals/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Catering' })).toBeDefined();
  });

  /*
   * The months, not just the cards. Asserted through the rendered headings
   * because that is the thing a customer sees turn round.
   */
  it('reverses the month headings under Latest first', () => {
    renderHub(null, 'latest');

    const headings = screen.getAllByText(/^(MAY|JUNE|JULY) 2026$/).map((node) => node.textContent);
    expect(headings).toEqual(['JULY 2026', 'JUNE 2026', 'MAY 2026']);
  });

  it('keeps them ascending under Soonest first', () => {
    renderHub(null, 'soonest');

    const headings = screen.getAllByText(/^(MAY|JUNE|JULY) 2026$/).map((node) => node.textContent);
    expect(headings).toEqual(['MAY 2026', 'JUNE 2026', 'JULY 2026']);
  });

  /*
   * One category is not a filter. The chip is absent rather than present and
   * offering a single option, which is the dead-control shape again.
   */
  it('drops the category chip when no booking carries a category at all', () => {
    render(
      <BookingsHub
        entries={[entry({ categoryName: null })]}
        tab="upcoming"
        today={TODAY}
        city={null}
        needsYou={[]}
        category={null}
        sort="soonest"
      />,
    );

    expect(screen.queryByRole('button', { name: /All categories/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Soonest first/ })).toBeDefined();
  });

  /*
   * The regression `diff-reviewer` found in the first cut of this fix. The
   * options were built from *every* entry while the filter was applied to the
   * *tab's* entries, so a category living only in another tab was offered,
   * chosen, silently dropped — and the chip still named it. That is #187's own
   * defect wearing a dropdown: a control that looks wired and does nothing.
   */
  it('does not claim a category that lives only in another tab', () => {
    const acrossTabs = [
      entry({ id: 'up', categoryName: 'Photography', eventDate: '2026-06-14' }),
      entry({ id: 'done', categoryName: 'Catering', eventDate: '2026-01-05', isSettled: true }),
    ];

    render(
      <BookingsHub
        entries={acrossTabs}
        tab="upcoming"
        today={TODAY}
        city={null}
        needsYou={[]}
        category="Catering"
        sort="soonest"
      />,
    );

    /*
     * Catering is settled, so it is not under Upcoming. The filter cannot apply,
     * and the chip must say `All categories` rather than `Catering` — the whole
     * point being that the label and the list agree.
     */
    expect(screen.getByRole('button', { name: 'All categories' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Catering' })).toBeNull();
    expect(screen.getByText(/Photography/)).toBeDefined();
  });

  /*
   * And when such a category arrives anyway — a stale link, a hand-typed URL —
   * the chip must not claim it. The list is unfiltered, so the label has to say
   * so, or the two disagree with the customer watching.
   */
  it('does not name a category it is not filtering by', () => {
    render(
      <BookingsHub
        entries={mixed}
        tab="upcoming"
        today={TODAY}
        city={null}
        needsYou={[]}
        category="Taxidermy"
        sort="soonest"
      />,
    );

    expect(screen.getByRole('button', { name: 'All categories' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Taxidermy/ })).toBeNull();
  });

  /*
   * The tab counts are taken from the unrefined list on purpose: a count that
   * moved with the filter would be reporting the filter, not the tab.
   */
  it('leaves the tab counts alone when a category narrows the list', () => {
    renderHub('Catering', 'soonest');

    const tabs = screen.getByRole('navigation', { name: 'Booking status' });
    expect(within(tabs).getByText('3')).toBeDefined();
  });
});

/**
 * Browser verification of #305 found this pane hand-rolling its own copy of the
 * empty-state glyph, with the outer ring solid where the shared component draws
 * it dashed — two glyphs for one idea — and a `p` styled as a headline, which
 * leaves the state with no heading in the accessibility tree.
 */
describe('the empty bookings pane', () => {
  it('uses the shared glyph, dashed ring and all', () => {
    const { container } = render(
      <BookingsHub
        entries={[]}
        tab="upcoming"
        today={TODAY}
        city="Austin"
        needsYou={[]}
        category={null}
        sort="soonest"
      />,
    );

    const glyph = container.querySelector('.w-\\[58px\\]');

    expect(glyph).not.toBeNull();
    expect(glyph?.querySelectorAll('span')[1]?.className).toContain('border-dashed');
  });

  it('gives the state a real heading', () => {
    render(
      <BookingsHub
        entries={[]}
        tab="upcoming"
        today={TODAY}
        city="Austin"
        needsYou={[]}
        category={null}
        sort="soonest"
      />,
    );

    expect(screen.getByRole('heading', { name: 'No bookings yet' })).toBeDefined();
  });
});

/**
 * #81's second finding: every card drew an empty `bg-stone-150` swatch where
 * the vendor belonged, on all eleven of them, while `/search` and `/messages`
 * already drew initials for the same vendors. `40-states.md` is explicit —
 * "a generic grey box is a bug".
 */
describe('the vendor tile on a booking card', () => {
  function tileFor(container: HTMLElement): HTMLElement | null {
    return container.querySelector('.size-9\\.5');
  }

  it('shows the vendor’s photograph when there is one', () => {
    render(
      <BookingsHub
        entries={[entry({ vendorImageUrl: 'https://cdn.test/kessler.jpg' })]}
        tab="upcoming"
        today={TODAY}
        city="Austin"
        needsYou={[]}
        category={null}
        sort="soonest"
      />,
    );

    const image = screen.getByRole('presentation', { hidden: true });
    expect(image.getAttribute('src')).toBe('https://cdn.test/kessler.jpg');
  });

  it('falls back to the vendor’s initials, never an empty node', () => {
    const { container } = render(
      <BookingsHub
        entries={[entry({ vendorImageUrl: null, vendorName: 'Kessler & Co.' })]}
        tab="upcoming"
        today={TODAY}
        city="Austin"
        needsYou={[]}
        category={null}
        sort="soonest"
      />,
    );

    const tile = tileFor(container);

    expect(tile).not.toBeNull();
    expect(tile?.textContent?.trim()).toBe('KC');
  });

  it('gives the monogram a tone rather than the grey swatch', () => {
    const { container } = render(
      <BookingsHub
        entries={[entry({ vendorImageUrl: null })]}
        tab="upcoming"
        today={TODAY}
        city="Austin"
        needsYou={[]}
        category={null}
        sort="soonest"
      />,
    );

    const tile = tileFor(container);

    expect(tile?.className).not.toContain('bg-stone-150');
    /*
     * Asserted against `FALLBACK_TONES` rather than a literal ramp step. This
     * read `/bg-(clay|sage)-100/` until D18 moved the clay monogram to
     * `clay-150`, and broke on a change that was correct — the tile's contract
     * is that it draws one of the shared tones, not which step that tone is.
     */
    expect(FALLBACK_TONES.some((tone) => tile?.className.includes(tone))).toBe(true);
  });

  it('keeps one vendor on one tone across renders', () => {
    const first = render(
      <BookingsHub
        entries={[entry({ vendorImageUrl: null })]}
        tab="upcoming"
        today={TODAY}
        city="Austin"
        needsYou={[]}
        category={null}
        sort="soonest"
      />,
    );
    const firstTone = tileFor(first.container)?.className;
    cleanup();

    const second = render(
      <BookingsHub
        entries={[entry({ vendorImageUrl: null, id: 'e2' })]}
        tab="upcoming"
        today={TODAY}
        city="Austin"
        needsYou={[]}
        category={null}
        sort="soonest"
      />,
    );

    expect(tileFor(second.container)?.className).toBe(firstTone);
  });
});
