import {
  adminActivityRowSchema,
  adminPaymentRowSchema,
  adminPayoutRetryResultSchema,
  vendorDashboardSchema,
} from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  wireAdminActivityRowSchema,
  wireAdminPaymentRowSchema,
  wireAdminPayoutRetryResultSchema,
  wireVendorDashboardSchema,
} from './wire-schemas';

/**
 * The vendor dashboard as it really arrives: JSON, every `Date` an ISO string.
 *
 * **Built from a vendor who is owed money**, which is the whole point. #423
 * shipped `releaseAt` as a `z.date()` with no `z.coerce.date()` behind it; the
 * route 500'd for every vendor with a pending payout and rendered fine for
 * everyone else, and the entire local gate stayed green because the only
 * fixture in the suite had the field absent. An absent optional field proves
 * nothing about the field.
 */
const PAID_DASHBOARD = {
  newRequestCount: 4,
  bookingsThisMonth: 7,
  bookingsLastMonth: 5,
  responseRate: 0.96,
  avgRating: 4.9,
  reviewCount: 127,
  earningsThisMonthCents: 894_000,
  isPublished: true,
  publishBlockers: [],
  stripeOnboarded: true,
  bookingWindow: Array.from({ length: 9 }, (_, offset) => ({
    date: `2026-06-${String(9 + offset).padStart(2, '0')}`,
    status: 'available' as const,
  })),
  payouts: {
    pendingCents: 175_000,
    pendingCount: 1,
    next: {
      cents: 175_000,
      customerFirstName: 'Anjali',
      releaseAt: '2026-06-18T00:00:00.000Z',
      isDue: false,
    },
    heldCents: 50_000,
    heldCount: 1,
  },
};

const OWED_NOTHING = {
  ...PAID_DASHBOARD,
  payouts: { pendingCents: 0, pendingCount: 0, next: null, heldCents: 0, heldCount: 0 },
};

/**
 * Every path in `schema` that resolves to a `z.date()`.
 *
 * **Throws on a wrapper it does not understand rather than returning `[]`.** A
 * walker that silently skips a `z.union` or a `z.lazy` would let the next date
 * added behind one through, and the guard below would still pass — which is
 * exactly the shape of vacuous check that let #423's 500 ship. An unknown
 * container is a reason to extend this function, and it says so by failing.
 */
function dateFields(schema: z.ZodType, path: string[] = []): string[] {
  const def = (schema as unknown as { def: { type: string; innerType?: z.ZodType } }).def;

  if (def.type === 'date') {
    return [path.join('.')];
  }

  if (def.innerType) {
    return dateFields(def.innerType, path);
  }

  if (schema instanceof z.ZodObject) {
    return Object.entries(schema.shape).flatMap(([key, value]) =>
      dateFields(value as z.ZodType, [...path, key]),
    );
  }

  /*
   * Leaves, listed so an unrecognised *container* is distinguishable from a
   * scalar this walker is right to stop at. `array` is here rather than
   * recursed into because the reader below navigates by key and cannot index
   * one; a date nested in an array needs both halves extended, and this list is
   * what forces that to be noticed.
   */
  const LEAVES = [
    'string',
    'number',
    'int',
    'boolean',
    'enum',
    'literal',
    'null',
    'array',
    /*
     * `record` is a leaf here, and that is a claim about this codebase rather
     * than about Zod. The one record on a response schema is
     * `adminActionDetailSchema` (#434), whose value type is a union of scalars —
     * so no date can hide in it. A record of objects would need recursing into,
     * and adding one is the moment to revisit this line.
     */
    'record',
  ];

  if (!LEAVES.includes(def.type)) {
    throw new Error(
      `dateFields cannot see inside a "${def.type}" at ${path.join('.') || '<root>'} — ` +
        'extend it, or a date behind that wrapper will ship uncoerced.',
    );
  }

  return [];
}

