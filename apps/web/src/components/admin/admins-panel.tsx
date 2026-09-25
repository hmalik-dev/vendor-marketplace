'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import {
  adminAccountChangeResultSchema,
  emailSchema,
  type AdminAccountRow,
} from '@vendor-marketplace/shared';
import { ConfirmAction } from '@/components/admin/confirm-action';
import { DataTable } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPill } from '@/components/ui/status-pill';
import { useApi } from '@/lib/use-api';

/** Same form as `/admin/activity`: absolute, 24-hour, UTC and saying so. */
const WHEN = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
  timeZoneName: 'short',
});

/**
 * Who can sign in to this console, and the two controls that change it
 * (VEN-506).
 *
 * Both go through `ConfirmAction`, so the step-up the API asks for arrives as
 * the code prompt every other irreversible action shows. Granting is by the
 * address the person signed up with: there is no invite and no sign-up path to
 * admin, so an account has to exist first.
 */
export function AdminsPanel({
  admins,
}: {
  admins: readonly AdminAccountRow[];
}): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const emailId = useId();
  const [email, setEmail] = useState('');
  const valid = emailSchema.safeParse(email.trim()).success;

  async function grant(): Promise<void> {
    await call('/admin/admins', {
      method: 'POST',
      body: { email: email.trim() },
      schema: adminAccountChangeResultSchema,
    });
    setEmail('');
    router.refresh();
  }

  async function revoke(admin: AdminAccountRow): Promise<void> {
    await call(`/admin/admins/${admin.userId}`, {
      method: 'DELETE',
      schema: adminAccountChangeResultSchema,
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 rounded-panel border border-stone-300 bg-stone-0 p-4">
        <label htmlFor={emailId} className="text-sm font-medium text-stone-900">
          Give admin access to an existing account
        </label>
        <div className="flex gap-2">
          <Input
            id={emailId}
            type="email"
            autoComplete="off"
            placeholder="The address they signed up with"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="max-w-sm text-sm"
          />
          <ConfirmAction
            trigger={
              <Button type="button" size="sm" disabled={!valid}>
                Grant admin access
              </Button>
            }
            title="Make this account an admin?"
            description={
              <>
                <strong className="font-semibold">{email.trim()}</strong> can sign in to this
                console and take every admin action from their next request.
              </>
            }
            confirmLabel="Grant access"
            onConfirm={grant}
          />
        </div>
      </div>
      <DataTable
        rows={admins}
        rowKey={(admin) => admin.userId}
        empty={null}
        columns={[
          {
            key: 'name',
            width: '1.4fr',
            header: 'Name',
            className: 'font-semibold text-stone-900',
            cell: (admin) => `${admin.firstName} ${admin.lastName}`.trim(),
          },
          { key: 'email', width: '1.8fr', header: 'Email', cell: (admin) => admin.email },
          {
            key: 'since',
            width: '1.4fr',
            header: 'Since',
            cell: (admin) => WHEN.format(new Date(admin.since)),
          },
          {
            key: 'grantedBy',
            width: '1.2fr',
            header: 'Granted by',
            cell: (admin) => admin.grantedByName ?? 'Set up before launch',
          },
          {
            key: 'state',
            width: '.8fr',
            header: 'State',
            cell: (admin) =>
              admin.isBanned ? (
                <StatusPill tone="inert">Suspended</StatusPill>
              ) : (
                <StatusPill tone="confirmed">Active</StatusPill>
              ),
          },
          {
            key: 'actions',
            width: '140px',
            header: '',
            className: 'flex justify-end',
            cell: (admin) =>
              admin.revocable ? (
                <ConfirmAction
                  destructive
                  trigger={
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      aria-label={`Remove admin access from ${admin.email}`}
                    >
                      Revoke
                    </Button>
                  }
                  title={`Remove ${admin.firstName} ${admin.lastName}'s admin access?`}
                  description="They go back to their previous role and can no longer sign in to this console. The last admin who can sign in can't be removed."
                  confirmLabel="Revoke access"
                  onConfirm={() => revoke(admin)}
                />
              ) : null,
          },
        ]}
      />
    </div>
  );
}
