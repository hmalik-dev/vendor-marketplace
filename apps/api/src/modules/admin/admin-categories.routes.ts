import { z } from 'zod';
import {
  adminCategoryListSchema,
  adminCategoryRowSchema,
  reorderCategoriesSchema,
  setCategoryActiveSchema,
} from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRoleBeforeValidation } from '../../lib/guards.js';
import {
  listAdminCategories,
  reorderCategories,
  setCategoryActive,
} from './admin-categories.service.js';

const categoryParamsSchema = z.object({ categoryId: z.uuid() });

/**
 * Category management (VEN-401): whether each category is offered, and its order.
 *
 * A plugin of its own beside `adminRoutes`, under the same rule as every route
 * there — `admin` only, checked on `onRequest` so a wrong-role caller is refused
 * before validation and never learns the body's shape from a 400. There is no
 * create or rename: names and slugs belong to `CATEGORY_SEEDS`.
 */
export const adminCategoryRoutes: FastifyPluginAsyncZod = async (app) => {
  const adminOnly = requireRoleBeforeValidation('admin');

  app.get(
    '/admin/categories',
    { onRequest: adminOnly, schema: { response: { 200: adminCategoryListSchema } } },
    async () => listAdminCategories(app.db),
  );

  app.put(
    '/admin/categories/order',
    {
      onRequest: adminOnly,
      schema: { body: reorderCategoriesSchema, response: { 200: adminCategoryListSchema } },
    },
    async (request) =>
      reorderCategories(app.db, assertRole(request.auth, ['admin']).id, request.body),
  );

  app.put(
    '/admin/categories/:categoryId',
    {
      onRequest: adminOnly,
      schema: {
        params: categoryParamsSchema,
        body: setCategoryActiveSchema,
        response: { 200: adminCategoryRowSchema },
      },
    },
    async (request) =>
      setCategoryActive(
        app.db,
        assertRole(request.auth, ['admin']).id,
        request.params.categoryId,
        request.body.isActive,
      ),
  );
};
