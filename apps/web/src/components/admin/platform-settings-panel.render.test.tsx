import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminPlatformSettings } from '@/lib/wire-schemas';

const calls: { path: string; method?: string; body?: unknown }[] = [];

vi.mock('@/lib/use-api', () => ({
  useApi: () => async (path: string, options: { method?: string; body?: unknown }) => {
    calls.push({ path, method: options.method, body: options.body });
    return {};
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { PlatformSettingsPanel } = await import('./platform-settings-panel');

const SETTINGS: WireAdminPlatformSettings = {
  bookingRequestsPaused: false,
  checkoutPaused: true,
  payoutReleasePaused: false,
  maxBookingCents: 50_000,
  vendorInviteOnly: false,
  updatedAt: new Date('2026-09-14T09:05:00.000Z'),
  updatedByName: 'Ada Lovelace',
  heldVendors: [
    { id: '11111111-1111-4111-8111-111111111111', businessName: 'Sunlit Studio', slug: 'sunlit' },
  ],
};

afterEach(() => {
  cleanup();
  calls.length = 0;
});

describe('PlatformSettingsPanel', () => {
  it('shows each switch as it stands, the cap, and who changed it last', () => {
    render(<PlatformSettingsPanel settings={SETTINGS} />);

    expect(
      screen.getByRole('switch', { name: 'Pause checkout' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen
        .getByRole('switch', { name: 'Pause new booking requests' })
        .getAttribute('aria-checked'),
    ).toBe('false');
    expect(
      screen.getByText(/Last changed by Ada Lovelace, Sep 14, 2026, 09:05 UTC\./),
    ).toBeDefined();
    expect((screen.getByLabelText('Cap in US dollars') as HTMLInputElement).value).toBe('500');
    expect(screen.getByText('Sunlit Studio')).toBeDefined();
  });

  it('sends only the switch that was flipped', async () => {
    render(<PlatformSettingsPanel settings={SETTINGS} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'Pause automatic payouts' }));
    });

    expect(calls).toEqual([
      { path: '/admin/settings', method: 'PUT', body: { payoutReleasePaused: true } },
    ]);
  });

  it('turns the vendor gate on from its own switch (VEN-406)', async () => {
    render(<PlatformSettingsPanel settings={SETTINGS} />);

    const gate = screen.getByRole('switch', { name: 'Vendors join by invitation only' });
    expect(gate.getAttribute('aria-checked')).toBe('false');
    await act(async () => {
      fireEvent.click(gate);
    });

    expect(calls).toEqual([
      { path: '/admin/settings', method: 'PUT', body: { vendorInviteOnly: true } },
    ]);
    expect(
      screen.getByRole('link', { name: 'Applications and invites' }).getAttribute('href'),
    ).toBe('/admin/vendor-applications');
  });

  it('saves the cap in cents and releases a held vendor by id', async () => {
    render(<PlatformSettingsPanel settings={SETTINGS} />);

    fireEvent.change(screen.getByLabelText('Cap in US dollars'), { target: { value: '750.25' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save cap' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Release hold' }));
    });

    expect(calls).toEqual([
      { path: '/admin/settings', method: 'PUT', body: { maxBookingCents: 75_025 } },
      {
        path: '/admin/vendors/11111111-1111-4111-8111-111111111111/payout-hold',
        method: 'PUT',
        body: { payoutHold: false },
      },
    ]);
  });
});
