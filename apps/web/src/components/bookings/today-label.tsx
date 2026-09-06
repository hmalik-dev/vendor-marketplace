'use client';

import { useViewerToday } from '@/lib/use-viewer-today';

/**
 * Today's date, beside the hub's title — frame `07` draws it right-aligned on
 * the `Your bookings` baseline at `12.5px` in `stone-600`.
 *
 * **US English, not the frame's ordering.** The frame writes `Sunday, 26 April`;
 * `31-content-voice.md` makes every user-facing string US English, and that rule
 * says in its own words that it overrides the frames. So `Sunday, April 26`.
 *
 * **A client component for one line, deliberately.** The hub is a Server
 * Component and the date it would compute there is the *host's* day — the
 * mistake #409 and #391 were both filed for. A label that says "today" has to
 * be derived from the viewer's own clock, so this seeds from the server day for
 * the first paint and re-anchors after mount, exactly as `useViewerToday`
 * documents. The rest of the hub keeps the server day, because the
 * upcoming/history split is a server-rendered grouping and #391 ruled it there.
 */
const TODAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export interface TodayLabelProps {
  /** The server's UTC day as `YYYY-MM-DD`, for the first paint. */
  serverToday: string;
}

export function TodayLabel({ serverToday }: TodayLabelProps): React.ReactElement {
  const today = useViewerToday(serverToday);

  return (
    <span className="shrink-0 text-sm text-stone-600">
      {TODAY_FORMATTER.format(new Date(`${today}T00:00:00Z`))}
    </span>
  );
}
