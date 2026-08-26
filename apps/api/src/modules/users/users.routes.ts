import { updateUserSchema, userSchema } from '@vendorhub/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authenticated, requireAuth } from '../../lib/guards.js';
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
      preHandler: requireAuth,
      schema: { body: updateUserSchema, response: { 200: userSchema } },
    },
    async (request) => updateUserProfile(app.db, authenticated(request.auth).id, request.body),
  );
};
