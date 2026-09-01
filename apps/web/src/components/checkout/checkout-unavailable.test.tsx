import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CheckoutUnavailable } from './checkout-unavailable';

const REQUEST_ID = '1af86d43-0000-4000-8000-000000000000';

describe('CheckoutUnavailable', () => {
  afterEach(() => {
    cleanup();
  });

  /*
   * #387: this screen replaces a `notFound()` that told the customer their link
   * was old and the vendor may have gone. The money position is the thing a
   * failed checkout has to say and the 404 shell could not — `40-states.md` §1
   * question 2.
   */
  it('states the money position and that the date survives a failure', () => {
    render(<CheckoutUnavailable reason="failed" requestId={REQUEST_ID} vendorName={null} />);

    const banner = screen.getByRole('status');

    expect(banner.textContent).toBe('No payment was taken, and your date is still held.');
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
    expect(screen.getByRole('status').textContent).toBe('No payment was taken.');
    expect(screen.queryByRole('link', { name: 'Try this payment again' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to this booking' }).getAttribute('href')).toBe(
      `/bookings/${REQUEST_ID}`,
    );
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
});
