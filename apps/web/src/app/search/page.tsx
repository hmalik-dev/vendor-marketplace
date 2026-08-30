import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { SearchShell } from '@/components/search/search-shell';
import { getActiveTags, getCategories, getVendorCities } from '@/lib/vendor-data';

export const metadata: Metadata = { title: pageTitle('Find a vendor') };

/**
 * Discovery is public and unauthenticated — requiring an account to look is how
 * a marketplace stays empty.
 *
 * Categories and tags are reference data, so they are fetched once on the
 * server and handed down; only the result set is re-fetched as filters change.
 */
export default async function SearchPage(): Promise<React.ReactElement> {
  const [categories, cities, tags] = await Promise.all([
    getCategories(),
    getVendorCities(),
    getActiveTags(),
  ]);

  return <SearchShell categories={categories} cities={cities} tags={tags} />;
}
