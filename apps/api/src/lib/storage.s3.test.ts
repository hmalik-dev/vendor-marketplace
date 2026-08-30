import type * as S3 from '@aws-sdk/client-s3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from '../config/env.js';

const send = vi.fn();

vi.mock('@aws-sdk/client-s3', async (importOriginal) => {
  const actual = await importOriginal<typeof S3>();

  return {
    ...actual,
    S3Client: class {
      send = send;
      destroy(): void {}
    },
  };
});

const { createS3Storage } = await import('./storage.js');

const env = {
  S3_ENDPOINT: 'http://storage.test',
  S3_BUCKET: 'uploads',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_PUBLIC_URL: 'http://cdn.test',
  S3_FORCE_PATH_STYLE: true,
} as unknown as ApiEnv;

interface DeleteInput {
  Bucket: string;
  Delete: { Objects: { Key: string }[]; Quiet: boolean };
}

function lastDeleteInput(): DeleteInput {
  return send.mock.calls.at(-1)?.[0].input as DeleteInput;
}

beforeEach(() => {
  send.mockReset();
});

/**
 * `DeleteObjects` is the one call here whose failure mode is **silence**: it
 * answers HTTP 200 and lists the per-key failures in `Errors`. A token missing
 * `s3:DeleteObject` would therefore reap nothing, forever, without ever
 * rejecting — the quiet version of the bug the reap exists to fix.
 */
describe('createS3Storage remove', () => {
  it('deletes every key in one batched call against the configured bucket', async () => {
    send.mockResolvedValue({});
    const storage = createS3Storage(env);

    await storage.remove(['portfolio/owner/a.webp', 'portfolio/owner/a-thumb.webp']);

    expect(send).toHaveBeenCalledTimes(1);
    expect(lastDeleteInput().Bucket).toBe('uploads');
    expect(lastDeleteInput().Delete.Objects).toEqual([
      { Key: 'portfolio/owner/a.webp' },
      { Key: 'portfolio/owner/a-thumb.webp' },
    ]);
  });

  it('makes no request at all for an empty list', async () => {
    const storage = createS3Storage(env);

    await storage.remove([]);

    expect(send).not.toHaveBeenCalled();
  });

  /*
   * `Quiet: true` suppresses the *successes* in the response, not the errors.
   * Reading it as "suppress everything" is how this call comes to look like it
   * worked.
   */
  it('throws when the store reports per-key failures inside a 200', async () => {
    send.mockResolvedValue({
      Errors: [{ Key: 'portfolio/owner/a.webp', Code: 'AccessDenied' }],
    });
    const storage = createS3Storage(env);

    await expect(storage.remove(['portfolio/owner/a.webp'])).rejects.toThrow(/AccessDenied/);
  });

  it('names how many of the batch were refused', async () => {
    send.mockResolvedValue({
      Errors: [
        { Key: 'a.webp', Code: 'AccessDenied' },
        { Key: 'b.webp', Code: 'InternalError' },
      ],
    });
    const storage = createS3Storage(env);

    await expect(storage.remove(['a.webp', 'b.webp', 'c.webp'])).rejects.toThrow(/2 of 3/);
  });

  it('treats an empty Errors array as success', async () => {
    send.mockResolvedValue({ Errors: [] });
    const storage = createS3Storage(env);

    await expect(storage.remove(['a.webp'])).resolves.toBeUndefined();
  });
});

describe('createS3Storage put', () => {
  it('returns the public URL the object is served from, not the endpoint', async () => {
    send.mockResolvedValue({});
    const storage = createS3Storage(env);

    const url = await storage.put('portfolio/owner/a.webp', Buffer.from('x'), 'image/webp');

    expect(url).toBe('http://cdn.test/portfolio/owner/a.webp');
  });

  /* Keys are unique per upload and never overwritten, so objects are immutable. */
  it('stores objects as immutable for a year', async () => {
    send.mockResolvedValue({});
    const storage = createS3Storage(env);

    await storage.put('portfolio/owner/a.webp', Buffer.from('x'), 'image/webp');

    const input = send.mock.calls[0]?.[0].input as { CacheControl: string; ContentType: string };
    expect(input.CacheControl).toBe('public, max-age=31536000, immutable');
    expect(input.ContentType).toBe('image/webp');
  });
});
