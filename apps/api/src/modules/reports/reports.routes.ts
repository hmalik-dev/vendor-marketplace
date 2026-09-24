import { clientAddress } from '../../lib/client-address.js';
import {
  createReportSchema,
  REPORT_RATE_LIMIT,
  reportReceiptSchema,
} from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authenticated, requireAuthBeforeValidation } from '../../lib/guards.js';
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
       * anonymous accusation is one an admin cannot weigh, cannot follow up
       * and cannot rate limit to a person rather than to a coffee shop's IP.
       */
      // `preParsing`, not `onRequest`: the route's own limiter is appended to
      // `onRequest`, so a guard there would refuse anonymous callers before
      // they were counted. `preParsing` runs after the limiter and still ahead
      // of the body parser and of validation.
      preParsing: requireAuthBeforeValidation,
      config: {
        rateLimit: {
          ...REPORT_RATE_LIMIT,
          /*
           * By account, and by address only for a caller the guard is about to
           * refuse: the limiter runs first, so a signed-out caller is counted
           * (and stops at the limit) before it is answered 401. A signed-in
           * caller is never keyed by address, so a shared office address cannot
           * spend one person's allowance on everybody behind it.
           */
          keyGenerator: (request: {
            auth: { id: string } | null;
            ip: string;
            headers: Record<string, string | string[] | undefined>;
          }) => request.auth?.id ?? clientAddress(request),
        },
      },
      schema: {
        body: createReportSchema,
        response: { 200: reportReceiptSchema },
      },
    },
    /*
     * 200, not 201. A report creates a case, and the reporter cannot address
     * it: the queue is the admin's screen and there is nothing here for a
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
          alerts: app.adminAlerts,
        },
        authenticated(request.auth),
        request.body,
        generateSupportReference(),
        app.clock(),
      ),
  );
};
