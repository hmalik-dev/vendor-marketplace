import type { AdminNotificationRecipient } from '@vendor-marketplace/shared';
import {
  AdminCard,
  CardEmpty,
  CardTable,
  type CardTableColumn,
} from '@/components/admin/admin-detail';
import { StatusPill } from '@/components/ui/status-pill';
import type { WireAdminNotification } from '@/lib/wire-schemas';

/** 24-hour and UTC, like every stamp in the console (#454). */
const STAMP = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

const RECIPIENT_LABELS: Record<AdminNotificationRecipient, string> = {
  customer: 'Customer',
  vendor: 'Vendor',
};

type Item = WireAdminNotification & { recipient?: AdminNotificationRecipient };

/**
 * What the platform told someone and whether they read it (VEN-400) — the one
 * card the vendor, customer and booking detail views all carry.
 *
 * Read-only: sent-at, the notification with its stored type, and read state.
 * A booking's feed spans both parties, so its rows carry a `recipient` and
 * the card adds a `To` column; an account's own feed does not need one.
 */
export function NotificationsCard({
  total,
  unread,
  items,
  empty,
}: {
  total: number;
  unread: number;
  items: readonly Item[];
  /** The one line the card keeps when nothing was sent. */
  empty: string;
}): React.ReactElement {
  const columns: CardTableColumn<Item>[] = [
    {
      key: 'sent',
      header: 'Sent',
      width: '160px',
      cell: (item) => (
        <span className="font-mono text-meta">{STAMP.format(item.createdAt)} UTC</span>
      ),
    },
    ...(items.some((item) => item.recipient)
      ? [
          {
            key: 'to',
            header: 'To',
            width: '80px',
            cell: (item: Item) => (item.recipient ? RECIPIENT_LABELS[item.recipient] : null),
          },
        ]
      : []),
    {
      key: 'title',
      header: 'Notification',
      width: 'minmax(0,1fr)',
      cell: (item) => (
        <>
          {item.title}
          <span className="block font-mono text-helper text-stone-600">{item.type}</span>
        </>
      ),
    },
    {
      key: 'read',
      header: 'Read',
      width: '90px',
      align: 'end',
      cell: (item) =>
        item.readAt ? (
          <StatusPill tone="quoted">Read</StatusPill>
        ) : (
          <StatusPill tone="inert">Unread</StatusPill>
        ),
    },
  ];

  return (
    <AdminCard
      readOnly
      title={`Notifications sent · ${total}`}
      note={
        <span className="text-stone-600">
          {unread} unread
          {total > items.length ? ` · latest ${items.length} shown` : ''}
        </span>
      }
    >
      {items.length === 0 ? (
        <CardEmpty>{empty}</CardEmpty>
      ) : (
        <CardTable
          label="Notifications sent"
          rows={items}
          rowKey={(item) => item.id}
          columns={columns}
        />
      )}
    </AdminCard>
  );
}
