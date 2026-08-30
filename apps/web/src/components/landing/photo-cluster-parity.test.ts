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

    return { caption: (match[2] as string).trim(), width: read('width'), height: read('height') };
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
});

describe('hero cluster — radius and loading (#249, #186)', () => {
  /**
   * The `border-radius` a frame draws on each hero card, keyed by its caption.
   */
  function radii(label: string): Map<string, number> {
    const block = frame(label);
    const matches = [
      ...block.matchAll(/<div class="ph" style="([^"]+)"[^>]*><span class="phl">([^<]*)<\/span>/g),
    ];

    return new Map(
      matches.map((match) => {
        const found = /(?:^|;)border-radius:([\d.]+)px/.exec(match[1] as string);
        expect(found, `frame "${label}" card has no border-radius`).not.toBeNull();
        return [(match[2] as string).trim(), Number((found as RegExpExecArray)[1])];
      }),
    );
  }

  /*
   * #249. The 1440 rung wore `rounded-2xl`, which is the 18px token, where the
   * frame draws 16 on the two large cards. The same 16-vs-18 the vendor card
   * resolved the same way: the token is right and the card was reaching for the
   * wrong step.
   */
  /*
   * Bound to the CARD, not to the file. An earlier version asked only whether
   * each radius appeared somewhere in the source — and since the frame draws
   * 16/16/14 and the component holds 16/16/14, every radius had a supplier no
   * matter which card held it. Putting the wrong radius on card 1, which is
   * precisely #249, left the suite green.
   *
   * `CARDS` is in the frame's own source order, so index is what ties a
   * measured radius to the card that must carry it.
   */
  it('gives each 1440 card the radius frame 01 draws on that card', () => {
    const drawn = [...radii('01 Landing')];
    const blocks = clusterSource.split('src:').slice(1);

    expect(drawn).toHaveLength(3);
    expect(blocks).toHaveLength(3);

    drawn.forEach(([caption, radius], index) => {
      const block = blocks[index] as string;
      const arbitrary = new RegExp(String.raw`min-\[90rem\]:rounded-\[${radius}px\]`);
      const native = new RegExp(String.raw`min-\[90rem\]:rounded-${radius / 4}(?![\d.])`);

      expect(
        arbitrary.test(block) || native.test(block),
        `card ${index + 1} (${caption}) does not carry its ${radius}px 1440 radius`,
      ).toBe(true);
    });
  });

  it('reaches for no 18px token at the 1440 rung', () => {
    expect(clusterSource).not.toContain('min-[90rem]:rounded-2xl');
  });

  /*
   * #186. The cluster is `display:none` below 768 and `14 Landing mobile` draws
   * no cards — but `display:none` does not stop an EAGER image loading, so a
   * phone fetched all three hero photographs and saw none of them. Measured at
   * 390x844 on a cold load: three `/_next/image` requests, all three complete.
   *
   * Lazy is what makes hidden mean unfetched, because an image inside a
   * `display:none` ancestor never intersects the viewport. jsdom performs no
   * layout and Next's loader does not run here, so this asserts the class-level
   * fact — that no card asks for `priority` — and the rendered result is
   * verified in the browser, not here.
   */
  it('marks no hero card priority, so a hidden cluster fetches nothing', () => {
    // Anchored to a line that STARTS with the prop, so the word can still be
    // discussed in the comment explaining why it is gone.
    expect(clusterSource).not.toMatch(/^\s*priority(?:[={\s/>]|$)/m);
  });
});
