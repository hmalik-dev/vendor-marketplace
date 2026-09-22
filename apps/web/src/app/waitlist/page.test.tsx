import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getServerSession = vi.fn();
const readIdentityForSupport = vi.fn();
const getMyVendorApplication = vi.fn();

vi.mock('@/lib/auth/server', () => ({ getServerSession: () => getServerSession() }));
vi.mock('@/lib/current-user', () => ({ readIdentityForSupport: () => readIdentityForSupport() }));
vi.mock('@/lib/vendor-data', () => ({ getMyVendorApplication: () => getMyVendorApplication() }));

const { default: WaitlistPage } = await import('./page');

describe('WaitlistPage', () => {
  afterEach(() => {
    cleanup();
    getServerSession.mockReset();
    readIdentityForSupport.mockReset();
    getMyVendorApplication.mockReset();
  });

  /*
   * Frame `37`: the divider's own `margin-top:30px` is the gap between the
   * address paragraph and the "Back to {BRAND_NAME}" link, and the link
   * computes `13.5px` (`text-base`), not the 12.5px `text-sm` the wrapper
   * used to set. VEN-587 — was `mt-0`/`text-sm` (22px gap, 12.5px link).
   */
  it('sets the divider gap to 30px and the home link to text-base', async () => {
    getServerSession.mockResolvedValue({ userId: 'u1' });
    readIdentityForSupport.mockResolvedValue(null);
    getMyVendorApplication.mockResolvedValue({
      email: 'mara@wildbloomflorals.com',
      businessName: 'Wildbloom Florals',
      category: 'florist',
      city: 'Austin',
      state: 'TX',
      message: null,
      complete: true,
    });

    render(await WaitlistPage());

    const link = screen.getByRole('link', { name: /back to/i });
    const divider = link.closest('div');

    expect(divider?.className).toContain('mt-7.5');
    expect(divider?.className).toContain('text-base');
    expect(divider?.className).not.toContain('text-sm');
  });
});
