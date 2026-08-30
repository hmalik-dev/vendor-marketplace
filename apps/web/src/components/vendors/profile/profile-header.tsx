import type { Tag } from '@vendor-marketplace/shared';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/** How many tag chips are drawn before the rest collapse into "+N more". */
const VISIBLE_TAG_COUNT = 3;

export interface ProfileHeaderProps {
  businessName: string;
  coverImageUrl: string | null;
  profileImageUrl: string | null;
  tagline: string | null;
  avgRating: number;
  reviewCount: number;
  city: string | null;
  state: string | null;
  /** The nearest free date, already formatted, or null when none is known. */
  freeOn: string | null;
  categories: ReadonlyArray<{ id: string; name: string; slug: string }>;
  tags: readonly Tag[];
  /**
   * The rest of the content column, below the header card — the tabs and their
   * pane. It is a slot rather than a sibling because frame `03` runs the
   * booking rail up beside the header card, so the two columns start together.
   */
  children: React.ReactNode;
  /** The booking rail, which the frame stands in the second column. */
  rail: React.ReactNode;
}

/**
 * The identity block of frame `03`: **the vendor's search card, unpacked
 * horizontally.**
 *
 * The full-bleed banner and the avatar overlapping it are gone. They asked for
 * a 21:9 master nobody shoots, and the overlap had already been built twice and
 * broken twice — a negative margin crossing an `overflow: hidden` boundary
 * sliced the avatar's top edge off. `CHANGE-ORDER-2026-08-29.md` retires the
 * composition rather than the third attempt at it, and two of its five rules
 * are structural rather than cosmetic:
 *
 * - **Identity is never on the photograph.** No overlapping avatar, no negative
 *   margin crossing a clipping boundary, at any width. Nothing here is
 *   positioned or pulled; identity and cover are siblings in a flex row, so the
 *   old failure mode is unreachable rather than merely avoided.
 * - **Identity reads before the cover** at every width. 390 is the only width
 *   that stacks, and it stacks identity *above* cover — which is `flex-col` on
 *   the base and `flex-row` from `md`, in that order, not `flex-row-reverse`.
 *
 * One cover file per vendor, 3:2, `object-fit: cover`. It is the same photo the
 * vendor's card carries in search, and it carries **no link and no counter** —
 * every other photograph lives in the Portfolio tab.
 */
