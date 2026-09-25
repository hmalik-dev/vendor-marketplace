import { LEGAL_ACCEPTANCE_LABELS, uuidSchema } from '@vendor-marketplace/shared';
import { notFound } from 'next/navigation';
import {
  Absent,
  AdminCard,
  DetailGrid,
  DetailHeader,
  IdentityCard,
  KeyValue,
  KeyValueList,
  ScopeChip,
} from '@/components/admin/admin-detail';
import { DataRightsActions } from '@/components/admin/data-rights-actions';
import { Banner } from '@/components/ui/banner';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { ApiClientError } from '@/lib/api-client';
import { getCurrentUser } from '@/lib/current-user';
import { getAdminUserDataRights } from '@/lib/admin-data';

/** Reads a live account and the record it leaves behind; never cached. */
export const dynamic = 'force-dynamic';

/*
 * 24-hour and in UTC, like every stamp on the case detail one click away
 * (#454): an acceptance timestamp is evidence, and `2:02 PM` is a form a reader
 * has to disambiguate before comparing two of them.
 */
const ACCEPTED = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

/**
 * Why the two addresses disagree, said once (#462).
 *
 * A sentence rather than a link to the mechanism: the admin reading it is
 * deciding what to do about one account, and what they need is that neither
 * side is broken and that the repair is on the other row.
 */
const ADDRESS_HELD_BY_ANOTHER_ACCOUNT =
  'The identity provider has a new address for this account, but another account already holds it. Free the address on the other account to let the next profile change through.';

const RETAINED_LABELS: Record<string, string> = {
  bookingRequests: 'Booking requests',
  bookings: 'Bookings',
  reviewsWritten: 'Reviews written',
  reviewsReceived: 'Reviews received',
  messages: 'Messages',
  notifications: 'Notifications',
  legalAcceptances: 'Legal acceptances',
};

/** Where the breadcrumb goes back to; an admin's own account has no list. */
const ROLE_LISTS: Record<string, { label: string; href: string }> = {
  customer: { label: 'Customers', href: '/admin/customers' },
  vendor: { label: 'Vendors', href: '/admin/vendors' },
};

const TABLE_ROW = 'grid grid-cols-[minmax(0,1fr)_110px] items-center gap-2.5 px-4';

