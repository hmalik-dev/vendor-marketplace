import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Frame `08/09/11 shared` vs the live vendor chrome, on the Layout axis.
 *
 * The frames' boxes are content-box; Tailwind is border-box. Every element
 * below therefore has to carry its padding and border *outside* the width the
 * frame states, and this file checks that the arithmetic still lands on the
 * frame's footprint. jsdom has no layout, so this cannot be a
 * `getBoundingClientRect` comparison — the browser parity gate is the real
 * check. What it can do is stop the two sides drifting apart in source.
 */
const require = createRequire(import.meta.url);
const themeCss = readFileSync(
  require.resolve('@vendor-marketplace/config/tailwind/theme.css'),
  'utf8',
);

const designDirectory = join(process.cwd(), '../../design');
const framesFile = readdirSync(designDirectory).filter((entry) =>
  entry.endsWith('Screens.dc.html'),
);

if (framesFile.length !== 1) {
  throw new Error(`Expected exactly one screens frame file in design/, found ${framesFile.length}`);
}

const frames = readFileSync(join(designDirectory, framesFile[0] as string), 'utf8');
const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

/** `.side` is the one sidebar class the frames use. */
const SIDE_RULE = /\.side\{([^}]*)\}/;

/**
 * Frame `27 Vendor dashboard — 1024` overrides `.side` inline rather than
 * declaring a second class, so the 1024 numbers are read off the style
 * attribute. Matching the attribute rather than restating 220/14/10 here keeps
 * a bundle re-import moving the expectation instead of disagreeing with it.
 */
const SIDE_1024_RULE = /class="side" style="width:(\d+)px;padding:(\d+)px (\d+)px"/;

function pxOf(source: string, pattern: RegExp): number {
  const match = source.match(pattern);
  expect(match).not.toBeNull();

  const value = Number(match?.[1]);
  expect(Number.isNaN(value)).toBe(false);

  return value;
}

