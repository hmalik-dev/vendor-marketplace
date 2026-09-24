import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GlobalError from './global-error';
import ErrorBoundary from './error';

vi.mock('./globals.css', () => ({}));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const reload = vi.fn();

function chunkError(): Error {
  const error = new Error('Loading chunk 1234 failed.');
  error.name = 'ChunkLoadError';
  return error;
}

/** Both boundaries take the same props; only the shell around the screen differs. */
const BOUNDARIES = [
  ['error.tsx', ErrorBoundary],
  ['global-error.tsx', GlobalError],
] as const;

describe.each(BOUNDARIES)('%s after a deploy (VEN-610)', (_name, Boundary) => {
  beforeEach(() => {
    reload.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('location', { ...window.location, reload });
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reloads exactly once for a ChunkLoadError', () => {
    render(<Boundary error={chunkError()} reset={vi.fn()} />);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads for a chunk failure named only in the message', () => {
    render(<Boundary error={new Error('Loading chunk app/page failed.')} reset={vi.fn()} />);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders the normal error screen the second time in one session', () => {
    render(<Boundary error={chunkError()} reset={vi.fn()} />);
    cleanup();
    render(<Boundary error={chunkError()} reset={vi.fn()} />);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('never reloads for an ordinary error', () => {
    render(<Boundary error={new Error('boom')} reset={vi.fn()} />);

    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload when session storage is unavailable, so it cannot loop', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });

    render(<Boundary error={chunkError()} reset={vi.fn()} />);

    expect(reload).not.toHaveBeenCalled();
  });
});
