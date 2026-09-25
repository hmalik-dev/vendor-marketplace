import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireNonAdmin = vi.fn();

vi.mock('@/lib/current-user', () => ({
  requireNonAdmin: (...args: unknown[]) => requireNonAdmin(...args),
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

const { default: MessagesLayout } = await import('./layout');

const screenElement = <section aria-label="Messaging" />;

beforeEach(() => {
  requireNonAdmin.mockReset();
});

afterEach(cleanup);

describe('the messages layout', () => {
  it('draws the customer sidebar beside the messaging screen, with Messages current', async () => {
    requireNonAdmin.mockResolvedValue({ role: 'customer' });

    render(await MessagesLayout({ children: screenElement }));

    const nav = screen.getByRole('navigation', { name: 'Your account' });
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Messages');
    expect(screen.getByRole('region', { name: 'Messaging' })).toBeDefined();
  });

  it("gives a vendor's inbox the same frame and no Your account nav", async () => {
    requireNonAdmin.mockResolvedValue({ role: 'vendor' });

    const { container } = render(await MessagesLayout({ children: screenElement }));

    expect(screen.getByRole('region', { name: 'Messaging' })).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Your account' })).toBeNull();
    expect((container.firstElementChild as HTMLElement).className.split(' ')).toContain(
      'h-[calc(100dvh-var(--header-height))]',
    );
  });

  it('passes the gate’s redirect through for a signed-out visitor or an admin', async () => {
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace' });
    requireNonAdmin.mockRejectedValue(redirect);

    await expect(MessagesLayout({ children: screenElement })).rejects.toBe(redirect);
  });
});
