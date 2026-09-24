import {
  SERVICE_PACKAGE_MODERATION_HOLD_MESSAGE,
  parseDurationHours,
  type CreateServicePackageInput,
  type ReorderServicePackagesInput,
  type ServicePackage,
  type UpdateServicePackageInput,
} from '@vendor-marketplace/shared';
import type { NewServicePackageRow, ServicePackageRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { lockVendorProfile } from '../admin/admin.dao.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { assertCompleteOrder } from '../../lib/ordering.js';
import {
  requireOwnVendorProfile,
  unpublishForMissingPackages,
} from '../vendors/vendors.service.js';
import {
  applyPackageOrder,
  findOwnedPackageIds,
  findPackageById,
  findPackagesByVendor,
  insertPackage,
  nextDisplayOrder,
  updatePackageById,
} from './packages.dao.js';

const PACKAGE_CHANGED_MESSAGE =
  'This package changed since you opened it. Review the current values, then save again.';

export function toServicePackage(row: ServicePackageRow): ServicePackage {
  return { ...row, durationHours: parseDurationHours(row.durationHours) };
}

export async function listOwnPackages(db: AppDatabase, userId: string): Promise<ServicePackage[]> {
  const vendor = await requireOwnVendorProfile(db, userId);
  const rows = await findPackagesByVendor(db, vendor.id);

  return rows.map(toServicePackage);
}

export async function createPackage(
  db: AppDatabase,
  userId: string,
  input: CreateServicePackageInput,
): Promise<ServicePackage> {
  const vendor = await requireOwnVendorProfile(db, userId);

  const values: NewServicePackageRow = {
    vendorId: vendor.id,
    name: input.name,
    description: input.description,
    priceCents: input.priceCents,
    priceType: input.priceType,
    durationHours: input.durationHours?.toString() ?? null,
    maxGuests: input.maxGuests ?? null,
    inclusions: input.inclusions,
    displayOrder: input.displayOrder ?? (await nextDisplayOrder(db, vendor.id)),
  };

  return toServicePackage(await insertPackage(db, values));
}

/**
 * Applies a package edit. Only the submitted fields are touched, and the
 * profile is pulled off the marketplace if the edit leaves the vendor with
 * nothing bookable — a live listing with no package is a dead end for the
 * customer who clicks it.
 */
export async function updatePackage(
  db: AppDatabase,
  userId: string,
  packageId: string,
  input: UpdateServicePackageInput,
): Promise<ServicePackage> {
  const vendor = await requireOwnVendorProfile(db, userId);

  const existing = await findPackageById(db, vendor.id, packageId);
  if (!existing) {
    throw notFound('That package does not exist');
  }

  /* Excluded from the type for the reason `updateVendorProfile` gives (#457). */
  const patch: Omit<Partial<NewServicePackageRow>, 'moderationHold'> = {};

  if (input.name !== undefined) {
    patch.name = input.name;
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }
  if (input.priceCents !== undefined) {
    patch.priceCents = input.priceCents;
  }
  if (input.priceType !== undefined) {
    patch.priceType = input.priceType;
  }
  if (input.durationHours !== undefined) {
    patch.durationHours = input.durationHours?.toString() ?? null;
  }
  if (input.maxGuests !== undefined) {
    patch.maxGuests = input.maxGuests;
  }
  if (input.inclusions !== undefined) {
    patch.inclusions = input.inclusions;
  }
  if (input.displayOrder !== undefined) {
    patch.displayOrder = input.displayOrder;
  }
  if (input.isActive !== undefined) {
    /*
     * The package half of #457. Only the reactivation is refused: a held
     * package is already inactive, so a save that leaves it that way — which is
     * every save the editor makes while the hold stands — has nothing to
     * refuse, and blocking those would take the vendor's whole package editor
     * away over one switch.
     */
    if (input.isActive && existing.moderationHold) {
      throw forbidden(SERVICE_PACKAGE_MODERATION_HOLD_MESSAGE);
    }

    patch.isActive = input.isActive;
  }

  /*
   * The hold rides in the `WHERE`, not only in the check above (#457). `existing`
   * was read before this statement and nothing locks the row, so an admin's
   * deactivation committing in between would otherwise be overwritten by a
   * reactivation that had already passed.
   *
   * A deactivation takes the vendor lock before it writes, the order the vendor's
   * own publish uses, so the count `unpublishForMissingPackages` takes below and
   * the count a concurrent publish takes cannot both pass on the same package.
   */
  const row = await db.transaction(async (tx) => {
    if (input.isActive === false) {
      await lockVendorProfile(tx, vendor.id);
    }

    const updated = await updatePackageById(tx, vendor.id, packageId, patch, {
      requireUnheld: patch.isActive === true,
      expectedUpdatedAt: input.updatedAt,
    });

    if (updated && input.isActive === false) {
      await unpublishForMissingPackages(tx, vendor);
    }

    return updated;
  });

  if (!row) {
    const current = await findPackageById(db, vendor.id, packageId);

    if (patch.isActive === true && current?.moderationHold) {
      throw forbidden(SERVICE_PACKAGE_MODERATION_HOLD_MESSAGE);
    }

    /* The row is there and the write matched nothing, so it moved since the form opened (VEN-481). */
    if (current && input.updatedAt) {
      throw conflict(PACKAGE_CHANGED_MESSAGE, { current: toServicePackage(current) });
    }

    throw notFound('That package does not exist');
  }

  return toServicePackage(row);
}

/**
 * Reorders the vendor's packages. The submitted list has to name every package
 * the vendor owns: a partial list would leave the omitted ones sharing stale
 * positions with the reordered ones, which is not an order at all.
 */
export async function reorderPackages(
  db: AppDatabase,
  userId: string,
  input: ReorderServicePackagesInput,
): Promise<ServicePackage[]> {
  const vendor = await requireOwnVendorProfile(db, userId);

  const [owned, existing] = await Promise.all([
    findOwnedPackageIds(db, vendor.id, [...new Set(input.packageIds)]),
    findPackagesByVendor(db, vendor.id),
  ]);
  const unique = assertCompleteOrder(input.packageIds, owned, existing.length, 'package');

  await applyPackageOrder(db, vendor.id, unique);

  const rows = await findPackagesByVendor(db, vendor.id);
  return rows.map(toServicePackage);
}
