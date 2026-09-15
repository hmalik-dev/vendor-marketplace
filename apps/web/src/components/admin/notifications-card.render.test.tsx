import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { interactiveInsideReadOnlyCards } from './admin-detail.testing';
import { NotificationsCard } from './notifications-card';

afterEach(cleanup);

const READ = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'booking_confirmed',
  title: 'Your booking is confirmed',
  createdAt: new Date('2026-09-02T10:00:00.000Z'),
  readAt: new Date('2026-09-02T11:00:00.000Z'),
};
const UNREAD = {
  id: '22222222-2222-4222-8222-222222222222',
  type: 'quote_received',
  title: 'Fernbank Studio sent a quote',
  createdAt: new Date('2026-09-03T09:05:00.000Z'),
  readAt: null,
};

function cells(): string[][] {
  return within(screen.getByRole('table', { name: 'Notifications sent' }))
    .getAllByRole('row')
    .map((row) =>
      [...row.querySelectorAll('[role="cell"], [role="columnheader"]')].map(
        (cell) => cell.textContent ?? '',
      ),
    );
}

/** `NotificationsCard` (VEN-400), the card every admin detail view carries. */
describe('NotificationsCard', () => {
  it('lists sent-at and read state for one account, with no recipient column', () => {
    const { container } = render(
      <NotificationsCard total={2} unread={1} items={[UNREAD, READ]} empty="Nothing sent." />,
    );

    expect(cells()).toEqual([
      ['Sent', 'Notification', 'Read'],
      ['Sep 3, 2026, 09:05 UTC', 'Fernbank Studio sent a quotequote_received', 'Unread'],
      ['Sep 2, 2026, 10:00 UTC', 'Your booking is confirmedbooking_confirmed', 'Read'],
    ]);
    const band = container.querySelector('[data-card-band]');
    expect(band?.querySelector('h2')?.textContent).toBe('Notifications sent · 2');
    expect(band?.textContent).toBe('Notifications sent · 21 unread');
    expect(interactiveInsideReadOnlyCards(container)).toEqual({ 'Notifications sent · 2': 0 });
  });

  it('names the recipient when the feed spans two parties, and says how many are shown', () => {
    const { container } = render(
      <NotificationsCard
        total={5}
        unread={3}
        items={[
          { ...UNREAD, recipient: 'customer' as const },
          { ...READ, recipient: 'vendor' as const },
        ]}
        empty="Nothing sent."
      />,
    );

    expect(cells().map((row) => row.slice(0, 2))).toEqual([
      ['Sent', 'To'],
      ['Sep 3, 2026, 09:05 UTC', 'Customer'],
      ['Sep 2, 2026, 10:00 UTC', 'Vendor'],
    ]);
    expect(container.querySelector('[data-card-band] div')?.textContent).toBe(
      '3 unread · latest 2 shown',
    );
  });

  it('keeps the card with its one line when nothing was sent', () => {
    const { container } = render(
      <NotificationsCard total={0} unread={0} items={[]} empty="Nothing sent." />,
    );

    expect(screen.queryByRole('table')).toBeNull();
    expect(container.querySelector('[data-admin-card]')?.textContent).toBe(
      'Notifications sent · 00 unreadNothing sent.',
    );
  });
});
