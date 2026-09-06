import {
  createTagSuggestionSchema,
  tagSchema,
  tagSuggestionResponseSchema,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRole } from '../../lib/guards.js';
import { listActiveTags, suggestTag } from './tags.service.js';

/** A vendor may propose this many new tags per hour. */
const SUGGESTION_RATE_LIMIT = { max: 10, timeWindow: '1 hour' } as const;

export const tagRoutes: FastifyPluginAsyncZod = async (app) => {
  const vendorOnly = requireRole('vendor');

  app.get('/tags', { schema: { response: { 200: z.array(tagSchema) } } }, async () =>
    listActiveTags(app.db),
  );

  /*
   * There is deliberately **no `PUT /vendor/tags`** (#405). A vendor's tag
   * selection is written by `POST`/`PUT /vendor/profile`, in the same
   * transaction as the row it belongs to, because the storefront editor saves
   * both in one action and a tag write that could fail on its own left the
   * profile edit standing with nothing to undo it. A second endpoint here
   * would be a second write path to that state, and — being one request of its
   * own — necessarily the non-transactional one.
   */

  app.post(
    '/tags/suggest',
    {
      preHandler: vendorOnly,
      // Keyed by account rather than IP: the limit is about one vendor
      // flooding the review queue, not about traffic from one network.
      config: {
        rateLimit: {
          ...SUGGESTION_RATE_LIMIT,
          keyGenerator: (request: { auth: { id: string } | null; ip: string }) =>
            request.auth?.id ?? request.ip,
        },
      },
      schema: {
        body: createTagSuggestionSchema,
        response: { 200: tagSuggestionResponseSchema },
      },
    },
    async (request) => suggestTag(app.db, assertRole(request.auth, ['vendor']).id, request.body),
  );
};