describe('the vendor chrome keeps the frames’ footprints', () => {
  const side = frames.match(SIDE_RULE)?.[1] ?? '';

  it('the frame declares the sidebar rule this test measures against', () => {
    expect(side).not.toBe('');
  });

  /*
   * The frame's own numbers, so a change to the bundle moves the expectation
   * rather than silently disagreeing with it.
   */
  const contentWidth = () => pxOf(side, /width:(\d+)px/);
  const gutter = () => pxOf(side, /padding:\d+px (\d+)px/);
  const border = () => pxOf(side, /border-right:(\d+)px/);

  const side1024 = frames.match(SIDE_1024_RULE);
  const contentWidth1024 = () => Number(side1024?.[1]);
  const gutter1024 = () => Number(side1024?.[3]);

  it('the frame declares the 1024 sidebar override this test measures against', () => {
    expect(side1024).not.toBeNull();
    expect(contentWidth1024()).toBe(220);
    expect(gutter1024()).toBe(10);
  });

  it('states a sidebar footprint of content + two gutters + one border', () => {
    // 240 + 12 + 12 + 1 = 265. Named here only to show the shape of the sum.
    expect(contentWidth() + gutter() * 2 + border()).toBe(265);
    // 220 + 10 + 10 + 1 = 241 at 1024 — a different sum, not the same one.
    expect(contentWidth1024() + gutter1024() * 2 + border()).toBe(241);
  });

  it('sizes the 1024 sidebar token to the 1024 frame’s content width', () => {
    const token = pxOf(themeCss, /--sidebar-width-md:\s*([\d.]+)rem/) * 16;

    expect(token).toBe(contentWidth1024());
  });

  it('sizes the sidebar token to the frame’s content width', () => {
    const token = pxOf(themeCss, /--sidebar-width:\s*([\d.]+)rem/) * 16;

    // The token is the *content* width, which is only true under box-content.
    expect(token).toBe(contentWidth());
  });

  /*
   * The gutters have to be on the `nav` itself. `box-content` can only add
   * padding the element declares, and with them on the inner list the nav
   * measured 241px in the browser — its border and nothing else. Reading the
   * whole file would pass on the list's own class, so the nav's class string
   * is isolated first.
   */
  it('opts the sidebar out of border-box and carries its own gutters', () => {
    const nav = read('src/components/vendor-nav.tsx');
    const navClasses = nav.match(/'(border-b [^']*lg:box-content[^']*)'/)?.[1] ?? '';

    expect(navClasses).not.toBe('');
    expect(navClasses).toContain('lg:box-content');
    /*
     * The gutter is a step, not a constant: 10px at 1024 and 12px at 1440. It
     * was a flat `lg:px-3`, which overshot the 1024 frame's footprint by 4px.
     */
    expect(navClasses).toContain(`lg:px-${gutter1024() / 4}`);
    expect(navClasses).toContain(`min-[90rem]:px-${gutter() / 4}`);
    expect(navClasses).toContain('lg:border-r');
  });

  it('drops the gutters from the list, so they are not counted twice', () => {
    const nav = read('src/components/vendor-nav.tsx');
    const listClasses = nav.match(/className="(flex gap-1 overflow-x-auto[^"]*)"/)?.[1] ?? '';

    expect(listClasses).not.toBe('');
    expect(listClasses).toContain('lg:px-0');
  });

  it('opts the unpublished dashboard rail out of border-box', () => {
    const rail = read('src/components/vendor/publish-checklist.tsx');
    const railClass = rail.match(/const RAIL_CLASS =\s*\n?\s*'([^']+)'/)?.[1] ?? '';

    expect(railClass).not.toBe('');
    // One aside, one class: the two-branch component this used to guard was
    // split in #322, so there is no longer a second copy to drift from.
    expect(rail.match(/className=\{RAIL_CLASS\}/g) ?? []).toHaveLength(1);

    expect(railClass).toContain('lg:box-content');
    expect(railClass).toContain('p-5');
    expect(railClass).toContain('border-l');
    /*
     * 300px at 1024 and 340px at 1440, per frames `27 Vendor dashboard — 1024`
     * and `08`. It was `hidden … xl:block` at a flat 340px, so the column two of
     * #322's frames draw did not render below 1280 at all.
     */
    expect(railClass).toContain('w-[300px]');
    expect(railClass).toContain('min-[90rem]:w-[340px]');
    expect(railClass).toContain('lg:block');
    expect(railClass, 'xl: is 1280, which no frame draws').not.toContain('xl:');
  });

  /*
   * The published column follows the same 300/340 ladder but is *inside* the
   * pane — frame `27 Vendor dashboard — 1024` draws it at `width:300px;
   * flex:none` with no border and no padding of its own, so `box-content` would
   * make it 300px of content plus nothing and is simply wrong here.
   */
  it('sizes the published dashboard column to the frame, inside the pane', () => {
    const rail = read('src/components/vendor/published-rail.tsx');
    const railClass = rail.match(/className="([^"]*w-\[300px\][^"]*)"/)?.[1] ?? '';

    expect(railClass).not.toBe('');
    expect(railClass).toContain('min-[90rem]:w-[340px]');
    expect(railClass).toContain('lg:flex');
    expect(railClass, 'the in-pane column draws no rail border').not.toContain('border-l');
    expect(railClass, 'no padding of its own, so no box-content').not.toContain('box-content');
    expect(railClass, 'xl: is 1280, which no frame draws').not.toContain('xl:');
  });

  /*
   * The availability rail is a grid track, so box-sizing cannot reach it: the
   * track sizes the aside rather than the aside sizing itself.
   */
  it('widens the availability track by the gutters and border it draws', () => {
    const calendar = read('src/components/availability/availability-calendar.tsx');
    const gutters = pxOf(calendar, /p-(5)\b/) * 4;
    const track = calendar.match(/calc\(var\(--list-pane\)\+(\d+)px\)/);

    expect(track).not.toBeNull();
    // 20 + 20 + 1 = 41.
    expect(Number(track?.[1])).toBe(gutters * 2 + 1);
  });

  it('leaves the shared list-pane token alone, because messaging uses it too', () => {
    const messaging = read('src/components/messaging/messages-screen.tsx');

    // No gutters and no left border there, so the token is already its
    // footprint; widening it would have pushed that list 41px wide.
    expect(messaging).toContain('w-[300px]');
    expect(pxOf(themeCss, /--list-pane:\s*([\d.]+)rem/) * 16).toBe(300);
  });
});
