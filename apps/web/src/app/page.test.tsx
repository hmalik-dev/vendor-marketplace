import { CATEGORY_SEEDS, LANDING_CATEGORY_COUNT } from '@vendorhub/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const redirectVendorToDashboard = vi.fn<() => Promise<void>>();

vi.mock('@/lib/current-user', () => ({
  redirectVendorToDashboard: () => redirectVendorToDashboard(),
}));

const { default: HomePage } = await import('./page');

describe('HomePage', () => {
  afterEach(() => {
    cleanup();
    redirectVendorToDashboard.mockReset();
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
