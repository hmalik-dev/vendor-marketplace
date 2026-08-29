import type { Tag } from '@vendor-marketplace/shared';
import { Star } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/** How many tag chips are drawn before the rest collapse into "+N more". */
const VISIBLE_TAG_COUNT = 3;

export interface ProfileHeaderProps {
  businessName: string;
  coverImageUrl: string | null;
  profileImageUrl: string | null;
  avgRating: number;
  reviewCount: number;
  city: string | null;
  state: string | null;
  categories: ReadonlyArray<{ id: string; name: string; slug: string }>;
  tags: readonly Tag[];
  /**
   * The rest of the content column, below the chips — the tabs and their pane.
   * It is a slot rather than a sibling because frame `03` runs the booking rail
   * up beside the identity row, so the two columns have to start together,
   * directly under the banner.
   */
  children: React.ReactNode;
  /** The booking rail, which the frame stands in the second column. */
  rail: React.ReactNode;
}

/**
 * The identity block of frame `03`: a full-bleed 196px banner with an 82px
 * avatar overlapping it.
 *
 * **The overlap was flattened once and is now back, built the only way it is
 * safe.** The earlier attempt pulled the avatar up with a negative margin that
 * crossed a pane's `overflow: hidden` boundary, and the browser sliced its top
 * edge off. What makes this version safe is that the banner and the identity
 * row live inside **one positioned wrapper that does not clip**, and the row is
 * lifted out of the banner with `position: relative` and `z-index`. Those
 * declarations are load-bearing: drop either and the old defect returns.
 */
export function ProfileHeader({
  businessName,
  coverImageUrl,
  profileImageUrl,
  avgRating,
  reviewCount,
  city,
  state,
  categories,
  tags,
  children,
  rail,
}: ProfileHeaderProps): React.ReactElement {
  const location = [city, state].filter(Boolean).join(', ');
  const visibleTags = tags.slice(0, VISIBLE_TAG_COUNT);
  const hiddenTagCount = tags.length - visibleTags.length;

  return (
    /*
      The one wrapper the overlap depends on. It holds both the banner and the
      identity row and never clips, so the row's negative margin cannot cross a
      boundary that would slice the avatar.
    */
    <div className="relative overflow-visible">
      {/*
        `box-sizing: border-box` on a fixed 196px so any border or padding a
        later change adds is taken out of the height rather than added to it —
        the acceptance criterion the sliced-avatar bug produced.
      */}
      <div
        data-testid="profile-cover"
        className="relative z-0 box-border flex h-[196px] w-full shrink-0 items-end bg-stone-200"
        style={
          coverImageUrl
            ? {
                backgroundImage: `url(${JSON.stringify(coverImageUrl)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        {coverImageUrl ? null : (
          <span className="p-3 text-label font-semibold tracking-label text-stone-600 uppercase">
            cover · full-bleed banner
          </span>
        )}
      </div>

      {/*
        Frame `03` puts the rail's top edge 20px below the banner, level with
        the identity block rather than below it, so the row that carries both
        columns opens here — immediately under the banner — and the tabs and
        the rail are slotted into it. Laying the identity block out first and
        the rail out afterwards is what dropped the rail 102.8px too low.

        The row stays INSIDE the non-clipping wrapper above, so the identity
        row's negative margin still cannot cross a boundary that would slice
        the avatar.
      */}
      <div className="grid w-full gap-8 overflow-visible px-4 pb-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-7 lg:px-10">
        {/*
          The frame's content column carries `padding-top: 18px`, and it is
          that padding the identity row's `-34px` is pulled against — net, the
          avatar overlaps the banner by 16px, not 34. Shipping the negative
          margin without the padding is what buried the avatar in the cover and
          pushed the business name 11px inside the photograph.
        */}
        <div className="min-w-0 overflow-visible pt-[18px]">
          {/*
          Lifted out of the banner. `relative` and `z-index` are what put the
          avatar over the banner rather than under it — without them the
          negative margin only moves the row, and the banner paints on top.
        */}
          <div
            data-testid="profile-identity"
            className="relative z-[2] -mt-[34px] flex items-start gap-4 pb-3.5"
          >
            <Avatar
              name={businessName}
              src={profileImageUrl}
              size="xl"
              ring="banner"
              className="shadow-[0_4px_14px_rgba(35,32,28,.10)]"
            />
            <div className="mt-[23px] min-w-0">
              <h1 className="font-display text-[33px] leading-[1.1] text-stone-900">
                {businessName}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[13px] text-stone-700">
                <span className="flex items-center gap-1">
                  <Star aria-hidden="true" className="size-3.5 fill-clay-400 text-clay-400" />
                  {/*
                A vendor with no reviews shows "New" rather than "0.0", which
                reads as a bad score rather than an absent one.
              */}
                  {reviewCount > 0 ? (
                    <>
                      <strong className="font-bold">{avgRating.toFixed(1)}</strong>
                      <span className="text-stone-600">
                        ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                      </span>
                    </>
                  ) : (
                    <span className="text-stone-600">New — no reviews yet</span>
                  )}
                </span>
                {location ? (
                  <>
                    <span aria-hidden="true" className="text-stone-600">
                      ·
                    </span>
                    <span>{location}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <ul className="flex flex-wrap gap-1.5 pb-3">
            {categories.map((category) => (
              <li key={category.id}>
                <span className={cn(CHIP, 'bg-clay-100 text-clay-600')}>{category.name}</span>
              </li>
            ))}
            {visibleTags.map((tag) => (
              <li key={tag.id}>
                <span className={cn(CHIP, 'bg-steel-50 text-steel-600')}>{tag.name}</span>
              </li>
            ))}
            {hiddenTagCount > 0 ? (
              <li>
                <span className={cn(CHIP, 'bg-stone-150 text-stone-700')}>
                  +{hiddenTagCount} more
                </span>
              </li>
            ) : null}
          </ul>

          {children}
        </div>

        {/*
          Sticky through the whole page, offset by the header so it never slides
          under it. `self-start` is what stops the grid stretching the rail to
          the row height, which would make `sticky` a no-op. The 20px top
          padding is the frame's gap between the banner and the rail card.
        */}
        <div className="lg:sticky lg:top-[calc(var(--header-height)+16px)] lg:self-start lg:pt-5">
          {rail}
        </div>
      </div>
    </div>
  );
}

/*
 * `rounded-sm` is 6px, and its theme comment names this exact use — "badges,
 * category chips, small pills". The chips shipped on the 8px table-control
 * step instead, which is 2px rounder than frame `03` draws them.
 */
const CHIP = 'inline-block rounded-sm px-2.5 py-1.25 text-helper font-semibold';
