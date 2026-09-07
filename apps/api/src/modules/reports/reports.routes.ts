import {
  createReportSchema,
  REPORT_RATE_LIMIT,
  reportReceiptSchema,
} from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authenticated, requireAuth } from '../../lib/guards.js';
import { generateSupportReference } from '../support/support.service.js';
import { createReport } from './reports.service.js';

export interface ReportRoutesOptions {
  /** `SUPPORT_EMAIL_TO`. Threaded in so the service never reads `process.env`. */
  supportEmailTo: string;
}

export const reportRoutes: FastifyPluginAsyncZod<ReportRoutesOptions> = async (app, options) => {
  app.post(
    '/reports',
    {
      /*
       * **Authenticated, unlike `/support/messages`.** That form is deliberately
       * open because the visitor most likely to need it is the one who cannot
       * get in; this control is the opposite. A report accuses somebody, and an
       * anonymous accusation is one an operator cannot weigh, cannot follow up
       * and cannot rate limit to a person rather than to a coffee shop's IP.
       */
      preHandler: requireAuth,
      config: {
        rateLimit: {
          ...REPORT_RATE_LIMIT,
          /*
           * By account and only by account. `requireAuth` has already run, so
           * there is no anonymous caller to fall back to an IP for — and
           * falling back would let a shared office address spend one person's
           * allowance on everybody behind it.
           */
          keyGenerator: (request: { auth: { id: string } | null; ip: string }) =>
            request.auth?.id ?? request.ip,
        },
      },
      schema: {
        body: createReportSchema,
        response: { 200: reportReceiptSchema },
      },
    },
    /*
     * 200, not 201. A report creates a case, and the reporter cannot address
     * it: the queue is the operator's screen and there is nothing here for a
     * `Location` to point at. The same call `/support/messages` makes, for the
     * same reason, and the dialog says as much in words.
     */
    async (request) =>
      createReport(
        {
          db: app.db,
          email: app.email,
          log: request.log,
          to: options.supportEmailTo,
        },
        authenticated(request.auth),
        request.body,
        generateSupportReference(),
        app.clock(),
      ),
  );
};
