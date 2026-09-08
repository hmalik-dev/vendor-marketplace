import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminCaseDetail } from '@/lib/wire-schemas';

vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const { CaseResolution } = await import('./case-resolution');

/*
 * The resolve control against Pattern C of the admin delta (#454).
 *
 * This is the one screen on the console where the copy *is* the safeguard, so
 * the assertions are about words and weight rather than about the call the
 * button makes — that call is unchanged and already covered. What is new is
 * that an operator is told what the **other** party gets, on which **date**,
 * and which **field** is written, before they press.
 */

const BOOKING: NonNullable<WireAdminCaseDetail['booking']> = {
  id: '44444444-4444-4444-8444-444444444444',
  status: 'disputed',
  // Long past, so the release instant has gone and "the next sweep" is today.
  eventDate: '2026-08-20',
  customerName: 'Maya Rivera',
  vendorName: 'Kessler & Co.',
  vendorSlug: 'kessler-and-co',
  totalAmountCents: 260_000,
  platformFeeCents: 28_600,
  vendorPayoutCents: 231_400,
  refundAmountCents: null,
  paidAt: new Date('2026-08-20T16:41:00.000Z'),
  payoutReleasedAt: null,
  payoutStatus: 'held',
  disputeReason: 'product_not_received',
  cancelledBy: null,
  stripePaymentIntentId: 'pi_1QaB7cKz9LmN4dTv',
};

const CASE: WireAdminCaseDetail = {
  id: '55555555-5555-4555-8555-555555555555',
  reference: 'ORL-4K7Q-P2',
  origin: 'chargeback',
  topic: null,
  status: 'open',
  senderUserId: '66666666-6666-4666-8666-666666666666',
  senderName: 'Maya Rivera',
  senderEmail: 'maya.rivera@fastmail.com',
  bookingId: BOOKING.id,
  createdAt: new Date('2026-09-04T09:12:00.000Z'),
  message: 'Nobody arrived.',
  holdRefusal: null,
  emailFailedAt: null,
  networkOutcome: null,
  stripeDisputeId: 'dp_1QaB7cKz9LmN4dTvXy82Rq',
  resolvedByName: null,
  resolvedAt: null,
  booking: BOOKING,
};

afterEach(cleanup);

