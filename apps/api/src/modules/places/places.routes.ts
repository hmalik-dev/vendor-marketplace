import { placeSearchQuerySchema, placeSuggestionListSchema } from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { findPlaceSuggestions } from './places.dao.js';

/**
 * The `City` typeahead's suggestion source (#384).
 *
 * **Its own module, not `/vendors/cities`, and the distinction is the ticket.**
 * The old endpoint answered "where do we have vendors" — inventory, preloaded
 * whole on every page. This one answers "what places exist in the United
 * States", which is a question about the country and not about us. Nothing here
 * touches `vendor_profiles`, and no count of anything is returned: the user's
 * instruction was *"Do not preload and indicate how many vendors are in each
 * city."*
 *
 * Public and read-only, like `/categories`. Deliberately **not** cached: the
 * answer is a function of what one customer is typing rather than reference
 * data every visitor shares, and a shared cache keyed on a query string that
 * changes per keystroke buys nothing.
 */
export const placeRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/places',
    {
      schema: {
        querystring: placeSearchQuerySchema,
        response: { 200: placeSuggestionListSchema },
      },
    },
    async (request) => findPlaceSuggestions(app.db, request.query.q),
  );
};
