import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gateBookingRequest = vi.fn();
const readBookingForRequest = vi.fn();
const getRequestConversationId = vi.fn();
const quoteReview = vi.fn();

vi.mock('@/lib/booking-route', () => ({
  gateBookingRequest: (args: unknown) => gateBookingRequest(args),
  readBookingForRequest: (id: string) => readBookingForRequest(id),
}));
vi.mock('@/lib/customer-data', () => ({
  getRequestConversationId: (id: string) => getRequestConversationId(id),
}));
vi.mock('@/components/bookings/quote-review', () => ({
  QuoteReview: (props: { conversationId: string | null }): ReactNode => {
    quoteReview(props);
    return null;
  },
}));
vi.mock('@/components/bookings/accepted-request', () => ({
  AcceptedRequest: (): ReactNode => null,
}));
vi.mock('@/components/bookings/report-problem', () => ({
  ReportProblem: (): ReactNode => null,
}));

const { default: BookingRequestPage } = await import('./page.js');

const REQUEST_ID = '6f1c2b1e-3a55-4a8e-9a55-1f6f0b3f2d10';

function gateWith(status: string): void {
  gateBookingRequest.mockResolvedValue({
    requestId: REQUEST_ID,
    request: { id: REQUEST_ID, status, vendor: { businessName: 'Kessler & Co.' } },
  });
}

async function renderPage(): Promise<void> {
  render(await BookingRequestPage({ params: Promise.resolve({ requestId: REQUEST_ID }) }));
}

describe('BookingRequestPage', () => {
  beforeEach(() => {
    readBookingForRequest.mockResolvedValue(null);
    getRequestConversationId.mockResolvedValue('conv-9');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  /* Frame `47` (VEN-765). */
  it('links back to My bookings', async () => {
    gateWith('quoted');
    await renderPage();

    const back = screen.getByRole('link', { name: '← My bookings' });
    expect(back.getAttribute('href')).toBe('/bookings');
  });

  it('hands a quoted request its thread for Message about this request', async () => {
    gateWith('quoted');
    await renderPage();

    expect(getRequestConversationId).toHaveBeenCalledWith(REQUEST_ID);
    expect(quoteReview).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'conv-9' }));
  });

  it('reads no thread for a request that draws no link', async () => {
    gateWith('pending');
    await renderPage();

    expect(getRequestConversationId).not.toHaveBeenCalled();
    expect(quoteReview).toHaveBeenCalledWith(expect.objectContaining({ conversationId: null }));
  });
});
