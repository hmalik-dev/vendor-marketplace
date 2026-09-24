import {
  BOOKINGS_PAUSED_NOTICE,
  ERROR_CODES,
  formatPrice,
  PAUSED_DEFAULT_NOTICE,
  PLATFORM_SETTINGS_CACHE_MS,
  PLATFORM_SETTINGS_ID,
  type AdminPlatformSettings,
  type AdminVendorPayoutHoldResult,
  type PlatformSwitches,
  type PublicPlatformNotice,
  type UpdatePlatformSettings,
} from '@vendor-marketplace/shared';
import type { PlatformSettingsRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { AppError, conflict, notFound } from '../../lib/errors.js';
import { insertAdminAction } from '../admin/admin.dao.js';
import type { AdminContext } from '../admin/account-unwind.js';
import type { AdminAlert } from '../admin-alerts/admin-alerts.service.js';
import {
  findHeldVendors,
  findPlatformSettings,
  findPlatformSettingsWithEditor,
  lockPlatformSettings,
  lockVendorPayoutHold,
  updatePlatformSettingsRow,
  updateVendorPayoutHold,
} from './platform-settings.dao.js';

/** Everything an admin can set here: the switches and the site-wide notice (VEN-616). */
export type PlatformValues = PlatformSwitches &
  Pick<PlatformSettingsRow, 'noticeMessage' | 'noticeTone'>;

/** Every switch off and no cap: what a platform nobody has configured runs as. */
const DEFAULT_SWITCHES: PlatformSwitches = {
  bookingRequestsPaused: false,
  checkoutPaused: false,
  payoutReleasePaused: false,
  maxBookingCents: null,
  vendorInviteOnly: false,
};

const ADMIN_SETTINGS_PATH = '/admin/settings';

const SWITCH_FIELDS = [
  'bookingRequestsPaused',
  'checkoutPaused',
  'payoutReleasePaused',
  'maxBookingCents',
  'vendorInviteOnly',
  'noticeMessage',
  'noticeTone',
] as const satisfies readonly (keyof PlatformValues)[];

/**
 * The last read per database handle, trusted for `PLATFORM_SETTINGS_CACHE_MS`.
 *
 * Keyed by the handle rather than held in one module variable so that each test
 * suite's in-process database has its own entry. A write through this module
 * drops the entry, so the instance that flipped a switch obeys it at once and
 * every other instance within the window.
 */
const cache = new WeakMap<AppDatabase, { values: PlatformValues; expiresAt: number }>();

function toValues(row: PlatformSettingsRow | null): PlatformValues {
  return {
    ...toSwitches(row),
    noticeMessage: row?.noticeMessage ?? null,
    noticeTone: row?.noticeTone ?? 'info',
  };
}

function toSwitches(row: PlatformSwitches | null): PlatformSwitches {
  if (!row) {
    return DEFAULT_SWITCHES;
  }

  return {
    bookingRequestsPaused: row.bookingRequestsPaused,
    checkoutPaused: row.checkoutPaused,
    payoutReleasePaused: row.payoutReleasePaused,
    maxBookingCents: row.maxBookingCents,
    vendorInviteOnly: row.vendorInviteOnly,
  };
}

async function readPlatformValues(db: AppDatabase): Promise<PlatformValues> {
  const hit = cache.get(db);

  if (hit && hit.expiresAt > Date.now()) {
    return hit.values;
  }

  const values = toValues(await findPlatformSettings(db));
  cache.set(db, { values, expiresAt: Date.now() + PLATFORM_SETTINGS_CACHE_MS });

  return values;
}

/** The switches as a guarded request should obey them — at most ten seconds old. */
export async function readPlatformSwitches(db: AppDatabase): Promise<PlatformSwitches> {
  return toSwitches(await readPlatformValues(db));
}

/**
 * `GET /platform/notice`: the admin's notice, else a default while checkout or
 * booking requests are paused, else `null`. Every page reads it, so it rides
 * the switches' cache rather than adding a query per render.
 */
export async function readPublicPlatformNotice(db: AppDatabase): Promise<PublicPlatformNotice> {
  const values = await readPlatformValues(db);

  if (values.noticeMessage !== null) {
    return { message: values.noticeMessage, tone: values.noticeTone };
  }

  return values.checkoutPaused || values.bookingRequestsPaused
    ? { message: PAUSED_DEFAULT_NOTICE, tone: 'info' }
    : null;
}

/**
 * Drops this handle's cached read, so the next guarded request reads the row.
 * Every write here calls it; a suite that resets the row directly does too.
 */
export function forgetPlatformSwitches(db: AppDatabase): void {
  cache.delete(db);
}

/**
 * The switches read straight from the row, for the payout sweep.
 *
 * The sweep runs every quarter of an hour and moves money, so it never trusts a
 * cached "not paused": one query per booking is nothing beside a Stripe call.
 */
export async function readPlatformSwitchesUncached(db: AppDatabase): Promise<PlatformSwitches> {
  return toSwitches(await findPlatformSettings(db));
}

function overBetaCap(maxBookingCents: number | null, priceCents: number): AppError {
  const cap = maxBookingCents === null ? '' : ` of ${formatPrice(maxBookingCents)}`;

  return new AppError(
    422,
    ERROR_CODES.OVER_BETA_CAP,
    `Bookings are limited to a price${cap} during the beta, and this one is ${formatPrice(priceCents)}`,
  );
}

function exceedsCap(switches: PlatformSwitches, priceCents: number | null): boolean {
  return (
    switches.maxBookingCents !== null &&
    priceCents !== null &&
    priceCents > switches.maxBookingCents
  );
}

/**
 * Refuses a new booking request while requests are paused, or when its locked
 * price is over the beta cap. A request with no price yet (a custom quote) is
 * held to the cap at checkout instead.
 */
export async function assertBookingRequestsOpen(
  db: AppDatabase,
  priceCents: number | null,
): Promise<void> {
  const switches = await readPlatformSwitches(db);

  if (switches.bookingRequestsPaused) {
    throw new AppError(503, ERROR_CODES.BOOKINGS_PAUSED, BOOKINGS_PAUSED_NOTICE);
  }

  if (exceedsCap(switches, priceCents)) {
    throw overBetaCap(switches.maxBookingCents, priceCents ?? 0);
  }
}

/** Refuses a price over the beta cap, and nothing else — for a step that is not itself a payment. */
export async function assertUnderBetaCap(db: AppDatabase, priceCents: number): Promise<void> {
  const switches = await readPlatformSwitches(db);

  if (exceedsCap(switches, priceCents)) {
    throw overBetaCap(switches.maxBookingCents, priceCents);
  }
}

/**
 * Refuses to open a payment while checkout is paused, or for a price over the
 * beta cap — including a request created before the cap was lowered, since its
 * price was fixed at creation.
 */
export async function assertCheckoutOpen(db: AppDatabase, priceCents: number): Promise<void> {
  const switches = await readPlatformSwitches(db);

  if (switches.checkoutPaused) {
    throw new AppError(503, ERROR_CODES.CHECKOUT_PAUSED, BOOKINGS_PAUSED_NOTICE);
  }

  if (exceedsCap(switches, priceCents)) {
    throw overBetaCap(switches.maxBookingCents, priceCents);
  }
}

/** `GET /admin/settings`. */
export async function readAdminPlatformSettings(db: AppDatabase): Promise<AdminPlatformSettings> {
  const [stored, heldVendors] = await Promise.all([
    findPlatformSettingsWithEditor(db),
    findHeldVendors(db),
  ]);

  return {
    ...toValues(stored?.row ?? null),
    updatedAt: stored?.row.updatedBy ? stored.row.updatedAt : null,
    updatedByName: stored?.updatedByName ?? null,
    heldVendors,
  };
}

type SwitchField = (typeof SWITCH_FIELDS)[number];

interface SwitchChange {
  field: SwitchField;
  before: PlatformValues[SwitchField];
  after: PlatformValues[SwitchField];
}

function describeValue(field: SwitchField, value: PlatformValues[SwitchField]): string {
  if (field === 'maxBookingCents') {
    return typeof value === 'number' ? formatPrice(value) : 'no cap';
  }

  if (field === 'noticeMessage') {
    return typeof value === 'string' ? `"${value}"` : 'none';
  }

  if (field === 'noticeTone') {
    return String(value);
  }

  return value === true ? 'on' : 'off';
}

function switchFlippedAlert(changes: readonly SwitchChange[]): AdminAlert {
  return {
    kind: 'launch_switch_flipped',
    // A fresh subject per write, so flipping back within the dedupe window still alerts.
    subjectId: `${PLATFORM_SETTINGS_ID}:${Date.now()}`,
    summary: 'A launch switch was changed',
    details: changes.map(
      (change) =>
        `${change.field}: ${describeValue(change.field, change.before)} → ${describeValue(change.field, change.after)}`,
    ),
    adminPath: ADMIN_SETTINGS_PATH,
  };
}

/**
 * `PUT /admin/settings`: writes the fields that actually change, one audit row
 * per field in the same transaction, then alerts the admin.
 */
export async function updatePlatformSettings(
  context: AdminContext,
  actorId: string,
  input: UpdatePlatformSettings,
): Promise<AdminPlatformSettings> {
  const changes = await context.db.transaction(async (tx) => {
    const before = await lockPlatformSettings(tx);
    const changed: SwitchChange[] = [];
    const patch: Partial<PlatformValues> = {};

    for (const field of SWITCH_FIELDS) {
      const next = input[field];

      if (next === undefined || next === before[field]) {
        continue;
      }

      changed.push({ field, before: before[field], after: next });
      Object.assign(patch, { [field]: next });
    }

    if (changed.length === 0) {
      throw conflict('Those settings are already in force');
    }

    await updatePlatformSettingsRow(tx, { ...patch, updatedBy: actorId });

    for (const change of changed) {
      await insertAdminAction(tx, {
        actorId,
        action: 'platform_setting_changed',
        subjectType: 'platform_settings',
        subjectId: PLATFORM_SETTINGS_ID,
        detail: { field: change.field, before: change.before, after: change.after },
      });
    }

    return changed;
  });

  forgetPlatformSwitches(context.db);

  context.alerts?.dispatch(switchFlippedAlert(changes));

  return readAdminPlatformSettings(context.db);
}

/** `PUT /admin/vendors/:vendorId/payout-hold`. */
export async function setVendorPayoutHold(
  context: AdminContext,
  actorId: string,
  vendorId: string,
  payoutHold: boolean,
): Promise<AdminVendorPayoutHoldResult> {
  await context.db.transaction(async (tx) => {
    const vendor = await lockVendorPayoutHold(tx, vendorId);

    if (!vendor) {
      throw notFound('No storefront with that id');
    }

    if (vendor.payoutHold === payoutHold) {
      throw conflict(
        payoutHold
          ? "That vendor's payouts are already held"
          : "That vendor's payouts are not held",
      );
    }

    await updateVendorPayoutHold(tx, vendorId, payoutHold);
    await insertAdminAction(tx, {
      actorId,
      action: payoutHold ? 'vendor_payout_hold_set' : 'vendor_payout_hold_released',
      subjectType: 'vendor_profile',
      subjectId: vendorId,
      detail: { field: 'payoutHold', before: vendor.payoutHold, after: payoutHold },
    });
  });

  context.alerts?.dispatch({
    kind: 'launch_switch_flipped',
    subjectId: `${vendorId}:${Date.now()}`,
    summary: payoutHold
      ? "A vendor's payouts were put on hold"
      : "A vendor's payout hold was lifted",
    details: [`Vendor: ${vendorId}`, `payoutHold: ${payoutHold ? 'on' : 'off'}`],
    adminPath: ADMIN_SETTINGS_PATH,
  });

  return { vendorId, payoutHold };
}
