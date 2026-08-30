import { randomUUID } from 'node:crypto';
import {
  DeleteObjectsCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { UserRole } from '@vendor-marketplace/shared';
import type { ApiEnv } from '../config/env.js';

/** Object namespaces the API writes into, kept to a closed set. */
/**
 * The namespaces an upload may be written under. Closed, because the prefix
 * becomes part of the object key and an open one would let a caller write
 * anywhere in the bucket. `customer-profile` is a customer's own avatar.
 */
export const STORAGE_PREFIXES = [
  'vendor-profile',
  'vendor-cover',
  'portfolio',
  'customer-profile',
] as const;
export type StoragePrefix = (typeof STORAGE_PREFIXES)[number];

/**
 * Who may write into each namespace. Authorization belongs **per prefix**, not
 * per route: the upload endpoint serves both sides of the marketplace, so a
 * single route-level role guard necessarily locks one of them out — which is
 * exactly how `customer-profile` came to be declared here and unreachable by
 * customers. The `Record` is what stops that recurring: a new prefix does not
 * compile until someone decides who may write to it.
 */
export const STORAGE_PREFIX_ROLES: Record<StoragePrefix, readonly UserRole[]> = {
  'vendor-profile': ['vendor'],
  'vendor-cover': ['vendor'],
  portfolio: ['vendor'],
  'customer-profile': ['customer'],
};

/**
 * How long a stored object may be cached. Keys are unique per upload and never
 * overwritten, so the objects themselves are immutable.
 */
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface ObjectStorage {
  /** Stores `body` and returns the public URL it is served from. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  /**
   * Removes stored objects. Missing keys are not an error — S3 delete is
   * idempotent, and a caller reaping the objects behind a deleted row should
   * not care whether a previous attempt already got there.
   */
  remove(keys: readonly string[]): Promise<void>;
  /**
   * Resolves when the configured bucket is reachable and rejects otherwise.
   * Used by the readiness probe, which has to fail on a missing bucket and not
   * just on an unreachable endpoint — credentials that authenticate against a
   * bucket that no longer exists still break every upload.
   */
  checkAvailable(): Promise<void>;
}

/**
 * Builds the key an upload is stored under: `<prefix>/<ownerId>/<uuid>.<ext>`.
 *
 * The name is a random UUID rather than anything derived from the client's
 * filename, so an attacker cannot choose a path, overwrite someone else's
 * object, or smuggle a traversal sequence into the key.
 *
 * **The owner segment is what makes deletion safe.** Nothing else in the
 * system records who uploaded a key — there is no `uploads` table — while the
 * key on a row is written by the client, and public vendor pages hand out
 * every key they render. Without an owner in the path, a vendor could claim
 * a rival's key on their own row, delete that row, and take the rival's photo
 * with it. `ownsObjectKey` is the check; this is what makes the check possible.
 */
export function buildObjectKey(prefix: string, ownerId: string, extension: string): string {
  if (!(STORAGE_PREFIXES as readonly string[]).includes(prefix)) {
    throw new Error(`Unknown storage prefix: ${prefix}`);
  }

  if (!ownerId || ownerId.includes('/')) {
    throw new Error('An object key needs a single-segment owner id');
  }

  return `${prefix}/${ownerId}/${randomUUID()}.${extension}`;
}

/**
 * Whether `key` was minted for `ownerId`.
 *
 * Deliberately refuses anything that is not exactly `<prefix>/<owner>/<name>`.
 * Keys stored before the owner segment existed have two segments and are never
 * reaped — they stay as the orphans the old behaviour produced on purpose,
 * which is the safe side of the trade. So does an absolute URL, which some
 * seeded rows carry.
 */
export function ownsObjectKey(key: string, ownerId: string): boolean {
  const segments = key.split('/');

  return (
    segments.length === 3 &&
    (STORAGE_PREFIXES as readonly string[]).includes(segments[0] ?? '') &&
    segments[1] === ownerId
  );
}

export function publicUrlFor(publicBaseUrl: string, key: string): string {
  return `${publicBaseUrl.replace(/\/+$/, '')}/${key}`;
}

/**
 * The production storage adapter. Cloudflare R2 and the local MinIO service
 * both speak the S3 API, so the only difference between them is configuration.
 */
export function createS3Storage(env: ApiEnv): ObjectStorage {
  const client = new S3Client({
    // R2 is region-less but the SDK requires the field to be set.
    region: 'auto',
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });

  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: CACHE_CONTROL,
        }),
      );

      return publicUrlFor(env.S3_PUBLIC_URL, key);
    },

    async remove(keys) {
      if (keys.length === 0) {
        return;
      }

      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: env.S3_BUCKET,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );

      /*
       * `DeleteObjects` answers **200** with per-key failures in `Errors`, so a
       * token missing `s3:DeleteObject` would otherwise reap nothing, forever,
       * without ever rejecting. `Quiet: true` suppresses the successes, not
       * these.
       */
      if (result.Errors && result.Errors.length > 0) {
        throw new Error(
          `Object store refused ${result.Errors.length} of ${keys.length} deletes: ${result.Errors.map((entry) => entry.Code ?? 'unknown').join(', ')}`,
        );
      }
    },

    async checkAvailable() {
      await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    },
  };
}
