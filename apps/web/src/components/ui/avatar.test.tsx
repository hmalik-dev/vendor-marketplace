import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Avatar, AVATAR_SIZES, avatarToneIndex, initialsFor, SERIF_FLOOR_PX } from './avatar';

describe('initialsFor', () => {
  it.each([
    ['Maya Fernandez', 'MF'],
    ['Prism Studio Collective', 'PC'],
    ['Cher', 'C'],
    ['  spaced   out  ', 'SO'],
  ])('reduces %s to %s', (name, expected) => {
    expect(initialsFor(name)).toBe(expected);
  });

  it('falls back to a placeholder rather than rendering an empty circle', () => {
    expect(initialsFor('   ')).toBe('?');
  });
});

describe('avatarToneIndex', () => {
  it('is stable for the same name, so a person keeps one colour', () => {
    expect(avatarToneIndex('Maya Fernandez')).toBe(avatarToneIndex('Maya Fernandez'));
  });

  it('always lands inside the tone range', () => {
    for (const name of ['Maya', 'Prism Studio', 'DJ Halcyon', 'Rowan Floral', '']) {
      const index = avatarToneIndex(name);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(1);
    }
  });

  it('spreads a real list across both tones rather than painting it one colour', () => {
    const names = ['Maya Fernandez', 'Prism Studio', 'DJ Halcyon', 'Rowan Floral', 'Bel Canto'];
    const tones = new Set(names.map(avatarToneIndex));

    expect(tones.size).toBe(2);
  });
});

/**
 * The rendered monogram, found by its slot rather than by its name.
 *
 * The geometry and typography checks below are about the circle, not about
 * what it announces — and since #411 an avatar is decorative unless the caller
 * says otherwise, so most of them have no accessible name to be found by. The
 * naming contract is asserted on its own, further down.
 */
function monogram(): HTMLElement {
  const found = document.querySelectorAll<HTMLElement>('[data-slot="avatar-fallback"]');
  const last = found[found.length - 1];

  if (last === undefined) {
    throw new Error('No avatar monogram rendered');
  }

  return last;
}

