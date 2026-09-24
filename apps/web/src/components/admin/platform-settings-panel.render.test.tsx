import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminPlatformSettings } from '@/lib/wire-schemas';

const calls: { path: string; method?: string; body?: unknown }[] = [];

vi.mock('@/lib/use-api', () => ({
  useApi: () => async (path: string, options: { method?: string; body?: unknown }) => {
    calls.push({ path, method: options.method, body: options.body });

    // The real API returns the confirmed row from a settings write, and just
    // `{ vendorId, payoutHold }` from a hold write — never the settings prop.
    if (path === '/admin/settings' && options.method === 'PUT') {
      return { ...SETTINGS, ...(options.body as object) };
    }
    if (path.endsWith('/payout-hold')) {
      const [, , , vendorId] = path.split('/');
      return { vendorId, payoutHold: (options.body as { payoutHold: boolean }).payoutHold };
    }
    if (path.startsWith('/admin/vendors?')) {
      return { items: [SEARCH_RESULT], page: 1, pageSize: 5, total: 1 };
    }
    return {};
  },
}));
/*
 * `refresh` is a no-op here on purpose: it never re-renders the component
 * with a new `settings` prop, which is exactly what CI saw a dropped
 * transition do (VEN-576). Every assertion below has to hold with a refresh
 * that never lands.
 */
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { PlatformSettingsPanel } = await import('./platform-settings-panel');

const SETTINGS: WireAdminPlatformSettings = {
  bookingRequestsPaused: false,
  checkoutPaused: true,
  payoutReleasePaused: false,
  maxBookingCents: 50_000,
  vendorInviteOnly: false,
  noticeMessage: null,
  noticeTone: 'info',
  updatedAt: new Date('2026-09-14T09:05:00.000Z'),
  updatedByName: 'Ada Lovelace',
  heldVendors: [
    { id: '11111111-1111-4111-8111-111111111111', businessName: 'Sunlit Studio', slug: 'sunlit' },
  ],
};

const SEARCH_RESULT = {
  id: '22222222-2222-4222-8222-222222222222',
  businessName: 'Garden Co',
  slug: 'garden-co',
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

  it('posts a trimmed notice with its tone and clears it (VEN-616)', async () => {
    render(<PlatformSettingsPanel settings={SETTINGS} />);

    const post = screen.getByRole('button', { name: 'Post notice' }) as HTMLButtonElement;
    expect(post.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Clear notice' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Notice text'), { target: { value: '  <b>x</b>  ' } });
    expect(post.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Notice text'), {
      target: { value: '  Payouts are delayed today.  ' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /Warning/ }));
    await act(async () => {
      fireEvent.click(post);
    });
    expect(calls).toEqual([
      {
        path: '/admin/settings',
        method: 'PUT',
        body: { noticeMessage: 'Payouts are delayed today.', noticeTone: 'warning' },
      },
    ]);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear notice' }));
    });
    expect(calls[1]).toEqual({
      path: '/admin/settings',
      method: 'PUT',
      body: { noticeMessage: null },
    });
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

  /*
   * VEN-576. `refresh` above is a no-op, standing in for a transition CI saw
   * commit server-side and never land in the browser. A test that only
   * checked `calls`, as every test above does, cannot tell that regression
   * from a fix — it has to read the switch itself.
   */
  it('flips the switch from the PUT response, not from a refresh that never lands', async () => {
    render(<PlatformSettingsPanel settings={SETTINGS} />);

    const toggle = screen.getByRole('switch', { name: 'Pause checkout' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('releases a held vendor from the PUT response, not from a refresh that never lands', async () => {
    render(<PlatformSettingsPanel settings={SETTINGS} />);

    expect(screen.getByText('Sunlit Studio')).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Release hold' }));
    });

    expect(screen.queryByText('Sunlit Studio')).toBeNull();
    expect(screen.getByText("No vendor's payouts are held.")).toBeDefined();
  });

  it('holds a vendor found by search from the PUT response, not from a refresh that never lands', async () => {
    render(<PlatformSettingsPanel settings={SETTINGS} />);

    fireEvent.change(screen.getByLabelText('Find a vendor to hold'), {
      target: { value: 'garden' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Find vendor' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Hold payouts' }));
    });

    expect(screen.getByText('Held')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Hold payouts' })).toBeNull();
    // Once in the held-vendors list above, and once in the search row it came from.
    expect(screen.getAllByText('Garden Co')).toHaveLength(2);
  });
});
