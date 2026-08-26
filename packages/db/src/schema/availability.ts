import { sql } from 'drizzle-orm';
import { date, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { availabilityStatusEnum } from './enums.js';
import { vendorProfiles } from './vendor-profiles.js';

/**
 * Sparse calendar: the absence of a row means the vendor is available. Dates
 * are Postgres `DATE` values so no timezone conversion can shift an event day.
 */
export const availability = pgTable(
  'availability',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendorProfiles.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    status: availabilityStatusEnum('status').notNull().default('available'),
    note: varchar('note', { length: 500 }),
  },
  (table) => [uniqueIndex('availability_vendor_date_key').on(table.vendorId, table.date)],
);

export type AvailabilityRow = typeof availability.$inferSelect;
export type NewAvailabilityRow = typeof availability.$inferInsert;
