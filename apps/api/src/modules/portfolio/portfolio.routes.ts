import {
  createPortfolioItemSchema,
  portfolioItemSchema,
  reorderPortfolioSchema,
  updatePortfolioItemSchema,
  uuidSchema,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRole } from '../../lib/guards.js';
import {
  addPortfolioItem,
  listOwnPortfolio,
  removePortfolioItem,
  reorderPortfolio,
  updatePortfolioItem,
} from './portfolio.service.js';

const PORTFOLIO_PATH = '/vendor/portfolio';

const portfolioParamsSchema = z.object({ itemId: uuidSchema });

const portfolioListSchema = z.array(portfolioItemSchema);

export const portfolioRoutes: FastifyPluginAsyncZod = async (app) => {
  const vendorOnly = requireRole('vendor');

  app.get(
    PORTFOLIO_PATH,
    { preHandler: vendorOnly, schema: { response: { 200: portfolioListSchema } } },
    async (request) => listOwnPortfolio(app.db, assertRole(request.auth, ['vendor']).id),
  );

  app.post(
    PORTFOLIO_PATH,
    {
      preHandler: vendorOnly,
      schema: { body: createPortfolioItemSchema, response: { 201: portfolioItemSchema } },
    },
    async (request, reply) => {
      const created = await addPortfolioItem(
        app.db,
        assertRole(request.auth, ['vendor']).id,
        request.body,
      );

      return reply.status(201).header('location', `${PORTFOLIO_PATH}/${created.id}`).send(created);
    },
  );

  /* Before `/:itemId`, so the literal segment is not read as a photo id. */
  app.put(
    `${PORTFOLIO_PATH}/reorder`,
    {
      preHandler: vendorOnly,
      schema: { body: reorderPortfolioSchema, response: { 200: portfolioListSchema } },
    },
    async (request) =>
      reorderPortfolio(app.db, assertRole(request.auth, ['vendor']).id, request.body),
  );

  app.patch(
    `${PORTFOLIO_PATH}/:itemId`,
    {
      preHandler: vendorOnly,
      schema: {
        params: portfolioParamsSchema,
        body: updatePortfolioItemSchema,
        response: { 200: portfolioItemSchema },
      },
    },
    async (request) =>
      updatePortfolioItem(
        app.db,
        assertRole(request.auth, ['vendor']).id,
        request.params.itemId,
        request.body,
      ),
  );

  app.delete(
    `${PORTFOLIO_PATH}/:itemId`,
    {
      preHandler: vendorOnly,
      schema: { params: portfolioParamsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      await removePortfolioItem(
        app.db,
        app.storage,
        assertRole(request.auth, ['vendor']).id,
        request.params.itemId,
        request.log,
      );

      return reply.status(204).send(null);
    },
  );
};
