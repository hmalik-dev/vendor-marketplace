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
    // The header carries one sign-up control, so this is the vendor door — and
    // it deep-links with the role pre-selected rather than scrolling to a
    // section. See design/design-plan/21-sign-up.md.
    expect(screen.getByRole('link', { name: 'For vendors' })).toHaveProperty(
      'href',
      'http://localhost:3000/sign-up?role=vendor',
    );
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
