import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/*
 * The hero cluster at all three drawn widths.
 *
 * Every expectation is READ OUT OF THE FRAME at test time rather than written
 * down, so a design re-import that moves the contract fails here instead of
 * passing silently. And it is **one table over three viewports** rather than
 * three hand-written suites — #304 asks for exactly that, because a viewport
 * that gets its own suite is a viewport that quietly stops being asserted.
 */

const frameHtml = readFileSync(
  join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
  'utf8',
);

/**
 * The markup of one screen frame.
 *
 * Bounded at the next `data-screen-label` **or** the next card, whichever comes
 * first. The bundle nests responsive variants inside one card, so bounding on
 * the card alone swallows the neighbours — that was #294, and it is exactly the
 * trap a responsive suite walks into, since these frames are the nested ones.
 */
function frame(label: string): string {
  const start = frameHtml.indexOf(`data-screen-label="${label}"`);
  expect(start, `frame "${label}" is missing from the design file`).toBeGreaterThan(-1);

  const after = start + 1;
  const ends = [
    frameHtml.indexOf('data-screen-label="', after),
    frameHtml.indexOf('<div class="sc"', after),
  ].filter((index) => index !== -1);

  return frameHtml.slice(start, ends.length > 0 ? Math.min(...ends) : frameHtml.length);
}

interface Card {
  readonly caption: string;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}

/** The hero photo cards a frame draws, in source order. */
function heroCards(label: string): Card[] {
  const block = frame(label);
  const matches = [
    ...block.matchAll(/<div class="ph" style="([^"]+)"[^>]*><span class="phl">([^<]*)<\/span>/g),
  ];

  return matches.map((match) => {
    const style = match[1] as string;
    const read = (property: string): number => {
      const found = new RegExp(`(?:^|;)${property}:(-?[\\d.]+)px`).exec(style);
      expect(found, `frame "${label}" card has no ${property}`).not.toBeNull();
      return Number((found as RegExpExecArray)[1]);
    };

    return {
      caption: (match[2] as string).trim(),
      width: read('width'),
      height: read('height'),
      radius: read('border-radius'),
    };
  });
}

/** The three drawn widths, and the source they are drawn in. */
const VIEWPORTS = [
  { width: 768, label: '14 Landing tablet', cards: 2 },
  { width: 1024, label: '27 Landing — 1024', cards: 3 },
  { width: 1440, label: '01 Landing', cards: 3 },
] as const;

const clusterSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'landing', 'photo-cluster.tsx'),
  'utf8',
);

