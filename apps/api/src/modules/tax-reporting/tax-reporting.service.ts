import { createHash } from 'node:crypto';
import type { AppDatabase } from '../../lib/database.js';
import { notFound } from '../../lib/errors.js';
import { findVendorProfileByUserId } from '../vendors/vendors.dao.js';
import {
  settledBookings,
  taxYearsWithSettledBookings,
  type SettledBookingRow,
} from './tax-reporting.dao.js';

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
export function foldTaxYearFigures(
  rows: readonly Pick<
    SettledBookingRow,
    'vendorId' | 'stripeAccountId' | 'totalAmountCents' | 'settledAt'
  >[],
): TaxYearFigures[] {
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
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
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

/**
 * The vendor's yearly statement columns (VEN-725): what stands between the
 * 1099-K gross and the bank. `backup_withholding` is 0 until VEN-723 lands.
 */
export const VENDOR_STATEMENT_HEADER = [
  'event_date',
  'booking_reference',
  'customer_charge',
  'refunded_to_customer',
  'commission',
  'debt_netted',
  'backup_withholding',
  'transferred',
  'transfer_date',
] as const;

/** `2026-03-14` to `03/14/2026`: American order, no clock or zone involved. */
function usDateFromIso(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
}

/** The instant's UTC calendar date, in American order. */
const usDateFromInstant = (at: Date): string => usDateFromIso(at.toISOString().slice(0, 10));

/** The first segment of the booking id: what the admin screens already call a booking. */
const bookingReference = (bookingId: string): string => bookingId.slice(0, 8);

/**
 * One vendor's statement for `year`: a row per booking `taxYearFigures` counts,
 * then a totals row. The totals row's charge comes from `foldTaxYearFigures`,
 * the function the 1099-K file is built from, so the two cannot drift.
 * The amount transferred is the stored payout less the debt netted, which is
 * what the sweep sends; charge less refunds less commission is that stored payout.
 */
export async function vendorStatementCsv(
  db: AppDatabase,
  vendorId: string,
  year: number,
): Promise<string> {
  const rows = await settledBookings(db, year, vendorId);
  const gross = foldTaxYearFigures(rows)[0]?.grossCents ?? 0;
  const totals = { refunded: 0, commission: 0, netted: 0, transferred: 0 };
  const lines: string[] = [VENDOR_STATEMENT_HEADER.join(',')];

  for (const row of rows) {
    const transferred = row.vendorPayoutCents - row.debtNettedCents;
    // What Orla kept: `platform_fee_cents` is written once at payment and never follows a refund,
    // so the commission is what is left after the refund and the vendor's stored share.
    const commission = row.totalAmountCents - row.refundedCents - row.vendorPayoutCents;

    totals.refunded += row.refundedCents;
    totals.commission += commission;
    totals.netted += row.debtNettedCents;
    totals.transferred += transferred;
    lines.push(
      [
        usDateFromIso(row.eventDate),
        bookingReference(row.bookingId),
        dollars(row.totalAmountCents),
        dollars(row.refundedCents),
        dollars(commission),
        dollars(row.debtNettedCents),
        dollars(0),
        dollars(transferred),
        usDateFromInstant(row.settledAt),
      ].join(','),
    );
  }

  lines.push(
    [
      'Total',
      '',
      dollars(gross),
      dollars(totals.refunded),
      dollars(totals.commission),
      dollars(totals.netted),
      dollars(0),
      dollars(totals.transferred),
      '',
    ].join(','),
  );

  return `${lines.join('\n')}\n`;
}

async function ownVendorId(db: AppDatabase, userId: string): Promise<string> {
  const vendor = await findVendorProfileByUserId(db, userId);

  if (!vendor) {
    throw notFound('You have not created a vendor profile yet');
  }

  return vendor.id;
}

/** The caller's own statement: the vendor is the signed-in user's profile, never a request value. */
export async function vendorStatementFor(
  db: AppDatabase,
  userId: string,
  year: number,
): Promise<string> {
  return vendorStatementCsv(db, await ownVendorId(db, userId), year);
}

/** The years the caller has a statement for. */
export async function vendorTaxYearsFor(db: AppDatabase, userId: string): Promise<number[]> {
  return taxYearsWithSettledBookings(db, await ownVendorId(db, userId));
}

export const sha256Hex = (text: string): string => createHash('sha256').update(text).digest('hex');

export { taxYearsWithSettledBookings };
