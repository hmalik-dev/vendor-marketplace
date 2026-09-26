import type Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { payoutAccountFrom } from './stripe.js';

/** The fields `payoutAccountFrom` reads, on Stripe's real external-account shapes. */
function bank(
  last4: string,
  bankName: string | null,
  defaultForCurrency: boolean,
): Stripe.ExternalAccount {
  return {
    id: `ba_${last4}`,
    object: 'bank_account',
    bank_name: bankName,
    last4,
    default_for_currency: defaultForCurrency,
  } as Stripe.BankAccount;
}

function card(last4: string, brand: string): Stripe.ExternalAccount {
  return {
    id: `card_${last4}`,
    object: 'card',
    brand,
    last4,
    default_for_currency: false,
  } as Stripe.Card;
}

describe('payoutAccountFrom', () => {
  it('names the bank Stripe pays out to by default', () => {
    expect(
      payoutAccountFrom([bank('0001', 'Wells Fargo', false), bank('4821', 'Chase', true)]),
    ).toEqual({ bankName: 'Chase', last4: '4821' });
  });

  it('falls back to the first destination, and names a debit card by its brand', () => {
    expect(payoutAccountFrom([card('4242', 'Visa')])).toEqual({ bankName: 'Visa', last4: '4242' });
  });

  it('keeps the last four when Stripe gives no bank name', () => {
    expect(payoutAccountFrom([bank('6789', null, true)])).toEqual({
      bankName: null,
      last4: '6789',
    });
  });

  it('is null when the account has no payout destination', () => {
    expect(payoutAccountFrom([])).toBeNull();
  });
});
