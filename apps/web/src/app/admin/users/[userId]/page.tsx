import { LEGAL_ACCEPTANCE_LABELS } from '@vendor-marketplace/shared';
import { notFound } from 'next/navigation';
import { AdminSurface } from '@/components/admin/admin-surface';
import { DataRightsActions } from '@/components/admin/data-rights-actions';
import { DataTable } from '@/components/admin/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { ApiClientError } from '@/lib/api-client';
import { getCurrentUser } from '@/lib/current-user';
import { getAdminUserDataRights } from '@/lib/admin-data';

/** Reads a live account and the record it leaves behind; never cached. */
export const dynamic = 'force-dynamic';

const ACCEPTED = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
});

const RETAINED_LABELS: Record<string, string> = {
  bookingRequests: 'Booking requests',
  bookings: 'Bookings',
  reviewsWritten: 'Reviews written',
  reviewsReceived: 'Reviews received',
  messages: 'Messages',
  notifications: 'Notifications',
  legalAcceptances: 'Legal acceptances',
};

/**
 * One account's data rights: what is still held, what can be exported, and
 * whether it can be closed (#438).
 *
 * **It shows a closed account rather than hiding one.** The privacy policy says
 * records are kept, so an operator asked "what do you still hold about me" gets
 * the same answer the export gives — counted here, enumerated there, from one
 * gather on the API so the two cannot drift.
 */
export default async function AdminUserDataRightsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<React.ReactElement> {
  const { userId } = await params;
  /*
   * Who is looking, so the page can refuse what the API refuses. `close`
   * answers 403 to an operator closing their own account — they would take
   * the `admin_actions` log that names them with it — and a control that
   * offers an action the server will refuse is a control that lies.
   */
  const viewer = await getCurrentUser();

  let rights: Awaited<ReturnType<typeof getAdminUserDataRights>>;

  try {
    rights = await getAdminUserDataRights(userId);
  } catch (error) {
    /*
     * A malformed or unknown id is a wrong URL, not an error boundary. Every
     * other failure — a 403 for a suspended operator, a 500 — is rethrown, so
     * this cannot turn a real fault into a quiet "no such person".
     */
    if (error instanceof ApiClientError && (error.statusCode === 404 || error.statusCode === 400)) {
      notFound();
    }

    throw error;
  }

  const retained = Object.entries(rights.retained);
  const heldTotal = retained.reduce((sum, [, count]) => sum + count, 0);

  return (
    <AdminSurface
      heading={rights.name || rights.email}
      counts={[
        rights.email,
        rights.role,
        rights.closedAt ? 'Closed' : rights.isBanned ? 'Flagged' : 'Live',
        `${heldTotal} retained ${heldTotal === 1 ? 'record' : 'records'}`,
      ]}
    >
      <div className="flex flex-col gap-6 overflow-y-auto pb-6">
        <section className="rounded-xl border border-stone-300 bg-stone-0 p-4">
          <h2 className="display-heading text-display-sm text-stone-900">Data rights</h2>
          <p className="mt-1 mb-3 text-sm leading-prose text-stone-700">
            The privacy policy promises a copy of what we hold, and closure on request. Both are
            answered here. Closure retires the account and takes any storefront down; it never
            deletes the record. It never prices the account holder&apos;s own bookings — those have
            to be cancelled first — and where the account is a vendor, the bookings their customers
            hold are cancelled and refunded in full.
          </p>
          <DataRightsActions
            userId={rights.userId}
            name={rights.name || rights.email}
            closedAt={rights.closedAt}
            closeBlockers={rights.closeBlockers}
            bookingsRefundedOnClose={rights.bookingsRefundedOnClose}
            isSelf={viewer?.id === rights.userId}
          />
        </section>

        <section className="rounded-xl border border-stone-300 bg-stone-0 p-4">
          <h2 className="display-heading text-display-sm text-stone-900">What is still held</h2>
          <p className="mt-1 mb-3 text-sm leading-prose text-stone-700">
            Exactly what the export enumerates. A closed account keeps all of it — the other
            party&apos;s copy of a booking or a conversation is theirs as much as it is this
            account&apos;s.
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {retained.map(([key, count]) => (
              <div key={key} className="flex flex-col">
                <dt className="text-meta text-stone-600">{RETAINED_LABELS[key] ?? key}</dt>
                <dd className="font-semibold text-stone-900">{count}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-stone-300 bg-stone-0 p-4">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h2 className="display-heading text-display-sm text-stone-900">Legal acceptances</h2>
            <StatusPill tone="inert">Read-only</StatusPill>
          </div>
          <p className="mt-1 mb-3 text-sm leading-prose text-stone-700">
            The record that answers &ldquo;did they agree to this, and to which version&rdquo;. It
            is append-only in the database — three triggers refuse an update, a delete and a
            table-wide wipe — so there is nothing to edit here and no control that would.
          </p>
          <DataTable
            rows={rights.legalAcceptances}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                headline="No acceptances recorded"
                description="A row is written when the person accepts a document. Accounts that predate the record have none."
              />
            }
            columns={[
              {
                key: 'document',
                width: '1.2fr',
                header: 'Document',
                className: 'font-semibold text-stone-900',
                cell: (row) => LEGAL_ACCEPTANCE_LABELS[row.document],
              },
              { key: 'version', width: '.6fr', header: 'Version', cell: (row) => row.version },
              {
                key: 'accepted',
                width: '1.2fr',
                header: 'Accepted',
                cell: (row) => ACCEPTED.format(row.acceptedAt),
              },
              { key: 'by', width: '1.2fr', header: 'By', cell: (row) => row.acceptedByName },
              {
                key: 'business',
                width: '1.2fr',
                header: 'On behalf of',
                cell: (row) => row.businessName ?? '—',
              },
              { key: 'ip', width: '.9fr', header: 'From', cell: (row) => row.ip ?? '—' },
            ]}
          />
        </section>
      </div>
    </AdminSurface>
  );
}
