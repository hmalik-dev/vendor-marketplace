import { ERROR_CODES } from '@vendor-marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from './api-client';

/*
 * `vendor-data` resolves the Clerk session at module scope for its protected
 * reads. The reference reads under test here are unauthenticated, so both
 * server dependencies are stubbed down to nothing.
 */
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ getToken: async () => 'session-token' }),
}));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirected to ${path}`);
  },
}));

const apiRequest = vi.fn();

vi.mock('./api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api-client')>()),
  apiRequest: (path: string, options: unknown) => apiRequest(path, options),
}));

const { getActiveTags, getCategories, getFeaturedVendors } = await import('./vendor-data');

const upstream500 = new ApiClientError(
  500,
  ERROR_CODES.INTERNAL_ERROR,
  'Request failed with status 500',
);

/** What a `fetch` to an API that is not answering at all rejects with. */
const apiUnreachable = new TypeError('fetch failed');

describe('reference reads', () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  describe('getCategories', () => {
    it('returns the taxonomy the API answered with', async () => {
      const categories = [{ slug: 'photography', name: 'Photography', displayOrder: 1 }];
      apiRequest.mockResolvedValue(categories);

      await expect(getCategories()).resolves.toEqual(categories);
    });

    it('degrades to an empty taxonomy when the API answers 500', async () => {
      apiRequest.mockRejectedValue(upstream500);

      await expect(getCategories()).resolves.toEqual([]);
    });

    it('degrades to an empty taxonomy when the API is unreachable', async () => {
      apiRequest.mockRejectedValue(apiUnreachable);

      await expect(getCategories()).resolves.toEqual([]);
    });

    it('propagates the failure when the caller marks the read required', async () => {
      apiRequest.mockRejectedValue(upstream500);

      await expect(getCategories({ required: true })).rejects.toBe(upstream500);
    });
  });

  describe('getActiveTags', () => {
    it('returns the vocabulary the API answered with', async () => {
      const tags = [{ slug: 'moody', label: 'Moody', categorySlug: 'photography' }];
      apiRequest.mockResolvedValue(tags);

      await expect(getActiveTags()).resolves.toEqual(tags);
    });

    it('degrades to an empty vocabulary when the API answers 500', async () => {
      apiRequest.mockRejectedValue(upstream500);

      await expect(getActiveTags()).resolves.toEqual([]);
    });

    it('degrades to an empty vocabulary when the API is unreachable', async () => {
      apiRequest.mockRejectedValue(apiUnreachable);

      await expect(getActiveTags()).resolves.toEqual([]);
    });

    it('propagates the failure when the caller marks the read required', async () => {
      apiRequest.mockRejectedValue(upstream500);

      await expect(getActiveTags({ required: true })).rejects.toBe(upstream500);
    });
  });

  describe('getFeaturedVendors', () => {
    it('degrades to no vendors when the API answers 500', async () => {
      apiRequest.mockRejectedValue(upstream500);

      await expect(getFeaturedVendors()).resolves.toEqual([]);
    });

    it('degrades to no vendors when the API is unreachable', async () => {
      apiRequest.mockRejectedValue(apiUnreachable);

      await expect(getFeaturedVendors()).resolves.toEqual([]);
    });
  });

  /*
   * `redirect()` and `notFound()` are thrown, not returned. A degrading read
   * that swallowed one would strand the visitor on the page it was trying to
   * leave, so the digest marker is the one thing the catch re-throws.
   */
  it('re-throws a Next navigation signal instead of degrading', async () => {
    const navigation = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;/' });
    apiRequest.mockRejectedValue(navigation);

    await expect(getCategories()).rejects.toBe(navigation);
  });
});
