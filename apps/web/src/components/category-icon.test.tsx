import { CATEGORY_SEEDS } from '@vendor-marketplace/shared';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryIcon, CategoryIconBadge, iconComponentFor } from './category-icon';

describe('iconComponentFor', () => {
  it('resolves every icon name the category seeds ship', () => {
    // A seed whose icon has no component would render the fallback, quietly
    // losing the category's identity everywhere it appears.
    for (const seed of CATEGORY_SEEDS) {
      expect(iconComponentFor(seed.icon).displayName, seed.slug).not.toBe('Shapes');
    }
  });

  it('falls back to a real glyph rather than nothing', () => {
    expect(iconComponentFor('no-such-icon').displayName).toBe('Shapes');
    expect(iconComponentFor(null).displayName).toBe('Shapes');
    expect(iconComponentFor(undefined).displayName).toBe('Shapes');
  });

  it('maps photography to the camera mark', () => {
    expect(iconComponentFor('camera').displayName).toBe('Camera');
  });
});

describe('CategoryIcon', () => {
  it('hides the glyph from assistive tech, since the name travels beside it', () => {
    const { container } = render(<CategoryIcon icon="camera" />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders a glyph for an unknown icon instead of an empty box', () => {
    const { container } = render(<CategoryIcon icon="mystery" />);

    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('CategoryIconBadge', () => {
  it('sizes the inline badge at 28px and the card badge at 40px', () => {
    const inline = render(<CategoryIconBadge icon="music" />);
    expect(inline.container.firstElementChild?.className).toContain('size-7');

    const card = render(<CategoryIconBadge icon="music" size="card" />);
    expect(card.container.firstElementChild?.className).toContain('size-10');
  });

  it('puts the glyph in the primary circle the icon spec calls for', () => {
    const { container } = render(<CategoryIconBadge icon="music" />);

    expect(container.firstElementChild?.className).toContain('bg-clay-100');
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
