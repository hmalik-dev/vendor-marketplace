import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Spinner } from './spinner';

afterEach(cleanup);

/**
 * The frame's `.spin` is a complete faint ring with one solid leading quarter,
 * not a solid ring with a gap. At 16px the gap version reads as a broken
 * circle rather than as motion.
 */
describe('Spinner', () => {
  it('is a faint ring with a solid leading quarter, at the frame’s timing', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');

    expect(spinner.className).toContain('border-clay-400/28');
    expect(spinner.className).toContain('border-t-clay-400');
    expect(spinner.className).toContain('[animation-duration:.8s]');
  });

  it('announces itself, because a silent spinner says nothing to a screen reader', () => {
    render(<Spinner />);

    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Working');
  });
});
