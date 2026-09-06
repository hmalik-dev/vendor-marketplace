import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/*
 * Frame `27 Checkout — 1024` (#371): the total stays above the fold, and it is
 * called `Total today`.
 *
 * **The label was the whole of it.** #380 filed this as a three-all split
 * between `Total today` and `Due today`; D30 found that tally counted a layout
 * constraint's prose as a copy source. `Due today` was never specified anywhere
 * — it occurs only inside the sentence "Due today stays above the fold", where
 * the writer named the row informally. Both frames were corrected, and
 * `30-responsive.md`'s two fold sentences reworded so the phrase cannot be
 * mistaken for a string again. This keeps them corrected.
 *
 * **And the layout question it was wearing the clothes of does not exist**: the
 * row's bottom sits at 302 in the frame's 640px, and the rail is 340px of static
 * content with nothing above the total that can grow unboundedly. jsdom has no
 * layout engine, so the 640 assertion itself is the browser gate's — driven for
 * this ticket at 1024x640. What survives here is the *cause*: the rail's block
 * order. A block inserted above the total is the only way it reaches the fold,
 * and that is what this fails on.
 */

const frames = readFileSync(
  join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
  'utf8',
);

function frame(label: string): string {
  const start = frames.indexOf(`data-screen-label="${label}"`);
  expect(start, `frame "${label}" is missing from the design file`).toBeGreaterThan(-1);
  const next = frames.indexOf('data-screen-label="', start + 1);

  return frames.slice(start, next === -1 ? undefined : next);
}

const screen = readFileSync(
  join(process.cwd(), 'src/components/checkout/checkout-screen.tsx'),
  'utf8',
);

describe('the checkout total is called `Total today`, on every frame that draws it', () => {
  it.each(['05 Checkout', '27 Checkout — 1024', '21 Checkout declined'])(
    '%s draws `Total today` and not `Due today`',
    (label) => {
      const markup = frame(label);

      expect(markup).toContain('Total today');
      expect(markup).not.toContain('Due today');
    },
  );

  it('is what the screen renders', () => {
    expect(screen).toContain('>Total today<');
    expect(screen).not.toContain('Due today');
  });

  /*
   * `30-responsive.md` is where the informal phrasing came from, so it is where
   * it must not come back.
   */
  it('is not re-introduced by the responsive plan', () => {
    const responsive = readFileSync(
      join(process.cwd(), '..', '..', 'design', 'design-plan', '30-responsive.md'),
      'utf8',
    );

    expect(responsive).not.toContain('Due today');
  });
});

describe('nothing unbounded sits above the total in the summary rail', () => {
  /*
   * The rail's blocks, in the order the frame stacks them and the component
   * renders them. The total is last, so its distance from the top of the rail is
   * the sum of four fixed-height blocks — which is why 302 holds. An inserted
   * block, or a re-order that pushes the total down, fails here.
   */
  const rail = /function SummaryRail\(\{[\s\S]*?\n\}\n/.exec(screen)?.[0] ?? '';

  it('reads the rail out of the component at all', () => {
    expect(rail).not.toBe('');
  });

  it('stacks vendor, event details, line items and the total, in that order', () => {
    const order = [
      'checkout.vendor.businessName',
      'label="Date"',
      '>Package<',
      '>Service fee<',
      '>Total today<',
    ];
    const positions = order.map((marker) => rail.indexOf(marker));

    expect(positions.every((index) => index > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('puts the total last, with nothing rendered below it', () => {
    expect(rail.slice(rail.indexOf('Total today'))).not.toMatch(/border-t border-stone-200/);
  });

  it('draws the rail at the width frame `27 Checkout — 1024` gives it', () => {
    expect(frame('27 Checkout — 1024')).toContain('width:340px');
  });
});
