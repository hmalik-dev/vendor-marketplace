'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@/lib/use-api';
import { useEventStream } from '@/lib/use-event-stream';
import { wireNotificationPageSchema, type WireNotification } from '@/lib/wire-schemas';
import { cn } from '@/lib/utils';

/** Past this the badge stops being a count and becomes "a lot". */
const BADGE_CEILING = 9;

const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export interface NotificationBellProps {
  /** Seed rows. Empty in the app, where the bell fetches its own on mount. */
  initial?: readonly WireNotification[];
}

/**
 * The bell and its panel.
 *
 * The badge counts unread rows and nothing else — it is a query result, so it
 * cannot drift from what the panel shows. New notifications arrive over the
 * shared stream, so the badge moves without a reload.
 */
export function NotificationBell({ initial = [] }: NotificationBellProps): React.ReactElement {
  const call = useApi();
  const [items, setItems] = useState<WireNotification[]>([...initial]);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const unread = items.filter((item) => item.readAt === null).length;

  const refresh = useCallback(async () => {
    try {
      const page = await call('/notifications', { schema: wireNotificationPageSchema });
      setItems(page.items);
    } catch {
      // The badge keeps its last known value rather than dropping to zero,
      // which would read as "all clear" when it means "we could not ask".
    }
  }, [call]);

  /*
   * Fetched here rather than server-rendered: the header is on every page, and
   * a user-scoped read in it would add a round trip to every single one.
   */
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEventStream({
    onEvent: (event) => {
      if (event.type === 'new_notification') {
        void refresh();
      }
    },
    onReconnect: () => void refresh(),
  });

  // A click anywhere else closes the panel, which is what a panel does.
  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent): void {
      if (!panel.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  async function markRead(id: string): Promise<void> {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, readAt: new Date() } : item)),
    );

    await call(`/notifications/${id}/read`, {
      schema: wireNotificationPageSchema.nullable(),
      method: 'PUT',
    }).catch(() => undefined);
  }

  async function markAllRead(): Promise<void> {
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date() })));

    await call('/notifications/read-all', {
      schema: wireNotificationPageSchema.nullable(),
      method: 'PUT',
    }).catch(() => undefined);
  }

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={unread === 0 ? 'Notifications' : `Notifications, ${unread} unread`}
        aria-expanded={open}
        className="relative flex size-11 items-center justify-center rounded-full text-stone-700 hover:bg-stone-150 hover:text-stone-900"
      >
        <Bell aria-hidden="true" className="size-4.5" />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-clay-400 px-1 text-[10px] font-bold text-stone-0">
            {unread > BADGE_CEILING ? `${BADGE_CEILING}+` : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div /* Inside the header's own stacking context, so a local z is enough. */
          className="absolute right-0 z-10 mt-2 w-90 overflow-hidden rounded-xl border border-stone-300 bg-stone-0 shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2.5">
            <p className="text-base font-semibold text-stone-900">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-sm font-semibold text-clay-500 hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-base text-stone-600">No notifications yet</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((item) => {
                const body = (
                  <>
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          'text-base text-stone-900',
                          item.readAt === null ? 'font-semibold' : 'font-medium',
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="shrink-0 text-xs text-stone-600">
                        {WHEN.format(item.createdAt)}
                      </span>
                    </span>
                    {item.body ? (
                      <span className="mt-0.5 block text-sm leading-normal text-stone-700">
                        {item.body}
                      </span>
                    ) : null}
                  </>
                );

                const shared = cn(
                  'block w-full border-b border-stone-200 px-4 py-3 text-left last:border-b-0',
                  item.readAt === null ? 'bg-clay-50' : 'bg-stone-0',
                  'hover:bg-stone-100',
                );

                return (
                  <li key={item.id}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => void markRead(item.id)}
                        className={shared}
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void markRead(item.id)}
                        className={shared}
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
