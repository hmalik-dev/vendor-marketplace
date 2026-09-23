import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { WireVendorDashboard } from '@/lib/wire-schemas';
import { PublishChecklist } from './publish-checklist';

afterEach(cleanup);

function dashboard(publishBlockers: WireVendorDashboard['publishBlockers']): WireVendorDashboard {
  return { isPublished: false, publishBlockers } as WireVendorDashboard;
}

/*
 * VEN-509. The agreement is the one row the profile editor cannot clear, so it
 * links to its own screen rather than to the editor's "Finish →".
 */
describe('PublishChecklist', () => {
  it('shows the agreement row with a link to the agreement while it is unaccepted', () => {
    render(<PublishChecklist dashboard={dashboard(['bio', 'agreement'])} />);

    expect(screen.getByText('Accept the vendor agreement')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Accept →' }).getAttribute('href')).toBe(
      '/vendor/agreement',
    );
    // The first open row is still the bio, and it still goes to the editor.
    expect(screen.getByRole('link', { name: 'Finish →' }).getAttribute('href')).toBe(
      '/vendor/profile/edit',
    );
    expect(screen.getByText('6 of 8')).toBeTruthy();
  });

  it('links the agreement row from the first-open position too', () => {
    render(<PublishChecklist dashboard={dashboard(['agreement'])} />);

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Accept →' }).getAttribute('href')).toBe(
      '/vendor/agreement',
    );
    expect(screen.getByText('7 of 8')).toBeTruthy();
  });

  it('drops the link and completes the row once the agreement is accepted', () => {
    render(<PublishChecklist dashboard={dashboard([])} />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('8 of 8')).toBeTruthy();
  });
});
