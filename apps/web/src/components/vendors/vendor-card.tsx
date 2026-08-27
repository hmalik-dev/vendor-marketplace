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
  className?: string;
}

const DATE_CHIP_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export function VendorCard({
  vendor,
  searchedDate,
  className,
}: VendorCardProps): React.ReactElement {
  const location = [vendor.city, vendor.state].filter(Boolean).join(', ');
  const isReviewed = vendor.reviewCount > 0;

  return (
    <article
      className={cn(
        'group/card overflow-hidden rounded-2xl bg-stone-0 shadow-sm transition-[box-shadow,transform] duration-(--duration-base)',
        'hover:shadow-hover motion-safe:hover:-translate-y-0.5',
        className,
      )}
    >
      <Link href={`/vendors/${vendor.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden">
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

        <div className="relative px-4 pt-3.5 pb-4">
          {/* Overlaps the seam by half its height, as the frame draws it. */}
          <div className="absolute -top-[17px] left-4">
            <Avatar name={vendor.businessName} src={vendor.profileImageUrl} size="sm" bordered />
          </div>

          <h3 className="mt-3 font-display text-display-sm text-stone-900">
            {vendor.businessName}
          </h3>

          <p className="mt-0.5 text-sm text-stone-600">
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

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {vendor.categories.slice(0, 1).map((category) => (
              <span
                key={category.id}
                className="rounded-md bg-stone-150 px-2.5 py-1 text-xs font-semibold text-stone-700"
              >
                {category.name}
              </span>
            ))}
            {vendor.availableOnDate && searchedDate ? (
              <span className="rounded-md bg-sage-50 px-2.5 py-1 text-xs font-semibold text-sage-600">
                Free {DATE_CHIP_FORMATTER.format(new Date(`${searchedDate}T00:00:00Z`))}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex items-baseline justify-between border-t border-stone-200 pt-2.75">
            {vendor.startingPriceCents === null ? (
              <span className="text-sm text-stone-600">Contact for pricing</span>
            ) : (
              <>
                <span className="text-sm text-stone-600">From</span>
                <span className="text-[18px] font-bold text-stone-900">
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
