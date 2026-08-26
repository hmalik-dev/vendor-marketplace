import Link from 'next/link';
import { CATEGORY_SEEDS, LANDING_CATEGORY_COUNT } from '@vendorhub/shared';
import { CategoryIconBadge } from '@/components/category-icon';
import { Button } from '@/components/ui/button';
import { redirectVendorToDashboard } from '@/lib/current-user';

/**
 * The landing grid is a taste of the taxonomy, not the whole of it. These cards
 * are inert until search lands (#6) — eleven unclickable cards would be bloat,
 * so the highest-intent categories carry the section and the rest live behind
 * the search filters.
 */
const FEATURED_CATEGORIES = CATEGORY_SEEDS.slice(0, LANDING_CATEGORY_COUNT);

export default async function HomePage(): Promise<React.ReactElement> {
  await redirectVendorToDashboard();

  return (
    <>
      {/* Full-bleed so the hero gradient runs edge to edge behind the headline. */}
      <section className="hero-gradient border-b border-stone-150">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <p className="text-sm font-medium tracking-wide text-primary-600 uppercase">
            Event services marketplace
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold text-balance text-stone-800 sm:text-5xl">
            Book the photographer, the DJ, and the caterer without the back-and-forth.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-stone-600">
            Compare real availability and pricing from vendors near you, send one request, and pay
            securely once the date is locked in.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="cta" size="cta" asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
            <Button variant="outline" size="cta" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <section aria-labelledby="categories-heading" className="py-14 sm:py-16">
          <h2
            id="categories-heading"
            className="font-display text-2xl font-semibold text-stone-800"
          >
            Browse by category
          </h2>

          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_CATEGORIES.map((category) => (
              <li
                key={category.slug}
                className="flex items-start gap-4 rounded-xl border border-stone-150 bg-card p-5 shadow-sm transition-shadow duration-[--duration-base] hover:shadow-md"
              >
                <CategoryIconBadge icon={category.icon} size="card" />
                <div>
                  <h3 className="font-display text-lg font-semibold text-stone-800">
                    {category.name}
                  </h3>
                  <p className="mt-1 text-sm text-stone-600">{category.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
