'use client';

import { useEffect, useState } from 'react';

/** How often the label re-reads the clock. A minute's resolution needs no faster tick. */
const TICK_MS = 30_000;

function label(minutes: number): string {
  if (minutes < 1) {
    return 'updated just now';
  }

  if (minutes < 60) {
    return `updated ${minutes}m ago`;
  }

  return `updated ${Math.floor(minutes / 60)}h ago`;
}

/**
 * The count line's last clause — frame `13` draws "updated 2m ago".
 *
 * It has to age on the client: the server renders one moment and the operator
 * leaves the console open. The first paint says "updated just now", which is
 * true of a server render and therefore hydrates without a mismatch; the tick
 * takes over from there. The page is `force-dynamic`, so a refresh really does
 * re-read the database and reset this.
 */
export function UpdatedAgo(): React.ReactElement {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const renderedAt = Date.now();
    const timer = setInterval(
      () => setMinutes(Math.floor((Date.now() - renderedAt) / 60_000)),
      TICK_MS,
    );

    return () => clearInterval(timer);
  }, []);

  return <span>{label(minutes)}</span>;
}
