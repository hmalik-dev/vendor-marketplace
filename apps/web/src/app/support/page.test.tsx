import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const readIdentityForSupport = vi.fn();
vi.mock('@/lib/current-user', () => ({ readIdentityForSupport }));

const readOwnBookingForSupport = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/customer-data', () => ({ readOwnBookingForSupport }));
vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));

const { default: SupportPage } = await import('./page');

const VALID = {
  digest: 'err_9f4c2a71b3',
  from: '/bookings/abc/checkout',
  at: '2026-06-12T14:41:00.000Z',
};

/** Renders the route with the given query, signed out unless told otherwise. */
async function renderPage(
  params: Record<string, string | string[] | undefined>,
  user: { email: string; role?: string } | null = null,
): Promise<void> {
  readIdentityForSupport.mockResolvedValue(user);
  render(await SupportPage({ searchParams: Promise.resolve(params) }));
}

describe('/support', () => {
  afterEach(() => {
    cleanup();
    readIdentityForSupport.mockReset();
  });

  it('renders for a signed-out visitor arriving with no query at all', async () => {
    await renderPage({});

    expect(screen.getByRole('heading', { name: 'Tell us what happened' })).toBeDefined();
    expect(screen.getByLabelText('Your email')).toBeDefined();
    expect(screen.queryByText('Attached automatically')).toBeNull();
  });

  it('names the account address for a signed-in visitor', async () => {
    await renderPage({}, { email: 'ana@nandakumar.co' });

    expect(screen.queryByLabelText('Your email')).toBeNull();
    expect(screen.getByText(/the email on your account/).textContent).toContain(
      'ana@nandakumar.co',
    );
  });

  it('attaches the reference when the whole context parses', async () => {
    await renderPage(VALID);

    expect(screen.getByText('Attached automatically')).toBeDefined();
    expect(screen.getByText(VALID.digest)).toBeDefined();
  });

  /*
   * `web-route-boundaries.md`: `searchParams` is attacker-controlled, and this
   * screen quotes what it is given back into an email. So each hostile shape is
   * driven rather than reasoned about — the rule's own regression test asks for
   * the *outcome*, not the parse.
   *
   * The block is dropped **whole** rather than per field: a reference with a
   * plausible digest and a junk route reaches the support inbox looking like a
   * server-log entry, and half of it is a lie.
   */
  const HOSTILE: [string, Record<string, string | string[] | undefined>][] = [
    ['an absolute URL as the route', { ...VALID, from: 'https://evil.example.com/pay' }],
    // A protocol-relative URL clears a naive `^/` and is a real address.
    ['a protocol-relative route', { ...VALID, from: '//evil.example.com' }],
    // Every browser normalises the backslash to a slash, so it is the same.
    ['a backslash-relative route', { ...VALID, from: String.raw`/\evil.example.com` }],
    ['a route that is not a path at all', { ...VALID, from: 'javascript:alert(1)' }],
    ['a digest carrying markup', { ...VALID, digest: '<script>alert(1)</script>' }],
    ['a digest 400 characters long', { ...VALID, digest: 'a'.repeat(400) }],
    ['a timestamp that is not a date', { ...VALID, at: 'not-a-date' }],
    ['a timestamp that cannot exist', { ...VALID, at: '2026-13-45T99:99:99Z' }],
    ['a repeated parameter, which arrives as an array', { ...VALID, digest: ['a', 'b'] }],
    ['a digest with no route or moment', { digest: VALID.digest }],
    ['every value empty', { digest: '', from: '', at: '' }],
  ];

  it.each(HOSTILE)('renders the screen with no reference for %s', async (_name, params) => {
    await renderPage(params);

    // The page renders — it does not throw into the error boundary, which is
    // what a `new Date()` or an `Intl` formatter on an unvalidated value does.
    expect(screen.getByRole('heading', { name: 'Tell us what happened' })).toBeDefined();
    expect(screen.queryByText('Attached automatically')).toBeNull();
  });

  // --- The booking a `Report a problem` names (#425) -------------------------

  describe('a booking report', () => {
    const BOOKING_ID = '9c3c2a51-1f0e-4b6a-8f2d-6c1b0a4e7d55';
    const BOOKING = {
      id: BOOKING_ID,
      status: 'confirmed',
      eventDate: '2026-06-15',
      totalAmountCents: 145_000,
      eventLocation: 'Barr Mansion',
      payoutReleasedAt: null,
    };
    /** Inside the window: the event has happened, the payout has not moved. */
    const INSIDE = new Date('2026-06-16T12:00:00Z');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(INSIDE);
      readOwnBookingForSupport.mockResolvedValue(BOOKING);
    });

    afterEach(() => {
      vi.useRealTimers();
      readOwnBookingForSupport.mockReset();
    });

    it('attaches the booking for the customer who owns it', async () => {
      await renderPage({ booking: BOOKING_ID }, { email: 'ana@nandakumar.co', role: 'customer' });

      expect(readOwnBookingForSupport).toHaveBeenCalledWith(BOOKING_ID);
      expect(screen.getByText('Attached automatically')).toBeDefined();
      expect(screen.getByText(BOOKING_ID)).toBeDefined();
      expect(screen.getByText(/Jun 15, 2026 · \$1,450 · Barr Mansion/)).toBeDefined();
    });

    /**
     * Acceptance 6. The API refuses a vendor too, but a public page has no
     * business making an authenticated read for somebody who cannot use the
     * answer — so the role decides first and nothing is fetched at all.
     */
    it.each([
      ['the vendor on the booking', { email: 'grace@example.com', role: 'vendor' }],
      ['an admin', { email: 'ada@example.com', role: 'admin' }],
      ['a signed-out visitor', null],
    ])('attaches nothing for %s, and reads nothing', async (_who, user) => {
      await renderPage({ booking: BOOKING_ID }, user);

      expect(screen.getByRole('heading', { name: 'Tell us what happened' })).toBeDefined();
      expect(screen.queryByText('Attached automatically')).toBeNull();
      expect(readOwnBookingForSupport).not.toHaveBeenCalled();
    });

    /* Another customer's booking answers 404, which arrives here as `null`. */
    it('attaches nothing for a booking another customer owns', async () => {
      readOwnBookingForSupport.mockResolvedValue(null);

      await renderPage({ booking: BOOKING_ID }, { email: 'ana@nandakumar.co', role: 'customer' });

      expect(screen.queryByText('Attached automatically')).toBeNull();
    });

    /*
     * `searchParams` is attacker-controlled here as much as the error context
     * is, so a junk id is driven rather than reasoned about: the page renders,
     * it does not throw, it attaches nothing, and it makes no read at all.
     */
    it.each([
      ['an id that is not a uuid', 'not-a-uuid'],
      ['an id carrying markup', '<script>alert(1)</script>'],
      ['a repeated parameter, which arrives as an array', ['a', 'b']],
      ['an empty value', ''],
    ])('renders the screen with nothing attached for %s', async (_name, booking) => {
      await renderPage({ booking }, { email: 'ana@nandakumar.co', role: 'customer' });

      expect(screen.getByRole('heading', { name: 'Tell us what happened' })).toBeDefined();
      expect(screen.queryByText('Attached automatically')).toBeNull();
      expect(readOwnBookingForSupport).not.toHaveBeenCalled();
    });

    /* Outside the window the API refuses the hold, so nothing is offered. */
    it.each([
      ['a report is already open', { ...BOOKING, status: 'disputed' }],
      ['the booking was cancelled', { ...BOOKING, status: 'cancelled' }],
      ['the payout has already gone out', { ...BOOKING, payoutReleasedAt: INSIDE }],
      ['the event has not happened yet', { ...BOOKING, eventDate: '2026-12-01' }],
    ])('attaches nothing when %s', async (_name, booking) => {
      readOwnBookingForSupport.mockResolvedValue(booking);

      await renderPage({ booking: BOOKING_ID }, { email: 'ana@nandakumar.co', role: 'customer' });

      expect(screen.queryByText('Attached automatically')).toBeNull();
    });
  });
});
