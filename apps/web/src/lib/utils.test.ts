import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import { cn } from './utils';

/*
 * #198 gave the type scale three role-named steps — `text-label`, `text-helper`
 * and `text-meta` — for the sizes the frames draw between the t-shirt steps.
 *
 * `cn()` is `twMerge(clsx(...))`, and tailwind-merge only knows the sizes
 * Tailwind ships. An unrecognised `text-*` carrying no unit falls into its
 * **colour** group, so pairing a new step with a real colour put two classes in
 * one group and dropped whichever came first. On `03 Vendor profile` that left
 * the chip with no size class at all, inheriting 16px where the frame draws
 * 11.5px; on `01 Landing` it left the hero label ink instead of `stone-600`.
 *
 * Nothing in the components was wrong, and no token was wrong: the merge had to
 * be taught the scale. These assertions are what stop the next step being added
 * to the theme and silently disappearing at every `cn()` call site.
 */

const ROLE_STEPS = ['text-label', 'text-helper', 'text-meta'];

/*
 * Read from the theme rather than listed here, so a step added to the scale and
 * not registered in `cn()` fails on the step itself rather than the next time
 * someone reads a chip that lost its size.
 */
const require = createRequire(import.meta.url);
const themeCss = readFileSync(
  require.resolve('@vendor-marketplace/config/tailwind/theme.css'),
  'utf8',
);
const THEME_STEPS = [...themeCss.matchAll(/--text-([a-z0-9-]+):\s*[\d.]+px;/g)].map(
  (match) => `text-${match[1] as string}`,
);

describe('cn', () => {
  it.each(ROLE_STEPS)('keeps %s when a text colour follows it', (step) => {
    expect(cn(step, 'text-stone-600')).toBe(`${step} text-stone-600`);
  });

  it.each(ROLE_STEPS)('keeps the text colour when %s follows it', (step) => {
    expect(cn('text-stone-600', step)).toBe(`text-stone-600 ${step}`);
  });

  it.each(ROLE_STEPS)('lets a later size replace %s', (step) => {
    expect(cn(step, 'text-base')).toBe('text-base');
  });

  it.each(ROLE_STEPS)('lets %s replace an earlier size', (step) => {
    expect(cn('text-base', step)).toBe(step);
  });

  it('still merges two colours down to the last one', () => {
    expect(cn('text-stone-600', 'text-gold-600')).toBe('text-gold-600');
  });

  it('still merges two stock sizes down to the last one', () => {
    expect(cn('text-xs', 'text-sm')).toBe('text-sm');
  });

  /* The real call site the regression was found on, from `profile-header.tsx`. */
  it('keeps size, colour and background together on a chip', () => {
    expect(cn('rounded-md px-2.5 text-helper font-semibold', 'bg-clay-100 text-clay-600')).toBe(
      'rounded-md px-2.5 text-helper font-semibold bg-clay-100 text-clay-600',
    );
  });

  /*
   * The whole scale, not just #198's three. `text-display-sm` beside
   * `text-stone-900` in one `cn()` — which `vendor-card.tsx` does — is the same
   * collision, and it predates this ticket.
   */
  it('knows every size step the theme defines', () => {
    expect(THEME_STEPS.length).toBeGreaterThan(9);

    const dropped = THEME_STEPS.filter((step) => !cn(step, 'text-stone-600').includes(step));

    expect(dropped).toEqual([]);
  });
});
