import { Webhook } from 'svix';
import type { FastifyRequest } from 'fastify';
import { unauthorized, validationFailed } from '../../lib/errors.js';
import { rawBodyOf } from './raw-body.js';

/** Verifies a svix signature over the raw request body. */
export type WebhookVerifier = (payload: string, headers: Record<string, string>) => unknown;

const SVIX_HEADERS = ['svix-id', 'svix-timestamp', 'svix-signature'] as const;

/**
 * The verifier a svix-signed webhook route uses, built once per plugin.
 *
 * Once, not per request: `new Webhook(secret)` parses and base64-decodes the
 * signing key, and the secret cannot change while the process runs. The
 * override is the route suites' seam, so they need no real svix secret.
 */
export function svixVerifier(signingSecret: string, override?: WebhookVerifier): WebhookVerifier {
  if (override) {
    return override;
  }

  const webhook = new Webhook(signingSecret);

  return (payload, headers) => webhook.verify(payload, headers);
}

/**
 * The body of a svix-signed webhook, verified and parsed — **the one place
 * either provider's signature is checked**.
 *
 * Clerk and Resend both sign with svix, and this was written out twice before
 * #439: the same three headers, the same verify, the same JSON parse, the same
 * two `AppError`s, differing only in a log word. That is the shape `raw-body.ts`
 * beside it already warns about — the rule is one rule, and stating it twice is
 * how one of the two quietly stops enforcing it. Header handling and
 * signature-failure semantics now change in one file or in neither.
 *
 * Returns `unknown`: the *shape* of a payload is each provider's own contract,
 * so each route runs its own Zod schema over what comes back.
 */
export function verifiedSvixBody(
  request: FastifyRequest,
  verify: WebhookVerifier,
  /** The provider's name, for the rejection log line only. */
  provider: string,
): unknown {
  const rawBody = rawBodyOf(request.body);

  const headers: Record<string, string> = {};
  for (const name of SVIX_HEADERS) {
    const value = request.headers[name];
    if (typeof value !== 'string') {
      throw unauthorized('Webhook signature headers are missing');
    }
    headers[name] = value;
  }

  try {
    verify(rawBody, headers);
  } catch (error) {
    request.log.warn({ err: error }, `Rejected a ${provider} webhook with an invalid signature`);
    throw unauthorized('Webhook signature verification failed');
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw validationFailed('Webhook body is not valid JSON');
  }
}
