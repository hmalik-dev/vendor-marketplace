import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Avatar, AVATAR_SIZES, avatarToneIndex, initialsFor } from './avatar';

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

  it('renders initials in the display face when there is no photograph', () => {
    render(<Avatar name="Maya Fernandez" />);

    const avatar = screen.getByRole('img', { name: 'Maya Fernandez' });
    expect(avatar.textContent).toBe('MF');
    expect(avatar.className).toContain('font-display');
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
