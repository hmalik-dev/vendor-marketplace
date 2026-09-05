import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useViewerToday } from './use-viewer-today';

/*
 * The zone `vitest.config.mts` pins the whole suite to. Restored by name rather
 * than by capturing `process.env.TZ`: that reads `undefined` when nothing
 * exported it, and assigning `undefined` back writes the literal string
 * `"undefined"`, which V8 takes as an invalid zone and then keeps for the rest
 * of the file — so a test that looked like it was in Tokyo silently stayed put.
 * `process.env` is process-global and vitest reuses a worker across files, so
 * leaving it wrong leaks into whatever runs next.
 */
const SUITE_TZ = 'UTC';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  process.env.TZ = SUITE_TZ;
});

function Probe({ serverToday }: { serverToday: string }): React.ReactElement {
  return <output>{useViewerToday(serverToday)}</output>;
}

/**
 * Put the process on one instant, in one timezone.
 *
 * Node re-reads `process.env.TZ` on the next date operation, so assigning it
 * here is what lets one suite assert both sides of UTC — which is what #409 is
 * about, and what no single-timezone test can catch.
 */
function viewerAt(timeZone: string, instant: string): void {
  process.env.TZ = timeZone;
  vi.useFakeTimers();
  vi.setSystemTime(new Date(instant));
}

describe('useViewerToday', () => {
  /*
   * The defect: at 21:00 in Chicago the UTC day has already rolled over, so a
   * server-rendered "today" said 09-04 while the vendor was still living in
   * 09-03 — their current day drawn as history on the availability calendar.
   */
  it('re-anchors a server day that is ahead of the viewer’s (west of UTC)', () => {
    viewerAt('America/Chicago', '2026-09-04T02:00:00Z');

    render(<Probe serverToday="2026-09-04" />);

    expect(screen.getByRole('status').textContent).toBe('2026-09-03');
  });

  /* The mirror image: east of UTC the server's day is yesterday for the viewer,
     and a date floor built from it leaves yesterday pickable. */
  it('re-anchors a server day that is behind the viewer’s (east of UTC)', () => {
    viewerAt('Asia/Tokyo', '2026-09-03T22:00:00Z');

    render(<Probe serverToday="2026-09-03" />);

    expect(screen.getByRole('status').textContent).toBe('2026-09-04');
  });

  it('leaves the server day alone when the viewer is on it', () => {
    viewerAt('UTC', '2026-09-04T12:00:00Z');

    render(<Probe serverToday="2026-09-04" />);

    expect(screen.getByRole('status').textContent).toBe('2026-09-04');
  });
});
