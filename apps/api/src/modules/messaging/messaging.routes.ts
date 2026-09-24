import {
  conversationSummarySchema,
  MESSAGE_PAGE_SIZE,
  notificationItemSchema,
  openConversationSchema,
  openedConversationSchema,
  cursorPageSchema,
  cursorQuerySchema,
  sendMessageResultSchema,
  sendMessageSchema,
  streamTicketSchema,
  uuidSchema,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { AppError, tooManyRequests, unauthorized } from '../../lib/errors.js';
import {
  authenticated,
  requireAuth,
  requireAuthBeforeValidation,
  requireRoleBeforeValidation,
} from '../../lib/guards.js';
import { perAccountRateLimit } from '../../lib/rate-limit.js';
import { resolveStreamSubject } from '../users/users.service.js';
import {
  listConversations,
  listMessages,
  listNotifications,
  openConversation,
  readAllNotifications,
  readConversation,
  readNotification,
  sendMessage,
} from './messaging.service.js';

/**
 * Pulls the stream ticket out of the URL.
 *
 * Read by hand rather than through a Zod query schema because the stream
 * writes its own headers straight to the socket and never reaches the
 * serializer; the route is outside the type provider's normal path for the
 * same reason the CORS headers are set here by hand.
 */
export function readStreamTicket(url: string): string | null {
  const separator = url.indexOf('?');

  if (separator === -1) {
    return null;
  }

  const ticket = new URLSearchParams(url.slice(separator + 1)).get('ticket')?.trim();

  return ticket ? ticket : null;
}

const conversationParamsSchema = z.object({ conversationId: uuidSchema });
const notificationParamsSchema = z.object({ notificationId: uuidSchema });

const NOTIFICATION_PAGE_SIZE = 20;

/** Kept well under any proxy's idle timeout, which is what drops a stream. */
const HEARTBEAT_MS = 30_000;

export interface MessagingRoutesOptions {
  /** How often an open stream is kept alive and its account re-read. Defaults to {@link HEARTBEAT_MS}. */
  heartbeatMs?: number;
  /** Conversations one account may open per hour. */
  conversationRateLimitMax: number;
  /** Messages one account may send per minute. */
  messageRateLimitMax: number;
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

  /*
   * Opening a thread is a POST because it can create one, and it answers 201
   * or 200 on whether it did — the same distinction `POST /booking-requests`
   * draws, so a second click on `Send a message` is legible as "this is the
   * thread you already have" rather than as a duplicate.
   *
   * Customer-only, matching that sibling (#402). Under `requireAuth` the
   * caller became `conversations.customer_id`, so a vendor or an admin could
   * open a thread with any published vendor and write to them — the customer
   * side of a thread whose other party sees a first-name customer whose
   * `/customers/:id/profile` answers 404. There is no product surface that
   * offers it: `Send a message` lives on a vendor's public profile, which is a
   * customer's screen.
   */
  app.post(
    '/conversations',
    {
      // `preParsing`, not `onRequest`: see the messages route below.
      preParsing: requireRoleBeforeValidation('customer'),
      config: { rateLimit: perAccountRateLimit(options.conversationRateLimitMax, '1 hour') },
      schema: {
        body: openConversationSchema,
        response: { 200: openedConversationSchema, 201: openedConversationSchema },
      },
    },
    async (request, reply) => {
      const { conversation, created } = await openConversation(
        app.db,
        authenticated(request.auth),
        request.body.vendorSlug,
      );

      if (created) {
        return reply
          .status(201)
          .header('location', `${app.prefix}/conversations/${conversation.id}`)
          .send(conversation);
      }

      return reply.status(200).send(conversation);
    },
  );

  app.get(
    '/conversations/:conversationId/messages',
    {
      onRequest: requireAuthBeforeValidation,
      schema: {
        params: conversationParamsSchema,
        querystring: cursorQuerySchema,
        response: { 200: cursorPageSchema(sendMessageResultSchema) },
      },
    },
    async (request) =>
      listMessages(
        app.db,
        authenticated(request.auth),
        request.params.conversationId,
        request.query.before,
        MESSAGE_PAGE_SIZE,
      ),
  );

  app.post(
    '/conversations/:conversationId/messages',
    {
      // `preParsing`, not `onRequest`: the route's own limiter is appended to
      // `onRequest`, so a guard there would refuse anonymous callers before
      // they were counted. `preParsing` runs after the limiter and still ahead
      // of the body parser and of validation.
      preParsing: requireAuthBeforeValidation,
      config: { rateLimit: perAccountRateLimit(options.messageRateLimitMax, '1 minute') },
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
        request.log,
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
      onRequest: requireAuthBeforeValidation,
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
      onRequest: requireAuthBeforeValidation,
      schema: {
        querystring: cursorQuerySchema,
        response: { 200: cursorPageSchema(notificationItemSchema) },
      },
    },
    async (request) =>
      listNotifications(
        app.db,
        authenticated(request.auth),
        request.query.before,
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
      onRequest: requireAuthBeforeValidation,
      schema: { params: notificationParamsSchema, response: { 204: z.null() } },
    },
    async (request, reply) => {
      await readNotification(app.db, authenticated(request.auth), request.params.notificationId);

      return reply.status(204).send(null);
    },
  );

  /**
   * Exchanges the session for a ticket that authenticates one stream.
   *
   * This request carries its credential in a header like every other, and the
   * ticket it answers with is opaque, single-use and dead in a minute — so the
   * value that ends up in the stream URL, and therefore in access logs,
   * browser history and `Referer`, is worth nothing to whoever finds it.
   *
   * POST rather than GET because the exchange has a side effect and must not
   * be replayed from a cache. It answers 200 with no `Location`, per
   * `api-layering.md`: this is a POST-as-action, not a POST that creates an
   * addressable resource — a ticket has no URL of its own and is spent once.
   */
  app.post(
    '/events/stream-ticket',
    { preHandler: requireAuth, schema: { response: { 200: streamTicketSchema } } },
    async (request) => {
      const user = authenticated(request.auth);

      return app.streamTickets.issue(user.id);
    },
  );

  /**
   * The single event stream, carrying both message and notification events.
   *
   * `EventSource` cannot send an `Authorization` header, so something has to
   * travel in the URL. It is a stream ticket rather than the session JWT:
   * #215 found 27 live session tokens in one lane's dev log, written there by
   * the request logger from this very route. A ticket names one user, is spent
   * on first use, and expires in a minute.
   *
   * Deliberately not `requireAuth` — the whole point is that this route does
   * not accept a session token in its URL. A ticket is the only way in.
   */
  app.get('/events/stream', async (request, reply) => {
    const ticket = readStreamTicket(request.url);
    const userId = ticket ? await app.streamTickets.consume(ticket) : null;

    if (!userId) {
      throw unauthorized('This stream ticket is missing, spent, or expired');
    }

    /*
     * The admission decision `requireAuth` would have made, made in the
     * service instead — a ban landing between issue and connect must not be
     * ignored, because a stream, once open, stays open.
     */
    let aborted = request.raw.destroyed;
    request.raw.once('close', () => {
      aborted = true;
    });

    const user = await resolveStreamSubject(app.db, userId);

    // The client left during that await: there is nobody to stream to, and a
    // subscription or heartbeat made now would never see a `close` to end it.
    if (aborted) {
      return reply;
    }

    // Echoed only when it is on the list, never reflected blindly.
    const origin = request.headers.origin;
    const allowed = origin && options.allowedOrigins.includes(origin) ? origin : null;

    // Before the headers, so the refusal is a plain 429 the client backs off from.
    const openedAt = new Date();
    const unsubscribe = app.events.subscribe(user.id, reply.raw);

    if (!unsubscribe) {
      throw tooManyRequests('Too many live streams are open for this account');
    }

    try {
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
    } catch (error) {
      // The close handler below is not attached yet: free the slot here.
      unsubscribe();
      throw error;
    }

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        unsubscribe();
        return;
      }

      /*
       * The account is re-read every beat, so a ban or deletion made through
       * another API instance — which `closeFor` cannot reach — still ends this
       * stream within one heartbeat. Only a refusal ends it: a database that
       * blinks must not drop every open tab.
       */
      resolveStreamSubject(app.db, user.id, openedAt).catch((error: unknown) => {
        if (error instanceof AppError) {
          clearInterval(heartbeat);
          unsubscribe();
          reply.raw.end();
        }
      });
    }, options.heartbeatMs ?? HEARTBEAT_MS);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });

    // Never resolves: returning would let Fastify end the response.
    return new Promise<void>(() => {});
  });
};
