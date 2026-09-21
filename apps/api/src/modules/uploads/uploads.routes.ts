import { MAX_UPLOAD_BYTES, uploadedImageSchema } from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { conflict, validationFailed } from '../../lib/errors.js';
import { assertRole, requireAuthBeforeValidation } from '../../lib/guards.js';
import { processUploadedImage } from '../../lib/images.js';
import { perAccountRateLimit } from '../../lib/rate-limit.js';
import {
  buildObjectKey,
  countOwnedImages,
  STORAGE_PREFIXES,
  STORAGE_PREFIX_ROLES,
  thumbnailKeyFor,
} from '../../lib/storage.js';

const uploadQuerySchema = z.object({
  /** Which namespace the object belongs to; a closed set, never client paths. */
  prefix: z.enum(STORAGE_PREFIXES),
});

const WEBP_CONTENT_TYPE = 'image/webp';

/** `@fastify/multipart` signals the size limit by name rather than by type. */
function isFileTooLarge(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'FST_REQ_FILE_TOO_LARGE'
  );
}

/** `@fastify/multipart` codes for a body with more fields or parts than allowed. */
const MULTIPART_COUNT_LIMIT_CODES: readonly string[] = ['FST_FIELDS_LIMIT', 'FST_PARTS_LIMIT'];

function isMultipartCountLimit(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    MULTIPART_COUNT_LIMIT_CODES.includes(error.code)
  );
}

export interface UploadRoutesOptions {
  /** Uploads one account may make per minute. */
  rateLimitMax: number;
  /** Images one account may hold in storage. */
  objectLimit: number;
}

/**
 * Accepts one image, normalises it, and stores both variants. The bytes are
 * decoded and re-encoded before they ever reach storage, so what is served is
 * always a WebP this process produced rather than whatever the client sent.
 *
 * Authorization is **per prefix**: the `onRequest` guard settles only that
 * there is a caller, and `STORAGE_PREFIX_ROLES` decides who may write to the
 * namespace. The two run in that order on purpose — authenticate, then
 * validate, then authorize — so nothing about the namespace reaches a caller
 * who has not proved who they are.
 */
export const uploadRoutes: FastifyPluginAsyncZod<UploadRoutesOptions> = async (app, options) => {
  app.post(
    '/upload/image',
    {
      /*
       * `onRequest`, not `preHandler`. Fastify validates the querystring before
       * `preHandler` runs, and `uploadQuerySchema`'s `z.enum` puts every
       * allowed prefix into the 400's `details` — so a signed-out caller could
       * read the whole storage namespace out of a validation error.
       */
      onRequest: requireAuthBeforeValidation,
      config: { rateLimit: perAccountRateLimit(options.rateLimitMax, '1 minute') },
      schema: {
        querystring: uploadQuerySchema,
        response: { 201: uploadedImageSchema },
      },
    },
    async (request, reply) => {
      /*
       * Before a byte is read: `request.file()` is what pipes the request into
       * the multipart parser, so refusing here costs no parse, no buffer and no
       * decode. The query is already validated against the closed prefix set by
       * the time a handler runs, so the lookup cannot miss.
       */
      const uploader = assertRole(request.auth, STORAGE_PREFIX_ROLES[request.query.prefix]);

      /*
       * The account's storage cap, checked before a byte is read for the same
       * reason as the role: a refused upload costs no parse and no decode. The
       * count is of images, not objects, so a thumbnail does not spend a slot.
       */
      const heldImages = await countOwnedImages(app.storage, uploader.id, options.objectLimit);

      if (heldImages >= options.objectLimit) {
        throw conflict(
          `You have reached the limit of ${options.objectLimit} uploaded images. Delete one to upload another.`,
        );
      }

      let buffer: Buffer;
      let mimetype: string;
      try {
        const part = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });

        if (!part) {
          throw validationFailed('Attach an image file to upload.');
        }

        mimetype = part.mimetype;
        buffer = await part.toBuffer();
      } catch (error) {
        if (isFileTooLarge(error)) {
          throw validationFailed(
            `Image is larger than the ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit.`,
          );
        }
        if (isMultipartCountLimit(error)) {
          throw validationFailed('The upload has too many form fields. Send the image only.');
        }
        throw error;
      }

      const processed = await processUploadedImage(buffer, mimetype);

      // The uploader is written into the key: it is the only record of who
      // minted it, and the only thing that makes deleting one safe.
      const key = buildObjectKey(request.query.prefix, uploader.id, 'webp');
      const thumbnailKey = thumbnailKeyFor(key);

      const [imageUrl, thumbnailUrl] = await Promise.all([
        app.storage.put(key, processed.image, WEBP_CONTENT_TYPE),
        app.storage.put(thumbnailKey, processed.thumbnail, WEBP_CONTENT_TYPE),
      ]);

      /*
       * The **keys** are what the caller persists; the URLs come back only so
       * the upload can be previewed without a round trip. Storing a URL would
       * couple the row to the CDN it happened to be uploaded under.
       */
      return reply.status(201).header('location', imageUrl).send({
        imageKey: key,
        thumbnailKey,
        imageUrl,
        thumbnailUrl,
      });
    },
  );
};
