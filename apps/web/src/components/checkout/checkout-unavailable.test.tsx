import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CheckoutUnavailable } from './checkout-unavailable';

const REQUEST_ID = '1af86d43-0000-4000-8000-000000000000';

describe('CheckoutUnavailable', () => {
  afterEach(() => {
    cleanup();
  });

  /* VEN-439: the API's 402, which used to render "This page isn't here". */
  it('names the vendor who cannot take payment and says the account is fine', () => {
    render(
      <CheckoutUnavailable
        reason="vendor-unavailable"
        requestId={REQUEST_ID}
        vendorName="Kessler & Co."
      />,
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      "Kessler & Co. can't take payment right now",
    );
    expect(screen.getByText(/nothing is wrong with your account/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Try this payment again' })).toBeDefined();
    expect(screen.queryByText(/isn't here/)).toBeNull();
  });

  /* VEN-555: a banned or retired vendor, where no retry can ever succeed. */
  it('tells a customer a banned or retired vendor is closed, with no retry', () => {
    const { container } = render(
      <CheckoutUnavailable
        reason="vendor-closed"
        requestId={REQUEST_ID}
        vendorName="Kessler & Co."
      />,
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Kessler & Co. is no longer taking bookings',
    );
    expect(container.textContent).not.toMatch(/temporary/i);
    expect(container.textContent).not.toMatch(/still accepted/i);
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([`/bookings/${REQUEST_ID}`, '/search']);
    expect(hrefs.some((href) => href?.endsWith('/checkout'))).toBe(false);
    expect(screen.getByRole('link', { name: 'Back to this booking' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Browse vendors' })).toBeDefined();
  });

  /* VEN-559: unpublished or on a hold, which is reversible and says so. */
  it('tells a customer a paused vendor is temporary, names the deadline, and offers a retry', () => {
    render(
      <CheckoutUnavailable
        reason="vendor-paused"
        requestId={REQUEST_ID}
        vendorName="Kessler & Co."
        deadline="expires in 3d"
      />,
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      "Kessler & Co. isn't taking bookings right now",
    );
    expect(screen.getByText(/This is temporary/)).toBeDefined();
    expect(screen.getByText(/Your booking expires in 3d/)).toBeDefined();
    expect(screen.queryByText(/no longer taking bookings/)).toBeNull();
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([`/bookings/${REQUEST_ID}/checkout`, `/bookings/${REQUEST_ID}`]);
  });

  it('says nothing about a deadline when there is none to name', () => {
    const { container } = render(
      <CheckoutUnavailable
        reason="vendor-paused"
        requestId={REQUEST_ID}
        vendorName="Kessler & Co."
        deadline={null}
      />,
    );

    expect(container.textContent).not.toMatch(/Your booking/);
  });

  /* VEN-404: over the beta cap, where a retry can never succeed. */
  it('sends a customer over the beta cap to support rather than a retry', () => {
    render(<CheckoutUnavailable reason="over-cap" requestId={REQUEST_ID} vendorName={null} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'This booking is over our beta limit',
    );
    expect(screen.getByRole('link', { name: 'Contact support' }).getAttribute('href')).toBe(
      '/support',
    );
    expect(screen.queryByRole('link', { name: 'Try this payment again' })).toBeNull();
  });

  /* VEN-404: the operator paused checkout. The notice, and a retry that works once it lifts. */
  it('tells a customer checkout is paused and that nothing was charged', () => {
    render(<CheckoutUnavailable reason="paused" requestId={REQUEST_ID} vendorName={null} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Payments are paused for a moment',
    );
    expect(
      screen.getByText('Bookings are paused for a short while. Nothing has been charged.'),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Try this payment again' }).getAttribute('href')).toBe(
      `/bookings/${REQUEST_ID}/checkout`,
    );
  });

  /*
   * #387: this screen replaces a `notFound()` that told the customer their link
   * was old and the vendor may have gone. The money position is the thing a
   * failed checkout has to say and the 404 shell could not — `40-states.md` §1
   * question 2.
   *
   * It states the money and stops there. It used to add "and your date is still
   * held", which `unavailableScreen` has no way of knowing: it returns `failed`
   * without reading the request, and #400 made a cancelled booking reach this
   * screen.
   */
  it('states the money position without claiming a date it cannot know is held', () => {
    render(<CheckoutUnavailable reason="failed" requestId={REQUEST_ID} vendorName={null} />);

    const banner = screen.getByRole('status');

    expect(banner.textContent).toBe('No payment was taken and no booking was changed.');
    expect(banner.textContent).not.toContain('still held');
    // Settled, not failed: sage is the colour of a resolved money position.
    expect(banner.getAttribute('data-status')).toBe('settled');
  });

  it('names what happened rather than claiming the page is missing', () => {
    render(<CheckoutUnavailable reason="failed" requestId={REQUEST_ID} vendorName={null} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      "We couldn't start this payment",
    );
  });

  /*
   * "Retry" alone is not an action — `40-states.md` §1 question 4. The retry is
   * the same URL, because the intent is opened during the server render.
   */
  it('offers the retry as a link back into checkout', () => {
    render(<CheckoutUnavailable reason="failed" requestId={REQUEST_ID} vendorName={null} />);

    expect(screen.getByRole('link', { name: 'Try this payment again' }).getAttribute('href')).toBe(
      `/bookings/${REQUEST_ID}/checkout`,
    );
  });

  /*
   * The other half of question 3: a booking that left `accepted` is not holding
   * the date any more, and offering a retry on it would be a lie.
   */
  it('tells a closed booking the date is gone, and does not offer a retry', () => {
    render(<CheckoutUnavailable reason="closed" requestId={REQUEST_ID} vendorName="June Harlow" />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      "This booking isn't open any more",
    );
    expect(screen.getByRole('status').textContent).toBe('Nothing is owed on this booking.');
    expect(screen.queryByRole('link', { name: 'Try this payment again' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to this booking' }).getAttribute('href')).toBe(
      `/bookings/${REQUEST_ID}`,
    );
  });

  /*
   * #400 made two of these three reasons reachable by a customer who *had*
   * paid: cancelling now settles the parent request, so a refunded booking
   * lands on `closed` instead of redirecting to the confirmation, and a stalled
   * POST on the same request lands on `failed`.
   *
   * Asserted across all three at once, which is what gives it a failure mode of
   * its own. Pinning the negative inside each reason's own test would be
   * redundant — those tests already fix the exact string, so they redden first —
   * and this defect returns precisely by someone updating one of those strings
   * to match new copy. `not-accepted` is the control: it keeps the sentence,
   * because payment needs `accepted` and nothing returns a request to
   * `pending`/`quoted`, so there it is still true.
   */
  it('only claims no payment was taken where a payment could not have happened', () => {
    const bannerFor = (reason: 'failed' | 'not-accepted' | 'closed'): string => {
      cleanup();
      render(<CheckoutUnavailable reason={reason} requestId={REQUEST_ID} vendorName="June H." />);
      return screen.getByRole('status').textContent ?? '';
    };

    expect(bannerFor('not-accepted')).toContain('No payment was taken');
    expect(bannerFor('failed')).toContain('No payment was taken');
    expect(bannerFor('closed')).not.toContain('No payment was taken');
  });

  /*
   * The API answers one 409 for a request that has not been accepted *and* for
   * one that is over. Rendering the closed copy for the first would tell a
   * customer whose request is still live that it was cancelled — the same
   * defect as the 404 this screen replaced, one bucket over.
   */
  it('does not tell a customer whose request is still open that it was cancelled', () => {
    render(
      <CheckoutUnavailable reason="not-accepted" requestId={REQUEST_ID} vendorName="June Harlow" />,
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      "This request hasn't been accepted yet",
    );
    const body = screen.getByText(/June Harlow/);
    expect(body.textContent).toContain("hasn't accepted your request");
    expect(body.textContent).not.toContain('cancelled');
    expect(screen.getByRole('status').textContent).toBe(
      'No payment was taken, and your request is still open with them.',
    );
    expect(screen.queryByRole('link', { name: 'Try this payment again' })).toBeNull();
  });

  /** The vendor read can fail; the copy still has to be a sentence. */
  it('falls back to a neutral subject when the vendor is unknown', () => {
    render(<CheckoutUnavailable reason="not-accepted" requestId={REQUEST_ID} vendorName={null} />);

    expect(screen.getByText(/This vendor/).textContent).toContain("hasn't accepted your request");
  });

  /*
   * Frame `16`'s composition: 38px headline (`text-display-error`) and a 14px
   * body at 1.65 (`text-cta`). They read 34 and 12.5 (VEN-452). Class-level
   * check; jsdom has no layout.
   */
  it('sets the headline and body at frame 16 sizes', () => {
    render(<CheckoutUnavailable reason="failed" requestId={REQUEST_ID} vendorName={null} />);

    const h1 = screen.getByRole('heading', { level: 1 }).className.split(/\s+/);
    const body = screen.getByText(/Something on our side/).className.split(/\s+/);

    expect(h1).toContain('text-display-error');
    expect(h1).not.toContain('text-display-lg');
    expect(body).toContain('text-cta');
    expect(body).not.toContain('text-sm');
  });
});
