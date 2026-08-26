import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DashboardShell } from './dashboard-shell';

const SECTIONS = [
  { title: 'Availability', description: 'Block the dates you are away.', arrivesIn: 'Ticket #5' },
  { title: 'Getting paid', description: 'Connect a Stripe account.', arrivesIn: 'Ticket #9' },
] as const;

describe('DashboardShell', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the heading as the page-level heading', () => {
    render(
      <DashboardShell
        eyebrow="Vendor"
        heading="Welcome back, Grace"
        description="Set up your business here."
        sections={SECTIONS}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back, Grace' })).toBeDefined();
  });

  it('renders one sub-heading per section', () => {
    render(
      <DashboardShell
        eyebrow="Vendor"
        heading="Welcome back, Grace"
        description="Set up your business here."
        sections={SECTIONS}
      />,
    );

    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 2, name: 'Availability' })).toBeDefined();
    expect(screen.getByText('Ticket #9')).toBeDefined();
  });

  it('renders children above the section grid', () => {
    render(
      <DashboardShell
        eyebrow="Customer"
        heading="Welcome back, Ada"
        description="Your events live here."
        sections={SECTIONS}
      >
        <p>Nothing booked yet.</p>
      </DashboardShell>,
    );

    expect(screen.getByText('Nothing booked yet.')).toBeDefined();
  });

  it('renders without children', () => {
    render(
      <DashboardShell
        eyebrow="Customer"
        heading="Welcome back, Ada"
        description="Your events live here."
        sections={[]}
      />,
    );

    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
  });
});
