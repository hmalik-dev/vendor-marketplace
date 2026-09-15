import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BrokenMark } from './broken-mark';

/**
 * Frame `15`'s mark come loose (VEN-419): two 46px circles, the dashed one at
 * `left:28px` in a 74x46 box. The empty-state marks on frames `18`–`20` draw the
 * same ~0.61 D offset, so this is the frames' loose geometry — not the logo's
 * 0.45 overlap, which `logo.test.tsx` pins separately.
 */
describe('BrokenMark', () => {
  afterEach(cleanup);

  function geometry() {
    render(<BrokenMark />);
    const box = screen.getByTestId('broken-mark');
    const [filled, dashed] = Array.from(box.children) as HTMLElement[];

    return { box, filled: filled!, dashed: dashed! };
  }

  it('draws a 74x46 composite', () => {
    const { box } = geometry();

    expect(box.style.width).toBe('74px');
    expect(box.style.height).toBe('46px');
  });

  it('draws two 46px circles, the second at left 28px', () => {
    const { filled, dashed } = geometry();

    expect([filled.style.width, filled.style.height]).toEqual(['46px', '46px']);
    expect([dashed.style.width, dashed.style.height]).toEqual(['46px', '46px']);
    expect(dashed.style.left).toBe('28px');
  });

  it('stays hidden from the accessibility tree', () => {
    expect(geometry().box.getAttribute('aria-hidden')).toBe('true');
  });
});
