import type { Category } from '@vendor-marketplace/shared';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SearchBar } from './search-bar';

/*
 * The **anchored** mount, as `category-select.test.tsx` does and for the same
 * reason: jsdom's stub answers every media query "no", which would put these
 * against the bottom sheet — a different mount, with the field inside a portal
 * and no segment around it, so every padding here would read zero and pass on
 * nothing.
 */
beforeEach(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes('min-width: 640px'),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

/**
 * #417 item 1b. The bar's left inset is **split** between the form and its
 * first segment, and the split is what these assert.
 *
 * `CategorySelect` is the bar's first segment, so it used to take its whole
 * inset from the form's own `padding-left` and declare none itself. Its focus
 * fill is `rounded-full`, so each cap's radius is half the segment's height —
 * and with `padding-left: 0` the cap curved inward across the first characters
 * of `Vendor type`. Measured on `/search` at 1440: glyph inset 0.0px from the
 * segment's left edge, taken with a `Range` rather than off the element box.
 *
 * The fix moves part of the frame's inset onto the segment, one value per step.
 * Two things have to hold together for that to be a fix rather than a layout
 * change, and neither is visible from inside one file:
 *
 * 1. the segment declares enough left padding to clear the cap, and
 * 2. the two halves still **sum** to the inset the frames draw, at every width.
 *
 * These read the rendered class lists rather than the source text, so a value
 * moved between files, breakpoints or the `cn` branches is still caught. jsdom
 * performs no layout, so the *rendered* inset is not verified here — it was
 * measured in the browser at each width, and `parity-checker` is its gate.
 */

/** Tailwind's spacing unit: `pl-3.5` is 3.5 x 4px. */
const SPACING_PX = 4;

/**
 * The frames' left inset for the whole bar, by variant and breakpoint prefix.
 *
 * Hero: `6 6 6 20` at 768, `6 6 6 18` at 1024, `7 7 7 24` at 1440. Compact:
 * 18px, from the fixed-height header bar in frames `17` and `18`.
 */
const FRAME_INSET_PX = {
  hero: { 'sm:': 20, 'lg:': 18, 'min-[90rem]:': 24 },
  compact: { 'sm:': 18 },
} as const;

/**
 * The `rounded-full` fill's corner radius at each step — **half the segment's
 * measured height**, because that is what `rounded-full` resolves to.
 *
 * The segment's own left padding has to clear it, or the cap eats the label's
 * first character. At the cap's widest the intrusion is exactly this radius, so
 * clearing it clears the label at every y rather than at the one y that
 * happened to be sampled.
 *
 * Heights measured in Chromium, `/search` and `/`, at the five widths in
 * `30-responsive.md`: 27px compact throughout; hero 29 at 768, 28 at 1024 and
 * 1280, 34 at 1440. The 1440 hero is why this is a ladder and not one number.
 */
const CAP_RADIUS_PX = {
  hero: { 'sm:': 14.5, 'lg:': 14, 'min-[90rem]:': 17 },
  compact: { 'sm:': 13.5 },
} as const;

const CATEGORIES: Category[] = [
  {
    id: '1',
    name: 'Photography',
    slug: 'photography',
    description: 'Photography vendors.',
    icon: 'camera',
    displayOrder: 1,
    isActive: true,
  },
];

const EMPTY = { category: '', city: '', state: '', date: '' };

/**
 * The left padding a class list declares at one breakpoint.
 *
 * Exact tokens only — `max-sm:pl-*` is a different rule and must not answer for
 * `sm:`. **Declared, never inherited**: both halves state a value at every step
 * they are checked at, so a resolver that walked the cascade would let a
 * deleted declaration pass by silently inheriting the step below it. Missing is
 * a failure here, and it reads as `0`.
 */
function declaredLeftPadding(classNames: string, prefix: string): number {
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}pl-([\\d.]+)$`);

  for (const token of classNames.split(/\s+/)) {
    const match = pattern.exec(token);

    if (match?.[1] !== undefined) {
      return Number(match[1]) * SPACING_PX;
    }
  }

  return 0;
}

function renderBar(size: 'compact' | 'hero'): { form: string; segment: string } {
  render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={() => {}} size={size} />);

  const form = screen.getByRole('search');
  const segment = screen
    .getByRole('combobox', { name: 'Vendor type' })
    .closest('[data-slot="combobox-field"]');

  expect(segment).not.toBeNull();

  return { form: form.className, segment: (segment as HTMLElement).className };
}

/** Every (variant, breakpoint) pair the two tables above cover. */
const CASES = (['compact', 'hero'] as const).flatMap((size) =>
  Object.keys(FRAME_INSET_PX[size]).map((prefix) => [size, prefix] as const),
);

describe('the search bar’s left inset', () => {
  it.each(CASES)('sums to the frame’s inset on the %s bar at %s', (size, prefix) => {
    const { form, segment } = renderBar(size);

    expect(declaredLeftPadding(form, prefix) + declaredLeftPadding(segment, prefix)).toBe(
      FRAME_INSET_PX[size][prefix as keyof (typeof FRAME_INSET_PX)[typeof size]],
    );
  });

  it.each(CASES)('clears the focus fill’s corner radius on the %s bar at %s', (size, prefix) => {
    const { segment } = renderBar(size);

    // The indicator is a fill, not a ring — `03-components.md` § Inputs — so
    // the radius is the only thing that can hide the label, and the padding is
    // the only thing that answers it.
    expect(segment).toContain('rounded-full');
    expect(declaredLeftPadding(segment, prefix)).toBeGreaterThanOrEqual(
      CAP_RADIUS_PX[size][prefix as keyof (typeof CAP_RADIUS_PX)[typeof size]],
    );
  });
});