function openConfirm(name: RegExp): void {
  render(<CaseResolution supportCase={CASE} />);
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('the two resolve positions', () => {
  /**
   * Equal weight, and this is the assertion that fails if one of them becomes
   * the recommendation.
   *
   * The delta is explicit about why: the operator's job is to judge, and a
   * filled clay button on one side would be the product voting on somebody
   * else's money. `data-variant` is what the `Button` primitive stamps, so a
   * change back to `primary` or to the red *fill* fails here rather than in a
   * screenshot nobody diffs.
   */
  it('gives neither position the primary fill', () => {
    render(<CaseResolution supportCase={CASE} />);

    const variants = ['Resolve for the vendor', 'Refund and cancel'].map(
      (name) => screen.getByRole('button', { name }).dataset.variant,
    );

    expect(variants).toEqual(['secondary', 'secondary']);
  });

  /** Outlined red, never filled — the frame's `btnD`. */
  it('marks only the destructive edge, in outline', () => {
    render(<CaseResolution supportCase={CASE} />);

    const destructive = screen.getByRole('button', { name: 'Refund and cancel' });
    expect(destructive.className).toContain('border-error-200');
    expect(destructive.className).toContain('text-error-500');
    expect(destructive.className).not.toContain('bg-error-500');
  });

  /**
   * Each position names its own figure **and the other party's**.
   *
   * Asserted on both halves of both cards, because the half that goes missing
   * is always the counterparty's: it is the second question an operator is
   * asked afterwards and the first one the copy drops.
   */
  it('names what each party gets, on both positions', () => {
    render(<CaseResolution supportCase={CASE} />);

    /*
     * `$2,314`, not `$2,314.00`. The delta draws trailing cents throughout and
     * `formatPrice` prints whole dollars for a round amount — the shared money
     * formatter every price in the product goes through, so the difference is a
     * live override rather than this screen's defect. Recorded in
     * `web-design-parity.md`.
     */
    const vendorCard = screen.getByText(/The hold lifts\./).textContent ?? '';
    expect(vendorCard).toContain('$2,314');
    expect(vendorCard).toContain('Maya Rivera is refunded');
    expect(vendorCard).toContain('$0');

    const customerCard = screen.getByText(/is refunded to Maya Rivera/).textContent ?? '';
    expect(customerCard).toContain('$2,600');
    expect(customerCard).toContain('Kessler & Co. receives');
    expect(customerCard).toContain('$0');
    expect(customerCard).toContain('$286');
  });

  /**
   * The payout sweep, by name.
   *
   * D35 releases `PAYOUT_RELEASE_HOURS` after the event day; this fixture's
   * event is long past, so the release instant has gone and the sweep an
   * operator is promised is the next tick — today. Asserted as a weekday-plus-
   * date shape rather than a literal, because the fixture is read against the
   * real clock and a pinned string would go stale tomorrow.
   */
  it('names the sweep as a date rather than describing it', () => {
    render(<CaseResolution supportCase={CASE} />);

    expect(screen.getByText(/The hold lifts\./).textContent).toMatch(
      /on the next sweep, [A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}\./,
    );
  });
});

describe('the two confirms', () => {
  /**
   * The confirm **restates**, it does not summarise — the difference between a
   * safeguard and a speed bump. Amount in the title, the counterparty's zero in
   * the body, the field that will be written, and the caution.
   */
  it('restates the refund, the zero and the field it writes', () => {
    openConfirm(/^Refund and cancel$/);

    expect(screen.getByRole('alertdialog').textContent).toContain(
      'Refund $2,600 and cancel this booking?',
    );
    const body = screen.getByRole('alertdialog').textContent ?? '';
    expect(body).toContain('cancelled_by = admin');
    expect(body).toContain('Kessler & Co. receives $0');
    expect(body).toContain('$286');
  });

  /**
   * The vendor confirm names `cancelled_by` too, and says it is **not**
   * written.
   *
   * The requirement is that both confirms name the field, and naming it in the
   * negative is the honest form here: nothing is cancelled, and an operator who
   * has just read the other card needs to be told which of the two writes it.
   */
  it('names cancelled_by on the vendor position as the field that stays unwritten', () => {
    openConfirm(/^Resolve for the vendor$/);

    const body = screen.getByRole('alertdialog').textContent ?? '';
    expect(body).toContain('cancelled_by');
    expect(body).toContain('is not written');
    expect(body).toContain('$2,314');
  });

  /*
   * Both confirms name the sweep, and the two word it from opposite sides — one
   * says the money arrives on it, the other that it does not — so the assertion
   * is that the word and a real date co-occur, not that one phrasing is used.
   */
  it.each([
    [/^Refund and cancel$/, 'refund'],
    [/^Resolve for the vendor$/, 'vendor release'],
  ])('names the sweep date on the %s confirm', (name) => {
    openConfirm(name as RegExp);
    const body = screen.getByRole('alertdialog').textContent ?? '';

    expect(body).toContain('sweep');
    expect(body).toMatch(/[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}/);
  });

  /**
   * "Cancel" on this screen is a verb about money.
   *
   * The dismiss reads `Keep the case open` — it names the state you return to,
   * which is what stops an operator reading the escape as the action.
   */
  it.each([[/^Refund and cancel$/], [/^Resolve for the vendor$/]])(
    'dismisses with "Keep the case open"',
    (name) => {
      openConfirm(name as RegExp);

      expect(screen.getByRole('button', { name: 'Keep the case open' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    },
  );

  /**
   * The thing operators get wrong, in the gold panel the frame draws.
   *
   * The refund half only belongs on the position that refunds — putting it on
   * the vendor confirm would describe money that is not moving — but the
   * dispute half catches people both ways, so both carry it.
   */
  it('cautions that a refund does not withdraw the bank dispute', () => {
    openConfirm(/^Refund and cancel$/);

    expect(screen.getByRole('alertdialog').textContent).toContain(
      "Refunds settle to the customer's bank in 5–10 days",
    );
    expect(screen.getByRole('alertdialog').textContent).toContain('refunding does not withdraw it');
  });

  it('cautions the vendor position about the dispute without promising a refund', () => {
    openConfirm(/^Resolve for the vendor$/);

    const body = screen.getByRole('alertdialog').textContent ?? '';
    expect(body).toContain("Stripe's dispute stays open until the bank closes it");
    expect(body).not.toContain('Refunds settle');
  });
});

describe('the three regions', () => {
  /**
   * The numbers are visible, and the resolve control is last.
   *
   * Read off the page source with comments stripped — the page explains at
   * length *why* the control sits last, so an unstripped guard for "3 · Resolve"
   * matches the explanation and cannot fail for a card in the wrong place.
   */
  const page = readFileSync(
    join(process.cwd(), 'src/app/admin/cases/[caseId]/page.tsx'),
    'utf8',
  ).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '');

  it('numbers the complaint, the booking and the resolve control in that order', () => {
    const regions = [...page.matchAll(/<Card region=\{(\d)\} title="([^"]+)"/g)].map((match) => [
      match[1],
      match[2],
    ]);

    expect(regions).toEqual([
      ['1', 'The complaint'],
      ['2', 'The booking it froze'],
      ['3', 'Resolve'],
    ]);
  });

  /**
   * The scroll is half the safeguard: the control has to be past the evidence.
   *
   * Asserted as a source ordering rather than a rendered one because the page
   * is an async Server Component; what it guards is a card being moved above
   * the complaint, which is the only way this order breaks.
   */
  it('puts the resolve control after both of the regions it reads from', () => {
    expect(page.indexOf('region={3}')).toBeGreaterThan(page.indexOf('region={1}'));
    expect(page.indexOf('region={3}')).toBeGreaterThan(page.indexOf('region={2}'));
  });
});
