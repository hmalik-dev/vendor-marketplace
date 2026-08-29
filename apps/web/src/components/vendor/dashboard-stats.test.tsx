import { cleanup, render } from '@testing-library/react';
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
});
