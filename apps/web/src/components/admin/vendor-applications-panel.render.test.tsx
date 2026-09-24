import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminVendorApplicationRow, WireAdminVendorInviteRow } from '@/lib/wire-schemas';

const calls: { path: string; method?: string; body?: unknown }[] = [];
/** Makes the bulk invite call reject, for the "dialog stays open on failure" case. */
let bulkInviteFails = false;

vi.mock('@/lib/use-api', () => ({
  useApi: () => async (path: string, options: { method?: string; body?: unknown }) => {
    calls.push({ path, method: options.method, body: options.body });
    if (path === '/admin/vendor-applications/invite') {
      if (bulkInviteFails) {
        throw new Error('That did not reach us.');
      }
      // The bulk invite handler destructures `results`; every other call ignores what `call` resolves to.
      return { results: [] };
    }
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
    invitedByName: 'Ada Admin',
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
  bulkInviteFails = false;
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

  it('renders the Invites table with no duplicate-key warning (VEN-583)', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(
        <VendorApplicationsPanel
          applications={[]}
          invites={INVITES}
          invitesPager={INVITES_PAGER}
        />,
      );

      // With rows present: the collision is per-cell, so no rows means no warning either way.
      expect(screen.getByText('old@example.com')).toBeDefined();

      for (const call of consoleError.mock.calls) {
        expect(call.join(' ')).not.toContain('same key');
      }
    } finally {
      consoleError.mockRestore();
    }
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

  describe('bulk invite (VEN-513)', () => {
    const THIRD: WireAdminVendorApplicationRow = {
      id: '66666666-6666-4666-8666-666666666666',
      email: 'third@example.com',
      businessName: 'Third & Co',
      category: '99999999-9999-4999-8999-999999999999',
      categoryName: 'Florist',
      city: 'Austin',
      state: 'TX',
      message: '',
      status: 'new',
      complete: true,
      createdAt: new Date('2026-09-16T09:00:00.000Z'),
    };

    it('offers no checkbox on an invited or an incomplete row (AC6)', () => {
      render(
        <VendorApplicationsPanel
          applications={[...APPLICATIONS, THIRD]}
          invites={INVITES}
          invitesPager={INVITES_PAGER}
        />,
      );

      expect(screen.queryByLabelText('Select Old Mill Catering')).toBeNull();
      expect(screen.queryByLabelText('Select unfinished@example.com')).toBeNull();
      expect(screen.getByLabelText('Select Fern & Gather')).toBeDefined();
      expect(screen.getByLabelText('Select Third & Co')).toBeDefined();
    });

    it('selecting two of three new rows shows "Invite 2 selected", and confirming posts exactly those ids (AC6)', async () => {
      render(
        <VendorApplicationsPanel
          applications={[...APPLICATIONS, THIRD]}
          invites={INVITES}
          invitesPager={INVITES_PAGER}
        />,
      );

      fireEvent.click(screen.getByLabelText('Select Fern & Gather'));
      fireEvent.click(screen.getByLabelText('Select Third & Co'));

      const trigger = screen.getByRole('button', { name: 'Invite 2 selected' });
      await act(async () => {
        fireEvent.click(trigger);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Invite selected' }));
      });

      expect(calls).toEqual([
        {
          path: '/admin/vendor-applications/invite',
          method: 'POST',
          body: {
            applicationIds: [
              '11111111-1111-4111-8111-111111111111',
              '66666666-6666-4666-8666-666666666666',
            ],
          },
        },
      ]);
    });

    it('keeps the confirm dialog open with the error shown when the bulk invite fails', async () => {
      bulkInviteFails = true;
      render(
        <VendorApplicationsPanel
          applications={APPLICATIONS}
          invites={INVITES}
          invitesPager={INVITES_PAGER}
        />,
      );

      fireEvent.click(screen.getByLabelText('Select Fern & Gather'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Invite 1 selected' }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Invite selected' }));
      });

      // Still open: the confirm dialog's own controls are still on screen.
      expect(screen.getByRole('button', { name: 'Invite selected' })).toBeDefined();
      expect(screen.getByRole('alert')).toBeDefined();
    });

    it('the header checkbox selects only the new rows on the page', () => {
      render(
        <VendorApplicationsPanel
          applications={[...APPLICATIONS, THIRD]}
          invites={INVITES}
          invitesPager={INVITES_PAGER}
        />,
      );

      fireEvent.click(screen.getByLabelText('Select all on this page'));

      expect(screen.getByRole('button', { name: 'Invite 2 selected' })).toBeDefined();
    });
  });
});
