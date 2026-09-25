import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wireAdminRequestPageSchema, type WireAdminRequestPage } from '@/lib/wire-schemas';

const getAdminRequests = vi.fn<(query: string) => Promise<WireAdminRequestPage>>();

vi.mock('@/lib/admin-data', () => ({
  getAdminRequests: (query: string) => getAdminRequests(query),
}));
// `FilterSelect` navigates on choice, and jsdom has no app router mounted.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { default: AdminRequestsPage } = await import('./page');

const NOW = new Date('2026-10-01T12:00:00.000Z');
const VENDOR_ID = '11111111-1111-4111-8111-111111111111';

/** Built as the API sends it — JSON, dates as strings — and parsed through the wire schema. */
function page(items: Record<string, unknown>[], widenings: unknown[] = []): WireAdminRequestPage {
  return wireAdminRequestPageSchema.parse({
    items: items.map((overrides, index) => ({
      id: `2222222${index}-2222-4222-8222-222222222222`,
      status: 'pending',
      eventDate: '2026-11-07',
      vendorId: VENDOR_ID,
      vendorName: 'Fernbank Studio',
      customerName: 'Rosa Rivera',
      quotedPriceCents: null,
      expiresAt: null,
      resolvedAt: null,
      createdAt: '2026-09-25T00:00:00.000Z',
      ...overrides,
    })),
    total: items.length,
    page: 1,
    pageSize: 15,
    widenings,
  });
}

async function renderPage(params: Record<string, string> = {}) {
  return render(await AdminRequestsPage({ searchParams: Promise.resolve(params) }));
}

/** The grid branch of `DataTable` — the server render also draws the card list. */
function gridCell(text: string): HTMLElement {
  const [cell] = screen.getAllByText(text);
  expect(cell, `no cell reads ${text}`).toBeDefined();

  return cell as HTMLElement;
}

