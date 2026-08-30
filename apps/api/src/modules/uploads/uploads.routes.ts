import { MAX_UPLOAD_BYTES, uploadedImageSchema } from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { validationFailed } from '../../lib/errors.js';
import { assertRole, requireAuth } from '../../lib/guards.js';
import { processUploadedImage } from '../../lib/images.js';
import { buildObjectKey, STORAGE_PREFIXES, STORAGE_PREFIX_ROLES } from '../../lib/storage.js';

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

/**
 * Accepts one image, normalises it, and stores both variants. The bytes are
 * decoded and re-encoded before they ever reach storage, so what is served is
 * always a WebP this process produced rather than whatever the client sent.
 *
 * Authorization is **per prefix**: `requireAuth` settles only that there is a
 * caller, and `STORAGE_PREFIX_ROLES` decides who may write to the namespace.
 */
export const uploadRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/upload/image',
    {
      preHandler: requireAuth,
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
      assertRole(request.auth, STORAGE_PREFIX_ROLES[request.query.prefix]);

      const part = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });

      if (!part) {
        throw validationFailed('Attach an image file to upload.');
      }

      let buffer: Buffer;
      try {
        buffer = await part.toBuffer();
      } catch (error) {
        if (isFileTooLarge(error)) {
          throw validationFailed(
            `Image is larger than the ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit.`,
          );
        }
        throw error;
      }

      const processed = await processUploadedImage(buffer, part.mimetype);

      const key = buildObjectKey(request.query.prefix, 'webp');
      const thumbnailKey = key.replace(/\.webp$/, '-thumb.webp');

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
