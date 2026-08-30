import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCategories = vi.fn();
const getActiveTags = vi.fn();

vi.mock('@/lib/current-user', () => ({ requireRole: vi.fn(async () => undefined) }));

vi.mock('@/lib/vendor-data', () => ({
  getCategories: (options: unknown) => getCategories(options),
  getActiveTags: (options: unknown) => getActiveTags(options),
  getOwnVendorProfile: async () => null,
}));

vi.mock('@/components/vendor-profile-form', () => ({
  VendorProfileForm: () => null,
}));

const { default: VendorProfileEditPage } = await import('./page');

describe('the storefront editor page', () => {
  beforeEach(() => {
    getCategories.mockReset().mockResolvedValue([]);
    getActiveTags.mockReset().mockResolvedValue([]);
  });

  /*
   * #222. The editor is the one screen that posts these ids back, and the
   * shared hour-long cache let it offer ids the API no longer had — every save
   * refused with "One or more selected categories are unavailable.", surviving
   * a hard reload. The list it renders has to be the list the API serves now.
   */
  it('reads the taxonomy it will post back past the cache', async () => {
    await VendorProfileEditPage();

    expect(getCategories).toHaveBeenCalledWith({ required: true, fresh: true });
    expect(getActiveTags).toHaveBeenCalledWith({ required: true, fresh: true });
  });
});
