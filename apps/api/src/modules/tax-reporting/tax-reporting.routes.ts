import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { assertRole, requireRoleBeforeValidation } from '../../lib/guards.js';
import { requireStepUp } from '../../lib/step-up.js';
import { insertAdminAction } from '../admin/admin.dao.js';
import { withinDestructiveCeiling } from '../admin/admin-step-up.service.js';
import { bookingContextFor } from '../payments/payments.service.js';
import {
  render1099kCsv,
  sha256Hex,
  taxYearFigures,
  taxYearsWithSettledBookings,
} from './tax-reporting.service.js';

const yearQuerySchema = z.object({ year: z.coerce.number().int().min(2020).max(2100) });

/**
 * The January 1099-K download (VEN-722, D49): admin only, behind a fresh
 * step-up and the hourly export ceiling, because it hands out every vendor's
 * tax figures. Each download writes its audit row *before* the file is
 * returned, so a file that could not be logged is never handed over.
 */
export const taxReportingRoutes: FastifyPluginAsyncZod<{ webOrigin: string }> = async (
  app,
  options,
) => {
  const adminOnly = requireRoleBeforeValidation('admin');

  app.get('/admin/tax/years', { onRequest: adminOnly }, async () => ({
    years: await taxYearsWithSettledBookings(app.db),
  }));

  app.get(
    '/admin/tax/1099-k.csv',
    { onRequest: [adminOnly, requireStepUp], schema: { querystring: yearQuerySchema } },
    async (request, reply) => {
      const adminId = assertRole(request.auth, ['admin']).id;
      const { year } = request.query;
      const ctx = bookingContextFor(app, app.log, options.webOrigin);

      const csv = await withinDestructiveCeiling(
        { db: app.db, log: ctx.log, alerts: ctx.alerts },
        adminId,
        app.clock(),
        async () => {
          const figures = await taxYearFigures(app.db, year);
          const body = render1099kCsv(figures);

          await insertAdminAction(app.db, {
            actorId: adminId,
            action: 'tax_report_exported',
            subjectType: 'user',
            subjectId: adminId,
            detail: { taxYear: year, rowCount: figures.length, sha256: sha256Hex(body) },
            createdAt: app.clock(),
          });

          return body;
        },
      );

      return reply
        .type('text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="1099-k-${year}.csv"`)
        .header('cache-control', 'no-store')
        .send(csv);
    },
  );
};
