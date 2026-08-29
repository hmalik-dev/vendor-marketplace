import Link from 'next/link';
import { formatPrice, type VendorCard as VendorCardData } from '@vendor-marketplace/shared';
import { Avatar } from '@/components/ui/avatar';
import { Placeholder } from '@/components/ui/placeholder';
import { cn } from '@/lib/utils';

/**
 * A vendor as a complete decision unit: photo, name, rating, location,
 * availability and a from-price. Anything a customer would otherwise open the
 * profile to learn belongs on the card instead.
 *
 * See design/design-plan/03-components.md.
 */
export interface VendorCardProps {
  vendor: VendorCardData;
  /** The searched date, when there was one — it drives the availability chip. */
  searchedDate?: string;
  /**
   * `compact` is the search grid, where four cards across and two full rows
   * have to fit above the fold; `featured` is the roomier landing variant.
   * See design/design-plan/03-components.md.
   */
  density?: 'compact' | 'featured';
  /**
   * A day this vendor **is** free, shown as the sage chip.
   *
   * The search grid derives this from the searched date, because a vendor that
   * survived a dated query is free on it. The nearby-dates band passes the
   * vendor's nearest free day instead, which is the whole point of that band:
   * the card is saying "not then, but this".
   */
  freeOnDate?: string;
  className?: string;
}

/*
 * The compact card abbreviates the month so the chip never wraps at a quarter
 * of the grid width; the featured card has the room to spell it out.
 */
const DATE_CHIP_FORMATTERS = {
  featured: new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }),
  compact: new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }),
} as const;

