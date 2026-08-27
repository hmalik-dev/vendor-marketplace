import { CATEGORY_SEEDS, LANDING_CATEGORY_COUNT } from '@vendor-marketplace/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import NotFound from './not-found';

describe('NotFound', () => {
  afterEach(() => {
    cleanup();
  });

  it('says what happened without blaming the visitor', () => {
    render(<NotFound />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('This page isn’t here');
    expect(screen.getByText(/Nothing is wrong with your account/)).toBeDefined();
  });

  /*
   * A 404 on a marketplace is almost always a stale vendor URL, so the recovery
   * is the kind of vendor the visitor wanted — not a bare "go home". Frame `15`.
   */
  it('recovers through category links, not just home', () => {
    render(<NotFound />);

    const links = screen.getAllByRole('link');
    const hrefs = links.map((link) => link.getAttribute('href'));

    for (const seed of CATEGORY_SEEDS.slice(0, LANDING_CATEGORY_COUNT)) {
      expect(hrefs, seed.slug).toContain(`/search?category=${seed.slug}`);
    }

    expect(hrefs).toContain('/search');
    expect(hrefs).toContain('/');
  });

  it('keeps the copy to one sentence per job', () => {
    render(<NotFound />);

    // No apology paragraphs, no "Oops", no exclamation marks — `40-states.md`.
    const text = document.body.textContent ?? '';

    expect(text).not.toMatch(/oops/i);
    expect(text).not.toContain('!');
    expect(text).not.toMatch(/sorry/i);
  });

  it('draws the broken mark rather than an oversized 404', () => {
    render(<NotFound />);

    expect(screen.getByTestId('broken-mark')).toBeDefined();
    // The numeral is present, but as a small mono eyebrow, not the illustration.
    expect(screen.getByText('404 · Not found')).toBeDefined();
  });

  it('names the six categories the landing leads with', () => {
    render(<NotFound />);

    const list = screen.getByRole('list');

    expect(within(list).getAllByRole('link')).toHaveLength(LANDING_CATEGORY_COUNT);
  });
});
