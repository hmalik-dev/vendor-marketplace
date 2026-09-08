import { LEGAL_ACCEPTANCE_LABELS } from '@vendor-marketplace/shared';
import { notFound } from 'next/navigation';
import { AdminSurface } from '@/components/admin/admin-surface';
import { DataRightsActions } from '@/components/admin/data-rights-actions';
import { DataTable } from '@/components/admin/data-table';
import { Banner } from '@/components/ui/banner';
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

/**
 * Why the two addresses disagree, said once (#462).
 *
 * A sentence rather than a link to the mechanism: the operator reading it is
 * deciding what to do about one account, and what they need is that neither
 * side is broken and that the repair is on the other row.
 */
const ADDRESS_HELD_BY_ANOTHER_ACCOUNT =
  'The identity provider has a new address for this account, and another account already holds it — so it could not be written and every notification still goes to the old one. Freeing the address on the other account lets the next profile change through.';

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
        {/*
          The account's address stopped agreeing with the identity provider and
          nothing could say so before this (#462). It is first on the page and
          not inside a card about something else, because every other section
          here describes the record while this one says the record is wrong —
          and because it is read from the row rather than derived, an operator
          has no other way to learn it.

          `failed` rather than `pending`: `40-states.md` reserves gold for
          waiting on somebody and red for a thing that failed, and this is a
          write that was refused, not one still in flight. `Banner` derives the
          colour from that word, so it is not a choice made here.
        */}
        {rights.pendingEmail === null ? null : (
          <Banner status="failed" title="This address is out of date">
            {ADDRESS_HELD_BY_ANOTHER_ACCOUNT} Mail goes to {rights.email}; the identity provider
            holds {rights.pendingEmail}
            {rights.emailSyncFailedAt === null
              ? ''
              : `, and has since ${ACCEPTED.format(rights.emailSyncFailedAt)}`}
            .
          </Banner>
        )}

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
              {
                key: 'ip',
                width: '.9fr',
                header: 'From',
                /*
                  **Wraps, never truncates** — Pattern B rule 3 (#454).

                  `DataTable`'s cells are `overflow-clip text-ellipsis
                  whitespace-nowrap` by default, which is right for a scannable
                  list and wrong for a record an operator copies out of. Rule 3
                  is explicit: *"No ellipsis, no tooltip: a truncated Stripe id
                  is a call to support."* An acceptance IP is exactly that kind
                  of value — an IPv6 address is 39 characters and this track is
                  147px, so under the default it would ellipsise silently.

                  Overridden per column rather than in the primitive: the class
                  string is merged after the defaults, so these three win the
                  conflict, and every other admin table keeps the truncation its
                  own screens were measured with.
                */
                className: 'overflow-visible break-words whitespace-normal',
                cell: (row) => row.ip ?? '—',
              },
            ]}
          />
        </section>
      </div>
    </AdminSurface>
  );
}