export function VendorCard({
  vendor,
  searchedDate,
  density = 'featured',
  freeOnDate,
  className,
}: VendorCardProps): React.ReactElement {
  const location = [vendor.city, vendor.state].filter(Boolean).join(', ');
  const isReviewed = vendor.reviewCount > 0;
  const isCompact = density === 'compact';
  // An explicit free day wins: the caller knows something the card cannot
  // work out, which is that this vendor is being offered *instead* of a date.
  const freeDate = freeOnDate ?? (vendor.availableOnDate && searchedDate ? searchedDate : null);

  return (
    <article
      className={cn(
        /*
          16px, which is what `.card` computes to in frame `02 Search` and in
          the fourteen other places the frames draw a card. Not `rounded-2xl`:
          that token is 18px, which the frames do use — on modals, panels and
          three overridden cards — so the token is right and the vendor card
          was simply reaching for the wrong step. There is no 16px step to
          reach for instead, and inventing one would repoint every
          `rounded-2xl` in the product.
        */
        'group/card overflow-hidden rounded-[16px] bg-stone-0 shadow-sm transition-[box-shadow,transform] duration-(--duration-base)',
        'hover:shadow-hover motion-safe:hover:-translate-y-0.5',
        className,
      )}
    >
      <Link href={`/vendors/${vendor.slug}`} className="block">
        {/*
          A ratio, never a fixed height. A fixed height against a fluid card
          width crops the same vendor's photo differently at every breakpoint,
          which is a cover nobody can design against; 3:2 is also the native
          ratio of essentially every camera, so an uploaded portfolio image
          needs no re-crop. The height follows the column — near 207px at both
          four columns (1440) and three (1024).

          The featured card drops its cover between `sm` and `lg`, where the
          landing grid is two columns wide — `design/design-plan/30-responsive.md`.
          At that width the cover is around 260px tall, so four cards become two
          tall rows of photography stacked under the search, which reads as the
          page's subject rather than as a supporting row. The compact search
          card is unaffected: its grid is one column at those widths.

          This is the vendor cards only. The landing category cards keep their
          photographs at every width — their image *is* the content, and it is
          94px rather than a ratio.
        */}
        <div
          className={cn(
            'relative aspect-[3/2] overflow-hidden',
            isCompact ? null : 'sm:max-lg:hidden',
          )}
        >
          {vendor.coverImageUrl ? (
            // A vendor's own photograph, from a bucket next/image is not
            // configured per-host for.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vendor.coverImageUrl}
              alt=""
              className="size-full object-cover transition-transform duration-(--duration-slow) motion-safe:group-hover/card:scale-[1.03]"
            />
          ) : (
            <Placeholder
              label="cover 3:2"
              className="size-full transition-transform duration-(--duration-slow) motion-safe:group-hover/card:scale-[1.03]"
            />
          )}
        </div>

        <div className={cn('relative', isCompact ? 'px-3.5 pt-3 pb-3.5' : 'px-4 pt-3.5 pb-4')}>
          {/*
            Overlaps the seam by half its height, as the frame draws it — and
            returns to the flow where there is no seam to overlap, so a
            coverless card does not hang its avatar off its own top edge.
          */}
          <div
            className={cn(
              'absolute',
              isCompact ? '-top-4 left-3.5' : '-top-[17px] left-4 sm:max-lg:static',
            )}
          >
            <Avatar name={vendor.businessName} src={vendor.profileImageUrl} size="sm" ring="card" />
          </div>

          <h3
            className={cn(
              'font-display text-stone-900',
              isCompact ? 'mt-2.75 text-[19px]' : 'mt-3 text-display-sm',
            )}
          >
            {vendor.businessName}
          </h3>

          {/*
            Card meta is 12px at both densities: the frames draw it there on the
            `02` search grid and on `04`'s rail card alike. The 12.5px in `14
            Adaptations` is the tablet and mobile size, not the desktop one.
          */}
          <p className="mt-0.5 text-meta text-stone-600">
            {isReviewed ? (
              <>
                <span aria-hidden="true">★ </span>
                <span className="font-semibold text-stone-700">{vendor.avgRating.toFixed(1)}</span>
                <span className="sr-only"> out of 5, from {vendor.reviewCount} reviews</span> (
                {vendor.reviewCount}){location ? ` · ${location}` : ''}
              </>
            ) : (
              // No invented numbers: an unreviewed vendor shows no rating at
              // all rather than a 0.0 that reads as a bad one.
              <>New{location ? ` · ${location}` : ''}</>
            )}
          </p>

          <div className={cn('flex flex-wrap', isCompact ? 'mt-2 gap-1.25' : 'mt-2.5 gap-1.5')}>
            {/*
              The compact card carries the availability chip alone. The search
              grid has already been filtered to one vendor type, so a category
              chip on every card restates the query instead of telling the
              customer something — see design/design-plan/03-components.md.
            */}
            {isCompact
              ? null
              : vendor.categories.slice(0, 1).map((category) => (
                  <span
                    key={category.id}
                    className="rounded-md bg-stone-150 px-2.5 py-1 text-xs font-semibold text-stone-700"
                  >
                    {category.name}
                  </span>
                ))}
            {freeDate ? (
              <span
                className={cn(
                  'font-semibold bg-sage-50 text-sage-600',
                  isCompact
                    ? 'rounded-[5px] px-2 py-0.75 text-label'
                    : 'rounded-md px-2.5 py-1 text-xs',
                )}
              >
                {/* Parsed as UTC: a `DATE` must never shift by a local offset. */}
                Free {DATE_CHIP_FORMATTERS[density].format(new Date(`${freeDate}T00:00:00Z`))}
              </span>
            ) : null}
          </div>

          <div
            className={cn(
              'flex items-baseline justify-between border-t border-stone-200',
              isCompact ? 'mt-2.5 pt-2.25' : 'mt-3 pt-2.75',
            )}
          >
            {vendor.startingPriceCents === null ? (
              <span className="text-meta text-stone-600">Contact for pricing</span>
            ) : (
              <>
                <span className="text-meta text-stone-600">From</span>
                <span
                  className={cn(
                    'font-bold text-stone-900',
                    isCompact ? 'text-[17px]' : 'text-[18px]',
                  )}
                >
                  {formatPrice(vendor.startingPriceCents)}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
