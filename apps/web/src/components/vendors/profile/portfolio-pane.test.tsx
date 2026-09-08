import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { WirePortfolioItem } from '@/lib/wire-schemas';
import { PortfolioPane } from './portfolio-pane';

/*
 * The lightbox's focus contract (#411).
 *
 * It declared `role="dialog" aria-modal="true"` — a claim that the rest of the
 * page is inert — and implemented none of it: nothing focused the dialog,
 * nothing trapped Tab, and nothing put focus back. A keyboard user opened it
 * and then tabbed through the profile *underneath* the scrim, with the scrim
 * hiding whatever they had reached. The component's own docstring said focus
 * was returned to the thumbnail, and it never was.
 *
 * Every assertion here is about `document.activeElement`, because that is the
 * whole of what was wrong and none of it is visible in a rendered tree.
 */

function items(count: number): WirePortfolioItem[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `item-${index + 1}`,
    vendorId: 'vendor-1',
    caption: `Photograph ${index + 1}`,
    displayOrder: index,
    imageUrl: `https://example.test/${index + 1}-full.jpg`,
    thumbnailUrl: `https://example.test/${index + 1}-thumb.jpg`,
    createdAt: new Date('2026-06-14T00:00:00Z'),
  }));
}

function pane(count = 3): void {
  render(
    <PortfolioPane
      items={items(count)}
      businessName="Kessler & Co."
      signedIn
      viewerOwnsProfile={false}
    />,
  );
}

/** The dialog, once open. */
function lightbox(): HTMLElement {
  return screen.getByRole('dialog');
}

describe('PortfolioPane lightbox', () => {
  afterEach(() => {
    cleanup();
  });

  it('moves focus into the dialog when it opens', async () => {
    const user = userEvent.setup();
    pane();

    await user.click(screen.getByRole('button', { name: 'Photograph 2' }));

    // The container, not the close button: it carries the dialog's accessible
    // name, so landing on it is what announces which image opened.
    expect(document.activeElement).toBe(lightbox());
    expect(lightbox().getAttribute('aria-label')).toBe('Photograph 2');
  });

  it('keeps Tab inside the dialog rather than walking the page behind it', async () => {
    const user = userEvent.setup();
    pane();

    await user.click(screen.getByRole('button', { name: 'Photograph 1' }));

    const controls = Array.from(lightbox().querySelectorAll('button'));
    // Close, Previous, Next — the three the dialog draws for a multi-image set.
    expect(controls.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Close',
      'Previous image',
      'Next image',
    ]);

    for (const control of controls) {
      await user.tab();
      expect(document.activeElement).toBe(control);
    }

    // Off the last control, Tab wraps to the first — it does not leave.
    await user.tab();
    expect(document.activeElement).toBe(controls[0]);
    expect(lightbox().contains(document.activeElement)).toBe(true);
  });

  it('wraps backwards off the first control too', async () => {
    const user = userEvent.setup();
    pane();

    await user.click(screen.getByRole('button', { name: 'Photograph 1' }));

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));

    // Shift+Tab off the first control leaves by the other door, and is the
    // same defect as walking out of the last.
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next image' }));
    expect(lightbox().contains(document.activeElement)).toBe(true);
  });

  /*
   * The state the trap was open at, and the one every viewer starts in.
   *
   * On open, focus is on the container — `tabIndex={-1}`, so not in the
   * sequential order. Forward Tab walks into the dialog's buttons by DOM
   * order and looks fine; Shift+Tab fell through to the browser default and
   * landed on the last thumbnail *before* the dialog, underneath the scrim.
   * The earlier test pressed Tab first, so it never saw this.
   */
  it('traps Shift+Tab pressed straight after opening, before any Tab', async () => {
    const user = userEvent.setup();
    pane();

    await user.click(screen.getByRole('button', { name: 'Photograph 2' }));
    expect(document.activeElement).toBe(lightbox());

    await user.tab({ shift: true });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next image' }));
    expect(lightbox().contains(document.activeElement)).toBe(true);
  });

  it('returns focus to the thumbnail that opened it', async () => {
    const user = userEvent.setup();
    pane();

    const thumbnail = screen.getByRole('button', { name: 'Photograph 3' });
    await user.click(thumbnail);
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(thumbnail);
  });

  it('returns focus to the thumbnail after Escape, not to wherever focus was', async () => {
    const user = userEvent.setup();
    pane();

    const thumbnail = screen.getByRole('button', { name: 'Photograph 2' });
    await user.click(thumbnail);
    // Move focus off the container first: closing from a control inside the
    // dialog is exactly where "restore wherever focus is now" gets it wrong.
    await user.tab();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(thumbnail);
  });

  it('does not re-take focus while the arrows step between images', async () => {
    const user = userEvent.setup();
    pane();

    await user.click(screen.getByRole('button', { name: 'Photograph 1' }));
    const next = screen.getByRole('button', { name: 'Next image' });
    next.focus();

    await user.keyboard('{ArrowRight}');

    // The image changed and focus stayed on the arrow the viewer is pressing.
    expect(lightbox().getAttribute('aria-label')).toBe('Photograph 2');
    expect(document.activeElement).toBe(next);
  });
});

