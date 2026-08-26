import type { ReactNode } from 'react';
import { CATEGORY_SEEDS, LANDING_CATEGORY_COUNT } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AuthState = 'signed-in' | 'signed-out';

let authState: AuthState = 'signed-out';

const redirectVendorToDashboard = vi.fn<() => Promise<void>>();

vi.mock('@clerk/nextjs', () => ({
  Show: ({ when, children }: { when: AuthState; children: ReactNode }) =>
    when === authState ? children : null,
}));

vi.mock('@/lib/current-user', () => ({
  redirectVendorToDashboard: () => redirectVendorToDashboard(),
}));

const { default: HomePage } = await import('./page');

describe('HomePage', () => {
  beforeEach(() => {
    authState = 'signed-out';
  });

  afterEach(() => {
    cleanup();
    redirectVendorToDashboard.mockReset();
  });

  it('offers the sign-up and sign-in CTAs to a visitor with no session', async () => {
    redirectVendorToDashboard.mockResolvedValue(undefined);

    render(await HomePage());

    expect(screen.getByRole('link', { name: 'Get started' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Go to your dashboard' })).toBeNull();
  });

  it('replaces the hero CTAs with a dashboard link once signed in', async () => {
    // The footer hides the same pair; a page that disagrees with itself is a bug.
    authState = 'signed-in';
    redirectVendorToDashboard.mockResolvedValue(undefined);

    render(await HomePage());

    expect(screen.queryByRole('link', { name: 'Get started' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Go to your dashboard' })).toHaveProperty(
      'href',
      'http://localhost:3000/dashboard',
    );
  });

  it('renders the browse surface for visitors the vendor guard lets through', async () => {
    redirectVendorToDashboard.mockResolvedValue(undefined);

    render(await HomePage());

    expect(screen.getByRole('heading', { level: 2, name: 'Browse by category' })).toBeDefined();
  });

  it('features the landing categories with their descriptions', async () => {
    redirectVendorToDashboard.mockResolvedValue(undefined);

    render(await HomePage());

    for (const category of CATEGORY_SEEDS.slice(0, LANDING_CATEGORY_COUNT)) {
      expect(screen.getByRole('heading', { level: 3, name: category.name })).toBeDefined();
      expect(screen.getByText(category.description)).toBeDefined();
    }
  });

  it('holds the rest of the taxonomy back until search can make them clickable', async () => {
    redirectVendorToDashboard.mockResolvedValue(undefined);

    render(await HomePage());

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(LANDING_CATEGORY_COUNT);
    for (const category of CATEGORY_SEEDS.slice(LANDING_CATEGORY_COUNT)) {
      expect(screen.queryByRole('heading', { level: 3, name: category.name })).toBeNull();
    }
  });

  it('gives every featured category an icon, never a bare text row', async () => {
    redirectVendorToDashboard.mockResolvedValue(undefined);

    const { container } = render(await HomePage());

    // The design system calls a category rendered without its icon a bug.
    expect(container.querySelectorAll('#categories-heading ~ ul svg')).toHaveLength(
      LANDING_CATEGORY_COUNT,
    );
  });

  it('never renders the vendor catalogue when the guard redirects a vendor', async () => {
    redirectVendorToDashboard.mockRejectedValue(new Error('NEXT_REDIRECT:/vendor/dashboard'));

    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT:/vendor/dashboard');
  });
});
