import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { interactiveInsideReadOnlyCards } from '@/components/admin/admin-detail.testing';
import { wireAdminCustomerDetailSchema, type WireAdminCustomerDetail } from '@/lib/wire-schemas';

const getAdminCustomerDetail = vi.fn<(id: string) => Promise<WireAdminCustomerDetail | null>>();

vi.mock('@/lib/admin-data', () => ({
  getAdminCustomerDetail: (id: string) => getAdminCustomerDetail(id),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

const { default: AdminCustomerDetailPage } = await import('./page');

const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';
const VENDOR_ID = '11111111-1111-4111-8111-111111111111';
const BOOKING_ID = '33333333-3333-4333-8333-333333333333';
const OLD_BOOKING_ID = '44444444-4444-4444-8444-444444444444';

const review = (overrides: Record<string, unknown>) => ({
  id: '55555555-5555-4555-8555-555555555555',
  bookingId: OLD_BOOKING_ID,
  vendorId: VENDOR_ID,
  vendorName: 'Fernbank Studio',
  rating: 5,
  title: null,
  content: 'Every photo was a keeper.',
  isPublic: true,
  createdAt: '2026-08-05T10:00:00.000Z',
  ...overrides,
});

/**
 * Built as the API sends it — JSON, dates as strings — and parsed through the
 * wire schema, so a date it forgot to coerce fails here rather than on the 500
 * page (`web-route-boundaries.md`). Every date field carries a value.
 */
function detail(overrides: Record<string, unknown> = {}): WireAdminCustomerDetail {
  return wireAdminCustomerDetailSchema.parse({
    customer: {
      id: CUSTOMER_ID,
      email: 'rosa@example.com',
      name: 'Rosa Rivera',
      phone: '+15125550100',
      city: 'Austin',
      state: 'TX',
      isBanned: true,
      bannedAt: '2026-09-10T08:00:00.000Z',
      deletedAt: '2026-09-11T09:00:00.000Z',
      pendingEmail: null,
      createdAt: '2026-01-05T12:00:00.000Z',
    },
    bookings: {
      total: 21,
      items: [
        {
          id: BOOKING_ID,
          status: 'confirmed',
          eventDate: '2026-11-01',
          vendorId: VENDOR_ID,
          vendorName: 'Fernbank Studio',
          totalAmountCents: 120_000,
        },
        {
          id: OLD_BOOKING_ID,
          status: 'completed',
          eventDate: '2026-08-01',
          vendorId: VENDOR_ID,
          vendorName: 'Fernbank Studio',
          totalAmountCents: 80_000,
        },
      ],
    },
    reviews: {
      written: {
        total: 1,
        items: [review({ title: 'Wonderful', isPublic: false })],
      },
      received: {
        total: 1,
        items: [
          review({
            id: '66666666-6666-4666-8666-666666666666',
            rating: 4,
            content: 'Clear brief and on time.',
            createdAt: '2026-08-06T10:00:00.000Z',
          }),
        ],
      },
    },
    notifications: {
      total: 1,
      unread: 0,
      items: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          type: 'booking_confirmed',
          title: 'Your booking is confirmed',
          createdAt: '2026-09-02T10:00:00.000Z',
          readAt: '2026-09-02T11:00:00.000Z',
        },
      ],
    },
    ...overrides,
  });
}

async function renderPage(userId = CUSTOMER_ID) {
  return render(await AdminCustomerDetailPage({ params: Promise.resolve({ userId }) }));
}

function cardTitled(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 2, name: title });

  return heading.closest('section') as HTMLElement;
}

function rowsOf(card: HTMLElement): string[][] {
  return within(card)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent ?? ''),
    );
}

