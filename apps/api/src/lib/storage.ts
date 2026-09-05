import { randomUUID } from 'node:crypto';
import {
  DeleteObjectsCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { normalizeImageRefPath, type UserRole } from '@vendor-marketplace/shared';
import type { ApiEnv } from '../config/env.js';
import { forbidden } from './errors.js';

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
 * The key of the thumbnail written alongside `key`.
 *
 * Every upload stores two objects, `<name>.webp` and `<name>-thumb.webp`, but
 * only `portfolio_items` has a column for the second one. `vendor_profiles`
 * stores a profile image and a cover with no thumbnail column at all, so the
 * only way to reap a profile photo's sibling is to derive its key — which is
 * safe precisely because the derivation is total and shared with the writer.
 *
 * A derived key is still put through `ownsObjectKey` and the reference check
 * like any other: deriving a key is not evidence that nothing points at it.
 */
export function thumbnailKeyFor(key: string): string {
  return key.replace(/\.webp$/, '-thumb.webp');
}

/**
 * The owner segment of `key`, or `null` when `key` is not an object key at all.
 *
 * The one place the key layout is parsed. Both the reap guard and the write
 * guard ask a question about the owner, and a second copy of
 * `<prefix>/<owner>/<name>` is how the two come to disagree — the failure mode
 * being a write guard that accepts a key the reap guard then refuses to clean
 * up. Deliberately refuses anything that is not exactly three segments under a
 * known prefix: keys stored before the owner segment existed have two and are
 * never reaped, and so are the absolute URLs some seeded rows carry.
 */
function objectKeyOwner(key: string): string | null {
  const segments = key.split('/');

  if (
    segments.length !== 3 ||
    !(STORAGE_PREFIXES as readonly string[]).includes(segments[0] ?? '')
  ) {
    return null;
  }

  return segments[1] ?? null;
}

/**
 * Whether `key` was minted for `ownerId`.
 *
 * The safe side of the trade for deletion: a key this cannot vouch for — a
 * legacy two-segment key, an absolute URL — is left in the bucket as an orphan
 * rather than reaped.
 */
export function ownsObjectKey(key: string, ownerId: string): boolean {
  return objectKeyOwner(key) === ownerId;
}

/**
 * The object `ref` actually names, whatever spelling it arrives in.
 *
 * **The write guard has to decide on the object the reference resolves to, not
 * on the string it is handed.** Comparing the raw spelling left the whole
 * defect reachable through punctuation, in two different directions, and a
 * review of #407 found both:
 *
 * - *A host in front.* `keys:from-urls` is a re-runnable normalizer over the
 *   five columns this guard protects: it strips the configured public base, so
 *   `https://<cdn>/portfolio/<victim>/1111.webp` — four segments while it is
 *   stored, and therefore invisible to `objectKeyOwner` — becomes the bare
 *   foreign key the next time it runs. `findUnreferencedKeys` compares exact
 *   strings, so from that moment the row counts as a live reference and the
 *   victim's own delete is permanently a no-op.
 * - *A dot segment in the middle.* `resolveImageUrl` concatenates the ref onto
 *   the public base and hands the result to a URL parser, which deletes `.`
 *   and `%2e` segments before the request is made. So
 *   `portfolio/<victim>/./1111.webp` is four segments here and fetches the
 *   victim's object there — their photo published as this account's work, on
 *   a storefront cover.
 *
 * This is that parser's own normalisation, applied before the question is
 * asked. `normalizeImageRefPath` is shared with `imageRefSchema` rather than
 * restated — a private copy of half these rules is what let one backslash
 * through, `\` being a path separator to the parser and not to a `split('/')` —
 * and this adds what only an ownership question needs: the scheme and authority
 * go, the query and fragment go, `%2f` folds because object storage decodes it
 * when deriving the key, and empty, `.` and `..` segments resolve away. A real
 * key contains none of them, so nothing legitimate changes shape.
 *
 * The query and fragment are cut for the same reason as everything else here.
 * A parser drops them before it resolves the path and object storage never sees
 * them, but a `split('/')` counts the slashes inside them — so
 * `portfolio/<victim>/1111.webp?a/b` reads as four segments, pushes the prefix
 * out of the window the owner is read from, and fetches the victim's object
 * anyway. Two characters appended to the string `GET /vendors/:slug` already
 * publishes.
 */
function referencedPathSegments(ref: string): string[] {
  const path = normalizeImageRefPath(ref)
    .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '')
    .replace(/[?#][\s\S]*$/, '')
    .replace(/%2f/gi, '/');
  const resolved: string[] = [];

  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') {
      continue;
    }

    if (segment === '..') {
      resolved.pop();
      continue;
    }

    resolved.push(segment);
  }

  return resolved;
}

