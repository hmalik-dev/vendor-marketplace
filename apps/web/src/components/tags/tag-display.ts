import type { TagCategory } from '@vendor-marketplace/shared';

/** Section heading for each tag category in the picker and on the profile. */
export const TAG_CATEGORY_LABELS: Record<TagCategory, string> = {
  style: 'How you work',
  language: 'Languages spoken',
  cultural: 'Cultural specialties',
  dietary: 'Dietary',
};

/**
 * The four groups as chips in the search Refine bar, where the row has to fit
 * six controls plus Sort across 1440px. Frame `02` draws them as `Style ▾` /
 * `Languages ▾` / `Cultural ▾` / `Dietary ▾` — the noun alone, since the chip's
 * position in a filter bar already says it is a filter.
 */
export const TAG_CATEGORY_CHIP_LABELS: Record<TagCategory, string> = {
  style: 'Style',
  language: 'Languages',
  cultural: 'Cultural',
  dietary: 'Dietary',
};

/** The prompt under each section's selector, per design/design-plan/03-components.md. */
export const TAG_CATEGORY_HINTS: Record<TagCategory, string> = {
  style: 'The way you work, in the words a customer would search for.',
  language: 'Languages you can work in.',
  cultural: 'Traditions and celebrations you know well.',
  dietary: 'Dietary requirements you can cater to.',
};

/**
 * Pill colours per category, so a customer can tell the groups apart at a
 * glance on a vendor profile.
 *
 * Style takes stone rather than a fourth hue. `01-foundations.md` spends colour
 * on meaning, and a style tag carries none of the three the others do — it is
 * descriptive where language, culture and dietary are all a form of "can this
 * vendor accommodate me". A fourth accent would say those four things are
 * peers, which they are not.
 */
export const TAG_PILL_CLASSES: Record<TagCategory, string> = {
  style: 'bg-stone-200 text-stone-700',
  language: 'bg-info-light text-info',
  cultural: 'bg-clay-100 text-clay-600',
  dietary: 'bg-sage-50 text-sage-600',
};

/** Reads naturally in "Suggest a language" / "Suggest a dietary requirement". */
export const TAG_CATEGORY_NOUN: Record<TagCategory, string> = {
  style: 'style',
  language: 'language',
  cultural: 'cultural specialty',
  dietary: 'dietary requirement',
};
