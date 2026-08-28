import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageLoader } from './page-loader';

afterEach(cleanup);

/**
 * This is the one surface that renders before webfonts are guaranteed, which
 * is the whole reason it is geometry rather than the wordmark: a brand name in
 * a fallback serif is a worse first impression than no brand name.
 */
describe('PageLoader', () => {
  it('draws the mark as two rings and nothing else', () => {
    const { container } = render(<PageLoader />);
    const rings = container.querySelectorAll('span[aria-hidden] > span');

    expect(rings).toHaveLength(2);
    expect(rings[0]?.className).toContain('bg-clay-400');
    expect(rings[1]?.className).toContain('border-stone-900');
  });

  /*
   * The acceptance criterion, as an executable check rather than a promise:
   * nothing in the loader's source paints text. `sr-only` is the exception it
   * has to make, because a silent wait says nothing to a screen reader.
   */
  it('has no visible text — the source paints none', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/ui/page-loader.tsx'), 'utf8');

    expect(source).not.toContain('BRAND_NAME');
    expect(source).not.toContain('font-display');
  });

  it('announces the wait to a screen reader without painting it', () => {
    render(<PageLoader />);

    const label = screen.getByText('Loading');
    expect(label.className).toContain('sr-only');
    expect(screen.getByRole('status')).toBeDefined();
  });

  /*
   * Under reduced motion the rings simply keep their laid-out positions — the
   * mark's static overlap — because the animation is the only thing that moves
   * them and it is gated behind `motion-safe`.
   */
  it('animates only when motion is safe, settling to the overlap otherwise', () => {
    const { container } = render(<PageLoader />);
    const rings = container.querySelectorAll('span[aria-hidden] > span');

    expect(rings[0]?.className).toContain('motion-safe:animate-mark-converge-left');
    expect(rings[1]?.className).toContain('motion-safe:animate-mark-converge-right');
    expect(rings[0]?.className).toContain('left-0');
    expect(rings[1]?.className).toContain('left-5.5');
  });

  /* Frame `26`: 52x30 holding two 30px rings that overlap by 8px. */
  it('keeps the mark’s own construction', () => {
    const { container } = render(<PageLoader />);
    const frame = container.querySelector('span[aria-hidden]');
    const rings = container.querySelectorAll('span[aria-hidden] > span');

    expect(frame?.className).toContain('h-7.5');
    expect(frame?.className).toContain('w-13');
    expect(rings[0]?.className).toContain('size-7.5');
    // Drawn inside the same 30px, or the outlined ring would be 34px.
    expect(rings[1]?.className).toContain('box-border');
  });
});
