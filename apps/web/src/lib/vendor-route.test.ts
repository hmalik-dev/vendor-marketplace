import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getPublicVendorProfile = vi.fn();
const getVendorSlugSuccessor = vi.fn();
const requestedPath = vi.fn();
const requestedPathname = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw Object.assign(new Error('NEXT_NOT_FOUND'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });
  },
  permanentRedirect: (path: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), {
      digest: `NEXT_REDIRECT;replace;${path};308;`,
    });
  },
}));
vi.mock('./vendor-data', () => ({
  getPublicVendorProfile: (slug: string) => getPublicVendorProfile(slug),
  getVendorSlugSuccessor: (slug: string) => getVendorSlugSuccessor(slug),
}));
vi.mock('./requested-path', () => ({
  requestedPath: () => requestedPath(),
  requestedPathname: () => requestedPathname(),
}));

const { gateVendorSlug, successorPath } = await import('./vendor-route');

async function refusal(slug: string): Promise<string | undefined> {
  return ((await gateVendorSlug(slug).catch((error: unknown) => error)) as { digest?: string })
    ?.digest;
}

describe('gateVendorSlug', () => {
  beforeEach(() => {
    getPublicVendorProfile.mockResolvedValue({ slug: 'sunlit-studio' });
    getVendorSlugSuccessor.mockResolvedValue(null);
    requestedPath.mockResolvedValue('/vendors/sunlit-studio');
    requestedPathname.mockResolvedValue('/vendors/sunlit-studio');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lets a live storefront through without a successor read', async () => {
    await expect(gateVendorSlug('sunlit-studio')).resolves.toBeUndefined();
    expect(getVendorSlugSuccessor).not.toHaveBeenCalled();
  });

  it('answers a slug nobody ever held with the 404', async () => {
    getPublicVendorProfile.mockResolvedValue(null);

    expect(await refusal('nobody')).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
  });

  it('answers a renamed slug with a 308 to the profile under the new slug', async () => {
    getPublicVendorProfile.mockResolvedValue(null);
    getVendorSlugSuccessor.mockResolvedValue('moonlit-studio');

    expect(await refusal('sunlit-studio')).toBe(
      'NEXT_REDIRECT;replace;/vendors/moonlit-studio;308;',
    );
    expect(getVendorSlugSuccessor).toHaveBeenCalledWith('sunlit-studio');
  });

  it('keeps the customer’s choices when the renamed slug was on the request form (VEN-648)', async () => {
    getPublicVendorProfile.mockResolvedValue(null);
    getVendorSlugSuccessor.mockResolvedValue('moonlit-studio');
    requestedPathname.mockResolvedValue('/vendors/sunlit-studio/request');
    requestedPath.mockResolvedValue(
      '/vendors/sunlit-studio/request?package=pkg-1&date=2027-05-01&utm=x',
    );

    expect(await refusal('sunlit-studio')).toBe(
      'NEXT_REDIRECT;replace;/vendors/moonlit-studio/request?package=pkg-1&date=2027-05-01;308;',
    );
  });
});

describe('successorPath', () => {
  it.each([
    ['moon', false, '/vendors/sunlit?package=p', '/vendors/moon'],
    ['moon', true, null, '/vendors/moon/request'],
    ['moon', true, '/vendors/sunlit/request?guests=40', '/vendors/moon/request?guests=40'],
    ['moon', true, '/vendors/sunlit/request?package=&other=1', '/vendors/moon/request'],
  ])('%s, on the request page: %s, from %s -> %s', (current, onRequest, from, expected) => {
    expect(successorPath(current, onRequest, from)).toBe(expected);
  });
});
