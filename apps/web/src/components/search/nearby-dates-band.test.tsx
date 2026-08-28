import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NearbyDatesBand } from './nearby-dates-band';

const apiRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiRequest,
  ApiClientError: class extends Error {},
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/vendors/vendor-card', () => ({
  VendorCard: ({
    vendor,
    freeOnDate,
  }: {
    vendor: { businessName: string };
    freeOnDate: string;
  }) => (
    <div data-testid="vendor-card">
      {vendor.businessName} — {freeOnDate}
    </div>
  ),
}));

function vendor(businessName: string, nearestAvailableDate: string) {
  return { id: businessName, businessName, nearestAvailableDate };
}

beforeEach(() => {
  apiRequest.mockReset();
});

afterEach(cleanup);

/**
 * The band exists to unstick a customer at a dead end, so the thing worth
 * asserting is that it never adds to the dead end: no empty band, no error on
 * top of an error, and no count it did not measure.
 */
describe('NearbyDatesBand', () => {
  it('offers each vendor with the date they are actually free', async () => {
    apiRequest.mockResolvedValue({
      items: [vendor('June Harlow', '2026-06-20'), vendor('Cardenas Studio', '2026-06-15')],
      total: 2,
      windowDays: 14,
    });

    render(<NearbyDatesBand date="2026-06-14" category="photography" city="Marfa" />);

    await waitFor(() => expect(screen.getAllByTestId('vendor-card')).toHaveLength(2));
    expect(screen.getByText(/June Harlow — 2026-06-20/)).toBeDefined();
  });

  /* Absent, never empty: the screen above already stands on its own. */
  it('renders nothing at all when nobody is free nearby', async () => {
    apiRequest.mockResolvedValue({ items: [], total: 0, windowDays: 14 });

    const { container } = render(
      <NearbyDatesBand date="2026-06-14" category="photography" city="Marfa" />,
    );

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(container.querySelector('section')).toBeNull();
  });

  /* An error here would put a failure on top of a dead end. */
  it('stays silent when the request fails', async () => {
    apiRequest.mockRejectedValue(new Error('offline'));

    const { container } = render(
      <NearbyDatesBand date="2026-06-14" category="photography" city="Marfa" />,
    );

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('asks nothing at all without a date to be near', () => {
    render(<NearbyDatesBand date="" category="photography" city="Marfa" />);

    expect(apiRequest).not.toHaveBeenCalled();
  });

  /*
   * "See all N" is the count the request measured. A link that counted the
   * cards on screen would be a lie, and one that opens nothing is furniture.
   */
  it('links to the rest, with the count the request measured', async () => {
    apiRequest.mockResolvedValue({
      items: [vendor('June Harlow', '2026-06-20')],
      total: 14,
      windowDays: 14,
    });

    render(<NearbyDatesBand date="2026-06-14" category="photography" city="Marfa" />);

    const link = await screen.findByRole('link', { name: /See all 14 in the region/ });
    expect(link.getAttribute('href')).toBe('/search?category=photography&city=Marfa');
  });

  it('draws no link when the band already shows everyone', async () => {
    apiRequest.mockResolvedValue({
      items: [vendor('June Harlow', '2026-06-20')],
      total: 1,
      windowDays: 14,
    });

    render(<NearbyDatesBand date="2026-06-14" category="photography" city="Marfa" />);

    await waitFor(() => expect(screen.getAllByTestId('vendor-card')).toHaveLength(1));
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('carries the category and city into the question it asks', async () => {
    apiRequest.mockResolvedValue({ items: [], total: 0, windowDays: 14 });

    render(<NearbyDatesBand date="2026-06-14" category="photography" city="Marfa" />);

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    const url = apiRequest.mock.calls[0]?.[0] as string;
    expect(url).toContain('date=2026-06-14');
    expect(url).toContain('category=photography');
    expect(url).toContain('city=Marfa');
  });

  it('omits an unset filter rather than sending an empty one', async () => {
    apiRequest.mockResolvedValue({ items: [], total: 0, windowDays: 14 });

    render(<NearbyDatesBand date="2026-06-14" category="" city="" />);

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    const url = apiRequest.mock.calls[0]?.[0] as string;
    expect(url).not.toContain('category=');
    expect(url).not.toContain('city=');
  });
});