describe('the vendor dashboard at the wire boundary', () => {
  it('parses a vendor who is owed money, dates and all', () => {
    const parsed = wireVendorDashboardSchema.parse(PAID_DASHBOARD);

    expect(parsed.payouts.next?.releaseAt).toEqual(new Date('2026-06-18T00:00:00.000Z'));
    expect(parsed.payouts.next?.cents).toBe(175_000);
    expect(parsed.payouts.pendingCents).toBe(175_000);
    expect(parsed.payouts.heldCents).toBe(50_000);
  });

  it('parses a vendor who is owed nothing', () => {
    const parsed = wireVendorDashboardSchema.parse(OWED_NOTHING);

    expect(parsed.payouts.next).toBeNull();
    expect(parsed.payouts.pendingCents).toBe(0);
  });

  /**
   * The guard that closes the class rather than the instance.
   *
   * Every `z.date()` reachable in the shared dashboard schema must have a
   * `z.coerce.date()` over it in the wire schema, because the API sends JSON
   * and a bare `z.date()` rejects the string it sends. This walks the shape and
   * fails naming the field, so the next date added to this response cannot
   * repeat #423's 500 — which no amount of fixture-writing would have caught,
   * since the fixture is written by whoever forgot the coercion.
   */
  it('coerces every date the response can carry', () => {
    /*
     * Pinned rather than merely counted. A walker returning `[]` would pass
     * this test having checked nothing, so the expected set is written out and
     * `dateFields` throws rather than shrugging at a shape it cannot read.
     */
    const shared = dateFields(vendorDashboardSchema);
    expect(shared).toEqual(['payouts.next.releaseAt']);

    const stringified = JSON.parse(JSON.stringify(PAID_DASHBOARD)) as unknown;
    const parsed = wireVendorDashboardSchema.parse(stringified) as Record<string, unknown>;

    for (const field of shared) {
      const value = field.split('.').reduce<unknown>((node, key) => {
        return node === null || node === undefined ? node : (node as Record<string, unknown>)[key];
      }, parsed);

      expect(value, `${field} arrived as ${typeof value}, not a Date`).toBeInstanceOf(Date);
    }
  });

  /* The walker's own contract: it refuses a container it cannot see inside. */
  it('refuses to walk a shape it does not understand', () => {
    const withUnion = z.object({ when: z.union([z.date(), z.string()]) });

    expect(() => dateFields(withUnion)).toThrow(/cannot see inside a "union"/);
  });
});

/**
 * The action log at the wire boundary — the second response this walker covers.
 *
 * Here because `.claude/rules/web-route-boundaries.md` asks for the walker to be
 * extended to the next schema rather than for another paragraph to be written,
 * and because `/admin/activity` is a screen where #423's failure mode would be
 * total rather than conditional: `createdAt` is on **every** row, so a missing
 * coercion 500s the page for any console that has ever done anything, and
 * renders perfectly only while the log is empty. The empty log is exactly the
 * state a first browser pass finds it in.
 */
const ACTIVITY_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  actorId: '22222222-2222-4222-8222-222222222222',
  actorName: 'Dana Okafor',
  action: 'user_banned' as const,
  subjectType: 'user' as const,
  subjectId: '33333333-3333-4333-8333-333333333333',
  detail: { refundsIssued: 2, refundsFailed: 0, profileUnpublished: true },
  createdAt: '2026-09-07T11:31:00.000Z',
};

describe('the admin action log at the wire boundary', () => {
  it('parses a row that carries every field, dates and all', () => {
    const parsed = wireAdminActivityRowSchema.parse(ACTIVITY_ROW);

    expect(parsed.createdAt).toEqual(new Date('2026-09-07T11:31:00.000Z'));
    expect(parsed.actorName).toBe('Dana Okafor');
    expect(parsed.action).toBe('user_banned');
  });

  /**
   * The detail payload survives the round trip **as scalars**, not flattened to
   * strings — the console prints `refundsIssued 2`, and a `2` that arrived as
   * `"2"` would render identically while being a different value to anything
   * that later counts it.
   */
  it('keeps the detail payload typed rather than stringified', () => {
    const parsed = wireAdminActivityRowSchema.parse(
      JSON.parse(JSON.stringify(ACTIVITY_ROW)) as unknown,
    );

    expect(parsed.detail).toEqual({
      refundsIssued: 2,
      refundsFailed: 0,
      profileUnpublished: true,
    });
  });

  it('coerces every date the row can carry', () => {
    const shared = dateFields(adminActivityRowSchema);
    expect(shared).toEqual(['createdAt']);

    const stringified = JSON.parse(JSON.stringify(ACTIVITY_ROW)) as unknown;
    const parsed = wireAdminActivityRowSchema.parse(stringified) as Record<string, unknown>;

    for (const field of shared) {
      expect(
        parsed[field],
        `${field} arrived as ${typeof parsed[field]}, not a Date`,
      ).toBeInstanceOf(Date);
    }
  });
});

/**
 * The payments row at the wire boundary — the third response this walker covers.
 *
 * #432 added `payoutReleasedAt` to `adminPaymentRowSchema`, which is #423's
 * failure in the same shape and with the same blind spot: the field is null on
 * every payout that has not gone out, so a console driven against a fresh
 * fixture parses cleanly and the screen 500s the moment one booking settles.
 * The fixture below is therefore a **released** payout, because an absent
 * nullable field proves nothing about the field.
 */
const RELEASED_PAYMENT = {
  bookingId: '44444444-4444-4444-8444-444444444444',
  status: 'completed' as const,
  totalAmountCents: 145_000,
  platformFeeCents: 17_400,
  vendorPayoutCents: 127_600,
  stripePaymentIntentId: 'pi_test_1',
  vendorName: 'Sunlit Studio',
  vendorSlug: 'sunlit-studio',
  customerName: 'Anjali Rao',
  paidAt: '2026-05-01T00:00:00.000Z',
  payoutStatus: 'released' as const,
  payoutReleasedAt: '2026-06-05T00:00:00.000Z',
  payoutAttempts: 2,
  payoutFailureReason: null,
  stripeTransferId: 'tr_test_1',
  payoutFailing: false,
};

