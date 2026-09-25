import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/client', () => ({
  getSessionToken: async () => 'token-abc',
  refreshRefusedSessionToken: async () => 'token-fresh',
}));

const { TaxStatementDownloads } = await import('./tax-statement-downloads');

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  URL.createObjectURL = vi.fn(() => 'blob:statement');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

/** VEN-725: one yearly statement per year the vendor was paid in. */
describe('TaxStatementDownloads', () => {
  it('renders nothing when there is no settled booking yet', () => {
    const { container } = render(<TaxStatementDownloads years={[]} />);

    expect(container.innerHTML).toBe('');
  });

  it('draws one link per year, labelled `<year> statement (CSV)`', () => {
    render(<TaxStatementDownloads years={[2027, 2026]} />);

    expect(screen.getByRole('button', { name: '2027 statement (CSV)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026 statement (CSV)' })).toBeTruthy();
  });

  it('requests the pressed year with the session token and downloads the file', async () => {
    fetchMock.mockResolvedValue(new Response('a,b\n', { status: 200 }));
    render(<TaxStatementDownloads years={[2026]} />);

    fireEvent.click(screen.getByRole('button', { name: '2026 statement (CSV)' }));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;

    expect(String(url)).toMatch(/\/vendor\/tax\/statement\.csv\?year=2026$/);
    expect(init?.headers).toEqual({ authorization: 'Bearer token-abc' });
  });

  it('retries once with a re-minted token when the API refuses the cached one', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('a,b\n', { status: 200 }));
    render(<TaxStatementDownloads years={[2026]} />);

    fireEvent.click(screen.getByRole('button', { name: '2026 statement (CSV)' }));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[1]![1]?.headers).toEqual({ authorization: 'Bearer token-fresh' });
  });

  it('says so when the download fails, and downloads nothing', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    render(<TaxStatementDownloads years={[2026]} />);

    fireEvent.click(screen.getByRole('button', { name: '2026 statement (CSV)' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The 2026 statement could not be downloaded. Try again.',
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
