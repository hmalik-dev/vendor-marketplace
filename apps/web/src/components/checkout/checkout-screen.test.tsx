import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutScreen } from './checkout-screen';
import type { WireCheckoutIntent } from '@/lib/wire-schemas';

const confirmPayment = vi.fn();
const pushMock = vi.fn();

/*
 * Stripe's own components are stubbed, not its behaviour. `PaymentElement`
 * renders an iframe this environment has no way to fill, and the thing under
 * test is what the screen does with the answers `confirmPayment` gives — the
 * declined branch above all, which is the highest-stakes error in the product.
 */
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment }),
  useElements: () => ({}),
}));

vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve(null) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

function checkout(overrides: Partial<WireCheckoutIntent> = {}): WireCheckoutIntent {
  return {
    paymentIntentId: 'pi_test_1',
    clientSecret: 'pi_test_1_secret_test',
    status: 'requires_payment_method',
    amountCents: 145_000,
    customerFeeCents: 0,
    eventDate: '2027-06-14',
    eventLocation: 'Barr Mansion',
    guestCount: 120,
    vendor: { slug: 'kessler-co', businessName: 'Kessler & Co.', avatarUrl: null },
    acceptedAt: new Date('2027-05-02T12:00:00Z'),
    ...overrides,
  } as WireCheckoutIntent;
}

beforeEach(() => {
  confirmPayment.mockReset();
  confirmPayment.mockResolvedValue({});
  pushMock.mockReset();
});

afterEach(cleanup);

describe('CheckoutScreen', () => {
  it('names who accepted, when, and what paying secures', () => {
    render(<CheckoutScreen checkout={checkout()} requestId="req-1" />);

    expect(screen.getByRole('heading', { name: 'Confirm and pay' })).toBeDefined();
    expect(
      screen.getByText(
        'Kessler & Co. accepted your request on May 2. Paying now locks June 14 in their calendar.',
      ),
    ).toBeDefined();
  });

  /*
   * The rail states the fee as **None** rather than omitting the line. An
   * absent line is indistinguishable from a hidden one; the word is the trust
   * signal, and it is rendered from a real zero rather than hard-coded.
   */
  it('states the fee rather than omitting it, and totals what is actually charged', () => {
    render(<CheckoutScreen checkout={checkout()} requestId="req-1" />);

    expect(screen.getByText('Service fee')).toBeDefined();
    expect(screen.getByText('None')).toBeDefined();
    expect(screen.getByText('Total today')).toBeDefined();
    expect(screen.getAllByText('$1,450')).toHaveLength(2);
  });

  it('names the amount and the outcome on the button, never a bare Pay', () => {
    render(<CheckoutScreen checkout={checkout()} requestId="req-1" />);

    const pay = screen.getByRole('button');
    expect(pay.textContent).toBe('Pay $1,450 — confirm June 14');
    expect(pay.textContent).not.toBe('Pay');
  });

  it('answers the cancellation objection in sentences, not a policy link', () => {
    render(<CheckoutScreen checkout={checkout()} requestId="req-1" />);

    expect(screen.getByRole('heading', { name: 'If plans change' })).toBeDefined();
    expect(
      screen.getByText(
        /Cancel more than 48 hours before June 14 and you're refunded in full\. Inside 48 hours, half is refunded/,
      ),
    ).toBeDefined();
  });

  it('goes to the confirmation once the charge clears', async () => {
    render(<CheckoutScreen checkout={checkout()} requestId="req-1" />);

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/bookings/req-1/confirmed');
    });
  });

  /*
   * Frame `21` and `40-states.md` §1. The four questions have to be answered
   * explicitly, and the money one comes first — a generic "Payment failed"
   * here loses the booking.
   */
  describe('when the card is declined', () => {
    beforeEach(() => {
      confirmPayment.mockResolvedValue({
        error: {
          message: 'Your bank refused the payment without giving a reason.',
          decline_code: 'card_declined',
        },
      });
    });

    it('says the money position before anything else, and holds the date', async () => {
      render(<CheckoutScreen checkout={checkout()} requestId="req-1" />);

      await userEvent.click(screen.getByRole('button', { name: /^Pay/ }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain("Your card was declined — you haven't been charged");
      expect(alert.textContent).toContain('June 14 stays held for you for 24 hours.');
      expect(alert.textContent).toContain('Try the same card again, use another card');
      // It stayed on the screen; a declined charge navigates nowhere.
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('renders the code inline under the field rather than as a toast', async () => {
      render(<CheckoutScreen checkout={checkout()} requestId="req-1" />);

      await userEvent.click(screen.getByRole('button', { name: /^Pay/ }));

      expect(await screen.findByText(/Declined by your bank · code/)).toBeDefined();
      expect(screen.getByText('card_declined')).toBeDefined();
    });

    it('offers the retry as the button rather than a second control', async () => {
      render(<CheckoutScreen checkout={checkout()} requestId="req-1" />);

      await userEvent.click(screen.getByRole('button', { name: /^Pay/ }));

      expect(
        await screen.findByRole('button', { name: 'Try this payment again — confirm June 14' }),
      ).toBeDefined();
    });

    /*
     * The no-third-attempt guidance, which is the one piece of advice on this
     * screen the customer cannot work out for themselves: repeated attempts can
     * extend the bank's hold.
     */
    it('warns against a third attempt only after the second failure', async () => {
      render(<CheckoutScreen checkout={checkout()} requestId="req-1" />);

      await userEvent.click(screen.getByRole('button', { name: /^Pay/ }));
      expect(screen.queryByText(/don't try a third time/)).toBeNull();

      await userEvent.click(screen.getByRole('button', { name: /^Try this payment again/ }));

      expect(await screen.findByText(/don't try a third time/)).toBeDefined();
    });
  });
});
