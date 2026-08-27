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

export type CategoryIconBadgeProps = CategoryIconProps;

/**
 * The glyph in a `clay-100` circle, per the icon spec — the 28px chip badge.
 *
 * The 36px `card` variant is gone with the landing card that was its only
 * caller: frame `01` now draws a photograph there, and the glyph circle it
 * replaced was the whole of that size's purpose.
 */
export function CategoryIconBadge({ icon, className }: CategoryIconBadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-clay-100 text-clay-600',
        className,
      )}
    >
      <CategoryIcon icon={icon} className="size-3.5" />
    </span>
  );
}
