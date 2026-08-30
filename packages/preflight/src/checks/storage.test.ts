import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkAnonymousListing } from './storage.js';

const PUBLIC_URL = 'http://localhost:9000/vendor-marketplace-uploads';

function answering(status: number): typeof fetch {
  return vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/*
 * `mc anonymous set download` writes `s3:ListBucket` on the bucket ARN as well
 * as `s3:GetObject` on its contents. Under it this bucket answered 200 to
 * `GET <bucket>?list-type=2` and enumerated 136 keys — every portfolio photo,
 * profile picture and cover in the system — to a caller holding no credentials.
 * That is the state this check exists to refuse.
 */
describe('checkAnonymousListing', () => {
  it('fails when the bucket enumerates its keys to a stranger', async () => {
    vi.stubGlobal('fetch', answering(200));

    const result = await checkAnonymousListing(PUBLIC_URL);

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('enumerates its keys');
  });

  it('passes when listing is refused', async () => {
    vi.stubGlobal('fetch', answering(403));

    const result = await checkAnonymousListing(PUBLIC_URL);

    expect(result.ok).toBe(true);
    expect(result.detail).toBe('listing answered 403');
  });

  /*
   * The probe goes to the **public** host. On R2 that is a different host from
   * `S3_ENDPOINT` — the endpoint refuses every unsigned request by
   * construction, so probing it would pass unconditionally in exactly the
   * environment where public exposure is real.
   */
  it('probes the public URL itself, with no bucket path appended', async () => {
    const fetchSpy = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 403 }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await checkAnonymousListing(`${PUBLIC_URL}/`);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(`${PUBLIC_URL}?list-type=2`);
  });

  /* A hung public host must not hang `pnpm preflight`. */
  it('carries an abort signal so a hung host cannot stall the gate', async () => {
    const fetchSpy = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 403 }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await checkAnonymousListing(PUBLIC_URL);

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  /*
   * Unreachable is the reachability check's finding. Reporting it twice would
   * make a stopped Docker look like a security failure.
   */
  it('does not fail the gate when the host is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      }),
    );

    const result = await checkAnonymousListing(PUBLIC_URL);

    expect(result.ok).toBe(true);
    expect(result.detail).toContain('connect ECONNREFUSED');
  });
});
