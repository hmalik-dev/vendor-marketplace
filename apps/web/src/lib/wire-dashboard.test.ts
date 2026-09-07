import { vendorDashboardSchema } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { wireVendorDashboardSchema } from './wire-schemas';

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
  const LEAVES = ['string', 'number', 'int', 'boolean', 'enum', 'literal', 'null', 'array'];

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
