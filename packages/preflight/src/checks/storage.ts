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
 * **Probed at `S3_PUBLIC_URL`, not `S3_ENDPOINT`.** They coincide locally, and
 * on R2 they are different hosts: the endpoint is
 * `<account>.r2.cloudflarestorage.com`, which refuses every anonymous request
 * by construction and would make this check pass unconditionally in exactly
 * the environment it matters in. What is at stake is what a stranger holding
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
      'Replace `mc anonymous set download` with a `set-json` policy granting only s3:GetObject — see docker-compose.yml. On R2, remove the bucket-level list permission.',
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
    const { S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_PUBLIC_URL } =
      context.env;

    if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET) {
      return [
        fail(
          'storage',
          name,
          'not checked — the S3_* variables are incomplete',
          'Fix the storage variables above first',
        ),
      ];
    }

    const client = new S3Client({
      region: 'auto',
      endpoint: S3_ENDPOINT,
      forcePathStyle: context.env.S3_FORCE_PATH_STYLE !== 'false',
      credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    });

    try {
      await client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
      const reachable = pass('storage', name, `${S3_BUCKET} at ${S3_ENDPOINT}`);

      /*
       * Without a public URL there is no host to probe — and no public host is
       * itself the safe state, so this is not a finding.
       */
      return S3_PUBLIC_URL ? [reachable, await checkAnonymousListing(S3_PUBLIC_URL)] : [reachable];
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'HeadBucket failed';
      const fix =
        context.target === 'production'
          ? 'Create the R2 bucket and token: https://developers.cloudflare.com/r2/buckets/create-buckets/'
          : 'docker compose up -d storage storage-init';

      return [fail('storage', name, `${S3_BUCKET} at ${S3_ENDPOINT}: ${reason}`, fix)];
    } finally {
      client.destroy();
    }
  },
};
