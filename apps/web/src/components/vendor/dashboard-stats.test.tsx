import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { WireVendorDashboard } from '@/lib/wire-schemas';
import { DashboardStats } from './dashboard-stats';

afterEach(cleanup);

function dashboard(overrides: Partial<WireVendorDashboard> = {}): WireVendorDashboard {
  return {
    isPublished: true,
    publishBlockers: [],
    bookingsThisMonth: 7,
    bookingsLastMonth: 5,
    responseRate: 0.96,
    avgRating: 4.9,
    reviewCount: 127,
    earningsThisMonthCents: 894000,
    todaysBookings: [],
    ...overrides,
  } as WireVendorDashboard;
}

describe('DashboardStats', () => {
  it('draws the stat cards at the frame’s 12px radius, not `rounded-xl`', () => {
    const { container } = render(<DashboardStats dashboard={dashboard()} today="2026-08-29" />);

    const cards = container.querySelectorAll('li');
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(card.className).toContain('rounded-[12px]');
      expect(card.className).not.toContain('rounded-xl');
    }
  });

  it('draws the delta line at the frame’s 11.5px, not the 11px `text-xs` step', () => {
    const { container } = render(<DashboardStats dashboard={dashboard()} today="2026-08-29" />);

    const deltas = [...container.querySelectorAll('li')].map((li) => li.querySelectorAll('p')[2]);
    expect(deltas).toHaveLength(4);
    for (const delta of deltas) {
      expect(delta?.className).toContain('text-helper');
      expect(delta?.className).not.toContain('text-xs');
    }
  });

  it('states a delta even when neither month has a booking', () => {
    // The regression: this used to read "None in July" — a statement about
    // last month under a label that says "this month", and the line every new
    // vendor sees. Frame 08 draws a delta in every state.
    render(
      <DashboardStats
        dashboard={dashboard({ bookingsThisMonth: 0, bookingsLastMonth: 0 })}
        today="2026-08-29"
      />,
    );

    expect(screen.getByText('+0 vs July').textContent).toBe('+0 vs July');
    expect(screen.queryByText(/None in/)).toBeNull();
  });

  it('signs the delta and names the previous month', () => {
    const { container } = render(
      <DashboardStats
        dashboard={dashboard({ bookingsThisMonth: 7, bookingsLastMonth: 5 })}
        today="2026-08-29"
      />,
    );

    const delta = container.querySelectorAll('li')[0]?.querySelectorAll('p')[2];
    expect(delta?.textContent).toBe('+2 vs July');
    // Sage is good news, and only good news.
    expect(delta?.className).toContain('text-sage-600');
  });

  it('renders a negative delta muted, not sage', () => {
    const { container } = render(
      <DashboardStats
        dashboard={dashboard({ bookingsThisMonth: 4, bookingsLastMonth: 5 })}
        today="2026-08-29"
      />,
    );

    const delta = container.querySelectorAll('li')[0]?.querySelectorAll('p')[2];
    expect(delta?.textContent).toBe('-1 vs July');
    expect(delta?.className).toContain('text-stone-600');
    expect(delta?.className).not.toContain('text-sage-600');
  });
});