/** `Bookings · Requests` (VEN-399). */
describe('AdminRequestsPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    getAdminRequests.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('passes the group and the status upstream, and drops values it does not have', async () => {
    getAdminRequests.mockResolvedValue(page([]));

    await renderPage({ group: 'lapsed', status: 'expired' });
    expect(getAdminRequests).toHaveBeenLastCalledWith('?group=lapsed&status=expired&page=1');

    cleanup();
    await renderPage({ group: 'dead', status: 'bogus' });
    expect(getAdminRequests).toHaveBeenLastCalledWith('?page=1');
    expect(screen.getByRole('status').textContent).toContain('group');
  });

  it('offers all six statuses and the three groups, and sits under the Bookings tabs', async () => {
    getAdminRequests.mockResolvedValue(page([{}]));

    await renderPage({ group: 'live' });

    const tabs = screen.getByRole('navigation', { name: 'Bookings views' });
    expect(
      [...tabs.querySelectorAll('a')].map((link) => [
        link.textContent,
        link.getAttribute('href'),
        link.getAttribute('aria-current'),
      ]),
    ).toEqual([
      ['Bookings', '/admin/bookings', null],
      ['Requests', '/admin/requests', 'page'],
    ]);

    const groups = screen.getByRole('navigation', { name: 'Request group' });
    expect(
      [...groups.querySelectorAll('a')].map((link) => [
        link.textContent,
        link.getAttribute('href'),
      ]),
    ).toEqual([
      // The active segment clears itself; the others replace it.
      ['Live', '/admin/requests'],
      ['Closed', '/admin/requests?group=closed'],
      ['Lapsed', '/admin/requests?group=lapsed'],
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(
      expect.arrayContaining(['Pending', 'Quoted', 'Accepted', 'Declined', 'Expired', 'Withdrawn']),
    );
  });

  it('prints each column Pattern A draws, with the countdown only while a request can move', async () => {
    getAdminRequests.mockResolvedValue(
      page([
        { status: 'pending', expiresAt: '2026-10-01T18:00:00.000Z' },
        { status: 'quoted', quotedPriceCents: 145_000, expiresAt: '2026-10-04T12:00:00.000Z' },
        { status: 'declined', resolvedAt: '2026-09-22T06:00:00.000Z' },
        {
          status: 'expired',
          expiresAt: '2026-09-30T00:00:00.000Z',
          resolvedAt: '2026-09-30T00:00:00.000Z',
        },
      ]),
    );

    await renderPage();

    expect(gridCell('Fernbank Studio').closest('a')?.getAttribute('href')).toBe(
      `/admin/vendors/${VENDOR_ID}`,
    );
    expect(screen.getAllByText('November 7, 2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$1,450').length).toBeGreaterThan(0);

    // Six hours left: gold. Three days left: not.
    expect(gridCell('expires today').className).toBe('text-gold-600');
    expect(gridCell('expires in 3d').className).toBe('');
    // A settled request prints when it settled, never a dead countdown.
    expect(gridCell('Sep 22, 2026').className).toBe('text-stone-600');
    expect(gridCell('Sep 30, 2026').className).toBe('text-stone-600');
    expect(screen.queryByText('expired')).toBeNull();
  });

  it('draws quoted steel, in the customer hub’s words', async () => {
    getAdminRequests.mockResolvedValue(
      page([{ status: 'quoted', quotedPriceCents: 90_000 }, { status: 'cancelled' }]),
    );

    await renderPage();

    const pill = screen
      .getAllByText('Quoted')
      .find((element) => element.className.split(/\s+/).some((name) => name.startsWith('bg-')));
    expect(pill?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['bg-steel-50', 'text-steel-600']),
    );
    expect(screen.getAllByText('Withdrawn').length).toBeGreaterThan(0);
  });

  it('counts the ways out of a filtered-empty list', async () => {
    getAdminRequests.mockResolvedValue(page([], [{ key: 'status', count: 2 }]));

    await renderPage({ group: 'live', status: 'declined' });

    expect(screen.getByText('No requests match these filters')).toBeDefined();
    const widen = screen.getByRole('link', { name: /Any status/ });
    expect(widen.getAttribute('href')).toBe('/admin/requests?group=live');
    expect(widen.textContent).toContain('2');
  });

  /** The search box (VEN-749). */
  it('names the search when it and a group leave nothing, and keeps it through each way out', async () => {
    getAdminRequests.mockResolvedValue(page([], [{ key: 'group', count: 3 }]));

    await renderPage({ q: '  rivera ', group: 'live' });

    expect(getAdminRequests).toHaveBeenCalledWith('?group=live&q=rivera&page=1');
    expect(screen.getByText('No requests match "rivera" and these filters')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Any group (3)' }).getAttribute('href')).toBe(
      '/admin/requests?q=rivera',
    );
    // The segmented control carries the search, as the selects do.
    expect(screen.getByRole('link', { name: 'Closed' }).getAttribute('href')).toBe(
      '/admin/requests?group=closed&q=rivera',
    );
    expect(screen.getByRole('searchbox', { name: 'Search' }).getAttribute('value')).toBe('rivera');
  });

  it('carries the search through the pager', async () => {
    getAdminRequests.mockResolvedValue({ ...page([{}]), total: 40 });

    await renderPage({ q: 'fernbank' });

    expect(
      screen
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
        .filter((href) => href?.includes('page=2')),
    ).toContain('/admin/requests?q=fernbank&page=2');
  });

  // A JavaScript-off `Apply filters` submits the empty field too (VEN-752).
  it('treats an empty q as no search', async () => {
    getAdminRequests.mockResolvedValue(page([]));

    await renderPage({ status: 'pending', q: '' });

    expect(getAdminRequests).toHaveBeenCalledWith('?status=pending&page=1');
    expect(screen.queryByText(/^Search:/)).toBeNull();
    expect(screen.queryByText(/Ignored/)).toBeNull();
    expect(screen.queryByText(/No requests match "/)).toBeNull();
    expect(screen.getByText(/^One filter is narrowing this\./)).toBeDefined();
  });
});
