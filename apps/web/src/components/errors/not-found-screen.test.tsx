import { CATEGORY_SEEDS, LANDING_CATEGORY_COUNT, type Category } from '@vendor-marketplace/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotFoundScreen } from './not-found-screen';

const getCategories = vi.fn<() => Promise<Category[]>>();

vi.mock('@/lib/vendor-data', () => ({
  getCategories: () => getCategories(),
}));

/** The live taxonomy as the API returns it: every seed, active. */
function taxonomy(): Category[] {
  return CATEGORY_SEEDS.map((seed, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    slug: seed.slug,
    name: seed.name,
    description: seed.description,
    icon: seed.icon,
    displayOrder: index,
    isActive: true,
  }));
}

async function pillHrefs(): Promise<string[]> {
  render(await NotFoundScreen());

  const list = screen.getByText('Or start with a category').nextElementSibling as HTMLElement;

  return within(list)
    .getAllByRole('link')
    .map((link) => link.getAttribute('href') ?? '');
}

const SEEDED = CATEGORY_SEEDS.slice(0, LANDING_CATEGORY_COUNT).map(
  (seed) => `/search?category=${seed.slug}`,
);

/**
 * Frame `15`'s recovery pills (VEN-416). An operator can hide a category from
 * the console (VEN-401), and a pill to a hidden one opens a search filtered on
 * nothing — so the pills follow the live taxonomy like every other public
 * surface, and fall back to the full list when that read degrades.
 */
describe('NotFoundScreen — the category pills', () => {
  afterEach(() => {
    cleanup();
    getCategories.mockReset();
  });

  it('offers the seeded categories when all are active', async () => {
    getCategories.mockResolvedValue(taxonomy());

    expect(SEEDED).toHaveLength(6);
    expect(await pillHrefs()).toEqual(SEEDED);
  });

  it('omits a category an operator deactivated', async () => {
    const hidden = CATEGORY_SEEDS[1]!.slug;
    getCategories.mockResolvedValue(taxonomy().filter((category) => category.slug !== hidden));

    const hrefs = await pillHrefs();

    expect(hrefs).toEqual(SEEDED.filter((href) => href !== `/search?category=${hidden}`));
    expect(hrefs).toHaveLength(5);
  });

  /*
   * `getCategories` degrades a failed read to `[]`. An error page must not fail
   * on a second upstream, and an empty list means the read failed rather than
   * that every category is hidden.
   */
  it('keeps every pill when the taxonomy read degrades', async () => {
    getCategories.mockResolvedValue([]);

    expect(await pillHrefs()).toEqual(SEEDED);
  });
});
