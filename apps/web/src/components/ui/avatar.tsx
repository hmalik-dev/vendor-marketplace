import { cn } from '@/lib/utils';

/**
 * Initials fallback in Instrument Serif, alternating between clay and sage by
 * a hash of the name so a list of avatars doesn't read as one colour.
 *
 * See design/design-plan/03-components.md.
 */
const FALLBACK_TONES = ['bg-clay-100 text-clay-600', 'bg-sage-100 text-sage-600'] as const;

/** The five sizes the design calls for, in px. */
export const AVATAR_SIZES = {
  xs: 30,
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
   * The public vendor profile's identity row. Frame `03` reinstates the
   * overlap the previous revision flattened, and sizes the avatar at 82 with
   * the 4px ring drawn *inside* it — hence `box-border` below, so the ring
   * comes out of the 82 rather than adding to it.
   */
  xl: 82,
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

const GLYPH_SIZES: Partial<Record<AvatarSize, number>> = { sm: 13 };

function glyphSize(size: AvatarSize): number {
  return GLYPH_SIZES[size] ?? AVATAR_SIZES[size] * GLYPH_FRACTION;
}

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
 * The two ring treatments the design draws, each matching the ground it sits
 * against so the avatar reads as cut out of it rather than outlined.
 *
 * `card` is the 2px `stone-0` ring on a vendor card's seam; `banner` is the
 * 4px `stone-50` ring where the profile avatar overlaps its banner — the page
 * ground, deliberately not `stone-0`.
 */
const AVATAR_RINGS = {
  card: 'border-2 border-stone-0',
  banner: 'border-4 border-stone-50',
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
  const shared = cn(
    // `box-border` keeps the ring inside the declared size, so an 82px avatar
    // occupies 82px whether or not it is ringed and the overlap stays exact.
    'box-border inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
    ring && AVATAR_RINGS[ring],
    className,
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
        className={cn(shared, 'object-cover')}
        style={{ width: `${pixels}px`, height: `${pixels}px` }}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      data-slot="avatar-fallback"
      className={cn(shared, 'font-display leading-none', FALLBACK_TONES[avatarToneIndex(name)])}
      style={{ width: `${pixels}px`, height: `${pixels}px`, fontSize: `${glyphSize(size)}px` }}
    >
      {initialsFor(name)}
    </span>
  );
}
