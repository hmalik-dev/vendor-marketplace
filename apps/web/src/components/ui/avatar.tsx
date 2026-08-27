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
  sm: 34,
  md: 38,
  lg: 64,
  xl: 80,
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

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

export interface AvatarProps {
  /** The person or business the avatar stands for. Drives initials and tone. */
  name: string;
  src?: string | null;
  size?: AvatarSize;
  /** 2px stone-0 border, for an avatar overlapping imagery. */
  bordered?: boolean;
  className?: string;
}

export function Avatar({
  name,
  src,
  size = 'sm',
  bordered = false,
  className,
}: AvatarProps): React.ReactElement {
  const pixels = AVATAR_SIZES[size];
  const shared = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
    bordered && 'border-2 border-stone-0',
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
      style={{ width: `${pixels}px`, height: `${pixels}px`, fontSize: `${pixels * 0.42}px` }}
    >
      {initialsFor(name)}
    </span>
  );
}
