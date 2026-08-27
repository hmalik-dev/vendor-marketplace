import type { TagCategory } from '@vendor-marketplace/shared';

/** Section heading for each tag category in the picker and on the profile. */
export const TAG_CATEGORY_LABELS: Record<TagCategory, string> = {
  language: 'Languages spoken',
  cultural: 'Cultural specialties',
  dietary: 'Dietary',
};

/**
 * The same three groups as chips in the search Refine bar, where the row has to
 * fit six controls plus Sort across 1440px. Frame `02` draws them as
 * `Languages ▾` / `Cultural ▾` / `Dietary ▾` — the noun alone, since the chip's
 * position in a filter bar already says it is a filter.
 */
export const TAG_CATEGORY_CHIP_LABELS: Record<TagCategory, string> = {
  language: 'Languages',
  cultural: 'Cultural',
  dietary: 'Dietary',
};

/** The prompt under each section's selector, per design/design-plan/03-components.md. */
export const TAG_CATEGORY_HINTS: Record<TagCategory, string> = {
  language: 'Languages you can work in.',
  cultural: 'Traditions and celebrations you know well.',
  dietary: 'Dietary requirements you can cater to.',
};

/**
 * Pill colours per category, so a customer can tell the three groups apart at
 * a glance on a vendor profile.
 */
export const TAG_PILL_CLASSES: Record<TagCategory, string> = {
  language: 'bg-info-light text-info',
  cultural: 'bg-clay-100 text-clay-600',
  dietary: 'bg-sage-50 text-sage-600',
};

/** Reads naturally in "Suggest a language" / "Suggest a dietary requirement". */
export const TAG_CATEGORY_NOUN: Record<TagCategory, string> = {
  language: 'language',
  cultural: 'cultural specialty',
  dietary: 'dietary requirement',
};
