import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();

vi.mock('@/lib/current-user', () => ({
  requireRole: (...args: unknown[]) => requireRole(...args),
}));
/* The count is proven in `bookings-sidebar-with-count.test.tsx`; an async server component cannot render here. */
vi.mock('@/components/bookings/bookings-sidebar-with-count', async () => {
  const { BookingsSidebar } = await import('@/components/bookings/bookings-sidebar');

  return {
    BookingsSidebarWithCount: ({ current }: { current: 'bookings' | 'messages' }) => (
      <BookingsSidebar bookingCount={4} current={current} />
    ),
  };
});

const { default: BookingsHubLayout } = await import('./layout');

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ role: 'customer' });
});

afterEach(cleanup);

describe('the bookings hub layout', () => {
  it('draws the customer sidebar beside the page, with My bookings current', async () => {
    render(await BookingsHubLayout({ children: <section aria-label="Bookings" /> }));

    const nav = screen.getByRole('navigation', { name: 'Your account' });
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('My bookings4');
    expect(screen.getByRole('region', { name: 'Bookings' })).toBeDefined();
  });

  it('frames both at the viewport below the header, and the page never scrolls', async () => {
    const { container } = render(
      await BookingsHubLayout({ children: <section aria-label="Bookings" /> }),
    );

    expect((container.firstElementChild as HTMLElement).className.split(' ')).toEqual(
      expect.arrayContaining(['h-[calc(100dvh-var(--header-height))]', 'overflow-hidden']),
    );
  });

  it('gates on the customer role before anything renders, so a stranger gets the redirect', async () => {
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace' });
    requireRole.mockRejectedValue(redirect);

    await expect(BookingsHubLayout({ children: null })).rejects.toBe(redirect);
    expect(requireRole).toHaveBeenCalledWith('customer');
  });
});
