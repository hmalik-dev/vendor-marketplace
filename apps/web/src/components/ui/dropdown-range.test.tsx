import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RangeDropdown } from './dropdown-range';

afterEach(cleanup);

/*
 * VEN-420. Frame `28 Dropdown variants` draws each thumb `width:11px;
 * border:2px` in a document with no box-sizing reset, so it paints 15px;
 * border-box painted 11px. jsdom does no layout, so the box model is pinned by
 * class, on the split list so a longer class cannot satisfy it.
 */
describe('RangeDropdown thumbs', () => {
  it('paints both thumbs content-box, as the frame does', () => {
    render(
      <RangeDropdown
        open
        onOpenChange={vi.fn()}
        trigger={<button type="button">Price</button>}
        label="Price"
        caption="starting rate"
        value={{ min: 50_000, max: 150_000 }}
        onApply={vi.fn()}
        presets={[]}
        bounds={{ min: 0, max: 500_000 }}
        format={(value) => `$${value / 100}`}
        parse={(raw) => Number(raw) * 100}
        toEditable={(value) => String(value / 100)}
      />,
    );

    const thumbs = Array.from(document.querySelectorAll('span.size-\\[11px\\]'));

    expect(thumbs).toHaveLength(2);
    for (const thumb of thumbs) {
      const classes = thumb.className.split(' ');
      expect(classes).toContain('border-2');
      expect(classes).toContain('box-content');
    }
  });
});
