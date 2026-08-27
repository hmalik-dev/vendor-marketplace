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
  className,
}: VendorCardProps): React.ReactElement {
  const location = [vendor.city, vendor.state].filter(Boolean).join(', ');
  const isReviewed = vendor.reviewCount > 0;
  const isCompact = density === 'compact';

  return (
    <article
      className={cn(
        'group/card overflow-hidden rounded-2xl bg-stone-0 shadow-sm transition-[box-shadow,transform] duration-(--duration-base)',
        'hover:shadow-hover motion-safe:hover:-translate-y-0.5',
        className,
      )}
    >
      <Link href={`/vendors/${vendor.slug}`} className="block">
        <div className={cn('relative overflow-hidden', isCompact ? 'h-33' : 'aspect-[4/3]')}>
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
              label="cover 4:3"
              className="size-full transition-transform duration-(--duration-slow) motion-safe:group-hover/card:scale-[1.03]"
            />
          )}
        </div>

        <div className={cn('relative', isCompact ? 'px-3.5 pt-3 pb-3.5' : 'px-4 pt-3.5 pb-4')}>
          {/* Overlaps the seam by half its height, as the frame draws it. */}
          <div className={cn('absolute', isCompact ? '-top-4 left-3.5' : '-top-[17px] left-4')}>
            <Avatar name={vendor.businessName} src={vendor.profileImageUrl} size="sm" bordered />
          </div>

          <h3
            className={cn(
              'font-display text-stone-900',
              isCompact ? 'mt-2.75 text-[19px]' : 'mt-3 text-display-sm',
            )}
          >
            {vendor.businessName}
          </h3>

          <p className={cn('mt-0.5 text-stone-600', isCompact ? 'text-xs' : 'text-sm')}>
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
            {vendor.availableOnDate && searchedDate ? (
              <span
                className={cn(
                  'font-semibold bg-sage-50 text-sage-600',
                  isCompact
                    ? 'rounded-[5px] px-2 py-0.75 text-[10.5px]'
                    : 'rounded-md px-2.5 py-1 text-xs',
                )}
              >
                Free {DATE_CHIP_FORMATTERS[density].format(new Date(`${searchedDate}T00:00:00Z`))}
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
              <span className={cn('text-stone-600', isCompact ? 'text-xs' : 'text-sm')}>
                Contact for pricing
              </span>
            ) : (
              <>
                <span className={cn('text-stone-600', isCompact ? 'text-xs' : 'text-sm')}>
                  From
                </span>
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