describe('Avatar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders initials when there is no photograph', () => {
    render(<Avatar name="Maya Fernandez" size="lg" />);

    expect(monogram().textContent).toBe('MF');
    expect(monogram().className).toContain('font-display');
  });

  /*
   * The naming contract, and the reason it is inverted.
   *
   * An avatar almost always sits beside the name it depicts — eleven of the
   * twelve call sites in this product do — and naming it again made a screen
   * reader read that name twice in a row on every vendor card, message row,
   * booking row and the checkout summary. So it is decoration by default and
   * says the name only when asked, which is the one case where nothing else
   * on screen does.
   */
  it('is decoration by default, so it does not repeat the name beside it', () => {
    render(<Avatar name="Maya Fernandez" />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(monogram().getAttribute('aria-hidden')).toBe('true');
    expect(monogram().getAttribute('aria-label')).toBeNull();
  });

  it('names itself when it is the only thing naming the person', () => {
    render(<Avatar name="Maya Fernandez" labelled />);

    const named = screen.getByRole('img', { name: 'Maya Fernandez' });
    expect(named.textContent).toBe('MF');
    expect(named.getAttribute('aria-hidden')).toBeNull();
  });

  it('leaves a decorative photograph with an empty alt rather than no alt', () => {
    const { container } = render(<Avatar name="Maya Fernandez" src="https://example.test/m.jpg" />);

    const image = container.querySelector('img');
    // `alt=""` is what marks an image decorative. A *missing* alt makes a
    // reader fall back to announcing the file name.
    expect(image?.getAttribute('alt')).toBe('');
    expect(screen.queryByRole('img')).toBeNull();
  });

  /*
   * The serif floor, per size. `01-foundations.md` states "Never below 16px"
   * as a rule of the type system, and `display-type.test.ts` enforces it over
   * the whole tree — except here, where the size comes from a numeric prop
   * through `style` and no class states it, so that guard cannot read it. This
   * is the check that closes the gap, and it reads the component's own sizes
   * rather than a list written down twice.
   *
   * Four of the sizes are below the floor and the frames draw all four in
   * Instrument Serif, so this is frame-versus-law. D24 rules for the law and
   * changes the face rather than the size: raising the glyph to 16px would
   * change the monogram's ratio in four frames and break their geometry.
   */
  it.each(Object.keys(AVATAR_SIZES) as (keyof typeof AVATAR_SIZES)[])(
    'sets the %s monogram in the display face only at or above the serif floor',
    (size) => {
      render(<Avatar name="Maya Fernandez" size={size} />);

      const avatar = monogram();
      const glyph = Number.parseFloat(avatar.style.fontSize);

      expect(glyph).toBeGreaterThan(0);

      if (glyph >= SERIF_FLOOR_PX) {
        expect(avatar.className).toContain('font-display');
        expect(avatar.className).not.toContain('font-sans');
      } else {
        expect(avatar.className).toContain('font-sans');
        expect(avatar.className).not.toContain('font-display');
      }
    },
  );

  it('has sizes on both sides of the floor, so the check above is not vacuous', () => {
    const glyphs = Object.keys(AVATAR_SIZES).map((size) => {
      render(<Avatar name="Maya Fernandez" size={size as keyof typeof AVATAR_SIZES} />);
      return Number.parseFloat(monogram().style.fontSize);
    });

    /*
     * Counted, not pinned to a total. The exact split moves whenever the design
     * gains a size — `receipt` (50) and `thumb` (54) each moved it — and pinning
     * it turns "the check above is not vacuous" into a change-detector that
     * fails on a size the check already covers. Both sides non-empty is the
     * property this test is named for; the sum is what proves no size went
     * unmeasured.
     */
    expect(glyphs.filter((glyph) => glyph < SERIF_FLOOR_PX).length).toBeGreaterThan(0);
    expect(glyphs.filter((glyph) => glyph >= SERIF_FLOOR_PX).length).toBeGreaterThan(0);
    expect(glyphs).toHaveLength(Object.keys(AVATAR_SIZES).length);
  });

  it('paints the fallback in clay or sage, never in one fixed colour', () => {
    render(<Avatar name="Maya Fernandez" />);

    expect(monogram().className).toMatch(/bg-(clay|sage)-100/);
  });

  it('renders the photograph when one exists, still with an accessible name', () => {
    render(<Avatar name="Maya Fernandez" src="https://example.test/maya.jpg" labelled />);

    const image = screen.getByRole('img', { name: 'Maya Fernandez' });
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('src')).toBe('https://example.test/maya.jpg');
  });

  /*
   * #395. The shape is a prop rather than a `className` the caller passes,
   * because `cn` is tailwind-merge and `rounded-panel` is a project token its
   * radius group does not know: `cn('rounded-full', 'rounded-panel')` returns
   * **both**, and which one paints is then generated-CSS source order rather
   * than the caller's choice. The class list is asserted directly for that
   * reason — jsdom performs no layout, so a computed radius here would be a
   * check that cannot fail.
   */
  it('carries exactly one radius, and it is the one the caller asked for', () => {
    render(<Avatar name="Maya Fernandez" />);
    expect(monogram().className).toContain('rounded-full');
    expect(monogram().className).not.toContain('rounded-panel');

    cleanup();
    render(<Avatar name="Maya Fernandez" size="thumb" shape="panel" />);
    expect(monogram().className).toContain('rounded-panel');
    expect(monogram().className).not.toContain('rounded-full');
  });

  it.each(Object.entries(AVATAR_SIZES))('sizes %s to %ipx square', (size, pixels) => {
    render(<Avatar name="Maya Fernandez" size={size as keyof typeof AVATAR_SIZES} />);

    expect(monogram().style.width).toBe(`${pixels}px`);
    expect(monogram().style.height).toBe(`${pixels}px`);
    cleanup();
  });

  it('adds the stone-0 border only when it overlaps imagery', () => {
    render(<Avatar name="Maya Fernandez" ring="card" />);
    expect(monogram().className).toContain('border-2 border-stone-0');

    cleanup();
    render(<Avatar name="Maya Fernandez" />);
    expect(monogram().className).not.toContain('border-stone-0');
  });

  /*
   * #361: the signed-in header shipped `alt="'s logo"` on both roles — a
   * possessive with an empty name in front of it, read out on every signed-in
   * page. The template was right and the value was not, so the guard belongs
   * here, where a name that is not a name stops producing a label at all.
   *
   * Both branches, because an avatar is an `<img>` when there is a photograph
   * and a monogram when there is not, and the two carry the name differently.
   */
  describe('a labelled avatar with no name to say', () => {
    it.each([
      ['', 'empty'],
      ['   ', 'blank'],
    ])('falls back to decorative when the name is %s (%s)', (name) => {
      const { container } = render(<Avatar name={name} labelled />);

      expect(screen.queryByRole('img')).toBeNull();
      expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    });

    it('gives a photograph an empty alt rather than a nameless one', () => {
      const { container } = render(
        <Avatar name="" src="https://example.test/cover.jpg" labelled />,
      );

      expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
    });

    it('still names the account when there is a name', () => {
      render(<Avatar name="Maya Fernandez" labelled />);

      const labelled = screen.getByRole('img');
      const label = labelled.getAttribute('aria-label') ?? '';

      expect(label).toBe('Maya Fernandez');
      // Never a bare possessive — the exact shape the header shipped.
      expect(label.startsWith("'")).toBe(false);
      expect(label.startsWith('’')).toBe(false);
    });
  });
});

