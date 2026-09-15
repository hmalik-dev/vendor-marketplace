import { render, screen } from '@testing-library/react';
import { legalFactTokens } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import VendorAgreementReadingPage, { metadata } from './page';

describe('the public vendor agreement reading page', () => {
  it('renders the agreement in the legal reading layout', () => {
    render(<VendorAgreementReadingPage />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Vendor agreement');
    expect(screen.getByText('Legal')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Commission/ })).toBeTruthy();
    expect(metadata.alternates?.canonical).toBe('/legal/vendor-agreement');
  });

  /** Reading only: accepting belongs to onboarding step 3 at `/vendor/agreement`. */
  it('offers no accept action', () => {
    render(<VendorAgreementReadingPage />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  /** Acceptance 4: the figures come from `legalFactTokens()`, never typed digits. */
  it('states the figures legalFactTokens resolves', () => {
    const { container } = render(<VendorAgreementReadingPage />);
    const facts = legalFactTokens();
    const text = container.textContent ?? '';

    expect(text).toContain(`retains ${facts.commission} of each booking`);
    expect(text).toContain(`released ${facts.payoutReleaseHours} after the event date`);
    expect(text).toContain(`live for ${facts.requestExpiryDays}`);
    expect(text).not.toContain('{{');
  });
});
