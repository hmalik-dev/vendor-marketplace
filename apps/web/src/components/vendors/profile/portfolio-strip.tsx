import Link from 'next/link';
import type { WirePortfolioItem } from '@/lib/wire-schemas';

/** How many pieces the About tab previews before "See all". */
const STRIP_COUNT = 4;

export interface PortfolioStripProps {
  /*
   * The wire shape, whose `imageUrl` is already resolved from a stored object
   * key — and is `null` when no image base is configured, which renders as no
   * image rather than as a broken one.
   */
  items: readonly WirePortfolioItem[];
  seeAllHref: string;
}

/**
 * The four-up recent-work strip on the About tab. Absent entirely when the
 * vendor has uploaded nothing — an empty state here would be the third one on a
 * page that already has a Portfolio tab to say it.
 */
export function PortfolioStrip({
  items,
  seeAllHref,
}: PortfolioStripProps): React.ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  const shown = items.slice(0, STRIP_COUNT);

  return (
    <section className="mt-5.5 max-w-[680px]">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="display-heading text-[20px] text-stone-900">Recent work</h2>
        {items.length > STRIP_COUNT ? (
          <Link
            href={seeAllHref}
            className="text-[12.5px] font-semibold text-clay-500 hover:underline"
          >
            See all {items.length} →
          </Link>
        ) : null}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {shown.map((item) => (
          <li key={item.id}>
            {/* A vendor's own upload: the bucket host changes per environment,
                so this deliberately skips `next/image` as `Avatar` does. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.thumbnailUrl ?? item.imageUrl ?? ''}
              alt={item.caption ?? ''}
              className="h-[118px] w-full rounded-xl bg-stone-200 object-cover"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
