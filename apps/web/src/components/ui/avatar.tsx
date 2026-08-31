import { cn } from '@/lib/utils';

/**
 * Initials fallback in Instrument Serif, alternating between clay and sage by
 * a hash of the name so a list of avatars doesn't read as one colour.
 *
 * See design/design-plan/03-components.md.
 */
/**
 * The two monogram tones, paired with `avatarToneIndex` so one person keeps one
 * colour wherever they appear.
 *
 * Exported because the bookings card draws the same monogram in a 9px squircle
 * rather than a circle, so it cannot use `Avatar` itself but must not invent a
 * second palette.
 */
export const FALLBACK_TONES = ['bg-clay-150 text-clay-600', 'bg-sage-100 text-sage-600'] as const;

/** The six sizes the design calls for, in px. */
export const AVATAR_SIZES = {
  xs: 30,
  /*
   * The bookings rail's `Recent messages` rows, frame `07`: a plain 32px circle
   * with no ring, so unlike `sm` the number is the fill. Two pixels off `xs` and
   * four off `sm`, which is why it is its own step rather than either of them —
   * the rows sit against a 1px rule and the seam is visible at that width.
   */
  row: 32,
  /*
   * The vendor card's monogram. Frame `02 Search` draws a 32px circle with a
   * 2px ring *outside* it, and the frames are content-box, so it occupies 36.
   * `box-border` below takes the ring out of the number instead, which is why
   * this is 36 rather than 32: 36 less two 2px edges is the frame's 32px fill,
   * in the frame's 36px footprint. At 34 the fill was 30 and the whole card
   * seam sat 2px out.
   */
  sm: 36,
  md: 38,
  lg: 64,
  /*
   * The public vendor profile's identity row. Frame `03` drew this at 82 while
   * the avatar overlapped a full-bleed banner; the 2026-08-29 cover rework
   * retires that header outright and draws a plain 60px circle sitting inside
   * the identity card, on the card's own ground. There is no ring, because
   * there is no longer any imagery for it to be cut out of.
   */
  xl: 60,
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

/**
 * Initials are sized as a fraction of the circle, except where a frame draws
 * them otherwise.
 *
 * Frame `02 Search` sets the card monogram at 13px against a 32px fill, which
 * is not the fraction the other sizes use — the same frame puts 14px on the
 * 32px header avatar, so the design does not hold one ratio across contexts.
 * The fraction stays the default for the sizes no ticket has measured yet.
 */
const GLYPH_FRACTION = 0.42;

const GLYPH_SIZES: Partial<Record<AvatarSize, number>> = {
  /*
   * Frame `13 Admin` sets `font-size:13px` on the header's 30px circle. The
   * fraction would give 12.6, and the console's is the only `xs` any frame
   * measures — so it is pinned rather than left to round.
   */
  xs: 13,
  sm: 13,
  /*
   * Frame `07`'s message rows set `font-size:13px` on a 32px circle. The
   * fraction would give 13.44, which rounds up in some engines and down in
   * others — the same half-pixel disagreement `sm` is pinned for.
   */
  row: 13,
  /*
   * Frame `03` sets the identity monogram at 23px in a 60px circle — 0.38,
   * not the 0.42 the default fraction would give, which would render 25.2.
   */
  xl: 23,
};

function glyphSize(size: AvatarSize): number {
  return GLYPH_SIZES[size] ?? AVATAR_SIZES[size] * GLYPH_FRACTION;
}

/**
 * The smallest size Instrument Serif may be set at, from `01-foundations.md`.
 *
 * Exported for `avatar.test.tsx`, which renders all six sizes and asserts the
 * face against this number rather than against one written down twice.
 *
 * `display-type.test.ts` declares its own `SERIF_FLOOR_PX` for the class-based
 * scan and does **not** import this one — the two are the same value by
 * agreement, not by linkage. Said plainly because the previous wording claimed
 * a linkage that does not exist, and a false claim about a guard is worse than
 * no claim.
 */
export const SERIF_FLOOR_PX = 16;

/**
 * A stable, order-independent hash. Deliberately not `Math.random` or an array
 * index: the same person must keep the same colour between renders and between
 * the list and the detail view.
 */
export function avatarToneIndex(seed: string): number {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 1_000_003;
  }

  return hash % FALLBACK_TONES.length;
}

