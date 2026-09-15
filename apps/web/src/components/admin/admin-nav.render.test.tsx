import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let pathname = '/admin';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

const { AdminNav } = await import('./admin-nav');

function current(): string[] {
  return screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent ?? '');
}

describe('the admin rail', () => {
  afterEach(cleanup);

  /** `Bookings · Requests` is a tab of Bookings, so its route lights that row (VEN-399). */
  it.each(['/admin/bookings', '/admin/bookings/some-id', '/admin/requests'])(
    'marks Bookings current on %s',
    (path) => {
      pathname = path;
      render(<AdminNav reviewCount={0} caseCount={0} />);

      expect(current()).toEqual(['Bookings']);
    },
  );

  it('does not light Bookings on a route that merely starts with the word', () => {
    pathname = '/admin/requests-archive';
    render(<AdminNav reviewCount={0} caseCount={0} />);

    expect(current()).toEqual([]);
  });
});
