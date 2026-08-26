import { asc, eq } from 'drizzle-orm';
import { categories } from '@vendorhub/db/schema';
import { categorySchema } from '@vendorhub/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

/**
 * The selectable service categories. Public and read-only — the list is
 * reference data owned by the seed script, so there is no write surface here.
 */
export const categoryRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/categories',
    { schema: { response: { 200: z.array(categorySchema) } } },
    async () =>
      app.db
        .select()
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.displayOrder)),
  );
};
