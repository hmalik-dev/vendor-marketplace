import Link from 'next/link';
import { CATEGORY_SEEDS } from '@vendorhub/shared';
import { Button } from '@/components/ui/button';

/** The first six categories carry the landing page until search arrives (#6). */
const FEATURED_CATEGORIES = CATEGORY_SEEDS.slice(0, 6);

export default function HomePage(): React.ReactElement {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="py-16 sm:py-24">
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
      </section>

      <section aria-labelledby="categories-heading" className="pb-8">
        <h2 id="categories-heading" className="font-display text-2xl font-semibold text-stone-800">
          What are you looking for?
        </h2>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED_CATEGORIES.map((category) => (
            <li
              key={category.slug}
              className="rounded-lg border border-stone-150 bg-card p-5 shadow-sm"
            >
              <h3 className="font-display text-lg font-semibold text-stone-800">{category.name}</h3>
              <p className="mt-2 text-sm text-stone-600">{category.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
