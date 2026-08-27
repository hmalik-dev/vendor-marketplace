import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  servicePackages,
  type NewServicePackageRow,
  type ServicePackageRow,
} from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';

/** Newest packages sort last, so a fresh one lands at the end of the list. */
const byDisplayOrder = [asc(servicePackages.displayOrder), asc(servicePackages.createdAt)];

export async function findPackagesByVendor(
  db: AppDatabase,
  vendorId: string,
): Promise<ServicePackageRow[]> {
  if (!vendorId) {
    return [];
  }

  return db
    .select()
    .from(servicePackages)
    .where(eq(servicePackages.vendorId, vendorId))
    .orderBy(...byDisplayOrder);
}

export async function findPackageById(
  db: AppDatabase,
  vendorId: string,
  packageId: string,
): Promise<ServicePackageRow | null> {
  if (!vendorId || !packageId) {
    return null;
  }

  const rows = await db
    .select()
    .from(servicePackages)
    .where(and(eq(servicePackages.vendorId, vendorId), eq(servicePackages.id, packageId)))
    .limit(1);

  return rows?.[0] ?? null;
}

/** How many packages a customer would actually be able to book. */
export async function countActivePackages(db: AppDatabase, vendorId: string): Promise<number> {
  if (!vendorId) {
    return 0;
  }

  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(servicePackages)
    .where(and(eq(servicePackages.vendorId, vendorId), eq(servicePackages.isActive, true)));

  return rows?.[0]?.total ?? 0;
}

/** The order value that puts a new package after every existing one. */
export async function nextDisplayOrder(db: AppDatabase, vendorId: string): Promise<number> {
  const rows = await db
    .select({ highest: sql<number | null>`max(${servicePackages.displayOrder})` })
    .from(servicePackages)
    .where(eq(servicePackages.vendorId, vendorId));

  const highest = rows?.[0]?.highest;
  return highest === null || highest === undefined ? 0 : highest + 1;
}

export async function insertPackage(
  db: AppDatabase,
  values: NewServicePackageRow,
): Promise<ServicePackageRow> {
  const inserted = await db.insert(servicePackages).values(values).returning();
  const row = inserted?.[0];

  if (!row) {
    throw new Error('Service package insert returned no row');
  }

  return row;
}

export async function updatePackageById(
  db: AppDatabase,
  vendorId: string,
  packageId: string,
  patch: Partial<NewServicePackageRow>,
): Promise<ServicePackageRow | null> {
  if (!vendorId || !packageId || Object.keys(patch).length === 0) {
    return null;
  }

  const updated = await db
    .update(servicePackages)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(servicePackages.vendorId, vendorId), eq(servicePackages.id, packageId)))
    .returning();

  return updated?.[0] ?? null;
}

/** Ids among `packageIds` that belong to this vendor, for ownership checks. */
export async function findOwnedPackageIds(
  db: AppDatabase,
  vendorId: string,
  packageIds: readonly string[],
): Promise<string[]> {
  if (!vendorId || packageIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: servicePackages.id })
    .from(servicePackages)
    .where(
      and(eq(servicePackages.vendorId, vendorId), inArray(servicePackages.id, [...packageIds])),
    );

  return rows.map((row) => row.id);
}

/**
 * Writes the new positions in one transaction, so a failure part-way through
 * cannot leave the list half-reordered.
 */
export async function applyPackageOrder(
  db: AppDatabase,
  vendorId: string,
  packageIds: readonly string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [index, packageId] of packageIds.entries()) {
      await tx
        .update(servicePackages)
        .set({ displayOrder: index, updatedAt: sql`now()` })
        .where(and(eq(servicePackages.vendorId, vendorId), eq(servicePackages.id, packageId)));
    }
  });
}
