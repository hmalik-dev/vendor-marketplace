import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CURRENT_VENDOR_AGREEMENT_VERSION,
  DEFAULT_PLATFORM_FEE_RATE,
  PAYOUT_RELEASE_HOURS,
  type VendorAgreementStatus,
} from '@vendor-marketplace/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vendorAgreementDocument } from '@/lib/legal-content';
import { VendorAgreementScreen } from './vendor-agreement-screen';

const post = vi.fn();
const refresh = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => post }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const AGREEMENT = vendorAgreementDocument();

function status(overrides: Partial<VendorAgreementStatus> = {}): VendorAgreementStatus {
  return {
    current: CURRENT_VENDOR_AGREEMENT_VERSION,
    businessName: 'June Harlow Photography',
    accepted: null,
    isCurrent: false,
    history: [],
    ...overrides,
  };
}

const ACCEPTED = {
  document: 'vendor_agreement' as const,
  version: CURRENT_VENDOR_AGREEMENT_VERSION,
  acceptedAt: new Date('2026-06-08T19:14:00Z'),
  acceptedByName: 'June Harlow',
  businessName: 'June Harlow Photography',
};

beforeEach(() => {
  post.mockReset();
  refresh.mockReset();
});

afterEach(cleanup);

describe('the unaccepted step', () => {
  /** Acceptance 7: the rail says where in onboarding this sits, and it is 3 of 5. */
  it('renders the step rail at step 3 of 5, before payouts', () => {
    render(<VendorAgreementScreen status={status()} agreement={AGREEMENT} payoutsLive={false} />);

    const rail = screen.getByRole('navigation', { name: 'Vendor onboarding' });

    expect(screen.getByText('Step 3 of 5')).toBeDefined();

    const steps = within(rail)
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(steps[2]).toContain('Vendor agreement');
    expect(steps[3]).toContain('Payouts');
  });

  /**
   * The four terms take their figures from the constants, never from prose
   * written beside them — the whole point of `vendorAgreementTerms`.
   */
  it('states the commission and the payout interval from the constants', () => {
    render(<VendorAgreementScreen status={status()} agreement={AGREEMENT} payoutsLive={false} />);

    expect(screen.getByText('The four terms that cost you money')).toBeDefined();
    expect(screen.getAllByText(`${DEFAULT_PLATFORM_FEE_RATE * 100}%`).length).toBeGreaterThan(0);
    expect(screen.getByText(`Event + ${PAYOUT_RELEASE_HOURS}h`)).toBeDefined();
    expect(
      screen.getByText(new RegExp(`Released ${PAYOUT_RELEASE_HOURS} hours after the event date`)),
    ).toBeDefined();
  });

  /** Cut, not reworded: nothing here describes an enforcement process. */
  it('makes no threat about repeated cancellations', () => {
    const { container } = render(
      <VendorAgreementScreen status={status()} agreement={AGREEMENT} payoutsLive={false} />,
    );

    expect(container.textContent?.toLowerCase()).not.toContain('end your listing');
  });

  /** Acceptance 8, both halves. */
  it('names the business on the checkbox label', () => {
    render(<VendorAgreementScreen status={status()} agreement={AGREEMENT} payoutsLive={false} />);

    expect(screen.getByLabelText(/I accept it on behalf of June Harlow Photography/)).toBeDefined();
  });

  it('disables Accept and continue until the box is ticked', async () => {
    render(<VendorAgreementScreen status={status()} agreement={AGREEMENT} payoutsLive={false} />);

    const accept = screen.getByRole('button', { name: 'Accept and continue' });
    expect(accept).toHaveProperty('disabled', true);

    await userEvent.click(screen.getByRole('checkbox'));

    expect(accept).toHaveProperty('disabled', false);
  });

  /** Expand in place — no modal, no navigation, onboarding state survives. */
  it('expands the full agreement in place rather than navigating', async () => {
    render(<VendorAgreementScreen status={status()} agreement={AGREEMENT} payoutsLive={false} />);

    const expand = screen.getByRole('button', {
      name: `Read all ${AGREEMENT.sections.length} sections`,
    });
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', { name: /agreement/i })).toBeNull();

    await userEvent.click(expand);

    expect(
      screen.getByRole('button', { name: 'Collapse the agreement' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('posts the version it displayed, and refreshes the shell that carries the blocker', async () => {
    post.mockResolvedValue(status({ accepted: ACCEPTED, isCurrent: true, history: [ACCEPTED] }));
    render(<VendorAgreementScreen status={status()} agreement={AGREEMENT} payoutsLive={false} />);

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Accept and continue' }));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/vendor/agreement/accept',
        expect.objectContaining({ body: { version: CURRENT_VENDOR_AGREEMENT_VERSION } }),
      );
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('swaps to the record once the acceptance is stored', async () => {
    post.mockResolvedValue(status({ accepted: ACCEPTED, isCurrent: true, history: [ACCEPTED] }));
    render(<VendorAgreementScreen status={status()} agreement={AGREEMENT} payoutsLive={false} />);

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Accept and continue' }));

    await waitFor(() => {
      expect(
        screen.getByText(`Vendor agreement ${CURRENT_VENDOR_AGREEMENT_VERSION} — accepted`),
      ).toBeDefined();
    });
  });

  it('says nothing was recorded when the call fails, and offers the same control', async () => {
    post.mockRejectedValue(new Error('nope'));
    render(<VendorAgreementScreen status={status()} agreement={AGREEMENT} payoutsLive={false} />);

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Accept and continue' }));

    await waitFor(() => {
      expect(screen.getByText('That did not save')).toBeDefined();
    });
    expect(screen.getByRole('button', { name: 'Accept and continue' })).toBeDefined();
  });

  /** Acceptance 11's other half: a version behind re-opens this step, saying why. */
  it('explains a revision without implying the earlier acceptance is gone', () => {
    const behind = { ...ACCEPTED, version: 'v0.9' };

    render(
      <VendorAgreementScreen
        status={status({ accepted: behind, isCurrent: false, history: [behind] })}
        agreement={AGREEMENT}
        payoutsLive
      />,
    );

    expect(screen.getByText(`${CURRENT_VENDOR_AGREEMENT_VERSION} replaces v0.9`)).toBeDefined();
    expect(screen.getByText(/stands on your record/)).toBeDefined();
  });
});

describe('the accepted record', () => {
  it('names the person, the version and the moment, rather than a banner', () => {
    render(
      <VendorAgreementScreen
        status={status({ accepted: ACCEPTED, isCurrent: true, history: [ACCEPTED] })}
        agreement={AGREEMENT}
        payoutsLive
      />,
    );

    expect(
      screen.getByText(`Vendor agreement ${CURRENT_VENDOR_AGREEMENT_VERSION} — accepted`),
    ).toBeDefined();
    expect(screen.getByText(/by June Harlow, for June Harlow Photography/)).toBeDefined();
  });

  /** Acceptance 9, on the surface: a new version adds a row, it never replaces one. */
  it('lists every acceptance, newest first', () => {
    const older = { ...ACCEPTED, version: 'v0.9', acceptedAt: new Date('2026-05-01T10:00:00Z') };

    render(
      <VendorAgreementScreen
        status={status({ accepted: ACCEPTED, isCurrent: true, history: [ACCEPTED, older] })}
        agreement={AGREEMENT}
        payoutsLive
      />,
    );

    const rows = screen.getAllByRole('row').slice(1);

    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain(CURRENT_VENDOR_AGREEMENT_VERSION);
    expect(rows[1].textContent).toContain('v0.9');
  });

  /**
   * `PAYOUTS LIVE` is a claim about Stripe, so it reads the payout status. A
   * vendor can hold the agreement and still have no rail.
   */
  it('does not claim payouts are live when Stripe has not verified them', () => {
    render(
      <VendorAgreementScreen
        status={status({ accepted: ACCEPTED, isCurrent: true, history: [ACCEPTED] })}
        agreement={AGREEMENT}
        payoutsLive={false}
      />,
    );

    expect(screen.getByText('Payouts not connected')).toBeDefined();
    expect(screen.queryByText('Payouts live')).toBeNull();
  });
});
