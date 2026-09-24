import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();
const gateVendorSlug = vi.fn();

vi.mock('@/lib/current-user', () => ({
  requireRole: (role: string) => requireRole(role),
}));
vi.mock('@/lib/vendor-route', () => ({ gateVendorSlug: (slug: string) => gateVendorSlug(slug) }));

const { default: BookingRequestLayout } = await import('./layout.js');

function render(slug = 'sunlit-studio'): ReturnType<typeof BookingRequestLayout> {
  return BookingRequestLayout({ children: null, params: Promise.resolve({ slug }) });
}

describe('BookingRequestLayout', () => {
  beforeEach(() => {
    requireRole.mockResolvedValue({ id: 'user-1', role: 'customer' });
    gateVendorSlug.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /*
   * #401: the gate must be the one the API applies, not "not a vendor", so an
   * admin is sent to their dashboard before the form rather than refused after.
   */
  it('asks for the role the API requires', async () => {
    await render();

    expect(requireRole).toHaveBeenCalledWith('customer');
    expect(gateVendorSlug).toHaveBeenCalledWith('sunlit-studio');
  });

  it('answers a missing vendor before it asks who is reading', async () => {
    gateVendorSlug.mockRejectedValue(new Error('NEXT_NOT_FOUND'));

    await expect(render('gone')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(requireRole).not.toHaveBeenCalled();
  });

  it('lets the role refusal through as the redirect it is', async () => {
    requireRole.mockRejectedValue(new Error('NEXT_REDIRECT:/admin'));

    await expect(render()).rejects.toThrow('NEXT_REDIRECT:/admin');
  });
});
