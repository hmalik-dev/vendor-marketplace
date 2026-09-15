import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { VendorSurface } from './vendor-surface';

afterEach(cleanup);

/*
 * VEN-389. The heading block's measure was `max-w-prose` — 65ch, and `ch`
 * resolves against the block's inherited font-size. Declaring the 13.5px body
 * took it from 400.2px to 337.7px in the browser and wrapped the packages
 * description a line further. The width is a rem length now, independent of
 * whatever the block inherits; jsdom performs no layout, so the class is what
 * is asserted and the rendered width is the browser pass's.
 */
describe('VendorSurface heading measure', () => {
  it('caps the heading block at a font-independent 400px', () => {
    render(
      <VendorSurface
        eyebrow="Your business"
        heading="Packages"
        description="What a customer books."
      >
        <div />
      </VendorSurface>,
    );

    const block = screen.getByRole('heading', { level: 1 }).parentElement;
    const classes = (block?.className ?? '').split(/\s+/);

    expect(classes).toContain('max-w-100');
    expect(classes.filter((c) => /ch\]$|^max-w-prose$/.test(c))).toEqual([]);
  });
});
