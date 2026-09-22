'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import {
  bulkInviteApplicationsResultSchema,
  emailSchema,
  MAX_EMAIL_LENGTH,
  type BulkInviteResultStatus,
  type VendorApplicationDecision,
  type VendorApplicationStatus,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import { ConfirmAction } from '@/components/admin/confirm-action';
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

/** One selected id's outcome, in the operator's words for the result summary (VEN-513). */
const BULK_RESULT_LABEL: Record<BulkInviteResultStatus, string> = {
  invited: 'invited',
  already_invited: 'already invited',
  not_found_or_decided: 'no longer available to invite',
  incomplete: 'missing details',
};

/** `DELETE` answers 204, which the client reads as `null`. */
const NO_CONTENT = z.null();

/** The select-all and per-row checkboxes share this exact look. */
const CHECKBOX_CLASS =
  "size-3.5 appearance-none rounded-[4px] border-[1.3px] border-stone-560 bg-stone-0 checked:border-clay-400 checked:bg-clay-400 checked:after:block checked:after:text-center checked:after:text-[9px] checked:after:leading-[12px] checked:after:text-stone-0 checked:after:content-['✓']";

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
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);

  /*
   * Only a `new`, complete application is invitable in bulk — the same gate
   * `decideVendorApplication` puts on the single Invite button, and the reason
   * an incomplete row draws no checkbox at all (VEN-513).
   */
  const selectableIds = applications
    .filter((application) => application.status === 'new' && application.complete)
    .map((application) => application.id);
  const selectedIds = selectableIds.filter((id) => selected.has(id));
  const allSelected = selectableIds.length > 0 && selectedIds.length === selectableIds.length;

  function toggleOne(id: string, checked: boolean): void {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  function toggleAll(checked: boolean): void {
    setSelected(checked ? new Set(selectableIds) : new Set());
  }

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

  /*
   * Not routed through `run`: `run` swallows a failure into the top banner and
   * resolves `true`/`false`, but `ConfirmAction.onConfirm` needs the promise
   * itself to reject on failure — that is what keeps the dialog open with the
   * error shown in it, the same contract every other `ConfirmAction` in the
   * console relies on (`vendor-table.tsx`'s row and bulk actions never catch
   * either). Swallowing here made a failed bulk invite close the dialog as
   * though it had succeeded, with only the scrolled-past top banner saying
   * otherwise.
   */
  async function bulkInvite(): Promise<void> {
    const { results } = await call('/admin/vendor-applications/invite', {
      method: 'POST',
      body: { applicationIds: selectedIds },
      schema: bulkInviteApplicationsResultSchema,
    });

    const counts = new Map<BulkInviteResultStatus, number>();
    for (const result of results) {
      counts.set(result.status, (counts.get(result.status) ?? 0) + 1);
    }
    const emailFailures = results.filter((result) => result.emailFailed).length;

    setBulkSummary(
      [...counts.entries()]
        .map(([status, count]) => `${count} ${BULK_RESULT_LABEL[status]}`)
        .join(', ') +
        (emailFailures > 0
          ? `. ${emailFailures} invite ${emailFailures === 1 ? 'email' : 'emails'} did not send and will be retried.`
          : '.'),
    );
    setSelected(new Set());
    router.refresh();
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

  function resend(invite: WireAdminVendorInviteRow): Promise<boolean> {
    return run(
      () =>
        call(`/admin/vendor-invites/${invite.id}/resend`, {
          method: 'POST',
          schema: wireAdminVendorInviteRowSchema,
        }),
      'That invite email did not send.',
    );
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
      {bulkSummary ? (
        <p role="status" className="mb-3 text-sm text-stone-700">
          {bulkSummary}
        </p>
      ) : null}

      <h2 className="mb-2.5 font-display text-[21px] text-stone-900">Applications</h2>
      {applications.length === 0 ? (
        <p className="text-sm text-stone-700">
          Nobody has applied yet. Vendors who sign up without an invite while the gate is on land
          here.
        </p>
      ) : (
        <>
          {/*
            No frame covers this screen (`00-README.md`: "Exempt — derived"), so
            the select-all control and the bulk button sit in a plain row above
            the table rather than inside `DataTable`'s header, whose `header` is
            typed as a plain label string for the other five admin tables.
          */}
          {selectableIds.length > 0 ? (
            <div className="mb-2.5 flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={pending}
                  onChange={(event) => toggleAll(event.currentTarget.checked)}
                  className={CHECKBOX_CLASS}
                />
                Select all on this page
              </label>
              {selectedIds.length > 0 ? (
                <ConfirmAction
                  trigger={
                    <Button type="button" size="sm" variant="secondary" disabled={pending}>
                      Invite {selectedIds.length} selected
                    </Button>
                  }
                  title={`Invite ${selectedIds.length} ${selectedIds.length === 1 ? 'vendor' : 'vendors'}?`}
                  description={`Each address gets its own invite email, exactly as if it were invited one at a time.`}
                  confirmLabel="Invite selected"
                  onConfirm={bulkInvite}
                />
              ) : null}
            </div>
          ) : null}
          <DataTable
            rows={applications}
            rowKey={(application) => application.id}
            empty={null}
            columns={[
              {
                key: 'select',
                width: '22px',
                header: '',
                className: 'overflow-visible',
                cell: (application) =>
                  application.status === 'new' && application.complete ? (
                    <label className="-ml-[15px] flex h-11 w-11 shrink-0 cursor-pointer items-center justify-start pl-[15px] max-md:ml-0 max-md:pl-0">
                      <span className="sr-only">
                        Select {application.businessName ?? application.email}
                      </span>
                      <input
                        type="checkbox"
                        checked={selected.has(application.id)}
                        disabled={pending}
                        onChange={(event) => toggleOne(application.id, event.currentTarget.checked)}
                        className={CHECKBOX_CLASS}
                      />
                    </label>
                  ) : null,
              },
              {
                key: 'business',
                width: '1.4fr',
                header: 'Business',
                cell: (application) => (
                  <span className="flex flex-col">
                    <span className="font-semibold text-stone-900">
                      {application.businessName ?? '—'}
                    </span>
                    <span className="text-stone-600">{application.email}</span>
                  </span>
                ),
              },
              {
                key: 'category',
                width: '1fr',
                header: 'Category · City',
                cell: (application) =>
                  application.category || application.city
                    ? // `categoryName` is null for a pre-VEN-512 free-text row; `category` itself is already readable there.
                      `${application.categoryName ?? application.category ?? '—'} · ${application.city ?? '—'}`
                    : '—',
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
                width: '.9fr',
                header: 'Status',
                cell: (application) => (
                  <span className="flex flex-wrap gap-1.5">
                    <StatusPill tone={STATUS[application.status].tone}>
                      {STATUS[application.status].label}
                    </StatusPill>
                    {/* The row exists before the person has given their details; Invite is blocked, not the whole row. */}
                    {application.complete ? null : (
                      <StatusPill tone="pending">Incomplete</StatusPill>
                    )}
                  </span>
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
                        disabled={pending || !application.complete}
                        title={
                          application.complete
                            ? undefined
                            : 'This applicant has not given a business name, category and city yet.'
                        }
                        aria-label={`Invite ${application.businessName ?? application.email}`}
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
                          aria-label={`Decline ${application.businessName ?? application.email}`}
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
        </>
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
              key: 'email',
              width: '.9fr',
              header: 'Email',
              cell: (invite) =>
                invite.emailStatus === 'failed' ? (
                  <span title={invite.emailFailureReason ?? undefined}>
                    <StatusPill tone="failed">Email failed</StatusPill>
                  </span>
                ) : invite.emailStatus === 'sent' ? (
                  <StatusPill tone="inert">Sent</StatusPill>
                ) : (
                  '—'
                ),
            },
            {
              key: 'actions',
              width: '220px',
              header: '',
              className: 'flex justify-end gap-2',
              cell: (invite) =>
                invite.acceptedAt ? null : (
                  <>
                    {invite.emailStatus === 'failed' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        aria-label={`Resend the invite email to ${invite.email}`}
                        onClick={() => void resend(invite)}
                      >
                        Resend
                      </Button>
                    ) : null}
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
                  </>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
