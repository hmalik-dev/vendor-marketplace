import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/client', () => ({ getSessionToken: async () => 'token-abc' }));
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
    const { container } = render(<TaxYearDownloads years={[]} />);

    expect(container.innerHTML).toBe('');
  });

  it('draws one labelled control per year', () => {
    render(<TaxYearDownloads years={[2027, 2026]} />);

    expect(screen.getByRole('button', { name: '1099-K figures, 2027' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '1099-K figures, 2026' })).toBeTruthy();
  });

  it('requests the pressed year with the session token and downloads the file', async () => {
    fetchMock.mockResolvedValue(new Response('a,b\n', { status: 200 }));
    render(<TaxYearDownloads years={[2026]} />);

    fireEvent.click(screen.getByRole('button', { name: '1099-K figures, 2026' }));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;

    expect(String(url)).toMatch(/\/admin\/tax\/1099-k\.csv\?year=2026$/);
    expect(init?.headers).toEqual({ authorization: 'Bearer token-abc' });
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
    render(<TaxYearDownloads years={[2026]} />);

    fireEvent.click(screen.getByRole('button', { name: '1099-K figures, 2026' }));

    expect(await screen.findByText(/confirm it is you first/)).toBeTruthy();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('says so when the download fails for any other reason', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    render(<TaxYearDownloads years={[2026]} />);

    fireEvent.click(screen.getByRole('button', { name: '1099-K figures, 2026' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The 2026 figures could not be downloaded. Try again.',
    );
  });
});
