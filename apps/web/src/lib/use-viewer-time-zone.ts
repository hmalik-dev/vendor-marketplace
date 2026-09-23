'use client';

import { useEffect, useState } from 'react';

/**
 * The viewer's IANA time zone, for stating an instant in their own clock.
 *
 * `'UTC'` for the first render, then the browser's zone after mount — the same
 * effect-not-render shape as `useViewerToday`, and for the same reason: the
 * server cannot know the viewer's zone, and a first client tree formatted in
 * a different zone from the server's HTML is a hydration mismatch. The UTC
 * first paint is still a true statement, because its zone is named.
 */
export function useViewerTimeZone(): string {
  const [timeZone, setTimeZone] = useState('UTC');

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  return timeZone;
}

/**
 * An instant as a customer reads a deadline: `Oct 7, 5:00 PM PDT`. The zone is
 * always named, because a bare date is what hid VEN-615's gap.
 */
export function formatInstant(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(instant);
}