export function ProfileHeader({
  businessName,
  coverImageUrl,
  profileImageUrl,
  tagline,
  avgRating,
  reviewCount,
  city,
  state,
  freeOn,
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
      Two rail widths, because two frames draw them: `03 Vendor profile` puts
      380px beside the card at 1440, and `27 Vendor profile — 1024` narrows it
      to 320. Carrying 380 down to 1024 is what `30-responsive.md` means when
      it says 1024 renders the desktop composition rather than a tablet one —
      the composition is the same, the rail is not.
    */
    <div className="grid w-full gap-8 px-4 pt-6 pb-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-x-7 lg:px-10 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        {/*
          The card. `overflow-hidden` is what crops the cover to the rounded
          corner, and it is safe here precisely because nothing inside is
          pulled out of it any more.
        */}
        <div
          data-testid="profile-identity-card"
          /*
            Three floors, because three frames draw them: 200 at 1440 (`03`),
            187 at 1024 (`27`), 179 at 768 (`27 … — 768`). They are floors, not
            heights — real content routinely exceeds them, and the cover
            stretches to whatever the identity column needs.
          */
          className="flex min-h-[179px] flex-col overflow-hidden rounded-[18px] bg-stone-0 shadow-[0_2px_12px_rgba(35,32,28,.07)] md:flex-row lg:min-h-[187px] xl:min-h-[200px]"
        >
          <div className="min-w-0 flex-1 px-6.5 py-5.5">
            <div className="flex items-center gap-3.5">
              <Avatar name={businessName} src={profileImageUrl} size="xl" />
              <div className="min-w-0">
                <h1 className="font-display text-[33px] leading-[1.06] text-stone-900">
                  {businessName}
                </h1>
                <div className="mt-0.75 flex flex-wrap items-center gap-2.25 text-[13px] text-stone-700">
                  <span>
                    {/*
                      The frame's own glyph, not an icon. A filled clay SVG
                      star was a heavier mark than the frame draws and pulled
                      the line off its baseline; `★` is the character the
                      design uses and it inherits the text colour.
                    */}
                    <span aria-hidden="true">★</span>{' '}
                    {reviewCount > 0 ? (
                      <>
                        <strong className="font-bold">{avgRating.toFixed(1)}</strong>{' '}
                        <span className="text-stone-600">
                          ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                        </span>
                      </>
                    ) : (
                      /*
                        A vendor with no reviews shows "New" rather than "0.0",
                        which reads as a bad score rather than an absent one.
                      */
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

            <ul className="mt-3.5 flex flex-wrap gap-1.5">
              {/*
                The sage availability chip leads, exactly as it does on the
                vendor's search card — it is the one chip that persists between
                the two surfaces, and it is what makes this read as the same
                card unpacked rather than a new header.
              */}
              {freeOn ? (
                <li>
                  <span className={cn(CHIP, 'bg-sage-50 text-sage-600')}>Free {freeOn}</span>
                </li>
              ) : null}
              {categories.map((category) => (
                <li key={category.id}>
                  <span className={cn(CHIP, 'bg-clay-100 text-clay-600')}>{category.name}</span>
                </li>
              ))}
              {visibleTags.map((tag) => (
                <li key={tag.id}>
                  <span className={cn(CHIP, 'bg-stone-200 text-stone-700')}>{tag.name}</span>
                </li>
              ))}
              {hiddenTagCount > 0 ? (
                <li>
                  <span className={cn(CHIP, 'bg-stone-200 text-stone-700')}>
                    +{hiddenTagCount} more
                  </span>
                </li>
              ) : null}
            </ul>

            {tagline ? (
              /*
                The vendor's own words, exactly as entered — never truncated and
                never re-cased. The marks are STRAIGHT while the frame draws
                curly: the 2026-08-29 import flipped them in this one string and
                nowhere else, which reads as an artefact of regenerating the
                document rather than a reversal of #115. #306 owns the ruling;
                until it lands, every shipped surface stays straight and the
                guard in `frame-03-parity.test.ts` holds the line.
              */
              <p className="mt-3.75 max-w-[420px] font-display text-[20px] leading-[1.35] text-stone-700 italic">
                &quot;{tagline}&quot;
              </p>
            ) : null}
          </div>

          {/*
            One 3:2 cover, flush to the card's top, right and bottom edges.
            300px at 1440, 280 at 1024, 268 at 768; at 390 the card stacks and
            the cover takes its full width. `aspect-[3/2]` only governs the
            stacked case — from `md` the cover stretches to the card's height,
            which is what "flush" means.
          */}
          <div
            data-testid="profile-cover"
            className="aspect-[3/2] w-full shrink-0 bg-stone-300 md:aspect-auto md:w-[268px] lg:w-[280px] xl:w-[300px]"
          >
            {coverImageUrl ? (
              // The vendor's own photograph on a bucket host `next/image` would
              // need configured per vendor.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverImageUrl} alt="" className="block size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center p-3 text-label font-semibold tracking-label text-stone-600 uppercase">
                cover
              </span>
            )}
          </div>
        </div>

        {/* The frame's 14px between the card and the tab row. */}
        <div className="mt-3.5">{children}</div>
      </div>

      {/*
        Sticky through the whole page, offset by the header so it never slides
        under it. `self-start` is what stops the grid stretching the rail to the
        row height, which would make `sticky` a no-op. `max-h` plus its own
        scroll is what stops a rail taller than the viewport running past the
        bottom of the screen with no way to reach its end.
      */}
      <div className="lg:sticky lg:top-[calc(var(--header-height)+16px)] lg:max-h-[calc(100vh-var(--header-height)-32px)] lg:self-start lg:overflow-y-auto lg:pt-5">
        {rail}
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
