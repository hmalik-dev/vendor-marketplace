import type { Category } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn<(href: string) => void>();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const { HeroSearch } = await import('./hero-search');

const CATEGORIES: Category[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Photography',
    slug: 'photography',
    description: 'Portraits, candids, photo booths, and full-day coverage.',
    icon: 'camera',
    displayOrder: 1,
    isActive: true,
  },
];

/** The cities the City select offers — real places with published vendors. */
const CITIES = [
  { city: 'Austin', state: 'TX', vendorCount: 11 },
  { city: 'Portland', state: 'OR', vendorCount: 3 },
];

describe('HeroSearch', () => {
  afterEach(() => {
    cleanup();
    push.mockReset();
  });

  it('carries the three values the query is made of into /search', async () => {
    const user = userEvent.setup();
    render(<HeroSearch categories={CATEGORIES} cities={CITIES} />);

    await user.click(screen.getByRole('button', { name: 'Vendor type' }));
    // The row carries the category's short description under its name, so the
    // accessible name is the pair rather than the name alone (#167).
    await user.click(await screen.findByRole('option', { name: /^Photography/ }));
    // City is a select over real places now, and it carries its state (#167).
    await user.click(screen.getByRole('button', { name: 'City' }));
    await user.click(await screen.findByRole('option', { name: /^Austin, TX/ }));
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(push).toHaveBeenCalledWith('/search?category=photography&city=Austin&state=TX');
  });

  it('leaves an untouched segment out of the URL rather than sending it empty', async () => {
    const user = userEvent.setup();
    render(<HeroSearch categories={CATEGORIES} cities={CITIES} />);

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(push).toHaveBeenCalledWith('/search');
  });
});
