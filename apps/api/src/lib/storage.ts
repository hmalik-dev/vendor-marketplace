import { randomUUID } from 'node:crypto';
import { HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ApiEnv } from '../config/env.js';

/** Object namespaces the API writes into, kept to a closed set. */
export const STORAGE_PREFIXES = ['vendor-profile', 'vendor-cover', 'portfolio'] as const;
export type StoragePrefix = (typeof STORAGE_PREFIXES)[number];

/**
 * How long a stored object may be cached. Keys are unique per upload and never
 * overwritten, so the objects themselves are immutable.
 */
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface ObjectStorage {
  /** Stores `body` and returns the public URL it is served from. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  /**
   * Resolves when the configured bucket is reachable and rejects otherwise.
   * Used by the readiness probe, which has to fail on a missing bucket and not
   * just on an unreachable endpoint — credentials that authenticate against a
   * bucket that no longer exists still break every upload.
   */
  checkAvailable(): Promise<void>;
}

/**
 * Builds the key an upload is stored under. The name is a random UUID rather
 * than anything derived from the client's filename, so an attacker cannot
 * choose a path, overwrite someone else's object, or smuggle a traversal
 * sequence into the key.
 */
export function buildObjectKey(prefix: string, extension: string): string {
  if (!(STORAGE_PREFIXES as readonly string[]).includes(prefix)) {
    throw new Error(`Unknown storage prefix: ${prefix}`);
  }

  return `${prefix}/${randomUUID()}.${extension}`;
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

    async checkAvailable() {
      await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    },
  };
}
