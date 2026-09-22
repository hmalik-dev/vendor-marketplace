import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminVendorApplicationRow, WireAdminVendorInviteRow } from '@/lib/wire-schemas';

const calls: { path: string; method?: string; body?: unknown }[] = [];

vi.mock('@/lib/use-api', () => ({
  useApi: () => async (path: string, options: { method?: string; body?: unknown }) => {
    calls.push({ path, method: options.method, body: options.body });
    return null;
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { VendorApplicationsPanel } = await import('./vendor-applications-panel');

const APPLICATIONS: WireAdminVendorApplicationRow[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'fern@example.com',
    businessName: 'Fern & Gather',
    // A row from the details screen: `category` is the id, `categoryName` is resolved for display.
    category: '99999999-9999-4999-8999-999999999999',
    categoryName: 'Florist',
    city: 'Austin',
    state: 'TX',
    message: 'Weddings, mostly.',
    status: 'new',
    complete: true,
    createdAt: new Date('2026-09-14T09:00:00.000Z'),
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'old@example.com',
    businessName: 'Old Mill Catering',
    // A pre-VEN-512 free-text row: no id to resolve, so no `categoryName`.
    category: 'Catering',
    categoryName: null,
    city: 'Dallas',
    state: 'TX',
    message: '',
    status: 'invited',
    complete: true,
    createdAt: new Date('2026-09-10T09:00:00.000Z'),
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    email: 'unfinished@example.com',
    businessName: null,
    category: null,
    categoryName: null,
    city: null,
    state: null,
    message: null,
    status: 'new',
    complete: false,
    createdAt: new Date('2026-09-15T09:00:00.000Z'),
  },
];

const INVITES_PAGER = {
  path: '/admin/vendor-applications',
  params: {},
  page: 1,
  pageSize: 15,
  total: 2,
};

const INVITES: WireAdminVendorInviteRow[] = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'old@example.com',
    invitedByName: 'Ada Operator',
    createdAt: new Date('2026-09-11T09:00:00.000Z'),
    acceptedAt: null,
    emailStatus: 'failed',
    emailFailureReason: 'Resend refused the send (500)',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'joined@example.com',
    invitedByName: null,
    createdAt: new Date('2026-09-01T09:00:00.000Z'),
    acceptedAt: new Date('2026-09-02T09:00:00.000Z'),
    emailStatus: 'sent',
    emailFailureReason: null,
  },
];

afterEach(() => {
  cleanup();
  calls.length = 0;
});

describe('VendorApplicationsPanel', () => {
  it('offers invite and decline on a new application, and nothing on an invited one', () => {
    render(
      <VendorApplicationsPanel
        applications={APPLICATIONS}
        invites={INVITES}
        invitesPager={INVITES_PAGER}
      />,
    );

    expect(screen.getByRole('button', { name: 'Invite Fern & Gather' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Decline Fern & Gather' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Invite Old Mill Catering' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Decline Old Mill Catering' })).toBeNull();
  });

  it('shows the resolved category name, falling back to the raw value for a pre-VEN-512 free-text row', () => {
    render(
      <VendorApplicationsPanel
        applications={APPLICATIONS}
        invites={INVITES}
        invitesPager={INVITES_PAGER}
      />,
    );

    expect(screen.getByText('Florist · Austin')).toBeDefined();
    expect(screen.getByText('Catering · Dallas')).toBeDefined();
    expect(screen.queryByText(/99999999-9999/)).toBeNull();
  });

  it('shows Incomplete and disables Invite on a row missing its details (VEN-512)', () => {
    render(
      <VendorApplicationsPanel
        applications={APPLICATIONS}
        invites={INVITES}
        invitesPager={INVITES_PAGER}
      />,
    );

    expect(screen.getByText('Incomplete')).toBeDefined();
    expect(
      (screen.getByRole('button', { name: 'Invite unfinished@example.com' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Invite Fern & Gather' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('sends the decision for the row that was pressed', async () => {
    render(
      <VendorApplicationsPanel
        applications={APPLICATIONS}
        invites={INVITES}
        invitesPager={INVITES_PAGER}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Invite Fern & Gather' }));
    });

    expect(calls).toEqual([
      {
        path: '/admin/vendor-applications/11111111-1111-4111-8111-111111111111',
        method: 'PUT',
        body: { decision: 'invite' },
      },
    ]);
  });

  it('marks a failed invite email and resends only that invite', async () => {
    render(
      <VendorApplicationsPanel applications={[]} invites={INVITES} invitesPager={INVITES_PAGER} />,
    );

    expect(screen.getByText('Email failed')).toBeDefined();
    expect(screen.getByText('Email failed').closest('[title]')?.getAttribute('title')).toBe(
      'Resend refused the send (500)',
    );
    expect(screen.getAllByRole('button', { name: /^Resend the invite email/ })).toHaveLength(1);

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Resend the invite email to old@example.com' }),
      );
    });

    expect(calls).toEqual([
      {
        path: '/admin/vendor-invites/33333333-3333-4333-8333-333333333333/resend',
        method: 'POST',
        body: undefined,
      },
    ]);
  });

  it('invites by a trimmed email, and revokes only an invite nobody has used', async () => {
    render(
      <VendorApplicationsPanel applications={[]} invites={INVITES} invitesPager={INVITES_PAGER} />,
    );

    const send = screen.getByRole('button', { name: 'Send invite' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Invite a vendor by email'), {
      target: { value: '  new@example.com ' },
    });
    await act(async () => {
      fireEvent.click(send);
    });

    expect(
      screen.queryByRole('button', { name: 'Revoke the invite for joined@example.com' }),
    ).toBeNull();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Revoke the invite for old@example.com' }),
      );
    });

    expect(calls).toEqual([
      { path: '/admin/vendor-invites', method: 'POST', body: { email: 'new@example.com' } },
      {
        path: '/admin/vendor-invites/33333333-3333-4333-8333-333333333333',
        method: 'DELETE',
        body: undefined,
      },
    ]);
    expect(screen.getByText(/Nobody has applied yet\./)).toBeDefined();
  });
});
