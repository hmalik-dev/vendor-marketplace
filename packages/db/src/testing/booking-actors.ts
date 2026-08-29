import type { PgliteDatabase } from 'drizzle-orm/pglite';
import type * as schema from '../schema/index.js';
import { servicePackages, users, vendorProfiles } from '../schema/index.js';

/** The three ids a booking request needs, and nothing else. */
export interface BookingActors {
  readonly customerId: string;
  readonly vendorId: string;
  readonly packageId: string;
}

/**
 * One customer, one vendor and one package — the cast every booking-request
 * test needs before it can insert a row.
 *
 * `suffix` keeps two suites sharing a database from colliding on the unique
 * `clerk_user_id`, `email` and `slug` columns. Internal to this package: it is
 * deliberately not on the `@vendor-marketplace/db/testing` entry point, which
 * exists for the API harness rather than for these suites.
 */
export async function seedBookingActors(
  db: PgliteDatabase<typeof schema>,
  suffix: string,
): Promise<BookingActors> {
  const [customer] = await db
    .insert(users)
    .values({
      clerkUserId: `user_${suffix}_customer`,
      email: `${suffix}-customer@example.com`,
      role: 'customer',
      firstName: 'Dora',
      lastName: 'Duplicate',
    })
    .returning({ id: users.id });

  const [owner] = await db
    .insert(users)
    .values({
      clerkUserId: `user_${suffix}_vendor`,
      email: `${suffix}-vendor@example.com`,
      role: 'vendor',
      firstName: 'Wren',
      lastName: 'Field',
    })
    .returning({ id: users.id });

  const [profile] = await db
    .insert(vendorProfiles)
    .values({ userId: owner!.id, businessName: 'Wren & Field', slug: `wren-field-${suffix}` })
    .returning({ id: vendorProfiles.id });

  const [servicePackage] = await db
    .insert(servicePackages)
    .values({
      vendorId: profile!.id,
      name: 'Full day coverage',
      description: 'Six hours of coverage with two photographers on site.',
      priceCents: 145_000,
      priceType: 'fixed',
    })
    .returning({ id: servicePackages.id });

  return { customerId: customer!.id, vendorId: profile!.id, packageId: servicePackage!.id };
}