/**
 * One account's data rights, composed to Pattern B (#438, #393).
 *
 * **Left is the record, right is identity and actions**, and the right column
 * is the only place anything that changes state may sit: the two record cards
 * are declared read-only and carry no control at all.
 *
 * **It shows a closed account rather than hiding one.** The privacy policy says
 * records are kept, so an admin asked "what do you still hold about me" gets
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
   * `params` is attacker-controlled (`.claude/rules/web-route-boundaries.md`): a
   * 1000-character id comes back from the API as a 414, which is not a 404 and
   * rendered the 500 page. An id that is not a uuid cannot name an account.
   */
  if (!uuidSchema.safeParse(userId).success) {
    notFound();
  }

  /*
   * Who is looking, so the page can refuse what the API refuses. `close`
   * answers 403 to an admin closing their own account — they would take
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
     * other failure — a 403 for a suspended admin, a 500 — is rethrown, so
     * this cannot turn a real fault into a quiet "no such person".
     */
    if (error instanceof ApiClientError && (error.statusCode === 404 || error.statusCode === 400)) {
      notFound();
    }

    throw error;
  }

  const name = rights.name || rights.email;
  const retained = Object.entries(rights.retained);
  const heldTotal = retained.reduce((sum, [, count]) => sum + count, 0);
  const state: { label: string; tone: StatusTone } = rights.closedAt
    ? { label: 'Closed', tone: 'inert' }
    : rights.isBanned
      ? { label: 'Flagged', tone: 'failed' }
      : { label: 'Live', tone: 'confirmed' };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DetailHeader
        crumb={ROLE_LISTS[rights.role]}
        current={name}
        heading={name}
        pills={<StatusPill tone={state.tone}>{state.label}</StatusPill>}
        stat={
          <>
            {rights.role} · {heldTotal} retained {heldTotal === 1 ? 'record' : 'records'}
          </>
        }
      />

      <DetailGrid
        record={
          <>
            {/*
              The account's address stopped agreeing with the identity provider
              (#462). First in the record, because every card below describes
              the record while this says the record is wrong — and it is read
              from the row, so an admin has no other way to learn it.

              `failed` rather than `pending`: this is a write that was refused,
              not one still in flight, and `Banner` derives the colour from that
              word.
            */}
            {rights.pendingEmail === null ? null : (
              <Banner status="failed" title="This address is out of date">
                {ADDRESS_HELD_BY_ANOTHER_ACCOUNT} Mail goes to {rights.email}. The identity provider
                holds {rights.pendingEmail}
                {rights.emailSyncFailedAt === null
                  ? ''
                  : `, and has since ${ACCEPTED.format(rights.emailSyncFailedAt)} UTC`}
                .
              </Banner>
            )}

            <AdminCard
              readOnly
              title="What is still held"
              note={
                <span className="text-stone-600">What the export lists · kept after closure</span>
              }
            >
              <div
                role="table"
                aria-label="Records still held, by category"
                className="text-action text-stone-900"
              >
                <div role="rowgroup">
                  <div
                    role="row"
                    className={`${TABLE_ROW} border-b border-stone-150 py-2 text-label font-semibold tracking-label text-stone-600 uppercase`}
                  >
                    <span role="columnheader">Category</span>
                    <span role="columnheader" className="text-right">
                      Records
                    </span>
                  </div>
                </div>
                <div role="rowgroup">
                  {retained.map(([key, count], index) => (
                    <div
                      key={key}
                      role="row"
                      className={`${TABLE_ROW} h-[34px] ${index % 2 === 1 ? 'bg-stone-25' : ''} ${
                        index < retained.length - 1 ? 'border-b border-stone-150' : ''
                      }`}
                    >
                      <span role="cell">{RETAINED_LABELS[key] ?? key}</span>
                      <span role="cell" data-kind="mono" className="text-right font-mono text-meta">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </AdminCard>

            <AdminCard
              readOnly
              title={`Legal acceptances · ${rights.legalAcceptances.length}`}
              note={<ScopeChip>Read-only — append-only in the database</ScopeChip>}
            >
              {/*
                Read-only fields, one group per acceptance. The record is
                append-only — three triggers refuse an update, a delete and a
                table-wide wipe — so there is nothing to edit and no control
                that would.

                **Wraps, never truncates** — Pattern B rule 3 (#454). An IPv6
                address is 39 characters, and a truncated identifier is a call
                to support.
              */}
              {rights.legalAcceptances.length === 0 ? (
                <p className="px-4 py-3 text-sm text-stone-600">
                  No acceptances recorded. A row is added when the person accepts a document.
                  Accounts older than the record have none.
                </p>
              ) : (
                rights.legalAcceptances.map((row, index) => (
                  <KeyValueList
                    key={row.id}
                    className={index > 0 ? 'border-t border-stone-150' : undefined}
                  >
                    <KeyValue label="Document">
                      <span className="font-semibold">{LEGAL_ACCEPTANCE_LABELS[row.document]}</span>
                    </KeyValue>
                    <KeyValue label="Version" kind="mono">
                      {row.version}
                    </KeyValue>
                    <KeyValue label="Accepted" kind="mono">
                      {ACCEPTED.format(row.acceptedAt)} UTC
                    </KeyValue>
                    <KeyValue label="By">{row.acceptedByName}</KeyValue>
                    <KeyValue label="On behalf of">{row.businessName ?? <Absent />}</KeyValue>
                    <KeyValue label="From" kind="mono">
                      {row.ip ?? <Absent />}
                    </KeyValue>
                  </KeyValueList>
                ))
              )}
            </AdminCard>
          </>
        }
        aside={
          <>
            <IdentityCard
              name={name}
              subtitle={<span className="capitalize">{rights.role}</span>}
              fields={[
                { label: 'Contact', value: rights.email },
                { label: 'Account', value: rights.userId, mono: true },
                ...(rights.vendorSlug
                  ? [{ label: 'Slug', value: rights.vendorSlug, mono: true }]
                  : []),
              ]}
            />

            <AdminCard title="Actions">
              <DataRightsActions
                userId={rights.userId}
                name={name}
                closedAt={rights.closedAt}
                closeBlockers={rights.closeBlockers}
                bookingsRefundedOnClose={rights.bookingsRefundedOnClose}
                isSelf={viewer?.id === rights.userId}
                email={rights.email}
                isAdmin={rights.role === 'admin'}
                isBanned={rights.isBanned}
                unwindPending={rights.unwindPending}
              />
            </AdminCard>
          </>
        }
      />
    </div>
  );
}
