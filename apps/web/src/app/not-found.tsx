import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORY_SEEDS, LANDING_CATEGORY_COUNT, pageTitle } from '@vendor-marketplace/shared';
import { BrokenMark } from '@/components/brand/broken-mark';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: pageTitle('Page not found') };

/**
 * Frame `15`. The marketing shell stays — the root layout draws the header and
 * footer, so the visitor is still inside the product rather than on a bare
 * browser error page.
 *
 * The recovery is *category links*, not "go home". A 404 on a marketplace is
 * almost always a stale vendor URL, and the fastest route back to what the
 * visitor wanted is the kind of vendor they were looking for.
 */
export default function NotFound(): React.ReactElement {
  const categories = CATEGORY_SEEDS.slice(0, LANDING_CATEGORY_COUNT);

  return (
    <div className="mx-auto flex min-h-[620px] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <BrokenMark className="mb-6.5" />

      <p className="font-mono text-label font-medium tracking-[.16em] text-stone-600 uppercase">
        404 · Not found
      </p>

      <h1 className="mt-3 font-display text-display-lg tracking-[-.015em] text-stone-900">
        This page isn&rsquo;t here
      </h1>

      {/*
        Three jobs, one sentence: what happened, why it is not alarming, and
        that the visitor's account is untouched — `40-states.md` §1.
      */}
      <p className="mt-3 max-w-[440px] text-sm leading-[1.65] text-stone-700">
        The link may be old, or a vendor may have taken their listing down. Nothing is wrong with
        your account.
      </p>

      <div className="mt-6.5 flex flex-wrap justify-center gap-3">
        <Button asChild variant="primary">
          <Link href="/search">Browse vendors</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Back to home</Link>
        </Button>
      </div>

      <div className="mt-10 w-full max-w-[620px] border-t border-stone-300 pt-5.5">
        <p className="text-label font-semibold tracking-label text-stone-600 uppercase">
          Or start with a category
        </p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/search?category=${category.slug}`}
                className="inline-block rounded-full border border-clay-200 bg-clay-50 px-3.5 py-1.75 text-[12.5px] font-medium text-clay-500 transition-colors duration-(--duration-fast) hover:bg-clay-100"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
