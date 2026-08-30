import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/*
 * Every `--text-*` step in `packages/config/tailwind/theme.css` whose name is
 * not one of Tailwind's stock sizes.
 *
 * tailwind-merge resolves a class by name, and it only ships the sizes Tailwind
 * ships. A `text-*` it does not recognise carries no unit to give it away, so it
 * lands in the **colour** group: pairing one with a real colour put two classes
 * in one group and dropped whichever came first. `text-helper` on the `03`
 * profile chip vanished entirely, leaving it to inherit 16px where the frame
 * draws 11.5px, and `text-stone-600` vanished from the `01` hero label.
 *
 * So the merge is told the scale. `display-*` and `md` predate #198 and are
 * listed for the same reason — `text-display-sm` beside `text-stone-900` in one
 * `cn()` is exactly the same collision. `utils.test.ts` reads the theme and
 * fails if a step is added there and not here.
 */
const PROJECT_FONT_SIZES = [
  'label',
  'helper',
  'meta',
  'action',
  'cta',
  'md',
  'display-sm',
  'display-md',
  'display-xs',
  'display-empty',
  'display-lg',
  'display-hero-sm',
  'display-hero-md',
  'display-xl',
];

const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: PROJECT_FONT_SIZES }] } },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
