import {
  CATEGORY_SEEDS,
  LANDING_JUMP_CATEGORY_SLUGS,
  type Category,
} from '@vendor-marketplace/shared';

export interface JumpCategory {
  slug: string;
  name: string;
}

/**
 * The ruled jump shortcuts (#419) that the live taxonomy still offers.
 *
 * The four and their order are a design ruling, so they stay a constant; an
 * operator can hide one from the console (VEN-401), and a shortcut to a hidden
 * category opens a search filtered on nothing. An empty `categories` means the
 * taxonomy read degraded rather than that every category is hidden, so the
 * row keeps all four instead of vanishing during an API outage.
 */
export function offeredJumpCategories(categories: readonly Category[]): JumpCategory[] {
  const offered = new Set(categories.map((category) => category.slug));

  return LANDING_JUMP_CATEGORY_SLUGS.filter(
    (slug) => categories.length === 0 || offered.has(slug),
  ).map((slug) => ({
    slug,
    name: CATEGORY_SEEDS.find((seed) => seed.slug === slug)?.name ?? slug,
  }));
}
