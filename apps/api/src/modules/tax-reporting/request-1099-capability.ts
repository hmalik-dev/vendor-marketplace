import type { AppDatabase } from '../../lib/database.js';
import type { StripeConnectGateway } from '../../lib/stripe.js';
import { vendorStripeAccountIds } from './tax-reporting.dao.js';

export interface CapabilityBackfillResult {
  requested: number;
  already: number;
  failed: number;
}

/**
 * Requests the 1099-K capability on every existing vendor account (VEN-723,
 * D49), so their next visit to hosted onboarding collects the address and TIN.
 *
 * Idempotent: an account that already carries the capability is reported and
 * left alone, so a second run changes nothing. One line per account, and one
 * account Stripe refuses does not stop the rest; the caller exits non-zero when
 * any failed. A line names the connected account and the outcome, never a
 * vendor's details.
 */
export async function requestTaxCapabilityForVendors(
  db: AppDatabase,
  stripe: Pick<StripeConnectGateway, 'ensureTaxReportingCapability'>,
  print: (line: string) => void,
): Promise<CapabilityBackfillResult> {
  const result: CapabilityBackfillResult = { requested: 0, already: 0, failed: 0 };

  for (const accountId of await vendorStripeAccountIds(db)) {
    try {
      const outcome = await stripe.ensureTaxReportingCapability(accountId);

      result[outcome] += 1;
      print(`${accountId} ${outcome}`);
    } catch (error) {
      result.failed += 1;
      print(`${accountId} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return result;
}
