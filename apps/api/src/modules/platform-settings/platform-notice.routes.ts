import { publicPlatformNoticeSchema } from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { readPublicPlatformNotice } from './platform-settings.service.js';

/** Seconds a browser or the web tier may reuse the notice (VEN-616). */
const NOTICE_MAX_AGE_SECONDS = 30;

/**
 * The site-wide notice, public and read-only: what an admin posted in
 * `/admin/settings`, or the paused default, or `null`. Carries no account data,
 * so it is safe to cache and to serve signed out.
 */
export const platformNoticeRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/platform/notice',
    { schema: { response: { 200: publicPlatformNoticeSchema } } },
    async (_request, reply) => {
      void reply.header('cache-control', `public, max-age=${NOTICE_MAX_AGE_SECONDS}`);

      return readPublicPlatformNotice(app.db);
    },
  );
};
