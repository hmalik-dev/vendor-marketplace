import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UploadQueue } from '@/lib/use-upload-queue';
import type { UploadTask } from '@/lib/uploads';

const cancel = vi.fn();
let tasks: readonly UploadTask[] = [];

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));
vi.mock('@/lib/use-upload-queue', () => ({
  useUploadQueue: (): UploadQueue => ({
    tasks,
    heldBackNotice: null,
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
