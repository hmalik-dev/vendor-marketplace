import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { viewerOn } from '@/testing/viewer-clock';
import type { LandingStatus } from '@/lib/landing-status';
import { StatusStrip } from './status-strip';
import { hasStatusStrip } from '@/lib/landing-status';

const NEXT = {
  vendorName: 'June Harlow Photography',
  eventDate: '2026-06-14',
  totalAmountCents: 205_000,
};

function status(overrides: Partial<LandingStatus> = {}): LandingStatus {
  return { next: NEXT, requestsWaitingOnVendor: 1, ...overrides };
}

describe('StatusStrip', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  /*
   * The countdown is relative to the **reader's** day, which the server cannot
   * know (#409) — so the clock is moved with the seed rather than only passed
   * in. `2026-04-26` to `2026-06-14` is 49 days.
   */
  it('counts the days to the next booking from the viewer own day', async () => {
    render(<StatusStrip status={status()} serverToday={viewerOn('2026-04-26')} />);

    const strip = await screen.findByRole('region', { name: 'Your bookings at a glance' });

    expect(strip.textContent).toContain('Next up — June Harlow Photography');
    expect(strip.textContent).toContain('Sun, Jun 14');
    expect(strip.textContent).toContain('in 49 days');
  });

  /*
   * "in 0 days" and "in 1 days" are arithmetic, not English. Both edges are
   * said in words instead.
   */
  it.each([
    ['2026-06-14', 'today'],
    ['2026-06-13', 'tomorrow'],
  ])('says %s as "%s" rather than counting it', async (today, expected) => {
    render(<StatusStrip status={status()} serverToday={viewerOn(today)} />);

    const strip = await screen.findByRole('region', { name: 'Your bookings at a glance' });

    expect(strip.textContent).toContain(`Sun, Jun 14 · ${expected}`);
  });

  /*
   * The server filters on `isUniversallyPastDate`, which deliberately keeps
   * yesterday's row — west of UTC yesterday is still today, and the server
   * cannot know which side of that the reader is on. Re-anchored here on the
   * reader's own day the same row can be behind them, and the strip read
   * "Sat, Apr 25 · today" about it while `/bookings` — one click away, through
   * the link in this very strip — filed it under history.
   */
  it.each([
    ['2026-06-15', 'the day after'],
    ['2026-06-16', 'two days after'],
  ])('drops a booking the reader own day has passed — %s, %s', async (today) => {
    render(<StatusStrip status={status()} serverToday={viewerOn(today)} />);

    const strip = await screen.findByRole('region', { name: 'Your bookings at a glance' });

    expect(strip.textContent).not.toContain('Next up');
    expect(strip.textContent).not.toContain('today');
    // The other item is untouched, and the strip still renders for it.
    expect(strip.textContent).toContain('1 request waiting on a vendor');
  });

  /* And with nothing else in it, the strip goes with the booking. */
  it('disappears when the passed booking was the only item', () => {
    const { container } = render(
      <StatusStrip
        status={status({ requestsWaitingOnVendor: 0 })}
        serverToday={viewerOn('2026-06-15')}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('pluralises the waiting requests', async () => {
    render(
      <StatusStrip
        status={status({ requestsWaitingOnVendor: 3 })}
        serverToday={viewerOn('2026-04-26')}
      />,
    );

    expect(screen.getByText('3 requests waiting on a vendor')).toBeDefined();
  });

  /* Render only the items that exist. */
  it('drops the booking item when there is no confirmed booking', async () => {
    render(<StatusStrip status={status({ next: null })} serverToday={viewerOn('2026-04-26')} />);

    const strip = await screen.findByRole('region', { name: 'Your bookings at a glance' });

    expect(strip.textContent).not.toContain('Next up');
    expect(strip.textContent).toContain('1 request waiting on a vendor');
  });

  it('drops the requests item when nothing is waiting', async () => {
    render(
      <StatusStrip
        status={status({ requestsWaitingOnVendor: 0 })}
        serverToday={viewerOn('2026-04-26')}
      />,
    );

    const strip = await screen.findByRole('region', { name: 'Your bookings at a glance' });

    expect(strip.textContent).toContain('Next up');
    expect(strip.textContent).not.toContain('waiting on a vendor');
  });

  /*
   * A 60px band of chrome saying nothing is worse than the hero starting 60px
   * higher. The page asks `hasStatusStrip` before rendering; this is the second
   * guard, so a caller that forgets still draws nothing.
   */
  it('renders nothing at all when there is neither', () => {
    const empty: LandingStatus = { next: null, requestsWaitingOnVendor: 0 };

    const { container } = render(
      <StatusStrip status={empty} serverToday={viewerOn('2026-04-26')} />,
    );

    expect(container.innerHTML).toBe('');
    expect(hasStatusStrip(empty)).toBe(false);
  });

  it('sends the reader on to their own hub', async () => {
    render(<StatusStrip status={status()} serverToday={viewerOn('2026-04-26')} />);

    expect(screen.getByRole('link', { name: 'All bookings →' })).toHaveProperty(
      'href',
      'http://localhost:3000/bookings',
    );
  });

  /*
   * Colour is a signal, not decoration (`40-states.md`): sage means settled,
   * gold means waiting on someone. Asserted as a class-level fact — jsdom
   * computes no cascade, and the rendered colour is the parity pass's to
   * confirm in a browser.
   */
  it('marks the settled item sage and the waiting one gold', async () => {
    const { container } = render(
      <StatusStrip status={status()} serverToday={viewerOn('2026-04-26')} />,
    );

    const dots = [...container.querySelectorAll('span[aria-hidden="true"].rounded-full')];

    expect(dots.map((dot) => dot.className.split(/\s+/).find((c) => c.startsWith('bg-')))).toEqual([
      'bg-sage-350',
      'bg-gold-400',
    ]);
  });
});
