'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import {
  emailSchema,
  MAX_EMAIL_LENGTH,
  type VendorApplicationDecision,
  type VendorApplicationStatus,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import { DataTable } from '@/components/admin/data-table';
import { Pager, type PagerProps } from '@/components/admin/pager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';
import {
  wireAdminVendorApplicationRowSchema,
  wireAdminVendorInviteRowSchema,
  type WireAdminVendorApplicationRow,
  type WireAdminVendorInviteRow,
} from '@/lib/wire-schemas';

/** Same form as `/admin/activity`: absolute and UTC, saying so. */
const WHEN = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const STATUS: Record<VendorApplicationStatus, { label: string; tone: StatusTone }> = {
  new: { label: 'New', tone: 'needsYou' },
  invited: { label: 'Invited', tone: 'confirmed' },
  declined: { label: 'Declined', tone: 'inert' },
};

/** `DELETE` answers 204, which the client reads as `null`. */
const NO_CONTENT = z.null();

export interface VendorApplicationsPanelProps {
  applications: readonly WireAdminVendorApplicationRow[];
  invites: readonly WireAdminVendorInviteRow[];
  /** Walks the invites table; the applications pager is the surface's own. */
  invitesPager: PagerProps;
}

/**
 * The vendor gate's console (VEN-406): the waitlist with invite and decline,
 * an invite by address, and every invite with whether it has been used.
 *
 * Deliberately unframed. It follows the console's surface — the `DataTable`
 * and the secondary buttons the categories table uses — rather than a layout
 * no frame draws.
 */
export function VendorApplicationsPanel({
  applications,
  invites,
  invitesPager,
}: VendorApplicationsPanelProps): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const fieldId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const emailValid = emailSchema.safeParse(email.trim()).success;

  async function run(write: () => Promise<unknown>, fallback: string): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      await write();
      router.refresh();
      return true;
    } catch (failure) {
      setError(userFacingError(failure, fallback));
      return false;
    } finally {
      setPending(false);
    }
  }

  function decide(
    application: WireAdminVendorApplicationRow,
    decision: VendorApplicationDecision,
  ): Promise<boolean> {
    return run(
      () =>
        call(`/admin/vendor-applications/${application.id}`, {
          method: 'PUT',
          body: { decision },
          schema: wireAdminVendorApplicationRowSchema,
        }),
      decision === 'invite' ? 'That invite did not send.' : 'That decline did not save.',
    );
  }

  async function inviteByEmail(): Promise<void> {
    const sent = await run(
      () =>
        call('/admin/vendor-invites', {
          method: 'POST',
          body: { email: email.trim() },
          schema: wireAdminVendorInviteRowSchema,
        }),
      'That invite did not send.',
    );

    if (sent) {
      setEmail('');
    }
  }

  function revoke(invite: WireAdminVendorInviteRow): Promise<boolean> {
    return run(
      () =>
        call(`/admin/vendor-invites/${invite.id}`, {
          method: 'DELETE',
          schema: NO_CONTENT,
        }),
      'That invite was not revoked.',
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto pb-2">
      {error ? (
        <p role="alert" className="mb-3 text-sm font-semibold text-error-500">
          {error}
        </p>
      ) : null}

      <h2 className="mb-2.5 font-display text-[21px] text-stone-900">Applications</h2>
      {applications.length === 0 ? (
        <p className="text-sm text-stone-700">
          Nobody has applied yet. Vendors who sign up without an invite while the gate is on land
          here.
        </p>
      ) : (
        <DataTable
          rows={applications}
          rowKey={(application) => application.id}
          empty={null}
          columns={[
            {
              key: 'business',
              width: '1.4fr',
              header: 'Business',
              cell: (application) => (
                <span className="flex flex-col">
                  <span className="font-semibold text-stone-900">{application.businessName}</span>
                  <span className="text-stone-600">{application.email}</span>
                </span>
              ),
            },
            {
              key: 'category',
              width: '1fr',
              header: 'Category · City',
              cell: (application) => `${application.category} · ${application.city}`,
            },
            {
              key: 'message',
              width: '1.6fr',
              header: 'Message',
              className: 'whitespace-pre-line break-words',
              cell: (application) => application.message || '—',
            },
            {
              key: 'applied',
              width: '.8fr',
              header: 'Applied',
              cell: (application) => WHEN.format(application.createdAt),
            },
            {
              key: 'status',
              width: '.7fr',
              header: 'Status',
              cell: (application) => (
                <StatusPill tone={STATUS[application.status].tone}>
                  {STATUS[application.status].label}
                </StatusPill>
              ),
            },
            {
              key: 'actions',
              width: '190px',
              header: '',
              className: 'flex justify-end gap-1.5',
              cell: (application) =>
                application.status === 'invited' ? null : (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      aria-label={`Invite ${application.businessName}`}
                      onClick={() => void decide(application, 'invite')}
                    >
                      Invite
                    </Button>
                    {application.status === 'new' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        aria-label={`Decline ${application.businessName}`}
                        onClick={() => void decide(application, 'decline')}
                      >
                        Decline
                      </Button>
                    ) : null}
                  </>
                ),
            },
          ]}
        />
      )}

      <div className="mt-6 mb-2.5 flex items-center justify-between gap-3">
        <h2 className="font-display text-[21px] text-stone-900">Invites</h2>
        <Pager {...invitesPager} />
      </div>
      <form
        noValidate
        className="mb-3 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (emailValid) {
            void inviteByEmail();
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${fieldId}-email`} className="text-sm font-semibold text-stone-700">
            Invite a vendor by email
          </label>
          <Input
            id={`${fieldId}-email`}
            type="email"
            maxLength={MAX_EMAIL_LENGTH}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-72"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={pending || !emailValid}>
          Send invite
        </Button>
      </form>

      {invites.length === 0 ? (
        <p className="text-sm text-stone-700">No invites yet.</p>
      ) : (
        <DataTable
          rows={invites}
          rowKey={(invite) => invite.id}
          empty={null}
          columns={[
            {
              key: 'email',
              width: '1.6fr',
              header: 'Email',
              className: 'font-semibold text-stone-900',
              cell: (invite) => invite.email,
            },
            {
              key: 'by',
              width: '1fr',
              header: 'Invited by',
              cell: (invite) => invite.invitedByName ?? '—',
            },
            {
              key: 'sent',
              width: '.8fr',
              header: 'Sent',
              cell: (invite) => WHEN.format(invite.createdAt),
            },
            {
              key: 'used',
              width: '.9fr',
              header: 'Account',
              cell: (invite) =>
                invite.acceptedAt ? (
                  <StatusPill tone="confirmed">Joined {WHEN.format(invite.acceptedAt)}</StatusPill>
                ) : (
                  <StatusPill tone="pending">Not yet</StatusPill>
                ),
            },
            {
              key: 'actions',
              width: '120px',
              header: '',
              className: 'flex justify-end',
              cell: (invite) =>
                invite.acceptedAt ? null : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    aria-label={`Revoke the invite for ${invite.email}`}
                    onClick={() => void revoke(invite)}
                  >
                    Revoke
                  </Button>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
