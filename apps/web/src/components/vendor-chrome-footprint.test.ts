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

  it('states a sidebar footprint of content + two gutters + one border', () => {
    // 240 + 12 + 12 + 1 = 265. Named here only to show the shape of the sum.
    expect(contentWidth() + gutter() * 2 + border()).toBe(265);
  });

  it('sizes the sidebar token to the frame’s content width', () => {
    const token = pxOf(themeCss, /--sidebar-width:\s*([\d.]+)rem/) * 16;

    // The token is the *content* width, which is only true under box-content.
    expect(token).toBe(contentWidth());
  });

  it('opts the sidebar out of border-box so the token is content width', () => {
    const nav = read('src/components/vendor-nav.tsx');

    expect(nav).toContain('lg:box-content');
    // The gutters the sum above depends on.
    expect(nav).toContain('lg:px-3');
    expect(nav).toContain('lg:border-r');
  });

  it('opts the dashboard rail out of border-box, on both of its states', () => {
    const rail = read('src/components/vendor/publish-checklist.tsx');
    const declarations = rail.match(/xl:box-content/g) ?? [];

    // The checklist renders a loading aside and a loaded one; a fix applied to
    // only one of them shows up as a jump when the data arrives.
    expect(declarations).toHaveLength(2);
    expect(rail).toContain('p-5');
    expect(rail).toContain('border-l');
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
