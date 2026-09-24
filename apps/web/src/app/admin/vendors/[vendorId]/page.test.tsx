import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { interactiveInsideReadOnlyCards } from '@/components/admin/admin-detail.testing';
import { wireAdminVendorDetailSchema, type WireAdminVendorDetail } from '@/lib/wire-schemas';

const getAdminVendorDetail = vi.fn<(vendorId: string) => Promise<WireAdminVendorDetail | null>>();

vi.mock('@/lib/admin-data', () => ({
  getAdminVendorDetail: (vendorId: string) => getAdminVendorDetail(vendorId),
}));
vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const { default: AdminVendorDetailPage } = await import('./page');

const VENDOR_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const BOOKING_ID = '33333333-3333-4333-8333-333333333333';
const REQUEST_ID = '44444444-4444-4444-8444-444444444444';

/**
 * Built as the API sends it — JSON, dates as strings — and parsed through the
 * wire schema, so a date the schema forgot to coerce fails here rather than on
 * the 500 page (`web-route-boundaries.md`).
 */
function detail(overrides: Partial<Record<keyof WireAdminVendorDetail, unknown>> = {}) {
  return wireAdminVendorDetailSchema.parse({
    vendor: {
      id: VENDOR_ID,
      userId: USER_ID,
      businessName: 'Fernbank Studio',
      slug: 'fernbank-studio',
      categoryName: 'Photography',
      city: 'Austin',
      state: 'TX',
      avgRating: '4.50',
      reviewCount: 2,
      bookingsCount: 7,
      status: 'live',
      stripeOnboarded: true,
      stripeAccountId: 'acct_1PqR3xKz9LmN4dTv',
      stripeDisabledReason: null,
      stripeRequirementsDue: ['company.verification.document'],
      createdAt: '2025-03-04T00:00:00.000Z',
      email: 'dana@fernbank.studio',
      ownerName: 'Dana Rivera',
      responseTimeHours: 24,
      serviceRadiusKm: 80,
      travelsBeyondRadius: true,
      isPublished: true,
      moderationHold: false,
      payoutHold: true,
      debtOutstandingCents: 0,
    },
    packages: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Half-day coverage',
        priceCents: 140_000,
        priceType: 'fixed',
        isActive: true,
        moderationHold: false,
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        name: 'Second shooter add-on',
        priceCents: 30_000,
        priceType: 'hourly',
        isActive: false,
        moderationHold: true,
      },
    ],
    portfolio: [
      {
        id: '77777777-7777-4777-8777-777777777777',
        imageUrl: 'https://cdn.example.com/a.webp',
        thumbnailUrl: null,
        caption: 'A wedding at dusk',
        displayOrder: 0,
      },
    ],
    locks: [
      {
        date: '2026-10-10',
        status: 'booked',
        note: null,
        holders: [
          { kind: 'booking', id: BOOKING_ID, customerName: 'Rosa Rivera', status: 'confirmed' },
        ],
      },
      {
        date: '2026-10-17',
        status: 'pending',
        note: null,
        holders: [
          {
            kind: 'request',
            id: REQUEST_ID,
            customerName: 'Sam Lee',
            status: 'pending',
            expiresAt: '2026-10-02T09:00:00.000Z',
          },
        ],
      },
      { date: '2026-10-31', status: 'booked', note: null, holders: [] },
      { date: '2026-11-07', status: 'blocked', note: 'out of state', holders: [] },
    ],
    notifications: {
      total: 3,
      unread: 1,
      items: [
        {
          id: '88888888-8888-4888-8888-888888888888',
          type: 'message',
          title: 'Rosa sent a message',
          createdAt: '2026-09-30T10:00:00.000Z',
          readAt: null,
        },
        {
          id: '99999999-9999-4999-8999-999999999999',
          type: 'booking_request',
          title: 'New request for Oct 17',
          createdAt: '2026-09-28T10:05:00.000Z',
          readAt: '2026-09-29T08:00:00.000Z',
        },
      ],
    },
    ...overrides,
  });
}

