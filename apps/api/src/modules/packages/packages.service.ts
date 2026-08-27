import type {
  CreateServicePackageInput,
  ReorderServicePackagesInput,
  ServicePackage,
  UpdateServicePackageInput,
} from '@vendor-marketplace/shared';
import type { NewServicePackageRow, ServicePackageRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { notFound } from '../../lib/errors.js';
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

/** Postgres NUMERIC columns arrive as strings from the driver. */
function parseDurationHours(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

  const patch: Partial<NewServicePackageRow> = {};

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
    patch.durationHours = input.durationHours.toString();
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
    patch.isActive = input.isActive;
  }

  const row = await updatePackageById(db, vendor.id, packageId, patch);
  if (!row) {
    throw notFound('That package does not exist');
  }

  if (input.isActive === false) {
    await unpublishForMissingPackages(db, vendor);
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
