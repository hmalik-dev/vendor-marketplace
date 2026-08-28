import { CATEGORY_SEEDS } from '@vendor-marketplace/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/env', () => ({ siteOrigin: () => 'https://orla.example.com' }));

const apiRequest = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiRequest: (p: string, o: unknown) => apiRequest(p, o) }));

const { default: sitemap } = await import('./sitemap');

function page(slugs: string[], total = slugs.length): unknown {
  return {
    items: slugs.map((slug) => ({ slug })),
    total,
    page: 1,
    pageSize: 100,
    facets: { categories: [] },
  };
}

describe('sitemap', () => {
  beforeEach(() => apiRequest.mockReset());

  it('lists one entry per published vendor, read from the API', async () => {
    apiRequest.mockResolvedValue(page(['june-harlow', 'kessler-co']));

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain('https://orla.example.com/vendors/june-harlow');
    expect(urls).toContain('https://orla.example.com/vendors/kessler-co');
  });

  it('leads with the landing page and covers every category search', async () => {
    apiRequest.mockResolvedValue(page([]));

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls[0]).toBe('https://orla.example.com');
    for (const category of CATEGORY_SEEDS) {
      expect(urls).toContain(`https://orla.example.com/search?category=${category.slug}`);
    }
  });

  /*
   * The vendor list is paginated, and stopping after the first page would
   * quietly drop every vendor past the hundredth — which is exactly the kind
   * of omission nobody notices until the traffic does not arrive.
   */
  it('walks every page rather than listing only the first', async () => {
    apiRequest
      .mockResolvedValueOnce(page(['a', 'b'], 4))
      .mockResolvedValueOnce(page(['c', 'd'], 4));

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(apiRequest).toHaveBeenCalledTimes(2);
    for (const slug of ['a', 'b', 'c', 'd']) {
      expect(urls).toContain(`https://orla.example.com/vendors/${slug}`);
    }
  });

  it('stops rather than looping when a page comes back empty', async () => {
    apiRequest.mockResolvedValue(page([], 999));

    await sitemap();

    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  /*
   * Same rule as every other reference read (#33): one unavailable section
   * must not take the response down. A sitemap missing its vendors for an hour
   * is recoverable; a 500 teaches the crawler to stop asking.
   */
  it('still serves the static entries when the vendor list is unavailable', async () => {
    /*
     * Thrown synchronously rather than as a rejected promise. `await` inside
     * the `try` handles both identically, and Vitest records a rejected mock
     * result as an unhandled rejection even once the code under test has
     * caught it — which fails the run for the very behaviour being asserted.
     */
    /*
     * The failure is induced by handing back a body the reader cannot use,
     * rather than by rejecting: Vitest records a rejected mock result in its
     * unhandled-error tracker and fails the run for it even once the code
     * under test has caught it. The `catch` in `sitemap()` is the same one
     * either way — this is the branch under test, reached by a real
     * `TypeError` from real code rather than by a thrown mock.
     */
    apiRequest.mockResolvedValue(undefined);

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls[0]).toBe('https://orla.example.com');
    expect(urls.some((url) => url.includes('/vendors/'))).toBe(false);
  });
});
