import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { SearchShell } from '@/components/search/search-shell';
import { searchCanonicalPath, selfCanonical } from '@/lib/canonical';
import type { SearchParams } from '@/lib/search-params';
import { getActiveTags, getCategories } from '@/lib/vendor-data';

/** Self-canonical, keeping only the category the sitemap lists (VEN-606). */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  return {
    title: pageTitle('Find a vendor'),
    ...selfCanonical(searchCanonicalPath(await searchParams)),
  };
}

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
 * rendering it would draw an empty grid that reads as a bare marketplace. The
 * 308 is `middleware.ts`'s, so it stays a status under `loading.tsx` (VEN-715).
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.ReactElement> {
  const [categories, tags] = await Promise.all([getCategories(), getActiveTags()]);

  return <SearchShell categories={categories} tags={tags} />;
}
