import {
  createTagSuggestionSchema,
  setVendorTagsSchema,
  tagSchema,
  tagSuggestionResponseSchema,
} from '@vendorhub/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRole } from '../../lib/guards.js';
import { listActiveTags, setVendorTags, suggestTag } from './tags.service.js';

/** A vendor may propose this many new tags per hour. */
const SUGGESTION_RATE_LIMIT = { max: 10, timeWindow: '1 hour' } as const;

export const tagRoutes: FastifyPluginAsyncZod = async (app) => {
  const vendorOnly = requireRole('vendor');

  app.get('/tags', { schema: { response: { 200: z.array(tagSchema) } } }, async () =>
    listActiveTags(app.db),
  );

  app.put(
    '/vendor/tags',
    {
      preHandler: vendorOnly,
      schema: { body: setVendorTagsSchema, response: { 200: z.array(tagSchema) } },
    },
    async (request) =>
      setVendorTags(app.db, assertRole(request.auth, ['vendor']).id, request.body.tagIds),
  );

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
    async (request) =>
      suggestTag(app.db, assertRole(request.auth, ['vendor']).id, request.body),
  );
};
