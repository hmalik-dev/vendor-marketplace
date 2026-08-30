import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let pathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

const { HeaderNav } = await import('./header-nav');

/*
 * #90. The header inset is read out of the frame file at test time rather than
 * written down here, so a design re-import that moves it fails this test
 * instead of passing silently — the same rule `type-scale-parity.test.ts`
 * follows.
 */
const frameHtml = readFileSync(
  join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
  'utf8',
);

/**
 * The horizontal padding frame `<label>` puts on its header, in px.
 *
 * `.hd` carries the default in the stylesheet and each frame overrides it
 * inline, so the override is what the screen is actually drawn with.
 */
function frameHeaderInset(label: string): number {
  const frame = frameHtml.slice(frameHtml.indexOf(`data-screen-label="${label}"`));
  const header = frame.slice(0, frame.indexOf('</div>'));
  const padding = /class="hd" style="[^"]*padding:0 (\d+)px/.exec(header);

  if (!padding?.[1]) {
    throw new Error(`Frame "${label}" does not override .hd's horizontal padding`);
  }

  return Number(padding[1]);
}

/** The px a Tailwind spacing class resolves to — the scale is 4px per unit. */
function insetFromClass(className: string, variant: string): number {
  const utility = new RegExp(`${variant.replaceAll(/[[\]]/g, String.raw`\$&`)}:px-([\\d.]+)`).exec(
    className,
  );

  if (!utility?.[1]) {
    throw new Error(`No \`${variant}:px-*\` in "${className}"`);
  }

  return Number(utility[1]) * 4;
}

function navClass(): string {
  return screen.getByRole('navigation', { name: 'Main' }).className;
}

describe('HeaderNav', () => {
  afterEach(() => {
    pathname = '/';
    cleanup();
  });

  it('insets the header on /search by exactly what frame 02 draws', () => {
    pathname = '/search';
    render(
      <HeaderNav>
        <span>content</span>
      </HeaderNav>,
    );

    // 1440 is the viewport every desktop frame is drawn at, so the frame's
    // inset is asserted against the class that takes effect there.
    expect(insetFromClass(navClass(), 'min-[90rem]')).toBe(frameHeaderInset('02 Search'));
  });

  it('agrees with the two other search frames, which draw the same inset', () => {
    // `02` is not on its own: the loading and empty states of the same screen
    // draw the same header, so one number has to satisfy all three.
    expect(frameHeaderInset('17 Search loading')).toBe(frameHeaderInset('02 Search'));
    expect(frameHeaderInset('18 Search no results')).toBe(frameHeaderInset('02 Search'));
  });

  /*
   * This used to assert `lg` against frame `01 Landing` and forbid a
   * `min-[90rem]` step — which read `lg` as "desktop" and so pinned 1024 to the
   * 1440 gutter. That is the #169 defect stated as a test: `lg` is 1024, and
   * 1024 has a frame of its own drawing a narrower inset.
   *
   * Now each step is checked against the frame drawn at that width.
   */
  it('steps the landing inset at each width the frames draw one', () => {
    pathname = '/';
    render(
      <HeaderNav>
        <span>content</span>
      </HeaderNav>,
    );

    const className = navClass();

    expect(insetFromClass(className, 'lg')).toBe(frameHeaderInset('27 Landing — 1024'));
    expect(insetFromClass(className, 'min-[90rem]')).toBe(frameHeaderInset('01 Landing'));

    /*
     * 768 rides on `sm:`, not on the unprefixed base. The base belongs to the
     * six `14 … mobile` frames, which draw this header at 16px — so the two
     * cannot be the same declaration, and reading the unprefixed one as the
     * 768 value is how raising it to 20px moved every mobile frame at once.
     */
    const tablet = /(?:^|\s)sm:px-([\d.]+)(?=\s|$)/.exec(className);
    expect(tablet, `no \`sm:px-*\` in "${className}"`).not.toBeNull();
    expect(Number((tablet as RegExpExecArray)[1]) * 4).toBe(frameHeaderInset('14 Landing tablet'));

    const base = /(?:^|\s)px-([\d.]+)(?=\s|$)/.exec(className);
    expect(base, `no unprefixed \`px-*\` in "${className}"`).not.toBeNull();
    expect(Number((base as RegExpExecArray)[1]) * 4).toBe(frameHeaderInset('14 Landing mobile'));
  });

  /*
   * The three are deliberately different, and that is the whole point of the
   * ticket — asserted against the frames rather than as constants, so a
   * re-import that genuinely unifies two widths updates this instead of
   * failing it.
   */
  it('does not put 768, 1024 and 1440 on one inset', () => {
    const insets = [
      frameHeaderInset('14 Landing tablet'),
      frameHeaderInset('27 Landing — 1024'),
      frameHeaderInset('01 Landing'),
    ];

    expect(new Set(insets).size, `the frames draw ${insets.join('/')}`).toBe(3);
  });

  it('renders its children inside the labelled nav', () => {
    pathname = '/search';
    render(
      <HeaderNav>
        <span>content</span>
      </HeaderNav>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main' });

    expect(nav.contains(screen.getByText('content'))).toBe(true);
  });
});
