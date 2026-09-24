import { createHash } from 'node:crypto';
import type { AppDatabase } from '../../lib/database.js';
import { settledBookings, type SettledBookingRow } from './tax-reporting.dao.js';

/** One vendor's Form 1099-K figures for a calendar year (D49), in cents. */
export interface TaxYearFigures {
  vendorId: string;
  stripeAccountId: string;
  /** Box 1a: the customers' full charges, before commission, refunds, netting and fees. */
  grossCents: number;
  /** Boxes 5a-5l: `grossCents` split by the UTC month of the settlement. */
  monthlyGrossCents: number[];
  /** Box 3: the number of settled bookings. */
  transactionCount: number;
}

/**
 * The Stripe tax-form import header for an Update (D49). The month columns,
 * `filing_requirement`, `form_type` and `federal_income_tax_withheld` are the
 * names Stripe documents; `gross_amount` and `payment_transaction_count` are
 * the 1099-K box columns, to be checked against a Dashboard export before the
 * first January import (VEN-657).
 */
export const TAX_1099K_HEADER = [
  'stripe_account_id',
  'form_type',
  'filing_requirement',
  'gross_amount',
  'payment_transaction_count',
  'federal_income_tax_withheld',
  'january_amount',
  'february_amount',
  'march_amount',
  'april_amount',
  'may_amount',
  'june_amount',
  'july_amount',
  'august_amount',
  'september_amount',
  'october_amount',
  'november_amount',
  'december_amount',
] as const;

/** Folds settled bookings into one figure per vendor, ordered by connected account id. */
export function foldTaxYearFigures(rows: readonly SettledBookingRow[]): TaxYearFigures[] {
  const byVendor = new Map<string, TaxYearFigures>();

  for (const row of rows) {
    const figures = byVendor.get(row.vendorId) ?? {
      vendorId: row.vendorId,
      stripeAccountId: row.stripeAccountId,
      grossCents: 0,
      monthlyGrossCents: Array.from({ length: 12 }, () => 0),
      transactionCount: 0,
    };

    figures.grossCents += row.totalAmountCents;
    figures.monthlyGrossCents[row.settledAt.getUTCMonth()]! += row.totalAmountCents;
    figures.transactionCount += 1;
    byVendor.set(row.vendorId, figures);
  }

  return [...byVendor.values()].sort((a, b) => a.stripeAccountId.localeCompare(b.stripeAccountId));
}

/** `taxYearFigures(vendorId, year)`: one vendor's figures, or every vendor's when omitted. */
export async function taxYearFigures(
  db: AppDatabase,
  year: number,
  vendorId?: string,
): Promise<TaxYearFigures[]> {
  return foldTaxYearFigures(await settledBookings(db, year, vendorId));
}

/** Whole dollars and cents, exactly: cents are integers, so no float ever appears. */
function dollars(cents: number): string {
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

/**
 * The file. Same rows in, same bytes out: rows are ordered by account id and
 * nothing in it depends on the clock. No tax ID, name or bank detail: Stripe
 * holds those, and an Update leaves the columns it is not sent as they are.
 * `federal_income_tax_withheld` is 0 until backup withholding lands (VEN-723).
 */
export function render1099kCsv(figures: readonly TaxYearFigures[]): string {
  const lines: string[] = [TAX_1099K_HEADER.join(',')];

  for (const row of figures) {
    lines.push(
      [
        row.stripeAccountId,
        'k',
        'REQUIRED_EVEN_IF_BELOW_THRESHOLD',
        dollars(row.grossCents),
        row.transactionCount,
        dollars(0),
        ...row.monthlyGrossCents.map(dollars),
      ].join(','),
    );
  }

  return `${lines.join('\n')}\n`;
}

export const sha256Hex = (text: string): string => createHash('sha256').update(text).digest('hex');

export { taxYearsWithSettledBookings } from './tax-reporting.dao.js';
