import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setUnreadMessages } from '@/lib/unread-messages-store';
import { BookingsSidebar } from './bookings-sidebar';

afterEach(() => {
  act(() => setUnreadMessages(false));
  cleanup();
});

function nav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Your account' });
}

describe('BookingsSidebar', () => {
  it('has exactly two rows, My bookings and Messages, each at its route', () => {
    render(<BookingsSidebar bookingCount={3} current="bookings" />);

    const rows = within(nav()).getAllByRole('link').slice(0, 2);

    expect(rows.map((row) => [row.textContent, row.getAttribute('href')])).toEqual([
      ['My bookings3', '/bookings'],
      ['Messages', '/messages'],
    ]);
    expect(within(nav()).queryByText('My profile')).toBeNull();
    expect(within(nav()).queryByText('Saved vendors')).toBeNull();
  });

  it('keeps the "Booking for something new?" card, linking to search', () => {
    render(<BookingsSidebar bookingCount={0} current="bookings" />);

    expect(within(nav()).getByText('Booking for something new?')).toBeDefined();
    expect(within(nav()).getByRole('link', { name: 'Find a vendor →' }).getAttribute('href')).toBe(
      '/search',
    );
    expect(within(nav()).getAllByRole('link')).toHaveLength(3);
  });

  it.each([
    ['bookings', 'My bookings', 'Messages'],
    ['messages', 'Messages', 'My bookings'],
  ] as const)('marks only the current page, %s, aria-current', (current, on, off) => {
    render(<BookingsSidebar bookingCount={1} current={current} />);

    expect(within(nav()).getByRole('link', { name: new RegExp(`^${on}`) }).ariaCurrent).toBe(
      'page',
    );
    expect(
      within(nav())
        .getByRole('link', { name: new RegExp(`^${off}`) })
        .getAttribute('aria-current'),
    ).toBeNull();
  });

  it('draws the count, including zero, and none while it is unknown', () => {
    const { rerender } = render(<BookingsSidebar bookingCount={0} current="bookings" />);
    expect(within(nav()).getAllByRole('link')[0]?.textContent).toBe('My bookings0');

    rerender(<BookingsSidebar bookingCount={null} current="bookings" />);
    expect(within(nav()).getAllByRole('link')[0]?.textContent).toBe('My bookings');
  });

  it('draws the unread dot on Messages only while a thread is unread', () => {
    render(<BookingsSidebar bookingCount={1} current="bookings" />);
    expect(screen.queryByText('unread')).toBeNull();

    act(() => setUnreadMessages(true));

    expect(within(nav()).getAllByRole('link')[1]?.textContent).toBe('Messagesunread');
    expect(screen.getAllByText('unread')).toHaveLength(1);

    act(() => setUnreadMessages(false));

    expect(screen.queryByText('unread')).toBeNull();
  });

  /*
   * Frame `07`'s measurements, pinned as class-level facts (jsdom paints
   * nothing, so the rendered result is verified in the browser pass): rows are
   * adjacent, the count is 11.5px/600, and the card is `rounded-panel` (12px).
   */
  it("keeps the frame's row spacing, count type and card radius", () => {
    render(<BookingsSidebar bookingCount={2} current="bookings" />);

    const list = within(nav()).getByRole('list');
    const count = within(nav()).getByText('2');
    const card = within(nav()).getByText('Booking for something new?').parentElement;

    expect(list.className.split(' ').some((name) => name.startsWith('gap-'))).toBe(false);
    expect(count.className.split(' ')).toEqual(
      expect.arrayContaining(['text-helper', 'font-semibold']),
    );
    expect(card?.className.split(' ')).toContain('rounded-panel');
  });

  it('is hidden below lg, where the header links remain', () => {
    render(<BookingsSidebar bookingCount={1} current="bookings" />);

    expect(nav().className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'lg:flex']));
  });
});
