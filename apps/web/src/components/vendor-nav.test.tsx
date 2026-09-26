import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VendorNav } from './vendor-nav';

const pathname = vi.hoisted(() => ({ current: '/vendor/dashboard' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}));

beforeEach(() => {
  pathname.current = '/vendor/dashboard';
});

describe('VendorNav', () => {
  it('shows the waiting-request count on Bookings and names it for a screen reader', () => {
    render(<VendorNav pendingRequests={3} payoutsConnected />);

    const bookings = screen.getByRole('link', { name: 'Bookings, 3 waiting' });
    expect(bookings.getAttribute('href')).toBe('/vendor/bookings');
    expect(bookings.textContent).toBe('Bookings3');
  });

  it('draws no pill on Bookings while nothing is waiting', () => {
    render(<VendorNav pendingRequests={0} payoutsConnected />);

    const bookings = screen.getByRole('link', { name: 'Bookings' });
    expect(bookings.textContent).toBe('Bookings');
    expect(bookings.hasAttribute('aria-label')).toBe(false);
  });

  it('carries the count on every vendor page, not only the dashboard', () => {
    pathname.current = '/vendor/availability';
    render(<VendorNav pendingRequests={3} payoutsConnected />);

    expect(screen.getByRole('link', { name: 'Bookings, 3 waiting' }).textContent).toBe('Bookings3');
  });

  it('marks Payments with a gold dot while payouts are not connected', () => {
    render(<VendorNav pendingRequests={0} payoutsConnected={false} />);

    const payments = screen.getByRole('link', { name: 'Payments, payouts not connected' });
    expect(payments.getAttribute('href')).toBe('/vendor/payments');
    const dot = payments.querySelector('[data-slot="nav-dot"]');
    expect(dot?.className.split(' ')).toEqual(expect.arrayContaining(['size-1.75', 'bg-gold-400']));
  });

  it('draws no dot on Payments once payouts are connected', () => {
    render(<VendorNav pendingRequests={0} payoutsConnected />);

    const payments = screen.getByRole('link', { name: 'Payments' });
    expect(payments.querySelector('[data-slot="nav-dot"]')).toBeNull();
    expect(payments.hasAttribute('aria-label')).toBe(false);
  });

  it('renders nothing on the storefront editor, which carries its own rail', () => {
    pathname.current = '/vendor/profile/edit';
    const { container } = render(<VendorNav pendingRequests={3} payoutsConnected={false} />);

    expect(container.innerHTML).toBe('');
  });
});