describe('the admin payments row at the wire boundary', () => {
  it('parses a released payout, dates and all', () => {
    const parsed = wireAdminPaymentRowSchema.parse(RELEASED_PAYMENT);

    expect(parsed.payoutReleasedAt).toEqual(new Date('2026-06-05T00:00:00.000Z'));
    expect(parsed.paidAt).toEqual(new Date('2026-05-01T00:00:00.000Z'));
    expect(parsed.payoutStatus).toBe('released');
    expect(parsed.payoutAttempts).toBe(2);
  });

  it('parses a failing payout, which carries neither date', () => {
    const parsed = wireAdminPaymentRowSchema.parse({
      ...RELEASED_PAYMENT,
      payoutStatus: 'pending' as const,
      payoutReleasedAt: null,
      payoutFailureReason: 'Stripe refused the transfer',
      stripeTransferId: null,
      payoutFailing: true,
    });

    expect(parsed.payoutReleasedAt).toBeNull();
    expect(parsed.payoutFailing).toBe(true);
    expect(parsed.payoutFailureReason).toBe('Stripe refused the transfer');
  });

  it('coerces every date the row can carry', () => {
    const shared = dateFields(adminPaymentRowSchema);
    expect(shared).toEqual(['paidAt', 'payoutReleasedAt']);

    const stringified = JSON.parse(JSON.stringify(RELEASED_PAYMENT)) as unknown;
    const parsed = wireAdminPaymentRowSchema.parse(stringified) as Record<string, unknown>;

    for (const field of shared) {
      expect(
        parsed[field],
        `${field} arrived as ${typeof parsed[field]}, not a Date`,
      ).toBeInstanceOf(Date);
    }
  });
});

/**
 * The retry's answer — the fourth response this walker covers, and the one that
 * got away.
 *
 * #432 gave the payments *row* its `z.coerce.date()` and gave the retry result
 * the same `z.date()` with none, which is the failure mode inverted into its
 * nastiest shape: `payoutReleasedAt` is null on every outcome except the one
 * where the money moved, so the client parsed every failed retry cleanly and
 * threw on success — telling the operator a completed transfer had failed,
 * with the money already out of the platform balance. The route suite could not
 * see it, because it reads the response object rather than its JSON.
 */
const RELEASED_RETRY = {
  outcome: 'released' as const,
  payoutStatus: 'released' as const,
  payoutAttempts: 3,
  payoutFailureReason: null,
  payoutReleasedAt: '2026-09-07T11:31:00.000Z',
  stripeTransferId: 'tr_test_9',
  payoutFailing: false,
};

describe('the payout retry result at the wire boundary', () => {
  it('parses the outcome that carries a date', () => {
    const parsed = wireAdminPayoutRetryResultSchema.parse(RELEASED_RETRY);

    expect(parsed.payoutReleasedAt).toEqual(new Date('2026-09-07T11:31:00.000Z'));
    expect(parsed.outcome).toBe('released');
    expect(parsed.payoutFailing).toBe(false);
  });

  it('parses the outcomes that do not', () => {
    for (const outcome of ['failed', 'busy'] as const) {
      const parsed = wireAdminPayoutRetryResultSchema.parse({
        ...RELEASED_RETRY,
        outcome,
        payoutStatus: 'pending' as const,
        payoutReleasedAt: null,
        stripeTransferId: null,
        payoutFailing: true,
      });

      expect(parsed.payoutReleasedAt).toBeNull();
      expect(parsed.outcome).toBe(outcome);
    }
  });

  /*
   * The shared schema is what the client used to be handed, and it is what
   * makes this a regression test rather than a restatement: it must reject the
   * exact payload the wire schema accepts.
   */
  it('is rejected by the shared schema, which is why the twin exists', () => {
    expect(adminPayoutRetryResultSchema.safeParse(RELEASED_RETRY).success).toBe(false);
    expect(wireAdminPayoutRetryResultSchema.safeParse(RELEASED_RETRY).success).toBe(true);
  });

  it('coerces every date the result can carry', () => {
    const shared = dateFields(adminPayoutRetryResultSchema);
    expect(shared).toEqual(['payoutReleasedAt']);

    const stringified = JSON.parse(JSON.stringify(RELEASED_RETRY)) as unknown;
    const parsed = wireAdminPayoutRetryResultSchema.parse(stringified) as Record<string, unknown>;

    for (const field of shared) {
      expect(
        parsed[field],
        `${field} arrived as ${typeof parsed[field]}, not a Date`,
      ).toBeInstanceOf(Date);
    }
  });
});