/*
 * #422, and the half of it that is specifically *not* the tone block.
 *
 * D24 rules the avatar's fallback separately: `clay-150`/`sage-100` behind a
 * monogram, never the `stone-250` cover ground. Before this, a vendor whose
 * stored photograph was gone got the browser's broken-image glyph while a
 * vendor who never uploaded one got these initials — two situations the person
 * reading cannot tell apart, rendered two different ways.
 *
 * jsdom fetches nothing, so `fireEvent.error` stands in for the browser's own
 * event; `e2e/image-fallback.spec.ts` drives a real 404 in Chromium.
 */
describe('Avatar image failure', () => {
  afterEach(() => {
    cleanup();
  });

  it('falls back to the monogram, not the cover tone block', () => {
    const { container } = render(
      <Avatar name="Maya Fernandez" src="https://example.test/gone.jpg" size="xl" />,
    );

    fireEvent.error(container.querySelector('img')!);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('MF')).toBeDefined();
    expect(container.querySelector('[data-slot="image-fallback"]')).toBeNull();
    expect(container.querySelector('[data-slot="avatar-fallback"]')).not.toBeNull();
  });

  it('renders a failed photograph exactly as it renders an absent one', () => {
    const failed = render(<Avatar name="Maya Fernandez" src="https://example.test/gone.jpg" />);
    fireEvent.error(failed.container.querySelector('img')!);
    const failedHtml = failed.container.innerHTML;
    cleanup();

    const absent = render(<Avatar name="Maya Fernandez" src={null} />);

    expect(failedHtml).toBe(absent.container.innerHTML);
  });

  it('holds the avatar box, so a failure does not move the row it sits in', () => {
    const { container } = render(
      <Avatar name="Maya Fernandez" src="https://example.test/gone.jpg" size="lg" />,
    );

    fireEvent.error(container.querySelector('img')!);

    const monogram = container.querySelector('[data-slot="avatar-fallback"]') as HTMLElement;

    expect(monogram.style.width).toBe(`${AVATAR_SIZES.lg}px`);
    expect(monogram.style.height).toBe(`${AVATAR_SIZES.lg}px`);
  });

  it('keeps a labelled avatar named after its photograph fails', () => {
    const { container } = render(
      <Avatar name="Maya Fernandez" src="https://example.test/gone.jpg" labelled />,
    );

    fireEvent.error(container.querySelector('img')!);

    expect(screen.getByRole('img', { name: 'Maya Fernandez' })).toBeDefined();
  });
});