/**
 * The account a reference names an object of, found **wherever the key sits in
 * the path** rather than only at its start.
 *
 * `S3_PUBLIC_URL` is an origin *and a path*: locally it is
 * `http://localhost:9000/vendor-marketplace-uploads`, and R2 buckets are
 * addressed the same way. So the absolute form of a key is
 * `<origin>/<bucket>/<prefix>/<owner>/<name>` — the prefix is not the first
 * segment, and a guard that assumed it was read no owner and allowed the write.
 * A browser pass proved that end to end: a vendor stored the URL of a
 * customer's uploaded object and the public storefront then served it as the
 * vendor's own work.
 *
 * Scanning is what makes this independent of how the bucket is addressed, which
 * matters because the deployed base is not the local one and a guard that only
 * held for one of them is a guard that holds in tests and not in production.
 * The shape is still exact — a known prefix with exactly two segments after it —
 * so a path merely *containing* the word `portfolio` names no owner.
 *
 * Deliberately not `toObjectKey(env.S3_PUBLIC_URL, …)`: that strips only *the*
 * configured base, so the same key wrapped in any other origin would sail past,
 * and it would put an environment lookup inside a pure ownership predicate.
 */
function referencedObjectKeyOwner(ref: string): string | null {
  const segments = referencedPathSegments(ref);
  const prefixAt = segments.findIndex(
    (segment, index) =>
      (STORAGE_PREFIXES as readonly string[]).includes(segment) && segments.length - index === 3,
  );

  return prefixAt === -1 ? null : (segments[prefixAt + 1] ?? null);
}

/**
 * Whether `ref` is an object key minted for **someone else**.
 *
 * Not `!ownsObjectKey`, and the difference is the point. An image reference is
 * legitimately one of three shapes — an object key, a site-relative path for
 * seeded art, or an absolute URL for a Clerk avatar — and only the first
 * carries an owner, so only the first can be refused. "Is this mine" would
 * reject every seeded path and every Clerk avatar on the way in.
 *
 * The refusal is one-sided on purpose: `ownsObjectKey` keeps deciding on the
 * raw spelling, because widening *it* would start reaping objects that absolute
 * URLs still point at. Refusing more on the way in costs a caller nothing;
 * deleting more on the way out is unrecoverable.
 */
function isForeignObjectKey(ref: string, ownerId: string): boolean {
  const owner = referencedObjectKeyOwner(ref);

  return owner !== null && owner !== ownerId;
}

/**
 * Refuses a write that names an object key minted for another account (#407).
 *
 * Image references are written by the client — `imageRefSchema` accepts a bare
 * object key — and every public vendor page hands out the keys it renders, so
 * without this any signed-in caller could paste a rival's key onto a row of
 * their own. That is not only theft of the image: `findUnreferencedKeys` counts
 * the borrowed row as a live reference, so the *owner's* delete finds the object
 * still referenced and leaves it in the bucket, served for ever, with no way for
 * them to remove it. The reap guard cannot fix that — by the time it runs the
 * second row exists — so the reference is refused at the point it is created.
 */
export function assertOwnedImageRefs(
  refs: readonly (string | null | undefined)[],
  ownerId: string,
): void {
  for (const ref of refs) {
    if (typeof ref === 'string' && isForeignObjectKey(ref, ownerId)) {
      throw forbidden('That image belongs to another account');
    }
  }
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
