import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DashboardShell } from './dashboard-shell';

const SECTIONS = [
  {
    title: 'Availability',
    description: 'Block the dates you are away.',
    href: '/vendor/availability',
  },
  {
    title: 'Portfolio',
    description: 'The work that proves you can do it.',
    href: '/vendor/portfolio',
  },
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
  });

  /*
   * The shell used to accept a "ships in" string for a section with nowhere
   * to go, and rendered it where "Open" sits — putting "Ticket #9" on the
   * vendor's own dashboard. Every section is a link now, so there is no state
   * in which an internal identifier can reach a user.
   */
  it('renders every section as a link to its surface', () => {
    render(
      <DashboardShell
        eyebrow="Vendor"
        heading="Welcome back"
        description="Set up your business here."
        sections={SECTIONS}
      />,
    );

    const links = screen.getAllByRole('link');

    expect(links).toHaveLength(2);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/vendor/availability',
      '/vendor/portfolio',
    ]);
    expect(screen.getAllByText('Open')).toHaveLength(2);
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
