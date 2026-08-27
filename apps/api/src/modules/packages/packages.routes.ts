import {
  createServicePackageSchema,
  reorderServicePackagesSchema,
  servicePackageSchema,
  updateServicePackageSchema,
  uuidSchema,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { assertRole, requireRole } from '../../lib/guards.js';
import {
  createPackage,
  listOwnPackages,
  reorderPackages,
  updatePackage,
} from './packages.service.js';

const PACKAGES_PATH = '/vendor/packages';

const packageParamsSchema = z.object({ packageId: uuidSchema });

const packageListSchema = z.array(servicePackageSchema);

export const packageRoutes: FastifyPluginAsyncZod = async (app) => {
  const vendorOnly = requireRole('vendor');

  app.get(
    PACKAGES_PATH,
    { preHandler: vendorOnly, schema: { response: { 200: packageListSchema } } },
    async (request) => listOwnPackages(app.db, assertRole(request.auth, ['vendor']).id),
  );

  app.post(
    PACKAGES_PATH,
    {
      preHandler: vendorOnly,
      schema: { body: createServicePackageSchema, response: { 201: servicePackageSchema } },
    },
    async (request, reply) => {
      const created = await createPackage(
        app.db,
        assertRole(request.auth, ['vendor']).id,
        request.body,
      );

      return reply.status(201).header('location', `${PACKAGES_PATH}/${created.id}`).send(created);
    },
  );

  /*
   * Declared before `/:packageId` so the literal segment wins the match — a
   * reorder is not a package id, and Fastify would otherwise 400 on the uuid
   * check before this handler ever ran.
   */
  app.put(
    `${PACKAGES_PATH}/reorder`,
    {
      preHandler: vendorOnly,
      schema: { body: reorderServicePackagesSchema, response: { 200: packageListSchema } },
    },
    async (request) =>
      reorderPackages(app.db, assertRole(request.auth, ['vendor']).id, request.body),
  );

  app.put(
    `${PACKAGES_PATH}/:packageId`,
    {
      preHandler: vendorOnly,
      schema: {
        params: packageParamsSchema,
        body: updateServicePackageSchema,
        response: { 200: servicePackageSchema },
      },
    },
    async (request) =>
      updatePackage(
        app.db,
        assertRole(request.auth, ['vendor']).id,
        request.params.packageId,
        request.body,
      ),
  );
};
