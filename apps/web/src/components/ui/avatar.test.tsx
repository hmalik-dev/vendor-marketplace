import { cleanup, render, screen } from '@testing-library/react';
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

describe('Avatar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders initials when there is no photograph', () => {
    render(<Avatar name="Maya Fernandez" size="lg" />);

    const avatar = screen.getByRole('img', { name: 'Maya Fernandez' });
    expect(avatar.textContent).toBe('MF');
    expect(avatar.className).toContain('font-display');
  });

  /*
   * The serif floor, per size. `01-foundations.md` states "Never below 16px"
   * as a rule of the type system, and `display-type.test.ts` enforces it over
   * the whole tree — except here, where the size comes from a numeric prop
   * through `style` and no class states it, so that guard cannot read it. This
   * is the check that closes the gap, and it reads the component's own sizes
   * rather than a list written down twice.
   *
   * Four of the six sizes are below the floor and the frames draw all four in
   * Instrument Serif, so this is frame-versus-law. D24 rules for the law and
   * changes the face rather than the size: raising the glyph to 16px would
   * change the monogram's ratio in four frames and break their geometry.
   */
  it.each(Object.keys(AVATAR_SIZES) as (keyof typeof AVATAR_SIZES)[])(
    'sets the %s monogram in the display face only at or above the serif floor',
    (size) => {
      render(<Avatar name="Maya Fernandez" size={size} />);

      const avatar = screen.getByRole('img', { name: 'Maya Fernandez' });
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
      const rendered = screen.getAllByRole('img', { name: 'Maya Fernandez' }).at(-1);

      return Number.parseFloat((rendered as HTMLElement).style.fontSize);
    });

    expect(glyphs.filter((glyph) => glyph < SERIF_FLOOR_PX).length).toBe(4);
    expect(glyphs.filter((glyph) => glyph >= SERIF_FLOOR_PX).length).toBe(2);
  });

  it('paints the fallback in clay or sage, never in one fixed colour', () => {
    render(<Avatar name="Maya Fernandez" />);

    const avatar = screen.getByRole('img', { name: 'Maya Fernandez' });
    expect(avatar.className).toMatch(/bg-(clay|sage)-100/);
  });

  it('renders the photograph when one exists, still with an accessible name', () => {
    render(<Avatar name="Maya Fernandez" src="https://example.test/maya.jpg" />);

    const image = screen.getByRole('img', { name: 'Maya Fernandez' });
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('src')).toBe('https://example.test/maya.jpg');
  });

  it.each(Object.entries(AVATAR_SIZES))('sizes %s to %ipx square', (size, pixels) => {
    render(<Avatar name="Maya Fernandez" size={size as keyof typeof AVATAR_SIZES} />);

    const avatar = screen.getByRole('img', { name: 'Maya Fernandez' });
    expect(avatar.style.width).toBe(`${pixels}px`);
    expect(avatar.style.height).toBe(`${pixels}px`);
    cleanup();
  });

  it('adds the stone-0 border only when it overlaps imagery', () => {
    render(<Avatar name="Maya Fernandez" ring="card" />);
    expect(screen.getByRole('img', { name: 'Maya Fernandez' }).className).toContain(
      'border-2 border-stone-0',
    );

    cleanup();
    render(<Avatar name="Maya Fernandez" />);
    expect(screen.getByRole('img', { name: 'Maya Fernandez' }).className).not.toContain(
      'border-stone-0',
    );
  });
});
