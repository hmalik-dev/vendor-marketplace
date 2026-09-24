import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
const push = vi.fn();
let pathname = '/bookings/b1/checkout';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push }),
  usePathname: () => pathname,
}));

const { RetryLink } = await import('./retry-link');

/**
 * What the click's default was when it reached the document — after React's
 * handlers have run — recorded, then cancelled so jsdom does not try to load
 * the anchor's target.
 */
let defaultPrevented: boolean[] = [];

function record(event: Event): void {
  defaultPrevented.push(event.defaultPrevented);
  event.preventDefault();
}

describe('RetryLink', () => {
  beforeEach(() => {
    document.addEventListener('click', record);
  });

  afterEach(() => {
    document.removeEventListener('click', record);
    defaultPrevented = [];
    cleanup();
    refresh.mockReset();
    push.mockReset();
    pathname = '/bookings/b1/checkout';
  });

  it('re-renders the page on the server when it points at the page the reader is on', () => {
    render(<RetryLink href="/bookings/b1/checkout">Try this payment again</RetryLink>);

    const link = screen.getByRole('link', { name: 'Try this payment again' });
    fireEvent.click(link);

    expect(defaultPrevented).toEqual([true]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(link.getAttribute('href')).toBe('/bookings/b1/checkout');
  });

  it('leaves a link to another page to the router', () => {
    pathname = '/bookings/b1';
    render(<RetryLink href="/bookings/b1/checkout">Try this payment again</RetryLink>);

    fireEvent.click(screen.getByRole('link', { name: 'Try this payment again' }));

    expect(defaultPrevented).toEqual([false]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ['a command-click', { metaKey: true }],
    ['a control-click', { ctrlKey: true }],
    ['a shift-click', { shiftKey: true }],
    ['an alt-click', { altKey: true }],
    ['a middle-click', { button: 1 }],
  ])('leaves %s to the browser, so a new tab still opens', (_name, init) => {
    render(<RetryLink href="/bookings/b1/checkout">Try this payment again</RetryLink>);

    fireEvent.click(screen.getByRole('link', { name: 'Try this payment again' }), init);

    expect(defaultPrevented).toEqual([false]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('runs the click handler the caller passed, then refreshes', () => {
    const onClick = vi.fn();
    render(
      <RetryLink href="/bookings/b1/checkout" onClick={onClick}>
        Try this payment again
      </RetryLink>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Try this payment again' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
