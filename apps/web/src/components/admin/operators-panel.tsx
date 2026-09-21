'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import {
  adminOperatorChangeResultSchema,
  emailSchema,
  type AdminOperatorRow,
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
 * operator, so an account has to exist first.
 */
export function OperatorsPanel({
  operators,
}: {
  operators: readonly AdminOperatorRow[];
}): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const emailId = useId();
  const [email, setEmail] = useState('');
  const valid = emailSchema.safeParse(email.trim()).success;

  async function grant(): Promise<void> {
    await call('/admin/operators', {
      method: 'POST',
      body: { email: email.trim() },
      schema: adminOperatorChangeResultSchema,
    });
    setEmail('');
    router.refresh();
  }

  async function revoke(operator: AdminOperatorRow): Promise<void> {
    await call(`/admin/operators/${operator.userId}`, {
      method: 'DELETE',
      schema: adminOperatorChangeResultSchema,
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 rounded-panel border border-stone-300 bg-stone-0 p-4">
        <label htmlFor={emailId} className="text-sm font-medium text-stone-900">
          Give operator access to an existing account
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
                Grant operator access
              </Button>
            }
            title="Make this account an operator?"
            description={
              <>
                <strong className="font-semibold">{email.trim()}</strong> will be able to sign in to
                this console and take every action an operator can, from their next request.
              </>
            }
            confirmLabel="Grant access"
            onConfirm={grant}
          />
        </div>
      </div>
      <DataTable
        rows={operators}
        rowKey={(operator) => operator.userId}
        empty={null}
        columns={[
          {
            key: 'name',
            width: '1.4fr',
            header: 'Name',
            className: 'font-semibold text-stone-900',
            cell: (operator) => `${operator.firstName} ${operator.lastName}`.trim(),
          },
          { key: 'email', width: '1.8fr', header: 'Email', cell: (operator) => operator.email },
          {
            key: 'since',
            width: '1.4fr',
            header: 'Since',
            cell: (operator) => WHEN.format(new Date(operator.since)),
          },
          {
            key: 'grantedBy',
            width: '1.2fr',
            header: 'Granted by',
            cell: (operator) => operator.grantedByName ?? 'Set up before launch',
          },
          {
            key: 'state',
            width: '.8fr',
            header: 'State',
            cell: (operator) =>
              operator.isBanned ? (
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
            cell: (operator) =>
              operator.revocable ? (
                <ConfirmAction
                  destructive
                  trigger={
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      aria-label={`Remove operator access from ${operator.email}`}
                    >
                      Revoke
                    </Button>
                  }
                  title={`Remove ${operator.firstName} ${operator.lastName}'s operator access?`}
                  description="They go back to the role they had before, and can no longer sign in to this console. The last operator who can sign in cannot be removed."
                  confirmLabel="Revoke access"
                  onConfirm={() => revoke(operator)}
                />
              ) : null,
          },
        ]}
      />
    </div>
  );
}
