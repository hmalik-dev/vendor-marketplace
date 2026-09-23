import { updateUserSchema, userSchema } from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authenticated, requireAuth, requireAuthBeforeValidation } from '../../lib/guards.js';
import { getUserProfile, updateUserProfile } from './users.service.js';

export const userRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/users/me',
    { preHandler: requireAuth, schema: { response: { 200: userSchema } } },
    async (request) => getUserProfile(app.db, authenticated(request.auth).id),
  );

  app.put(
    '/users/me',
    {
      onRequest: requireAuthBeforeValidation,
      schema: { body: updateUserSchema, response: { 200: userSchema } },
    },
    async (request) => {
      const user = authenticated(request.auth);

      return updateUserProfile(app.db, user.id, request.body, app.storagePublicUrl, {
        authUserId: user.authUserId,
        directory: app.authDirectory,
        log: request.log,
      });
    },
  );
};
