import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { interactiveInsideReadOnlyCards } from '@/components/admin/admin-detail.testing';
import type { WireAdminUserDataRights } from '@/lib/wire-schemas';

const getAdminUserDataRights = vi.fn<(userId: string) => Promise<WireAdminUserDataRights>>();

vi.mock('@/lib/admin-data', () => ({
  getAdminUserDataRights: (userId: string) => getAdminUserDataRights(userId),
}));
vi.mock('@/lib/current-user', () => ({ getCurrentUser: async () => ({ id: 'someone-else' }) }));
vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));

const { default: AdminUserDataRightsPage } = await import('./page');

const USER_ID = '55555555-5555-4555-8555-555555555555';

function rights(overrides: Partial<WireAdminUserDataRights> = {}): WireAdminUserDataRights {
  return {
    userId: USER_ID,
    email: 'dana@example.com',
    name: 'Dana Okafor',
    role: 'customer',
    isBanned: false,
    pendingEmail: null,
    emailSyncFailedAt: null,
    closedAt: null,
    vendorProfileId: null,
    vendorSlug: null,
    retained: {
      bookingRequests: 3,
      bookings: 2,
      reviewsWritten: 1,
      reviewsReceived: 0,
      messages: 14,
      notifications: 9,
      legalAcceptances: 1,
    },
    closeBlockers: [],
    unwindPending: 0,
    bookingsRefundedOnClose: 0,
    legalAcceptances: [
      {
        id: '66666666-6666-4666-8666-666666666666',
        document: 'terms_of_service',
        version: '2026-08-01',
        acceptedAt: new Date('2026-08-02T14:02:00Z'),
        acceptedByName: 'Dana Okafor',
        businessName: null,
        ip: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      },
    ],
    ...overrides,
  } as WireAdminUserDataRights;
}

async function renderPage(data: WireAdminUserDataRights) {
  getAdminUserDataRights.mockResolvedValue(data);

  return render(await AdminUserDataRightsPage({ params: Promise.resolve({ userId: USER_ID }) }));
}

function cardTitled(root: ParentNode, title: string): HTMLElement {
  const card = [...root.querySelectorAll<HTMLElement>('[data-admin-card]')].find(
    (candidate) => candidate.querySelector('h2')?.textContent === title,
  );
  expect(card, `no card titled ${title}`).toBeDefined();

  return card as HTMLElement;
}

afterEach(cleanup);

/** `/admin/users/[userId]` against Pattern B (#393). */
describe('AdminUserDataRightsPage', () => {
  it('puts the record left and Identity then Actions in the 320px right column', async () => {
    const { container } = await renderPage(rights());

    const aside = container.querySelector<HTMLElement>('[data-detail-aside]');
    expect(
      [...(aside?.querySelectorAll(':scope > [data-admin-card] > [data-card-band] h2') ?? [])].map(
        (heading) => heading.textContent,
      ),
    ).toEqual(['Identity', 'Actions']);
    expect((aside?.parentElement as HTMLElement).className.split(/\s+/)).toContain(
      'lg:grid-cols-[minmax(0,1fr)_320px]',
    );

    const record = aside?.previousElementSibling as HTMLElement;
    expect(
      [...record.querySelectorAll(':scope > [data-admin-card] h2')].map((h) => h.textContent),
    ).toEqual(['What is still held', 'Legal acceptances · 1']);
  });

  /*
   * Acceptance 3. "Least to most severe" is Export then Close; the hairline sits
   * between the two tiers and nowhere else; each tier carries exactly one line
   * naming its consequence.
   */
  it('orders the actions least to most severe, split by a hairline, one consequence each', async () => {
    const { container } = await renderPage(rights());
    const actions = cardTitled(container, 'Actions');

    const body = actions.querySelector('[data-action-tier]')?.parentElement as HTMLElement;
    const children = [...body.children];
    expect(
      children.map((child) => (child.hasAttribute('data-action-tier') ? 'tier' : 'rule')),
    ).toEqual(['tier', 'rule', 'tier']);
    expect(children[1]?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['h-px', 'bg-stone-150']),
    );

    const tiers = [...actions.querySelectorAll<HTMLElement>('[data-action-tier]')];
    expect(tiers.map((tier) => tier.querySelector('button')?.textContent)).toEqual([
      'Export data',
      'Close account',
    ]);
    expect(tiers.map((tier) => tier.querySelectorAll('p.text-helper').length)).toEqual([1, 1]);
    expect(screen.queryByRole('button', { name: 'Export their record' })).toBeNull();
  });

  it('puts no interactive element inside any read-only card', async () => {
    const { container } = await renderPage(
      rights({ vendorSlug: 'kessler-and-co', role: 'vendor' }),
    );

    expect(interactiveInsideReadOnlyCards(container)).toEqual({
      'What is still held': 0,
      'Legal acceptances · 1': 0,
      Identity: 0,
    });
    // The guard can fail: the one card that is not read-only holds the controls.
    expect(cardTitled(container, 'Actions').querySelectorAll('button').length).toBe(2);
  });

  it('counts what is still held in a table, one row per category', async () => {
    const { container } = await renderPage(rights());
    const table = screen.getByRole('table', { name: 'Records still held, by category' });

    expect(
      [...table.querySelectorAll('[role="row"]')].map((row) =>
        [...row.children].map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['Category', 'Records'],
      ['Booking requests', '3'],
      ['Bookings', '2'],
      ['Reviews written', '1'],
      ['Reviews received', '0'],
      ['Messages', '14'],
      ['Notifications', '9'],
      ['Legal acceptances', '1'],
    ]);
    expect(cardTitled(container, 'What is still held').contains(table)).toBe(true);
  });

  it('draws each acceptance as read-only fields, wrapping the address rather than clipping it', async () => {
    const { container } = await renderPage(rights());
    const card = cardTitled(container, 'Legal acceptances · 1');

    const fields = [...card.querySelectorAll('dt')].map((label) => [
      label.textContent,
      label.nextElementSibling?.textContent,
      label.nextElementSibling?.getAttribute('data-kind'),
    ]);
    expect(fields).toEqual([
      ['Document', 'Terms of Service', 'text'],
      ['Version', '2026-08-01', 'mono'],
      ['Accepted', 'Aug 2, 2026, 14:02 UTC', 'mono'],
      ['By', 'Dana Okafor', 'text'],
      ['On behalf of', '—', 'text'],
      ['From', '2001:0db8:85a3:0000:0000:8a2e:0370:7334', 'mono'],
    ]);
    expect(card.querySelector('dd[data-kind="mono"]')?.className).toContain(
      '[overflow-wrap:anywhere]',
    );
    expect(card.innerHTML).not.toMatch(/truncate|text-ellipsis/);
  });

  it('says so when there are no acceptances, keeping the card', async () => {
    const { container } = await renderPage(rights({ legalAcceptances: [] }));

    expect(cardTitled(container, 'Legal acceptances · 0').textContent).toContain(
      'No acceptances recorded.',
    );
  });

  it('breadcrumbs back to the list the role belongs to', async () => {
    await renderPage(rights({ role: 'vendor' }));

    expect(
      screen
        .getByRole('navigation', { name: 'Breadcrumb' })
        .querySelector('a')
        ?.getAttribute('href'),
    ).toBe('/admin/vendors');
  });
});