/*
 * #422. A masonry tile takes its height from the photograph's own ratio, so a
 * failed load left the browser's broken-image glyph in a box the grid had
 * already sized around. The block replaces it *and* states a ratio — a tone
 * block on a zero-height box has replaced nothing (`web-design-parity.md`).
 *
 * jsdom fetches nothing, so `fireEvent.error` stands in for the browser's own
 * event; `e2e/image-fallback.spec.ts` drives a real 404 in Chromium.
 */
describe('PortfolioPane image failure', () => {
  afterEach(() => {
    cleanup();
  });

  it('replaces a tile whose photograph 404s with a tone block that has extent', () => {
    const { container } = render(
      <PortfolioPane
        items={items(3)}
        businessName="Kessler & Co."
        signedIn
        viewerOwnsProfile={false}
      />,
    );

    fireEvent.error(container.querySelector('img[src*="1-thumb.jpg"]')!);

    const block = container.querySelector('[data-slot="image-fallback"]');

    expect(container.querySelector('img[src*="1-thumb.jpg"]')).toBeNull();
    expect(block?.className).toContain('bg-stone-250');
    expect(block?.className).toContain('aspect-[4/3]');
    expect(block?.textContent).toBe('');
    /* Only the failed tile is replaced. */
    expect(container.querySelectorAll('[data-slot="image-fallback"]')).toHaveLength(1);
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });

  it('replaces a lightbox photograph that fails with a block of stated extent', async () => {
    render(
      <PortfolioPane
        items={items(1)}
        businessName="Kessler & Co."
        signedIn
        viewerOwnsProfile={false}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Photograph 1' }));

    const dialog = screen.getByRole('dialog');

    fireEvent.error(dialog.querySelector('img')!);

    const block = dialog.querySelector('[data-slot="image-fallback"]');

    expect(dialog.querySelector('img')).toBeNull();
    expect(block?.className).toContain('bg-stone-250');
    expect(block?.className).toContain('aspect-[4/3]');
  });
});

/**
 * #458 — the vendor whose portfolio this is gets no control to report their
 * own photographs. Each case renders the same three tiles and asserts they
 * are there, so an absent control is distinguishable from an absent pane.
 */
describe('PortfolioPane — the report control', () => {
  it('offers one per photo to a reader who does not own them', () => {
    render(
      <PortfolioPane
        items={items(3)}
        businessName="Kessler & Co."
        signedIn
        viewerOwnsProfile={false}
      />,
    );

    expect(screen.getAllByRole('button', { name: /Photograph/ })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Report this photo' })).toHaveLength(3);
  });

  it('offers none to the vendor who owns them', () => {
    render(
      <PortfolioPane items={items(3)} businessName="Kessler & Co." signedIn viewerOwnsProfile />,
    );

    expect(screen.getAllByRole('button', { name: /Photograph/ })).toHaveLength(3);
    expect(screen.queryByText(/report this photo/i)).toBeNull();
  });
});
