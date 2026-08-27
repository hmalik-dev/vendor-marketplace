import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PhotoCluster } from './photo-cluster';

describe('PhotoCluster', () => {
  afterEach(() => {
    cleanup();
  });

  it('stacks three photographs, one per kind of vendor', () => {
    const { container } = render(<PhotoCluster />);

    const sources = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(sources).toHaveLength(3);
    // Three different shots — a stack of three of the same proves nothing.
    expect(new Set(sources).size).toBe(3);
    for (const src of sources) {
      // next/image rewrites through its loader, so the path arrives encoded.
      expect(src).toMatch(/%2Fstock%2F/);
    }
  });

  it('keeps the photographs decorative, so no alt text is read twice', () => {
    const { container } = render(<PhotoCluster />);

    for (const img of container.querySelectorAll('img')) {
      expect(img.getAttribute('alt')).toBe('');
    }
    // The headline beside the cluster is what names the page.
    expect(screen.queryByRole('img')).toBeNull();
  });

  /*
   * The frame's floating chip is deferred post-MVP: reply time is the implied
   * ranking mechanic open question 2 says not to ship, and one hand-picked
   * vendor's rating on the hero is marketing rather than a query result.
   */
  it('floats no vendor chip over the stack', () => {
    const { container } = render(<PhotoCluster />);

    expect(screen.queryByText(/★/)).toBeNull();
    expect(container.textContent).not.toMatch(/replies in/i);
  });
});
