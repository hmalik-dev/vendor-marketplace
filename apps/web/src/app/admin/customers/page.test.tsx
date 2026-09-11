import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminCustomerPage, WireAdminCustomerRow } from '@/lib/wire-schemas';

const getAdminCustomers = vi.fn<(query: string) => Promise<WireAdminCustomerPage>>();
const push = vi.fn<(href: string) => void>();

vi.mock('@/lib/admin-data', () => ({
  getAdminCustomers: (query: string) => getAdminCustomers(query),
}));
/*
 * `FilterSelect` navigates on choice rather than submitting, so it calls
 * `useRouter` and jsdom has no app router mounted. Only `push` is used.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href) }),
}));

const { default: AdminCustomersPage } = await import('./page');

function customer(overrides: Partial<WireAdminCustomerRow> = {}): WireAdminCustomerRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    city: 'Austin',
    state: 'TX',
    totalBookingsCount: 2,
    isBanned: false,
    status: 'active',
    pendingEmail: null,
    createdAt: new Date('2026-01-05T00:00:00Z'),
    ...overrides,
  };
}

function page(items: WireAdminCustomerRow[]): WireAdminCustomerPage {
  return { items, total: items.length, page: 1, pageSize: 15, widenings: [] };
}

async function renderPage(params: Record<string, string> = {}): Promise<void> {
  render(await AdminCustomersPage({ searchParams: Promise.resolve(params) }));
}

/**
 * `/admin/customers`, and #450's whole surface.
 *
 * The defect: `/admin/users/[userId]` — the export, the retained counts and the
 * legal acceptance record — is reachable from this table and by direct URL and
 * nowhere else, and the table filtered closed accounts out. So closing an
 * account removed the page needed to audit the closure, at exactly the moment
 * somebody had a reason to open it.
 */
