import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/*
 * The 1024 rung of the search ladder — frames `27 Search results · 1024`,
 * `27 Search — loading · 1024` and `27 Search — no results · 1024` (#371).
 *
 * **The numbers are read out of the frames at test time, never written down
 * here.** That is the whole point of D30: the 1024 frame's card values were
 * transcription drift, they were re-cut against both neighbours, and the next
 * pass to re-cut them should move this test rather than disagree with it.
 *
 * jsdom has no layout engine, so this cannot measure that the second row's top
 * edge lands inside the 640 fold — the browser parity gate does that, and it is
 * what #371 was told to drive rather than infer. What this guards is the class
 * of regression that produced the miss in the first place: a ladder written once
 * at 1440 and never stepped, so 1024 silently renders the desktop rung.
 */

const frames = readFileSync(
  join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
  'utf8',
);

/** One frame's markup, from its label to the start of the next. */
function frame(label: string): string {
  const start = frames.indexOf(`data-screen-label="${label}"`);
  expect(start, `frame "${label}" is missing from the design file`).toBeGreaterThan(-1);
  const next = frames.indexOf('data-screen-label="', start + 1);

  return frames.slice(start, next === -1 ? undefined : next);
}

function source(file: string): string {
  return readFileSync(join(process.cwd(), 'src', 'components', file), 'utf8');
}

const shell = source('search/search-shell.tsx');
const card = source('vendors/vendor-card.tsx');
const bar = source('search/refine-bar.tsx');

/** The `gap:` a frame's results grid declares. */
function frameGutter(label: string): number {
  const grid = /display:grid;grid-template-columns:[^;]+;gap:(\d+(?:\.\d+)?)px/.exec(frame(label));
  expect(grid, `frame "${label}" draws no results grid`).not.toBeNull();

  return Number((grid as RegExpExecArray)[1]);
}

describe('the search grid gutter is one number at every width', () => {
  /*
   * D30's corroboration rule, executable: the middle frame disagreeing with
   * both neighbours is the middle frame being wrong. If a later re-cut splits
   * them again, this fails here rather than in a browser six tickets later.
   */
  it('is 16px on all three frames that draw the results grid', () => {
    expect(frameGutter('02 Search')).toBe(16);
    expect(frameGutter('27 Search results — 1024')).toBe(16);
    expect(frameGutter('14 Search tablet')).toBe(16);
  });

  it('is one unconditional class in the grid, with no per-width override', () => {
    const columns = /const GRID_COLUMNS =\s*'([^']+)'/.exec(shell);
    expect(columns).not.toBeNull();
    const classes = (columns as RegExpExecArray)[1].split(' ');

    // `gap-4` is 16px. One gap class, no breakpoint prefix on it.
    expect(classes.filter((name) => /(^|:)gap-/.test(name))).toEqual(['gap-4']);
  });

  it('still steps its columns, which is what the ladder does change', () => {
    expect(shell).toContain('lg:grid-cols-3');
    expect(shell).toContain('min-[90rem]:grid-cols-4');
  });
});

describe('the compact card monogram stops at 1440', () => {
  /*
   * The one genuine ladder step in D30's table: 1440 has the width for the
   * overlapped monogram and 1024 and 768 do not draw it at all. Asserted from
   * the frames, because "the frame draws no monogram" is exactly the kind of
   * absence a written note stops being true about.
   */
  it('is drawn on the 1440 frame and on neither narrower one', () => {
    // The monogram is the only 32px circle in these frames; the header avatars
    // are 28-30px, so the size is what distinguishes it from every other disc.
    expect(frame('02 Search')).toContain('width:32px;height:32px;border-radius:50%');
    expect(frame('27 Search results — 1024')).not.toContain('width:32px;height:32px');
    expect(frame('14 Search tablet')).not.toContain('width:32px;height:32px');
  });

  it('is gated to 1440 in the card, and takes its heading clearance with it', () => {
    expect(card).toContain("'hidden -top-4 left-3.5 min-[90rem]:block'");
    expect(card).toContain("'text-[19px] min-[90rem]:mt-2.75'");
  });
});

describe('the chrome above the grid steps at 1024', () => {
  it('draws a shorter Refine bar and a tighter count band at 1024 than at 1440', () => {
    const wide = frame('02 Search');
    const narrow = frame('27 Search results — 1024');

    // The 1024 frame pins the bar's height outright; 1440 lets it size to its
    // 11px padding. Only the narrow one carries a fixed height, which is the
    // step itself.
    expect(narrow).toContain('height:46px');
    expect(wide).not.toContain('height:46px');
    expect(narrow).toContain('padding:13px 20px 9px');
    expect(wide).toContain('padding:15px 26px 11px');
  });

  it('steps the bar and the band in the source rather than pinning the 1440 rung', () => {
    /*
     * Anchored on the whole run, not on `px-5 py-2`: that substring is also in
     * `px-5 py-2.75` — the 1440 rung — so the loose form passed on exactly the
     * regression it names, a bar that never stepped down.
     */
    expect(bar).toContain('bg-stone-0 px-5 py-2 lg:flex-row');
    expect(bar).toContain('min-[90rem]:px-6.5 min-[90rem]:py-2.75');
    expect(shell).toContain('pt-3.25 pb-2.25');
    expect(shell).toContain('min-[90rem]:pt-3.75 min-[90rem]:pb-2.75');
  });

  it('sets the count at the size each frame draws it', () => {
    expect(shell).toContain('text-[20px] break-words text-stone-900 min-[90rem]:text-[22px]');
  });
});

describe('the Refine bar carries the same five filters at both widths', () => {
  /*
   * D30 again: the `Distance` chip and the `Free on Jun 14 ✕` chip were stale on
   * every frame that drew them, because this product has neither filter. They
   * are gone from the frames; this keeps them from coming back into one and not
   * the other.
   */
  it.each([
    '02 Search',
    '27 Search results — 1024',
    '27 Search — loading · 1024',
    '17 Search loading',
  ])('%s draws no Distance chip and no availability chip', (label) => {
    const markup = frame(label);

    expect(markup).not.toContain('Distance');
    expect(markup).not.toContain('free that day');
    expect(markup).toContain('Languages');
    expect(markup).toContain('Cultural');
    expect(markup).toContain('Dietary');
  });
});
