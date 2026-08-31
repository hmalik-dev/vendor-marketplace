import type { Category } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

/*
 * Drive the **anchored** mount, the way `category-select.test.tsx` does and for
 * the same reason: jsdom's stub in `vitest.setup.ts` answers every media query
 * "no", which puts every assertion against the bottom sheet instead. That was
 * invisible until #375, because both mounts rendered the same button trigger —
 * now the sheet renders a button and the popover renders the field itself, so a
 * suite that does not say which mount it means tests the wrong one.
 */
beforeEach(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes('min-width: 640px'),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

describe('HeroSearch', () => {
  afterEach(() => {
    cleanup();
    push.mockReset();
  });

  it('carries the three values the query is made of into /search', async () => {
    const user = userEvent.setup();
    render(<HeroSearch categories={CATEGORIES} cities={CITIES} />);

    /*
     * The whole journey, through the controls #375 rebuilt: both segments are
     * comboboxes, and `City` shows nothing until something is typed. That is
     * the difference the ticket exists for, so the flow test drives it rather
     * than clicking a list open.
     */
    await user.click(screen.getByRole('combobox', { name: 'Vendor type' }));
    // The row carries the category's short description under its name, so the
    // accessible name is the pair rather than the name alone (#167).
    await user.click(await screen.findByRole('option', { name: /^Photography/ }));
    await user.type(screen.getByRole('combobox', { name: 'City' }), 'aus');
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
