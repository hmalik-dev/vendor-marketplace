import { isIP } from 'node:net';
import type { FastifyRequest } from 'fastify';
import type { AcceptanceContext } from './terms.service.js';

/** The record keeps what the browser said it was, bounded before the column. */
const MAX_USER_AGENT_LENGTH = 500;

/**
 * What the request carried, for the record rather than for any decision — and
 * read from the request that carried the **act**, never from an earlier one in
 * the same flow. That is the whole reason these two columns exist, and it is
 * quietly easy to lose when a write moves to a different handler.
 *
 * Stated once because both acceptance routes need it and both bounds are
 * security invariants rather than tidiness:
 *
 * **`request.ip` is not an address.** The server trusts one forwarded hop on a
 * deployment (`server.ts`), and `X-Forwarded-For` is split and trimmed without
 * being parsed — so whatever text sits at that hop arrives here. Over 45
 * characters it fails `legal_acceptances.ip` with a Postgres 22001, which turns
 * accepting into a 500 whose driver error carries every bound parameter into
 * the log. `isIP` stops that, and stops a shorter forgery being filed as
 * evidence at the same time: what is not an address is recorded as no address
 * rather than as a string somebody chose.
 *
 * The agent is bounded for the same reason in the other direction — it is
 * attacker-controlled free text on its way to a column that can never be
 * edited afterwards.
 */
export function acceptanceContext(request: FastifyRequest): AcceptanceContext {
  return {
    ip: isIP(request.ip) ? request.ip : null,
    userAgent: request.headers['user-agent']?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
  };
}
