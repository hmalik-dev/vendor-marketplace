import type { FastifyInstance } from 'fastify';

/**
 * Keeps `application/json` bodies as strings for the plugin that registers it.
 *
 * Every webhook provider signs the **exact bytes** it sent, so a body Fastify
 * has already parsed into an object and would re-serialise is a body whose
 * signature can no longer be checked. Content type parsers are encapsulated per
 * plugin, so this affects only the webhook route that asks for it and no other
 * JSON route in the application.
 *
 * Shared by the Clerk and Stripe webhooks: the rule is one rule, and stating it
 * twice is how one of the two ends up quietly parsing its body again.
 */
export function keepRawJsonBody(app: FastifyInstance): void {
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    done(null, body);
  });
}

/** The raw body a webhook route was given, or an empty string. */
export function rawBodyOf(body: unknown): string {
  return typeof body === 'string' ? body : '';
}
