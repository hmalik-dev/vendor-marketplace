import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  render(<PortfolioPane items={items(count)} businessName="Kessler & Co." />);
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

  it('sizes each control to the 48px circle, over the 44x44 icon-button floor (VEN-731)', async () => {
    const user = userEvent.setup();
    pane();

    await user.click(screen.getByRole('button', { name: 'Photograph 1' }));

    // Class-level only: jsdom performs no layout, so the rendered 48x48 box is
    // measured in a browser pass, not here. `p-2` around a `size-5` icon drew
    // 36x36; the box now states its own extent and centres the icon.
    for (const control of Array.from(lightbox().querySelectorAll('button'))) {
      const classes = control.className.split(/\s+/);
      expect(classes).toEqual(expect.arrayContaining(['size-12', 'grid', 'place-items-center']));
      expect(classes).not.toContain('p-2');
    }
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
    const { container } = render(<PortfolioPane items={items(3)} businessName="Kessler & Co." />);

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
    render(<PortfolioPane items={items(1)} businessName="Kessler & Co." />);

    await userEvent.click(screen.getByRole('button', { name: 'Photograph 1' }));

    const dialog = screen.getByRole('dialog');

    fireEvent.error(dialog.querySelector('img')!);

    const block = dialog.querySelector('[data-slot="image-fallback"]');

    expect(dialog.querySelector('img')).toBeNull();
    expect(block?.className).toContain('bg-stone-250');
    expect(block?.className).toContain('aspect-[4/3]');
  });
});

/*
 * VEN-729 — the report control is gone from the portfolio, for every reader.
 * Each case asserts the tiles are there, so an absent control is
 * distinguishable from an absent pane. Reporting a photo goes through Contact
 * Support.
 */
describe('PortfolioPane — no report control', () => {
  afterEach(() => {
    cleanup();
  });

  it('draws none for a signed-out reader', () => {
    render(<PortfolioPane items={items(3)} businessName="Kessler & Co." />);

    expect(screen.getAllByRole('button', { name: /Photograph/ })).toHaveLength(3);
    expect(screen.queryByText(/report/i)).toBeNull();
    expect(screen.queryByRole('link', { name: /report/i })).toBeNull();
  });

  // The pane takes no viewer props now, so a customer and the owning vendor
  // render exactly this; the lightbox is the other place a control could sit.
  it('draws none in the lightbox either', async () => {
    const user = userEvent.setup();
    render(<PortfolioPane items={items(3)} businessName="Kessler & Co." />);

    await user.click(screen.getByRole('button', { name: 'Photograph 1' }));

    expect(lightbox()).toBeTruthy();
    expect(screen.queryByText(/report/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /report/i })).toBeNull();
  });
});

/*
 * VEN-729 — three columns, always. CSS `columns: 3` balanced unbreakable tiles
 * by the smallest height that fits them, which for a few photos of mixed shapes
 * is reached with two columns, leaving the third empty. The photos are dealt
 * round-robin into three explicit columns instead. jsdom has no layout, so this
 * asserts the DOM structure that guarantees it; the rendered offsets are
 * measured in a browser.
 */
/** Stubs `matchMedia`; the returned function moves the viewport across 768px. */
function stubViewport(initiallyWide: boolean): (wide: boolean) => void {
  let wide = initiallyWide;
  const listeners = new Set<() => void>();
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        get matches() {
          return wide;
        },
        media: query,
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      }) as unknown as MediaQueryList,
  );
  return (next) => {
    wide = next;
    act(() => listeners.forEach((listener) => listener()));
  };
}

describe('PortfolioPane — three columns', () => {
  // The suite's `matchMedia` stub answers "no match" (a small viewport); the
  // three-column layout is the one from 768px up.
  beforeEach(() => {
    stubViewport(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('returns focus to the opening photo when the viewport crosses 768px while it is open', async () => {
    const user = userEvent.setup();
    const setWide = stubViewport(false);
    render(<PortfolioPane items={items(7)} businessName="Kessler & Co." />);

    // Photograph 3 is in the first column of two and the third of three, so
    // the crossing remounts its button.
    const before = screen.getByRole('button', { name: 'Photograph 3' });
    await user.click(before);
    setWide(true);
    await user.keyboard('{Escape}');

    const after = screen.getByRole('button', { name: 'Photograph 3' });
    expect(after).not.toBe(before);
    expect(document.activeElement).toBe(after);
  });

  it('keeps two columns below 768px', () => {
    stubViewport(false);
    const { container } = render(<PortfolioPane items={items(5)} businessName="Kessler & Co." />);

    expect(container.querySelectorAll('[data-portfolio-column]')).toHaveLength(2);
  });

  it.each([4, 5, 6, 7, 9])('deals %i photos into three balanced columns', (count) => {
    const { container } = render(
      <PortfolioPane items={items(count)} businessName="Kessler & Co." />,
    );

    const columns = Array.from(container.querySelectorAll('[data-portfolio-column]'));
    const sizes = columns.map((column) => column.querySelectorAll('button').length);

    expect(columns).toHaveLength(3);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(count);
  });

  it('deals round-robin, so the first row reads left to right', () => {
    const { container } = render(<PortfolioPane items={items(7)} businessName="Kessler & Co." />);

    const names = Array.from(container.querySelectorAll('[data-portfolio-column]')).map((column) =>
      Array.from(column.querySelectorAll('button')).map((button) =>
        button.getAttribute('aria-label'),
      ),
    );

    expect(names).toEqual([
      ['Photograph 1', 'Photograph 4', 'Photograph 7'],
      ['Photograph 2', 'Photograph 5'],
      ['Photograph 3', 'Photograph 6'],
    ]);
  });

  it('steps the lightbox in the original photo order, not column order', async () => {
    const user = userEvent.setup();
    render(<PortfolioPane items={items(7)} businessName="Kessler & Co." />);

    await user.click(screen.getByRole('button', { name: 'Photograph 3' }));
    const seen = [lightbox().getAttribute('aria-label')];
    for (let step = 0; step < 4; step += 1) {
      await user.keyboard('{ArrowRight}');
      seen.push(lightbox().getAttribute('aria-label'));
    }
    await user.keyboard('{ArrowLeft}');
    seen.push(lightbox().getAttribute('aria-label'));

    expect(seen).toEqual([
      'Photograph 3',
      'Photograph 4',
      'Photograph 5',
      'Photograph 6',
      'Photograph 7',
      'Photograph 6',
    ]);
  });

  it('says in one sentence that there is no work yet (VEN-732)', () => {
    render(<PortfolioPane items={[]} businessName="Kessler & Co." />);

    expect(screen.getByText('No work published yet')).toBeDefined();
    expect(screen.getByText("Kessler & Co. hasn't added photos yet.")).toBeDefined();
    expect(screen.queryByText(/still here/)).toBeNull();
  });
});
