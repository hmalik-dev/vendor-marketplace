import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UploadQueue } from '@/lib/use-upload-queue';
import { isBatchInFlight, type UploadTask } from '@/lib/uploads';
import type { WirePortfolioItem } from '@/lib/wire-schemas';

const cancel = vi.fn();
let tasks: readonly UploadTask[] = [];

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));
vi.mock('@/lib/use-upload-queue', () => ({
  useUploadQueue: (): UploadQueue => ({
    tasks,
    heldBackNotice: null,
    // The real predicate, not a copy of it — a second definition here would
    // stay green while the one the hook actually uses drifted.
    inFlight: isBatchInFlight(tasks),
    addFiles: vi.fn(),
    retryAll: vi.fn(),
    dismiss: vi.fn(),
    dismissAllFailed: vi.fn(),
    cancel,
  }),
}));

const { PortfolioManager } = await import('./portfolio-manager');

function uploading(name: string, sizeBytes = 2_000_000): UploadTask {
  return { id: name, name, sizeBytes, status: 'uploading', progress: 40 };
}

function done(name: string, sizeBytes = 2_000_000): UploadTask {
  return { id: name, name, sizeBytes, status: 'done', progress: 100 };
}

/**
 * #173 — once a batch started, the only way to stop it was to leave the page.
 *
 * Frame `24` draws `Cancel` beside the aggregate progress line, and it is there
 * only while something is in flight: a control that lingers after the batch
 * settles offers to stop work that has already finished.
 */
describe('PortfolioManager upload cancel', () => {
  beforeEach(() => {
    cancel.mockReset();
    tasks = [];
  });

  afterEach(() => {
    cleanup();
  });

  it('offers Cancel while a batch is in flight', () => {
    tasks = [uploading('a.jpg'), uploading('b.jpg')];
    render(<PortfolioManager initialItems={[]} />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
  });

  it('sits beside the aggregate line, not somewhere else on the page', () => {
    tasks = [uploading('a.jpg'), uploading('b.jpg')];
    render(<PortfolioManager initialItems={[]} />);

    const line = screen.getByRole('status');
    const control = screen.getByRole('button', { name: 'Cancel' });

    // Frame `24` puts them in one row; the assertion is the relationship, not
    // the pixel — a Cancel elsewhere on the page is not what the frame draws.
    expect(line.parentElement).toBe(control.parentElement);
  });

  it('stops the batch when pressed', async () => {
    tasks = [uploading('a.jpg'), uploading('b.jpg')];
    render(<PortfolioManager initialItems={[]} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
  });

  /*
   * The aggregate line and the control share one condition, so they cannot
   * disagree: `aggregateLine` returns null once every task has settled.
   */
  it('disappears when the batch finishes', () => {
    tasks = [done('a.jpg'), done('b.jpg')];
    render(<PortfolioManager initialItems={[]} />);

    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('is absent before any file is chosen', () => {
    tasks = [];
    render(<PortfolioManager initialItems={[]} />);

    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  /*
   * Frame `24` draws it as a bare underlined span. A span is not reachable from
   * a keyboard, and `04-laws.md` does not bend for a visual — so the treatment
   * is the frame's and the element is the accessible one.
   */
  /*
   * #386. The hover was `text-steel-700`, which `steel` does not define — so
   * the control had no hover state at all and nothing said so. `steel` stops
   * at 600, and the ruling was to cross to `stone-900` rather than mint a
   * fourth step in a three-step ramp. Pinned because a deleted hover is
   * invisible to every other test in this file.
   */
  it('keeps a visible hover destination the ramp actually defines', () => {
    tasks = [uploading('a.jpg')];
    render(<PortfolioManager initialItems={[]} />);

    const cancel = screen.getByRole('button', { name: 'Cancel' });

    expect(cancel.className).toContain('text-steel-600');
    expect(cancel.className).toContain('hover:text-stone-900');
    expect(cancel.className).not.toContain('steel-700');
  });

  it('is a real button, so a keyboard can reach it', async () => {
    tasks = [uploading('a.jpg')];
    render(<PortfolioManager initialItems={[]} />);

    const control = screen.getByRole('button', { name: 'Cancel' });
    expect(control.tagName).toBe('BUTTON');
    expect(control.className).toContain('underline');

    control.focus();
    expect(document.activeElement).toBe(control);

    await userEvent.keyboard('{Enter}');
    expect(cancel).toHaveBeenCalled();
  });
});

/*
 * #183. The header count is server-rendered in `page.tsx` from a value this
 * component does not own, so only a router refresh moves it. Delete already
 * did one; upload did not, and the grid grew while the pill stood still.
 */
describe('PortfolioManager header count', () => {
  it('refreshes once when the batch settles, not once per file', () => {
    refresh.mockClear();
    tasks = [
      { id: '1', name: 'a.jpg', sizeBytes: 10, status: 'uploading', progress: 20 },
      { id: '2', name: 'b.jpg', sizeBytes: 10, status: 'queued', progress: 0 },
    ] as never;

    const view = render(<PortfolioManager initialItems={[]} />);
    expect(refresh).not.toHaveBeenCalled();

    // Both files land: the queue reports nothing in flight.
    tasks = [
      { id: '1', name: 'a.jpg', sizeBytes: 10, status: 'done', progress: 100 },
      { id: '2', name: 'b.jpg', sizeBytes: 10, status: 'done', progress: 100 },
    ] as never;
    view.rerender(<PortfolioManager initialItems={[]} />);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh on a render where nothing was ever in flight', () => {
    refresh.mockClear();
    tasks = [];

    render(<PortfolioManager initialItems={[]} />);

    expect(refresh).not.toHaveBeenCalled();
  });
});

/*
 * #405. Reordering was offered while an upload was still going up, and the two
 * writes race in both directions: the POST commits first and the reorder's id
 * list is incomplete, so `assertCompleteOrder` refuses an order the vendor got
 * right; or the reorder is handled first and its response replaces the list,
 * erasing the photo `persist` had already appended.
 */
describe('PortfolioManager reorder while uploading', () => {
  function item(id: string, displayOrder: number): WirePortfolioItem {
    return {
      id,
      vendorId: '66666666-6666-4666-8666-666666666666',
      imageUrl: `https://cdn.example.com/${id}.webp`,
      thumbnailUrl: null,
      caption: null,
      displayOrder,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
  }

  const ITEMS = [
    item('11111111-1111-4111-8111-111111111111', 0),
    item('22222222-2222-4222-8222-222222222222', 1),
  ];

  afterEach(() => {
    cleanup();
  });

  it('offers reordering when nothing is uploading', () => {
    tasks = [];
    render(<PortfolioManager initialItems={ITEMS} />);

    expect(
      screen.getByRole('button', { name: 'Move photo 1 later' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('refuses reordering while a batch is in flight', () => {
    tasks = [uploading('a.jpg')];
    render(<PortfolioManager initialItems={ITEMS} />);

    expect(
      screen.getByRole('button', { name: 'Move photo 1 later' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Move photo 2 earlier' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  /*
   * The buttons are only half of it: the tiles are also drag targets, and a
   * drop calls `move` without going through a disabled control.
   */
  it('stops the tiles being dragged while a batch is in flight', () => {
    tasks = [uploading('a.jpg')];
    const { container } = render(<PortfolioManager initialItems={ITEMS} />);

    const draggables = [...container.querySelectorAll('[draggable]')];
    expect(draggables).toHaveLength(ITEMS.length);
    for (const node of draggables) {
      expect(node.getAttribute('draggable')).toBe('false');
    }
  });
});