describe('AdminCustomersPage', () => {
  beforeEach(() => {
    getAdminCustomers.mockReset();
  });

  afterEach(cleanup);

  it('asks the API for live accounts by default, and for closed ones only when told', async () => {
    getAdminCustomers.mockResolvedValue(page([customer()]));

    await renderPage();
    // Acceptance 3: no status parameter, so the API applies its live default.
    expect(getAdminCustomers).toHaveBeenLastCalledWith('?page=1');

    cleanup();
    await renderPage({ status: 'closed' });
    expect(getAdminCustomers).toHaveBeenLastCalledWith('?status=closed&page=1');
  });

  it('drops a status the product does not have rather than passing it upstream', async () => {
    getAdminCustomers.mockResolvedValue(page([customer()]));

    // `retired` is the *vendors* table's word. The boundary is untrusted input.
    await renderPage({ status: 'retired' });

    expect(getAdminCustomers).toHaveBeenLastCalledWith('?page=1');
    expect(screen.getByText(/^Ignored status in the address/).textContent).toBe(
      'Ignored status in the address — it is not a value this list can filter by.',
    );
  });

  it('marks a closed row with a pill and leaves its data-rights page linked', async () => {
    const closed = customer({
      id: '22222222-2222-4222-8222-222222222222',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      status: 'closed',
    });
    getAdminCustomers.mockResolvedValue(page([customer(), closed]));

    await renderPage({ status: 'closed' });

    /*
     * Acceptance 2, and it is asserted against a fixture holding **both** an
     * active and a closed row. A single-row fixture could not tell "the closed
     * row is marked" from "every row is marked".
     */
    /*
     * Two, not one: `DataTable` renders every row twice — the grid and the
     * `md:hidden` card list — which is the same DOM #435 was caught by. Both
     * copies belong to the closed row; the active row's cell is a join date and
     * carries no pill at all, which is what makes the count decide this.
     */
    const pills = [...document.querySelectorAll('[data-slot="status-pill"]')];
    expect(pills.map((pill) => pill.textContent)).toEqual(['Closed', 'Closed']);
    /* The existing vocabulary's "not trading" tone, the one `Retired` takes. */
    expect(pills[0]?.getAttribute('data-tone')).toBe('inert');

    /* The active row keeps its join date rather than gaining a pill. */
    expect(screen.getAllByText('Joined Jan 5, 2026')).toHaveLength(2);

    /* Acceptance 1: the closed row's name is the link into the data-rights page. */
    expect(
      screen
        .getAllByRole('link', { name: 'Grace Hopper' })
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      '/admin/users/22222222-2222-4222-8222-222222222222',
      '/admin/users/22222222-2222-4222-8222-222222222222',
    ]);
  });

  it('offers the status filter, and names the set that clearing it lands on', async () => {
    getAdminCustomers.mockResolvedValue(page([customer()]));

    await renderPage();

    const trigger = screen.getByRole('button', { name: 'Status' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    /*
     * The clearing choice is `Live accounts`, never `Any status`.
     *
     * Absence of the parameter means live accounts here, and `Closed` is one of
     * the choices in the same list — so a control reading "Any status" would
     * take an operator looking at closed accounts back to a set those accounts
     * are not in, silently. That is #450's own symptom, one click from #450's
     * fix.
     *
     * The label itself is proved in `filter-bar.render.test.tsx`, which opens
     * the panel; this pins that **this** surface asks for it, which a component
     * test cannot say. The needle appears once in the page and only as code —
     * the comment beside it writes "Any status", so a guard matching its own
     * prose is not what this is.
     */
    const source = readFileSync(join(process.cwd(), 'src/app/admin/customers/page.tsx'), 'utf8');
    expect(source).toContain('anyLabel="Live accounts"');
  });

  it('carries the chosen status through the search form as a hidden field', async () => {
    getAdminCustomers.mockResolvedValue(page([customer({ status: 'closed' })]));

    const { container } = render(
      await AdminCustomersPage({ searchParams: Promise.resolve({ status: 'closed' }) }),
    );

    /*
     * The dropdown navigates on choice and so sits outside the form's submit
     * path. Without this field, pressing Enter in the search box would clear
     * the status the operator had just chosen.
     */
    const hidden = container.querySelector('input[type="hidden"][name="status"]');
    expect(hidden?.getAttribute('value')).toBe('closed');
  });

  it('names the status in the filtered-empty heading, in the words the filter used', async () => {
    getAdminCustomers.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 15,
      widenings: [{ key: 'status', count: 3 }],
    });

    await renderPage({ status: 'closed', q: 'kessler' });

    expect(screen.getByText('No closed customers match "kessler"').textContent).toBe(
      'No closed customers match "kessler"',
    );
    /*
     * The counted way out, and the count is the API's (#454). From the closed
     * view the `status` route goes back to the live default, and says so.
     */
    const route = screen.getByRole('link', { name: 'Live accounts (3)' });
    expect(route.getAttribute('href')).toBe('/admin/customers?q=kessler');
    /* `q` widened to nothing, so no button for it. */
    expect(screen.queryByRole('link', { name: /Any name or email/ })).toBeNull();
  });

  /*
   * The state #450 is really about: an operator searching a name on the
   * **default** view after that person closed their account.
   *
   * The list is empty, the row is one query string away, and before this the
   * screen said nothing about it — or worse, printed "widening any single one
   * of them still finds nothing". The fixture makes that reachable on purpose:
   * only the `status` route is counted, so if the route were missing the state
   * would print the false claim rather than merely omitting a button.
   */
  it('offers a route into the closed set from an empty default-view search', async () => {
    getAdminCustomers.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 15,
      widenings: [{ key: 'status', count: 1 }],
    });

    await renderPage({ q: 'hopper' });

    const route = screen.getByRole('link', { name: 'Closed accounts (1)' });
    expect(route.getAttribute('href')).toBe('/admin/customers?q=hopper&status=closed');
    expect(screen.getByText(/Widening any one of them finds something/)).toBeDefined();
  });

  /*
   * A bare `/admin/customers` with no rows is the **true** empty, and
   * `filtered-empty.tsx` is explicit that it must not be used as one: its
   * counted routes would offer a move that cannot help.
   */
  it('draws the true empty state when nothing was asked', async () => {
    getAdminCustomers.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 15,
      widenings: [],
    });

    await renderPage();

    expect(screen.getByText('No customers yet').textContent).toBe('No customers yet');
    expect(screen.queryByRole('link', { name: /Closed accounts/ })).toBeNull();
    expect(screen.queryByText(/narrowing this/)).toBeNull();
  });
});
