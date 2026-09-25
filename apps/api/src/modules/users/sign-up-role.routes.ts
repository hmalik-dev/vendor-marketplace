import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { SIGN_UP_ROLES } from '@vendor-marketplace/shared';
import { requireWebTierKey } from '../../lib/web-tier-key.js';
import {
  forgetUnverifiedSignUpRole,
  markSignUpRoleVerified,
  recordSignUpRole,
} from './sign-up-roles.dao.js';

export interface SignUpRoleRoutesOptions {
  /** `WEB_TIER_KEY`. Unset (local only) and the route does not exist. */
  webTierKey: string | undefined;
}

/**
 * Stores the role chosen on `/sign-up` against the identity the provider just
 * created (VEN-662): the web tier's auth proxy calls this once `sign-up/email`
 * succeeds, because Neon Auth carries no custom field on the identity itself.
 * Same trust model as `/internal/session-generation` — only the web tier may
 * call it, proved with the shared key. A repeat for the same identity answers
 * 200 and changes nothing: the first choice stands.
 */
export const signUpRoleRoutes: FastifyPluginAsyncZod<SignUpRoleRoutesOptions> = async (
  app,
  options,
) => {
  app.post(
    '/internal/sign-up-role',
    {
      config: { rateLimit: false },
      bodyLimit: 1_024,
      onRequest: requireWebTierKey(options.webTierKey),
      schema: {
        body: z.object({ authUserId: z.string().min(1), role: z.enum(SIGN_UP_ROLES) }),
        response: { 200: z.object({ recorded: z.literal(true) }) },
      },
    },
    async (request) => {
      await recordSignUpRole(app.db, request.body.authUserId, request.body.role);

      return { recorded: true as const };
    },
  );

  /**
   * Marks the role recorded for an identity whose sign-up code was just
   * accepted (VEN-756): the proxy calls this once `email-otp/verify-email`
   * succeeds. A squatter never holds the code, so a verified choice was made
   * by whoever reads the inbox and survives a later reset. An unknown id
   * answers the same.
   */
  app.post(
    '/internal/sign-up-role/verified',
    {
      config: { rateLimit: false },
      bodyLimit: 1_024,
      onRequest: requireWebTierKey(options.webTierKey),
      schema: {
        body: z.object({ authUserId: z.string().min(1) }),
        response: { 200: z.object({ verified: z.literal(true) }) },
      },
    },
    async (request) => {
      await markSignUpRoleVerified(app.db, request.body.authUserId);

      return { verified: true as const };
    },
  );

  /**
   * Forgets the role recorded for an identity whose password was just reset
   * (VEN-663). Whoever signed the address up first chose that role; unless the
   * address verified it (VEN-756), the reset is the holder's first proof of
   * the address, so the choice made with the old password may not be theirs.
   * An unknown id answers the same.
   */
  app.delete(
    '/internal/sign-up-role',
    {
      config: { rateLimit: false },
      bodyLimit: 1_024,
      onRequest: requireWebTierKey(options.webTierKey),
      schema: {
        body: z.object({ authUserId: z.string().min(1) }),
        response: { 200: z.object({ forgotten: z.literal(true) }) },
      },
    },
    async (request) => {
      await forgetUnverifiedSignUpRole(app.db, request.body.authUserId);

      return { forgotten: true as const };
    },
  );
};
