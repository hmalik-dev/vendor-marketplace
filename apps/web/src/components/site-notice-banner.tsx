'use client';

import { useEffect, useState } from 'react';
import type { PublicPlatformNotice } from '@vendor-marketplace/shared';
import { cn } from '@/lib/utils';

/** Session-scoped, so a closed notice stays closed until the tab does. */
export const DISMISSED_NOTICE_KEY = 'site-notice-dismissed';

type Notice = NonNullable<PublicPlatformNotice>;

/** `info` is standing context; `warning` interrupts, so it is announced as an alert. */
const TONES: Record<Notice['tone'], { role: 'status' | 'alert'; surface: string }> = {
  info: { role: 'status', surface: 'border-steel-200 bg-steel-50 text-steel-600' },
  warning: { role: 'alert', surface: 'border-gold-300 bg-gold-50 text-gold-600' },
};

function dismissedNotice(): string | null {
  try {
    return window.sessionStorage.getItem(DISMISSED_NOTICE_KEY);
  } catch {
    return null;
  }
}

/**
 * The site-wide notice an admin posts during an incident (VEN-616), above the
 * navigation on every page.
 *
 * Dismissal is remembered against the tone **and** the words, so a notice that
 * changes either shows again to a visitor who closed the last one. Storage can
 * be blocked, so a failed read or write only means it comes back on the next page.
 *
 * It draws nothing until the browser has read that storage. The server cannot,
 * so drawing on the server would flash a dismissed notice on every reload and
 * re-announce a dismissed warning to a screen reader; the cost is that the
 * banner arrives just after hydration for a visitor who has not dismissed it.
 */
export function SiteNoticeBanner({ message, tone }: Notice): React.ReactElement | null {
  const notice = `${tone}:${message}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(dismissedNotice() !== notice);
  }, [notice]);

  if (!visible) {
    return null;
  }

  function dismiss(): void {
    setVisible(false);

    try {
      window.sessionStorage.setItem(DISMISSED_NOTICE_KEY, notice);
    } catch {
      // Blocked storage: the banner stays closed for this page view only.
    }
  }

  const { role, surface } = TONES[tone];

  return (
    <div
      role={role}
      data-tone={tone}
      data-slot="site-notice"
      className={cn('flex items-start gap-3 border-b px-4 py-2.5 sm:px-8', surface)}
    >
      <p className="min-w-0 flex-1 text-sm leading-normal">{message}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss notice"
        className="-my-1 shrink-0 cursor-pointer rounded-md px-2 py-1 text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Dismiss
      </button>
    </div>
  );
}