async function renderPage(data: WireAdminVendorDetail | null, vendorId = VENDOR_ID) {
  getAdminVendorDetail.mockResolvedValue(data);

  return render(await AdminVendorDetailPage({ params: Promise.resolve({ vendorId }) }));
}

function cardTitled(root: ParentNode, title: string): HTMLElement {
  const card = [...root.querySelectorAll<HTMLElement>('[data-admin-card]')].find(
    (candidate) => candidate.querySelector('h2')?.textContent === title,
  );
  expect(card, `no card titled ${title}`).toBeDefined();

  return card as HTMLElement;
}

function rowsOf(card: HTMLElement): string[][] {
  return within(card)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent ?? ''),
    );
}

afterEach(cleanup);

/** `/admin/vendors/[vendorId]` (VEN-380). */
describe('AdminVendorDetailPage', () => {
  it('puts the record cards left in question order and Identity then Actions right', async () => {
    const { container } = await renderPage(detail());

    const aside = container.querySelector<HTMLElement>('[data-detail-aside]');
    const heading = (card: Element) => card.querySelector('[data-card-band] h2')?.textContent;
    expect([...(aside?.querySelectorAll(':scope > [data-admin-card]') ?? [])].map(heading)).toEqual(
      ['Identity', 'Actions'],
    );
    expect(
      [
        ...(aside?.previousElementSibling?.querySelectorAll(':scope > [data-admin-card]') ?? []),
      ].map(heading),
    ).toEqual([
      'Stripe',
      'Packages · 2',
      'Portfolio · 1 image',
      'Availability locks · 4',
      'Notifications sent · 3',
    ]);
    expect(interactiveInsideReadOnlyCards(container)).toEqual({
      Stripe: 0,
      'Availability locks · 4': 0,
      'Notifications sent · 3': 0,
      Identity: 0,
    });
  });

  it('exposes the email, Stripe account, reply time, radius and payout hold', async () => {
    const { container } = await renderPage(detail());

    const identity = cardTitled(container, 'Identity');
    expect(within(identity).getByText('dana@fernbank.studio')).toBeDefined();
    expect(within(identity).getByText('Within 24 hours')).toBeDefined();
    expect(within(identity).getByText('80 km · travels beyond')).toBeDefined();
    expect(within(identity).getByText('4.5 · 2 reviews')).toBeDefined();

    const stripe = cardTitled(container, 'Stripe');
    expect(within(stripe).getByText('acct_1PqR3xKz9LmN4dTv').dataset.kind).toBe('mono');
    expect(within(stripe).getByText('company.verification.document')).toBeDefined();
    expect(within(stripe).getByText('Held by an admin')).toBeDefined();
  });

  it('shows what the vendor still owes for a lost chargeback, and nothing when they owe nothing (VEN-658)', async () => {
    const owing = detail();
    owing.vendor.debtOutstandingCents = 107_100;
    const { container } = await renderPage(owing);
    const owed = [...container.querySelectorAll('dt')].find(
      (label) => label.textContent === 'Owed to the platform',
    );

    expect(owed?.nextElementSibling?.textContent).toBe('$1,071');

    cleanup();
    const clear = await renderPage(detail());
    expect(
      [...clear.container.querySelectorAll('dt')].map((label) => label.textContent),
    ).not.toContain('Owed to the platform');
  });

  it('lists packages with a lever each and portfolio photos with Remove', async () => {
    const { container } = await renderPage(detail());

    const packages = cardTitled(container, 'Packages · 2');
    expect(rowsOf(packages)).toEqual([
      ['Half-day coverage', '$1,400Fixed price', 'Yes', 'Deactivate'],
      ['Second shooter add-on', '$300Per hour', 'Held', 'Activate'],
    ]);

    const portfolio = cardTitled(container, 'Portfolio · 1 image');
    expect(
      within(portfolio).getByRole('button', { name: 'Remove A wedding at dusk' }),
    ).toBeDefined();
  });

  it('names what holds each date, and flags a booked date nothing holds', async () => {
    const { container } = await renderPage(detail());

    expect(rowsOf(cardTitled(container, 'Availability locks · 4'))).toEqual([
      ['October 10, 2026', 'Booked', `Booking · Rosa Rivera · confirmed${BOOKING_ID}`],
      [
        'October 17, 2026',
        'Pending',
        `Request · Sam Lee · expires Oct 2, 2026, 09:00 UTC${REQUEST_ID}`,
      ],
      ['October 31, 2026', 'Booked', 'No live booking holds this date'],
      ['November 7, 2026', 'Blocked', 'Set by vendor · “out of state”'],
    ]);
  });

  it('lists notifications with sent-at and read state, saying how many are shown', async () => {
    const { container } = await renderPage(detail());

    const card = cardTitled(container, 'Notifications sent · 3');
    expect(card.querySelector('[data-card-band]')?.textContent).toContain(
      '1 unread · latest 2 shown',
    );
    expect(rowsOf(card)).toEqual([
      ['Sep 30, 2026, 10:00 UTC', 'Rosa sent a messagemessage', 'Unread'],
      ['Sep 28, 2026, 10:05 UTC', 'New request for Oct 17booking_request', 'Read'],
    ]);
  });

  it('keeps every card when the vendor has nothing, each with one line', async () => {
    const { container } = await renderPage(
      detail({
        packages: [],
        portfolio: [],
        locks: [],
        notifications: { total: 0, unread: 0, items: [] },
      }),
    );

    expect(cardTitled(container, 'Packages · 0').textContent).toContain(
      'No packages yet. Customers can still request a custom quote.',
    );
    expect(cardTitled(container, 'Portfolio · 0 images').textContent).toContain('No photos yet.');
    expect(cardTitled(container, 'Availability locks · 0')).toBeDefined();
    expect(cardTitled(container, 'Notifications sent · 0')).toBeDefined();
  });

  it('links to the data-rights read from the Actions card', async () => {
    const { container } = await renderPage(detail());

    expect(
      within(cardTitled(container, 'Actions'))
        .getByRole('link', { name: 'Open data rights' })
        .getAttribute('href'),
    ).toBe(`/admin/users/${USER_ID}`);
  });

  it('offers a retired vendor no lever at all', async () => {
    const base = detail();
    const { container } = await renderPage({
      ...base,
      vendor: { ...base.vendor, status: 'retired' },
    });

    expect(within(cardTitled(container, 'Actions')).queryAllByRole('button')).toEqual([]);
    expect(within(cardTitled(container, 'Packages · 2')).queryAllByRole('button')).toEqual([]);
    expect(within(cardTitled(container, 'Portfolio · 1 image')).queryAllByRole('button')).toEqual(
      [],
    );
  });

  it('answers notFound for a malformed id and for a vendor that does not exist', async () => {
    await expect(renderPage(detail(), 'not-a-uuid')).rejects.toThrow('notFound');
    expect(getAdminVendorDetail).not.toHaveBeenCalledWith('not-a-uuid');
    await expect(renderPage(null)).rejects.toThrow('notFound');
  });

  /*
   * Acceptance 7: the screen is built from the console's existing vocabulary.
   * Read from the import statements rather than the rendered DOM, because a
   * second visual language arrives as an import long before it looks different.
   */
  it('imports components only from the admin and ui component directories', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    const componentImports = [...source.matchAll(/from '(@\/components\/[^']+)'/g)].map(
      (match) => match[1],
    );

    expect(componentImports).toEqual([
      '@/components/admin/admin-detail',
      '@/components/admin/vendor-detail-actions',
      '@/components/admin/notifications-card',
      '@/components/admin/vendor-status',
      '@/components/ui/fallback-image',
      '@/components/ui/status-pill',
    ]);
    expect(componentImports.every((path) => /^@\/components\/(admin|ui)\//.test(path ?? ''))).toBe(
      true,
    );
  });
});
