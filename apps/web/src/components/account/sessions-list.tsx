'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AUTH_COPY, failureCopy } from '@/app/auth-copy';
import { ACCOUNT_SESSIONS_PATH } from '@/components/account/settings-paths';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import {
  endSessions,
  listSessions,
  type DeviceSession,
  type SessionsOutcome,
} from '@/lib/auth/auth-requests';
import { deviceLabel } from '@/lib/auth/device-label';
import { signInPathReturningTo } from '@/lib/return-path';

type Notice = { status: 'settled' | 'failed'; text: string };

function lastActive(at: string | null): string | null {
  const date = at === null ? null : new Date(at);

  if (date === null || Number.isNaN(date.getTime())) {
    return null;
  }

  const when = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${AUTH_COPY.lastActive} ${when}`;
}

/**
 * The devices the account is signed in on (VEN-681), read and ended through
 * the same-origin auth proxy, which never hands the browser a session token.
 * Signing a device out asks the proxy for that row's opaque id; the list is
 * read again afterwards rather than edited locally, so it shows what the
 * provider now holds. A session that ended elsewhere (401) sends the person to
 * sign in and back, as the other settings do.
 */
export function SessionsList(): React.ReactElement {
  const router = useRouter();
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    const result = await listSessions();

    if (result === 'signedOut') {
      router.push(signInPathReturningTo(ACCOUNT_SESSIONS_PATH));
      return;
    }

    if (typeof result === 'string') {
      setNotice({ status: 'failed', text: failureCopy(result, AUTH_COPY.sessionsLoadFailed) });
      return;
    }

    setSessions(result);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function end(id: string | undefined): Promise<void> {
    if (busy) {
      return;
    }

    setBusy(true);
    setNotice(null);
    const outcome: 'ok' | SessionsOutcome = await endSessions(id);

    if (outcome === 'signedOut') {
      router.push(signInPathReturningTo(ACCOUNT_SESSIONS_PATH));
      return;
    }

    if (outcome === 'ok') {
      setNotice({
        status: 'settled',
        text: id === undefined ? AUTH_COPY.sessionsEnded : AUTH_COPY.sessionEnded,
      });
      await load();
    } else {
      setNotice({ status: 'failed', text: failureCopy(outcome, AUTH_COPY.sessionEndFailed) });
    }

    setBusy(false);
  }

  const others = sessions?.filter((session) => !session.current) ?? [];

  return (
    <div>
      {notice ? (
        <Banner
          status={notice.status}
          role={notice.status === 'failed' ? 'alert' : 'status'}
          className="mb-4"
        >
          {notice.text}
        </Banner>
      ) : null}

      {sessions === null && notice === null ? (
        <p className="text-sm text-stone-600">{AUTH_COPY.sessionsLoading}</p>
      ) : null}

      {sessions === null ? null : (
        <>
          <ul className="divide-y divide-stone-300 border-y border-stone-300">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-4 py-4">
                <span className="flex min-w-0 flex-col">
                  <span className="text-base font-semibold text-stone-900">
                    {deviceLabel(session.userAgent)}
                    {session.current ? (
                      <span className="ml-2 text-sm font-normal text-stone-600">
                        {AUTH_COPY.thisDevice}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-sm text-stone-600">{lastActive(session.lastActiveAt)}</span>
                </span>
                {session.current ? null : (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    aria-label={`${AUTH_COPY.signOutDevice}: ${deviceLabel(session.userAgent)}`}
                    onClick={() => void end(session.id)}
                  >
                    {AUTH_COPY.signOutDevice}
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {others.length === 0 ? (
            <p className="mt-4 text-sm text-stone-600">{AUTH_COPY.sessionsNoOthers}</p>
          ) : (
            <Button
              variant="secondary"
              className="mt-6"
              disabled={busy}
              onClick={() => void end(undefined)}
            >
              {AUTH_COPY.signOutOthers}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
