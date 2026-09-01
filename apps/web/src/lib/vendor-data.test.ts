import { ERROR_CODES } from '@vendor-marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_REQUEST_TIMEOUT_MS, ApiClientError, ApiTimeoutError } from './api-client';

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

const {
  getActiveTags,
  getCategories,
  getFeaturedVendors,
  getPublicVendorAvailability,
  getPublicVendorProfile,
  getPublicVendorReviews,
  getVendorCities,
} = await import('./vendor-data');

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

    /*
     * #222: the storefront editor posts these ids back. A cached id outlives
     * the row it names — after a reseed the editor offered ids the API no
     * longer had for an hour, across hard reloads, and every save was refused.
     */
    it('caches the taxonomy for a page that only displays it', async () => {
      apiRequest.mockResolvedValue([]);

      await getCategories();

      expect(apiRequest).toHaveBeenCalledWith(
        '/categories',
        expect.objectContaining({ revalidate: 3600 }),
      );
    });

    it('reads past the cache for a page that posts the ids back', async () => {
      apiRequest.mockResolvedValue([]);

      await getCategories({ required: true, fresh: true });

      // Omitted rather than `0`: `apiRequest` sends `cache: 'no-store'` when
      // there is no `revalidate`, and Next ignores a `revalidate` sent beside
      // a `cache`.
      expect(apiRequest).toHaveBeenCalledWith(
        '/categories',
        expect.not.objectContaining({ revalidate: expect.anything() }),
      );
    });
  });

  describe('getActiveTags', () => {
    it('reads past the cache for a page that posts the ids back', async () => {
      apiRequest.mockResolvedValue([]);

      await getActiveTags({ required: true, fresh: true });

      expect(apiRequest).toHaveBeenCalledWith(
        '/tags',
        expect.not.objectContaining({ revalidate: expect.anything() }),
      );
    });

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
   * The slug is this endpoint's only input, so a 400 means the path segment
   * could not be a slug at all. Rethrowing it turned `/vendors/JUNE-HARLOW`
   * into a 500 page; it is a 404, and the page reaches that through `null`.
   */
  describe('getPublicVendorProfile', () => {
    it.each([
      ['a 404 for a slug that is absent, unpublished or deleted', 404, ERROR_CODES.NOT_FOUND],
      ['a 400 for a slug the API refuses to parse', 400, ERROR_CODES.VALIDATION_ERROR],
    ])('returns null on %s', async (_label, statusCode, code) => {
      apiRequest.mockRejectedValue(new ApiClientError(statusCode, code, 'Request failed'));

      await expect(getPublicVendorProfile('JUNE-HARLOW')).resolves.toBeNull();
    });

    it('still propagates a 500 so the error boundary reports the outage', async () => {
      apiRequest.mockRejectedValue(upstream500);

      await expect(getPublicVendorProfile('june-harlow')).rejects.toBe(upstream500);
    });

    /*
     * Asked before the request, so the answer does not depend on which status
     * the transport happens to pick. The API answers a 300-character slug with
     * **414**, not the 400 its schema gives a malformed one — a status list
     * would have let that one through to the error boundary as a 500.
     */
    it.each([
      ['an uppercased slug', 'JUNE-HARLOW'],
      ['a slug longer than the column', 'a'.repeat(300)],
      ['a script tag', '<script>alert(1)</script>'],
      ['a null byte', '\u0000'],
      ['a traversal attempt', '../../etc'],
      ['an empty segment', ''],
    ])('returns null for %s without asking the API', async (_label, slug) => {
      await expect(getPublicVendorProfile(slug)).resolves.toBeNull();
      expect(apiRequest).not.toHaveBeenCalled();
    });
  });

  /*
   * The Reviews tab is public, but this is the only one of the three
   * public-profile reads that presents a token — and the API's auth hook
   * answers 401/403 on *any* route, public included, when a presented token
   * does not verify or belongs to a suspended account. Without the retry, one
   * stale session turned a vendor with 127 reviews into a tab saying they had
   * never worked an event.
   */
  describe('getPublicVendorReviews', () => {
    const page = {
      items: [],
      summary: { avgRating: 4.9, reviewCount: 127, distribution: [0, 0, 0, 13, 114] },
      viewer: { canReview: false, bookingId: null },
      page: 1,
      pageSize: 10,
      hasMore: true,
    };

    it.each([
      ['a refused session', 401, ERROR_CODES.UNAUTHORIZED],
      ['a suspended account', 403, ERROR_CODES.FORBIDDEN],
    ])(
      'retries unauthenticated after %s, so the reviews still render',
      async (_l, status, code) => {
        apiRequest
          .mockRejectedValueOnce(new ApiClientError(status, code, 'Session expired'))
          .mockResolvedValueOnce(page);

        await expect(getPublicVendorReviews('june-harlow')).resolves.toEqual(page);

        expect(apiRequest).toHaveBeenCalledTimes(2);
        expect(apiRequest.mock.calls[0]?.[1]).toMatchObject({ token: 'session-token' });
        // The second attempt drops the token — the reviews never needed it, and
        // only the viewer's own eligibility is lost with it.
        expect(apiRequest.mock.calls[1]?.[1]).toMatchObject({ token: null });
      },
    );

    it('gives up rather than looping when the unauthenticated retry also fails', async () => {
      apiRequest.mockRejectedValue(
        new ApiClientError(401, ERROR_CODES.UNAUTHORIZED, 'Session expired'),
      );

      await expect(getPublicVendorReviews('june-harlow')).resolves.toBeNull();
      expect(apiRequest).toHaveBeenCalledTimes(2);
    });

    it('does not retry a failure a second attempt cannot change', async () => {
      apiRequest.mockRejectedValue(upstream500);

      await expect(getPublicVendorReviews('june-harlow')).resolves.toBeNull();
      expect(apiRequest).toHaveBeenCalledTimes(1);
    });

    it('never asks the API about a slug that cannot be one', async () => {
      await expect(getPublicVendorReviews('JUNE-HARLOW')).resolves.toBeNull();
      expect(apiRequest).not.toHaveBeenCalled();
    });

    /* A thrown `redirect()` must not be swallowed as "no reviews". */
    it('propagates a transport failure rather than reporting an empty tab', async () => {
      apiRequest.mockRejectedValue(apiUnreachable);

      await expect(getPublicVendorReviews('june-harlow')).rejects.toBe(apiUnreachable);
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

/**
 * What each loader does when the API stops answering (#390).
 *
 * The timeout is a third outcome beside "answered" and "answered badly", and
 * each loader has to place it deliberately: the sections that degrade to empty
 * must swallow it, and the profile read must **not**, because its `null` means
 * "no such vendor" and is rendered as the designed 404.
 */
describe('an upstream that never answers', () => {
  const timedOut = new ApiTimeoutError('/vendors/june-harlow', API_REQUEST_TIMEOUT_MS);

  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockRejectedValue(timedOut);
  });

  it('costs the landing page its featured row and nothing else', async () => {
    await expect(getFeaturedVendors()).resolves.toEqual([]);
  });

  it('costs the header its taxonomy without taking the page down', async () => {
    await expect(getCategories()).resolves.toEqual([]);
    await expect(getActiveTags()).resolves.toEqual([]);
  });

  it('leaves the city field offering Anywhere', async () => {
    await expect(getVendorCities()).resolves.toEqual([]);
  });

  it('opens the availability tab on a free month rather than breaking the page', async () => {
    await expect(getPublicVendorAvailability('june-harlow')).resolves.toEqual([]);
  });

  it('says the reviews are on their way, without spending a second deadline', async () => {
    await expect(getPublicVendorReviews('june-harlow')).resolves.toBeNull();

    /*
     * One read, not two. The 401/403 branch retries unauthenticated, and a
     * timeout routed through it would double this page's worst case to learn
     * the same thing.
     */
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it('never turns a slow profile read into "this vendor does not exist"', async () => {
    /*
     * The one that must propagate. `null` here is rendered as the designed 404
     * with its category recovery, so degrading a timeout to `null` would tell
     * a visitor a real vendor is gone because the upstream was wedged — and
     * hand a crawler a 404 for a live page.
     */
    await expect(getPublicVendorProfile('june-harlow')).rejects.toBeInstanceOf(ApiTimeoutError);
  });

  it('still answers a well-formed slug the API calls missing with null', async () => {
    // The contrast that makes the test above mean something.
    apiRequest.mockRejectedValue(
      new ApiClientError(404, ERROR_CODES.NOT_FOUND, 'Vendor not found'),
    );

    await expect(getPublicVendorProfile('june-harlow')).resolves.toBeNull();
  });
});
