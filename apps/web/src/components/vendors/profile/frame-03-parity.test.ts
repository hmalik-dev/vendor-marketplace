import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/*
 * Frame `03 Vendor profile` is the acceptance criterion for the profile screen,
 * so every expectation below is READ OUT OF THE FRAME at test time rather than
 * written down as a number. A design re-import that moves the contract fails
 * here instead of passing silently, which is the whole point of the exercise.
 *
 * The frame's own numbers were also confirmed by rendering it headless at
 * 1440x900 and reading computed styles; the parity sweep ledger disagreed on
 * two of them (it recorded a 14px avatar overlap and a 39px `.inp` height,
 * where the frame renders 16px and 38px) and the frame wins.
 */

const frameHtml = readFileSync(
  join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
  'utf8',
);

/** The markup of one screen frame, selected by its `data-screen-label`. */
function frame(label: string): string {
  const start = frameHtml.indexOf(`data-screen-label="${label}"`);
  expect(start, `frame "${label}" is missing from the design file`).toBeGreaterThan(-1);

  // Frames are siblings, so the next one's marker is this one's end.
  const next = frameHtml.indexOf('data-screen-label="', start + 1);
  return frameHtml.slice(start, next === -1 ? frameHtml.length : next);
}

const FRAME_03 = frame('03 Vendor profile');

/** Every `style="..."` body in source order. */
const INLINE_STYLES = [...FRAME_03.matchAll(/style="([^"]*)"/g)].map((match) => match[1] as string);

/** The first inline style whose body matches every fragment given. */
function styleContaining(...fragments: readonly string[]): string {
  const found = INLINE_STYLES.find((style) =>
    fragments.every((fragment) => style.includes(fragment)),
  );
  expect(found, `no inline style in frame 03 contains ${fragments.join(' + ')}`).toBeDefined();
  return found as string;
}

/** One declaration's value out of a style body. */
function declaration(style: string, property: string): string {
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(style);
  expect(match, `"${property}" is missing from "${style}"`).not.toBeNull();
  return (match as RegExpExecArray)[1]!.trim();
}

/** The `px` numbers of a shorthand, in source order. */
function pxParts(value: string): number[] {
  return value.split(/\s+/).map((part) => Number.parseFloat(part));
}

describe('frame 03 — the profile is full-bleed (#103)', () => {
  /*
   * The frame lays the screen out as a full-width row: a fluid content column
   * beside a fixed rail. Both columns carry their own padding, and it is that
   * padding — not a centred max-width container — that makes the gutters.
   */
  const railStyle = styleContaining('width:380px', 'flex:none');
  const contentStyle = styleContaining('padding:18px 28px 0 40px');

  const railWidth = Number.parseFloat(declaration(railStyle, 'width'));
  const [, railRight] = pxParts(declaration(railStyle, 'padding'));
  const [, contentRight, , contentLeft] = pxParts(declaration(contentStyle, 'padding'));

  const source = readFileSync(
    join(process.cwd(), 'src', 'app', 'vendors', '[slug]', 'page.tsx'),
    'utf8',
  );
  const headerSource = readFileSync(
    join(process.cwd(), 'src', 'components', 'vendors', 'profile', 'profile-header.tsx'),
    'utf8',
  );

  it('reads the frame contract it is asserting against', () => {
    expect(railWidth).toBe(380);
    expect(railRight).toBe(40);
    expect(contentLeft).toBe(40);
    expect(contentRight).toBe(28);
  });

  it('sizes the rail column to the frame width', () => {
    expect(headerSource).toContain(`lg:grid-cols-[minmax(0,1fr)_${railWidth}px]`);
  });

  it('pads the shell to the frame gutter instead of centring a max-width box', () => {
    // 40px === Tailwind's `10` step, 28px === `7`.
    expect(headerSource).toContain(`lg:px-${contentLeft / 4}`);
    expect(headerSource).toContain(`lg:gap-x-${contentRight / 4}`);
  });

  it('leaves no centred container on either the shell or the identity block', () => {
    expect(source).not.toMatch(/max-w-7xl/);
    expect(headerSource).not.toMatch(/max-w-7xl/);
    expect(source).not.toMatch(/mx-auto grid/);
  });
});

describe('frame 03 — the rail starts level with the identity row (#104)', () => {
  /*
   * In the frame both columns open directly under the banner: the rail's own
   * `padding-top` is the entire gap between the banner's bottom edge and the
   * rail card. Laying the identity block out first and the rail out afterwards
   * — which is what shipped — dropped the card 102.8px below the banner
   * instead of 20px.
   */
  const railStyle = styleContaining('width:380px', 'flex:none');
  const [railTop] = pxParts(declaration(railStyle, 'padding'));

  const headerSource = readFileSync(
    join(process.cwd(), 'src', 'components', 'vendors', 'profile', 'profile-header.tsx'),
    'utf8',
  );
  const pageSource = readFileSync(
    join(process.cwd(), 'src', 'app', 'vendors', '[slug]', 'page.tsx'),
    'utf8',
  );

  it('reads the frame contract it is asserting against', () => {
    expect(railTop).toBe(20);
  });

  it('offsets the rail column from the banner by the frame padding', () => {
    // 20px === Tailwind's `5` step.
    expect(headerSource).toContain(`lg:pt-${railTop / 4}`);
  });

  it('opens both columns inside the wrapper that also holds the banner', () => {
    // The banner, the identity row and the rail slot are all one wrapper deep,
    // which is both the frame's layout and the non-clipping guarantee the
    // avatar overlap depends on.
    const wrapper = headerSource.indexOf('relative overflow-visible');
    const banner = headerSource.indexOf('data-testid="profile-cover"');
    const row = headerSource.indexOf('lg:grid-cols-[minmax(0,1fr)_380px]');
    const railSlot = headerSource.indexOf('{rail}');

    expect(wrapper).toBeGreaterThan(-1);
    expect(banner).toBeGreaterThan(wrapper);
    expect(row).toBeGreaterThan(banner);
    expect(railSlot).toBeGreaterThan(row);
  });

  it('no longer lays the rail out in a second row below the header', () => {
    expect(pageSource).not.toMatch(/lg:grid-cols-/);
    expect(pageSource).toContain('rail={');
  });
});
