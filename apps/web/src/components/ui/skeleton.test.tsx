import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BookingCardSkeleton,
  MessageBubbleSkeleton,
  Skeleton,
  VendorCardSkeleton,
} from './skeleton';

afterEach(cleanup);

/**
 * A skeleton's whole job is that nothing moves when the data lands, so what is
 * worth asserting is not that it renders but that it keeps the real
 * component's measurements and stays out of the accessibility tree.
 */
describe('Skeleton', () => {
  it('is hidden from assistive technology — it has nothing to announce', () => {
    const { container } = render(<Skeleton />);

    expect(container.querySelector('[data-slot=skeleton]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});

/*
 * Frame `17 Search loading` is still read for the two values that are genuinely
 * the frame's — the placeholder widths — and it is read at test time rather
 * than written down, so a design re-import that moves one fails this file
 * instead of passing silently. Same rule `vendor-card-parity.test.tsx` follows.
 */
const frameHtml = readFileSync(
  join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
  'utf8',
);

/** Frame `17 Search loading`, up to the frame that follows it. */
const loadingFrame = (() => {
  const start = frameHtml.indexOf('data-screen-label="17 Search loading"');
  const next = frameHtml.indexOf('class="fr"', start);

  return frameHtml.slice(start, next === -1 ? undefined : next);
})();

/*
 * **The skeleton's contract is with `VendorCard`, not with a frame**, so these
 * read the card's own source and compare class for class. Frame
 * `17 Search loading` cannot settle it: it is a 1440 frame drawn in the 1024
 * composition, and it disagrees with `02 Search` — the loaded state at the same
 * width — by 25px of card body. Building from it left the skeleton 14px short,
 * measured in a browser with both states held on screen.
 *
 * jsdom performs no layout, so nothing here measures a rendered height; the
 * browser pass owns that, and the JSDoc on `VendorCardSkeleton` records the
 * arithmetic it confirmed. What is settled here is the class-level fact
 * underneath it: **every spacing and structure class the skeleton uses is the
 * one the card uses at `density="compact"`**. Those cannot drift apart without
 * this failing, which is the property that makes the measured 0px delta stay
 * 0px.
 */
const cardSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'vendors', 'vendor-card.tsx'),
  'utf8',
);
const skeletonSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'ui', 'skeleton.tsx'),
  'utf8',
);

/** The `VendorCardSkeleton` function body alone, so a match cannot run past it. */
const skeletonBody = (() => {
  const start = skeletonSource.indexOf('export function VendorCardSkeleton');
  const next = skeletonSource.indexOf('\nexport function ', start + 1);

  return skeletonSource.slice(start, next === -1 ? undefined : next);
})();

describe('VendorCardSkeleton', () => {
  /*
   * The defect this closes: the skeleton was `rounded-2xl` (18px) while
   * `VendorCard` is `rounded-[16px]`, so the corner changed shape as the data
   * landed. Both are read from source, so the two cannot drift apart again —
   * asserting the literal in one file only would pass the moment the other
   * moved.
   *
   * Both slices are bounded to the element that owns the radius. An earlier
   * version sliced to end-of-file and took the first match after the marker,
   * which found `BookingCardSkeleton`'s `rounded-[14px]` 57 lines below when
   * the wrapper was mutated — it failed by luck, and would have passed on a
   * broken skeleton the day anything below it used 16px.
   */
  it('shares the loaded card’s radius, read from both sources', () => {
    const radiusIn = (source: string): string | undefined =>
      /rounded-\[(\d+)px\]/.exec(source)?.[1];

    const cardWrapper = cardSource.slice(
      cardSource.indexOf("'group/card"),
      cardSource.indexOf('hover:shadow-hover'),
    );
    const skeletonWrapper = skeletonBody.slice(
      skeletonBody.indexOf('data-slot="skeleton-vendor-card"'),
      skeletonBody.indexOf('aspect-[3/2]'),
    );

    expect(radiusIn(cardWrapper)).toBe('16');
    expect(radiusIn(skeletonWrapper)).toBe(radiusIn(cardWrapper));
  });

  /*
   * Every spacing class, against the card's compact branch. These are the
   * values the 14px of drift lived in — the body's asymmetric padding, the 2px
   * between name and meta, the chip row's margin, and the price row carrying
   * the rule as its own border rather than as a separate element with
   * symmetric margins.
   */
  it.each([
    ['body padding', 'px-3.5 pt-3 pb-3.5'],
    ['name margin', 'mt-2.75'],
    ['meta margin', 'mt-0.5'],
    ['chip row', 'mt-2 flex flex-wrap gap-1.25'],
    ['price row', 'mt-2.5 flex items-center justify-between border-t border-stone-200 pt-2.25'],
  ])('takes its %s from the compact card', (_label, classes) => {
    expect(skeletonBody).toContain(classes);
  });

  /* The same classes, proven to be the card's rather than merely plausible. */
  it.each([
    ['px-3.5 pt-3 pb-3.5'],
    ['mt-2.75'],
    ['mt-0.5'],
    ['mt-2 gap-1.25'],
    ['mt-2.5 pt-2.25'],
    ['border-t border-stone-200'],
  ])('and %s is what the compact card itself declares', (classes) => {
    expect(cardSource).toContain(classes);
  });

  it('mirrors the card’s line boxes, which are font-metric-derived', () => {
    const { container } = render(<VendorCardSkeleton />);
    const bars = Array.from(container.querySelectorAll('[data-slot=skeleton]')).map(
      (node) => node.className,
    );

    /*
     * Cover, name, meta, From, price. Five bars — not seven: the compact card
     * renders **no** chips, so a skeleton that drew two would promise content
     * that never arrives and stand 12px too tall. `vendor-card.tsx` returns
     * `null` for the category chip in compact, and the search grid never passes
     * an availability date.
     */
    expect(bars).toHaveLength(5);
    expect(bars[0]).toContain('aspect-[3/2]');
    expect(bars[0]).toContain('rounded-none');

    // 19px serif, 12px meta, 12px `From`, 17px bold price, all `line-height: normal`.
    expect(bars[1]).toContain('h-[25px]');
    expect(bars[2]).toContain('h-[15px]');
    expect(bars[3]).toContain('h-[15px]');
    expect(bars[4]).toContain('h-[20px]');
  });

  it('keeps the chip row the card keeps, and keeps it empty', () => {
    const { container } = render(<VendorCardSkeleton />);
    const chipRow = container.querySelector('.flex-wrap');

    // Present, because its margin is part of the body's rhythm.
    expect(chipRow).not.toBeNull();
    // Empty, because the loaded card's is.
    expect(chipRow?.childElementCount).toBe(0);
    expect(cardSource).toContain('isCompact\n              ? null');
  });

  /*
   * The rule is the price row's own `border-t`, as it is on the card — not a
   * separate element. A divider with its own symmetric margins is what put 4px
   * of the drift here, and it would also shimmer forever, since it is a real
   * rule that survives into the loaded card rather than a placeholder.
   */
  it('draws the rule as the price row’s border, not as a placeholder', () => {
    const { container } = render(<VendorCardSkeleton />);
    const bars = Array.from(container.querySelectorAll('[data-slot=skeleton]'));
    const ruled = container.querySelector('.border-t');

    expect(ruled?.className).toContain('border-stone-200');
    expect(bars.some((bar) => bar.className.includes('border-t'))).toBe(false);
    // `stone-200` is `#efe9e0` — the divider colour every frame draws.
    expect(loadingFrame).toContain('height:1px;background:#EFE9E0');
  });

  /*
   * The placeholder widths are the only values still taken from the frame,
   * because they stand in for text of unknown length rather than for a
   * measurement. They are the median of its six cards, which vary so a column
   * does not read as identical boxes.
   */
  it('takes its placeholder widths from the median of frame 17’s six cards', () => {
    const median = (values: readonly number[]): number => {
      const sorted = [...values].sort((a, b) => a - b);
      const middle = sorted.length / 2;

      return (sorted[middle - 1]! + sorted[middle]!) / 2;
    };

    const titles = [...loadingFrame.matchAll(/class="sk" style="height:17px;width:(\d+)%/g)].map(
      (match) => Number(match[1]),
    );
    const metas = [...loadingFrame.matchAll(/class="sk" style="height:11px;width:(\d+)%/g)].map(
      (match) => Number(match[1]),
    );

    expect(titles).toHaveLength(6);
    expect(metas).toHaveLength(6);
    expect(median(titles)).toBe(61);
    expect(median(metas)).toBe(47);

    expect(skeletonBody).toContain('w-[61%]');
    expect(skeletonBody).toContain('w-[47%]');
  });
});

describe('BookingCardSkeleton', () => {
  it("keeps the real card's radius, padding and shadow so the grid does not shift", () => {
    const { container } = render(<BookingCardSkeleton />);
    const card = container.querySelector('[data-slot=skeleton-booking-card]');

    expect(card?.className).toContain('rounded-[14px]');
    expect(card?.className).toContain('p-3.5');
    expect(card?.className).toContain('shadow-sm');
  });

  /* The card leads with a 9.5 avatar tile opposite its status pill. */
  it('mirrors the avatar tile and the status pill', () => {
    const { container } = render(<BookingCardSkeleton />);
    const parts = Array.from(container.querySelectorAll('[data-slot=skeleton]')).map(
      (node) => node.className,
    );

    expect(parts[0]).toContain('size-9.5');
    expect(parts[0]).toContain('rounded-[9px]');
    expect(parts[1]).toContain('rounded-full');
  });

  it('is a list item, because the real cards are', () => {
    const { container } = render(<BookingCardSkeleton />);

    expect(container.querySelector('li')).not.toBeNull();
  });
});

describe('MessageBubbleSkeleton', () => {
  /*
   * The tail is a single squared corner on the sender's side. Mirroring it is
   * what makes a column of blocks read as a conversation rather than a form.
   */
  it('squares the corner on the sender’s side', () => {
    const { container: theirs } = render(<MessageBubbleSkeleton />);
    const { container: mine } = render(<MessageBubbleSkeleton mine />);

    expect(theirs.querySelector('[data-slot=skeleton]')?.className).toContain(
      'rounded-[14px_14px_14px_4px]',
    );
    expect(mine.querySelector('[data-slot=skeleton]')?.className).toContain(
      'rounded-[14px_14px_4px_14px]',
    );
  });

  it('sits on the sender’s side of the pane', () => {
    const { container: theirs } = render(<MessageBubbleSkeleton />);
    const { container: mine } = render(<MessageBubbleSkeleton mine />);

    expect(theirs.querySelector('[data-slot=skeleton-message-bubble]')?.className).toContain(
      'self-start',
    );
    expect(mine.querySelector('[data-slot=skeleton-message-bubble]')?.className).toContain(
      'self-end',
    );
  });

  /* A bubble that filled the pane would misrepresent the shape of the thread. */
  it('never exceeds the 62% the real bubble is capped at', () => {
    const { container } = render(<MessageBubbleSkeleton />);

    expect(container.querySelector('[data-slot=skeleton-message-bubble]')?.className).toContain(
      'max-w-[62%]',
    );
  });
});
