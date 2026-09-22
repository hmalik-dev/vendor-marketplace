import type { WireVendorDashboard, WireVendorProfile } from '@/lib/wire-schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn<() => Promise<{ firstName: string }>>();
const getOwnVendorProfile = vi.fn<() => Promise<WireVendorProfile | null>>();
const getVendorDashboard = vi.fn<() => Promise<WireVendorDashboard | null>>();
const getOwnBookingRequests = vi.fn<() => Promise<unknown[]>>();
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock('@/lib/current-user', () => ({ requireRole: () => requireRole() }));
vi.mock('@/lib/vendor-data', () => ({
  getOwnVendorProfile: () => getOwnVendorProfile(),
  getVendorDashboard: () => getVendorDashboard(),
}));
vi.mock('@/lib/vendor-requests', () => ({ getOwnBookingRequests: () => getOwnBookingRequests() }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirect(path) }));

const { default: VendorDashboardPage } = await import('./page');

function profile(overrides: Partial<WireVendorProfile> = {}): WireVendorProfile {
  return {
    businessName: 'Ada Photography',
    slug: 'ada-photography',
    ...overrides,
  } as WireVendorProfile;
}

function dashboard(overrides: Partial<WireVendorDashboard> = {}): WireVendorDashboard {
  return {
    isPublished: false,
    moderationHold: false,
    publishBlockers: [],
    stripeOnboarded: true,
    ...overrides,
  } as WireVendorDashboard;
}

/**
 * VEN-514: a first acceptance can now create a vendor's profile as an
 * unpublished draft, so `getOwnVendorProfile()` returning one is no longer
 * proof the vendor has actually started. The redirect this suite drives is
 * what still sends them to the editor rather than an empty dashboard.
 */
describe('VendorDashboardPage', () => {
  beforeEach(() => {
    requireRole.mockReset();
    requireRole.mockResolvedValue({ firstName: 'Ada' });
    getOwnVendorProfile.mockReset();
    getVendorDashboard.mockReset();
    getOwnBookingRequests.mockReset();
    getOwnBookingRequests.mockResolvedValue([]);
    redirect.mockClear();
  });

  it('sends a vendor with no profile at all to the editor', async () => {
    getOwnVendorProfile.mockResolvedValue(null);

    await expect(VendorDashboardPage()).rejects.toThrow('REDIRECT:/vendor/profile/edit');
    expect(getVendorDashboard).not.toHaveBeenCalled();
  });

  it('sends a vendor whose dashboard the API could not find to the editor', async () => {
    getOwnVendorProfile.mockResolvedValue(profile());
    getVendorDashboard.mockResolvedValue(null);

    await expect(VendorDashboardPage()).rejects.toThrow('REDIRECT:/vendor/profile/edit');
  });

  it('sends a never-started draft — no packages, no bio, no reply window — to the editor first (VEN-514)', async () => {
    getOwnVendorProfile.mockResolvedValue(profile());
    getVendorDashboard.mockResolvedValue(
      dashboard({ publishBlockers: ['packages', 'bio', 'responseTime'] }),
    );

    await expect(VendorDashboardPage()).rejects.toThrow('REDIRECT:/vendor/profile/edit');
  });

  it('shows the dashboard once an unpublished profile has at least one package', async () => {
    getOwnVendorProfile.mockResolvedValue(profile());
    getVendorDashboard.mockResolvedValue(dashboard({ publishBlockers: ['bio', 'responseTime'] }));

    await expect(VendorDashboardPage()).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  /**
   * The trap the broad `publishBlockers.includes('packages')` version of this
   * rule set: an established, previously-published vendor deactivates their
   * one package to rewrite it. They are unpublished with no packages too —
   * exactly VEN-514's draft shape on that one axis — but they already have a
   * bio and a reply window, which a profile that has never published cannot
   * (both are publish blockers), so they keep the dashboard rather than being
   * bounced to the editor with no way back until a package is active again.
   */
  it('keeps an established vendor on the dashboard after their last package goes inactive', async () => {
    getOwnVendorProfile.mockResolvedValue(profile());
    getVendorDashboard.mockResolvedValue(dashboard({ publishBlockers: ['packages'] }));

    await expect(VendorDashboardPage()).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('shows the dashboard for a published profile even with no packages listed', async () => {
    getOwnVendorProfile.mockResolvedValue(profile());
    getVendorDashboard.mockResolvedValue(dashboard({ isPublished: true, publishBlockers: [] }));

    await expect(VendorDashboardPage()).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
