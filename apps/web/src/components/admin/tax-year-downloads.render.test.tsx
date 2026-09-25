import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/client', () => ({
  getSessionToken: async () => 'token-abc',
  refreshRefusedSessionToken: async () => 'token-fresh',
}));
vi.mock('@/lib/use-api', () => ({ useApi: () => async () => ({}) }));

const { TaxYearDownloads } = await import('./tax-year-downloads');

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  URL.createObjectURL = vi.fn(() => 'blob:tax');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('TaxYearDownloads', () => {
  it('renders nothing when no year has settled bookings', () => {
    const { container } = render(<TaxYearDownloads years={[]} backupWithheld={[]} />);

    expect(container.innerHTML).toBe('');
  });

  it('draws one labelled control per year', () => {
    render(<TaxYearDownloads years={[2027, 2026]} backupWithheld={[]} />);

    expect(screen.getByRole('button', { name: '1099-K figures, 2027' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '1099-K figures, 2026' })).toBeTruthy();
  });

  it('lists what backup withholding kept in each year that withheld something, for Form 945', () => {
    render(
      <TaxYearDownloads
        years={[2027, 2026]}
        backupWithheld={[
          { year: 2027, cents: 12_000 },
          { year: 2026, cents: 24_000 },
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem').map((item) => item.textContent);

    expect(items).toEqual([
      'Backup withholding kept in 2027: $120',
      'Backup withholding kept in 2026: $240',
    ]);
  });

  it('draws no withholding list when nothing was withheld', () => {
    render(<TaxYearDownloads years={[2026]} backupWithheld={[]} />);

    expect(screen.queryByTestId('backup-withheld-by-year')).toBeNull();
  });

  it('requests the pressed year with the session token and downloads the file', async () => {
    fetchMock.mockResolvedValue(new Response('a,b\n', { status: 200 }));
    render(<TaxYearDownloads years={[2026]} backupWithheld={[]} />);

    fireEvent.click(screen.getByRole('button', { name: '1099-K figures, 2026' }));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;

    expect(String(url)).toMatch(/\/admin\/tax\/1099-k\.csv\?year=2026$/);
    expect(init?.headers).toEqual({ authorization: 'Bearer token-abc' });
  });

  it('retries once with a re-minted token when the API refuses the cached one', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('a,b\n', { status: 200 }));
    render(<TaxYearDownloads years={[2026]} backupWithheld={[]} />);

    fireEvent.click(screen.getByRole('button', { name: '1099-K figures, 2026' }));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![1]?.headers).toEqual({ authorization: 'Bearer token-fresh' });
  });

  it('asks for the emailed code when the API demands a step-up, and downloads nothing', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 403,
          error: 'STEP_UP_REQUIRED',
          message: 'Confirm it is you',
        }),
        { status: 403 },
      ),
    );
    render(<TaxYearDownloads years={[2026]} backupWithheld={[]} />);

    fireEvent.click(screen.getByRole('button', { name: '1099-K figures, 2026' }));

    expect(await screen.findByText(/Confirm it's you first\./)).toBeTruthy();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('says so when the download fails for any other reason', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    render(<TaxYearDownloads years={[2026]} backupWithheld={[]} />);

    fireEvent.click(screen.getByRole('button', { name: '1099-K figures, 2026' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The 2026 figures could not be downloaded. Try again.',
    );
  });
});
