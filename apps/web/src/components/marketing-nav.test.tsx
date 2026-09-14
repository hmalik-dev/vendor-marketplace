import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let pathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

const { MarketingNav } = await import('./marketing-nav');

describe('MarketingNav', () => {
  afterEach(() => {
    pathname = '/';
    cleanup();
  });

  it('draws the three links frame 01 puts beside the wordmark', () => {
    render(<MarketingNav />);

    expect(screen.getByRole('link', { name: 'Browse' })).toHaveProperty(
      'href',
      'http://localhost:3000/search',
    );
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveProperty(
      'href',
      'http://localhost:3000/#how-it-works',
    );
    // The vendor door opens the page that says what a vendor keeps, not a
    // sign-up form an account holder would be bounced out of (VEN-384).
    expect(screen.getByRole('link', { name: 'For vendors' })).toHaveProperty(
      'href',
      'http://localhost:3000/for-vendors',
    );
  });

  it('draws on /for-vendors with that link marked as the current page', () => {
    pathname = '/for-vendors';

    render(<MarketingNav />);

    const active = screen.getByRole('link', { name: 'For vendors' });
    expect(active.getAttribute('aria-current')).toBe('page');
    expect(active.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['font-semibold', 'text-clay-600', 'before:bg-clay-400']),
    );
    expect(screen.getByRole('link', { name: 'Browse' }).getAttribute('aria-current')).toBeNull();
  });

  it('marks no link current on the landing page', () => {
    render(<MarketingNav />);

    for (const name of ['Browse', 'How it works', 'For vendors']) {
      expect(screen.getByRole('link', { name }).getAttribute('aria-current'), name).toBeNull();
    }
  });

  it('keeps the on-page anchor absolute so it resolves from the landing page itself', () => {
    render(<MarketingNav />);

    // A bare "#how-it-works" would be correct here but wrong the moment the
    // nav is reused, so the anchor names the page it lives on.
    expect(screen.getByRole('link', { name: 'How it works' }).getAttribute('href')).toMatch(/^\/#/);
  });

  it('renders nothing off the landing page, where the frames fill that space differently', () => {
    pathname = '/search';

    const { container } = render(<MarketingNav />);

    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('link', { name: 'Browse' })).toBeNull();
  });
});
