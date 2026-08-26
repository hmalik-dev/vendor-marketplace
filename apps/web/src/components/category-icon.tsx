import {
  Building2,
  Camera,
  ClipboardList,
  Flower,
  IceCreamCone,
  Music,
  Package,
  Palette,
  Shapes,
  Sparkles,
  Utensils,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The one mapping from a seed's `icon` name to a lucide component.
 *
 * Category identity is visual everywhere in the product — landing card, picker,
 * filter, profile badge — and every one of those surfaces reads this module.
 * A surface that picks an icon inline is a second source of truth.
 */
const CATEGORY_ICONS: Readonly<Record<string, LucideIcon>> = {
  camera: Camera,
  video: Video,
  music: Music,
  'building-2': Building2,
  utensils: Utensils,
  'ice-cream-cone': IceCreamCone,
  sparkles: Sparkles,
  flower: Flower,
  palette: Palette,
  'clipboard-list': ClipboardList,
  package: Package,
};

/**
 * An unknown or absent icon name falls back to a real glyph rather than
 * rendering nothing: a newly seeded category must never leave a hole in a
 * layout, and a bare-text category is a bug wherever it appears.
 */
export function iconComponentFor(icon: string | null | undefined): LucideIcon {
  return (icon && CATEGORY_ICONS[icon]) || Shapes;
}

export interface CategoryIconProps {
  /** The `icon` field from the category seed. */
  icon: string | null | undefined;
  className?: string;
}

/** The bare glyph. Decorative: the category name always travels beside it. */
export function CategoryIcon({ icon, className }: CategoryIconProps): React.ReactElement {
  const Icon = iconComponentFor(icon);

  return <Icon aria-hidden="true" className={cn('size-5', className)} />;
}

export interface CategoryIconBadgeProps extends CategoryIconProps {
  /** `inline` is the 28px chip badge; `card` is the 40px landing-card badge. */
  size?: 'inline' | 'card';
}

/** The glyph in a `primary-100` circle, per the icon spec. */
export function CategoryIconBadge({
  icon,
  size = 'inline',
  className,
}: CategoryIconBadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600',
        size === 'card' ? 'size-10' : 'size-7',
        className,
      )}
    >
      <CategoryIcon icon={icon} className={size === 'card' ? 'size-5' : 'size-3.5'} />
    </span>
  );
}
