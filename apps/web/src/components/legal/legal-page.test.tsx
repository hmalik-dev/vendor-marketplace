import { render, screen, within } from '@testing-library/react';
import { LEGAL_PATHS } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { legalDocument } from '@/lib/legal-content';
import { LegalPage } from './legal-page';

describe('the legal reading layout', () => {
  it('draws the title, the micro-label and the required last-updated line', () => {
    render(<LegalPage document={legalDocument('terms')} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Terms of Service');
    expect(screen.getByText('Legal')).toBeTruthy();
    expect(screen.getByText('4 June 2026')).toBeTruthy();
  });

  it('renders the frontmatter note after the date, when there is one', () => {
    render(<LegalPage document={legalDocument('terms')} />);

    expect(screen.getByText('Effective for bookings made on or after that date')).toBeTruthy();
  });

  it('numbers every section heading and anchors it on its slug', () => {
    render(<LegalPage document={legalDocument('terms')} />);

    const cancellations = screen.getByRole('heading', {
      level: 2,
      name: /Cancellations and refunds/,
    });

    expect(cancellations.id).toBe('cancellations-and-refunds');
    expect(cancellations.textContent?.startsWith('5')).toBe(true);
  });

  /** Acceptance 2, both halves — the rail is on the long pages and off the short one. */
  it('draws the jump rail on terms and on privacy', () => {
    for (const slug of ['terms', 'privacy'] as const) {
      const { unmount } = render(<LegalPage document={legalDocument(slug)} />);
      const rail = screen.getByRole('navigation', { name: 'On this page' });

      expect(within(rail).getAllByRole('link').length).toBe(legalDocument(slug).sections.length);
      unmount();
    }
  });

  it('draws no jump rail on the cookie notice, and re-centres its measure', () => {
    render(<LegalPage document={legalDocument('cookies')} />);

    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull();
    expect(screen.queryByText('On this page')).toBeNull();
  });

  it('points every rail row at its own heading anchor', () => {
    render(<LegalPage document={legalDocument('terms')} />);
    const rail = screen.getByRole('navigation', { name: 'On this page' });

    expect(
      within(rail)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(legalDocument('terms').sections.map((section) => `#${section.id}`));
  });

  it('links section 3 to the privacy policy at the path the footer uses', () => {
    render(<LegalPage document={legalDocument('terms')} />);

    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(
      LEGAL_PATHS.privacy,
    );
  });

  it('draws the privacy data map as a table over the real stack', () => {
    render(<LegalPage document={legalDocument('privacy')} />);

    expect(screen.getByText('Cloudflare R2')).toBeTruthy();
    expect(screen.getAllByText('Stripe').length).toBe(2);
  });

  it('names only the Clerk session cookie, and no consent control', () => {
    render(<LegalPage document={legalDocument('cookies')} />);

    expect(screen.getByText('__session')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