describe('hero cluster parity across the drawn viewports', () => {
  it.each(VIEWPORTS)('frame for $width draws $cards cards', ({ label, cards }) => {
    expect(heroCards(label)).toHaveLength(cards);
  });

  /*
   * The rule `14 Landing tablet` overrides. The cluster used to be forbidden
   * from shedding a card; the frame sheds one, and the arithmetic is why —
   * the third card would fall under the short-edge floor the other two clear.
   */
  it('sheds exactly the smallest card at 768, and only there', () => {
    const wide = heroCards('01 Landing').map((card) => card.caption);
    const tablet = heroCards('14 Landing tablet').map((card) => card.caption);

    const dropped = wide.filter((caption) => !tablet.includes(caption));
    expect(dropped).toHaveLength(1);

    const smallest = [...heroCards('01 Landing')].sort(
      (a, b) => Math.min(a.width, a.height) - Math.min(b.width, b.height),
    )[0];
    expect(dropped[0]).toBe(smallest?.caption);
  });

  /*
   * The two scales `30-responsive.md` names, derived from the frames rather
   * than asserted independently of them — if a re-import changes a card, this
   * reports the new ratio instead of passing on a stale constant.
   */
  it.each([
    { label: '14 Landing tablet', expected: 0.62 },
    { label: '27 Landing — 1024', expected: 0.73 },
  ])('$label draws its cards at ~$expected of the 1440 frame', ({ label, expected }) => {
    const wide = heroCards('01 Landing');
    const narrow = heroCards(label);

    for (const card of narrow) {
      const reference = wide.find((candidate) => candidate.caption === card.caption);
      expect(reference, `no 1440 card captioned "${card.caption}"`).toBeDefined();

      const ratio = card.width / (reference as Card).width;
      expect(ratio, `${card.caption} width ratio`).toBeCloseTo(expected, 2);
      expect(card.height / (reference as Card).height, `${card.caption} height ratio`).toBeCloseTo(
        expected,
        2,
      );
    }
  });

  /*
   * The component states each frame's pixels rather than scaling one
   * composition, because the tablet frame re-positions as well as shrinking.
   * These assert the sizes it commits to are the frames' — the geometry is in
   * class names, so this is the closest a unit test gets; the positions and the
   * rendered result are `parity-checker`'s at 768 and 1024.
   */
  it.each(VIEWPORTS)(
    'the component carries every card size the $width frame draws',
    ({ label }) => {
      /*
       * Matched with an optional breakpoint prefix, and each dimension
       * separately: the classes read `lg:h-[213px] lg:w-[172px]`, so looking for
       * the unprefixed pair as one substring finds nothing even when every value
       * is right. The 1440 sizes stay on Tailwind's own scale, where 292px is
       * `h-73`, so both spellings are accepted.
       */
      const carries = (axis: 'h' | 'w', px: number): boolean => {
        /*
         * The prefix may be `lg:` or `min-[90rem]:` — the 1440 step is a
         * bracketed arbitrary variant, so `[a-z]+:` alone misses it and the
         * 1440 row silently stopped being asserted the moment the component
         * moved off `xl:`.
         */
        const variant = String.raw`(?:[a-z-]+:|min-\[[^\]]+\]:)?`;
        const arbitrary = new RegExp(`(?:^|[\\s'\`])${variant}${axis}-\\[${px}px\\]`);
        const native = new RegExp(`(?:^|[\\s'\`])${variant}${axis}-${px / 4}(?![\\d.])`);

        return arbitrary.test(clusterSource) || native.test(clusterSource);
      };

      for (const card of heroCards(label)) {
        expect(
          carries('h', card.height),
          `no class in photo-cluster.tsx gives ${card.caption} height ${card.height}px for ${label}`,
        ).toBe(true);
        expect(
          carries('w', card.width),
          `no class in photo-cluster.tsx gives ${card.caption} width ${card.width}px for ${label}`,
        ).toBe(true);
      }
    },
  );

  /*
   * #249. Cards 1 and 2 shipped `rounded-2xl` at 1440 — 18px in this theme's
   * scale, where the frame draws 16px — while card 3's `rounded-[14px]` was
   * already correct. Reads the frame's own `border-radius` per card per
   * viewport, so a design re-import that moves a radius fails here instead
   * of the class staying stale beside a corrected doc comment.
   */
  it.each(VIEWPORTS)(
    'the component carries every card radius the $width frame draws',
    ({ label }) => {
      /*
       * Arbitrary bracket values only, deliberately not Tailwind's named
       * `rounded-2xl` etc: `--radius-2xl` is 18px in this theme (vendor cards,
       * modals), and none of the three cards' 13/14/16px radii lands on a
       * named step, so a class carrying one here is never a coincidence worth
       * accepting — see photo-cluster.tsx's own comment on card 1.
       */
      const variant = String.raw`(?:[a-z-]+:|min-\[[^\]]+\]:)?`;

      for (const card of heroCards(label)) {
        const arbitrary = new RegExp(`(?:^|[\\s'\`])${variant}rounded-\\[${card.radius}px\\]`);

        expect(
          arbitrary.test(clusterSource),
          `no class in photo-cluster.tsx gives ${card.caption} radius ${card.radius}px for ${label}`,
        ).toBe(true);
      }
    },
  );
});
