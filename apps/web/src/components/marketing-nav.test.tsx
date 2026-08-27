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
    expect(screen.getByRole('link', { name: 'For vendors' })).toHaveProperty(
      'href',
      'http://localhost:3000/#for-vendors',
    );
  });

  it('keeps the anchors absolute so they resolve from the landing page itself', () => {
    render(<MarketingNav />);

    // A bare "#how-it-works" would be correct here but wrong the moment the
    // nav is reused, so both anchors name the page they live on.
    for (const name of ['How it works', 'For vendors']) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toMatch(/^\/#/);
    }
  });

  it('renders nothing off the landing page, where the frames fill that space differently', () => {
    pathname = '/search';

    const { container } = render(<MarketingNav />);

    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('link', { name: 'Browse' })).toBeNull();
  });
});
