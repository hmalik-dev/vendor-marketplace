import type { VendorCard } from '@vendor-marketplace/shared';
import { Avatar } from '@/components/ui/avatar';
import { Placeholder } from '@/components/ui/placeholder';

/**
 * The three cards, at the sizes, angles and offsets frame `01` draws them.
 * The shadow deepens with elevation, so the stack reads as three objects on a
 * table rather than three rectangles at three angles.
 */
const CARDS = [
  {
    label: 'florist / tablescape',
    className:
      'top-0 left-5 h-73 w-59 rotate-[-4deg] rounded-2xl shadow-[0_14px_40px_rgba(35,32,28,.16)]',
  },
  {
    label: 'photographer / portrait',
    className:
      'top-17.5 left-47.5 h-79 w-63.5 rotate-[3deg] rounded-2xl shadow-[0_18px_46px_rgba(35,32,28,.2)]',
  },
  {
    label: 'dj / dance floor',
    /*
     * The smallest card is the one the composition can lose: below `lg` the
     * two columns have already stacked and the cluster is doing its work with
     * two cards, where a third would only make the stack taller.
     */
    className:
      'top-52 left-1 hidden h-37.5 w-47 rotate-[2deg] rounded-[14px] shadow-[0_12px_32px_rgba(35,32,28,.14)] lg:flex',
  },
] as const;

export interface PhotoClusterProps {
  /**
   * The vendor the floating chip names. Omitted when nothing is published yet,
   * which takes the chip with it — the chip's whole job is to be a real vendor.
   */
  vendor?: VendorCard;
}

/**
 * The proof that real vendors exist, and what fills the hero's right-hand 44%.
 *
 * It is not decoration — each placeholder is labelled with the shot it is
 * waiting for, so the hero reads as deliberately unfinished until real vendor
 * photography replaces them at launch, rather than as a design choice.
 *
 * See design/design-plan/10-landing.md.
 */
export function PhotoCluster({ vendor }: PhotoClusterProps): React.ReactElement {
  const location = vendor ? [vendor.city, vendor.state].filter(Boolean).join(', ') : '';

  return (
    /*
     * 392px is the frame's height for this column, and it is what sets the
     * hero row's height — the copy column is shorter and sits inside it.
     *
     * The cards are placed in absolute pixels, so below `sm` the stack is
     * scaled rather than reflowed: a 390px screen cannot hold a 444px-wide
     * composition, and squeezing the cards individually would lose the
     * overlaps that make it a cluster instead of three photographs.
     */
    <div className="relative h-98 w-125 shrink-0 max-sm:h-65 max-sm:origin-top max-sm:scale-65">
      {CARDS.map((card) => (
        <Placeholder key={card.label} label={card.label} className={`absolute ${card.className}`} />
      ))}

      {/*
        The chip is the one piece of the cluster that carries meaning, so it
        carries a vendor who actually exists: a name, a rating that came out of
        real reviews, and where they work. An unreviewed vendor shows no
        rating rather than a 0.0 that reads as a bad one.
      */}
      {vendor ? (
        <div className="absolute top-4 left-78 flex items-center gap-2.25 rounded-full bg-stone-0 py-2 pr-3.75 pl-2 shadow-[0_8px_24px_rgba(35,32,28,.14)]">
          <Avatar name={vendor.businessName} src={vendor.profileImageUrl} size="xs" />
          <div>
            <p className="text-xs font-semibold text-stone-900">{vendor.businessName}</p>
            <p className="text-[10.5px] text-stone-600">
              {vendor.reviewCount > 0 ? (
                <>
                  <span aria-hidden="true">★ </span>
                  {vendor.avgRating.toFixed(1)}
                  <span className="sr-only"> out of 5, from {vendor.reviewCount} reviews</span>
                  {location ? ` · ${location}` : ''}
                </>
              ) : location === '' ? (
                'New'
              ) : (
                location
              )}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
