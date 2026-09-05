import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const { SuspensionConsequence } = await import('./vendor-table');

afterEach(cleanup);

describe('SuspensionConsequence', () => {
  /*
   * #416 / D31. A suspension refunds every future confirmed booking, and that
   * refund reverses the vendor's transfer back out of their connected account
   * — which can take a vendor already paid out negative. The operator is the
   * only party who can weigh that before pressing the button, so the dialog
   * describing the action has to name it rather than stop at "refunded in
   * full".
   */
  it('names the payout reversal, not only the refund', () => {
    render(<SuspensionConsequence subject="Their storefront" />);

    expect(screen.getByText(/refunded in full/)).toBeDefined();
    expect(
      screen.getByText(
        /reverses the vendor’s share out of their Stripe balance and can leave it negative/,
      ),
    ).toBeDefined();
  });

  /** One dialog is about several accounts, the other about one. */
  it('takes its subject from the caller', () => {
    render(<SuspensionConsequence subject="Every storefront" />);

    expect(screen.getByText(/Every storefront comes down\./)).toBeDefined();
  });
});
