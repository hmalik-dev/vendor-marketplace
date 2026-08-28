import {
  conversationSummarySchema,
  notificationItemSchema,
  paginatedSchema,
  paginationQuerySchema,
  sendMessageResultSchema,
  sendMessageSchema,
  uuidSchema,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authenticated, requireAuth } from '../../lib/guards.js';
import {
  listConversations,
  listMessages,
  listNotifications,
  readAllNotifications,
  readConversation,
  readNotification,
  sendMessage,
} from './messaging.service.js';

const conversationParamsSchema = z.object({ conversationId: uuidSchema });
const notificationParamsSchema = z.object({ notificationId: uuidSchema });

/** A thread page. Larger than the default: a conversation is read in bulk. */
const MESSAGE_PAGE_SIZE = 50;
const NOTIFICATION_PAGE_SIZE = 20;

/** Kept well under any proxy's idle timeout, which is what drops a stream. */
const HEARTBEAT_MS = 30_000;

export interface MessagingRoutesOptions {
  /**
   * The CORS allow-list, passed in rather than read from a hook.
   *
   * The stream writes its headers straight to the socket, which is the only
   * way to keep a connection open — and that bypasses `@fastify/cors`'s
   * `onSend` hook entirely, so the browser saw no `Access-Control-Allow-Origin`
   * and refused every connection. The same list the plugin gets is applied
   * here by hand.
   */
  allowedOrigins: readonly string[];
}

export const messagingRoutes: FastifyPluginAsyncZod<MessagingRoutesOptions> = async (
  app,
  options,
) => {
  app.get(
    '/conversations',
    { preHandler: requireAuth, schema: { response: { 200: z.array(conversationSummarySchema) } } },
    async (request) => listConversations(app.db, authenticated(request.auth)),
  );

  app.get(
    '/conversations/:conversationId/messages',
    {
      preHandler: requireAuth,
      schema: {
        params: conversationParamsSchema,
        querystring: paginationQuerySchema,
        response: { 200: paginatedSchema(sendMessageResultSchema) },
      },
    },
    async (request) =>
      listMessages(
        app.db,
        authenticated(request.auth),
        request.params.conversationId,
        request.query.page,
        MESSAGE_PAGE_SIZE,
      ),
  );

  app.post(
    '/conversations/:conversationId/messages',
    {
      preHandler: requireAuth,
      schema: {
        params: conversationParamsSchema,
        body: sendMessageSchema,
        response: { 201: sendMessageResultSchema },
      },
    },
    async (request, reply) => {
      const created = await sendMessage(
        app.db,
        app.events,
        authenticated(request.auth),
        request.params.conversationId,
        request.body.content,
      );

      return reply.status(201).send(created);
    },
  );

  app.put(
    '/conversations/:conversationId/read',
    {
      preHandler: requireAuth,
      schema: { params: conversationParamsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      await readConversation(app.db, authenticated(request.auth), request.params.conversationId);

      return reply.status(204).send(null);
    },
  );

  app.get(
    '/notifications',
    {
      preHandler: requireAuth,
      schema: {
        querystring: paginationQuerySchema,
        response: { 200: paginatedSchema(notificationItemSchema) },
      },
    },
    async (request) =>
      listNotifications(
        app.db,
        authenticated(request.auth),
        request.query.page,
        NOTIFICATION_PAGE_SIZE,
      ),
  );

  /*
   * Declared before `/notifications/:notificationId/read` so the literal
   * segment wins the match — "read-all" is not a uuid and the param schema
   * would 400 on it first.
   */
  app.put(
    '/notifications/read-all',
    { preHandler: requireAuth, schema: { response: { 204: z.null() } } },
    async (request, reply) => {
      await readAllNotifications(app.db, authenticated(request.auth));

      return reply.status(204).send(null);
    },
  );

  app.put(
    '/notifications/:notificationId/read',
    {
      preHandler: requireAuth,
      schema: { params: notificationParamsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      await readNotification(app.db, authenticated(request.auth), request.params.notificationId);

      return reply.status(204).send(null);
    },
  );

  /**
   * The single event stream, carrying both message and notification events.
   *
   * `EventSource` cannot send an `Authorization` header, so the token arrives
   * in the query string — which is why this route resolves the caller through
   * the same auth plugin rather than trusting the parameter. A token in a URL
   * is visible in logs, so it is short-lived by Clerk's own design and the
   * stream carries no data the socket did not already earn.
   */
  app.get('/events/stream', { preHandler: requireAuth }, async (request, reply) => {
    const user = authenticated(request.auth);

    // Echoed only when it is on the list, never reflected blindly.
    const origin = request.headers.origin;
    const allowed = origin && options.allowedOrigins.includes(origin) ? origin : null;

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
      // Nginx and friends buffer by default, which holds every frame back.
      'x-accel-buffering': 'no',
      ...(allowed
        ? {
            'access-control-allow-origin': allowed,
            'access-control-allow-credentials': 'true',
            vary: 'Origin',
          }
        : {}),
    });

    // An immediate comment flushes the headers, so the client's `onopen`
    // fires now rather than whenever the first real event happens to arrive.
    reply.raw.write(': connected\n\n');

    const unsubscribe = app.events.subscribe(user.id, reply.raw);

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        unsubscribe();
      }
    }, HEARTBEAT_MS);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });

    // Never resolves: returning would let Fastify end the response.
    return new Promise<void>(() => {});
  });
};