/** `/admin/customers/[userId]` (VEN-400). */
describe('AdminCustomerDetailPage', () => {
  beforeEach(() => {
    getAdminCustomerDetail.mockReset();
  });

  afterEach(cleanup);

  it('is a 404 for an id that cannot name a customer, and for one that names none', async () => {
    await expect(renderPage('not-a-uuid')).rejects.toThrow('notFound');
    expect(getAdminCustomerDetail).not.toHaveBeenCalled();

    getAdminCustomerDetail.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow('notFound');
    expect(getAdminCustomerDetail).toHaveBeenCalledWith(CUSTOMER_ID);
  });

  it('reads a closed, banned account with both instants, read-only', async () => {
    getAdminCustomerDetail.mockResolvedValue(detail());

    const { container } = await renderPage();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Rosa Rivera');
    expect(
      [...document.querySelectorAll('h1 ~ [data-slot="status-pill"]')].map((p) => p.textContent),
    ).toEqual(['Closed']);
    const account = cardTitled('Account');
    const labels = [...account.querySelectorAll('dt')].map((node) => node.textContent);
    const values = [...account.querySelectorAll('dd')].map((node) => node.textContent);
    expect(labels.map((label, index) => [label, values[index]])).toEqual([
      ['Email', 'rosa@example.com'],
      ['Phone', '+15125550100'],
      ['Location', 'Austin, TX'],
      ['Joined', 'Jan 5, 2026, 12:00 UTC'],
      ['Suspended', 'Sep 10, 2026, 08:00 UTC'],
      ['Closed', 'Sep 11, 2026, 09:00 UTC'],
    ]);
    expect(interactiveInsideReadOnlyCards(container)).toEqual({
      Account: 0,
      'Notifications sent · 1': 0,
      Identity: 0,
    });
  });

  it('says No for a live account that was never suspended, and draws no pill', async () => {
    getAdminCustomerDetail.mockResolvedValue(
      detail({
        customer: {
          id: CUSTOMER_ID,
          email: 'rosa@example.com',
          name: 'Rosa Rivera',
          phone: null,
          city: null,
          state: null,
          isBanned: false,
          bannedAt: null,
          deletedAt: null,
          pendingEmail: 'rosa@new.example.com',
          createdAt: '2026-01-05T12:00:00.000Z',
        },
      }),
    );

    await renderPage();

    const values = [...cardTitled('Account').querySelectorAll('dd')].map(
      (node) => node.textContent,
    );
    expect(values).toEqual([
      'rosa@example.comEmail out of daterosa@new.example.com',
      '—',
      '—',
      'Jan 5, 2026, 12:00 UTC',
      'No',
      'No',
    ]);
    expect(document.querySelectorAll('h1 ~ [data-slot="status-pill"]')).toHaveLength(0);
  });

  it('lists bookings linked to their money story, counting every one', async () => {
    getAdminCustomerDetail.mockResolvedValue(detail());

    await renderPage();

    const card = cardTitled('Bookings · 21');
    expect(card.querySelector('[data-card-band]')?.textContent).toContain('latest 2 shown');
    expect(rowsOf(card)).toEqual([
      ['November 1, 2026', 'Fernbank Studio', 'Confirmed', '$1,200'],
      ['August 1, 2026', 'Fernbank Studio', 'Completed', '$800'],
    ]);
    expect(
      within(card)
        .getAllByRole('link', { name: /2026/ })
        .map((link) => link.getAttribute('href')),
    ).toEqual([`/admin/bookings/${BOOKING_ID}`, `/admin/bookings/${OLD_BOOKING_ID}`]);
  });

  it('splits reviews written from received, each linked to its booking', async () => {
    getAdminCustomerDetail.mockResolvedValue(detail());

    await renderPage();

    const written = cardTitled('Reviews written · 1');
    const received = cardTitled('Reviews received · 1');
    expect(rowsOf(written)).toEqual([
      ['Aug 5, 2026', 'Fernbank Studio', '5/5', 'HiddenWonderfulEvery photo was a keeper.', 'View'],
    ]);
    expect(rowsOf(received)).toEqual([
      ['Aug 6, 2026', 'Fernbank Studio', '4/5', 'Clear brief and on time.', 'View'],
    ]);
    for (const card of [written, received]) {
      expect(within(card).getByRole('link', { name: 'View' }).getAttribute('href')).toBe(
        `/admin/bookings/${OLD_BOOKING_ID}`,
      );
    }
  });

  it('keeps every card when the account has nothing, and links its other records', async () => {
    getAdminCustomerDetail.mockResolvedValue(
      detail({
        bookings: { total: 0, items: [] },
        reviews: { written: { total: 0, items: [] }, received: { total: 0, items: [] } },
        notifications: { total: 0, unread: 0, items: [] },
      }),
    );

    await renderPage();

    expect(cardTitled('Bookings · 0').textContent).toContain('No bookings yet.');
    expect(cardTitled('Reviews written · 0').textContent).toContain(
      'This customer has not reviewed a vendor.',
    );
    expect(cardTitled('Reviews received · 0').textContent).toContain(
      'No vendor has reviewed this customer.',
    );
    expect(cardTitled('Notifications sent · 0').textContent).toContain(
      'Nothing has been sent to this customer.',
    );
    expect(
      within(cardTitled('Records'))
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([`/admin/users/${CUSTOMER_ID}`, `/admin/activity?subject=${CUSTOMER_ID}`]);
  });
});
