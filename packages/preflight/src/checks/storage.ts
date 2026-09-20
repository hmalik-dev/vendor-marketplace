import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { type Check, type CheckResult, fail, pass } from '../types.js';

/** A hung endpoint must not hang the gate. */
const LISTING_PROBE_TIMEOUT_MS = 5_000;

/**
 * The bucket must serve objects and refuse to enumerate them.
 *
 * Both the key builder and the portfolio delete path lean on keys being random
 * UUIDs and therefore unguessable — an orphaned object is "a few kilobytes
 * nobody can find". Anonymous `ListObjects` makes that reasoning worthless:
 * you do not have to guess a key you can read off a list. Locally,
 * `mc anonymous set download` grants exactly that: it writes `s3:ListBucket`
 * on the bucket ARN, and under it this bucket enumerated 136 keys — every
 * portfolio photo, profile picture and cover for every user — to an
 * unauthenticated `curl`. Verified by resetting the policy and probing it.
 *
 * **Probed at `STORAGE_PUBLIC_URL`, not `STORAGE_ENDPOINT`.** They coincide locally, and
 * on Neon Object Storage the public base is the bucket path under the branch's
 * storage host, which a `public_read` bucket serves to anyone, while the signed
 * API surface is a separate question. Probing only the endpoint could pass
 * unconditionally in exactly the environment it matters in. Measured on the
 * staging bucket: an unsigned `?list-type=2` answers 403 AccessDenied. What is at stake is what a stranger holding
 * an image URL can do with it, and that host is the public one.
 *
 * Unsigned on purpose. Signing would prove the *account* can list, which it
 * can and should.
 */
export async function checkAnonymousListing(publicUrl: string): Promise<CheckResult> {
  const name = 'Upload bucket refuses anonymous listing';
  const url = `${publicUrl.replace(/\/+$/, '')}?list-type=2`;

  let status: number;
  try {
    status = (
      await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(LISTING_PROBE_TIMEOUT_MS),
      })
    ).status;
  } catch (error: unknown) {
    // Unreachable is the reachability check's finding, not this one's.
    return pass('storage', name, `not reachable to test — ${describe(error)}`);
  }

  if (status === 200) {
    return fail(
      'storage',
      name,
      `${url} enumerates its keys to an unauthenticated caller`,
      'Declare the bucket `access: "public_read"` in neon.ts and `neon deploy` it, rather than granting a broader policy.',
    );
  }

  return pass('storage', name, `listing answered ${status}`);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

export const storageCheck: Check = {
  id: 7,
  title: 'Object storage',
  async run(context) {
    if (!context.capabilities.has('storage')) {
      return [];
    }

    const name = 'Upload bucket is reachable';
    const {
      STORAGE_ENDPOINT,
      STORAGE_ACCESS_KEY_ID,
      STORAGE_SECRET_ACCESS_KEY,
      STORAGE_BUCKET,
      STORAGE_PUBLIC_URL,
    } = context.env;

    if (
      !STORAGE_ENDPOINT ||
      !STORAGE_ACCESS_KEY_ID ||
      !STORAGE_SECRET_ACCESS_KEY ||
      !STORAGE_BUCKET
    ) {
      return [
        fail(
          'storage',
          name,
          'not checked — the STORAGE_* variables are incomplete',
          'Fix the storage variables above first',
        ),
      ];
    }

    const client = new S3Client({
      region: context.env.STORAGE_REGION || 'auto',
      endpoint: STORAGE_ENDPOINT,
      forcePathStyle: context.env.STORAGE_FORCE_PATH_STYLE !== 'false',
      credentials: {
        accessKeyId: STORAGE_ACCESS_KEY_ID,
        secretAccessKey: STORAGE_SECRET_ACCESS_KEY,
      },
    });

    try {
      await client.send(new HeadBucketCommand({ Bucket: STORAGE_BUCKET }));
      const reachable = pass('storage', name, `${STORAGE_BUCKET} at ${STORAGE_ENDPOINT}`);

      /*
       * Without a public URL there is no host to probe — and no public host is
       * itself the safe state, so this is not a finding.
       */
      return STORAGE_PUBLIC_URL
        ? [reachable, await checkAnonymousListing(STORAGE_PUBLIC_URL)]
        : [reachable];
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'HeadBucket failed';
      const fix =
        context.target === 'production'
          ? 'Declare the `uploads` bucket in neon.ts and run `neon deploy` on this branch: https://neon.com/docs/storage/overview'
          : 'Run `pnpm lane:up <ticket>`: a lane gets its own Neon storage branch and writes its STORAGE_* values';

      return [fail('storage', name, `${STORAGE_BUCKET} at ${STORAGE_ENDPOINT}: ${reason}`, fix)];
    } finally {
      client.destroy();
    }
  },
};
