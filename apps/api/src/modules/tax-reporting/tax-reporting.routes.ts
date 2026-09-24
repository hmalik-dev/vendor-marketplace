import {
  adminVendorBackupWithholdingResultSchema,
  setVendorBackupWithholdingSchema,
} from '@vendor-marketplace/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { assertRole, requireRoleBeforeValidation } from '../../lib/guards.js';
import { requireStepUp } from '../../lib/step-up.js';
import { insertAdminAction } from '../admin/admin.dao.js';
import { withinDestructiveCeiling } from '../admin/admin-step-up.service.js';
import { bookingContextFor } from '../payments/payments.service.js';
import { setVendorBackupWithholding } from './backup-withholding.service.js';
import {
  backupWithheldByYear,
  render1099kCsv,
  sha256Hex,
  taxYearFigures,
  taxYearsWithSettledBookings,
  vendorStatementFor,
  vendorTaxYearsFor,
} from './tax-reporting.service.js';

const vendorParamsSchema = z.object({ vendorId: z.uuid() });
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
    backupWithheld: await backupWithheldByYear(app.db),
  }));

  /*
   * The vendor's own yearly statement (VEN-725). The vendor is always the
   * caller's own profile: no id is read from the request, so there is nothing
   * to tamper with, and an admin or customer is refused before validation.
   */
  const vendorOnly = requireRoleBeforeValidation('vendor');

  app.get('/vendor/tax/years', { onRequest: vendorOnly }, async (request) => ({
    years: await vendorTaxYearsFor(app.db, assertRole(request.auth, ['vendor']).id),
  }));

  app.get(
    '/vendor/tax/statement.csv',
    { onRequest: vendorOnly, schema: { querystring: yearQuerySchema } },
    async (request, reply) => {
      const { year } = request.query;

      return reply
        .type('text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="statement-${year}.csv"`)
        .header('cache-control', 'no-store')
        .send(await vendorStatementFor(app.db, assertRole(request.auth, ['vendor']).id, year));
    },
  );

  /**
   * Switches backup withholding on or off for one vendor (VEN-723, D49). Behind
   * a fresh step-up and the hourly ceiling like the other irreversible admin
   * actions: it decides how much of a vendor's money leaves for the IRS, and
   * clearing it stops that.
   */
  app.put(
    '/admin/vendors/:vendorId/backup-withholding',
    {
      onRequest: [adminOnly, requireStepUp],
      schema: {
        params: vendorParamsSchema,
        body: setVendorBackupWithholdingSchema,
        response: { 200: adminVendorBackupWithholdingResultSchema },
      },
    },
    async (request) => {
      const adminId = assertRole(request.auth, ['admin']).id;
      const ctx = bookingContextFor(app, app.log, options.webOrigin);

      return withinDestructiveCeiling(
        { db: app.db, log: ctx.log, alerts: ctx.alerts },
        adminId,
        app.clock(),
        () =>
          setVendorBackupWithholding(
            app.db,
            adminId,
            request.params.vendorId,
            request.body,
            app.clock(),
          ),
      );
    },
  );

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
