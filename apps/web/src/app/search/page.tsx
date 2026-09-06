import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { pageTitle } from '@vendor-marketplace/shared';
import { SearchShell } from '@/components/search/search-shell';
import { successorSearchPath, type SearchParams } from '@/lib/search-params';
import { getActiveTags, getCategories } from '@/lib/vendor-data';

export const metadata: Metadata = { title: pageTitle('Find a vendor') };

/**
 * Discovery is public and unauthenticated — requiring an account to look is how
 * a marketplace stays empty.
 *
 * Categories and tags are reference data, so they are fetched once on the
 * server and handed down; only the result set is re-fetched as filters change.
 *
 * A retired category is answered with a **permanent** redirect rather than a
 * 410 (#419): `/search?category=florals` is a shareable URL, and the vendors it
 * asked for really are somewhere — they moved onto the survivor with the fold.
 * Answering `Gone` would be true of the category and false of the market, and
 * rendering it would draw an empty grid that reads as a bare marketplace.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.ReactElement> {
  const destination = successorSearchPath(await searchParams);

  if (destination !== null) {
    permanentRedirect(destination);
  }

  const [categories, tags] = await Promise.all([getCategories(), getActiveTags()]);

  return <SearchShell categories={categories} tags={tags} />;
}
