import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { interactiveInsideReadOnlyCards } from '@/components/admin/admin-detail.testing';
import { wireAdminBookingDetailSchema, type WireAdminBookingDetail } from '@/lib/wire-schemas';

const getAdminBookingDetail = vi.fn<(id: string) => Promise<WireAdminBookingDetail | null>>();

vi.mock('@/lib/admin-data', () => ({
  getAdminBookingDetail: (id: string) => getAdminBookingDetail(id),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

const { default: AdminBookingDetailPage } = await import('./page');

const BOOKING_ID = '33333333-3333-4333-8333-333333333333';
const REQUEST_ID = '44444444-4444-4444-8444-444444444444';
const VENDOR_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';

/**
 * Built as the API sends it — JSON, dates as strings — and parsed through the
 * wire schema, so a date the schema forgot to coerce fails here rather than on
 * the 500 page (`web-route-boundaries.md`).
 */
function detail(overrides: Record<string, unknown> = {}): WireAdminBookingDetail {
  return wireAdminBookingDetailSchema.parse({
    id: BOOKING_ID,
    requestId: REQUEST_ID,
    status: 'confirmed',
    eventDate: '2026-10-10',
    eventLocation: 'Barr Mansion',
    totalAmountCents: 120_000,
    platformFeeCents: 14_400,
    vendorPayoutCents: 105_600,
    payoutModel: 'separate',
    payoutStatus: 'pending',
    payoutFailing: false,
    payoutStranded: false,
    payoutAttempts: 0,
    payoutFailureReason: null,
    payoutReleasedAt: null,
    stripePaymentIntentId: 'pi_test_money_story',
    stripeTransferId: null,
    paidAt: '2026-09-02T10:00:00.000Z',
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    cancelledBy: null,
    refundAmountCents: null,
    externalRefundCents: 0,
    disputeReason: null,
    createdAt: '2026-09-02T09:58:00.000Z',
    vendor: { id: VENDOR_ID, businessName: 'Fernbank Studio', payoutHold: false },
    customer: { id: CUSTOMER_ID, name: 'Rosa Rivera', email: 'rosa@example.com' },
    notifications: { total: 0, unread: 0, items: [] },
    ...overrides,
  });
}

async function renderPage(bookingId = BOOKING_ID) {
  return render(await AdminBookingDetailPage({ params: Promise.resolve({ bookingId }) }));
}

/** The Money card's rows, label and value, in the order they render. */
function moneyRows(): [string, string][] {
  const card = screen.getByRole('heading', { name: 'Money' }).closest('section') as HTMLElement;
  const labels = [...card.querySelectorAll('dt')].map((node) => node.textContent ?? '');
  const values = [...card.querySelectorAll('dd')].map((node) => node.textContent ?? '');

  return labels.map((label, index) => [label, values[index] ?? '']);
}

/** `/admin/bookings/[bookingId]` (VEN-399). */
describe('AdminBookingDetailPage', () => {
  beforeEach(() => {
    getAdminBookingDetail.mockReset();
  });

  afterEach(cleanup);

  it('is a 404 for an id that cannot name a booking, and for one that names none', async () => {
    await expect(renderPage('not-a-uuid')).rejects.toThrow('notFound');
    expect(getAdminBookingDetail).not.toHaveBeenCalled();

    getAdminBookingDetail.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow('notFound');
    expect(getAdminBookingDetail).toHaveBeenCalledWith(BOOKING_ID);
  });

  it('does not promise a release for a payout stranded by a banned or closed vendor', async () => {
    getAdminBookingDetail.mockResolvedValue(detail({ payoutStranded: true }));

    await renderPage();

    expect(moneyRows()).toContainEqual(['Payout', 'Stranded — vendor banned or closed']);
    expect(screen.queryByText('Awaiting release')).toBeNull();
  });

  it('omits the rows that do not apply to a booking still waiting on its date', async () => {
    getAdminBookingDetail.mockResolvedValue(detail());

    await renderPage();

    expect(moneyRows()).toEqual([
      ['Total', '$1,200'],
      ['Platform fee', '$144'],
      ['Vendor payout', '$1,056'],
      ['Payout model', 'Separate transfer, released after the event'],
      ['Payment intent', 'pi_test_money_story'],
      ['Paid', 'Sep 2, 2026, 10:00 UTC'],
      ['Payout', 'Awaiting release'],
    ]);
  });

  it('tells the whole story of a booking that went wrong, in event order', async () => {
    getAdminBookingDetail.mockResolvedValue(
      detail({
        status: 'cancelled',
        payoutFailing: true,
        payoutAttempts: 2,
        payoutFailureReason: 'account_closed',
        completedAt: '2026-10-11T09:00:00.000Z',
        cancelledAt: '2026-09-20T15:30:00.000Z',
        cancellationReason: 'The couple moved the wedding abroad.',
        cancelledBy: 'customer',
        refundAmountCents: 60_000,
        disputeReason: 'Deposit terms were unclear.',
        vendor: { id: VENDOR_ID, businessName: 'Fernbank Studio', payoutHold: true },
      }),
    );

    await renderPage();

    expect(moneyRows()).toEqual([
      ['Total', '$1,200'],
      ['Platform fee', '$144'],
      ['Vendor payout', '$1,056'],
      ['Payout model', 'Separate transfer, released after the event'],
      ['Payment intent', 'pi_test_money_story'],
      ['Paid', 'Sep 2, 2026, 10:00 UTC'],
      ['Completed', 'Oct 11, 2026, 09:00 UTC'],
      ['Payout', "Awaiting release · vendor's payouts held by an operatorTransfer failing"],
      ['Payout attempts', '2account_closed'],
      ['Refunded', '$600'],
      ['Cancelled', 'Sep 20, 2026, 15:30 UTC'],
      ['Cancellation reason', 'The couple moved the wedding abroad.'],
      ['Cancelled by', 'The customer'],
      ['Dispute reason', 'Deposit terms were unclear.'],
    ]);
    expect(screen.getByText('account_closed').className.split(/\s+/)).toContain('text-error-500');
  });

  it('shows a payout held for a refund made outside the app, with the amount and why', async () => {
    getAdminBookingDetail.mockResolvedValue(
      detail({
        status: 'disputed',
        payoutStatus: 'held',
        externalRefundCents: 10_000,
        disputeReason:
          '$100 was refunded at Stripe outside the platform, so the payout is on hold until an operator rules',
      }),
    );

    await renderPage();

    const rows = moneyRows();
    expect(rows).toContainEqual(['Refunded outside the app', '$100']);
    expect(rows).toContainEqual([
      'Dispute reason',
      '$100 was refunded at Stripe outside the platform, so the payout is on hold until an operator rules',
    ]);
    expect(rows).toContainEqual(['Payout', 'Held']);
  });

  it('shows a released payout with its date and transfer', async () => {
    getAdminBookingDetail.mockResolvedValue(
      detail({
        status: 'completed',
        payoutStatus: 'released',
        payoutReleasedAt: '2026-10-12T09:00:00.000Z',
        stripeTransferId: 'tr_test_released',
        vendor: { id: VENDOR_ID, businessName: 'Fernbank Studio', payoutHold: true },
      }),
    );

    await renderPage();

    const rows = moneyRows();
    expect(rows).toContainEqual(['Payout', 'Released']);
    expect(rows).toContainEqual(['Payout released', 'Oct 12, 2026, 09:00 UTC']);
    expect(rows).toContainEqual(['Transfer', 'tr_test_released']);
  });

  it('lists what each party was told about the booking, with read state', async () => {
    getAdminBookingDetail.mockResolvedValue(
      detail({
        notifications: {
          total: 3,
          unread: 1,
          items: [
            {
              id: '55555555-5555-4555-8555-555555555555',
              type: 'booking_confirmed',
              title: 'Rosa Rivera paid',
              createdAt: '2026-09-02T10:00:00.000Z',
              readAt: '2026-09-02T12:00:00.000Z',
              recipient: 'vendor',
            },
            {
              id: '66666666-6666-4666-8666-666666666666',
              type: 'quote_received',
              title: 'Fernbank Studio sent a quote',
              createdAt: '2026-09-01T10:00:00.000Z',
              readAt: null,
              recipient: 'customer',
            },
          ],
        },
      }),
    );

    await renderPage();

    const table = screen.getByRole('table', { name: 'Notifications sent' });
    expect(
      within(table)
        .getAllByRole('row')
        .map((row) =>
          [...row.querySelectorAll('[role="cell"], [role="columnheader"]')].map(
            (cell) => cell.textContent,
          ),
        ),
    ).toEqual([
      ['Sent', 'To', 'Notification', 'Read'],
      ['Sep 2, 2026, 10:00 UTC', 'Vendor', 'Rosa Rivera paidbooking_confirmed', 'Read'],
      [
        'Sep 1, 2026, 10:00 UTC',
        'Customer',
        'Fernbank Studio sent a quotequote_received',
        'Unread',
      ],
    ]);
    expect(screen.getByText('1 unread · latest 2 shown').tagName).toBe('SPAN');
  });

  it('keeps its links out of the read-only cards and points them at both parties', async () => {
    getAdminBookingDetail.mockResolvedValue(detail());

    const { container } = await renderPage();

    expect(interactiveInsideReadOnlyCards(container)).toEqual({
      Money: 0,
      'Notifications sent · 0': 0,
      Identity: 0,
    });
    const records = screen
      .getByRole('heading', { name: 'Records' })
      .closest('section') as HTMLElement;
    expect(
      within(records)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Vendor · Fernbank Studio', `/admin/vendors/${VENDOR_ID}`],
      ['Customer · Rosa Rivera', `/admin/customers/${CUSTOMER_ID}`],
    ]);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Fernbank Studio · October 10, 2026',
    );
  });
});