/** Up to two initials, from the first and last word of a name. */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return '?';
  }

  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';

  return `${first}${last}`.toUpperCase();
}

/**
 * The ring treatment the design draws, matching the ground it sits against so
 * the avatar reads as cut out of it rather than outlined.
 *
 * `card` is the 2px `stone-0` ring on a vendor card's seam. There was a second,
 * `banner`, for the profile avatar that overlapped its cover; the 2026-08-29
 * cover rework forbids identity on the photograph at any width, so the
 * treatment is deleted rather than left available. A ring for overlapping
 * imagery is only reachable by overlapping imagery.
 */
const AVATAR_RINGS = {
  card: 'border-2 border-stone-0',
} as const;

export type AvatarRing = keyof typeof AVATAR_RINGS;

export interface AvatarProps {
  /** The person or business the avatar stands for. Drives initials and tone. */
  name: string;
  src?: string | null;
  size?: AvatarSize;
  /** A ring matching the ground behind it, for an avatar overlapping imagery. */
  ring?: AvatarRing;
  className?: string;
}

export function Avatar({
  name,
  src,
  size = 'sm',
  ring,
  className,
}: AvatarProps): React.ReactElement {
  const pixels = AVATAR_SIZES[size];
  /*
   * `className` is deliberately **not** folded in here.
   *
   * `cn` is tailwind-merge: the later of two conflicting classes wins. Folding
   * the caller's `className` into `shared` and then appending
   * `FALLBACK_TONES[...]` in the fallback branch below put the tone last, so a
   * caller's `bg-*`/`text-*` override vanished from the rendered class list
   * entirely. Frame `13`'s inverted header avatar came out clay-on-cream — the
   * brightest element on a near-black bar — with no warning anywhere.
   *
   * Every branch now appends `className` last, which is what makes an override
   * an override.
   */
  const shared = cn(
    // `box-border` keeps the ring inside the declared size, so an avatar
    // occupies its declared width whether or not it is ringed.
    'box-border inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
    ring && AVATAR_RINGS[ring],
  );

  if (src) {
    return (
      // A vendor's own photograph, already sized by the caller — `next/image`
      // would need a configured remote host per vendor bucket.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={pixels}
        height={pixels}
        className={cn(shared, 'object-cover', className)}
        style={{ width: `${pixels}px`, height: `${pixels}px` }}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      data-slot="avatar-fallback"
      className={cn(
        shared,
        /*
         * The serif floor, applied where the guard could not see it.
         *
         * `01-foundations.md` states "Never below 16px" as a rule of the type
         * system, and `display-type.test.ts` enforces it across the whole tree
         * — except here, where the size comes from a numeric prop through
         * `style` and no class states it. That exemption was a readability
         * limitation of the guard, never a licence: four of the six sizes
         * (`xs` 13, `row` 13, `sm` 13, `md` 15.96) were setting Instrument
         * Serif below the floor.
         *
         * The frames genuinely draw `font-family:'Instrument Serif'` at 13px
         * and 14px on these circles, so this is frame-versus-law and the law
         * wins — recorded as D24. The alternative was raising the glyph to
         * 16px, which changes the monogram's ratio in four frames and breaks
         * their geometry; changing the face keeps every measured size and
         * every circle, and deviates on the Font axis alone, at the one size
         * range where the serif's own foundry says it should not be set.
         */
        glyphSize(size) >= SERIF_FLOOR_PX ? 'font-display' : 'font-sans',
        'leading-none',
        FALLBACK_TONES[avatarToneIndex(name)],
        className,
      )}
      style={{ width: `${pixels}px`, height: `${pixels}px`, fontSize: `${glyphSize(size)}px` }}
    >
      {initialsFor(name)}
    </span>
  );
}
